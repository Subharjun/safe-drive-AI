"use client";

import { useState, useEffect } from "react";
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
} from "recharts";
import { dataManager } from "../lib/dataManager";

interface MonitoringData {
  drowsiness: number;
  stress: number;
  isActive: boolean;
  lastUpdate: Date | null;
}

interface SessionData {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  avgDrowsiness: number;
  avgStress: number;
  safetyScore: number;
  dataPoints: number;
}

interface Props {
  data: MonitoringData;
  onNavigateToMonitor?: () => void;
}

export default function UnifiedWellnessDashboard({
  data,
  onNavigateToMonitor,
}: Props) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [improvement, setImprovement] = useState<number>(0);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    // Generate AI recommendations when sessions change or data updates
    generateAIRecommendations();
  }, [totalSessions, data.isActive]);

  useEffect(() => {
    // Save current session data when monitoring is active
    if (data.isActive && data.lastUpdate) {
      saveCurrentSession();
    }
  }, [data]);

  const loadSessions = async () => {
    try {
      // Get sessions directly from MongoDB (already grouped by backend)
      const sessionsData = await dataManager.getWellnessSessions();
      console.log(`📊 Loaded ${sessionsData.length} sessions from MongoDB`);

      // Convert backend format to component format
      const formattedSessions = sessionsData.map((s: any) => ({
        sessionId: s.session_id,
        date: new Date(s.start_time).toLocaleDateString(),
        startTime: new Date(s.start_time).toLocaleTimeString(),
        endTime: new Date(s.end_time).toLocaleTimeString(),
        duration: Math.round(s.duration),
        avgDrowsiness: Math.round(s.avg_drowsiness),
        avgStress: Math.round(s.avg_stress),
        safetyScore: Math.round(s.safety_score),
        dataPoints: s.data_points,
      }));

      setSessions(formattedSessions);
      setTotalSessions(formattedSessions.length);
      calculateImprovement(formattedSessions);
    } catch (error) {
      console.error("Error loading sessions:", error);
      setSessions([]);
      setTotalSessions(0);
    }
  };

  const clearAllData = async () => {
    if (
      confirm(
        "⚠️ Are you sure you want to delete all wellness data and sessions from MongoDB? This cannot be undone."
      )
    ) {
      const success = await dataManager.clearWellnessData();
      if (success) {
        setSessions([]);
        setTotalSessions(0);
        setImprovement(0);
        setAiRecommendations(
          "All data cleared from MongoDB. Start monitoring to build new session history."
        );
        console.log("🗑️ All wellness data cleared from MongoDB");
      } else {
        alert("Failed to clear data. Check console for errors.");
      }
    }
  };

  // No longer needed - MongoDB backend handles session grouping
  const groupIntoSessions = (history: any[]): SessionData[] => {
    if (history.length === 0) return [];

    const sessions: SessionData[] = [];
    let currentSession: any[] = [];
    let lastTimestamp: Date | null = null;

    history.forEach((item, index) => {
      const timestamp = new Date(item.timestamp);

      // New session if gap > 5 minutes
      if (
        lastTimestamp &&
        timestamp.getTime() - lastTimestamp.getTime() > 5 * 60 * 1000
      ) {
        if (currentSession.length > 0) {
          const sessionData = createSessionData(currentSession);
          console.log(
            `📊 Session ${sessions.length + 1}: ${
              currentSession.length
            } data points, ${sessionData.duration} min`
          );
          sessions.push(sessionData);
          currentSession = [];
        }
      }

      currentSession.push(item);
      lastTimestamp = timestamp;
    });

    // Add last session
    if (currentSession.length > 0) {
      const sessionData = createSessionData(currentSession);
      console.log(
        `📊 Session ${sessions.length + 1} (final): ${
          currentSession.length
        } data points, ${sessionData.duration} min`
      );
      sessions.push(sessionData);
    }

    console.log(`📊 Total sessions created: ${sessions.length}`);
    return sessions.reverse(); // Most recent first
  };

  const createSessionData = (sessionItems: any[]): SessionData => {
    const startTime = new Date(sessionItems[0].timestamp);
    const endTime = new Date(sessionItems[sessionItems.length - 1].timestamp);
    const duration = (endTime.getTime() - startTime.getTime()) / 1000 / 60; // minutes

    const avgDrowsiness =
      sessionItems.reduce((sum, item) => sum + (item.drowsiness || 0), 0) /
      sessionItems.length;
    const avgStress =
      sessionItems.reduce((sum, item) => sum + (item.stress || 0), 0) /
      sessionItems.length;
    const safetyScore = Math.max(
      0,
      100 - (avgDrowsiness * 30 + avgStress * 25)
    );

    return {
      sessionId: `session-${startTime.getTime()}`,
      date: startTime.toLocaleDateString(),
      startTime: startTime.toLocaleTimeString(),
      endTime: endTime.toLocaleTimeString(),
      duration: Math.round(duration),
      avgDrowsiness: Math.round(avgDrowsiness),
      avgStress: Math.round(avgStress),
      safetyScore: Math.round(safetyScore),
      dataPoints: sessionItems.length,
    };
  };

  const saveCurrentSession = () => {
    // This is called periodically to update session count
    loadSessions();
  };

  const calculateImprovement = (sessions: SessionData[]) => {
    if (sessions.length < 2) {
      setImprovement(0);
      return;
    }

    // Compare recent sessions (last 3) with older sessions (previous 3)
    const recentSessions = sessions.slice(0, Math.min(3, sessions.length));
    const olderSessions = sessions.slice(3, Math.min(6, sessions.length));

    if (olderSessions.length === 0) {
      setImprovement(0);
      return;
    }

    const recentAvg =
      recentSessions.reduce((sum, s) => sum + s.safetyScore, 0) /
      recentSessions.length;
    const olderAvg =
      olderSessions.reduce((sum, s) => sum + s.safetyScore, 0) /
      olderSessions.length;

    const improvementPercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    setImprovement(Math.round(improvementPercent));
  };

  const generateAIRecommendations = async () => {
    setLoadingAI(true);
    try {
      const history = await dataManager.getWellnessHistory();

      // Check if we have current live data or historical data
      const hasLiveData = data.isActive && data.lastUpdate;
      const hasHistoricalData = history.length > 0;

      if (!hasLiveData && !hasHistoricalData) {
        setAiRecommendations(
          "Start monitoring to receive personalized AI recommendations based on your driving patterns."
        );
        setLoadingAI(false);
        return;
      }

      // Calculate metrics from available data
      let avgDrowsiness = 0;
      let avgStress = 0;
      let dataPoints = 0;

      if (hasHistoricalData) {
        const recentData = history.slice(-50); // Last 50 data points for better analysis
        avgDrowsiness =
          recentData.reduce((sum, item) => sum + (item.drowsiness || 0), 0) /
          recentData.length;
        avgStress =
          recentData.reduce((sum, item) => sum + (item.stress || 0), 0) /
          recentData.length;
        dataPoints = recentData.length;
      }

      // If monitoring is active, include current data
      if (hasLiveData) {
        avgDrowsiness =
          (avgDrowsiness + data.drowsiness) / (hasHistoricalData ? 2 : 1);
        avgStress = (avgStress + data.stress) / (hasHistoricalData ? 2 : 1);
      }

      // Convert to percentages (drowsiness and stress are 0-1 range)
      const drowsinessPercent = Math.round(avgDrowsiness * 100);
      const stressPercent = Math.round(avgStress * 100);
      const alertnessPercent = 100 - drowsinessPercent;
      const calmnessPercent = 100 - stressPercent;

      const groqApiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      if (!groqApiKey) {
        setAiRecommendations(
          "⚠️ AI recommendations unavailable. Groq API key not configured in .env.local file."
        );
        setLoadingAI(false);
        return;
      }

      const prompt = `You are a professional driver wellness AI assistant. Analyze this driver's performance data and provide 3-4 specific, actionable recommendations:

📊 Current Metrics:
- Alertness Level: ${alertnessPercent}%
- Calmness Level: ${calmnessPercent}%
- Drowsiness: ${drowsinessPercent}%
- Stress: ${stressPercent}%
- Total Sessions: ${totalSessions}
- Data Points Analyzed: ${dataPoints}
- Recent Improvement: ${improvement}%

Provide personalized, encouraging recommendations to improve their driving wellness and safety. Be specific and actionable. Format as bullet points with emojis.`;

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
          }),
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        const recommendations =
          responseData.choices[0]?.message?.content ||
          "No recommendations available.";
        setAiRecommendations(recommendations);
        console.log("✅ AI recommendations generated successfully");
      } else {
        const errorText = await response.text();
        console.error("Groq API error:", response.status, errorText);
        setAiRecommendations(
          `⚠️ Unable to generate AI recommendations. API returned: ${response.status}`
        );
      }
    } catch (error) {
      console.error("Error generating AI recommendations:", error);
      setAiRecommendations(
        "❌ Error loading AI recommendations. Check console for details."
      );
    } finally {
      setLoadingAI(false);
    }
  };

  // Current wellness metrics - use real data when active, or session averages when inactive
  const getMetrics = () => {
    if (data.isActive && data.lastUpdate) {
      // Use live data (drowsiness and stress are 0-1 range)
      return {
        alertness: Math.round((1 - data.drowsiness) * 100),
        calmness: Math.round((1 - data.stress) * 100),
        score: Math.round(
          Math.max(0, 100 - (data.drowsiness * 30 + data.stress * 25))
        ),
      };
    } else if (sessions.length > 0) {
      // Use average from recent sessions
      const recentSessions = sessions.slice(0, 3);
      const avgDrowsiness =
        recentSessions.reduce((sum, s) => sum + s.avgDrowsiness, 0) /
        recentSessions.length;
      const avgStress =
        recentSessions.reduce((sum, s) => sum + s.avgStress, 0) /
        recentSessions.length;
      const avgScore =
        recentSessions.reduce((sum, s) => sum + s.safetyScore, 0) /
        recentSessions.length;

      return {
        alertness: Math.round(100 - avgDrowsiness),
        calmness: Math.round(100 - avgStress),
        score: Math.round(avgScore),
      };
    } else {
      // No data available
      return {
        alertness: 0,
        calmness: 0,
        score: 0,
      };
    }
  };

  const metrics = getMetrics();
  const currentAlertness = metrics.alertness;
  const currentCalmness = metrics.calmness;
  const currentScore = metrics.score;

  // Prepare chart data
  const chartData = sessions
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      date: s.date,
      safety: s.safetyScore,
      drowsiness: s.avgDrowsiness,
      stress: s.avgStress,
    }));

  const radarData = [
    { metric: "Safety", value: currentScore, fullMark: 100 },
    { metric: "Alertness", value: currentAlertness, fullMark: 100 },
    { metric: "Calmness", value: currentCalmness, fullMark: 100 },
    {
      metric: "Consistency",
      value: sessions.length > 0 ? 75 : 50,
      fullMark: 100,
    },
    {
      metric: "Performance",
      value: (currentScore + currentAlertness) / 2,
      fullMark: 100,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Current Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card stat-card-yellow">
          <div className="text-4xl font-bold text-yellow-600">
            {currentScore > 0 ? currentScore : "—"}
          </div>
          <div className="text-sm font-medium text-yellow-800 mt-1">
            Overall Wellness
          </div>
          <div className="text-xs text-yellow-600 mt-1">
            {currentScore === 0
              ? "No Data"
              : currentScore >= 80
              ? "Excellent"
              : currentScore >= 60
              ? "Good"
              : "Needs Attention"}
          </div>
        </div>

        <div className="stat-card stat-card-blue">
          <div className="text-4xl font-bold text-blue-600">
            {currentAlertness > 0 ? `${currentAlertness}%` : "—"}
          </div>
          <div className="text-sm font-medium text-blue-800 mt-1">
            Alertness
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {currentAlertness === 0
              ? "No Data"
              : currentAlertness >= 80
              ? "Highly Alert"
              : currentAlertness >= 60
              ? "Moderate"
              : "Low"}
          </div>
        </div>

        <div className="stat-card stat-card-green">
          <div className="text-4xl font-bold text-purple-600">
            {currentCalmness > 0 ? `${currentCalmness}%` : "—"}
          </div>
          <div className="text-sm font-medium text-purple-800 mt-1">
            Calmness
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {currentCalmness === 0
              ? "No Data"
              : currentCalmness >= 80
              ? "Very Calm"
              : currentCalmness >= 60
              ? "Moderate"
              : "Stressed"}
          </div>
        </div>
      </div>

      {/* Session Statistics & AI Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Stats */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Session Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Monitoring Status:</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  data.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {data.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Sessions:</span>
              <span className="text-2xl font-bold text-blue-600">
                {totalSessions}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Score:</span>
              <span className="text-xl font-bold text-yellow-600">
                {sessions.length > 0
                  ? Math.round(
                      sessions.reduce((sum, s) => sum + s.safetyScore, 0) /
                        sessions.length
                    )
                  : 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Improvement:</span>
              <span
                className={`text-xl font-bold ${
                  improvement > 0
                    ? "text-green-600"
                    : improvement < 0
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {improvement > 0 ? "+" : ""}
                {improvement}%
                {improvement > 0 ? " 📈" : improvement < 0 ? " 📉" : " ➡️"}
              </span>
            </div>
            {data.lastUpdate && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Last Update:</span>
                <span className="text-gray-800">
                  {new Date(data.lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="card bg-gradient-to-br from-purple-50 to-pink-50">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">💡</span>
            AI Recommendations
          </h3>
          {loadingAI ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {aiRecommendations}
              </div>
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={generateAIRecommendations}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  🔄 Refresh Recommendations
                </button>
                {sessions.length > 0 && (
                  <button
                    onClick={clearAllData}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    🗑️ Clear All Data
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      {sessions.length > 0 && (
        <>
          {/* Trend Chart */}
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📈 Wellness Trends
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSafety" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="safety"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorSafety)"
                  name="Safety Score"
                />
                <Line
                  type="monotone"
                  dataKey="drowsiness"
                  stroke="#ef4444"
                  name="Drowsiness %"
                />
                <Line
                  type="monotone"
                  dataKey="stress"
                  stroke="#f59e0b"
                  name="Stress %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Radar */}
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
                  name="Current Performance"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Session History Table */}
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📋 Recent Sessions
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Drowsiness
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Stress
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Safety Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.slice(0, 10).map((session) => (
                    <tr key={session.sessionId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {session.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {session.duration} min
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded ${
                            session.avgDrowsiness < 30
                              ? "bg-green-100 text-green-800"
                              : session.avgDrowsiness < 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {session.avgDrowsiness}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded ${
                            session.avgStress < 30
                              ? "bg-green-100 text-green-800"
                              : session.avgStress < 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {session.avgStress}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">
                        {session.safetyScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* No Data State */}
      {sessions.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Session Data Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Start Live Monitoring to track your wellness sessions
          </p>
          <button
            onClick={() => {
              if (onNavigateToMonitor) {
                onNavigateToMonitor();
              } else {
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
        </div>
      )}
    </div>
  );
}
