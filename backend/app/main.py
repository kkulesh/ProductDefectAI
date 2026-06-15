from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.routes.detect_routes import router as detect_router
from app.api.routes.analytics_routes import router as analytics_router
from app.api.routes.upload_routes import router as upload_router

app = FastAPI(
    title="Defect Detection API",
    description="Backend for robotic defect removal system in agro-logistics",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detect_router,    prefix="/api/v1/detection",  tags=["Detection"])
app.include_router(analytics_router, prefix="/api/v1/analytics",  tags=["Analytics"])
app.include_router(upload_router,    prefix="/api/v1/detections", tags=["Detections"])

os.makedirs("app/uploads/images",    exist_ok=True)
os.makedirs("app/uploads/processed", exist_ok=True)
os.makedirs("app/results",           exist_ok=True)

app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

@app.get("/health")
def health():
    return {"status": "ok"}
