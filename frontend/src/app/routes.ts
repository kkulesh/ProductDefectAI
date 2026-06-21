import { createBrowserRouter } from "react-router";
import { MainLayout } from "../components/MainLayout";
import { Dashboard } from "../pages/Dashboard";
import { DetectionMonitoring } from "../pages/DetectionMonitoring";
import { DefectReview } from "../pages/DefectReview";
import { VirtualRejection } from "../pages/VirtualRejection";
import { ReportsAnalytics } from "../pages/ReportsAnalytics";
import { Settings } from "../pages/Settings";
import { HistoricalArchive } from "../pages/HistoricalArchive";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "monitoring", Component: DetectionMonitoring },
      { path: "review", Component: DefectReview },
      { path: "rejection", Component: VirtualRejection },
      { path: "reports", Component: ReportsAnalytics },
      { path: "settings", Component: Settings },
      { path: "archive", Component: HistoricalArchive },
    ],
  },
]);
