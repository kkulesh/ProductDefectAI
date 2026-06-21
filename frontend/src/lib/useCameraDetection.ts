import { useCallback, useEffect, useRef, useState } from "react";
import { cameraApi, type BoundingBox } from "./api";

export interface LiveDetection extends BoundingBox {
  id: string;
}

interface UseCameraDetectionOptions {
  confidenceThreshold: number; // 0-100, matches the Slider in the UI
  persist?: boolean; // whether the backend should save matches as Detection records
  sendIntervalMs?: number; // how often to push a frame to the backend
}

export function useCameraDetection({
  confidenceThreshold,
  persist = false,
  sendIntervalMs = 500,
}: UseCameraDetectionOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState<LiveDetection[]>([]);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingCustomModel, setUsingCustomModel] = useState<boolean | null>(null);
  const [modelWarning, setModelWarning] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
    setIsConnected(false);
    setDetections([]);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Camera access failed: ${e.message}`
          : "Camera access failed"
      );
      return;
    }

    const ws = new WebSocket(cameraApi.streamUrl());
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setError("Detection stream connection error");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          return;
        }
        setLastInferenceMs(data.inferenceMs ?? null);
        setUsingCustomModel(data.usingCustomModel ?? null);
        setModelWarning(data.warning ?? null);
        const boxes: LiveDetection[] = (data.detections || []).map(
          (b: BoundingBox, i: number) => ({ ...b, id: `${Date.now()}-${i}` })
        );
        setDetections(boxes);
      } catch {
        // ignore malformed message
      }
    };

    setIsStreaming(true);

    intervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL("image/jpeg", 0.7);

      wsRef.current.send(
        JSON.stringify({
          frame: frameData,
          confidence: confidenceThreshold / 100,
          persist,
        })
      );
    }, sendIntervalMs);
  }, [confidenceThreshold, persist, sendIntervalMs]);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    canvasRef,
    isStreaming,
    isConnected,
    detections,
    lastInferenceMs,
    error,
    usingCustomModel,
    modelWarning,
    start,
    stop,
  };
}
