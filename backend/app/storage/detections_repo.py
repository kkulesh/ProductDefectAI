"""
Repository for Detection records. Wraps json_store with detection-specific
read/write/query helpers used by the routers.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from .. import config
from ..schemas import Detection, DetectionUpdate
from . import class_policy_repo
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
    defects_only: bool = True,
) -> list[dict]:
    items = list_detections()

    def matches(d: dict) -> bool:
        if defects_only and not d.get("isDefect", True):
            return False
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
    defect_items = [d for d in items if d.get("isDefect", True)]
    non_defect_items = [d for d in items if not d.get("isDefect", True)]

    total = len(defect_items)
    pending = sum(1 for d in defect_items if d.get("operatorConfirmed") is None)
    confirmed = sum(1 for d in defect_items if d.get("operatorConfirmed") is True)
    rejected = sum(1 for d in defect_items if d.get("operatorConfirmed") is False)
    simulated = sum(1 for d in defect_items if d.get("removalStatus") == "simulated")
    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "rejected": rejected,
        "virtuallyRemoved": simulated,
        "nonDefectCount": len(non_defect_items),
    }


_PALETTE = [
    "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899",
    "#10b981", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
]

# Fixed colors for the 6 fruit quality classes currently in use, so each
# class always renders the same color regardless of detection order.
# Uses the original app palette (red/amber/blue/purple/pink) plus green
# as the 6th color, assigned in alphabetical class-name order — which
# conveniently groups all "bad ___" classes before all "good ___" classes.
_FIXED_CLASS_COLORS = {
    "bad apple": "#ef4444",     # red
    "bad banana": "#f59e0b",    # amber
    "bad orange": "#3b82f6",    # blue
    "good apple": "#8b5cf6",    # purple
    "good banana": "#ec4899",   # pink
    "good orange": "#22c55e",   # green
}


def defect_type_distribution() -> list[dict]:
    """
    Returns one entry per class name that has actually appeared in real
    detections — not a hardcoded list of assumed defect types. Whatever
    classes your trained model actually uses (good/bad apple/banana/
    orange, or anything else) are exactly what show up here, in
    descending count order, with an isDefect flag (from class_policy_repo)
    so the frontend can visually distinguish non-defect/passing classes
    from real defects in this chart rather than implying everything shown
    is a defect.

    Colors: the 6 known fruit-quality classes always get their fixed
    colors (see _FIXED_CLASS_COLORS), regardless of detection order — so
    a class never changes color between sessions. Any other class name
    gets a stable color from the rotating palette, assigned by
    first-appearance order among just the non-fixed classes.
    """
    items = list_detections()
    counts: dict[str, int] = {}
    for d in items:
        counts[d["defectType"]] = counts.get(d["defectType"], 0) + 1

    # Stable fallback-color assignment for classes NOT in the fixed map:
    # order of first appearance in the data (oldest first), not
    # alphabetical, so colors don't reshuffle as new classes appear.
    seen_order: list[str] = []
    for d in reversed(items):  # items is newest-first; walk oldest-first
        name = d["defectType"]
        if name not in _FIXED_CLASS_COLORS and name not in seen_order:
            seen_order.append(name)

    fallback_color_map = {name: _PALETTE[i % len(_PALETTE)] for i, name in enumerate(seen_order)}
    policy = class_policy_repo.get_policy()

    def resolve_color(name: str) -> str:
        return _FIXED_CLASS_COLORS.get(name) or fallback_color_map[name]

    result = [
        {
            "name": name,
            "value": count,
            "color": resolve_color(name),
            "isDefect": policy.get(name, True),
        }
        for name, count in sorted(counts.items(), key=lambda kv: -kv[1])
    ]
    return result
