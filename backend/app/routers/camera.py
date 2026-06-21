"""
Camera endpoints for the Detection Monitoring page.

Design (per chosen architecture):
- The BROWSER captures frames from the user's webcam (getUserMedia) and
  sends them to the backend over a WebSocket as base64 JPEG frames.
- The backend runs YOLO inference on each frame and returns bounding
  boxes as JSON, which the frontend draws as an overlay (same pattern
  the existing DetectionMonitoring.tsx mock already uses for its
  overlay boxes, just now backed by a real model).
- This avoids the backend needing direct OS-level camera access, which
  doesn't make sense for a browser-based app anyway (the camera is on
  the client's machine, not the server's).
- A REST endpoint also exists for backend-attached cameras (e.g. an
  industrial USB/RTSP camera wired directly to the server) via OpenCV,
  for the case where /api/camera/server-snapshot is more appropriate.

Detections above the confidence threshold are optionally persisted as
Detection records (throttled) so the review/archive pages populate
from live camera use too.
"""
from __future__ import annotations

import base64
import time
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from ..schemas import Detection, RemovalStatus
from ..services import inference, media_storage
from ..storage import daily_stats_repo, detections_repo

router = APIRouter(prefix="/api/camera", tags=["camera"])

# Throttle persisted detections from the live stream so rapid frames don't
# flood the JSON store; only save once per this many seconds per session.
_PERSIST_INTERVAL_SECONDS = 2.0


@router.get("/status")
def camera_status():
    return {
        "modelLoaded": True,
        "modelName": inference.model_name(),
        "usingCustomModel": inference.is_using_custom_model(),
    }


@router.get("/server-snapshot")
def server_snapshot(device_index: int = 0):
    """
    For a camera physically attached to the SERVER (industrial line camera),
    grab a single frame via OpenCV and run inference on it. Most browser-based
    deployments will use the WebSocket flow instead.
    """
    cap = cv2.VideoCapture(device_index)
    if not cap.isOpened():
        raise HTTPException(503, f"Could not open server camera at index {device_index}")
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise HTTPException(503, "Failed to read frame from server camera")

    boxes, inference_ms = inference.run_inference_on_array(frame)
    ok_enc, buf = cv2.imencode(".jpg", frame)
    capture_url = None
    if ok_enc:
        _, capture_url = media_storage.save_capture_bytes(buf.tobytes())

    return {
        "imageUrl": capture_url,
        "inferenceMs": inference_ms,
        "detections": [b.model_dump() for b in boxes],
    }


def _decode_base64_frame(b64_data: str) -> Optional[np.ndarray]:
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw = base64.b64decode(b64_data)
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


@router.websocket("/stream")
async def camera_stream(websocket: WebSocket):
    """
    Protocol:
      Client -> Server (JSON): {"frame": "<base64 jpeg>", "confidence": 0.75, "persist": true}
      Server -> Client (JSON): {
          "detections": [{label, confidence, x, y, width, height}, ...],
          "inferenceMs": 12.3,
          "modelName": "best.pt",
          "usingCustomModel": true,
          "warning": null  // set to a string if falling back to the stock COCO model
      }
    Client is expected to send frames at a reasonable interval (e.g. every
    200-500ms) — this endpoint does not throttle incoming frames itself.
    """
    await websocket.accept()
    last_persist_ts = 0.0

    try:
        while True:
            payload = await websocket.receive_json()
            b64_frame = payload.get("frame")
            if not b64_frame:
                await websocket.send_json({"error": "missing 'frame' field"})
                continue

            confidence = float(payload.get("confidence", 0.5))
            should_persist = bool(payload.get("persist", False))

            frame = _decode_base64_frame(b64_frame)
            if frame is None:
                await websocket.send_json({"error": "could not decode frame"})
                continue

            try:
                boxes, inference_ms = inference.run_inference_on_array(frame, confidence)
            except Exception as e:
                await websocket.send_json({"error": f"inference failed: {e}"})
                continue

            # Every frame that actually gets run through the model counts
            # as one inspection, regardless of whether anything was found
            # or whether this particular detection gets persisted below.
            daily_stats_repo.record_inspection()

            using_custom = inference.is_using_custom_model()
            response = {
                "detections": [b.model_dump() for b in boxes],
                "inferenceMs": inference_ms,
                "modelName": inference.model_name(),
                "usingCustomModel": using_custom,
                "warning": None if using_custom else inference.FALLBACK_MODEL_WARNING,
            }

            now = time.time()
            if should_persist and boxes and (now - last_persist_ts) > _PERSIST_INTERVAL_SECONDS:
                last_persist_ts = now
                ok_enc, buf = cv2.imencode(".jpg", frame)
                capture_url = None
                if ok_enc:
                    _, capture_url = media_storage.save_capture_bytes(buf.tobytes())

                created = []
                for box in boxes:
                    thumbnail_url = media_storage.save_detection_thumbnail_from_array(
                        frame, box.x, box.y, box.width, box.height
                    )
                    det = Detection(
                        defectType=box.label,
                        confidence=box.confidence,
                        imageUrl=thumbnail_url or capture_url or "",
                        sourceImageUrl=capture_url,
                        removalStatus=RemovalStatus.pending,
                        position={"x": box.x * 100, "y": box.y * 100},
                        source="camera",
                        width=box.width * 100,
                        height=box.height * 100,
                    )
                    created.append(det)
                    daily_stats_repo.record_defect_found()

                if created:
                    detections_repo.add_detections_bulk(created)
                    response["persisted"] = len(created)

            await websocket.send_json(response)

    except WebSocketDisconnect:
        pass
