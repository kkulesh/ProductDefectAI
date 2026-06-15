import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Search, Calendar as CalendarIcon, Download, Eye, Trash2 } from "lucide-react";
import { Detection } from "../data/mockData";
import { format } from "date-fns";

export function HistoricalArchive() {
  const API_BASE = "http://localhost:8000/api/v1";
  const [detections, setDetections] = useState<Detection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedDefectType, setSelectedDefectType] = useState<string>("all");

  useEffect(() => {
    fetchDetections();
  }, []);

  const parseApiDetection = (record: any): Detection => {
    const firstDet = record.detections?.[0] ?? {};
    return {
      id: record.id,
      timestamp: new Date(record.timestamp),
      defectType: firstDet.class ?? "Unknown",
      confidence: typeof firstDet.confidence === "number" ? firstDet.confidence : 0,
      imageUrl: record.annotatedImageUrl || `https://via.placeholder.com/400x300?text=${encodeURIComponent(firstDet.class ?? 'Defect')}`,
      operatorConfirmed: record.operatorConfirmed,
      removalStatus: record.removalStatus ?? 'pending',
      position: {
        x: Array.isArray(firstDet.bbox) ? firstDet.bbox[0] ?? 0 : 0,
        y: Array.isArray(firstDet.bbox) ? firstDet.bbox[1] ?? 0 : 0,
      },
    };
  };

  const fetchDetections = async () => {
    try {
      const response = await fetch(`${API_BASE}/detections?limit=100`);
      if (!response.ok) {
        throw new Error(`Unable to load archive detections: ${response.status}`);
      }
      const payload = await response.json();
      setDetections(payload.items?.map(parseApiDetection) ?? []);
    } catch (error) {
      console.error("Failed to load historical detections:", error);
    }
  };

  const defectTypes = ['all', 'Crack', 'Discoloration', 'Dent', 'Surface Defect', 'Shape Defect'];

  const filteredDetections = detections.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.defectType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedDefectType === 'all' || d.defectType === selectedDefectType;

    const matchesDate = (!dateRange.from || d.timestamp >= dateRange.from) &&
                       (!dateRange.to || d.timestamp <= dateRange.to);

    return matchesSearch && matchesType && matchesDate;
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Historical Archive</h1>
        <p className="text-gray-600 mt-1">Browse and manage past detections</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{detections.length}</div>
            <div className="text-sm text-gray-600">Total Records</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {(detections.length * 0.245).toFixed(0)} MB
            </div>
            <div className="text-sm text-gray-600">Storage Used</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {detections.filter(d => d.operatorConfirmed === true).length}
            </div>
            <div className="text-sm text-gray-600">Confirmed Defects</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {detections.filter(d => d.operatorConfirmed === null).length}
            </div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by ID or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateRange.from ? (
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
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange(range || {})}
                />
              </PopoverContent>
            </Popover>

            <div className="flex gap-2 flex-wrap">
              {defectTypes.map(type => (
                <Button
                  key={type}
                  variant={selectedDefectType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDefectType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredDetections.length} of {detections.length} records
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Filtered
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Old Records
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredDetections.slice(0, 24).map((detection) => (
          <Card key={detection.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative">
              <img
                src={detection.imageUrl}
                alt={`Detection ${detection.id}`}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2">
                <Badge variant={detection.operatorConfirmed === true ? 'default' : 'secondary'}>
                  {(detection.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-gray-600">{detection.id}</span>
                {detection.operatorConfirmed === true && (
                  <Badge className="bg-green-500 text-xs">Confirmed</Badge>
                )}
                {detection.operatorConfirmed === false && (
                  <Badge variant="destructive" className="text-xs">Rejected</Badge>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900">{detection.defectType}</div>
                <div className="text-xs text-gray-500">
                  {detection.timestamp.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <Download className="w-3 h-3 mr-1" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDetections.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No records found matching your filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
