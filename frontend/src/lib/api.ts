// Central API client for the Defect Detection backend (FastAPI).
// Set VITE_API_URL in your .env to override (defaults to localhost:8000).

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // ignore - use statusText
    }
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  // Some endpoints (csv export) aren't JSON; callers handle those separately.
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------
// Types (mirroring backend/app/schemas.py)
// ---------------------------------------------------------------------

export interface Detection {
  id: string;
  timestamp: string;
  defectType: string;
  confidence: number;
  imageUrl: string;
  sourceImageUrl?: string | null;
  operatorConfirmed: boolean | null;
  removalStatus: "pending" | "simulated" | "failed";
  position: { x: number; y: number };
  source: "upload" | "camera" | "video" | "simulation";
  width?: number | null;
  height?: number | null;
  frameIndex?: number | null;
}

export interface DetectionListResponse {
  items: Detection[];
  total: number;
  limit: number;
  offset: number;
}

export interface DailyStats {
  id: string;
  date: string;
  totalInspected: number;
  defectsDetected: number;
  falsePositives: number;
}

export interface DefectDistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface ConfidenceTrendPoint {
  id: string;
  date: string;
  avgConfidence: number;
}

export interface LiveStats {
  totalInspected: number;
  defectsDetected: number;
  virtuallyRemoved: number;
  accuracy: number;
  falsePositives: number;
  uptime: number;
}

export interface DetectionSettings {
  confidenceThreshold: number;
  overlapThreshold: number;
  overlayOpacity: number;
  modelSelection: string;
  inputSource: string;
  resolution: string;
  processingInterval: string;
}

export interface NotificationSettings {
  alertsEnabled: boolean;
  confidenceWarnings: boolean;
  soundEnabled: boolean;
  alertFrequency: string;
  emailNotifications: string;
}

export interface SystemSettings {
  databaseRetention: string;
  autoExportReports: string;
  backupFrequency: string;
}

export interface AppSettings {
  detection: DetectionSettings;
  notifications: NotificationSettings;
  system: SystemSettings;
}

export interface BoundingBox {
  label: string;
  confidence: number;
  x: number; // normalized 0-1
  y: number;
  width: number; // normalized 0-1
  height: number;
}

export interface VideoFrameResult {
  frameIndex: number;
  sourceFrameNumber: number;
  timestampSeconds: number;
  imageUrl: string;
  boxes: BoundingBox[];
}

export interface VideoProcessResult {
  filename: string;
  framesProcessed: number;
  fps: number;
  frames: VideoFrameResult[];
  detectionCount: number;
  usingCustomModel: boolean;
  warning: string | null;
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

export const dashboardApi = {
  stats: () => fetch(`${API_BASE}/api/dashboard/stats`).then((r) => handleResponse<LiveStats>(r)),
  recent: (limit = 5) =>
    fetch(`${API_BASE}/api/dashboard/recent${qs({ limit })}`).then((r) => handleResponse<Detection[]>(r)),
};

// ---------------------------------------------------------------------
// Detections (Defect Review + Historical Archive)
// ---------------------------------------------------------------------

export const detectionsApi = {
  list: (params: {
    search?: string;
    status?: string;
    defect_type?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  } = {}) =>
    fetch(`${API_BASE}/api/detections${qs(params)}`).then((r) => handleResponse<DetectionListResponse>(r)),

  stats: () =>
    fetch(`${API_BASE}/api/detections/stats`).then((r) =>
      handleResponse<{ total: number; pending: number; confirmed: number; rejected: number; virtuallyRemoved: number }>(r)
    ),

  distribution: () =>
    fetch(`${API_BASE}/api/detections/distribution`).then((r) => handleResponse<DefectDistributionItem[]>(r)),

  approve: (id: string) =>
    fetch(`${API_BASE}/api/detections/${id}/approve`, { method: "POST" }).then((r) => handleResponse<Detection>(r)),

  reject: (id: string) =>
    fetch(`${API_BASE}/api/detections/${id}/reject`, { method: "POST" }).then((r) => handleResponse<Detection>(r)),

  markForRemoval: (id: string) =>
    fetch(`${API_BASE}/api/detections/${id}/mark-removal`, { method: "POST" }).then((r) =>
      handleResponse<Detection>(r)
    ),

  remove: (id: string) =>
    fetch(`${API_BASE}/api/detections/${id}`, { method: "DELETE" }).then((r) => handleResponse<{ deleted: boolean }>(r)),

  clearOlderThan: (days: number) =>
    fetch(`${API_BASE}/api/detections${qs({ older_than_days: days })}`, { method: "DELETE" }).then((r) =>
      handleResponse<{ removed: number }>(r)
    ),

  exportCsvUrl: (params: { search?: string; status?: string; defect_type?: string } = {}) =>
    `${API_BASE}/api/detections/export/csv${qs(params)}`,
};

// ---------------------------------------------------------------------
// Upload (images + video)
// ---------------------------------------------------------------------

export const uploadApi = {
  image: (file: File, confidenceThreshold = 0.5) => {
    const form = new FormData();
    form.append("file", file);
    form.append("confidence_threshold", String(confidenceThreshold));
    return fetch(`${API_BASE}/api/upload/image`, { method: "POST", body: form }).then((r) =>
      handleResponse<{
        imageUrl: string;
        inferenceMs: number;
        modelName: string;
        usingCustomModel: boolean;
        warning: string | null;
        detections: Detection[];
        detectionCount: number;
      }>(r)
    );
  },

  video: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_BASE}/api/upload/video`, { method: "POST", body: form }).then((r) =>
      handleResponse<{ videoUrl: string; filename: string; frameCount: number; fps: number; durationSeconds: number | null }>(r)
    );
  },

  processVideo: (
    filename: string,
    options: { confidenceThreshold?: number; sampleEveryNFrames?: number; maxFrames?: number } = {}
  ) => {
    const form = new FormData();
    form.append("filename", filename);
    form.append("confidence_threshold", String(options.confidenceThreshold ?? 0.5));
    form.append("sample_every_n_frames", String(options.sampleEveryNFrames ?? 15));
    form.append("max_frames", String(options.maxFrames ?? 60));
    return fetch(`${API_BASE}/api/upload/video/process`, { method: "POST", body: form }).then((r) =>
      handleResponse<VideoProcessResult>(r)
    );
  },
};

// ---------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------

export const cameraApi = {
  status: () =>
    fetch(`${API_BASE}/api/camera/status`).then((r) =>
      handleResponse<{ modelLoaded: boolean; modelName: string; usingCustomModel: boolean }>(r)
    ),
  streamUrl: () => `${WS_BASE}/api/camera/stream`,
};

// ---------------------------------------------------------------------
// Reports & Analytics
// ---------------------------------------------------------------------

export const reportsApi = {
  dailyStats: (days = 30) =>
    fetch(`${API_BASE}/api/reports/daily-stats${qs({ days })}`).then((r) => handleResponse<DailyStats[]>(r)),

  defectDistribution: () =>
    fetch(`${API_BASE}/api/reports/defect-distribution`).then((r) => handleResponse<DefectDistributionItem[]>(r)),

  confidenceTrends: (days = 8) =>
    fetch(`${API_BASE}/api/reports/confidence-trends${qs({ days })}`).then((r) =>
      handleResponse<ConfidenceTrendPoint[]>(r)
    ),

  summary: (days = 30) =>
    fetch(`${API_BASE}/api/reports/summary${qs({ days })}`).then((r) =>
      handleResponse<{ totalInspected: number; totalDefects: number; avgDefectRate: number; falsePositiveRate: number }>(r)
    ),
};

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

export const settingsApi = {
  get: () => fetch(`${API_BASE}/api/settings`).then((r) => handleResponse<AppSettings>(r)),

  updateDetection: (detection: DetectionSettings) =>
    fetch(`${API_BASE}/api/settings/detection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detection),
    }).then((r) => handleResponse<AppSettings>(r)),

  updateNotifications: (notifications: NotificationSettings) =>
    fetch(`${API_BASE}/api/settings/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notifications),
    }).then((r) => handleResponse<AppSettings>(r)),

  updateSystem: (system: SystemSettings) =>
    fetch(`${API_BASE}/api/settings/system`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(system),
    }).then((r) => handleResponse<AppSettings>(r)),
};

// ---------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------

export const modelsApi = {
  list: () =>
    fetch(`${API_BASE}/api/models`).then((r) =>
      handleResponse<{ models: { name: string; sizeMb: number; active: boolean }[]; currentModel: string; usingCustomModel: boolean }>(
        r
      )
    ),
  activate: (modelName: string) =>
    fetch(`${API_BASE}/api/models/activate/${modelName}`, { method: "POST" }).then((r) =>
      handleResponse<{ activated: string }>(r)
    ),
};

// Resolve a backend-relative media URL (e.g. "/media/images/x.jpg") to a
// full URL against API_BASE. Detection.imageUrl values from the API are
// already root-relative paths returned by the backend.
export function mediaUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
