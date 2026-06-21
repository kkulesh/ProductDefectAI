import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
import { AlertCircle, CheckCircle, TrendingUp, Activity, Upload, Loader2 } from "lucide-react";
import {
  dashboardApi,
  uploadApi,
  mediaUrl,
  type Detection,
  type LiveStats,
  type VideoFrameResult,
} from "../lib/api";
import { VideoFramePlayer } from "../components/VideoFramePlayer";
import { ModelWarningBanner } from "../components/ModelWarningBanner";

const POLL_INTERVAL_MS = 4000;

export function Dashboard() {
  const [stats, setStats] = useState<LiveStats>({
    totalInspected: 0,
    defectsDetected: 0,
    virtuallyRemoved: 0,
    accuracy: 0,
    falsePositives: 0,
    uptime: 0,
  });

  const [recentDetections, setRecentDetections] = useState<Detection[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState([75]);
  const [overlap, setOverlap] = useState([50]);
  const [opacity, setOpacity] = useState([70]);
  const [error, setError] = useState<string | null>(null);

  // ---- Upload & detect feed state ----
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [imageDetections, setImageDetections] = useState<Detection[]>([]);
  const [videoFrames, setVideoFrames] = useState<VideoFrameResult[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [modelWarning, setModelWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [s, recent] = await Promise.all([
          dashboardApi.stats(),
          dashboardApi.recent(5),
        ]);
        if (cancelled) return;
        setStats(s);
        setRecentDetections(recent);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard data");
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Revoke the local object URL when it's replaced/unmounted to avoid leaks
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const defectRate = stats.totalInspected > 0
    ? ((stats.defectsDetected / stats.totalInspected) * 100).toFixed(2)
    : "0.00";
  const removalRate = stats.defectsDetected > 0
    ? ((stats.virtuallyRemoved / stats.defectsDetected) * 100).toFixed(1)
    : "0.0";
  const falsePositiveRate = stats.defectsDetected > 0
    ? ((stats.falsePositives / stats.defectsDetected) * 100).toFixed(1)
    : "0.0";

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsVideo(file.type.startsWith("video/"));
    setUploadError(null);

    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    setResultImageUrl(null);
    setImageDetections([]);
    setVideoFrames([]);
  };

  const runDetection = async () => {
    if (!uploadedFile || isDetecting) return;

    setIsDetecting(true);
    setUploadError(null);
    try {
      if (isVideo) {
        const uploaded = await uploadApi.video(uploadedFile);
        const processed = await uploadApi.processVideo(uploaded.filename, {
          confidenceThreshold: confidenceThreshold[0] / 100,
          sampleEveryNFrames: 15,
          maxFrames: 40,
        });
        setVideoFrames(processed.frames);
        setModelWarning(processed.warning);
      } else {
        const result = await uploadApi.image(uploadedFile, confidenceThreshold[0] / 100);
        setImageDetections(result.detections);
        setResultImageUrl(result.imageUrl);
        setModelWarning(result.warning);
      }

      // Pull fresh stats/recent detections immediately so the rest of the
      // dashboard reflects this run without waiting for the next poll.
      const [s, recent] = await Promise.all([dashboardApi.stats(), dashboardApi.recent(5)]);
      setStats(s);
      setRecentDetections(recent);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setIsDetecting(false);
    }
  };

  // For images, once the backend has processed the upload, show the
  // backend-served copy with boxes drawn from the returned Detection
  // records. Before detection has run, show the local preview instead.
  const imageDisplayUrl = resultImageUrl ? mediaUrl(resultImageUrl) : localPreviewUrl;

  const totalVideoBoxes = videoFrames.reduce((sum, f) => sum + f.boxes.length, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Real-time defect detection monitoring</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error} — is the backend running at the configured API URL?
        </div>
      )}

      <ModelWarningBanner warning={modelWarning} />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Total Products Inspected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.totalInspected.toLocaleString()}</div>
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span>30-day running total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Defective Products Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.defectsDetected}</div>
            <div className="text-sm text-gray-600 mt-2">
              {defectRate}% defect rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Virtually Removed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.virtuallyRemoved}</div>
            <div className="text-sm text-gray-600 mt-2">
              {removalRate}% removal rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Detection Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.accuracy.toFixed(1)}%</div>
            <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
              <Activity className="w-4 h-4" />
              <span>Above target (92%)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">False Positives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.falsePositives}</div>
            <div className="text-sm text-gray-600 mt-2">
              {falsePositiveRate}% of detections
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">System Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.uptime}%</div>
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>All systems operational</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Detect Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Live Camera Feed</CardTitle>
            <div className="flex items-center gap-2">
              <input
                id="dashboard-media-upload"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("dashboard-media-upload")?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Media
              </Button>
              {localPreviewUrl && (
                <Button variant="outline" size="sm" onClick={runDetection} disabled={isDetecting}>
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    "Run Detection"
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {isVideo && videoFrames.length > 0 ? (
                // Frame-by-frame player: every box is drawn against the exact
                // captured frame it was detected on, so positions are always
                // correct — unlike overlaying boxes on continuously playing video.
                <VideoFramePlayer frames={videoFrames} overlayOpacity={opacity[0]} />
              ) : isVideo && localPreviewUrl ? (
                <video src={localPreviewUrl} controls className="w-full h-full object-contain" />
              ) : !isVideo && imageDisplayUrl ? (
                <>
                  <img src={imageDisplayUrl} alt="Uploaded media" className="w-full h-full object-cover" />
                  {imageDetections.map((det) => (
                    <div
                      key={det.id}
                      className="absolute border-2 border-red-500"
                      style={{
                        left: `${det.position.x}%`,
                        top: `${det.position.y}%`,
                        width: `${det.width ?? 10}%`,
                        height: `${det.height ?? 10}%`,
                        opacity: opacity[0] / 100,
                      }}
                    >
                      <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap" style={{ opacity: 1 }}>
                        {det.defectType} {(det.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white text-sm">
                  <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Upload an image or video to start detection</p>
                    <p className="text-xs text-gray-400 mt-2">Supported formats: JPG, PNG, MP4, AVI</p>
                  </div>
                </div>
              )}

              {/* Status badge + recent detections only make sense overlaid on
                  the simple image/empty states — the frame player has its own
                  in-player frame counter, so skip doubling up on it. */}
              {!(isVideo && videoFrames.length > 0) && (
                <div className="absolute top-4 left-4 space-y-2">
                  <Badge className={localPreviewUrl ? "bg-green-500" : "bg-gray-500"}>
                    {localPreviewUrl ? (isVideo ? "VIDEO" : "IMAGE") : "NO MEDIA"}
                  </Badge>
                  {recentDetections.slice(0, 3).map((det) => (
                    <div key={det.id} className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span>{det.defectType} - {(det.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!(isVideo && videoFrames.length > 0) && (
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-sm">
                  Detections: {isVideo ? totalVideoBoxes : imageDetections.length} | Status:{" "}
                  {isDetecting ? "Processing..." : "Ready"}
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {uploadError}
              </div>
            )}
            {isVideo && videoFrames.length === 0 && localPreviewUrl && !isDetecting && (
              <p className="mt-2 text-xs text-gray-500">
                Click "Run Detection" to sample frames from this video and step through them with bounding boxes.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Detection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Confidence Threshold</Label>
                <span className="text-sm font-semibold text-gray-900">{confidenceThreshold[0]}%</span>
              </div>
              <Slider
                value={confidenceThreshold}
                onValueChange={setConfidenceThreshold}
                min={1}
                max={99}
                step={1}
                className="w-full [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600 [&_.bg-primary]:bg-orange-500"
              />
              <p className="text-xs text-gray-500">
                Minimum confidence level for defect detection
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Overlap Threshold</Label>
                <span className="text-sm font-semibold text-gray-900">{overlap[0]}%</span>
              </div>
              <Slider
                value={overlap}
                onValueChange={setOverlap}
                min={0}
                max={100}
                step={1}
                className="w-full [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600 [&_.bg-primary]:bg-orange-500"
              />
              <p className="text-xs text-gray-500">
                Maximum allowed bounding box overlap
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Overlay Opacity</Label>
                <span className="text-sm font-semibold text-gray-900">{opacity[0]}%</span>
              </div>
              <Slider
                value={opacity}
                onValueChange={setOpacity}
                min={0}
                max={100}
                step={1}
                className="w-full [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600 [&_.bg-primary]:bg-orange-500"
              />
              <p className="text-xs text-gray-500">
                Detection overlay transparency level
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
