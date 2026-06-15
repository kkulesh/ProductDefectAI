import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download, FileText } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type DailyStats = {
  date: string;
  totalInspected: number;
  defectsDetected: number;
  falsePositives: number;
};

type DefectTypeDistribution = {
  name: string;
  value: number;
  color: string;
};

type ConfidenceTrend = {
  date: string;
  avgConfidence: number;
};

export function ReportsAnalytics() {
  const API_BASE = "http://localhost:8000/api/v1";
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [defectTypeData, setDefectTypeData] = useState<DefectTypeDistribution[]>([]);
  const [confidenceTrends, setConfidenceTrends] = useState<ConfidenceTrend[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [dailyRes, defectRes, confidenceRes] = await Promise.all([
          fetch(`${API_BASE}/analytics/stats/daily?days=30`),
          fetch(`${API_BASE}/analytics/stats/defect-types`),
          fetch(`${API_BASE}/analytics/stats/confidence-trends?days=8`),
        ]);

        if (!dailyRes.ok || !defectRes.ok || !confidenceRes.ok) {
          throw new Error("Unable to fetch analytics data");
        }

        const daily = await dailyRes.json();
        const defectTypes = await defectRes.json();
        const confidence = await confidenceRes.json();

        setDailyStats(Array.isArray(daily) ? daily : []);
        setDefectTypeData(Array.isArray(defectTypes) ? defectTypes : []);
        setConfidenceTrends(Array.isArray(confidence) ? confidence : []);
      } catch (error) {
        console.error("Failed to load analytics data:", error);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive defect detection insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

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
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={defectTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {defectTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {defectTypeData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700">{item.name}</span>
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confidenceTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis domain={[80, 100]} />
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
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                {dailyStats.reduce((sum, d) => sum + d.totalInspected, 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Defects</div>
              <div className="text-2xl font-bold text-red-600">
                {dailyStats.reduce((sum, d) => sum + d.defectsDetected, 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Average Defect Rate</div>
              <div className="text-2xl font-bold text-orange-600">
                {(
                  (dailyStats.reduce((sum, d) => sum + d.defectsDetected, 0) /
                    dailyStats.reduce((sum, d) => sum + d.totalInspected, 0)) * 100
                ).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">False Positive Rate</div>
              <div className="text-2xl font-bold text-yellow-600">
                {(
                  (dailyStats.reduce((sum, d) => sum + d.falsePositives, 0) /
                    dailyStats.reduce((sum, d) => sum + d.defectsDetected, 0)) * 100
                ).toFixed(2)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
