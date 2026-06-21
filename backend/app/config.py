"""
Central configuration for the Defect Detection backend.
All filesystem paths used by the app are defined here so the rest
of the codebase never hardcodes a path.
"""
from pathlib import Path

# Project root = backend/
BASE_DIR = Path(__file__).resolve().parent.parent

# ---- Storage (uploaded media + JSON "database") -------------------------
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
IMAGES_DIR = UPLOADS_DIR / "images"
VIDEOS_DIR = UPLOADS_DIR / "videos"
CAPTURES_DIR = UPLOADS_DIR / "captures"  # frames captured from camera/monitoring
THUMBNAILS_DIR = UPLOADS_DIR / "thumbnails"  # per-detection cropped+boxed images
DATA_DIR = STORAGE_DIR / "data"          # JSON "database" files
MODELS_DIR = STORAGE_DIR / "models"      # trained/uploaded YOLO weights

DETECTIONS_FILE = DATA_DIR / "detections.json"
DAILY_STATS_FILE = DATA_DIR / "daily_stats.json"
SETTINGS_FILE = DATA_DIR / "settings.json"

# ---- Dataset (for training) ---------------------------------------------
DATASET_DIR = BASE_DIR / "dataset"
DATASET_IMAGES_TRAIN = DATASET_DIR / "images" / "train"
DATASET_IMAGES_VAL = DATASET_DIR / "images" / "val"
DATASET_LABELS_TRAIN = DATASET_DIR / "labels" / "train"
DATASET_LABELS_VAL = DATASET_DIR / "labels" / "val"
DATASET_YAML = DATASET_DIR / "data.yaml"

# ---- Defaults --------------------------------------------------------
DEFAULT_CLASS_NAMES = [
    "Crack",
    "Discoloration",
    "Dent",
    "Surface Defect",
    "Shape Defect",
]

DEFAULT_MODEL_WEIGHTS = MODELS_DIR / "best.pt"  # trained weights, if present
FALLBACK_MODEL_NAME = "yolov8n.pt"  # used if no custom weights are trained yet

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
ALLOWED_VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

MAX_UPLOAD_MB = 200


def ensure_dirs() -> None:
    for d in [
        STORAGE_DIR, UPLOADS_DIR, IMAGES_DIR, VIDEOS_DIR, CAPTURES_DIR, THUMBNAILS_DIR,
        DATA_DIR, MODELS_DIR,
        DATASET_DIR, DATASET_IMAGES_TRAIN, DATASET_IMAGES_VAL,
        DATASET_LABELS_TRAIN, DATASET_LABELS_VAL,
    ]:
        d.mkdir(parents=True, exist_ok=True)
