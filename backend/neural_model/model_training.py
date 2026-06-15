from ultralytics import YOLO
import os
import random
import numpy as np
import torch


# -----------------------------
# 1. CONFIG
# -----------------------------
CONFIG = {
    "data": "neural_model/dataset/data.yaml",
    "model_name": "yolov8s.pt",
    "epochs": 100,
    "imgsz": 640,
    "batch": 16,
    "device": 0,
    "workers": 4,
    "project": "runs/train",
    "run_name": "fruit_defect_yolov8s",

    # reproducibility
    "seed": 42,
}


# -----------------------------
# 2. REPRODUCIBILITY (important for research/thesis)
# -----------------------------
def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


# -----------------------------
# 3. TRAINING MODULE
# -----------------------------
def train_model(cfg: dict):
    set_seed(cfg["seed"])

    print("Loading model...")
    model = YOLO(cfg["model_name"])

    print("Starting training...")

    results = model.train(
        data=cfg["data"],
        epochs=cfg["epochs"],
        imgsz=cfg["imgsz"],
        batch=cfg["batch"],
        device=cfg["device"],
        workers=cfg["workers"],
        project=cfg["project"],
        name=cfg["run_name"],

        # early stopping
        patience=20,  
        save=True,
        exist_ok=True,
        verbose=True
    )

    print("Training completed!")

    return model, results


# -----------------------------
# 4. VALIDATION MODULE (for pipeline later)
# -----------------------------
def evaluate_model(model):
    metrics = model.val()
    print("Validation metrics:")
    print(metrics)
    return metrics


# -----------------------------
# 5. EXPORT MODULE (for deployment)
# -----------------------------
def export_model(model, format="onnx"):
    print(f"Exporting model to {format}...")
    model.export(format=format)
    print("Export completed!")


# -----------------------------
# 6. MAIN ENTRY POINT
# -----------------------------
if __name__ == "__main__":
    model, results = train_model(CONFIG)

    evaluate_model(model)
