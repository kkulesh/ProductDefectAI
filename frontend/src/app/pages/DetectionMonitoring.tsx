import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Play, Pause, Square, Camera, Maximize } from "lucide-react";
import { Badge } from "../components/ui/badge";

export function DetectionMonitoring() {
  const [isRunning, setIsRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [confidence, setConfidence] = useState([75]);
  const [cameraSource, setCameraSource] = useState("camera-1");
  const [detections, setDetections] = useState<any[]>([]);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamDimensions, setStreamDimensions] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isRunning || isPaused || !videoRef.current) return;

    const detectInterval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.videoWidth === 0) return;

      try {
        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(videoRef.current, 0, 0);

        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // Send to API
        const response = await fetch('http://localhost:8000/api/v1/detection/detect-base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData, confidence: confidence[0] / 100 }),
        });

        if (response.ok) {
          const result = await response.json();

          // Convert bbox coordinates to percentages for overlay
          const processedDetections = result.detections
            .filter((det: any) => det.confidence * 100 >= confidence[0])
            .map((det: any) => ({
              id: Date.now() + Math.random(),
              type: det.class,
              confidence: (det.confidence * 100).toFixed(1),
              x: (det.bbox[0] / result.image_width) * 100,
              y: (det.bbox[1] / result.image_height) * 100,
              width: ((det.bbox[2] - det.bbox[0]) / result.image_width) * 100,
              height: ((det.bbox[3] - det.bbox[1]) / result.image_height) * 100,
            }));

          setDetections(processedDetections);
        }
      } catch (error) {
        console.error('Detection failed:', error);
      }
    }, 1000); // Detect every 1 second

    return () => clearInterval(detectInterval);
  }, [isRunning, isPaused, confidence]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        const facingMode = cameraSource === 'camera-2' ? 'environment' : 'user';
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode },
          audio: false,
        });

        currentStream = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        setStream(mediaStream);
        setCameraAvailable(true);
      } catch (error) {
        console.error('Camera access denied or unavailable', error);
        setCameraAvailable(false);
      }
    };

    initCamera();

    return () => {
      currentStream?.getTracks().forEach(track => track.stop());
    };
  }, [cameraSource]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Detection Monitoring</h1>
        <p className="text-gray-600 mt-1">Real-time YOLO detection with live overlay</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Feed */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Live Detection Stream</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isRunning && !isPaused ? "default" : "secondary"}>
                {isRunning && !isPaused ? "DETECTING" : isPaused ? "PAUSED" : "STOPPED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="relative bg-gray-900 rounded-lg overflow-hidden"
              style={streamDimensions ? { aspectRatio: `${streamDimensions.width}/${streamDimensions.height}` } : { aspectRatio: '16/9' }}
            >
              {cameraAvailable ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(event) => {
                    const target = event.currentTarget;
                    setStreamDimensions({ width: target.videoWidth, height: target.videoHeight });
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white text-sm">
                  Camera unavailable. Please allow camera access or use a supported browser.
                </div>
              )}

              {/* Detection Overlays */}
              {isRunning && !isPaused && detections.map(det => (
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

              {/* Info Overlay */}
              <div className="absolute top-4 left-4 space-y-2">
                <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                  Camera: {cameraSource.toUpperCase()}
                </div>
                <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                  Confidence Threshold: {confidence[0]}%
                </div>
                <div className="bg-black/70 text-white px-3 py-2 rounded text-sm">
                  Detections: {detections.length}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mt-4">
              <Button
                onClick={() => {
                  setIsRunning(true);
                  setIsPaused(false);
                }}
                variant={isRunning && !isPaused ? "default" : "outline"}
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Detection
              </Button>
              <Button
                onClick={() => setIsPaused(!isPaused)}
                variant="outline"
                size="sm"
                disabled={!isRunning}
              >
                <Pause className="w-4 h-4 mr-2" />
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                onClick={() => {
                  setIsRunning(false);
                  setIsPaused(false);
                  setDetections([]);
                }}
                variant="outline"
                size="sm"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
              <Button variant="outline" size="sm">
                <Camera className="w-4 h-4 mr-2" />
                Capture Frame
              </Button>
              <Button variant="outline" size="sm">
                <Maximize className="w-4 h-4 mr-2" />
                Fullscreen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Camera Source</Label>
              <Select value={cameraSource} onValueChange={setCameraSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera-1">Camera 1 (Main)</SelectItem>
                  <SelectItem value="camera-2">Camera 2 (Backup)</SelectItem>
                  <SelectItem value="camera-3">Camera 3 (Side)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Confidence Threshold: {confidence[0]}%</Label>
              <Slider
                value={confidence}
                onValueChange={setConfidence}
                min={50}
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
            </div>

            <div className="space-y-2">
              <Label>Processing Interval</Label>
              <Select defaultValue="realtime">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time (30 FPS)</SelectItem>
                  <SelectItem value="medium">Medium (15 FPS)</SelectItem>
                  <SelectItem value="low">Low (5 FPS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t space-y-3">
              <h4 className="text-sm font-semibold">Current Detections ({detections.length})</h4>
              {detections.slice(0, 5).map(det => (
                <div key={det.id} className="text-sm p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">{det.type}</span>
                    <span className="text-gray-600">{det.confidence}%</span>
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
