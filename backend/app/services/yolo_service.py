import base64
import io
import time
import uuid
from typing import Optional

import numpy as np
from PIL import Image, ImageOps
from ultralytics import YOLO


# TODO: point this at your trained weights file
MODEL_PATH = "trained_models/best.pt"


class YOLOService:
    def __init__(self, model_path: str):
        # Load trained model
        self.model = YOLO(model_path)

        # Class names (optional override if needed)
        self.class_names = self.model.names

    def predict(self, image: np.ndarray, conf: float = 0.25):
        """
        Run inference on a single image/frame.

        Returns structured detections.
        """

        results = self.model(image, conf=conf)

        detections = []

        for result in results:
            boxes = result.boxes

            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = self.class_names[class_id]

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                detections.append({
                    "class": class_name,
                    "confidence": round(confidence, 3),
                    "bbox": [x1, y1, x2, y2]
                })

        return detections

    def predict_bad_only(self, image: np.ndarray, conf: float = 0.25):
        """
        Filter only bad fruits.
        """

        detections = self.predict(image, conf=conf)

        bad_classes = {
            "bad apple",
            "bad banana",
            "bad orange"
        }

        return [
            d for d in detections
            if d["class"] in bad_classes
        ]

    def predict_with_annotations(self, image: np.ndarray, conf: float = 0.25):
        """
        Returns image + detections (useful for API response).
        """

        results = self.model(image, conf=conf)
        annotated_image = results[0].plot()

        detections = self.predict(image, conf=conf)

        return annotated_image, detections


# ─── module-level helpers used by detect_routes.py ──────────────────────────
#
# detect_routes.py imports this module and calls:
#   - decode_base64_image(body.image)
#   - run_detection(pil_image, body.confidence)
#   - run_detection_from_file(raw_bytes, confidence)
#
# These were missing, which caused every /detect-base64 call to raise
# AttributeError -> caught by the route's bare `except Exception` ->
# returned as a 400 "Invalid base64 image data".

_service: Optional[YOLOService] = None


def _get_service() -> YOLOService:
    global _service
    if _service is None:
        _service = YOLOService(MODEL_PATH)
    return _service


def decode_base64_image(data: str) -> Image.Image:
    """
    Decode a base64-encoded image into a PIL Image.

    Accepts either a raw base64 string or a data URI like
    'data:image/jpeg;base64,/9j/4AAQ...' (what <canvas>.toDataURL()
    produces in DetectionMonitoring.tsx / Dashboard.tsx).
    """
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]

    image_bytes = base64.b64decode(data)
    image = Image.open(io.BytesIO(image_bytes))
    return ImageOps.exif_transpose(image).convert("RGB")


def _run(image: Image.Image, confidence: float) -> dict:
    service = _get_service()
    np_image = np.array(image)

    start = time.perf_counter()
    detections = service.predict(np_image, conf=confidence)
    inference_ms = (time.perf_counter() - start) * 1000

    return {
        "detection_id": str(uuid.uuid4()),
        "detections": detections,
        "image_width": image.width,
        "image_height": image.height,
        "inference_ms": round(inference_ms, 2),
    }


def run_detection(image: Image.Image, confidence: float = 0.25) -> dict:
    """Run detection on an already-decoded PIL image."""
    return _run(image, confidence)


def run_detection_from_file(raw_bytes: bytes, confidence: float = 0.25) -> dict:
    """Run detection on raw uploaded file bytes (e.g. from detect-file)."""
    image = Image.open(io.BytesIO(raw_bytes))
    image = ImageOps.exif_transpose(image).convert("RGB")
    return _run(image, confidence)