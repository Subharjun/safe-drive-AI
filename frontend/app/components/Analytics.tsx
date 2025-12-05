"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { dataManager } from "../lib/dataManager";

interface AnalyticsData {
  _id: string;
  avg_drowsiness: number;
  avg_stress: number;
  session_count: number;
}

interface ChartDataPoint {
  date: string;
  drowsiness: string;
  stress: string;
  sessions: number;
}

interface RiskDistributionItem {
  name: string;
  value: number;
  color: string;
}

interface AnalyticsProps {
  onNavigateToMonitor?: () => void;
}

export default function Analytics({ onNavigateToMonitor }: AnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      console.log("🔍 Fetching real analytics data...");

      // First try to get data from backend API
      const response = await fetch("/api/analytics");
      if (response.ok) {
        const data = await response.json();
        const realData = data.analytics || [];
        console.log(
          `✅ Found ${realData.length} real analytics records from backend`
        );
        setAnalyticsData(realData);
      } else {
        console.log("⚠️ Backend API not available, checking local data...");
        // Only use local data if it exists and is recent
        const localData = dataManager.getWellnessHistory();
        if (localData.length > 0) {
          console.log(
            `📊 Processing ${localData.length} local wellness records`
          );
          const processedData = processLocalWellnessData(localData);
          setAnalyticsData(processedData);
        } else {
          console.log("❌ No local wellness data available");
          setAnalyticsData([]);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching analytics:", error);
      // Only show local data if available
      const localData = dataManager.getWellnessHistory();
      if (localData.length > 0) {
        const processedData = processLocalWellnessData(localData);
        setAnalyticsData(processedData);
      } else {
        setAnalyticsData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const processLocalWellnessData = (localData: any[]) => {
    // Group data by date and calculate averages
    const groupedByDate: { [key: string]: any[] } = {};

    localData.forEach((item) => {
      const date = new Date(item.timestamp).toISOString().split("T")[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(item);
    });

    return Object.entries(groupedByDate)
      .map(([date, items]) => ({
        _id: date,
        avg_drowsiness:
          items.reduce((sum, item) => sum + item.drowsiness, 0) / items.length,
        avg_stress:
          items.reduce((sum, item) => sum + item.stress, 0) / items.length,
        session_count: items.length,
      }))
      .sort((a, b) => new Date(a._id).getTime() - new Date(b._id).getTime());
  };

  const chartData: ChartDataPoint[] = analyticsData.map(
    (item: AnalyticsData) => ({
      date: new Date(item._id).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      drowsiness: (item.avg_drowsiness * 100).toFixed(1),
      stress: (item.avg_stress * 100).toFixed(1),
      sessions: item.session_count,
    })
  );

  const getOverallStats = () => {
    if (analyticsData.length === 0)
      return { avgDrowsiness: 0, avgStress: 0, totalSessions: 0, riskDays: 0 };

    const avgDrowsiness =
      analyticsData.reduce(
        (sum: number, item: AnalyticsData) => sum + item.avg_drowsiness,
        0
      ) / analyticsData.length;
    const avgStress =
      analyticsData.reduce(
        (sum: number, item: AnalyticsData) => sum + item.avg_stress,
        0
      ) / analyticsData.length;
    const totalSessions = analyticsData.reduce(
      (sum: number, item: AnalyticsData) => sum + item.session_count,
      0
    );
    const riskDays = analyticsData.filter(
      (item: AnalyticsData) =>
        item.avg_drowsiness > 0.4 || item.avg_stress > 0.5
    ).length;

    return { avgDrowsiness, avgStress, totalSessions, riskDays };
  };

  const stats = getOverallStats();

  const riskDistribution: RiskDistributionItem[] = [
    {
      name: "Low Risk",
      value: analyticsData.filter(
        (item: AnalyticsData) =>
          item.avg_drowsiness < 0.3 && item.avg_stress < 0.4
      ).length,
      color: "#22c55e",
    },
    {
      name: "Medium Risk",
      value: analyticsData.filter(
        (item: AnalyticsData) =>
          (item.avg_drowsiness >= 0.3 && item.avg_drowsiness < 0.6) ||
          (item.avg_stress >= 0.4 && item.avg_stress < 0.7)
      ).length,
      color: "#f59e0b",
    },
    {
      name: "High Risk",
      value: analyticsData.filter(
        (item: AnalyticsData) =>
          item.avg_drowsiness >= 0.6 || item.avg_stress >= 0.7
      ).length,
      color: "#ef4444",
    },
  ];

  const getScoreColor = (score: number) => {
    if (score < 30) return "text-success-600";
    if (score < 60) return "text-warning-600";
    return "text-danger-600";
  };

  const getScoreBg = (score: number) => {
    if (score < 30) return "bg-success-50";
    if (score < 60) return "bg-warning-50";
    return "bg-danger-50";
  };

  return (
    <div className="space-y-6">
      {/* No Data State */}
      {!loading && analyticsData.length === 0 && (
        <div className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Analytics Data Available
            </h3>
            <p className="text-gray-600 mb-4">
              Start using Live Monitor to generate wellness analytics
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  if (onNavigateToMonitor) {
                    onNavigateToMonitor();
                  } else {
                    // Fallback to custom event
                    const event = new CustomEvent("switchTab", {
                      detail: "monitor",
                    });
                    window.dispatchEvent(event);
                  }
                }}
                className="btn-primary"
              >
                Start Live Monitoring
              </button>

              <button
                onClick={async () => {
                  if (confirm("Clear any residual analytics data?")) {
                    try {
                      dataManager.clearData("wellnessHistory");
                      await dataManager.clearAllMongoData();
                      alert("All analytics data cleared!");
                    } catch (error) {
                      console.error("Error clearing data:", error);
                      alert("Error clearing data. Check console for details.");
                    }
                  }
                }}
                className="btn-secondary"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Range Selector - Only show when data exists */}
      {analyticsData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="mr-2">📈</span>
              Driver Wellness Analytics ({analyticsData.length} sessions)
            </h3>

            <div className="flex space-x-2">
              {[
                { value: "7d", label: "7 Days" },
                { value: "30d", label: "30 Days" },
                { value: "90d", label: "90 Days" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === option.value
                      ? "bg-primary-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overview Stats - Only show when data exists */}
      {analyticsData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div
            className={`card text-center ${getScoreBg(
              stats.avgDrowsiness * 100
            )}`}
          >
            <div
              className={`text-3xl font-bold ${getScoreColor(
                stats.avgDrowsiness * 100
              )}`}
            >
              {(stats.avgDrowsiness * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Avg Drowsiness</div>
            <div className="text-xs text-gray-500 mt-2">
              {stats.avgDrowsiness < 0.3
                ? "Excellent"
                : stats.avgDrowsiness < 0.6
                ? "Good"
                : "Needs Attention"}
            </div>
          </div>

          <div
            className={`card text-center ${getScoreBg(stats.avgStress * 100)}`}
          >
            <div
              className={`text-3xl font-bold ${getScoreColor(
                stats.avgStress * 100
              )}`}
            >
              {(stats.avgStress * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Avg Stress</div>
            <div className="text-xs text-gray-500 mt-2">
              {stats.avgStress < 0.3
                ? "Very Calm"
                : stats.avgStress < 0.6
                ? "Moderate"
                : "High Stress"}
            </div>
          </div>

          <div className="card text-center bg-blue-50">
            <div className="text-3xl font-bold text-blue-600">
              {stats.totalSessions}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Sessions</div>
            <div className="text-xs text-gray-500 mt-2">
              {stats.totalSessions > 20
                ? "Very Active"
                : stats.totalSessions > 10
                ? "Active"
                : "Getting Started"}
            </div>
          </div>

          <div className="card text-center bg-purple-50">
            <div className="text-3xl font-bold text-purple-600">
              {stats.riskDays}
            </div>
            <div className="text-sm text-gray-600 mt-1">High Risk Days</div>
            <div className="text-xs text-gray-500 mt-2">
              {stats.riskDays === 0
                ? "Perfect!"
                : stats.riskDays < 3
                ? "Good"
                : "Monitor Closely"}
            </div>
          </div>
        </div>
      )}

      {/* Trends Chart - Only show when data exists */}
      {analyticsData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Wellness Trends
            </h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      `${value}%`,
                      name === "drowsiness" ? "Drowsiness" : "Stress",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="drowsiness"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="drowsiness"
                  />
                  <Line
                    type="monotone"
                    dataKey="stress"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="stress"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Session Activity
            </h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => [`${value}`, "Sessions"]}
                  />
                  <Bar dataKey="sessions" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Risk Distribution and Insights - Only show when data exists */}
      {analyticsData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Risk Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }: any) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AI Insights
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  🎯 Performance Summary
                </h4>
                <p className="text-sm text-blue-800">
                  Your average wellness score is{" "}
                  {(
                    (1 - (stats.avgDrowsiness + stats.avgStress) / 2) *
                    100
                  ).toFixed(0)}
                  %.
                  {stats.avgDrowsiness < 0.3 && stats.avgStress < 0.4
                    ? " Excellent driving wellness maintained!"
                    : " Consider implementing more regular breaks."}
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">
                  📊 Trend Analysis
                </h4>
                <p className="text-sm text-green-800">
                  {analyticsData.length > 1 &&
                  analyticsData[analyticsData.length - 1].avg_drowsiness <
                    analyticsData[0].avg_drowsiness
                    ? "Your drowsiness levels are improving over time."
                    : "Monitor your sleep schedule to reduce drowsiness levels."}
                </p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">
                  💡 Recommendations
                </h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>
                    •{" "}
                    {stats.riskDays > 2
                      ? "Consider adjusting your driving schedule"
                      : "Maintain current safety practices"}
                  </li>
                  <li>
                    •{" "}
                    {stats.avgStress > 0.5
                      ? "Practice stress management techniques"
                      : "Continue stress management efforts"}
                  </li>
                  <li>
                    •{" "}
                    {stats.totalSessions < 10
                      ? "Use the system more regularly for better insights"
                      : "Great job staying consistent!"}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Management Actions - Only show when data exists */}
      {analyticsData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">⚙️</span>
            Data Management
          </h3>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                if (
                  confirm(
                    "Are you sure you want to clear all local analytics data? This cannot be undone."
                  )
                ) {
                  dataManager.clearData("wellnessHistory");
                  setAnalyticsData([]);
                  alert("Local analytics data cleared successfully!");
                }
              }}
              className="btn-secondary text-sm"
            >
              Clear Local Data
            </button>

            <button
              onClick={async () => {
                if (
                  confirm(
                    "Are you sure you want to clear ALL session data (local + MongoDB)? This cannot be undone."
                  )
                ) {
                  try {
                    // Clear local storage
                    dataManager.clearAllData();

                    // Clear MongoDB data
                    const mongoCleared = await dataManager.clearAllMongoData();

                    if (mongoCleared) {
                      setAnalyticsData([]);
                      alert(
                        "All session data cleared successfully (local + MongoDB)!"
                      );
                    } else {
                      alert(
                        "Local data cleared. MongoDB clearing failed - check backend connection."
                      );
                    }
                  } catch (error) {
                    console.error("Error clearing data:", error);
                    alert("Error clearing data. Check console for details.");
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded font-medium transition-colors"
            >
              Clear All Sessions
            </button>

            <button
              onClick={() => {
                const dataStr = dataManager.exportData();
                const dataBlob = new Blob([dataStr], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `analytics-data-${
                  new Date().toISOString().split("T")[0]
                }.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              className="btn-secondary text-sm"
            >
              Export Analytics Data
            </button>

            <button
              onClick={() => {
                fetchAnalytics();
              }}
              className="btn-primary text-sm"
            >
              Refresh Data
            </button>
          </div>
        </div>
      )}

      {/* Detailed Data Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detailed Session Data
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Drowsiness
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Stress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chartData.map((row: ChartDataPoint, index: number) => {
                const riskLevel = Math.max(
                  parseFloat(row.drowsiness),
                  parseFloat(row.stress)
                );
                const riskLabel =
                  riskLevel > 60 ? "High" : riskLevel > 30 ? "Medium" : "Low";
                const riskColor =
                  riskLevel > 60
                    ? "status-danger"
                    : riskLevel > 30
                    ? "status-warning"
                    : "status-safe";

                return (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.sessions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.drowsiness}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.stress}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-indicator ${riskColor}`}>
                        {riskLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
