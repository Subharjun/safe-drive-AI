"use client";

import { useState, useEffect } from "react";
import { dataManager } from "../lib/dataManager";
import { safetyTipsService } from "../lib/safetyTipsService";

interface WellnessData {
  drowsiness: number;
  stress: number;
  isActive: boolean;
  lastUpdate: string | null;
}

interface WellnessMetricsProps {
  data: WellnessData;
  onNavigateToMonitor?: () => void;
}

export default function WellnessMetrics({ data, onNavigateToMonitor }: WellnessMetricsProps) {
  const [historicalData, setHistoricalData] = useState<Array<{
    timestamp: string;
    drowsiness: number;
    stress: number;
    overallScore: number;
  }>>([]);

  useEffect(() => {
    // Only load historical data if monitoring is currently active
    if (data.isActive) {
      const savedData = dataManager.getWellnessHistory();
      if (savedData.length > 0) {
        setHistoricalData(savedData);
      }
    } else {
      // Clear historical data when monitoring is not active
      setHistoricalData([]);
    }
  }, [data.isActive]);

  useEffect(() => {
    // Save new data point when monitoring is active
    if (data.isActive && data.lastUpdate) {
      const newDataPoint = {
        timestamp: new Date().toISOString(),
        drowsiness: data.drowsiness,
        stress: data.stress,
        overallScore: calculateOverallScore(data.drowsiness, data.stress),
      };

      setHistoricalData(prev => {
        const updated = [...prev, newDataPoint].slice(-100); // Keep last 100 points
        return updated;
      });
    }
  }, [data.lastUpdate, data.isActive]);

  const calculateOverallScore = (drowsiness: number, stress: number) => {
    // Calculate overall wellness score (0-100, higher is better)
    const drowsinessScore = (1 - drowsiness) * 100;
    const stressScore = (1 - stress) * 100;
    return Math.round((drowsinessScore * 0.6 + stressScore * 0.4));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    if (score >= 40) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };

  // Only calculate scores if monitoring is active
  const currentScore = data.isActive ? calculateOverallScore(data.drowsiness, data.stress) : 0;
  const averageScore = data.isActive && historicalData.length > 0 
    ? Math.round(historicalData.reduce((sum, point) => sum + point.overallScore, 0) / historicalData.length)
    : 0;

  return (
    <div className="space-y-6">
      {!data.isActive ? (
        <div className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Live Monitor</h3>
            <p className="text-gray-600 mb-4">Wellness metrics will appear when monitoring is active</p>
            <button
              onClick={() => {
                if (onNavigateToMonitor) {
                  onNavigateToMonitor();
                } else {
                  // Fallback to custom event
                  const event = new CustomEvent('switchTab', { detail: 'monitor' });
                  window.dispatchEvent(event);
                }
              }}
              className="btn-primary"
            >
              Go to Live Monitor
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Current Wellness Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall Score */}
            <div className="card">
              <div className="text-center">
                <div className={`text-4xl font-bold mb-2 px-4 py-2 rounded-lg ${getScoreColor(currentScore)}`}>
                  {currentScore}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Overall Wellness</h3>
                <p className="text-sm text-gray-600">{getScoreLabel(currentScore)}</p>
              </div>
            </div>

            {/* Drowsiness Level */}
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {Math.round((1 - data.drowsiness) * 100)}%
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Alertness</h3>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(1 - data.drowsiness) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Stress Level */}
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {Math.round((1 - data.stress) * 100)}%
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Calmness</h3>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(1 - data.stress) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Statistics - Only show when monitoring is active */}
      {data.isActive && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Stats */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Session Statistics
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Monitoring Status:</span>
              <span className={`px-2 py-1 rounded-full text-sm ${
                data.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {data.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Data Points:</span>
              <span className="font-medium">{historicalData.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Score:</span>
              <span className={`font-medium px-2 py-1 rounded ${getScoreColor(averageScore)}`}>
                {averageScore}
              </span>
            </div>
            
            {data.lastUpdate && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Last Update:</span>
                <span className="text-sm text-gray-500">
                  {new Date(data.lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">💡</span>
            Recommendations
          </h3>
          
          <div className="space-y-3">
            {currentScore < 60 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Take a Break</p>
                    <p className="text-xs text-yellow-700">Your wellness score is below optimal. Consider taking a short break.</p>
                  </div>
                </div>
              </div>
            )}
            
            {data.drowsiness > 0.6 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-red-600">🚨</span>
                  <div>
                    <p className="text-sm font-medium text-red-800">High Drowsiness Detected</p>
                    <p className="text-xs text-red-700">Pull over safely and rest immediately.</p>
                  </div>
                </div>
              </div>
            )}
            
            {data.stress > 0.6 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-orange-600">😰</span>
                  <div>
                    <p className="text-sm font-medium text-orange-800">High Stress Level</p>
                    <p className="text-xs text-orange-700">Try deep breathing exercises or take a break.</p>
                  </div>
                </div>
              </div>
            )}
            
            {currentScore >= 80 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-green-600">✅</span>
                  <div>
                    <p className="text-sm font-medium text-green-800">Excellent Condition</p>
                    <p className="text-xs text-green-700">You&apos;re in great shape for driving. Keep it up!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Historical Trend - Only show when monitoring is active and has data */}
      {data.isActive && historicalData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📈</span>
            Wellness Trend (Last {historicalData.length} readings)
          </h3>
          
          <div className="space-y-4">
            {/* Simple trend visualization */}
            <div className="grid grid-cols-10 gap-1 h-20">
              {historicalData.slice(-10).map((point, index) => (
                <div key={index} className="flex flex-col justify-end">
                  <div 
                    className={`w-full rounded-t ${getScoreColor(point.overallScore).includes('green') ? 'bg-green-400' : 
                      getScoreColor(point.overallScore).includes('yellow') ? 'bg-yellow-400' :
                      getScoreColor(point.overallScore).includes('orange') ? 'bg-orange-400' : 'bg-red-400'}`}
                    style={{ height: `${point.overallScore}%` }}
                  ></div>
                  <div className="text-xs text-center text-gray-500 mt-1">
                    {point.overallScore}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-xs text-gray-500 text-center">
              Recent wellness scores over time
            </div>
          </div>
        </div>
      )}

      {/* Actions - Only show when monitoring is active */}
      {data.isActive && (
        <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">⚙️</span>
          Actions
        </h3>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              dataManager.clearData('wellnessHistory');
              setHistoricalData([]);
            }}
            className="btn-secondary text-sm"
          >
            Clear History
          </button>
          
          <button
            onClick={() => {
              const dataStr = dataManager.exportData();
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `wellness-data-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary text-sm"
          >
            Export Data
          </button>
          
          {!data.isActive && (
            <button
              onClick={() => {
                if (onNavigateToMonitor) {
                  onNavigateToMonitor();
                } else {
                  // Fallback to custom event
                  const event = new CustomEvent('switchTab', { detail: 'monitor' });
                  window.dispatchEvent(event);
                }
              }}
              className="btn-primary text-sm"
            >
              Start Monitoring
            </button>
          )}
        </div>
        </div>
      )}
    </div>
  );
}