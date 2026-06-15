from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services import analytics_service

router = APIRouter()


# ─── GET /stats/summary ──────────────────────────────────────────────────────
# Dashboard.tsx KPI cards: totalInspected, defectsDetected, virtuallyRemoved …

@router.get("/stats/summary")
def stats_summary():
    return analytics_service.get_summary()


# ─── GET /stats/daily ────────────────────────────────────────────────────────
# ReportsAnalytics.tsx LineChart and BarChart

@router.get("/stats/daily")
def stats_daily(days: int = Query(30, ge=1, le=365)):
    return analytics_service.get_daily_stats(days)


# ─── GET /stats/defect-types ─────────────────────────────────────────────────
# ReportsAnalytics.tsx PieChart (defectTypeDistribution)

@router.get("/stats/defect-types")
def stats_defect_types():
    return analytics_service.get_defect_type_distribution()


# ─── GET /stats/confidence-trends ───────────────────────────────────────────
# ReportsAnalytics.tsx confidence LineChart

@router.get("/stats/confidence-trends")
def stats_confidence_trends(days: int = Query(8, ge=1, le=90)):
    return analytics_service.get_confidence_trends(days)


# ─── POST /settings/save ─────────────────────────────────────────────────────
# Settings.tsx "Save Detection Settings" / "Save Notification Settings" buttons

class DetectionSettings(BaseModel):
    confidenceThreshold: float = 0.75
    modelSelection: str = "yolov8-large"
    inputSource: str = "camera-1"
    imageResolution: str = "1080p"
    processingInterval: str = "realtime"


class NotificationSettings(BaseModel):
    alertsEnabled: bool = True
    soundEnabled: bool = False
    confidenceWarnings: bool = True
    alertFrequency: str = "immediate"
    emailNotifications: str = "critical"


class SystemSettings(BaseModel):
    databaseRetention: str = "30days"
    autoExportReports: str = "weekly"
    backupFrequency: str = "daily"


class SettingsPayload(BaseModel):
    detection: Optional[DetectionSettings] = None
    notification: Optional[NotificationSettings] = None
    system: Optional[SystemSettings] = None


import json
from pathlib import Path

SETTINGS_FILE = Path("app/results/settings.json")


@router.post("/settings/save")
def save_settings(payload: SettingsPayload):
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)

    current: dict = {}
    if SETTINGS_FILE.exists():
        try:
            current = json.loads(SETTINGS_FILE.read_text())
        except json.JSONDecodeError:
            current = {}

    if payload.detection:
        current["detection"] = payload.detection.model_dump()
    if payload.notification:
        current["notification"] = payload.notification.model_dump()
    if payload.system:
        current["system"] = payload.system.model_dump()

    SETTINGS_FILE.write_text(json.dumps(current, indent=2))
    return {"saved": True, "settings": current}


@router.get("/settings")
def get_settings():
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except json.JSONDecodeError:
            pass
    return {}
