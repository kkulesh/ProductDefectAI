from datetime import datetime, timedelta, timezone
from collections import defaultdict

from app.services.storage_service import load_statistics, load_detections


def get_summary() -> dict:
    """
    Returns KPI summary for the Dashboard.
    Shape mirrors Dashboard.tsx `stats` state.
    """
    stats = load_statistics()
    total = stats.get("totalInspected", 0)
    defects = stats.get("defectsDetected", 0)
    removed = stats.get("virtuallyRemoved", 0)
    fp = stats.get("falsePositives", 0)

    accuracy = 0.0
    if defects > 0:
        accuracy = round((1 - fp / defects) * 100, 1)

    defect_rate = 0.0
    if total > 0:
        defect_rate = round(defects / total * 100, 2)

    return {
        "totalInspected": total,
        "defectsDetected": defects,
        "virtuallyRemoved": removed,
        "falsePositives": fp,
        "accuracy": accuracy,
        "defectRate": defect_rate,
    }


def get_daily_stats(days: int = 30) -> list[dict]:
    """
    Returns last `days` daily rows for ReportsAnalytics charts.
    Each row: { date, totalInspected, defectsDetected, falsePositives }
    Missing days are filled with zeros so the chart stays continuous.
    """
    stats = load_statistics()
    daily_raw: dict = stats.get("daily", {})

    today = datetime.now(timezone.utc).date()
    rows = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        entry = daily_raw.get(d, {})
        rows.append({
            "date": d,
            "totalInspected": entry.get("totalInspected", 0),
            "defectsDetected": entry.get("defectsDetected", 0),
            "falsePositives": entry.get("falsePositives", 0),
        })
    return rows


def get_defect_type_distribution() -> list[dict]:
    """
    Counts each defect class across all stored detections.
    Returns list of { name, value, color } matching PieChart data shape.
    """
    COLOR_MAP = {
        "Crack":         "#ef4444",
        "Dent":          "#f59e0b",
        "Discoloration": "#8b5cf6",
        "Surface Defect":"#3b82f6",
        "Shape Defect":  "#10b981",
    }
    DEFAULT_COLOR = "#6b7280"

    counts: dict[str, int] = defaultdict(int)
    for record in load_detections():
        for det in record.get("detections", []):
            counts[det.get("class", "Unknown")] += 1

    return [
        {
            "name": cls,
            "value": cnt,
            "color": COLOR_MAP.get(cls, DEFAULT_COLOR),
        }
        for cls, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]


def get_confidence_trends(days: int = 8) -> list[dict]:
    """
    Average detection confidence per day for the last `days` days.
    """
    today = datetime.now(timezone.utc).date()
    buckets: dict[str, list[float]] = defaultdict(list)

    for record in load_detections():
        ts = record.get("timestamp", "")
        try:
            d = datetime.fromisoformat(ts).date().isoformat()
        except (ValueError, TypeError):
            continue
        for det in record.get("detections", []):
            buckets[d].append(det.get("confidence", 0.0))

    rows = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        confs = buckets.get(d, [])
        avg = round(sum(confs) / len(confs) * 100, 1) if confs else 0
        rows.append({"date": d, "avgConfidence": avg})
    return rows
