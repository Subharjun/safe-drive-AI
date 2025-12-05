"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { dataManager } from "../lib/dataManager";

interface SessionData {
  date: string;
  drowsiness: number;
  stress: number;
  duration: number;
  safetyScore: number;
}

interface Statistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  trend: "improving" | "declining" | "stable";
}

export default function AdvancedAnalytics() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const [stats, setStats] = useState<{
    drowsiness: Statistics;
    stress: Statistics;
    safety: Statistics;
  } | null>(null);

  useEffect(() => {
    fetchAndProcessData();
  }, [timeRange]);

  const fetchAndProcessData = async () => {
    setLoading(true);
    try {
      // Fetch from backend or local storage
      const response = await fetch(`/api/analytics?days=${timeRange}`);
      let data: SessionData[] = [];

      if (response.ok) {
        const result = await response.json();
        data = result.sessions || [];
      } else {
        // Fetch from MongoDB
        const localData = await dataManager.getWellnessHistory();
        data = processLocalData(localData);
      }

      setSessions(data);
      calculateStatistics(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      try {
        const localData = await dataManager.getWellnessHistory();
        const processed = processLocalData(localData);
        setSessions(processed);
        calculateStatistics(processed);
      } catch (e) {
        console.error("MongoDB fallback failed:", e);
        setSessions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const processLocalData = (localData: any[]): SessionData[] => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    return localData
      .filter((item) => new Date(item.timestamp) >= cutoffDate)
      .map((item) => ({
        date: new Date(item.timestamp).toLocaleDateString(),
        drowsiness: item.drowsiness || 0,
        stress: item.stress || 0,
        duration: Math.random() * 60 + 10, // Mock duration
        safetyScore: calculateSafetyScore(item.drowsiness, item.stress),
      }));
  };

  const calculateSafetyScore = (drowsiness: number, stress: number): number => {
    return Math.max(0, 100 - (drowsiness * 30 + stress * 25));
  };

  const calculateStatistics = (data: SessionData[]) => {
    if (data.length === 0) {
      setStats(null);
      return;
    }

    const drowsinessValues = data.map((d) => d.drowsiness);
    const stressValues = data.map((d) => d.stress);
    const safetyValues = data.map((d) => d.safetyScore);

    setStats({
      drowsiness: getStatistics(drowsinessValues),
      stress: getStatistics(stressValues),
      safety: getStatistics(safetyValues),
    });
  };

  const getStatistics = (values: number[]): Statistics => {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate trend (simple linear regression)
    const n = values.length;
    const xMean = (n - 1) / 2;
    const slope =
      values.reduce((sum, val, i) => sum + (i - xMean) * (val - mean), 0) /
      values.reduce((sum, _, i) => sum + Math.pow(i - xMean, 2), 0);

    const trend =
      Math.abs(slope) < 0.1 ? "stable" : slope < 0 ? "improving" : "declining";

    return {
      mean: parseFloat(mean.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      min: Math.min(...values),
      max: Math.max(...values),
      trend,
    };
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return "📈";
      case "declining":
        return "📉";
      default:
        return "➡️";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "text-green-600";
      case "declining":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // Prepare radar chart data
  const radarData = stats
    ? [
        {
          metric: "Safety",
          value: stats.safety.mean,
          fullMark: 100,
        },
        {
          metric: "Alertness",
          value: 100 - stats.drowsiness.mean,
          fullMark: 100,
        },
        {
          metric: "Calmness",
          value: 100 - stats.stress.mean,
          fullMark: 100,
        },
        {
          metric: "Consistency",
          value: Math.max(0, 100 - stats.drowsiness.stdDev * 10),
          fullMark: 100,
        },
        {
          metric: "Performance",
          value: (stats.safety.mean + (100 - stats.drowsiness.mean)) / 2,
          fullMark: 100,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading advanced analytics...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No Analytics Data Available
        </h3>
        <p className="text-gray-600">
          Start using Live Monitor to generate wellness analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          📊 Advanced Analytics
        </h2>
        <div className="flex space-x-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeRange === days
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      {/* Statistical Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Drowsiness Stats */}
          <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">😴</span>
              Drowsiness Analysis
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Average:</span>
                <span className="font-bold">{stats.drowsiness.mean}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Median:</span>
                <span className="font-semibold">{stats.drowsiness.median}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Std Dev:</span>
                <span className="font-semibold">±{stats.drowsiness.stdDev}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Range:</span>
                <span className="font-semibold">
                  {stats.drowsiness.min}% - {stats.drowsiness.max}%
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-gray-600">Trend:</span>
                <span className={`font-bold ${getTrendColor(stats.drowsiness.trend)}`}>
                  {getTrendIcon(stats.drowsiness.trend)} {stats.drowsiness.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Stress Stats */}
          <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-yellow-500">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">😰</span>
              Stress Analysis
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Average:</span>
                <span className="font-bold">{stats.stress.mean}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Median:</span>
                <span className="font-semibold">{stats.stress.median}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Std Dev:</span>
                <span className="font-semibold">±{stats.stress.stdDev}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Range:</span>
                <span className="font-semibold">
                  {stats.stress.min}% - {stats.stress.max}%
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-gray-600">Trend:</span>
                <span className={`font-bold ${getTrendColor(stats.stress.trend)}`}>
                  {getTrendIcon(stats.stress.trend)} {stats.stress.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Safety Score Stats */}
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">🛡️</span>
              Safety Score
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Average:</span>
                <span className="font-bold">{stats.safety.mean}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Median:</span>
                <span className="font-semibold">{stats.safety.median}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Std Dev:</span>
                <span className="font-semibold">±{stats.safety.stdDev}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Range:</span>
                <span className="font-semibold">
                  {stats.safety.min} - {stats.safety.max}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-gray-600">Trend:</span>
                <span className={`font-bold ${getTrendColor(stats.safety.trend)}`}>
                  {getTrendIcon(stats.safety.trend)} {stats.safety.trend}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trend Line Chart */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          📈 Wellness Trends Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={sessions}>
            <defs>
              <linearGradient id="colorDrowsiness" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="drowsiness"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorDrowsiness)"
              name="Drowsiness %"
            />
            <Area
              type="monotone"
              dataKey="stress"
              stroke="#f59e0b"
              fillOpacity={1}
              fill="url(#colorStress)"
              name="Stress %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Safety Score Bar Chart */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🛡️ Safety Score History
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sessions}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="safetyScore" fill="#10b981" name="Safety Score" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart - Performance Overview */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🎯 Performance Overview
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
            <PolarRadiusAxis domain={[0, 100]} />
            <Radar
              name="Performance"
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.6}
            />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Session Duration vs Safety Score Scatter */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          ⏱️ Session Duration vs Safety Score
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <ScatterChart>
            <CartesianGrid />
            <XAxis type="number" dataKey="duration" name="Duration (min)" />
            <YAxis type="number" dataKey="safetyScore" name="Safety Score" domain={[0, 100]} />
            <ZAxis range={[60, 400]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter name="Sessions" data={sessions} fill="#8b5cf6" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Key Insights */}
      <div className="card bg-gradient-to-r from-purple-50 to-pink-50">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          💡 Key Insights
        </h3>
        <div className="space-y-3">
          {stats && (
            <>
              <div className="flex items-start space-x-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="font-semibold text-gray-900">
                    Your average safety score is {stats.safety.mean}/100
                  </p>
                  <p className="text-sm text-gray-600">
                    {stats.safety.mean >= 80
                      ? "Excellent! You're maintaining safe driving habits."
                      : stats.safety.mean >= 60
                      ? "Good, but there's room for improvement."
                      : "Consider taking more breaks and monitoring your wellness."}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="font-semibold text-gray-900">
                    Consistency Score: {(100 - stats.drowsiness.stdDev * 10).toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    {stats.drowsiness.stdDev < 5
                      ? "Very consistent performance across sessions."
                      : "Your performance varies. Try to maintain regular sleep patterns."}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-2xl">🔮</span>
                <div>
                  <p className="font-semibold text-gray-900">
                    Trend Prediction: {stats.safety.trend}
                  </p>
                  <p className="text-sm text-gray-600">
                    {stats.safety.trend === "improving"
                      ? "Keep up the great work! Your safety metrics are improving."
                      : stats.safety.trend === "declining"
                      ? "Consider adjusting your driving schedule and taking more breaks."
                      : "Your performance is stable. Maintain your current habits."}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
