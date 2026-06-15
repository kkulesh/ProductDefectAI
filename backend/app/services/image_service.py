import base64
import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps

UPLOAD_DIR = Path("app/uploads/images")
PROCESSED_DIR = Path("app/uploads/processed")


def save_upload(file_bytes: bytes, filename: str | None = None) -> Path:
    """Save raw uploaded bytes, return the path."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stem = filename or str(uuid.uuid4())
    dest = UPLOAD_DIR / stem
    dest.write_bytes(file_bytes)
    return dest


def resize_for_inference(image: Image.Image, target_size: int = 640) -> Image.Image:
    """Resize while preserving aspect ratio (letterbox). YOLO expects square input."""
    image = ImageOps.exif_transpose(image)  # auto-rotate from EXIF
    image.thumbnail((target_size, target_size), Image.LANCZOS)
    return image


def draw_boxes_and_save(
    image: Image.Image,
    detections: list[dict],
    detection_id: str,
) -> str:
    """
    Draw bounding boxes on a copy of the image and save to processed/.
    Returns a URL path like /uploads/processed/<id>.jpg
    """
    from PIL import ImageDraw, ImageFont

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out = image.copy().convert("RGB")
    draw = ImageDraw.Draw(out)

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        label = f"{det['class']} {det['confidence']:.0%}"
        draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
        draw.rectangle([x1, y1 - 18, x1 + len(label) * 7, y1], fill="red")
        draw.text((x1 + 3, y1 - 16), label, fill="white")

    dest = PROCESSED_DIR / f"{detection_id}.jpg"
    out.save(str(dest), "JPEG", quality=85)
    return f"/uploads/processed/{detection_id}.jpg"


def image_to_base64(image: Image.Image, fmt: str = "JPEG") -> str:
    buf = io.BytesIO()
    image.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()
