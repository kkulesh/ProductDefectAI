import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import {
  settingsApi,
  modelsApi,
  type DetectionSettings,
  type NotificationSettings,
  type SystemSettings,
} from "../lib/api";

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [detection, setDetection] = useState<DetectionSettings>({
    confidenceThreshold: 75,
    overlapThreshold: 50,
    overlayOpacity: 70,
    modelSelection: "yolov8-large",
    inputSource: "camera-1",
    resolution: "1080p",
    processingInterval: "realtime",
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    alertsEnabled: true,
    confidenceWarnings: true,
    soundEnabled: false,
    alertFrequency: "immediate",
    emailNotifications: "critical",
  });

  const [system, setSystem] = useState<SystemSettings>({
    databaseRetention: "30days",
    autoExportReports: "weekly",
    backupFrequency: "daily",
  });

  const [modelInfo, setModelInfo] = useState<{ currentModel: string; usingCustomModel: boolean } | null>(null);
  const [savingDetection, setSavingDetection] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, models] = await Promise.all([settingsApi.get(), modelsApi.list()]);
        if (cancelled) return;
        setDetection(s.detection);
        setNotifications(s.notifications);
        setSystem(s.system);
        setModelInfo({ currentModel: models.currentModel, usingCustomModel: models.usingCustomModel });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const flashSaved = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 2500);
  };

  const saveDetectionSettings = async () => {
    setSavingDetection(true);
    setError(null);
    try {
      const updated = await settingsApi.updateDetection(detection);
      setDetection(updated.detection);
      flashSaved("Detection settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save detection settings");
    } finally {
      setSavingDetection(false);
    }
  };

  const saveNotificationSettings = async () => {
    setSavingNotifications(true);
    setError(null);
    try {
      const updated = await settingsApi.updateNotifications(notifications);
      setNotifications(updated.notifications);
      flashSaved("Notification settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notification settings");
    } finally {
      setSavingNotifications(false);
    }
  };

  const saveSystemSettings = async (next: SystemSettings) => {
    setSystem(next);
    try {
      await settingsApi.updateSystem(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save system settings");
    }
  };

  const checkForUpdates = async () => {
    try {
      const models = await modelsApi.list();
      setModelInfo({ currentModel: models.currentModel, usingCustomModel: models.usingCustomModel });
      flashSaved(
        models.usingCustomModel
          ? `Using trained model: ${models.currentModel}`
          : "No custom-trained model found yet — run scripts/train.py"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check for model updates");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure detection parameters and notifications</p>
        </div>
        {savedMessage && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {savedMessage}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Settings</CardTitle>
            <CardDescription>Configure YOLO model and detection parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Confidence Threshold: {detection.confidenceThreshold}%</Label>
              <Slider
                value={[detection.confidenceThreshold]}
                onValueChange={([v]) => setDetection((d) => ({ ...d, confidenceThreshold: v }))}
                min={50}
                max={99}
                step={1}
              />
              <p className="text-sm text-gray-500">
                Minimum confidence level for defect detection
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Model Selection</Label>
              <Select
                value={detection.modelSelection}
                onValueChange={(v) => setDetection((d) => ({ ...d, modelSelection: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yolov8-small">YOLOv8 Small (Fast)</SelectItem>
                  <SelectItem value="yolov8-medium">YOLOv8 Medium</SelectItem>
                  <SelectItem value="yolov8-large">YOLOv8 Large (Accurate)</SelectItem>
                  <SelectItem value="yolov9">YOLOv9 (Experimental)</SelectItem>
                </SelectContent>
              </Select>
              {modelInfo && (
                <p className="text-xs text-gray-500">
                  Active backend model: <span className="font-mono">{modelInfo.currentModel}</span>{" "}
                  {modelInfo.usingCustomModel ? "(your trained weights)" : "(stock/fallback — train your own with scripts/train.py)"}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Input Source</Label>
              <Select
                value={detection.inputSource}
                onValueChange={(v) => setDetection((d) => ({ ...d, inputSource: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera-1">Camera 1 (Primary)</SelectItem>
                  <SelectItem value="camera-2">Camera 2 (Backup)</SelectItem>
                  <SelectItem value="camera-3">Camera 3 (Side View)</SelectItem>
                  <SelectItem value="video-file">Video File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Image Resolution</Label>
              <Select
                value={detection.resolution}
                onValueChange={(v) => setDetection((d) => ({ ...d, resolution: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">1280x720 (720p)</SelectItem>
                  <SelectItem value="1080p">1920x1080 (1080p)</SelectItem>
                  <SelectItem value="4k">3840x2160 (4K)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Processing Interval</Label>
              <Select
                value={detection.processingInterval}
                onValueChange={(v) => setDetection((d) => ({ ...d, processingInterval: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time (30 FPS)</SelectItem>
                  <SelectItem value="high">High (20 FPS)</SelectItem>
                  <SelectItem value="medium">Medium (10 FPS)</SelectItem>
                  <SelectItem value="low">Low (5 FPS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={saveDetectionSettings} disabled={savingDetection}>
              {savingDetection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Detection Settings
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>Configure alerts and warnings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Alerts</Label>
                <p className="text-sm text-gray-500">Receive system notifications</p>
              </div>
              <Switch
                checked={notifications.alertsEnabled}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, alertsEnabled: v }))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Low Confidence Warnings</Label>
                <p className="text-sm text-gray-500">Alert when confidence is below threshold</p>
              </div>
              <Switch
                checked={notifications.confidenceWarnings}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, confidenceWarnings: v }))}
                disabled={!notifications.alertsEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sound Alerts</Label>
                <p className="text-sm text-gray-500">Play sound on defect detection</p>
              </div>
              <Switch
                checked={notifications.soundEnabled}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, soundEnabled: v }))}
                disabled={!notifications.alertsEnabled}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Alert Frequency</Label>
              <Select
                value={notifications.alertFrequency}
                onValueChange={(v) => setNotifications((n) => ({ ...n, alertFrequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="batched-5min">Batched (Every 5 min)</SelectItem>
                  <SelectItem value="batched-15min">Batched (Every 15 min)</SelectItem>
                  <SelectItem value="hourly">Hourly Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Email Notifications</Label>
              <Select
                value={notifications.emailNotifications}
                onValueChange={(v) => setNotifications((n) => ({ ...n, emailNotifications: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Detections</SelectItem>
                  <SelectItem value="high-confidence">High Confidence Only</SelectItem>
                  <SelectItem value="critical">Critical Issues Only</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={saveNotificationSettings} disabled={savingNotifications}>
              {savingNotifications ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Notification Settings
            </Button>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
            <CardDescription>Advanced system settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label>Database Retention</Label>
                <Select
                  value={system.databaseRetention}
                  onValueChange={(v) => saveSystemSettings({ ...system, databaseRetention: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">7 Days</SelectItem>
                    <SelectItem value="30days">30 Days</SelectItem>
                    <SelectItem value="90days">90 Days</SelectItem>
                    <SelectItem value="1year">1 Year</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Auto-Export Reports</Label>
                <Select
                  value={system.autoExportReports}
                  onValueChange={(v) => saveSystemSettings({ ...system, autoExportReports: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Backup Frequency</Label>
                <Select
                  value={system.backupFrequency}
                  onValueChange={(v) => saveSystemSettings({ ...system, backupFrequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">System Information</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Backend: FastAPI | Detection: Ultralytics YOLOv8 | Storage: JSON file store (no database)
                  </p>
                </div>
                <Button variant="outline" onClick={checkForUpdates}>Check for Updates</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
