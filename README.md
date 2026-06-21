# Defect Detection — Quality Control System

A full-stack YOLOv8-based defect detection app: React frontend + FastAPI
backend, no database (JSON file storage), with live browser-camera
detection, image/video upload, and a YOLOv8 training pipeline for your
own dataset.

```
.
├── backend/     FastAPI app, YOLO inference, training script, storage
└── frontend/    React + Vite + TypeScript UI (7 pages)
```

## Quick start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now live at `http://localhost:8000` (interactive docs at
`/docs`). On first run it auto-creates `storage/` folders and seeds 30
days of placeholder daily stats so the Reports page isn't empty.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend talks to the backend at the
URL in `frontend/.env` (`VITE_API_URL`, defaults to
`http://localhost:8000`) — edit that if you deploy the backend
elsewhere.

### 3. (Optional) Train your own YOLOv8 model

```bash
cd backend
# put your images/labels in dataset/images/{train,val} and dataset/labels/{train,val}
# see backend/dataset/README.md for the exact format
python scripts/train.py --epochs 100 --batch 16 --model yolov8n.pt
```

The script writes the best checkpoint to `backend/storage/models/best.pt`,
which the API picks up automatically (it's loaded lazily, so just
restart the API after training — or the very next inference call will
notice the new weights).

## How the pieces connect

| Frontend page          | Backend endpoints                                  |
|-------------------------|-----------------------------------------------------|
| Dashboard               | `GET /api/dashboard/stats`, `/api/dashboard/recent` |
| Detection Monitoring    | `WS /api/camera/stream`, `POST /api/upload/image`, `/api/upload/video*` |
| Defect Review           | `GET/PATCH/DELETE /api/detections*`                 |
| Virtual Rejection       | `POST /api/rejection/event` (simulation logging)    |
| Reports & Analytics     | `GET /api/reports/*`                                |
| Settings                | `GET/PATCH /api/settings*`, `GET /api/models`       |
| Historical Archive      | `GET /api/detections` (filtered), CSV export         |

## Camera detection — how it works

The backend does **not** open a camera device itself (it's a web app —
the camera is on the user's machine, not the server). Instead:

1. The browser captures webcam frames via `getUserMedia` (see
   `frontend/src/lib/useCameraDetection.ts`).
2. Frames are sent as base64 JPEG over a WebSocket to
   `ws://<backend>/api/camera/stream`.
3. The backend runs YOLO inference on each frame and returns bounding
   boxes as JSON.
4. The frontend draws the boxes as an overlay on the `<video>` element.

If you have an industrial camera physically wired to the **server**
instead (e.g. an RTSP/USB line-scan camera), use
`GET /api/camera/server-snapshot` instead, which grabs a frame via
OpenCV server-side.

## Storage (no database)

Everything persists as JSON files under `backend/storage/data/` and
media files under `backend/storage/uploads/`:

- `detections.json` — every Detection record (Defect Review / Archive)
- `daily_stats.json` — daily aggregate counts (Reports)
- `settings.json` — Settings page state
- `uploads/images/`, `uploads/videos/`, `uploads/captures/` — uploaded
  and camera-captured media, served back to the frontend at
  `/media/images/...`, `/media/videos/...`, `/media/captures/...`

There's no database server to install or migrate — just files on disk,
guarded by an in-process lock so concurrent requests don't corrupt them.
