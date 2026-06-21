"""
Repository for daily aggregate stats (used by Reports & Analytics page).
Each row is upserted in real time as actual detections/inspections happen
(see record_inspection / record_defect_found below) — there is no
synthetic/seeded history. A fresh install starts with zero rows and an
empty chart until real detection activity occurs.
"""
from __future__ import annotations

from datetime import datetime

from .. import config
from .json_store import read_json, update_json


def list_daily_stats() -> list[dict]:
    return read_json(config.DAILY_STATS_FILE, default=[])


def record_inspection(count: int = 1) -> dict:
    """
    Call once per item actually classified by the model (every individual
    detected box — good or bad), so 'totalInspected' means "how many
    fruit/items were inspected", not "how many images were uploaded". One
    image can contain many fruit; each one counts here.
    """
    today_str = datetime.utcnow().date().isoformat()

    def mutate(data: list):
        row = next((r for r in data if r["date"] == today_str), None)
        if row is None:
            row = {
                "id": f"day-{today_str}",
                "date": today_str,
                "totalInspected": 0,
                "defectsDetected": 0,
                "falsePositives": 0,
            }
            data.append(row)
        row["totalInspected"] += count
        return row

    return update_json(config.DAILY_STATS_FILE, default=[], mutate=mutate)


def record_defect_found(is_false_positive: bool = False) -> dict:
    """Call once per individual defect box the model finds (not once per
    image — a single image can contain zero, one, or many defects)."""
    today_str = datetime.utcnow().date().isoformat()

    def mutate(data: list):
        row = next((r for r in data if r["date"] == today_str), None)
        if row is None:
            row = {
                "id": f"day-{today_str}",
                "date": today_str,
                "totalInspected": 0,
                "defectsDetected": 0,
                "falsePositives": 0,
            }
            data.append(row)
        row["defectsDetected"] += 1
        if is_false_positive:
            row["falsePositives"] += 1
        return row

    return update_json(config.DAILY_STATS_FILE, default=[], mutate=mutate)
