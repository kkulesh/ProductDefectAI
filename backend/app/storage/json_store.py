"""
Lightweight JSON-file persistence layer. No database engine is used —
each "table" is a single JSON file on disk, guarded by an in-process
lock so concurrent requests don't corrupt it.

This is intentionally simple: read whole file -> mutate in Python ->
write whole file. Fine for the data volumes a demo/quality-control
station produces; not meant for high-concurrency production scale.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock_for(path: Path) -> threading.Lock:
    key = str(path)
    with _locks_guard:
        if key not in _locks:
            _locks[key] = threading.Lock()
        return _locks[key]


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with _lock_for(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock_for(path):
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        tmp_path.replace(path)


def update_json(path: Path, default: Any, mutate: Callable[[Any], T]) -> T:
    """Read -> mutate (in place, returning a result) -> write, under lock."""
    lock = _lock_for(path)
    with lock:
        data = default
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                data = default
        result = mutate(data)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        tmp_path.replace(path)
        return result
