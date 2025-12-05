"use client";

import { useState, useEffect } from "react";
import { config, validateConfig } from "../lib/config";
import { apiClient } from "../lib/api";
import { dataManager } from "../lib/dataManager";

// Removed unused interface RoutePoint

interface RouteSegment {
  distance: number;
  duration: number;
  instructions: string[];
  restStops: any[];
}

interface RoutePreferences {
  maxDrivingTime: number;
  preferRestAreas: boolean;
  avoidTolls: boolean;
  prioritizeSafety: boolean;
}

export default function RouteOptimizer() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [route, setRoute] = useState<RouteSegment | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [preferences, setPreferences] = useState<RoutePreferences>({
    maxDrivingTime: config.routing.defaultPreferences.maxDrivingTime,
    preferRestAreas: config.routing.defaultPreferences.preferRestAreas,
    avoidTolls: config.routing.defaultPreferences.avoidTolls,
    prioritizeSafety: config.routing.defaultPreferences.prioritizeSafety,
  });
  const [aiRestStops, setAiRestStops] = useState<string>("");

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lon: longitude });
        },
        () => {
          console.log("Location access denied, using default location");
          const { lat: defaultLat, lon: defaultLon } =
            config.map.defaultLocation;
          setCurrentLocation({ lat: defaultLat, lon: defaultLon });
        }
      );
    }

    // Load saved preferences (persistent)
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
            model: "llama3-8b-8192",
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

      // Calculate route using API client
      const route = await apiClient.calculateRoute(
        originCoords,
        destCoords,
        preferences
      );
      console.log("Route calculated:", route);

      // Decode the route geometry for map display
      const decodedCoordinates = decodePolyline(route.geometry);

      // Find rest stops along the route (simplified for now)
      const restStops: any[] = [];

      const calculatedRoute: RouteSegment = {
        distance: Math.round((route.summary.distance / 1000) * 10) / 10, // Convert to km and round
        duration: Math.round(route.summary.duration / 60), // Convert to minutes
        instructions: route.segments?.flatMap(
          (segment: any) =>
            segment.steps?.map((step: any) => step.instruction) || []
        ) || ["Route calculated successfully"],
        restStops: restStops,
      };

      console.log("Calculated route:", calculatedRoute);
      console.log("Route coordinates:", decodedCoordinates.length, "points");
      setRoute(calculatedRoute);

      // Fetch real rest stops using SerpAPI
      fetchRealRestStops(origin, destination, decodedCoordinates);

      // Save route for live tracking
      const routeForTracking = {
        origin,
        destination,
        coordinates: decodedCoordinates,
        distance: calculatedRoute.distance,
        duration: calculatedRoute.duration,
        currentProgress: 0,
      };

      dataManager.saveData("activeRoute", routeForTracking);

      // Show success message with route info
      alert(
        `Route calculated successfully!\n\nDistance: ${
          calculatedRoute.distance
        } km\nDuration: ${formatDuration(
          calculatedRoute.duration
        )}\n\nLive tracking is now available in the draggable widget.`
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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getBreakRecommendations = () => {
    if (!route) return [];

    const recommendations = [];
    const totalHours = route.duration / 60;

    if (totalHours > preferences.maxDrivingTime) {
      const breaksNeeded =
        Math.ceil(totalHours / preferences.maxDrivingTime) - 1;
      recommendations.push(`Take ${breaksNeeded} break(s) during this journey`);
    }

    if (route.restStops.length > 0) {
      recommendations.push(
        `${route.restStops.length} rest areas available along the route`
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

          {route && (
            <button
              onClick={() => {
                setOrigin("");
                setDestination("");
                setRoute(null);
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

      {/* Route Results */}
      {route && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📍</span>
              Route Overview
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {route.distance} km
                  </div>
                  <div className="text-sm text-blue-800">Total Distance</div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatDuration(route.duration)}
                  </div>
                  <div className="text-sm text-green-800">Estimated Time</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Turn-by-turn Directions
                </h4>
                <div className="space-y-2">
                  {route.instructions.map((instruction, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <p className="text-sm text-gray-700">{instruction}</p>
                    </div>
                  ))}
                </div>
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
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      );
                    }
                    
                    // Safety tip or other text
                    if (block.includes('💡')) {
                      return (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm text-green-800 font-medium">{block}</p>
                        </div>
                      );
                    }
                    
                    // Default text
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
      )}

      {/* Safety Recommendations */}
      {route && (
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
