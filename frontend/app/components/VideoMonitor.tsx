"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { safetyTipsService, SafetyTip } from "../lib/safetyTipsService";
import { dataManager } from "../lib/dataManager";

interface MonitoringData {
  drowsiness: number;
  stress: number;
  isActive: boolean;
  lastUpdate: Date | null;
}

interface VideoMonitorProps {
  onDataUpdate: (data: MonitoringData) => void;
}

export default function VideoMonitor({ onDataUpdate }: VideoMonitorProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentData, setCurrentData] = useState({
    drowsiness: 0,
    stress: 0,
    recommendations: [] as string[],
    detailedMetrics: {
      drowsiness: null as any,
      stress: null as any,
    },
  });
  const [safetyTips, setSafetyTips] = useState<SafetyTip[]>([]);
  const [isGeneratingTips, setIsGeneratingTips] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user",
  };

  useEffect(() => {
    if (isMonitoring) {
      // Connect to WebSocket - use environment variable for backend URL
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const wsUrl = backendUrl
        .replace("https://", "wss://")
        .replace("http://", "ws://");
      const websocket = new WebSocket(`${wsUrl}/ws/monitor`);

      websocket.onopen = () => {
        console.log("WebSocket connected");
        setWs(websocket);
      };

      websocket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.status === "processed") {
          const newData = {
            drowsiness: data.drowsiness_score,
            stress: data.stress_level,
            recommendations: data.recommendations || [],
            detailedMetrics: data.detailed_metrics || {},
          };

          setCurrentData(newData);

          const monitoringData = {
            drowsiness: data.drowsiness_score,
            stress: data.stress_level,
            isActive: true,
            lastUpdate: new Date(),
            detailedMetrics: data.detailed_metrics,
          };

          onDataUpdate(monitoringData);

          // Save wellness data for persistence
          dataManager.saveWellnessData({
            ...monitoringData,
            timestamp: new Date().toISOString(),
          });

          // Generate real-time safety tips using Groq AI
          if (!isGeneratingTips) {
            setIsGeneratingTips(true);
            try {
              const tips = await safetyTipsService.generateSafetyTips(
                monitoringData
              );
              setSafetyTips(tips);
            } catch (error) {
              console.error("Error generating safety tips:", error);
            } finally {
              setIsGeneratingTips(false);
            }
          }
        }
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      return () => {
        websocket.close();
        setWs(null);
      };
    }
  }, [isMonitoring, onDataUpdate]);

  const capture = useCallback(() => {
    if (webcamRef.current && ws && ws.readyState === WebSocket.OPEN) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        ws.send(
          JSON.stringify({
            type: "video_frame",
            frame: imageSrc,
          })
        );
      }
    }
  }, [ws]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isMonitoring) {
      interval = setInterval(capture, 2000); // Capture every 2 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, capture]);

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
    if (!isMonitoring) {
      onDataUpdate({
        drowsiness: 0,
        stress: 0,
        isActive: false,
        lastUpdate: null,
      });
      setSafetyTips([]);
      safetyTipsService.clearTips();
    }
  };

  const getDrowsinessStatus = (score: number) => {
    if (score > 0.7) return { label: "High Risk", class: "status-danger" };
    if (score > 0.4) return { label: "Moderate", class: "status-warning" };
    return { label: "Alert", class: "status-safe" };
  };

  const getStressStatus = (score: number) => {
    if (score > 0.8) return { label: "High Stress", class: "status-danger" };
    if (score > 0.5) return { label: "Moderate", class: "status-warning" };
    return { label: "Calm", class: "status-safe" };
  };

  return (
    <div className="space-y-6">
      {/* Video Feed and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Feed */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Live Video Feed
            </h3>
            <button
              onClick={toggleMonitoring}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isMonitoring
                  ? "bg-danger-600 hover:bg-danger-700 text-white"
                  : "bg-primary-600 hover:bg-primary-700 text-white"
              }`}
            >
              {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
            </button>
          </div>

          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            {isMonitoring ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-auto"
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">📹</div>
                  <p>Click &quot;Start Monitoring&quot; to begin</p>
                </div>
              </div>
            )}

            {isMonitoring && (
              <div className="absolute top-4 left-4">
                <div className="bg-red-600 text-white px-2 py-1 rounded text-sm flex items-center">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                  LIVE
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Metrics */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Real-time Analysis
          </h3>

          <div className="space-y-4">
            {/* Drowsiness Level */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Drowsiness Level
                </span>
                <span
                  className={`status-indicator ${
                    getDrowsinessStatus(currentData.drowsiness).class
                  }`}
                >
                  {getDrowsinessStatus(currentData.drowsiness).label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    currentData.drowsiness > 0.7
                      ? "bg-danger-500"
                      : currentData.drowsiness > 0.4
                      ? "bg-warning-500"
                      : "bg-success-500"
                  }`}
                  style={{ width: `${currentData.drowsiness * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(currentData.drowsiness * 100).toFixed(1)}%
              </div>
            </div>

            {/* Stress Level */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Stress Level
                </span>
                <span
                  className={`status-indicator ${
                    getStressStatus(currentData.stress).class
                  }`}
                >
                  {getStressStatus(currentData.stress).label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    currentData.stress > 0.8
                      ? "bg-danger-500"
                      : currentData.stress > 0.5
                      ? "bg-warning-500"
                      : "bg-success-500"
                  }`}
                  style={{ width: `${currentData.stress * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(currentData.stress * 100).toFixed(1)}%
              </div>
            </div>

            {/* Connection Status */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Connection Status</span>
                <span
                  className={`status-indicator ${
                    ws && ws.readyState === WebSocket.OPEN
                      ? "status-safe"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ws && ws.readyState === WebSocket.OPEN
                    ? "Connected"
                    : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Metrics Display */}
      {(currentData.detailedMetrics.drowsiness ||
        currentData.detailedMetrics.stress) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Drowsiness Analysis */}
          {currentData.detailedMetrics.drowsiness && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">🧠</span>
                Drowsiness Analysis
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Detection Level
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      currentData.detailedMetrics.drowsiness.level ===
                      "Critical"
                        ? "bg-red-100 text-red-800"
                        : currentData.detailedMetrics.drowsiness.level ===
                          "High"
                        ? "bg-orange-100 text-orange-800"
                        : currentData.detailedMetrics.drowsiness.level ===
                          "Moderate"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {currentData.detailedMetrics.drowsiness.level}
                  </span>
                </div>

                {/* Model Prediction */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      AI Model Prediction
                    </span>
                    <span className="text-xs text-gray-800">
                      {currentData.detailedMetrics.drowsiness.metrics?.[
                        "Model Prediction"
                      ] || "N/A"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Specialized drowsiness detection model
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      Model Confidence
                    </span>
                    <span className="text-xs text-gray-800">
                      {currentData.detailedMetrics.drowsiness.metrics
                        ?.Confidence || "N/A"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    AI model prediction confidence
                  </div>
                </div>

                {/* Temporal Trend */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      Trend Analysis
                    </span>
                    <span className="text-xs text-gray-800">
                      {currentData.detailedMetrics.drowsiness.metrics?.Trend ||
                        "N/A"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Temporal pattern over last 10 detections
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stress Analysis */}
          {currentData.detailedMetrics.stress && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">😣</span>
                Stress Analysis
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Stress Level
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      currentData.detailedMetrics.stress.level === "Critical"
                        ? "bg-red-100 text-red-800"
                        : currentData.detailedMetrics.stress.level === "High"
                        ? "bg-orange-100 text-orange-800"
                        : currentData.detailedMetrics.stress.level ===
                          "Moderate"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {currentData.detailedMetrics.stress.level}
                  </span>
                </div>

                {/* Primary Emotion */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      Primary Emotion
                    </span>
                    <span className="text-xs text-gray-800">
                      {currentData.detailedMetrics.stress.metrics?.[
                        "Primary Emotion"
                      ] || "N/A"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    AI-detected facial emotion
                  </div>
                </div>

                {/* Model Confidence */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      Model Confidence
                    </span>
                    <span className="text-xs text-gray-800">
                      {currentData.detailedMetrics.stress.metrics?.Confidence ||
                        "N/A"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Emotion detection confidence
                  </div>
                </div>

                {/* Stress Level */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      Stress Assessment
                    </span>
                    <span className="text-xs text-gray-800">
                      {currentData.detailedMetrics.stress.metrics?.[
                        "Stress Level"
                      ] || "N/A"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Multi-modal stress analysis
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Real-time Groq AI Safety Tips */}
      {(safetyTips.length > 0 || isGeneratingTips) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="mr-2">🤖</span>
              Live AI Safety Tips
            </h3>
            {isGeneratingTips && (
              <div className="flex items-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Generating...
              </div>
            )}
          </div>

          <div className="space-y-3">
            {safetyTips.map((tip) => (
              <div
                key={tip.id}
                className={`p-4 rounded-lg border-l-4 ${
                  tip.priority === "critical"
                    ? "bg-red-50 border-red-500"
                    : tip.priority === "high"
                    ? "bg-orange-50 border-orange-500"
                    : tip.priority === "medium"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tip.priority === "critical"
                            ? "bg-red-100 text-red-800"
                            : tip.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : tip.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {tip.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {tip.category}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {tip.message}
                    </p>
                    {tip.action && (
                      <p className="text-sm text-gray-600">
                        <strong>Action:</strong> {tip.action}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 ml-4">
                    {tip.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center">
            Powered by Groq AI • Updates every 30 seconds
          </div>
        </div>
      )}
    </div>
  );
}
