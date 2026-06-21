"""
Endpoints backing the Defect Review and Historical Archive pages:
listing/filtering detections, approve/reject, mark for removal, export,
and clearing old records.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import csv
import io

from ..schemas import DetectionUpdate
from ..storage import detections_repo

router = APIRouter(prefix="/api/detections", tags=["detections"])


@router.get("")
def list_detections(
    search: Optional[str] = None,
    status: Optional[str] = Query(None, description="all|pending|confirmed|rejected"),
    defect_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = 200,
    offset: int = 0,
    defects_only: bool = Query(
        True,
        description="If true (default), excludes non-defect/passing classifications "
        "(e.g. a 'good banana' class) — set false to include everything, e.g. for "
        "Historical Archive's full audit trail.",
    ),
):
    items = detections_repo.filter_detections(
        search=search,
        status=status,
        defect_type=defect_type,
        date_from=date_from,
        date_to=date_to,
        defects_only=defects_only,
    )
    total = len(items)
    page = items[offset: offset + limit]
    return {"items": page, "total": total, "limit": limit, "offset": offset}


@router.get("/stats")
def detection_stats():
    return detections_repo.stats_summary()


@router.get("/distribution")
def detection_distribution():
    return detections_repo.defect_type_distribution()


@router.get("/{detection_id}")
def get_detection(detection_id: str):
    d = detections_repo.get_detection(detection_id)
    if not d:
        raise HTTPException(404, "Detection not found")
    return d


@router.patch("/{detection_id}")
def update_detection(detection_id: str, update: DetectionUpdate):
    updated = detections_repo.update_detection(detection_id, update)
    if not updated:
        raise HTTPException(404, "Detection not found")
    return updated


@router.post("/{detection_id}/approve")
def approve_detection(detection_id: str):
    updated = detections_repo.update_detection(
        detection_id, DetectionUpdate(operatorConfirmed=True)
    )
    if not updated:
        raise HTTPException(404, "Detection not found")
    return updated


@router.post("/{detection_id}/reject")
def reject_detection(detection_id: str):
    updated = detections_repo.update_detection(
        detection_id, DetectionUpdate(operatorConfirmed=False)
    )
    if not updated:
        raise HTTPException(404, "Detection not found")
    return updated


@router.post("/{detection_id}/mark-removal")
def mark_for_removal(detection_id: str):
    updated = detections_repo.update_detection(
        detection_id, DetectionUpdate(removalStatus="simulated")
    )
    if not updated:
        raise HTTPException(404, "Detection not found")
    return updated


@router.delete("/{detection_id}")
def delete_detection(detection_id: str):
    ok = detections_repo.delete_detection(detection_id)
    if not ok:
        raise HTTPException(404, "Detection not found")
    return {"deleted": True}


@router.delete("")
def clear_old_records(older_than_days: int = Query(30, ge=1)):
    removed = detections_repo.delete_older_than(older_than_days)
    return {"removed": removed}


@router.get("/export/csv")
def export_csv(
    search: Optional[str] = None,
    status: Optional[str] = None,
    defect_type: Optional[str] = None,
    defects_only: bool = False,
):
    items = detections_repo.filter_detections(
        search=search, status=status, defect_type=defect_type, defects_only=defects_only
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "defectType", "isDefect", "confidence",
        "operatorConfirmed", "removalStatus", "source",
    ])
    for d in items:
        writer.writerow([
            d["id"], d["timestamp"], d["defectType"], d.get("isDefect", True), d["confidence"],
            d.get("operatorConfirmed"), d.get("removalStatus"), d.get("source"),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=detections_export.csv"},
    )
