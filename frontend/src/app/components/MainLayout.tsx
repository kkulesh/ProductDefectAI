import { Outlet, Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Video,
  ClipboardList,
  Trash2,
  BarChart3,
  Settings,
  Archive,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { cn } from "../lib/utils";

export function MainLayout() {
  const location = useLocation();

  const navigation = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Detection Monitoring", path: "/monitoring", icon: Video },
    { name: "Defect Review", path: "/review", icon: ClipboardList },
    { name: "Virtual Rejection", path: "/rejection", icon: Trash2 },
    { name: "Reports & Analytics", path: "/reports", icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="font-bold text-xl text-gray-900">Defect Detection</h1>
          <p className="text-sm text-gray-500">Intelligent Quality Control</p>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* System Status */}
        <div className="absolute bottom-0 left-0 right-0 w-64 p-4 bg-white border-t border-gray-200">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Camera Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Model Running</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Backend Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
