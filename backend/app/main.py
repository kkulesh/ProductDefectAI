"""
Defect Detection backend — FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Wires together every page of the React frontend:
  Dashboard            -> /api/dashboard/*
  Detection Monitoring -> /api/camera/* (WebSocket stream) + /api/upload/*
  Defect Review        -> /api/detections/*
  Virtual Rejection    -> /api/detections/* (status=pending queue + mark-removal)
  Reports & Analytics  -> /api/reports/*
  Settings             -> /api/settings/*, /api/models/*
  Historical Archive   -> /api/detections/* (filtered)
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config
from .routers import camera, dashboard, detections, models, reports, settings, upload

config.ensure_dirs()

app = FastAPI(
    title="Defect Detection API",
    description="Backend for the YOLO-based defect detection quality control system",
    version="1.0.0",
)

# CORS: allow the Vite/React dev server (and any origin in dev). Tighten
# allow_origins for production deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded/captured media so frontend <img src="..."> tags can load
# them directly, e.g. http://localhost:8000/media/images/<file>.jpg
app.mount("/media/images", StaticFiles(directory=str(config.IMAGES_DIR)), name="images")
app.mount("/media/videos", StaticFiles(directory=str(config.VIDEOS_DIR)), name="videos")
app.mount("/media/captures", StaticFiles(directory=str(config.CAPTURES_DIR)), name="captures")
app.mount("/media/thumbnails", StaticFiles(directory=str(config.THUMBNAILS_DIR)), name="thumbnails")

app.include_router(dashboard.router)
app.include_router(camera.router)
app.include_router(detections.router)
app.include_router(upload.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(models.router)


@app.on_event("startup")
def on_startup():
    config.ensure_dirs()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "name": "Defect Detection API",
        "docs": "/docs",
        "health": "/api/health",
    }
