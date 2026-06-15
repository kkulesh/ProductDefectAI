import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

RESULTS_DIR = Path("app/results")
DETECTIONS_FILE = RESULTS_DIR / "detections.json"
STATISTICS_FILE = RESULTS_DIR / "statistics.json"

_lock = threading.Lock()


# ─── helpers ────────────────────────────────────────────────────────────────

def _read_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))


# ─── detections ─────────────────────────────────────────────────────────────

def load_detections() -> list[dict]:
    return _read_json(DETECTIONS_FILE, [])


def save_detection(record: dict) -> dict:
    """Append one detection record; return the saved record."""
    with _lock:
        records = load_detections()
        records.append(record)
        _write_json(DETECTIONS_FILE, records)
        _update_statistics(record)
    return record


def get_detection_by_id(detection_id: str) -> Optional[dict]:
    for r in load_detections():
        if r.get("id") == detection_id:
            return r
    return None


def update_detection(detection_id: str, patch: dict) -> Optional[dict]:
    """Partially update a detection record by id. Returns updated record or None."""
    with _lock:
        records = load_detections()
        for i, r in enumerate(records):
            if r.get("id") == detection_id:
                records[i] = {**r, **patch, "updatedAt": _now()}
                _write_json(DETECTIONS_FILE, records)
                return records[i]
    return None


# ─── statistics ─────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_statistics() -> dict:
    default = {
        "totalInspected": 0,
        "defectsDetected": 0,
        "virtuallyRemoved": 0,
        "falsePositives": 0,
        "daily": {},
    }
    return _read_json(STATISTICS_FILE, default)


def _update_statistics(record: dict) -> None:
    """Called inside save_detection (already under lock)."""
    stats = load_statistics()
    today = _today_str()

    stats["totalInspected"] += 1
    n = len(record.get("detections", []))
    if n > 0:
        stats["defectsDetected"] += n

    day = stats["daily"].setdefault(today, {
        "date": today,
        "totalInspected": 0,
        "defectsDetected": 0,
        "falsePositives": 0,
    })
    day["totalInspected"] += 1
    day["defectsDetected"] += n

    _write_json(STATISTICS_FILE, stats)


def increment_virtually_removed() -> None:
    with _lock:
        stats = load_statistics()
        stats["virtuallyRemoved"] = stats.get("virtuallyRemoved", 0) + 1
        _write_json(STATISTICS_FILE, stats)


def increment_false_positive() -> None:
    with _lock:
        stats = load_statistics()
        stats["falsePositives"] = stats.get("falsePositives", 0) + 1
        today = _today_str()
        if today in stats.get("daily", {}):
            stats["daily"][today]["falsePositives"] = \
                stats["daily"][today].get("falsePositives", 0) + 1
        _write_json(STATISTICS_FILE, stats)
