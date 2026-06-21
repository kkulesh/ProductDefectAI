import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { detectionsApi, mediaUrl, type Detection } from "../lib/api";

interface ConveyorItem {
  product: Detection;
  x: number;
  removed?: boolean; // markForRemoval call has been made (or is in flight)
}

const SPAWN_INTERVAL_MS = 1800;
const MOVE_INTERVAL_MS = 50;
const MOVE_STEP = 1.5;

export function VirtualRejection() {
  const [isRunning, setIsRunning] = useState(false);
  const [items, setItems] = useState<ConveyorItem[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [queue, setQueue] = useState<Detection[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current belt items in a ref too, so loadPendingDetections (called
  // from outside the spawn loop) can de-dupe against what's already moving.
  const itemsRef = useRef<ConveyorItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadPendingDetections = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const result = await detectionsApi.list({ status: "pending", limit: 100 });
      setQueue((prev) => {
        // Avoid re-queueing detections already on the belt or already queued
        const existingIds = new Set([
          ...prev.map((d) => d.id),
          ...itemsRef.current.map((i) => i.product.id),
        ]);
        const fresh = result.items.filter((d) => !existingIds.has(d.id));
        return [...prev, ...fresh];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pending detections");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Load the initial batch of pending detections on mount, regardless of
  // run state, so the queue count is visible immediately.
  useEffect(() => {
    loadPendingDetections();
  }, [loadPendingDetections]);

  // Spawn real pending detections onto the belt
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setQueue((prevQueue) => {
        if (prevQueue.length === 0) return prevQueue;
        const [next, ...rest] = prevQueue;
        setItems((prevItems) => [...prevItems, { product: next, x: 0 }]);
        return rest;
      });
    }, SPAWN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Periodically top up the queue with newly-pending detections from the
  // backend while the simulation runs, so it doesn't run dry mid-session.
  useEffect(() => {
    if (!isRunning) return;
    const refill = setInterval(loadPendingDetections, 5000);
    return () => clearInterval(refill);
  }, [isRunning, loadPendingDetections]);

  // Move items along the belt; when a pending detection reaches the reject
  // point, actually call the backend to mark it for removal — this is a
  // real state change, not a simulated outcome.
  useEffect(() => {
    if (!isRunning) return;

    const moveInterval = setInterval(() => {
      setItems((prev) => {
        const updated = prev.map((item) => ({ ...item, x: item.x + MOVE_STEP }));

        updated.forEach((item) => {
          if (item.x >= 65 && !item.removed) {
            item.removed = true;
            detectionsApi
              .markForRemoval(item.product.id)
              .then(() => setRemovedCount((c) => c + 1))
              .catch(() => {
                // If the call fails, don't count it as removed — surfaced
                // via the error banner instead of silently pretending it
                // succeeded.
                item.removed = false;
                setError(`Failed to mark ${item.product.id} for removal`);
              });
          }
        });

        const stillOnBelt = updated.filter((item) => item.x < 95);
        const justFinished = updated.filter((item) => item.x >= 95);
        if (justFinished.length > 0) {
          setPassedCount((c) => c + justFinished.length);
        }

        return stillOnBelt;
      });
    }, MOVE_INTERVAL_MS);

    return () => clearInterval(moveInterval);
  }, [isRunning]);

  const handleReset = () => {
    setItems([]);
    setRemovedCount(0);
    setPassedCount(0);
    setIsRunning(false);
    loadPendingDetections();
  };

  const queueCount = queue.length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Virtual Rejection Simulation</h1>
        <p className="text-gray-600 mt-1">
          Visualize automated removal of real pending detections from the queue
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-700 flex items-center gap-2">
              {loadingQueue && <Loader2 className="w-4 h-4 animate-spin" />}
              {queueCount}
            </div>
            <div className="text-sm text-gray-600">Pending in Queue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{passedCount}</div>
            <div className="text-sm text-gray-600">Reached End of Belt</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{removedCount}</div>
            <div className="text-sm text-gray-600">Marked for Removal</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{passedCount + removedCount}</div>
            <div className="text-sm text-gray-600">Total Processed</div>
          </CardContent>
        </Card>
      </div>

      {/* Simulation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Conveyor Belt Simulation</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsRunning(!isRunning)}
                variant={isRunning ? "outline" : "default"}
                disabled={!isRunning && queueCount === 0 && items.length === 0}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queueCount === 0 && items.length === 0 && !loadingQueue && (
            <div className="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              No pending detections to process right now. Upload an image or run camera/video
              detection to populate the queue, or wait — new pending detections will appear here
              automatically.
            </div>
          )}

          <div className="relative bg-gray-100 rounded-lg p-8 h-96 overflow-hidden">
            {/* Conveyor Belt */}
            <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 h-32 bg-gray-800 border-y-4 border-gray-700">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-2 bg-gray-600 opacity-50" style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px)',
                  animation: isRunning ? 'scroll 2s linear infinite' : 'none',
                }} />
              </div>
            </div>

            {/* Detection Zone (Blue) */}
            <div className="absolute left-1/4 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-32 h-40 bg-blue-200/50 border-2 border-blue-500 border-dashed rounded flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs font-semibold text-blue-700">DETECTION</div>
                <div className="text-xs font-semibold text-blue-700">ZONE</div>
              </div>
            </div>

            {/* Rejection Zone (Above Belt) */}
            <div className="absolute left-[55%] top-[10%] w-24 h-24 bg-red-200 rounded-lg border-2 border-red-500 flex items-center justify-center">
              <span className="text-xs font-semibold text-red-700">REJECT</span>
            </div>

            {/* Accept Zone (End of Belt) */}
            <div className="absolute right-[5%] top-1/2 transform -translate-y-1/2 w-24 h-32 bg-green-200 rounded border-2 border-green-500 flex items-center justify-center">
              <span className="text-xs font-semibold text-green-700">ACCEPT</span>
            </div>

            {/* Products — every item on the belt is a real pending Detection
                record pulled from the backend, so it is always routed to
                the reject zone (that's what "pending" means: flagged, not
                yet confirmed). There is no fabricated pass/fail outcome
                here — only items the model actually flagged appear at all. */}
            <AnimatePresence>
              {items.map((item) => {
                const { product, x } = item;

                const getProductPosition = () => {
                  if (x < 55) {
                    return { x, y: 42 };
                  } else if (x >= 55 && x < 75) {
                    const progress = (x - 55) / 20;
                    return { x, y: 42 - (progress * 22) };
                  }
                  return { x, y: 42 };
                };

                const position = getProductPosition();

                return (
                  <motion.div
                    key={product.id}
                    className="absolute"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                    }}
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: x >= 65 ? 0 : 1,
                      scale: x >= 65 ? 0.5 : 1,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.05 }}
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center bg-red-400 border-2 border-red-600 relative">
                      {product.imageUrl && (
                        <img
                          src={mediaUrl(product.imageUrl)}
                          alt={product.defectType}
                          className="absolute inset-0 w-full h-full object-cover opacity-60"
                        />
                      )}
                      {x < 65 && (
                        <Badge className="bg-red-600 text-xs relative z-10">
                          {product.defectType}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Detection Zone Indicator */}
            <div className="absolute left-[25%] top-[25%] text-center">
              <div className="text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-1 rounded">
                ↓ SCAN ↓
              </div>
            </div>

            {/* Flow Direction */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-8 h-0.5 bg-gray-600"></div>
                <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-600"></div>
              </div>
              <span className="text-sm">Product Flow</span>
            </div>

            {/* Process Flow Labels */}
            <div className="absolute top-4 left-4 text-xs text-gray-600 space-y-1">
              <div>1. Pending detections enter from queue</div>
              <div>2. Pass through detection zone</div>
              <div>3. Marked for removal at reject point</div>
            </div>
          </div>

          <style>{`
            @keyframes scroll {
              from { background-position: 0 0; }
              to { background-position: 40px 0; }
            }
          `}</style>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About This Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>
            Every item on the belt is a real, currently-<strong>pending</strong> detection
            pulled from <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">GET /api/detections?status=pending</code>.
            When an item reaches the reject zone, this page calls the same
            mark-for-removal action available on the Defect Review page — it's not a
            simulated outcome, the detection's removal status is actually updated.
          </p>
          <p>
            To review or confirm these detections individually instead, use the{" "}
            <span className="font-medium">Defect Review</span> page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
