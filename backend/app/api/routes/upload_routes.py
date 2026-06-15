import csv
import io
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services import storage_service

router = APIRouter()


# ─── GET /detections ────────────────────────────────────────────────────────
# DefectReview.tsx and HistoricalArchive.tsx read this list

@router.get("")
def list_detections(
    status: Optional[Literal["pending", "confirmed", "rejected"]] = Query(None),
    defect_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    records = storage_service.load_detections()

    # Filter by operator status
    if status == "pending":
        records = [r for r in records if r.get("operatorConfirmed") is None]
    elif status == "confirmed":
        records = [r for r in records if r.get("operatorConfirmed") is True]
    elif status == "rejected":
        records = [r for r in records if r.get("operatorConfirmed") is False]

    # Filter by defect type
    if defect_type and defect_type != "all":
        records = [
            r for r in records
            if any(d.get("class") == defect_type for d in r.get("detections", []))
        ]

    # Search by id or defect class
    if search:
        q = search.lower()
        records = [
            r for r in records
            if q in r.get("id", "").lower()
            or any(q in d.get("class", "").lower() for d in r.get("detections", []))
        ]

    total = len(records)
    # Newest first
    records = list(reversed(records))[offset : offset + limit]

    return {"total": total, "items": records}


# ─── GET /detections/{id} ────────────────────────────────────────────────────

@router.get("/{detection_id}")
def get_detection(detection_id: str):
    record = storage_service.get_detection_by_id(detection_id)
    if not record:
        raise HTTPException(status_code=404, detail="Detection not found")
    return record


# ─── PATCH /detections/{id} ──────────────────────────────────────────────────
# DefectReview: Approve / Reject / Mark for removal buttons

class PatchBody(BaseModel):
    operatorConfirmed: Optional[bool] = None
    removalStatus: Optional[Literal["pending", "simulated", "removed"]] = None


@router.patch("/{detection_id}")
def patch_detection(detection_id: str, body: PatchBody):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")

    # Side-effect counters
    if body.operatorConfirmed is False:
        storage_service.increment_false_positive()
    if body.removalStatus == "simulated":
        storage_service.increment_virtually_removed()

    updated = storage_service.update_detection(detection_id, patch)
    if not updated:
        raise HTTPException(status_code=404, detail="Detection not found")
    return updated


# ─── GET /detections/export/csv ──────────────────────────────────────────────
# "Export Results" / "Export Filtered" buttons

@router.get("/export/csv")
def export_csv(
    status: Optional[Literal["pending", "confirmed", "rejected"]] = Query(None),
):
    records = storage_service.load_detections()

    if status == "pending":
        records = [r for r in records if r.get("operatorConfirmed") is None]
    elif status == "confirmed":
        records = [r for r in records if r.get("operatorConfirmed") is True]
    elif status == "rejected":
        records = [r for r in records if r.get("operatorConfirmed") is False]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "source", "defect_classes",
        "confidence_max", "operatorConfirmed", "removalStatus",
    ])
    for r in reversed(records):
        dets = r.get("detections", [])
        classes = "|".join(d.get("class", "") for d in dets)
        conf_max = max((d.get("confidence", 0) for d in dets), default=0)
        writer.writerow([
            r.get("id"), r.get("timestamp"), r.get("source"),
            classes, f"{conf_max:.4f}",
            r.get("operatorConfirmed"), r.get("removalStatus"),
        ])

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=detections.csv"},
    )
