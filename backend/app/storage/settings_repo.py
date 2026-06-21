"""Repository for application settings (Settings page)."""
from __future__ import annotations

from .. import config
from ..schemas import AppSettings
from .json_store import read_json, write_json


def get_settings() -> AppSettings:
    data = read_json(config.SETTINGS_FILE, default=None)
    if data is None:
        settings = AppSettings()
        write_json(config.SETTINGS_FILE, settings.model_dump(mode="json"))
        return settings
    return AppSettings(**data)


def save_settings(settings: AppSettings) -> AppSettings:
    write_json(config.SETTINGS_FILE, settings.model_dump(mode="json"))
    return settings
