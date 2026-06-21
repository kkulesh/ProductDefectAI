"""
Endpoints for managing trained model weights (used by Settings page's
"Model Selection" and "Check for Updates").
"""
from __future__ import annotations

import shutil

from fastapi import APIRouter, File, HTTPException, UploadFile

from .. import config
from ..services import inference

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_models():
    models = []
    if config.MODELS_DIR.exists():
        for f in config.MODELS_DIR.glob("*.pt"):
            models.append({
                "name": f.name,
                "sizeMb": round(f.stat().st_size / (1024 * 1024), 2),
                "active": f.name == config.DEFAULT_MODEL_WEIGHTS.name and f.exists(),
            })
    return {
        "models": models,
        "currentModel": inference.model_name(),
        "usingCustomModel": inference.is_using_custom_model(),
    }


@router.post("/upload")
async def upload_model(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".pt"):
        raise HTTPException(400, "Model file must be a .pt (PyTorch) weights file")
    dest = config.MODELS_DIR / file.filename
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return {"saved": str(dest.name)}


@router.post("/activate/{model_name}")
def activate_model(model_name: str):
    src = config.MODELS_DIR / model_name
    if not src.exists():
        raise HTTPException(404, "Model not found")
    shutil.copy(src, config.DEFAULT_MODEL_WEIGHTS)
    return {"activated": model_name}
