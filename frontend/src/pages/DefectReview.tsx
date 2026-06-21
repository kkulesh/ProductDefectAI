import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Check, X, Trash2, Download, Search, Loader2 } from "lucide-react";
import { detectionsApi, mediaUrl, type Detection } from "../lib/api";

type FilterStatus = "all" | "pending" | "confirmed" | "rejected";

export function DefectReview() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadDetections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statsResp] = await Promise.all([
        detectionsApi.list({
          search: searchTerm || undefined,
          status: filter,
          limit: 20,
        }),
        detectionsApi.stats(),
      ]);
      setDetections(list.items);
      setStats(statsResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load detections");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filter]);

  useEffect(() => {
    const debounce = setTimeout(loadDetections, 300);
    return () => clearTimeout(debounce);
  }, [loadDetections]);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await detectionsApi.approve(id);
      await loadDetections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await detectionsApi.reject(id);
      await loadDetections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkForRemoval = async (id: string) => {
    setActionLoadingId(id);
    try {
      await detectionsApi.markForRemoval(id);
      await loadDetections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark for removal");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExport = () => {
    const url = detectionsApi.exportCsvUrl({
      search: searchTerm || undefined,
      status: filter !== "all" ? filter : undefined,
    });
    window.open(url, "_blank");
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Defect Review</h1>
        <p className="text-gray-600 mt-1">Review and confirm detected defects</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Detections</div>
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
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <div className="text-sm text-gray-600">Confirmed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-600">Rejected (False Positive)</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detection History</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by ID or defect type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "pending", "confirmed", "rejected"] as FilterStatus[]).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Detection ID</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Defect Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Removal</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && detections.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                      Loading detections...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && detections.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No detections found. Try uploading an image or running camera detection.
                    </TableCell>
                  </TableRow>
                )}
                {detections.map((detection) => (
                  <TableRow key={detection.id}>
                    <TableCell className="font-mono text-sm">{detection.id}</TableCell>
                    <TableCell>
                      {detection.imageUrl ? (
                        <img
                          src={mediaUrl(detection.imageUrl)}
                          alt={`Defect ${detection.id}`}
                          title={detection.sourceImageUrl ? "Click to view full source image" : undefined}
                          className={`w-16 h-12 object-cover rounded ${
                            detection.sourceImageUrl ? "cursor-pointer hover:opacity-80" : ""
                          }`}
                          onClick={() =>
                            detection.sourceImageUrl &&
                            window.open(mediaUrl(detection.sourceImageUrl), "_blank")
                          }
                        />
                      ) : (
                        <div className="w-16 h-12 bg-gray-100 rounded" />
                      )}
                    </TableCell>
                    <TableCell>{detection.defectType}</TableCell>
                    <TableCell>
                      <Badge variant={detection.confidence > 0.9 ? "default" : "secondary"}>
                        {(detection.confidence * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(detection.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {detection.operatorConfirmed === null && (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      {detection.operatorConfirmed === true && (
                        <Badge className="bg-green-500">Confirmed</Badge>
                      )}
                      {detection.operatorConfirmed === false && (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={detection.removalStatus === "simulated" ? "default" : "outline"}>
                        {detection.removalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(detection.id)}
                          disabled={detection.operatorConfirmed === true || actionLoadingId === detection.id}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(detection.id)}
                          disabled={detection.operatorConfirmed === false || actionLoadingId === detection.id}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkForRemoval(detection.id)}
                          disabled={detection.removalStatus === "simulated" || actionLoadingId === detection.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
