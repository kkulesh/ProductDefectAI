import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Play, Pause, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Product {
  id: number;
  x: number;
  isDefective: boolean;
  type?: string;
}

export function VirtualRejection() {
  const [isRunning, setIsRunning] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [passedCount, setPassedCount] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const newProduct: Product = {
        id: Date.now(),
        x: 0,
        isDefective: Math.random() > 0.85,
        type: ['Crack', 'Dent', 'Discoloration'][Math.floor(Math.random() * 3)],
      };

      setProducts(prev => [...prev, newProduct]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    const moveInterval = setInterval(() => {
      setProducts(prev => {
        const updated = prev.map(p => ({ ...p, x: p.x + 1.5 }));

        updated.forEach(p => {
          if (p.x >= 95) {
            if (p.isDefective) {
              setRejectedCount(c => c + 1);
            } else {
              setPassedCount(c => c + 1);
            }
          }
        });

        return updated.filter(p => p.x < 95);
      });
    }, 50);

    return () => clearInterval(moveInterval);
  }, [isRunning]);

  const handleReset = () => {
    setProducts([]);
    setRejectedCount(0);
    setPassedCount(0);
    setIsRunning(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Virtual Rejection Simulation</h1>
        <p className="text-gray-600 mt-1">Visualize automated defect removal process</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{passedCount}</div>
            <div className="text-sm text-gray-600">Products Passed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <div className="text-sm text-gray-600">Defects Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{passedCount + rejectedCount}</div>
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

            {/* Products */}
            <AnimatePresence>
              {products.map(product => {
                // Calculate animation path
                const getProductPosition = () => {
                  if (product.x < 25) {
                    // Before detection zone - on belt
                    return { x: product.x, y: 42 };
                  } else if (product.x >= 25 && product.x < 55) {
                    // In and after detection zone
                    return { x: product.x, y: 42 };
                  } else if (product.isDefective && product.x >= 55 && product.x < 75) {
                    // Defective: move up to reject zone
                    const progress = (product.x - 55) / 20;
                    return { x: product.x, y: 42 - (progress * 22) };
                  } else if (!product.isDefective && product.x >= 55) {
                    // Good: continue on belt to accept
                    return { x: product.x, y: 42 };
                  }
                  return { x: product.x, y: 42 };
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
                      opacity: product.isDefective && product.x >= 65 ? 0 : 1,
                      scale: product.isDefective && product.x >= 65 ? 0.5 : 1,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.05 }}
                  >
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center transition-colors ${
                      product.isDefective
                        ? 'bg-red-400 border-2 border-red-600'
                        : 'bg-blue-400 border-2 border-blue-600'
                    }`}>
                      {product.isDefective && product.x < 65 && (
                        <Badge className="bg-red-600 text-xs">
                          {product.type}
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
              <div>1. Products enter conveyor</div>
              <div>2. Pass through detection zone</div>
              <div>3. Defective → Reject | Good → Accept</div>
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

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-400 border-2 border-blue-600 rounded-lg"></div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Good Product</div>
                <div className="text-xs text-gray-600">Passes to accept zone</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-400 border-2 border-red-600 rounded-lg"></div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Defective Product</div>
                <div className="text-xs text-gray-600">Virtually removed to reject zone</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
