from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel

from app.services import yolo_service, image_service, storage_service

router = APIRouter()


class Base64Request(BaseModel):
    image: str           # data URI or raw base64
    confidence: float = 0.25


# ─── POST /detect-base64 ──────────────────────────────────────────────────
# Called by Dashboard.tsx and DetectionMonitoring.tsx every second

@router.post("/detect-base64")
async def detect_base64(body: Base64Request):
    try:
        pil_image = yolo_service.decode_base64_image(body.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    result = yolo_service.run_detection(pil_image, body.confidence)

    # Persist to detections.json only when something was found
    if result["detections"]:
        record = {
            "id": result["detection_id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detections": result["detections"],
            "imageWidth": result["image_width"],
            "imageHeight": result["image_height"],
            "inferenceMsec": result["inference_ms"],
            "source": "stream",
            "operatorConfirmed": None,
            "removalStatus": "pending",
        }
        storage_service.save_detection(record)

    return result


# ─── POST /detect-file ────────────────────────────────────────────────────
# Used by Dashboard "Upload Media" → "Run Detection" button

@router.post("/detect-file")
async def detect_file(
    file: UploadFile = File(...),
    confidence: float = Query(0.25, ge=0.0, le=1.0),
):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")

    raw = await file.read()
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    try:
        result = yolo_service.run_detection_from_file(raw, confidence)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Save annotated image to processed/
    from PIL import Image
    import io
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    annotated_url = image_service.draw_boxes_and_save(
        pil, result["detections"], result["detection_id"]
    )

    record = {
        "id": result["detection_id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detections": result["detections"],
        "imageWidth": result["image_width"],
        "imageHeight": result["image_height"],
        "inferenceMsec": result["inference_ms"],
        "annotatedImageUrl": annotated_url,
        "source": "upload",
        "originalFilename": file.filename,
        "operatorConfirmed": None,
        "removalStatus": "pending",
    }
    storage_service.save_detection(record)

    return {**result, "annotatedImageUrl": annotated_url}
