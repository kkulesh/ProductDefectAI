import base64
import io
import time
import uuid
from pathlib import Path
 
import numpy as np
from PIL import Image
from ultralytics import YOLO
 
MODEL_PATH = Path("trained_models/best.pt")
 
BAD_CLASSES = {"bad apple", "bad banana", "bad orange"}
 
 
class YOLOService:
    def __init__(self, model_path: str = str(MODEL_PATH)):
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Model not found at {model_path}")
        self.model = YOLO(model_path)
        self.class_names = self.model.names
 
    def predict(self, image: np.ndarray) -> list[dict]:
        """Run inference on a numpy image, return all detections."""
        results = self.model(image)
        detections = []
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                detections.append({
                    "class": self.class_names[class_id],
                    "confidence": round(confidence, 3),
                    "bbox": [x1, y1, x2, y2],
                })
        return detections
 
    def predict_bad_only(self, image: np.ndarray) -> list[dict]:
        """Return only defective product detections."""
        return [d for d in self.predict(image) if d["class"] in BAD_CLASSES]
 
    def predict_with_annotations(self, image: np.ndarray) -> tuple[np.ndarray, list[dict]]:
        """Return annotated image array + detections."""
        results = self.model(image)
        annotated = results[0].plot()
        detections = self.predict(image)
        return annotated, detections
 
 
# ─── module-level singleton ──────────────────────────────────────────────────
 
_service: YOLOService | None = None
 
 
def get_service() -> YOLOService:
    global _service
    if _service is None:
        _service = YOLOService()
    return _service
 
 
# ─── helpers used by detect_routes.py ────────────────────────────────────────
 
def decode_base64_image(data_uri: str) -> Image.Image:
    if "," in data_uri:
        data_uri = data_uri.split(",", 1)[1]
    raw = base64.b64decode(data_uri)
    return Image.open(io.BytesIO(raw)).convert("RGB")
 
 
def run_detection(pil_image: Image.Image, confidence_threshold: float = 0.25) -> dict:
    svc = get_service()
    img_np = np.array(pil_image)
    w, h = pil_image.size
 
    t0 = time.perf_counter()
    detections = svc.predict(img_np)
    elapsed_ms = (time.perf_counter() - t0) * 1000
 
    filtered = [d for d in detections if d["confidence"] >= confidence_threshold]
 
    return {
        "detection_id": str(uuid.uuid4()),
        "detections": filtered,
        "image_width": w,
        "image_height": h,
        "inference_ms": round(elapsed_ms, 1),
    }
 
 
def run_detection_from_file(file_bytes: bytes, confidence_threshold: float = 0.25) -> dict:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return run_detection(image, confidence_threshold)
 
 
def run_detection_from_base64(data_uri: str, confidence_threshold: float = 0.25) -> dict:
    image = decode_base64_image(data_uri)
    return run_detection(image, confidence_threshold)