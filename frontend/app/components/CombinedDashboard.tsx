"use client";

import UnifiedWellnessDashboard from "./UnifiedWellnessDashboard";

interface MonitoringData {
  drowsiness: number;
  stress: number;
  isActive: boolean;
  lastUpdate: Date | null;
}

interface CombinedDashboardProps {
  data: MonitoringData;
  onNavigateToMonitor?: () => void;
}

export default function CombinedDashboard({
  data,
  onNavigateToMonitor,
}: CombinedDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Combined Dashboard Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">📊</span>
              Wellness & Analytics Dashboard
            </h2>
            <p className="text-gray-600 mt-1">
              Real-time monitoring, AI recommendations, and performance
              analytics
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div
              className={`status-indicator ${
                data.isActive ? "status-safe" : "bg-gray-100 text-gray-600"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  data.isActive ? "bg-success-500 animate-pulse" : "bg-gray-400"
                }`}
              ></div>
              {data.isActive ? "Live Monitoring Active" : "Monitoring Inactive"}
            </div>

            {!data.isActive && (
              <button
                onClick={() => {
                  if (onNavigateToMonitor) {
                    onNavigateToMonitor();
                  }
                }}
                className="btn-primary text-sm"
              >
                Start Live Monitor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unified Wellness & Analytics Content */}
      <UnifiedWellnessDashboard
        data={data}
        onNavigateToMonitor={onNavigateToMonitor}
      />

      {/* Quick Stats Bar - Always Visible */}
      {data.isActive && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((1 - data.drowsiness) * 100)}%
              </div>
              <div className="text-sm text-gray-600">Alertness</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round((1 - data.stress) * 100)}%
              </div>
              <div className="text-sm text-gray-600">Calmness</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((1 - (data.drowsiness + data.stress) / 2) * 100)}
              </div>
              <div className="text-sm text-gray-600">Overall Score</div>
            </div>

            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  data.drowsiness > 0.6 || data.stress > 0.7
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {data.drowsiness > 0.6 || data.stress > 0.7 ? "⚠" : "✓"}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
