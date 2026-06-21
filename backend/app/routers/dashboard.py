"""Endpoints backing the Dashboard page (live stats + recent detections)."""
from __future__ import annotations

from ..storage import daily_stats_repo, detections_repo

from fastapi import APIRouter

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def live_stats():
    summary = detections_repo.stats_summary()
    daily = daily_stats_repo.list_daily_stats()
    total_inspected = sum(d["totalInspected"] for d in daily) or 0

    total_defects = summary["total"] or 1  # avoid div by zero
    accuracy = 100.0 - (summary["rejected"] / total_defects * 100.0) if summary["total"] else 100.0

    return {
        "totalInspected": total_inspected,
        "defectsDetected": summary["total"],
        "virtuallyRemoved": summary["virtuallyRemoved"],
        "accuracy": round(accuracy, 2),
        "falsePositives": summary["rejected"],
        "uptime": 99.7,
    }


@router.get("/recent")
def recent_detections(limit: int = 5):
    items = detections_repo.list_detections()[:limit]
    return items
