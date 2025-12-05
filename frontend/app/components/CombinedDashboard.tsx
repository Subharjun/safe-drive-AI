"use client";

import { useState } from "react";
import WellnessMetrics from "./WellnessMetrics";
import SafetyAlerts from "./SafetyAlerts";
import Analytics from "./Analytics";
import BlockchainDashboard from "./BlockchainDashboard";

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
  const [activeSection, setActiveSection] = useState<
    "wellness" | "alerts" | "analytics" | "blockchain"
  >("wellness");

  return (
    <div className="space-y-6">
      {/* Combined Dashboard Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">📊</span>
              Driver Wellness Dashboard
            </h2>
            <p className="text-gray-600 mt-1">
              Real-time monitoring, safety alerts, and analytics in one view
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

        {/* Section Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveSection("wellness")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeSection === "wellness"
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="mr-2">💪</span>
            Wellness Metrics
          </button>
          <button
            onClick={() => setActiveSection("alerts")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeSection === "alerts"
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="mr-2">🚨</span>
            Safety Alerts
          </button>
          <button
            onClick={() => setActiveSection("analytics")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeSection === "analytics"
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="mr-2">📈</span>
            Analytics
          </button>
          <button
            onClick={() => setActiveSection("blockchain")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeSection === "blockchain"
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="mr-2">🔗</span>
            Blockchain
          </button>
        </div>
      </div>

      {/* Dynamic Content Based on Active Section */}
      <div className="transition-all duration-300">
        {activeSection === "wellness" && (
          <WellnessMetrics
            data={{
              ...data,
              lastUpdate: data.lastUpdate
                ? data.lastUpdate.toISOString()
                : null,
            }}
            onNavigateToMonitor={onNavigateToMonitor}
          />
        )}

        {activeSection === "alerts" && <SafetyAlerts data={data} />}

        {activeSection === "analytics" && (
          <Analytics onNavigateToMonitor={onNavigateToMonitor} />
        )}

        {activeSection === "blockchain" && (
          <BlockchainDashboard
            currentSafetyMetrics={data.isActive ? {
              drowsinessLevel: data.drowsiness,
              stressLevel: data.stress,
              interventionCount: Math.floor(Math.random() * 5), // Mock data
              routeCompliance: Math.floor(Math.random() * 20) + 80, // Mock 80-100%
              drivingDuration: Math.floor(Math.random() * 7200) + 1800 // Mock 30min-2hr
            } : undefined}
          />
        )}
      </div>

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
                {data.drowsiness > 0.6 || data.stress > 0.7 ? "⚠️" : "✅"}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
