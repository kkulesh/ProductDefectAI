"""Helpers for saving uploaded images/videos to local disk storage
(no database — files live under storage/uploads/*, referenced by URL path)."""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import HTTPException, UploadFile

from .. import config


def _ext_ok(filename: str, allowed: set[str]) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(allowed)}",
        )
    return ext


def save_image(file: UploadFile) -> tuple[Path, str]:
    ext = _ext_ok(file.filename or "upload", config.ALLOWED_IMAGE_EXT)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = config.IMAGES_DIR / name
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return dest, f"/media/images/{name}"


def save_video(file: UploadFile) -> tuple[Path, str]:
    ext = _ext_ok(file.filename or "upload", config.ALLOWED_VIDEO_EXT)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = config.VIDEOS_DIR / name
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return dest, f"/media/videos/{name}"


def save_capture_bytes(data: bytes, ext: str = ".jpg") -> tuple[Path, str]:
    name = f"{uuid.uuid4().hex}{ext}"
    dest = config.CAPTURES_DIR / name
    with open(dest, "wb") as out:
        out.write(data)
    return dest, f"/media/captures/{name}"


# Box color (BGR, since we draw with OpenCV) and padding used for
# per-detection thumbnails. Padding keeps some surrounding context instead
# of cropping tight to just the defect pixels.
_THUMB_BOX_COLOR_BGR = (0, 0, 255)  # red, matches the frontend's overlay color
_THUMB_BOX_THICKNESS = 3
_THUMB_PADDING_FRACTION = 0.35  # extra context around the box, as a fraction of box size
_THUMB_MIN_PADDING_PX = 20


def save_detection_thumbnail(
    source_image_path: Path | str,
    box_x: float,
    box_y: float,
    box_width: float,
    box_height: float,
) -> str | None:
    """
    Given a full source image and a single detection's normalized
    (0-1) box coordinates, produce a per-detection thumbnail: the
    surrounding region cropped with some padding for context, with the
    detection's bounding box drawn on it. This is what Defect Review and
    Historical Archive display per-record, instead of every detection
    from the same image/frame sharing one identical full picture.

    Returns the thumbnail's URL path, or None if the source image
    couldn't be read (caller should fall back to the original imageUrl).
    """
    img = cv2.imread(str(source_image_path))
    if img is None:
        return None

    img_h, img_w = img.shape[:2]

    # Convert normalized box to pixel coordinates
    x1 = box_x * img_w
    y1 = box_y * img_h
    x2 = x1 + box_width * img_w
    y2 = y1 + box_height * img_h

    box_w_px = x2 - x1
    box_h_px = y2 - y1
    pad_x = max(box_w_px * _THUMB_PADDING_FRACTION, _THUMB_MIN_PADDING_PX)
    pad_y = max(box_h_px * _THUMB_PADDING_FRACTION, _THUMB_MIN_PADDING_PX)

    # Crop region = box + padding, clamped to image bounds
    crop_x1 = int(max(0, x1 - pad_x))
    crop_y1 = int(max(0, y1 - pad_y))
    crop_x2 = int(min(img_w, x2 + pad_x))
    crop_y2 = int(min(img_h, y2 + pad_y))

    if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
        return None

    # Draw the box on a copy of the FULL image first (so coordinates are
    # simple to reason about), then crop — this also means the box is
    # correctly clipped if it extends past the crop padding boundary.
    annotated = img.copy()
    cv2.rectangle(
        annotated,
        (int(x1), int(y1)),
        (int(x2), int(y2)),
        _THUMB_BOX_COLOR_BGR,
        _THUMB_BOX_THICKNESS,
    )

    crop = annotated[crop_y1:crop_y2, crop_x1:crop_x2]
    if crop.size == 0:
        return None

    ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        return None

    name = f"{uuid.uuid4().hex}.jpg"
    dest = config.THUMBNAILS_DIR / name
    with open(dest, "wb") as out:
        out.write(buf.tobytes())
    return f"/media/thumbnails/{name}"


def save_detection_thumbnail_from_array(
    frame: np.ndarray,
    box_x: float,
    box_y: float,
    box_width: float,
    box_height: float,
) -> str | None:
    """Same as save_detection_thumbnail but takes an in-memory BGR frame
    (used by the camera WebSocket and video frame processing, which
    already have the frame decoded rather than a file on disk)."""
    if frame is None:
        return None

    img_h, img_w = frame.shape[:2]

    x1 = box_x * img_w
    y1 = box_y * img_h
    x2 = x1 + box_width * img_w
    y2 = y1 + box_height * img_h

    box_w_px = x2 - x1
    box_h_px = y2 - y1
    pad_x = max(box_w_px * _THUMB_PADDING_FRACTION, _THUMB_MIN_PADDING_PX)
    pad_y = max(box_h_px * _THUMB_PADDING_FRACTION, _THUMB_MIN_PADDING_PX)

    crop_x1 = int(max(0, x1 - pad_x))
    crop_y1 = int(max(0, y1 - pad_y))
    crop_x2 = int(min(img_w, x2 + pad_x))
    crop_y2 = int(min(img_h, y2 + pad_y))

    if crop_x2 <= crop_x1 or crop_y2 <= crop_y1:
        return None

    annotated = frame.copy()
    cv2.rectangle(
        annotated,
        (int(x1), int(y1)),
        (int(x2), int(y2)),
        _THUMB_BOX_COLOR_BGR,
        _THUMB_BOX_THICKNESS,
    )

    crop = annotated[crop_y1:crop_y2, crop_x1:crop_x2]
    if crop.size == 0:
        return None

    ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        return None

    name = f"{uuid.uuid4().hex}.jpg"
    dest = config.THUMBNAILS_DIR / name
    with open(dest, "wb") as out:
        out.write(buf.tobytes())
    return f"/media/thumbnails/{name}"

