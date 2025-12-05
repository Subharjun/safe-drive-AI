"use client";

import { useState, useEffect } from "react";
import MapView from "./MapView";
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
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<number[][]>([]);
  const [preferences, setPreferences] = useState<RoutePreferences>({
    maxDrivingTime: config.routing.defaultPreferences.maxDrivingTime,
    preferRestAreas: config.routing.defaultPreferences.preferRestAreas,
    avoidTolls: config.routing.defaultPreferences.avoidTolls,
    prioritizeSafety: config.routing.defaultPreferences.prioritizeSafety,
  });
  const [recentRoutes, setRecentRoutes] = useState<
    Array<{ origin: string; destination: string; timestamp: string }>
  >([]);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lon: longitude });
          fetchNearbySafeStops(latitude, longitude);
        },
        () => {
          console.log("Location access denied, using default location");
          // Use default location from config
          const { lat: defaultLat, lon: defaultLon } =
            config.map.defaultLocation;
          setCurrentLocation({ lat: defaultLat, lon: defaultLon });
          fetchNearbySafeStops(defaultLat, defaultLon);
        }
      );
    }

    // Load recent routes (persists across tabs)
    const savedRoutes = dataManager.getRecentRoutes();
    if (savedRoutes.length > 0) {
      setRecentRoutes(savedRoutes);
    }

    // Load saved preferences (persistent)
    const savedPrefs = dataManager.getPreferences();
    if (savedPrefs.maxDrivingTime) {
      setPreferences((prev) => ({ ...prev, ...savedPrefs }));
    }
  }, []);

  const fetchNearbySafeStops = async (lat: number, lon: number) => {
    try {
      console.log("🔍 Fetching real nearby stops for:", { lat, lon });

      // Use the API client to find real POIs
      const pois = await apiClient.findNearbyPOIs(lat, lon, 10000); // 10km radius
      
      if (pois.length > 0) {
        const stops = pois.map((poi: any, index: number) => {
          const props = poi.properties || {};
          const coords = poi.geometry?.coordinates || [lon, lat];
          
          // Determine category and icon based on POI data
          let category = "Service Station";
          let icon = "🏪";
          
          if (props.category_ids?.includes(142) || props.osm_tags?.amenity === 'fuel') {
            category = "Gas Station";
            icon = "⛽";
          } else if (props.osm_tags?.highway === 'rest_area') {
            category = "Rest Area";
            icon = "🛑";
          } else if (props.osm_tags?.amenity === 'restaurant') {
            category = "Restaurant";
            icon = "🍽️";
          } else if (props.osm_tags?.tourism === 'hotel') {
            category = "Hotel";
            icon = "🏨";
          }

          // Extract amenities from OSM tags
          const amenities = [];
          if (props.osm_tags?.fuel || props.category_ids?.includes(142)) amenities.push("Fuel");
          if (props.osm_tags?.toilets) amenities.push("Restrooms");
          if (props.osm_tags?.restaurant || props.osm_tags?.fast_food) amenities.push("Food");
          if (props.osm_tags?.parking) amenities.push("Parking");
          if (props.osm_tags?.atm) amenities.push("ATM");
          if (amenities.length === 0) amenities.push("Services Available");

          return {
            name: props.osm_tags?.name || `${category} #${index + 1}`,
            category,
            icon,
            distance: Math.round(calculateDistance([lon, lat], coords)),
            coordinates: coords,
            amenities,
          };
        });

        setNearbyStops(stops);
        console.log(`✅ Found ${stops.length} real nearby stops`);
      } else {
        console.log("⚠️ No POIs found, trying alternative search...");
        
        // Fallback: Try a broader search with different parameters
        const fallbackPois = await apiClient.findNearbyPOIs(lat, lon, 20000); // 20km radius
        
        if (fallbackPois.length > 0) {
          const stops = fallbackPois.slice(0, 5).map((poi: any, index: number) => ({
            name: poi.properties?.osm_tags?.name || `Service Location #${index + 1}`,
            category: "Service Station",
            icon: "🏪",
            distance: Math.round(calculateDistance([lon, lat], poi.geometry?.coordinates || [lon, lat])),
            coordinates: poi.geometry?.coordinates || [lon, lat],
            amenities: ["Services Available"],
          }));
          
          setNearbyStops(stops);
          console.log(`✅ Found ${stops.length} fallback stops`);
        } else {
          console.log("❌ No nearby stops found in area");
          setNearbyStops([]);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching nearby stops:", error);
      setNearbyStops([]);
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
      setRouteCoordinates(decodedCoordinates);

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

      // Auto-show map when route is calculated
      setShowMap(true);

      // Save to recent routes
      const newRoute = {
        origin,
        destination,
        timestamp: new Date().toISOString(),
      };

      const updatedRoutes = [
        newRoute,
        ...recentRoutes.filter(
          (r) => !(r.origin === origin && r.destination === destination)
        ),
      ].slice(0, config.routing.maxRecentRoutes);

      setRecentRoutes(updatedRoutes);
      dataManager.saveData("recentRoutes", updatedRoutes);

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
                setRouteCoordinates([]);
                dataManager.clearData("activeRoute");
              }}
              className="bg-gray-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors text-sm"
            >
              Clear Route
            </button>
          )}
        </div>

        {/* Recent Routes */}
        {recentRoutes.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🕒 Recent Routes
            </label>
            <div className="space-y-2">
              {recentRoutes.slice(0, 3).map((route, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setOrigin(route.origin);
                    setDestination(route.destination);
                  }}
                  className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {route.origin} → {route.destination}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {new Date(route.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-blue-600">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 text-center text-xs text-gray-500">
          Route will be calculated and live tracking will begin automatically
        </div>
      </div>

      {/* Interactive Map */}
      {currentLocation && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="mr-2">🗺️</span>
              Interactive Map & Nearby Safe Stops
            </h3>
            <button
              onClick={() => setShowMap(!showMap)}
              className="btn-secondary text-sm"
            >
              {showMap ? "Hide Map" : "Show Map"}
            </button>
          </div>

          {showMap && (
            <div>
              {nearbyStops.length === 0 ? (
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">
                      Loading nearby safe stops...
                    </p>
                  </div>
                </div>
              ) : (
                <MapView
                  lat={currentLocation.lat}
                  lon={currentLocation.lon}
                  safeStops={nearbyStops}
                  routeCoordinates={routeCoordinates}
                  onStopSelect={(stop) => {
                    console.log("Selected stop:", stop);
                  }}
                />
              )}
            </div>
          )}
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
              {route.restStops.map((stop, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{stop.name}</h4>
                    <span className="text-sm text-gray-500">
                      {stop.distance} km
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {stop.amenities.map(
                      (amenity: string, amenityIndex: number) => (
                        <span
                          key={amenityIndex}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {amenity}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}

              {route.restStops.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🚫</div>
                  <p>No rest stops found along this route</p>
                  <p className="text-sm">
                    Consider planning alternative breaks
                  </p>
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
