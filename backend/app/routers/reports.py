"""Endpoints backing the Reports & Analytics page."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..storage import daily_stats_repo, detections_repo

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/daily-stats")
def daily_stats(days: int = Query(30, ge=1, le=365)):
    data = daily_stats_repo.list_daily_stats()
    return data[-days:]


@router.get("/defect-distribution")
def defect_distribution():
    # Returns only class names that actually appear in real detection
    # data — whatever your trained model's classes are — not a hardcoded
    # assumed list of defect types.
    return detections_repo.defect_type_distribution()


@router.get("/confidence-trends")
def confidence_trends(days: int = Query(8, ge=1, le=90)):
    items = detections_repo.list_detections()
    by_day: dict[str, list[float]] = {}
    for d in items:
        day = d["timestamp"][:10]
        by_day.setdefault(day, []).append(float(d["confidence"]))

    sorted_days = sorted(by_day.keys())[-days:]
    return [
        {
            "id": f"conf-{day}",
            "date": day,
            "avgConfidence": round(sum(by_day[day]) / len(by_day[day]) * 100, 1),
        }
        for day in sorted_days
    ]


@router.get("/summary")
def summary(days: int = Query(30, ge=1, le=365)):
    data = daily_stats_repo.list_daily_stats()[-days:]
    total_inspected = sum(d["totalInspected"] for d in data)
    total_defects = sum(d["defectsDetected"] for d in data)
    total_false_positives = sum(d["falsePositives"] for d in data)
    return {
        "totalInspected": total_inspected,
        "totalDefects": total_defects,
        "avgDefectRate": round((total_defects / total_inspected * 100), 2) if total_inspected else 0,
        "falsePositiveRate": round((total_false_positives / total_defects * 100), 2) if total_defects else 0,
    }
