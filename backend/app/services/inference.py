"""
Inference service wrapping an Ultralytics YOLO model.

Design notes:
- Lazily loads the model on first use (keeps API startup fast).
- Looks for a trained model at storage/models/best.pt first (produced
  by scripts/train.py). Falls back to a stock yolov8n.pt (COCO classes)
  so the API is usable end-to-end before you've trained on your own
  dataset — predictions just won't be meaningful defect classes yet.
- Thread-safe-ish singleton; ultralytics models are fine to reuse
  across requests sequentially (FastAPI's threadpool serializes CPU
  work per-request anyway for sync endpoints).
"""
from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Optional

from .. import config
from ..schemas import BoundingBox

_model = None
_model_lock = threading.Lock()
_model_path_loaded: Optional[str] = None


def _resolve_weights_path() -> str:
    if config.DEFAULT_MODEL_WEIGHTS.exists():
        return str(config.DEFAULT_MODEL_WEIGHTS)
    return config.FALLBACK_MODEL_NAME  # ultralytics will auto-download this


def get_model():
    global _model, _model_path_loaded
    weights_path = _resolve_weights_path()
    with _model_lock:
        if _model is None or _model_path_loaded != weights_path:
            from ultralytics import YOLO  # imported here so the app can boot
            # without ultralytics installed (e.g. while only browsing pages
            # that don't need inference).
            _model = YOLO(weights_path)
            _model_path_loaded = weights_path
        return _model


def is_using_custom_model() -> bool:
    return config.DEFAULT_MODEL_WEIGHTS.exists()


FALLBACK_MODEL_WARNING = (
    "No trained defect-detection model found at storage/models/best.pt — "
    "using the stock YOLOv8 COCO model as a fallback so the API stays "
    "functional. COCO is trained on general objects (person, car, orange, "
    "train, etc.), NOT your defect classes, so results below are not "
    "meaningful defect detections. Run scripts/train.py on your dataset, "
    "then restart the API (or make another request) to use your trained "
    "model."
)


def model_name() -> str:
    return Path(_resolve_weights_path()).name


def run_inference(image_path: str, confidence_threshold: float = 0.5) -> tuple[list[BoundingBox], float]:
    """
    Run YOLO inference on an image file.
    Returns (boxes, inference_ms). Boxes are normalized [0,1] x/y/w/h,
    matching what the React overlay components expect (percentages).
    """
    model = get_model()
    start = time.time()
    results = model.predict(
        source=image_path,
        conf=confidence_threshold,
        verbose=False,
    )
    elapsed_ms = (time.time() - start) * 1000

    boxes: list[BoundingBox] = []
    if not results:
        return boxes, elapsed_ms

    result = results[0]
    img_h, img_w = result.orig_shape
    names = result.names

    for box in result.boxes:
        xyxy = box.xyxy[0].tolist()
        x1, y1, x2, y2 = xyxy
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)

        boxes.append(BoundingBox(
            label=label,
            confidence=conf,
            x=x1 / img_w,
            y=y1 / img_h,
            width=(x2 - x1) / img_w,
            height=(y2 - y1) / img_h,
        ))

    return boxes, elapsed_ms


def run_inference_on_array(frame, confidence_threshold: float = 0.5) -> tuple[list[BoundingBox], float]:
    """Same as run_inference but operates on an in-memory numpy BGR frame
    (used by the camera WebSocket stream)."""
    model = get_model()
    start = time.time()
    results = model.predict(source=frame, conf=confidence_threshold, verbose=False)
    elapsed_ms = (time.time() - start) * 1000

    boxes: list[BoundingBox] = []
    if not results:
        return boxes, elapsed_ms

    result = results[0]
    img_h, img_w = result.orig_shape
    names = result.names

    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
        boxes.append(BoundingBox(
            label=label,
            confidence=conf,
            x=x1 / img_w,
            y=y1 / img_h,
            width=(x2 - x1) / img_w,
            height=(y2 - y1) / img_h,
        ))

    return boxes, elapsed_ms


def run_inference_on_batch(
    frames: list, confidence_threshold: float = 0.5
) -> tuple[list[list[BoundingBox]], float]:
    """
    Run YOLO inference on a batch of in-memory BGR frames in a single
    model call, used by video processing to get better throughput than
    calling run_inference_on_array once per frame — Ultralytics natively
    accepts a list of frames and processes them more efficiently than
    the same number of separate predict() calls (especially on GPU,
    where per-call overhead dominates at small batch sizes).

    Returns (list of per-frame box lists, total elapsed ms for the whole
    batch). The outer list has the same length and order as `frames`.
    """
    if not frames:
        return [], 0.0

    model = get_model()
    start = time.time()
    results = model.predict(source=frames, conf=confidence_threshold, verbose=False)
    elapsed_ms = (time.time() - start) * 1000

    all_boxes: list[list[BoundingBox]] = []
    for result in results:
        img_h, img_w = result.orig_shape
        names = result.names
        boxes: list[BoundingBox] = []
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
            boxes.append(BoundingBox(
                label=label,
                confidence=conf,
                x=x1 / img_w,
                y=y1 / img_h,
                width=(x2 - x1) / img_w,
                height=(y2 - y1) / img_h,
            ))
        all_boxes.append(boxes)

    return all_boxes, elapsed_ms
