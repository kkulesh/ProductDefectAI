"""
Pydantic models. Field names intentionally mirror the TypeScript
interfaces in the frontend (mockData.ts) so the JSON serializes into
shapes the React pages can consume with little/no adaptation.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


def new_id(prefix: str = "DET") -> str:
    return f"{prefix}-{uuid4().hex[:8].upper()}"


class RemovalStatus(str, Enum):
    pending = "pending"
    simulated = "simulated"
    failed = "failed"


class Position(BaseModel):
    x: float
    y: float


class Detection(BaseModel):
    id: str = Field(default_factory=new_id)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    defectType: str
    confidence: float
    imageUrl: str
    sourceImageUrl: Optional[str] = None
    operatorConfirmed: Optional[bool] = None
    removalStatus: RemovalStatus = RemovalStatus.pending
    position: Position = Field(default_factory=lambda: Position(x=0, y=0))
    source: Literal["upload", "camera", "video", "simulation"] = "upload"
    width: Optional[float] = None
    height: Optional[float] = None
    frameIndex: Optional[int] = None
    # Whether `defectType` represents an actual defect vs a non-defect /
    # passing classification (e.g. a "good banana" class in a model that
    # also has "bad banana"). Determined at creation time via
    # class_policy_repo so it doesn't need to be re-derived from the class
    # name everywhere downstream. True for every class unless the user has
    # explicitly marked it as non-defect in Settings (or the name matches
    # a "good/pass/ok/..." heuristic on first sight).
    isDefect: bool = True


class DetectionUpdate(BaseModel):
    operatorConfirmed: Optional[bool] = None
    removalStatus: Optional[RemovalStatus] = None


class DailyStats(BaseModel):
    id: str
    date: str  # YYYY-MM-DD
    totalInspected: int
    defectsDetected: int
    falsePositives: int


class DetectionSettings(BaseModel):
    confidenceThreshold: int = 75
    overlapThreshold: int = 50
    overlayOpacity: int = 70
    modelSelection: str = "yolov8-large"
    inputSource: str = "camera-1"
    resolution: str = "1080p"
    processingInterval: str = "realtime"


class NotificationSettings(BaseModel):
    alertsEnabled: bool = True
    confidenceWarnings: bool = True
    soundEnabled: bool = False
    alertFrequency: str = "immediate"
    emailNotifications: str = "critical"


class SystemSettings(BaseModel):
    databaseRetention: str = "30days"
    autoExportReports: str = "weekly"
    backupFrequency: str = "daily"


class AppSettings(BaseModel):
    detection: DetectionSettings = Field(default_factory=DetectionSettings)
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)
    system: SystemSettings = Field(default_factory=SystemSettings)


class LiveStats(BaseModel):
    totalInspected: int
    defectsDetected: int
    virtuallyRemoved: int
    accuracy: float
    falsePositives: int
    uptime: float


class BoundingBox(BaseModel):
    label: str
    confidence: float
    x: float       # normalized 0-1, top-left
    y: float
    width: float    # normalized 0-1
    height: float


class DetectInferenceResult(BaseModel):
    detections: list[BoundingBox]
    inferenceMs: float
    modelName: str


class VideoFrameResult(BaseModel):
    """One sampled+processed frame from a video, with its own image and
    boxes — kept separate per frame so the frontend can render a
    frame-by-frame player with correctly-positioned overlays, rather than
    a flat list of detections that loses which frame each box belongs to."""
    frameIndex: int          # ordinal position among sampled frames (0, 1, 2...)
    sourceFrameNumber: int    # actual frame number in the original video
    timestampSeconds: float   # position in the video, in seconds
    imageUrl: str             # captured still for this frame (always saved, even with 0 boxes)
    boxes: list[BoundingBox]


class VideoProcessResult(BaseModel):
    filename: str
    framesProcessed: int
    fps: float
    frames: list[VideoFrameResult]
    detectionCount: int
    usingCustomModel: bool
    warning: Optional[str] = None
