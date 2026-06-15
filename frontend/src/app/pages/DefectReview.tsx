import { useState, useEffect } from "react";
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
import { Check, X, Trash2, Download, Search } from "lucide-react";
import { Detection } from "../data/mockData";

export function DefectReview() {
  const API_BASE = "http://localhost:8000/api/v1";
  const [detections, setDetections] = useState<Detection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');

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
        throw new Error(`Unable to load detections: ${response.status}`);
      }
      const payload = await response.json();
      setDetections(payload.items?.map(parseApiDetection) ?? []);
    } catch (error) {
      console.error("Failed to load detections:", error);
    }
  };

  const patchDetection = async (
    id: string,
    patch: { operatorConfirmed?: boolean | null; removalStatus?: 'pending' | 'simulated' | 'removed' }
  ) => {
    try {
      const response = await fetch(`${API_BASE}/detections/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new Error(`Unable to update detection: ${response.status}`);
      }

      const updatedRecord = await response.json();
      setDetections((prev) => prev.map((d) => (d.id === id ? parseApiDetection(updatedRecord) : d)));
    } catch (error) {
      console.error("Failed to update detection:", error);
    }
  };

  const handleApprove = async (id: string) => {
    await patchDetection(id, { operatorConfirmed: true });
  };

  const handleReject = async (id: string) => {
    await patchDetection(id, { operatorConfirmed: false });
  };

  const handleMarkForRemoval = async (id: string) => {
    await patchDetection(id, { removalStatus: 'simulated' });
  };

  const filteredDetections = detections.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.defectType.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'pending') return d.operatorConfirmed === null;
    if (filter === 'confirmed') return d.operatorConfirmed === true;
    if (filter === 'rejected') return d.operatorConfirmed === false;
    return true;
  });

  const stats = {
    total: detections.length,
    pending: detections.filter(d => d.operatorConfirmed === null).length,
    confirmed: detections.filter(d => d.operatorConfirmed === true).length,
    rejected: detections.filter(d => d.operatorConfirmed === false).length,
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Defect Review</h1>
        <p className="text-gray-600 mt-1">Review and confirm detected defects</p>
      </div>

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
            <Button variant="outline" size="sm">
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
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={filter === 'confirmed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('confirmed')}
              >
                Confirmed
              </Button>
              <Button
                variant={filter === 'rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('rejected')}
              >
                Rejected
              </Button>
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Detection ID</TableHead>
                  <TableHead>Defect Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Removal</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetections.slice(0, 20).map((detection) => (
                  <TableRow key={detection.id}>
                    <TableCell className="font-mono text-sm">{detection.id}</TableCell>
                    <TableCell>{detection.defectType}</TableCell>
                    <TableCell>
                      <Badge variant={detection.confidence > 0.9 ? 'default' : 'secondary'}>
                        {(detection.confidence * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {detection.timestamp.toLocaleString()}
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
                      <Badge variant={detection.removalStatus === 'simulated' ? 'default' : 'outline'}>
                        {detection.removalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(detection.id)}
                          disabled={detection.operatorConfirmed === true}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(detection.id)}
                          disabled={detection.operatorConfirmed === false}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkForRemoval(detection.id)}
                          disabled={detection.removalStatus === 'simulated'}
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
