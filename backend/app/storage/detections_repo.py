"""
Repository for Detection records. Wraps json_store with detection-specific
read/write/query helpers used by the routers.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from .. import config
from ..schemas import Detection, DetectionUpdate
from .json_store import read_json, update_json, write_json


def _serialize(d: Detection) -> dict:
    payload = d.model_dump(mode="json")
    return payload


def list_detections() -> list[dict]:
    data = read_json(config.DETECTIONS_FILE, default=[])
    # newest first, matching frontend's generateMockDetections sort
    return sorted(data, key=lambda x: x.get("timestamp", ""), reverse=True)


def get_detection(detection_id: str) -> Optional[dict]:
    for d in list_detections():
        if d["id"] == detection_id:
            return d
    return None


def add_detection(detection: Detection) -> dict:
    payload = _serialize(detection)

    def mutate(data: list):
        data.append(payload)
        return payload

    return update_json(config.DETECTIONS_FILE, default=[], mutate=mutate)


def add_detections_bulk(detections: list[Detection]) -> list[dict]:
    payloads = [_serialize(d) for d in detections]

    def mutate(data: list):
        data.extend(payloads)
        return payloads

    return update_json(config.DETECTIONS_FILE, default=[], mutate=mutate)


def update_detection(detection_id: str, update: DetectionUpdate) -> Optional[dict]:
    def mutate(data: list):
        for item in data:
            if item["id"] == detection_id:
                if update.operatorConfirmed is not None:
                    item["operatorConfirmed"] = update.operatorConfirmed
                if update.removalStatus is not None:
                    item["removalStatus"] = update.removalStatus.value if hasattr(
                        update.removalStatus, "value") else update.removalStatus
                return item
        return None

    return update_json(config.DETECTIONS_FILE, default=[], mutate=mutate)


def delete_detection(detection_id: str) -> bool:
    def mutate(data: list):
        before = len(data)
        data[:] = [d for d in data if d["id"] != detection_id]
        return len(data) != before

    return update_json(config.DETECTIONS_FILE, default=[], mutate=mutate)


def delete_older_than(days: int) -> int:
    cutoff = datetime.utcnow() - timedelta(days=days)

    def mutate(data: list):
        before = len(data)
        data[:] = [
            d for d in data
            if datetime.fromisoformat(d["timestamp"].replace("Z", "")) >= cutoff
        ]
        return before - len(data)

    return update_json(config.DETECTIONS_FILE, default=[], mutate=mutate)


def filter_detections(
    search: Optional[str] = None,
    status: Optional[str] = None,  # all|pending|confirmed|rejected
    defect_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> list[dict]:
    items = list_detections()

    def matches(d: dict) -> bool:
        if search:
            s = search.lower()
            if s not in d["id"].lower() and s not in d["defectType"].lower():
                return False
        if status and status != "all":
            oc = d.get("operatorConfirmed")
            if status == "pending" and oc is not None:
                return False
            if status == "confirmed" and oc is not True:
                return False
            if status == "rejected" and oc is not False:
                return False
        if defect_type and defect_type != "all":
            if d["defectType"] != defect_type:
                return False
        if date_from or date_to:
            ts = datetime.fromisoformat(d["timestamp"].replace("Z", ""))
            if date_from and ts < date_from:
                return False
            if date_to and ts > date_to:
                return False
        return True

    return [d for d in items if matches(d)]


def stats_summary() -> dict:
    items = list_detections()
    total = len(items)
    pending = sum(1 for d in items if d.get("operatorConfirmed") is None)
    confirmed = sum(1 for d in items if d.get("operatorConfirmed") is True)
    rejected = sum(1 for d in items if d.get("operatorConfirmed") is False)
    simulated = sum(1 for d in items if d.get("removalStatus") == "simulated")
    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "rejected": rejected,
        "virtuallyRemoved": simulated,
    }


def defect_type_distribution() -> list[dict]:
    items = list_detections()
    # Fixed order + colors matching the original design — always show all
    # known defect types (even at 0) so the legend/pie don't reshuffle or
    # drop categories as detection counts change.
    ordered_types = [
        ("Crack", "#ef4444"),
        ("Discoloration", "#f59e0b"),
        ("Dent", "#3b82f6"),
        ("Surface Defect", "#8b5cf6"),
        ("Shape Defect", "#ec4899"),
    ]
    counts: dict[str, int] = {}
    for d in items:
        counts[d["defectType"]] = counts.get(d["defectType"], 0) + 1

    result = [
        {"name": name, "value": counts.get(name, 0), "color": color}
        for name, color in ordered_types
    ]
    # Any defect type encountered that isn't in the known list (e.g. a
    # custom-trained model with different class names) gets appended with
    # a fallback color rather than silently dropped.
    known_names = {name for name, _ in ordered_types}
    extra_names = sorted(n for n in counts if n not in known_names)
    for name in extra_names:
        result.append({"name": name, "value": counts[name], "color": "#6b7280"})

    return result
