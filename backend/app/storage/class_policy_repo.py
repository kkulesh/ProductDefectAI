"""
Tracks, per detected class name, whether that class represents an actual
defect or a non-defect/"passing" classification (e.g. a model trained
with "good banana" / "bad banana" classes — "good banana" detections are
not defects and shouldn't count toward defect-rate stats, the review
queue, or the virtual rejection simulation).

This matters because not every YOLO model used with this app is a
pure "spot the flaw" detector — some are trained with both passing and
failing classes. Without this, every detected box of any class was being
treated as a defect, which silently broke defect-rate math, populated
the review queue with non-defects, and miscounted distributions whenever
a model had "good"/passing classes.

Stored as a simple JSON map: { class_name: bool (True = is a defect) }.
New class names are auto-classified on first sight using a keyword
heuristic (config.NON_DEFECT_NAME_HINTS), then persisted — so the
classification is stable afterward and editable via the Settings page
without needing to touch this file by hand.
"""
from __future__ import annotations

from .. import config
from .json_store import read_json, update_json


def _auto_classify(class_name: str) -> bool:
    """Best-effort guess for a never-before-seen class name. Returns
    True if it should be treated as a defect."""
    lowered = class_name.lower().strip()
    for hint in config.NON_DEFECT_NAME_HINTS:
        if hint in lowered:
            return False
    return True


def get_policy() -> dict[str, bool]:
    return read_json(config.CLASS_POLICY_FILE, default={})


def is_defect_class(class_name: str) -> bool:
    """Looks up (and persists, if new) whether a class name counts as a
    real defect. Call this once per detected box — it auto-registers
    unseen class names so they show up in Settings for the user to
    correct if the heuristic guessed wrong."""

    def mutate(policy: dict):
        if class_name not in policy:
            policy[class_name] = _auto_classify(class_name)
        return policy[class_name]

    return update_json(config.CLASS_POLICY_FILE, default={}, mutate=mutate)


def register_class_names(class_names: list[str]) -> dict[str, bool]:
    """Ensure every name in class_names has a policy entry (auto-classified
    if new), without needing per-box calls. Useful for bulk operations.
    Returns the full updated policy map."""

    def mutate(policy: dict):
        for name in class_names:
            if name not in policy:
                policy[name] = _auto_classify(name)
        return policy

    return update_json(config.CLASS_POLICY_FILE, default={}, mutate=mutate)


def set_class_policy(class_name: str, is_defect: bool) -> dict[str, bool]:
    def mutate(policy: dict):
        policy[class_name] = is_defect
        return policy

    return update_json(config.CLASS_POLICY_FILE, default={}, mutate=mutate)


def set_policies(updates: dict[str, bool]) -> dict[str, bool]:
    def mutate(policy: dict):
        policy.update(updates)
        return policy

    return update_json(config.CLASS_POLICY_FILE, default={}, mutate=mutate)
