"use client";

import { useState, useEffect } from "react";
import MapView from "./MapView";

interface MonitoringData {
  drowsiness: number;
  stress: number;
  isActive: boolean;
  lastUpdate: Date | null;
}

interface SafetyAlertsProps {
  data: MonitoringData;
}

interface Alert {
  id: string;
  type: "drowsiness" | "stress" | "steering" | "break";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  recommendations: string[];
}

export default function SafetyAlerts({ data }: SafetyAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [safeStops, setSafeStops] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [loadingStops, setLoadingStops] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Generate alerts based on monitoring data
  useEffect(() => {
    if (!data.isActive) return;

    const newAlerts: Alert[] = [];

    // Drowsiness alerts (lowered thresholds for better detection)
    if (data.drowsiness > 0.7) {
      newAlerts.push({
        id: `drowsiness-${Date.now()}`,
        type: "drowsiness",
        severity: "critical",
        message: "Critical drowsiness detected! Pull over immediately.",
        timestamp: new Date(),
        acknowledged: false,
        recommendations: [
          "Find the nearest safe location to stop",
          "Take a 15-20 minute power nap",
          "Drink caffeine if available",
          "Do not continue driving until fully alert",
        ],
      });
      // Auto-find safe stops for critical alerts
      if (currentLocation) {
        findSafeStops(currentLocation.lat, currentLocation.lon);
      }
    } else if (data.drowsiness > 0.5) {
      newAlerts.push({
        id: `drowsiness-${Date.now()}`,
        type: "drowsiness",
        severity: "high",
        message: "High drowsiness level detected. Consider taking a break.",
        timestamp: new Date(),
        acknowledged: false,
        recommendations: [
          "Look for a rest area within the next 10 minutes",
          "Open windows for fresh air",
          "Engage in conversation or play upbeat music",
          "Plan a break at the next safe location",
        ],
      });
    } else if (data.drowsiness > 0.35) {
      newAlerts.push({
        id: `drowsiness-${Date.now()}`,
        type: "drowsiness",
        severity: "medium",
        message: "Moderate drowsiness detected. Stay alert.",
        timestamp: new Date(),
        acknowledged: false,
        recommendations: [
          "Take a short break if possible",
          "Stay hydrated",
          "Adjust your posture",
        ],
      });
    }

    // Stress alerts (lowered thresholds for better detection)
    if (data.stress > 0.8) {
      newAlerts.push({
        id: `stress-${Date.now()}`,
        type: "stress",
        severity: "critical",
        message: "Extreme stress levels detected. Take immediate action.",
        timestamp: new Date(),
        acknowledged: false,
        recommendations: [
          "Pull over safely and practice deep breathing",
          "Take 5-10 minutes to calm down",
          "Consider calling someone for support",
          "Reassess your route and timeline",
        ],
      });
      // Auto-find safe stops for critical alerts
      if (currentLocation) {
        findSafeStops(currentLocation.lat, currentLocation.lon);
      }
    } else if (data.stress > 0.6) {
      newAlerts.push({
        id: `stress-${Date.now()}`,
        type: "stress",
        severity: "high",
        message: "High stress levels detected. Practice stress management.",
        timestamp: new Date(),
        acknowledged: false,
        recommendations: [
          "Practice deep breathing exercises",
          "Reduce driving speed if safe to do so",
          "Listen to calming music",
          "Plan a break at the next opportunity",
        ],
      });
    } else if (data.stress > 0.45) {
      newAlerts.push({
        id: `stress-${Date.now()}`,
        type: "stress",
        severity: "medium",
        message: "Moderate stress detected. Take it easy.",
        timestamp: new Date(),
        acknowledged: false,
        recommendations: [
          "Take deep breaths",
          "Relax your shoulders",
          "Listen to calming music",
        ],
      });
    }

    // Add new alerts to the list
    if (newAlerts.length > 0) {
      setAlerts((prev) => {
        const filtered = prev.filter(
          (alert) =>
            !newAlerts.some(
              (newAlert) => newAlert.type === alert.type && !alert.acknowledged
            )
        );
        return [...filtered, ...newAlerts].slice(-10); // Keep last 10 alerts
      });
    }
  }, [data]);

  // Get current location and find safe stops
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lon: longitude });
          // Only find safe stops if monitoring is active and there are alerts
          if (data.isActive && activeAlerts.length > 0) {
            findSafeStops(latitude, longitude);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setCurrentLocation(null);
          setSafeStops([]);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const findSafeStops = async (lat: number, lon: number) => {
    setLoadingStops(true);
    try {
      console.log(`🔍 Searching for safe stops near ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      
      // Use the new location service (tries backend, then Groq, then mock)
      const { locationService } = await import('../lib/locationService');
      const places = await locationService.findNearbyPlaces(lat, lon, 'safety');
      
      setSafeStops(places);
      console.log(`✅ Found ${places.length} safe stops`);
      setLoadingStops(false);
    } catch (error) {
      console.error("❌ Error finding safe stops:", error);
      setSafeStops([]);
      setLoadingStops(false);
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };



  const handleEmergencyStop = () => {
    if (
      confirm(
        "🚨 EMERGENCY STOP\n\nThis will:\n• Find nearest safe stops\n• Show them on map\n• Provide directions\n\nContinue?"
      )
    ) {
      setEmergencyMode(true);
      setLoadingStops(true);
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentLocation({ lat: latitude, lon: longitude });
            
            console.log("🚨 EMERGENCY: Finding safe stops...");
            findSafeStops(latitude, longitude);
            
            // Show map automatically
            setShowMap(true);
            
            alert(`✅ Emergency mode activated!\n\nSearching for safe stops near:\nLat: ${latitude.toFixed(4)}\nLon: ${longitude.toFixed(4)}\n\nCheck the "Nearby Safe Stops" section below.`);
          },
          (error) => {
            console.error("❌ Location error:", error);
            alert(`❌ Could not get your location.\n\nError: ${error.message}\n\nPlease enable location services and try again.`);
            setLoadingStops(false);
            setEmergencyMode(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        alert("❌ Geolocation not supported by your browser.\n\nPlease use a modern browser with location services.");
        setLoadingStops(false);
        setEmergencyMode(false);
      }
    }
  };

  const handleEmergencyCall = () => {
    if (confirm("Do you want to call emergency services?")) {
      // In a real implementation, this would integrate with emergency services
      window.location.href = "tel:911";
    }
  };

  const copyToClipboard = (shareText: string) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          alert(
            "✅ Emergency location copied to clipboard!\n\nShare this with emergency contacts or authorities."
          );
        })
        .catch(() => {
          prompt("📋 Copy this emergency information:", shareText);
        });
    } else {
      prompt("📋 Copy this emergency information:", shareText);
    }
  };

  const handleShareLocation = () => {
    if (currentLocation) {
      const shareText = `🚨 DRIVER EMERGENCY: I need assistance at this location\nCoordinates: ${currentLocation.lat.toFixed(
        6
      )}, ${currentLocation.lon.toFixed(
        6
      )}\nTime: ${new Date().toLocaleString()}`;

      // Try native sharing first
      if (navigator.share) {
        navigator
          .share({
            title: "Emergency Location",
            text: shareText,
          })
          .catch(() => {
            // If sharing fails, copy to clipboard
            copyToClipboard(shareText);
          });
      } else {
        copyToClipboard(shareText);
      }
    } else {
      alert("❌ Location not available. Please enable location services for emergency features.");
      getCurrentLocation();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-500 text-red-800";
      case "high":
        return "bg-orange-100 border-orange-500 text-orange-800";
      case "medium":
        return "bg-yellow-100 border-yellow-500 text-yellow-800";
      case "low":
        return "bg-blue-100 border-blue-500 text-blue-800";
      default:
        return "bg-gray-100 border-gray-500 text-gray-800";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "⚡";
      case "low":
        return "ℹ️";
      default:
        return "📢";
    }
  };

  const activeAlerts = alerts.filter((alert) => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter((alert) => alert.acknowledged);

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="mr-2">🚨</span>
            Active Safety Alerts
            {activeAlerts.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {activeAlerts.length}
              </span>
            )}
          </h3>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <p>No active safety alerts</p>
            <p className="text-sm">All systems normal</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-4 p-4 rounded-lg ${getSeverityColor(
                  alert.severity
                )}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-lg mr-2">
                        {getSeverityIcon(alert.severity)}
                      </span>
                      <h4 className="font-semibold">{alert.message}</h4>
                    </div>
                    <p className="text-sm opacity-75 mb-3">
                      {alert.timestamp.toLocaleTimeString()}
                    </p>

                    {alert.recommendations.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">
                          Recommended Actions:
                        </p>
                        <ul className="text-sm space-y-1">
                          {alert.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-3 py-1 bg-white bg-opacity-50 hover:bg-opacity-75 rounded text-sm font-medium transition-colors"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="px-3 py-1 bg-white bg-opacity-50 hover:bg-opacity-75 rounded text-sm font-medium transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safe Stops Nearby */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="mr-2">🛑</span>
            Nearby Safe Stops
          </h3>
          <button
            onClick={() => {
              if (currentLocation) {
                setShowMap(!showMap);
              } else {
                alert("Location not available. Please enable location services.");
                getCurrentLocation();
              }
            }}
            className="btn-secondary text-xs"
          >
            {showMap ? "📍 Hide Map" : "📍 View on Map"}
          </button>
        </div>

        {!data.isActive && !emergencyMode ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">⏸️</div>
            <p>Start Live Monitor to enable safety features</p>
            <p className="text-sm">Or click "Emergency Stop" button below for immediate help</p>
          </div>
        ) : !emergencyMode && activeAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <p>No safety alerts - safe stops not needed</p>
            <p className="text-sm">Click "Emergency Stop" if you need immediate assistance</p>
          </div>
        ) : loadingStops ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p>Searching for real safe stops...</p>
          </div>
        ) : safeStops.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">❌</div>
            <p>No safe stops found in your area</p>
            <button
              onClick={getCurrentLocation}
              className="mt-2 btn-primary text-xs"
            >
              Retry Search
            </button>
          </div>
        ) : (
          <>
            {/* Current Location Display */}
            {currentLocation && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Current Location
                    </p>
                    <p className="text-xs text-blue-700">
                      {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* Safe Stops List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safeStops.slice(0, 6).map((stop, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{stop.icon || "📍"}</span>
                        <h4 className="font-medium text-gray-900">
                          {stop.name}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600">{stop.category}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {(stop.distance / 1000).toFixed(1)} km away
                      </p>
                      {stop.coordinates && (
                        <p className="text-xs text-gray-400 mt-1">
                          {stop.coordinates[1]?.toFixed(4)},{" "}
                          {stop.coordinates[0]?.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => {
                          const coords = stop.coordinates;
                          if (coords) {
                            const shareText = `Safe stop: ${stop.name} at coordinates ${coords[1]},${coords[0]}`;
                            navigator.clipboard
                              .writeText(shareText)
                              .then(() => {
                                alert("Location copied to clipboard!");
                              });
                          }
                        }}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Embedded Map */}
            {showMap && currentLocation && (
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-900 mb-3">
                  Interactive Map
                </h4>
                <MapView
                  lat={currentLocation.lat}
                  lon={currentLocation.lon}
                  safeStops={safeStops}
                  onStopSelect={(stop) => {
                    // Just show the stop info
                    alert(`${stop.name}\n${stop.category}\n${(stop.distance / 1000).toFixed(1)} km away`);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Alert History */}
      {acknowledgedAlerts.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📋</span>
            Recent Alert History
          </h3>

          <div className="space-y-3">
            {acknowledgedAlerts.slice(-5).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center">
                  <span className="text-gray-400 mr-3">
                    {getSeverityIcon(alert.severity)}
                  </span>
                  <div>
                    <p className="text-sm text-gray-900">{alert.message}</p>
                    <p className="text-xs text-gray-500">
                      {alert.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="status-indicator bg-gray-100 text-gray-600">
                  Acknowledged
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Actions */}
      <div className="card bg-red-50 border-red-200">
        <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
          <span className="mr-2">🆘</span>
          Emergency Actions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleEmergencyStop}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <div className="text-lg mb-1">🚨</div>
            <div className="text-sm">Emergency Stop</div>
          </button>

          <button
            onClick={handleEmergencyCall}
            className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <div className="text-lg mb-1">📞</div>
            <div className="text-sm">Call Emergency</div>
          </button>

          <button
            onClick={handleShareLocation}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <div className="text-lg mb-1">📍</div>
            <div className="text-sm">Share Location</div>
          </button>
        </div>
      </div>
    </div>
  );
}