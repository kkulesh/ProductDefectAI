"""Endpoints backing the Settings page."""
from __future__ import annotations

from fastapi import APIRouter

from ..schemas import AppSettings, DetectionSettings, NotificationSettings, SystemSettings
from ..storage import settings_repo

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=AppSettings)
def get_settings():
    return settings_repo.get_settings()


@router.put("", response_model=AppSettings)
def replace_settings(settings: AppSettings):
    return settings_repo.save_settings(settings)


@router.patch("/detection", response_model=AppSettings)
def update_detection_settings(detection: DetectionSettings):
    current = settings_repo.get_settings()
    current.detection = detection
    return settings_repo.save_settings(current)


@router.patch("/notifications", response_model=AppSettings)
def update_notification_settings(notifications: NotificationSettings):
    current = settings_repo.get_settings()
    current.notifications = notifications
    return settings_repo.save_settings(current)


@router.patch("/system", response_model=AppSettings)
def update_system_settings(system: SystemSettings):
    current = settings_repo.get_settings()
    current.system = system
    return settings_repo.save_settings(current)
