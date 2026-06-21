import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { mediaUrl, type VideoFrameResult } from "../lib/api";

interface VideoFramePlayerProps {
  frames: VideoFrameResult[];
  /** How long to show each frame when auto-playing, in ms. */
  frameIntervalMs?: number;
  /** 0-100, applied to the box overlay only. */
  overlayOpacity?: number;
}

/**
 * Plays back a sequence of already-processed video frames (each with its
 * own captured still image + detection boxes) like a flipbook, with boxes
 * correctly positioned per-frame. This is intentionally NOT an overlay on
 * a continuously playing <video> element — the backend only has boxes for
 * the specific frames it sampled, so showing them against any other frame
 * (or against smooth video playback) would put boxes in the wrong place.
 * Stepping/playing through the actual captured frames keeps every box
 * accurate to the image it's drawn on.
 */
export function VideoFramePlayer({ frames, frameIntervalMs = 600, overlayOpacity = 100 }: VideoFramePlayerProps) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clampedIndex = Math.min(index, Math.max(frames.length - 1, 0));
  const current = frames[clampedIndex];

  useEffect(() => {
    // Reset to the first frame whenever a new set of frames comes in
    setIndex(0);
    setIsPlaying(false);
  }, [frames]);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= frames.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, frameIntervalMs);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isPlaying, frames.length, frameIntervalMs]);

  if (frames.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        No processed frames yet
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative flex-1 bg-black overflow-hidden">
        {current.imageUrl ? (
          <img
            src={mediaUrl(current.imageUrl)}
            alt={`Frame ${current.frameIndex}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            Frame unavailable
          </div>
        )}

        {current.boxes.map((box, i) => (
          <div
            key={`${current.frameIndex}-${i}`}
            className="absolute border-2 border-red-500"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
              opacity: overlayOpacity / 100,
            }}
          >
            <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap" style={{ opacity: 1 }}>
              {box.label} {(box.confidence * 100).toFixed(1)}%
            </div>
          </div>
        ))}

        <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded text-xs">
          Frame {clampedIndex + 1} / {frames.length} · t={current.timestampSeconds.toFixed(2)}s · {current.boxes.length} box{current.boxes.length === 1 ? "" : "es"}
        </div>
      </div>

      <div className="bg-gray-900 px-4 py-3 space-y-2">
        <Slider
          value={[clampedIndex]}
          onValueChange={([v]) => {
            setIsPlaying(false);
            setIndex(v);
          }}
          min={0}
          max={Math.max(frames.length - 1, 0)}
          step={1}
        />
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsPlaying(false);
              setIndex((i) => Math.max(0, i - 1));
            }}
            disabled={clampedIndex === 0}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={isPlaying ? "outline" : "default"}
            onClick={() => {
              if (clampedIndex >= frames.length - 1 && !isPlaying) setIndex(0);
              setIsPlaying((p) => !p);
            }}
          >
            {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isPlaying ? "Pause" : "Play Frames"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsPlaying(false);
              setIndex((i) => Math.min(frames.length - 1, i + 1));
            }}
            disabled={clampedIndex === frames.length - 1}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
