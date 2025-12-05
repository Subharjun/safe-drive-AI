"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { dataManager } from "../lib/dataManager";

// Dynamically import Leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

interface RouteData {
  origin: string;
  destination: string;
  coordinates: number[][];
  distance: number;
  duration: number;
  currentProgress: number; // 0-100%
}

interface Position {
  x: number;
  y: number;
}

export default function LiveRouteTracker() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 20, y: 100 });
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Load Leaflet and initialize
  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== "undefined") {
        const leaflet = await import("leaflet");

        // Fix for default markers
        delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        setL(leaflet);
        setMapLoaded(true);
      }
    };

    loadLeaflet();
  }, []);

  // Load saved position and settings (persistent across tabs)
  useEffect(() => {
    const savedPosition = dataManager.getData("routeTrackerPosition", {
      persistent: true,
    });
    if (savedPosition) {
      setPosition(savedPosition);
    }

    const savedExpanded = dataManager.getData("routeTrackerExpanded", {
      persistent: true,
    });
    if (savedExpanded !== null) {
      setIsExpanded(savedExpanded);
    }

    // Show tooltip for first-time users
    const hasSeenTooltip = dataManager.getData("routeTrackerTooltipSeen", {
      persistent: true,
    });
    if (!hasSeenTooltip) {
      setShowTooltip(true);
      setTimeout(() => {
        setShowTooltip(false);
        dataManager.saveData("routeTrackerTooltipSeen", true, {
          persistent: true,
        });
      }, 5000);
    }
  }, []);

  // Save position when it changes (persistent across tabs)
  useEffect(() => {
    dataManager.saveData("routeTrackerPosition", position, {
      persistent: true,
    });
  }, [position]);

  // Save expanded state (persistent across tabs)
  useEffect(() => {
    dataManager.saveData("routeTrackerExpanded", isExpanded, {
      persistent: true,
    });
  }, [isExpanded]);

  // Get initial location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => {
          // Default to San Francisco
          setCurrentLocation({ lat: 37.7749, lon: -122.4194 });
        }
      );
    }
  }, []);

  // Load saved route (persists across tabs, resets on reload)
  useEffect(() => {
    const savedRoute = dataManager.getData("activeRoute");
    if (savedRoute) {
      setRouteData(savedRoute);
      setIsTracking(true);
    }
  }, []);

  // Start real-time location tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };

        setCurrentLocation(newLocation);

        // Update route progress if we have an active route
        if (routeData) {
          const progress = calculateRouteProgress(
            newLocation,
            routeData.coordinates
          );
          setRouteData((prev) =>
            prev ? { ...prev, currentProgress: progress } : null
          );
        }
      },
      (error) => {
        console.error("Error tracking location:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  // Stop tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setRouteData(null);
    dataManager.clearData("activeRoute");
  };

  // Calculate route progress based on current location
  const calculateRouteProgress = (
    currentPos: { lat: number; lon: number },
    routeCoords: number[][]
  ) => {
    if (!routeCoords || routeCoords.length === 0) return 0;

    let minDistance = Infinity;
    let closestIndex = 0;

    // Find closest point on route
    routeCoords.forEach((coord, index) => {
      const distance = calculateDistance(
        [currentPos.lon, currentPos.lat],
        coord
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Calculate progress as percentage
    return Math.min(100, (closestIndex / routeCoords.length) * 100);
  };

  const calculateDistance = (coord1: number[], coord2: number[]) => {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (coord1[1] * Math.PI) / 180;
    const lat2Rad = (coord2[1] * Math.PI) / 180;
    const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const deltaLng = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep widget within viewport bounds
      const maxX = window.innerWidth - (isExpanded ? 384 : 200); // 384px = w-96, 200px = w-48
      const maxY = window.innerHeight - (isExpanded ? 256 : 128); // 256px = h-64, 128px = h-32

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Visibility is now always true - widget cannot be hidden

  // Create custom icons
  const createCustomIcon = (color: string, icon: string) => {
    if (!L) return null;

    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${icon}
        </div>
      `,
      className: "custom-div-icon",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const currentLocationIcon = createCustomIcon("#3b82f6", "📍");

  // Widget is always visible - no hide functionality

  if (!currentLocation) {
    return (
      <div
        className="fixed bg-gray-100 rounded-lg flex items-center justify-center shadow-lg z-50 w-48 h-32"
        style={{ left: position.x, top: position.y }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-1"></div>
          <p className="text-xs text-gray-600">Getting location...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      className={`fixed z-50 transition-all duration-300 ${
        isExpanded ? "w-96 h-64" : "w-48 h-32"
      } ${isDragging ? "cursor-grabbing scale-105" : "cursor-grab"}`}
      style={{ left: position.x, top: position.y }}
    >
      {/* Draggable Widget */}
      <div
        className={`w-full h-full bg-white rounded-lg border-2 shadow-lg overflow-hidden relative transition-all ${
          isDragging ? "border-blue-400 shadow-xl" : "border-blue-200"
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Interactive Map */}
        <div
          className="w-full h-full relative"
          onClick={() => !isDragging && setIsExpanded(!isExpanded)}
        >
          {mapLoaded ? (
            <MapContainer
              center={[currentLocation.lat, currentLocation.lon]}
              zoom={isExpanded ? 14 : 12}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Current Location */}
              <Marker
                position={[currentLocation.lat, currentLocation.lon]}
                icon={currentLocationIcon}
              />

              {/* Route Polyline */}
              {routeData && routeData.coordinates.length > 0 && (
                <Polyline
                  positions={routeData.coordinates.map(
                    (coord) => [coord[1], coord[0]] as [number, number]
                  )}
                  color="#3b82f6"
                  weight={3}
                  opacity={0.8}
                />
              )}
            </MapContainer>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <div className="text-center pointer-events-none">
                <div className="text-2xl mb-1">🗺️</div>
                <div className="text-xs text-blue-800 font-medium">
                  Loading Map...
                </div>
              </div>
            </div>
          )}

          {/* Drag Handle */}
          <div className="absolute top-1 left-1 right-1 h-6 bg-black bg-opacity-20 rounded-t flex items-center justify-center cursor-grab">
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-white bg-opacity-60 rounded-full"></div>
              <div className="w-1 h-1 bg-white bg-opacity-60 rounded-full"></div>
              <div className="w-1 h-1 bg-white bg-opacity-60 rounded-full"></div>
            </div>
          </div>

          {/* First-time user tooltip */}
          {showTooltip && (
            <div className="absolute -top-12 left-0 right-0 bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-10">
              <div className="text-center">
                Drag me anywhere! Click to expand.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
              </div>
            </div>
          )}

          {/* Status Info */}
          <div className="absolute top-8 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs pointer-events-none">
            {isTracking ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Live</span>
              </div>
            ) : (
              <span>📍 Location</span>
            )}
          </div>

          {/* Route Progress */}
          {routeData && (
            <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs pointer-events-none">
              <div className="flex justify-between items-center mb-1">
                <span>{routeData.currentProgress.toFixed(0)}% Complete</span>
                <span>
                  {(
                    routeData.distance *
                    (1 - routeData.currentProgress / 100)
                  ).toFixed(1)}{" "}
                  km left
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-1">
                <div
                  className="bg-green-400 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${routeData.currentProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="absolute top-8 right-2 flex space-x-1">
            {/* Expand/Collapse Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="bg-black bg-opacity-70 text-white p-1 rounded hover:bg-opacity-90 transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <svg
                className={`w-3 h-3 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Control Panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-gray-200 shadow-lg p-3 z-10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 text-sm">
              Live Navigation
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            {!isTracking ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startTracking();
                }}
                className="w-full bg-blue-600 text-white px-3 py-2 rounded text-xs hover:bg-blue-700 transition-colors"
              >
                🚗 Start Live Tracking
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopTracking();
                }}
                className="w-full bg-red-600 text-white px-3 py-2 rounded text-xs hover:bg-red-700 transition-colors"
              >
                🛑 Stop Tracking
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (currentLocation) {
                  window.open(
                    `https://www.google.com/maps/@${currentLocation.lat},${currentLocation.lon},15z`,
                    "_blank"
                  );
                }
              }}
              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-xs hover:bg-gray-700 transition-colors"
            >
              🌍 Open in Google Maps
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setPosition({ x: 20, y: 100 }); // Reset to default position
              }}
              className="w-full bg-gray-400 text-white px-3 py-2 rounded text-xs hover:bg-gray-500 transition-colors"
            >
              📍 Reset Position
            </button>
          </div>

          {routeData && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Distance:</span>
                  <span>{routeData.distance.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>
                    {Math.round(routeData.duration / 60)}h{" "}
                    {routeData.duration % 60}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span>{routeData.currentProgress.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
