import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Search, Calendar as CalendarIcon, Download, Eye, Trash2, Loader2 } from "lucide-react";
import { detectionsApi, mediaUrl, type Detection, type DefectDistributionItem } from "../lib/api";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export function HistoricalArchive() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedDefectType, setSelectedDefectType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, nonDefectCount: 0 });
  // Defect type filter options are derived from real detection data
  // (whatever classes the deployed/trained model has actually produced),
  // rather than a hardcoded list that may not match what's really there.
  const [availableTypes, setAvailableTypes] = useState<DefectDistributionItem[]>([]);

  const loadDetections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statsResp, distribution] = await Promise.all([
        detectionsApi.list({
          search: searchTerm || undefined,
          defect_type: selectedDefectType !== "all" ? selectedDefectType : undefined,
          date_from: dateRange?.from?.toISOString(),
          date_to: dateRange?.to?.toISOString(),
          limit: 24,
          // Historical Archive is the full audit trail — it should include
          // passing classifications (e.g. a "good banana" class) alongside
          // defects, not just flagged defects like Defect Review does.
          defects_only: false,
        }),
        detectionsApi.stats(),
        detectionsApi.distribution(),
      ]);
      setDetections(list.items);
      setTotal(list.total);
      setStats({
        total: statsResp.total + statsResp.nonDefectCount,
        confirmed: statsResp.confirmed,
        pending: statsResp.pending,
        nonDefectCount: statsResp.nonDefectCount,
      });
      // Only show filter buttons for types that actually have records —
      // an empty-count filter button is dead clutter, and a custom-trained
      // model's class names (defect or passing) will show up here
      // automatically.
      setAvailableTypes(distribution.filter((d) => d.value > 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedDefectType, dateRange]);

  useEffect(() => {
    const debounce = setTimeout(loadDetections, 300);
    return () => clearTimeout(debounce);
  }, [loadDetections]);

  const handleExport = () => {
    const url = detectionsApi.exportCsvUrl({
      search: searchTerm || undefined,
      defect_type: selectedDefectType !== "all" ? selectedDefectType : undefined,
    });
    window.open(url, "_blank");
  };

  const handleClearOld = async () => {
    if (!confirm("Delete all records older than 30 days? This cannot be undone.")) return;
    try {
      await detectionsApi.clearOlderThan(30);
      await loadDetections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear old records");
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Historical Archive</h1>
        <p className="text-gray-600 mt-1">
          Browse and manage past detections — full audit trail, including passing classifications
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Records</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {(stats.total * 0.245).toFixed(0)} MB
            </div>
            <div className="text-sm text-gray-600">Storage Used (est.)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <div className="text-sm text-gray-600">Confirmed Defects</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-cyan-600">{stats.nonDefectCount}</div>
            <div className="text-sm text-gray-600">Passing Classifications</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="relative h-9">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by ID or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start h-9">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  defaultMonth={dateRange?.from}
                  numberOfMonths={2}
                />
                {dateRange?.from && (
                  <div className="flex justify-end p-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                      Clear dates
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedDefectType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDefectType("all")}
              >
                All
              </Button>
              {availableTypes.map((type) => (
                <Button
                  key={type.name}
                  variant={selectedDefectType === type.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDefectType(type.name)}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: type.color, opacity: type.isDefect ? 1 : 0.5 }}
                  />
                  {type.name}
                  {!type.isDefect && <span className="ml-1 text-[10px] text-gray-400">(pass)</span>}
                </Button>
              ))}
              {availableTypes.length === 0 && (
                <span className="text-sm text-gray-400 self-center">
                  No records yet
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {detections.length} of {total} records
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Filtered
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearOld}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Old Records
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archive Grid */}
      {loading && detections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
            Loading archive...
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {detections.map((detection) => {
            const isPassing = detection.isDefect === false;
            return (
              <Card
                key={detection.id}
                className={`overflow-hidden hover:shadow-lg transition-shadow ${isPassing ? "ring-1 ring-cyan-200" : ""}`}
              >
                <div className="relative">
                  {detection.imageUrl ? (
                    <img
                      src={mediaUrl(detection.imageUrl)}
                      alt={`Detection ${detection.id}`}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-100" />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {isPassing && <Badge className="bg-cyan-500 text-xs">Pass</Badge>}
                    <Badge variant={detection.operatorConfirmed === true ? "default" : "secondary"}>
                      {(detection.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-600">{detection.id}</span>
                    {!isPassing && detection.operatorConfirmed === true && (
                      <Badge className="bg-green-500 text-xs">Confirmed</Badge>
                    )}
                    {!isPassing && detection.operatorConfirmed === false && (
                      <Badge variant="destructive" className="text-xs">Rejected</Badge>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-900">{detection.defectType}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(detection.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => detection.imageUrl && window.open(mediaUrl(detection.imageUrl), "_blank")}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        if (!detection.imageUrl) return;
                        const a = document.createElement("a");
                        a.href = mediaUrl(detection.imageUrl);
                        a.download = `${detection.id}.jpg`;
                        a.click();
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                  </div>
                  {detection.sourceImageUrl && detection.sourceImageUrl !== detection.imageUrl && (
                    <button
                      className="text-xs text-blue-600 hover:underline w-full text-center pt-1"
                      onClick={() => window.open(mediaUrl(detection.sourceImageUrl!), "_blank")}
                    >
                      View full source image
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && detections.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No records found matching your filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
