import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Play, Square, Camera, Upload, Video, Loader2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { useCameraDetection } from "../lib/useCameraDetection";
import { uploadApi, mediaUrl, type Detection, type VideoFrameResult } from "../lib/api";
import { VideoFramePlayer } from "../components/VideoFramePlayer";
import { ModelWarningBanner } from "../components/ModelWarningBanner";

export function DetectionMonitoring() {
  const [confidence, setConfidence] = useState([75]);
  const [persistDetections, setPersistDetections] = useState(true);
  const [mode, setMode] = useState<"camera" | "upload">("camera");

  const {
    videoRef,
    canvasRef,
    isStreaming,
    isConnected,
    detections: liveDetections,
    lastInferenceMs,
    error: cameraError,
    modelWarning: cameraModelWarning,
    start,
    stop,
  } = useCameraDetection({
    confidenceThreshold: confidence[0],
    persist: persistDetections,
    sendIntervalMs: 500,
  });

  // ---- Image / video upload state ----
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedIsVideo, setUploadedIsVideo] = useState(false);
  const [imageResult, setImageResult] = useState<{ imageUrl: string; detections: Detection[] } | null>(null);
  const [videoFrames, setVideoFrames] = useState<VideoFrameResult[]>([]);
  const [uploadModelWarning, setUploadModelWarning] = useState<string | null>(null);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      const isVideo = file.type.startsWith("video/");
      setUploadedIsVideo(isVideo);
      setImageResult(null);
      setVideoFrames([]);
      try {
        if (isVideo) {
          const res = await uploadApi.video(file);
          const processed = await uploadApi.processVideo(res.filename, {
            confidenceThreshold: confidence[0] / 100,
            targetFps: 3,
          });
          setVideoFrames(processed.frames);
          setUploadModelWarning(processed.warning);
        } else {
          const res = await uploadApi.image(file, confidence[0] / 100);
          setImageResult({ imageUrl: res.imageUrl, detections: res.detections });
          setUploadModelWarning(res.warning);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [confidence]
  );

  const totalVideoBoxes = videoFrames.reduce((sum, f) => sum + f.boxes.length, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Detection Monitoring</h1>
        <p className="text-gray-600 mt-1">Real-time YOLO detection with live overlay</p>
      </div>

      <div className="flex gap-2">
        <Button variant={mode === "camera" ? "default" : "outline"} size="sm" onClick={() => setMode("camera")}>
          <Video className="w-4 h-4 mr-2" />
          Live Camera
        </Button>
        <Button variant={mode === "upload" ? "default" : "outline"} size="sm" onClick={() => setMode("upload")}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Image / Video
        </Button>
      </div>

      <ModelWarningBanner warning={mode === "camera" ? cameraModelWarning : uploadModelWarning} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Feed */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{mode === "camera" ? "Live Detection Stream" : "Upload & Detect"}</CardTitle>
            <div className="flex items-center gap-2">
              {mode === "camera" && (
                <Badge variant={isStreaming && isConnected ? "default" : "secondary"}>
                  {isStreaming && isConnected ? "DETECTING" : isStreaming ? "CONNECTING" : "STOPPED"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {mode === "camera" ? (
              <>
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {!isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                      Camera is stopped. Click "Start Detection" to begin streaming from your webcam.
                    </div>
                  )}

                  {/* Detection Overlays */}
                  {isStreaming &&
                    liveDetections.map((det) => (
                      <div
                        key={det.id}
                        className="absolute border-2 border-red-500"
                        style={{
                          left: `${det.x * 100}%`,
                          top: `${det.y * 100}%`,
                          width: `${det.width * 100}%`,
                          height: `${det.height * 100}%`,
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                          {det.label} {(det.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}

                  {/* Info Overlay */}
                  <div className="absolute top-4 left-4 space-y-2">
                    <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                      Confidence Threshold: {confidence[0]}%
                    </div>
                    <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                      Detections: {liveDetections.length}
                    </div>
                    {lastInferenceMs !== null && (
                      <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                        Inference: {lastInferenceMs.toFixed(0)}ms
                      </div>
                    )}
                  </div>
                </div>

                {cameraError && (
                  <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {cameraError}
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3 mt-4">
                  <Button onClick={start} variant={isStreaming ? "outline" : "default"} size="sm" disabled={isStreaming}>
                    <Play className="w-4 h-4 mr-2" />
                    Start Detection
                  </Button>
                  <Button onClick={stop} variant="outline" size="sm" disabled={!isStreaming}>
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                  <Button
                    variant={persistDetections ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPersistDetections((p) => !p)}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {persistDetections ? "Saving Detections" : "Save Detections: Off"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm">Running detection...</span>
                    </div>
                  ) : uploadedIsVideo && videoFrames.length > 0 ? (
                    // Frame-by-frame player: boxes are drawn against the exact
                    // captured frame they were detected on, scrubbable/playable.
                    <VideoFramePlayer frames={videoFrames} />
                  ) : !uploadedIsVideo && imageResult?.imageUrl ? (
                    <div className="relative w-full h-full">
                      <img
                        src={mediaUrl(imageResult.imageUrl)}
                        alt="Uploaded"
                        className="w-full h-full object-contain"
                      />
                      {imageResult.detections.map((det) => (
                        <div
                          key={det.id}
                          className="absolute border-2 border-red-500"
                          style={{
                            left: `${det.position.x}%`,
                            top: `${det.position.y}%`,
                            width: `${det.width ?? 10}%`,
                            height: `${det.height ?? 10}%`,
                          }}
                        >
                          <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                            {det.defectType} {(det.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">Upload an image or video to run detection</div>
                  )}
                </div>

                {uploadError && (
                  <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {uploadError}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileSelected}
                  />
                  <Button onClick={() => fileInputRef.current?.click()} size="sm" disabled={uploading}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image / Video
                  </Button>
                  {!uploadedIsVideo && imageResult && (
                    <span className="text-sm text-gray-600">
                      {imageResult.detections.length} defect(s) found
                    </span>
                  )}
                  {uploadedIsVideo && videoFrames.length > 0 && (
                    <span className="text-sm text-gray-600">
                      {totalVideoBoxes} defect(s) found across {videoFrames.length} sampled frames
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Settings Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Confidence Threshold: {confidence[0]}%</Label>
              <Slider
                value={confidence}
                onValueChange={setConfidence}
                min={1}
                max={99}
                step={1}
              />
              <p className="text-xs text-gray-500">
                Only show detections above this confidence level
              </p>
            </div>

            <div className="space-y-2">
              <Label>Resolution</Label>
              <Select defaultValue="1080p">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">1280x720 (720p)</SelectItem>
                  <SelectItem value="1080p">1920x1080 (1080p)</SelectItem>
                  <SelectItem value="4k">3840x2160 (4K)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Requested webcam resolution (browser-dependent)</p>
            </div>

            <div className="space-y-2">
              <Label>Frame Send Interval</Label>
              <Select defaultValue="500">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="200">Fast (~5/sec)</SelectItem>
                  <SelectItem value="500">Normal (~2/sec)</SelectItem>
                  <SelectItem value="1000">Slow (~1/sec)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                How often frames are sent to the backend for inference
              </p>
            </div>

            <div className="pt-4 border-t space-y-3">
              <h4 className="text-sm font-semibold">Live Detections</h4>
              {liveDetections.length === 0 && (
                <p className="text-sm text-gray-500">No active detections</p>
              )}
              {liveDetections.slice(0, 5).map((det) => (
                <div key={det.id} className="text-sm p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">{det.label}</span>
                    <span className="text-gray-600">{(det.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
