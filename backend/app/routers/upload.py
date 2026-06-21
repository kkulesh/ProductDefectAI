"""
Upload and inference endpoints.

POST /api/upload/image  -> save image, run YOLO inference, persist Detection
                            records for every box found, return them.
POST /api/upload/video  -> save video file to storage (frame-by-frame
                            inference kicked off separately via
                            /api/upload/video/{id}/process to keep the
                            initial upload fast).
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import config
from ..schemas import BoundingBox, Detection, RemovalStatus, VideoFrameResult, VideoProcessResult
from ..services import inference, media_storage
from ..storage import class_policy_repo, daily_stats_repo, detections_repo

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    confidence_threshold: float = Form(0.5),
):
    dest_path, url = media_storage.save_image(file)

    try:
        boxes, inference_ms = inference.run_inference(str(dest_path), confidence_threshold)
    except Exception as e:
        raise HTTPException(500, f"Inference failed: {e}")

    # One inspection per image processed, regardless of how many (if any)
    # defects were found on it.
    daily_stats_repo.record_inspection()

    created: list[Detection] = []
    for box in boxes:
        # Per-detection thumbnail: a crop around just this box (with some
        # padding for context) with the box drawn on it — so each record
        # shows its own defect, not the same shared full-frame image as
        # every other detection from this upload.
        thumbnail_url = media_storage.save_detection_thumbnail(
            dest_path, box.x, box.y, box.width, box.height
        )
        is_defect = class_policy_repo.is_defect_class(box.label)
        det = Detection(
            defectType=box.label,
            confidence=box.confidence,
            imageUrl=thumbnail_url or url,  # fall back to full image if cropping failed
            sourceImageUrl=url,
            removalStatus=RemovalStatus.pending,
            position={"x": box.x * 100, "y": box.y * 100},
            source="upload",
            width=box.width * 100,
            height=box.height * 100,
            isDefect=is_defect,
        )
        created.append(det)
        if is_defect:
            daily_stats_repo.record_defect_found()

    if created:
        detections_repo.add_detections_bulk(created)

    return {
        "imageUrl": url,
        "inferenceMs": inference_ms,
        "modelName": inference.model_name(),
        "usingCustomModel": inference.is_using_custom_model(),
        "warning": None if inference.is_using_custom_model() else inference.FALLBACK_MODEL_WARNING,
        "detections": [d.model_dump(mode="json") for d in created],
        "detectionCount": len(created),
    }


@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    dest_path, url = media_storage.save_video(file)
    cap = cv2.VideoCapture(str(dest_path))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    return {
        "videoUrl": url,
        "filename": Path(dest_path).name,
        "frameCount": frame_count,
        "fps": fps,
        "durationSeconds": (frame_count / fps) if fps else None,
    }


@router.post("/video/process", response_model=VideoProcessResult)
async def process_video(
    filename: str = Form(...),
    confidence_threshold: float = Form(0.5),
    sample_every_n_frames: int = Form(15),
    max_frames: int = Form(60),
):
    """
    Run YOLO over sampled frames of a previously-uploaded video.

    Every sampled frame is captured and returned as its own entry in
    `frames`, with its own image and its own boxes — including frames
    with zero detections — so the frontend can render a frame-by-frame
    player (e.g. a filmstrip/scrubber) with each box correctly
    positioned against the frame it was actually detected on, instead of
    a flat detection list with no frame grouping.

    Detection records (for Defect Review / Historical Archive) are still
    created for every box found, tagged with frameIndex for traceability.

    Synchronous and bounded by max_frames to keep request times sane;
    for long videos call this multiple times or lower the sample rate.
    """
    video_path = config.VIDEOS_DIR / filename
    if not video_path.exists():
        raise HTTPException(404, "Video not found. Upload it first via /api/upload/video")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise HTTPException(400, "Could not open video file")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0

    created: list[Detection] = []
    frame_results: list[VideoFrameResult] = []
    frame_idx = 0
    processed_frames = 0
    total_detections = 0

    while processed_frames < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % sample_every_n_frames == 0:
            boxes, _ = inference.run_inference_on_array(frame, confidence_threshold)

            # One inspection per sampled frame, regardless of whether any
            # defects were found on it.
            daily_stats_repo.record_inspection()

            # Always capture the frame so the frontend can build a
            # contiguous frame-by-frame player, even when nothing was
            # detected on it.
            ok_enc, buf = cv2.imencode(".jpg", frame)
            capture_url = ""
            if ok_enc:
                _, capture_url = media_storage.save_capture_bytes(buf.tobytes())

            for box in boxes:
                thumbnail_url = media_storage.save_detection_thumbnail_from_array(
                    frame, box.x, box.y, box.width, box.height
                )
                is_defect = class_policy_repo.is_defect_class(box.label)
                det = Detection(
                    defectType=box.label,
                    confidence=box.confidence,
                    imageUrl=thumbnail_url or capture_url,
                    sourceImageUrl=capture_url,
                    removalStatus=RemovalStatus.pending,
                    position={"x": box.x * 100, "y": box.y * 100},
                    source="video",
                    width=box.width * 100,
                    height=box.height * 100,
                    frameIndex=processed_frames,
                    isDefect=is_defect,
                )
                created.append(det)
                if is_defect:
                    daily_stats_repo.record_defect_found()
                total_detections += 1

            frame_results.append(VideoFrameResult(
                frameIndex=processed_frames,
                sourceFrameNumber=frame_idx,
                timestampSeconds=(frame_idx / fps) if fps else 0.0,
                imageUrl=capture_url,
                boxes=boxes,
            ))
            processed_frames += 1
        frame_idx += 1

    cap.release()
    if created:
        detections_repo.add_detections_bulk(created)

    using_custom = inference.is_using_custom_model()
    return VideoProcessResult(
        filename=filename,
        framesProcessed=processed_frames,
        fps=fps,
        frames=frame_results,
        detectionCount=total_detections,
        usingCustomModel=using_custom,
        warning=None if using_custom else inference.FALLBACK_MODEL_WARNING,
    )
