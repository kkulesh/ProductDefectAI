import { AlertTriangle } from "lucide-react";

interface ModelWarningBannerProps {
  warning: string | null | undefined;
}

/**
 * Shown whenever the backend reports it's using the stock COCO-pretrained
 * YOLOv8 fallback instead of a custom-trained defect model (i.e.
 * usingCustomModel === false). Without a trained model, detections will
 * be real COCO classes (person, car, orange, train, ...) rather than
 * meaningful defect types — this makes that fact impossible to miss
 * instead of letting that data quietly flow into charts and records.
 */
export function ModelWarningBanner({ warning }: ModelWarningBannerProps) {
  if (!warning) return null;

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded-lg px-4 py-3">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
      <div>
        <p className="font-semibold">Using stock demo model, not your trained detector</p>
        <p className="mt-0.5 text-amber-800">{warning}</p>
      </div>
    </div>
  );
}
