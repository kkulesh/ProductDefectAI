import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
import { AlertCircle, CheckCircle, TrendingUp, Activity, Upload, Play, Pause } from "lucide-react";

export function Dashboard() {
  const API_BASE = "http://localhost:8000/api/v1";

  const [stats, setStats] = useState({
    totalInspected: 0,
    defectsDetected: 0,
    virtuallyRemoved: 0,
    accuracy: 0,
    falsePositives: 0,
  });

  const [recentDetections, setRecentDetections] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([
    { id: 1, type: 'warning', message: 'Low confidence detection (67%) on conveyor 2', time: '2 min ago' },
    { id: 2, type: 'info', message: 'System processing 98% efficiency', time: '5 min ago' },
  ]);

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/stats/summary`);
      if (!response.ok) {
        throw new Error(`Unable to load dashboard summary: ${response.status}`);
      }
      const summary = await response.json();
      setStats({
        totalInspected: summary.totalInspected ?? 0,
        defectsDetected: summary.defectsDetected ?? 0,
        virtuallyRemoved: summary.virtuallyRemoved ?? 0,
        accuracy: summary.accuracy ?? 0,
        falsePositives: summary.falsePositives ?? 0,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard summary:", error);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Media upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [confidenceThreshold, setConfidenceThreshold] = useState<number[]>([65]);
  const [opacity, setOpacity] = useState<number[]>([70]);
  const [overlap, setOverlap] = useState<number[]>([45]);


  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsVideo(file.type.startsWith('video/'));

    // Create object URL for display
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaDimensions(null);
    setDetections([]);
    setIsPlaying(false);
  };

  // Run detection on current frame/image
  const runDetection = async () => {
    if (!mediaUrl || isDetecting) return;

    setIsDetecting(true);
    try {
      let imageData: string;

      if (isVideo && videoRef.current) {
        // Capture current video frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        imageData = canvas.toDataURL('image/jpeg', 0.8);
      } else {
        // For images, convert to base64
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = mediaUrl;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        imageData = canvas.toDataURL('image/jpeg', 0.8);
      }

      // Send to backend
      const response = await fetch('http://localhost:8000/api/v1/detection/detect-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData, confidence: confidenceThreshold[0] / 100 }),
      });

      if (response.ok) {
        const result = await response.json();

        // Convert bbox coordinates to percentages
        const processedDetections = result.detections.map((det: any) => ({
          id: Date.now() + Math.random(),
          type: det.class,
          confidence: (det.confidence * 100).toFixed(1),
          x: (det.bbox[0] / result.image_width) * 100,
          y: (det.bbox[1] / result.image_height) * 100,
          width: ((det.bbox[2] - det.bbox[0]) / result.image_width) * 100,
          height: ((det.bbox[3] - det.bbox[1]) / result.image_height) * 100,
        }));

        setDetections(processedDetections);

        // Update recent detections
        processedDetections.forEach((det: any) => {
          const newDetection = {
            id: det.id,
            type: det.type,
            confidence: det.confidence,
            time: 'Just now',
          };
          setRecentDetections(prev => [newDetection, ...prev.slice(0, 4)]);
        });
      }
    } catch (error) {
      console.error('Detection failed:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  // Handle video play/pause
  const togglePlayback = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Real-time defect detection monitoring</p>
      </div>

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
              <span>+12% from yesterday</span>
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
              {stats.totalInspected > 0
                ? ((stats.defectsDetected / stats.totalInspected) * 100).toFixed(2)
                : "0.00"}% defect rate
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
              {stats.defectsDetected > 0
                ? ((stats.virtuallyRemoved / stats.defectsDetected) * 100).toFixed(1)
                : "0.0"}% removal rate
            </div>
          </CardContent>
        </Card>

        {/* <Card>
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
              {((stats.falsePositives / stats.defectsDetected) * 100).toFixed(1)}% of detections
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
        </Card> */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Live Camera Feed</CardTitle>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Media
              </Button>
              {mediaUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runDetection}
                    disabled={isDetecting}
                  >
                    {isDetecting ? 'Detecting...' : 'Run Detection'}
                  </Button>
                  {isVideo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="relative bg-gray-900 rounded-lg overflow-hidden"
              style={mediaDimensions ? { aspectRatio: `${mediaDimensions.width}/${mediaDimensions.height}` } : { aspectRatio: '16/9' }}
            >
              {mediaUrl ? (
                <>
                  {isVideo ? (
                    <video
                      ref={videoRef}
                      src={mediaUrl as string}
                      className="w-full h-full object-cover"
                      onLoadedMetadata={(event) => {
                        const target = event.currentTarget;
                        setMediaDimensions({ width: target.videoWidth, height: target.videoHeight });
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt="Uploaded media"
                      className="w-full h-full object-cover"
                      onLoad={(event) => {
                        setMediaDimensions({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        });
                      }}
                    />
                  )}

                  {/* Detection Overlays */}
                  {detections.map(det => (
                    <div
                      key={det.id}
                      className="absolute border-2 border-red-500"
                      style={{
                        left: `${det.x}%`,
                        top: `${det.y}%`,
                        width: `${det.width}%`,
                        height: `${det.height}%`,
                      }}
                    >
                      <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                        {det.type} {det.confidence}%
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

              <div className="absolute top-4 left-4 space-y-2">
                <Badge className={mediaUrl ? "bg-green-500" : "bg-gray-500"}>
                  {mediaUrl ? (isVideo ? "VIDEO" : "IMAGE") : "NO MEDIA"}
                </Badge>
                {recentDetections.slice(0, 3).map(det => (
                  <div key={det.id} className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>{det.type} - {det.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-sm">
                Detections: {detections.length} | Status: {isDetecting ? 'Processing...' : 'Ready'}
              </div>
            </div>
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
                min={50}
                max={99}
                step={1}
                className="w-full [&_[role=slider]]:bg-orange-600 [&_[role=slider]]:border-orange-600 [&_.bg-primary]:bg-orange-500"
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
                className="w-full [&_[role=slider]]:bg-orange-600 [&_[role=slider]]:border-orange-600 [&_.bg-primary]:bg-orange-500"
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
                className="w-full [&_[role=slider]]:bg-orange-600 [&_[role=slider]]:border-orange-600 [&_.bg-primary]:bg-orange-500"
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
