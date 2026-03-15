"use client";

import { useState, useEffect, useRef } from "react";
import { config, validateConfig } from "../lib/config";
import { apiClient } from "../lib/api";
import { dataManager } from "../lib/dataManager";
import MapView from "./MapView";

// Removed unused interface RoutePoint

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  name: string;
}

interface RouteSegment {
  distance: number;
  duration: number;
  instructions: string[]; // Keep for compatibility
  steps: RouteStep[];
  restStops: any[];
  geometry: string;
  decodedCoordinates: number[][];
  mainRoad?: string;
  majorRoads: string[];
}

interface RoutePreferences {
  maxDrivingTime: number;
  preferRestAreas: boolean;
  avoidTolls: boolean;
  prioritizeSafety: boolean;
}

const formatDuration = (minutes: number | null) => {
  if (minutes === null) return "--";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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

const getAmenitiesFromPOI = (properties: any) => {
  const amenities: string[] = [];
  const tags = properties.osm_tags || {};

  if (tags.fuel || properties.category_ids?.includes(142))
    amenities.push("Fuel");
  if (tags.toilets || tags.restroom) amenities.push("Restrooms");
  if (tags.restaurant || tags.fast_food || tags.cafe) amenities.push("Food");
  if (tags.parking) amenities.push("Parking");
  if (tags.atm) amenities.push("ATM");
  if (tags.shower) amenities.push("Showers");

  return amenities.length > 0 ? amenities : ["Services Available"];
};

export default function RouteOptimizer() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [allRoutes, setAllRoutes] = useState<RouteSegment[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(null);
  const [remainingDuration, setRemainingDuration] = useState<number | null>(null);
  const [currentRoadName, setCurrentRoadName] = useState<string | null>(null);
  const [nextStepIndex, setNextStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [preferences, setPreferences] = useState<RoutePreferences>({
    maxDrivingTime: config.routing.defaultPreferences.maxDrivingTime,
    preferRestAreas: config.routing.defaultPreferences.preferRestAreas,
    avoidTolls: config.routing.defaultPreferences.avoidTolls,
    prioritizeSafety: config.routing.defaultPreferences.prioritizeSafety,
  });
  const [aiRestStops, setAiRestStops] = useState<string>("");
  const [mapSafeStops, setMapSafeStops] = useState<any[]>([]);

  const activeRoute = allRoutes[activeRouteIndex] || null;
  const routeCoordinates = activeRoute?.decodedCoordinates || [];

  // Get user's current location and start watching
  useEffect(() => {
    if (navigator.geolocation) {
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lon: longitude });
          // If no origin, set it to current location
          if (!origin) {
            setOrigin(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        },
        () => {
          console.log("Location access denied, using default location");
          const { lat: defaultLat, lon: defaultLon } =
            config.map.defaultLocation;
          setCurrentLocation({ lat: defaultLat, lon: defaultLon });
        }
      );

      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log("📍 Location updated:", latitude, longitude);
          setCurrentLocation({ lat: latitude, lon: longitude });
        },
        (error) => console.log("Error watching position:", error),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Update progress-based metrics when location or route changes
  useEffect(() => {
    if (currentLocation && activeRoute && routeCoordinates.length > 0) {
      // Find closest point on route to avoid "jumping"
      let minDistance = Infinity;
      let closestIndex = 0;

      routeCoordinates.forEach((coord, index) => {
        const d = calculateDistance(
          [currentLocation.lon, currentLocation.lat],
          coord
        );
        if (d < minDistance) {
          minDistance = d;
          closestIndex = index;
        }
      });

      // Calculate path distance remaining along the polyline
      let remainingDist = 0;
      for (let i = closestIndex; i < routeCoordinates.length - 1; i++) {
        remainingDist += calculateDistance(
          routeCoordinates[i],
          routeCoordinates[i + 1]
        );
      }
      
      const distKm = Math.round((remainingDist / 1000) * 10) / 10;
      setRemainingDistance(distKm);

      // Estimate remaining time more accurately
      // Ensure we don't go below 1 min if we're not at destination
      const timeRatio = Math.max(0, remainingDist / (activeRoute.distance * 1000));
      const remainingMins = Math.round(activeRoute.duration * timeRatio);
      setRemainingDuration(remainingDist > 100 ? Math.max(1, remainingMins) : 0);

      // Extract current road and next step
      if (activeRoute.steps.length > 0) {
        const progress = closestIndex / routeCoordinates.length;
        const stepIdx = Math.min(
          activeRoute.steps.length - 1,
          Math.floor(progress * activeRoute.steps.length)
        );
        setNextStepIndex(stepIdx);
        
        const currentStep = activeRoute.steps[stepIdx];
        setCurrentRoadName(currentStep.name && currentStep.name !== "-" ? currentStep.name : (currentStep.instruction.match(/(?:on|to|onto|along)\s+([^,.]+)/i)?.[1] || currentStep.instruction));
      }
    }
  }, [currentLocation, activeRouteIndex, allRoutes]);

  // Load saved preferences
  useEffect(() => {
    const savedPrefs = dataManager.getPreferences();
    if (savedPrefs.maxDrivingTime) {
      setPreferences((prev) => ({ ...prev, ...savedPrefs }));
    }
  }, []);

  const fetchRealRestStops = async (
    origin: string,
    destination: string,
    routeCoordinates: number[][]
  ) => {
    try {
      console.log("🔍 Fetching real rest stops via backend...");
      
      if (routeCoordinates.length < 2) {
        console.error("Not enough route coordinates");
        await fetchAIFallback(origin, destination);
        return;
      }
      
      // Get start and end coordinates
      const [originLon, originLat] = routeCoordinates[0];
      const [destLon, destLat] = routeCoordinates[routeCoordinates.length - 1];
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(
        `${backendUrl}/api/rest-stops-serp?origin_lat=${originLat}&origin_lon=${originLon}&dest_lat=${destLat}&dest_lon=${destLon}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.stops && data.stops.length > 0) {
          // Format the results
          let formattedStops = "🛑 **Rest Stops Along Your Route**\n\n";
          formattedStops += `Found ${data.stops.length} rest stops between ${origin} and ${destination}:\n\n`;
          
          data.stops.forEach((stop: any, index: number) => {
            formattedStops += `**${index + 1}. ${stop.name}**\n`;
            formattedStops += `📍 ${stop.address}\n`;
            formattedStops += `📌 Position: ${stop.position}\n`;
            if (stop.rating !== "N/A") {
              formattedStops += `⭐ Rating: ${stop.rating}\n`;
            }
            formattedStops += `🗺️ [View on Google Maps](${stop.link})\n\n`;
          });
          
          formattedStops += "\n💡 **Safety Tip:** Take a 15-minute break every 2 hours of driving.";
          
          console.log(`✅ Found ${data.stops.length} rest stops`);
          setAiRestStops(formattedStops);
          setMapSafeStops(data.stops.map((stop: any) => ({
            ...stop,
            icon: "🛑",
            category: stop.type || "Rest Stop"
          })));
        } else {
          console.log("⚠️ No stops found, using AI fallback");
          await fetchAIFallback(origin, destination);
        }
      } else {
        console.error("Backend request failed");
        await fetchAIFallback(origin, destination);
      }
    } catch (error) {
      console.error("❌ Error fetching rest stops:", error);
      await fetchAIFallback(origin, destination);
    }
  };

  const fetchAIFallback = async (origin: string, destination: string) => {
    try {
      console.log("🤖 Using AI to generate rest stop recommendations...");
      const groqApiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      if (!groqApiKey) {
        setAiRestStops(
          "⚠️ Unable to load rest stop recommendations. API key missing."
        );
        return;
      }

      const prompt = `You are a helpful driving assistant. A driver is traveling from ${origin} to ${destination}.

Please recommend 4-6 realistic rest stops along this route. For each stop, provide:

**Format each stop like this:**
**1. [Name of Place]**
📍 Location: [Approximate distance from start or landmark]
⛽ Type: [Gas Station/Rest Area/Service Plaza/etc.]
✨ Amenities: [Fuel, Restrooms, Food, etc.]
🗺️ [View on Google Maps](https://www.google.com/maps/search/[search term])

Use realistic names like "Shell Gas Station", "Highway Rest Area", "Travel Plaza", etc.
Make the Google Maps links searchable (e.g., "gas station near [city]" or "rest area [highway name]").
Be specific and helpful!`;

      console.log("📤 Sending AI request...");
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
            max_tokens: 1200,
          }),
        }
      );

      console.log("📥 AI Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        const recommendation =
          data.choices[0]?.message?.content || "No recommendations available.";
        console.log("✅ AI recommendations received successfully");
        setAiRestStops(recommendation);
      } else {
        const errorText = await response.text();
        console.error("❌ AI API error:", response.status, errorText);
        setAiRestStops(
          `⚠️ Unable to fetch recommendations (Error ${response.status}). Please try again.`
        );
      }
    } catch (error) {
      console.error("❌ AI fallback error:", error);
      setAiRestStops(
        "⚠️ Error loading recommendations. Please check your connection."
      );
    }
  };

  const calculateOptimalRoute = async () => {
    if (!origin || !destination) return;

    setLoading(true);
    try {
      // Validate configuration
      const configValidation = validateConfig();
      if (!configValidation.isValid) {
        throw new Error(
          `Configuration error: ${configValidation.errors.join(", ")}`
        );
      }

      console.log("Starting route calculation for:", { origin, destination });

      // Geocode origin and destination with enhanced fallback
      const [originCoords, destCoords] = await Promise.all([
        apiClient.geocodeLocation(origin),
        apiClient.geocodeLocation(destination),
      ]);

      console.log("Geocoded coordinates:", { originCoords, destCoords });

      if (!originCoords || !destCoords) {
        throw new Error(
          "Could not find coordinates for one or both locations. Please try more specific addresses."
        );
      }

      // Calculate routes using API client
      const rawRoutes = await apiClient.calculateRoute(
        originCoords,
        destCoords,
        preferences
      );
      
      console.log("Found routes:", rawRoutes.length);

      const processedRoutes: RouteSegment[] = rawRoutes.map((r: any) => {
        const coords = decodePolyline(r.geometry);
        const steps: RouteStep[] = r.segments?.flatMap(
          (segment: any) =>
            segment.steps?.map((step: any) => ({
              instruction: step.instruction,
              distance: step.distance,
              duration: step.duration,
              name: step.name
            })) || []
        ) || [];
        
        const instructions = steps.map(s => s.instruction);
        
        // Find major roads
        const roadNames = steps
          .map(s => s.name)
          .filter(name => name && name !== "-" && name.length > 1);
        const majorRoads = Array.from(new Set(roadNames));

        // Find main road name (longest distance step)
        let mainRoad = majorRoads[0] || "Unknown Road";
        let maxStepDist = -1;
        steps.forEach((step) => {
          if (step.distance > maxStepDist && step.name && step.name !== "-") {
            maxStepDist = step.distance;
            mainRoad = step.name;
          }
        });

        return {
          distance: Math.round((r.summary.distance / 1000) * 10) / 10,
          duration: Math.round(r.summary.duration / 60),
          instructions,
          steps,
          geometry: r.geometry,
          decodedCoordinates: coords,
          restStops: [],
          mainRoad,
          majorRoads
        };
      });

      setAllRoutes(processedRoutes);
      setActiveRouteIndex(0);
      setNextStepIndex(0);
      
      const firstRoute = processedRoutes[0];
      setRemainingDistance(firstRoute.distance);
      setRemainingDuration(firstRoute.duration);
      
      // Fetch rest stops for the main route
      fetchRealRestStops(origin, destination, firstRoute.decodedCoordinates);

      // Save for live tracking
      const routeForTracking = {
        origin,
        destination,
        coordinates: firstRoute.decodedCoordinates,
        distance: firstRoute.distance,
        duration: firstRoute.duration,
        currentProgress: 0,
      };

      dataManager.saveData("activeRoute", routeForTracking);

      // Alert success
      alert(
        `Found ${processedRoutes.length} routes!\n\nBest Route: ${
          firstRoute.distance
        } km | ${formatDuration(firstRoute.duration)}\nvia ${firstRoute.mainRoad}`
      );
    } catch (error) {
      console.error("Error calculating route:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Error calculating route: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const findRestStopsAlongRoute = async (
    routeGeometry: any,
    apiKey: string
  ) => {
    try {
      // Decode the route geometry to get coordinates along the path
      const coordinates = decodePolyline(routeGeometry);

      // Sample points along the route (every ~50km)
      const samplePoints = sampleRoutePoints(coordinates, 50000); // 50km intervals

      const restStops: any[] = [];

      // Search for POIs near each sample point
      for (const point of samplePoints.slice(0, 5)) {
        // Limit to 5 searches to avoid rate limits
        try {
          const poisResponse = await fetch(
            "https://api.openrouteservice.org/pois",
            {
              method: "POST",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                request: "pois",
                geometry: {
                  bbox: [
                    point[0] - 0.05,
                    point[1] - 0.05,
                    point[0] + 0.05,
                    point[1] + 0.05,
                  ],
                  geojson: {
                    type: "Point",
                    coordinates: point,
                  },
                  buffer: 5000, // 5km radius
                },
                filters: {
                  category_ids: [142, 560, 561, 562], // Gas stations, rest areas, restaurants
                },
                limit: 3,
              }),
            }
          );

          if (poisResponse.ok) {
            const poisData = await poisResponse.json();

            poisData.features?.forEach((poi: any) => {
              const props = poi.properties;
              restStops.push({
                name:
                  props.osm_tags?.name || props.category_ids?.[0] === 142
                    ? "Gas Station"
                    : "Rest Area",
                distance: Math.round(
                  calculateDistance(coordinates[0], poi.geometry.coordinates)
                ),
                amenities: getAmenitiesFromPOI(props),
                coordinates: poi.geometry.coordinates,
              });
            });
          }
        } catch (error) {
          console.log("Error fetching POIs for point:", error);
        }
      }

      // Remove duplicates and sort by distance
      const uniqueStops = restStops
        .filter(
          (stop, index, self) =>
            index ===
            self.findIndex(
              (s) =>
                s.name === stop.name &&
                Math.abs(s.coordinates[0] - stop.coordinates[0]) < 0.001
            )
        )
        .sort((a, b) => a.distance - b.distance);

      return uniqueStops.slice(0, 8); // Return max 8 stops
    } catch (error) {
      console.error("Error finding rest stops:", error);
      return [];
    }
  };

  const decodePolyline = (encoded: string) => {
    // Simple polyline decoder - in production, use a proper library
    const coordinates: number[][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push([lng / 1e5, lat / 1e5]);
    }

    return coordinates;
  };

  const sampleRoutePoints = (
    coordinates: number[][],
    intervalMeters: number
  ) => {
    const samples: number[][] = [];
    let totalDistance = 0;
    let lastSampleDistance = 0;

    samples.push(coordinates[0]); // Always include start point

    for (let i = 1; i < coordinates.length; i++) {
      const segmentDistance = calculateDistance(
        coordinates[i - 1],
        coordinates[i]
      );
      totalDistance += segmentDistance;

      if (totalDistance - lastSampleDistance >= intervalMeters) {
        samples.push(coordinates[i]);
        lastSampleDistance = totalDistance;
      }
    }

    return samples;
  };



  const getBreakRecommendations = () => {
    if (!activeRoute) return [];

    const recommendations = [];
    const totalHours = activeRoute.duration / 60;

    if (totalHours > preferences.maxDrivingTime) {
      const breaksNeeded =
        Math.ceil(totalHours / preferences.maxDrivingTime) - 1;
      recommendations.push(`Take ${breaksNeeded} break(s) during this journey`);
    }

    if (activeRoute.restStops && activeRoute.restStops.length > 0) {
      recommendations.push(
        `${activeRoute.restStops.length} rest areas available along the route`
      );
    }

    recommendations.push("Stay hydrated and alert throughout the journey");

    return recommendations;
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Route Planning */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <span className="mr-2">🚗</span>
            Route Planning & Navigation
          </h3>
          <div className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
            Plan Your Journey
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📍 From (Origin)
            </label>
            <div className="relative">
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Enter starting location or coordinates..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {currentLocation && (
                <button
                  onClick={() =>
                    setOrigin(
                      `${currentLocation.lat.toFixed(
                        4
                      )}, ${currentLocation.lon.toFixed(4)}`
                    )
                  }
                  className="absolute right-2 top-2 text-blue-600 hover:text-blue-800 text-xs bg-blue-50 px-2 py-1 rounded"
                >
                  Use Current
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🎯 To (Destination)
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter destination or coordinates..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={calculateOptimalRoute}
            disabled={!origin || !destination || loading}
            className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Calculating Route...</span>
              </>
            ) : (
              <>
                <span>🗺️</span>
                <span>Calculate Route & Start Navigation</span>
              </>
            )}
          </button>

          {activeRoute && (
            <button
              onClick={() => {
                setOrigin("");
                setDestination("");
                setAllRoutes([]);
                setActiveRouteIndex(0);
                setNextStepIndex(0);
                setCurrentRoadName(null);
                dataManager.clearData("activeRoute");
              }}
              className="bg-gray-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors text-sm"
            >
              Clear Route
            </button>
          )}
        </div>

        <div className="mt-3 text-center text-xs text-gray-500">
          Route will be calculated and live tracking will begin automatically
        </div>
      </div>

      {/* Main Map View - Uber style */}
      <div className="card overflow-hidden !p-0 border-2 border-blue-200">
        <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="mr-2">🗺️</span>
            Live Iterative Map
          </h3>
          {currentLocation && (
            <div className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              📍 {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
            </div>
          )}
        </div>
        
        <div className="relative h-[400px]">
          {currentLocation ? (
            <MapView 
              lat={currentLocation.lat}
              lon={currentLocation.lon}
              routeCoordinates={routeCoordinates}
              secondaryRoutes={allRoutes
                .filter((_, idx) => idx !== activeRouteIndex)
                .map(r => r.decodedCoordinates)
              }
              safeStops={mapSafeStops}
              onStopSelect={(stop) => {
                alert(`Selected stop: ${stop.name}\nAddress: ${stop.address}`);
              }}
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Waiting for location access...</p>
              </div>
            </div>
          )}

          {activeRoute && remainingDistance !== null && (
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-200 p-5 min-w-[220px] animate-slide-in">
              <div className="flex flex-col space-y-4">
                {currentRoadName && (
                  <div className="bg-blue-600 -mx-5 -mt-5 px-5 py-2 rounded-t-2xl text-white">
                    <p className="text-[10px] uppercase font-bold opacity-80">Current Road</p>
                    <p className="text-sm font-black truncate">{currentRoadName}</p>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Remaining</p>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-3xl font-black text-blue-600 tracking-tighter">{remainingDistance}</span>
                      <span className="text-xs font-bold text-blue-400 uppercase">km</span>
                    </div>
                  </div>
                  <div className="h-10 w-[2px] bg-gray-100"></div>
                  <div className="flex flex-col text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Est. Arrival</p>
                    <div className="flex items-baseline justify-end space-x-1">
                      <span className="text-2xl font-black text-indigo-600 tracking-tighter">
                        {remainingDuration !== null ? formatDuration(remainingDuration) : "--"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="relative pt-2">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full transition-all duration-1000 ease-out relative"
                      style={{ 
                        width: `${Math.max(5, 100 - (remainingDistance / activeRoute.distance) * 100)}%` 
                      }}
                    >
                      <div className="absolute top-0 right-0 w-2 h-full bg-white/30 animate-pulse"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-gray-500 uppercase">
                    <span>Origin</span>
                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {Math.round(Math.min(100, 100 - (remainingDistance / activeRoute.distance) * 100))}% done
                    </span>
                    <span>Dest.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {allRoutes.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {allRoutes.map((r, idx) => (
            <button
              key={`route-opt-${idx}`}
              onClick={() => {
                setActiveRouteIndex(idx);
                setNextStepIndex(0);
              }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                activeRouteIndex === idx
                  ? "border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  idx === 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {idx === 0 ? "BEST ROUTE" : `ALT ROUTE ${idx}`}
                </span>
                <span className="text-lg font-black text-gray-800">{formatDuration(r.duration)}</span>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1 line-clamp-1">via {r.mainRoad}</p>
              <p className="text-sm font-bold text-blue-600">{r.distance} km</p>
            </button>
          ))}
        </div>
      )}

      {/* Route Preferences */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">⚙️</span>
          Safety Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Continuous Driving Time
            </label>
            <select
              value={preferences.maxDrivingTime}
              onChange={(e) => {
                const newPrefs = {
                  ...preferences,
                  maxDrivingTime: parseInt(e.target.value),
                };
                setPreferences(newPrefs);
                dataManager.savePreferences(newPrefs);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={3}>3 hours</option>
              <option value={4}>4 hours</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.preferRestAreas}
                onChange={(e) => {
                  const newPrefs = {
                    ...preferences,
                    preferRestAreas: e.target.checked,
                  };
                  setPreferences(newPrefs);
                  dataManager.savePreferences(newPrefs);
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Prefer routes with rest areas
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.avoidTolls}
                onChange={(e) => {
                  const newPrefs = {
                    ...preferences,
                    avoidTolls: e.target.checked,
                  };
                  setPreferences(newPrefs);
                  dataManager.savePreferences(newPrefs);
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Avoid toll roads
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.prioritizeSafety}
                onChange={(e) => {
                  const newPrefs = {
                    ...preferences,
                    prioritizeSafety: e.target.checked,
                  };
                  setPreferences(newPrefs);
                  dataManager.savePreferences(newPrefs);
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Prioritize safety over speed
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Route Results & Live Guidance */}
      {activeRoute && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="card !p-0 overflow-hidden border-2 border-indigo-100 shadow-xl">
              <div className="bg-indigo-600 p-4 text-white">
                <h3 className="text-lg font-black flex items-center">
                  <span className="mr-2">🛤️</span>
                  Live Trip Guide
                </h3>
                {activeRoute.majorRoads.length > 0 && (
                  <p className="text-[10px] mt-1 text-indigo-100 font-bold uppercase tracking-widest overflow-hidden text-ellipsis whitespace-nowrap">
                    {activeRoute.majorRoads.join(" • ")}
                  </p>
                )}
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                  <span>Current Leg</span>
                  <span className="text-indigo-600">{formatDuration(activeRoute.duration)}</span>
                </div>
                
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {activeRoute.steps.map((step, index) => {
                    const isPassed = index < nextStepIndex;
                    const isNext = index === nextStepIndex;
                    
                    return (
                      <div 
                        key={`step-${index}`}
                        className={`relative pl-8 pb-4 border-l-2 transition-all duration-500 ${
                          isNext ? "border-indigo-500" : isPassed ? "border-green-400" : "border-gray-200"
                        }`}
                      >
                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                          isNext ? "border-indigo-500 scale-125 shadow-lg shadow-indigo-200" : isPassed ? "border-green-400 bg-green-50" : "border-gray-300"
                        }`}>
                          {isPassed && <span className="text-[8px] text-green-500">✓</span>}
                          {isNext && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></div>}
                        </div>
                        
                        <div className={`${isNext ? "bg-indigo-50 p-3 rounded-xl border border-indigo-100 -mt-1" : ""}`}>
                          <p className={`text-sm font-bold ${
                            isNext ? "text-indigo-900" : isPassed ? "text-gray-400 line-through" : "text-gray-700"
                          }`}>
                            {step.instruction}
                          </p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isNext ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"
                            }`}>
                              {step.distance >= 1000 ? `${(step.distance/1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
                            </span>
                            {step.name && step.name !== "-" && (
                              <span className="text-[10px] text-gray-400 font-medium italic">on {step.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="card bg-gradient-to-br from-indigo-900 to-blue-900 text-white border-0 shadow-2xl">
              <h4 className="text-sm font-black uppercase tracking-tighter opacity-70 mb-4 flex items-center">
                <span className="mr-2">🛡️</span>
                Drive Resilience
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-2xl font-black">94<span className="text-sm opacity-60">%</span></p>
                  <p className="text-[10px] font-bold text-indigo-300">OPTIMAL RANGE</p>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-400 to-indigo-400 h-full w-[94%] shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
                </div>
                <p className="text-[11px] text-indigo-200 italic font-medium leading-relaxed">
                  "Your alertness is peak. NH19 conditions are clear for the next 45km."
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">📍</span>
                Route Overview
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {activeRoute.distance} km
                    </div>
                    <div className="text-sm text-blue-800">Total Distance</div>
                  </div>

                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatDuration(activeRoute.duration)}
                    </div>
                    <div className="text-sm text-green-800">Estimated Time</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-black text-gray-900 mb-4 flex items-center text-sm">
                  <span className="mr-2">🏁</span>
                  DESTINATION REACHABLE IN
                </h4>
                <div className="flex items-center space-x-4">
                  <div className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col items-center">
                    <span className="text-4xl font-black text-gray-800 tracking-tighter">
                      {remainingDuration !== null ? formatDuration(remainingDuration) : "--"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 mt-2">PROJECTED ARRIVAL</span>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">🛑</span>
                Recommended Rest Stops
              </h3>

              <div className="space-y-4">
                {aiRestStops ? (
                  <div className="space-y-3">
                    {aiRestStops.split('\n\n').map((block, index) => {
                      // Skip empty blocks
                      if (!block.trim()) return null;
                      
                      // Check if it's a title/header
                      if (block.startsWith('🛑') || block.startsWith('Found')) {
                        return (
                          <div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-base font-bold text-blue-900">{block}</p>
                          </div>
                        );
                      }
                      
                      // Check if it's a rest stop entry (starts with **)
                      if (block.includes('**')) {
                        const lines = block.split('\n');
                        const nameMatch = lines[0].match(/\*\*(.+?)\*\*/);
                        const name = nameMatch ? nameMatch[1] : lines[0];
                        
                        // Extract details
                        const address = lines.find(l => l.includes('📍'))?.replace('📍', '').trim() || '';
                        const position = lines.find(l => l.includes('📌'))?.replace('📌', '').trim() || '';
                        const rating = lines.find(l => l.includes('⭐'))?.replace('⭐', '').trim() || '';
                        const linkMatch = block.match(/\[View on Google Maps\]\((https?:\/\/[^\)]+)\)/);
                        const link = linkMatch ? linkMatch[1] : '';
                        
                        return (
                          <div key={index} className="card hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">{name}</h4>
                                {address && (
                                  <p className="text-sm text-gray-600 mb-1">
                                    <span className="font-semibold">📍</span> {address}
                                  </p>
                                )}
                                {position && (
                                  <p className="text-sm text-gray-600 mb-1">
                                    <span className="font-semibold">📌</span> {position}
                                  </p>
                                )}
                                {rating && (
                                  <p className="text-sm text-yellow-600 font-semibold mb-2">
                                    ⭐ {rating}
                                  </p>
                                )}
                              </div>
                            </div>
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-semibold"
                              >
                                <span>🗺️</span>
                                <span>View on Google Maps</span>
                              </a>
                            )}
                          </div>
                        );
                      }
                      
                      if (block.includes('💡')) {
                        return (
                          <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-800 font-medium">{block}</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={index} className="text-sm text-gray-700">
                          {block}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>Loading recommendations...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Recommendations */}
      {activeRoute && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">💡</span>
            Safety Recommendations
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                For This Journey
              </h4>
              <div className="space-y-2">
                {getBreakRecommendations().map((rec, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                General Safety Tips
              </h4>
              <div className="space-y-2">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    Take a 15-minute break every 2 hours
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    Stay hydrated throughout the journey
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    Avoid driving during peak drowsiness hours (2-4 AM, 2-4 PM)
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    Pull over immediately if you feel drowsy
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
