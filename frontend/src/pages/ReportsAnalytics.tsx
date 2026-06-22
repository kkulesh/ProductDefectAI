import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Curve,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  reportsApi,
  detectionsApi,
  type DailyStats,
  type DefectDistributionItem,
  type ConfidenceTrendPoint,
} from "../lib/api";

export function ReportsAnalytics() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [distribution, setDistribution] = useState<DefectDistributionItem[]>([]);
  const [confidenceTrends, setConfidenceTrends] = useState<ConfidenceTrendPoint[]>([]);
  const [summary, setSummary] = useState({
    totalInspected: 0,
    totalDefects: 0,
    avgDefectRate: 0,
    falsePositiveRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [daily, dist, trends, summ] = await Promise.all([
          reportsApi.dailyStats(30),
          reportsApi.defectDistribution(),
          reportsApi.confidenceTrends(8),
          reportsApi.summary(30),
        ]);
        if (cancelled) return;
        setDailyStats(daily);
        setDistribution(dist);
        setConfidenceTrends(trends);
        setSummary(summ);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExportCsv = () => {
    window.open(detectionsApi.exportCsvUrl(), "_blank");
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading reports...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive defect detection insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Daily Defect Count */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Defect Count (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="defectsDetected"
                stroke="#ef4444"
                name="Defects Detected"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="falsePositives"
                stroke="#f59e0b"
                name="False Positives"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Defect Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Defect Type Distribution</CardTitle>
            <p className="text-sm text-gray-500">
              All classes your model detects, including non-defect/passing classes (e.g. "good ___")
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    labelLine={(props: any) =>
                      (props.percent ?? 0) * 100 < 2
                        ? <></>
                        : <Curve {...props} type="linear" className="recharts-pie-label-line" />
                    }
                    label={({ percent }) =>
                      (percent ?? 0) * 100 < 2 ? "" : `${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {distribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-gray-700">{item.name}</span>
                    {!item.isDefect && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">pass</span>
                    )}
                  </div>
                  <span className="text-gray-900 font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Confidence Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Confidence Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {confidenceTrends.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                Not enough detection history yet to chart confidence trends
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={confidenceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgConfidence"
                    stroke="#10b981"
                    name="Avg Confidence %"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products Inspected Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Products Inspected vs Defects Detected</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyStats.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalInspected" fill="#3b82f6" name="Total Inspected" />
              <Bar dataKey="defectsDetected" fill="#ef4444" name="Defects Detected" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>30-Day Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600">Total Inspected</div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.totalInspected.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Defects</div>
              <div className="text-2xl font-bold text-red-600">
                {summary.totalDefects.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Average Defect Rate</div>
              <div className="text-2xl font-bold text-orange-600">
                {summary.avgDefectRate.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">False Positive Rate</div>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.falsePositiveRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
