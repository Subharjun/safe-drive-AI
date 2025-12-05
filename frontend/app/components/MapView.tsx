"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import Leaflet components to avoid SSR issues
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
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

interface MapViewProps {
  lat: number;
  lon: number;
  safeStops: any[];
  routeCoordinates?: number[][];
  onStopSelect?: (stop: any) => void;
}

export default function MapView({
  lat,
  lon,
  safeStops,
  routeCoordinates,
  onStopSelect,
}: MapViewProps) {
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);

  // Load Leaflet dynamically
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

  const handleStopSelect = useCallback(
    (stop: any) => {
      setSelectedStop(stop);
      onStopSelect?.(stop);
    },
    [onStopSelect]
  );

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/@${lat},${lon},15z`, "_blank");
  };

  // Create custom icons
  const createCustomIcon = (color: string, icon: string) => {
    if (!L) return null;

    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
          ${icon}
        </div>
      `,
      className: "custom-div-icon",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  const currentLocationIcon = createCustomIcon("#ef4444", "📍");
  const safeStopIcon = createCustomIcon("#22c55e", "🛑");

  if (!mapLoaded) {
    return (
      <div className="w-full">
        <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading interactive map...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Interactive Leaflet Map */}
      <div className="w-full h-96 rounded-xl border-2 border-blue-300 shadow-lg overflow-hidden relative">
        <MapContainer
          center={[lat, lon]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Current Location Marker */}
          <Marker position={[lat, lon]} icon={currentLocationIcon}>
            <Popup>
              <div className="text-center">
                <strong>📍 Your Current Location</strong>
                <br />
                <small>
                  {lat.toFixed(4)}, {lon.toFixed(4)}
                </small>
              </div>
            </Popup>
          </Marker>

          {/* Safe Stop Markers */}
          {safeStops.map((stop, index) => {
            const stopLat = stop.coordinates[1];
            const stopLon = stop.coordinates[0];

            return (
              <Marker
                key={`stop-${index}`}
                position={[stopLat, stopLon]}
                icon={safeStopIcon}
                eventHandlers={{
                  click: () => handleStopSelect(stop),
                }}
              >
                <Popup>
                  <div className="text-center min-w-48">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <span className="text-lg">{stop.icon}</span>
                      <strong>{stop.name}</strong>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {stop.category} • {(stop.distance / 1000).toFixed(1)} km
                      away
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {stop.amenities.map((amenity: string, i: number) => (
                        <span
                          key={i}
                          className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${stopLat},${stopLon}`,
                          "_blank"
                        );
                      }}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                    >
                      🧭 Navigate Here
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Route Polyline */}
          {routeCoordinates && routeCoordinates.length > 0 && (
            <Polyline
              positions={routeCoordinates.map(
                (coord) => [coord[1], coord[0]] as [number, number]
              )}
              color="#3b82f6"
              weight={4}
              opacity={0.8}
            />
          )}
        </MapContainer>

        {/* Map Controls Overlay */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          <button
            onClick={openGoogleMaps}
            className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors shadow-md"
          >
            🌍 Google Maps
          </button>
        </div>

        {/* Map Info Overlay */}
        <div className="absolute bottom-2 left-2 z-10 bg-white bg-opacity-90 px-2 py-1 rounded text-xs text-gray-700 border border-gray-300">
          Interactive Map • Zoom & Pan
        </div>
      </div>

      {/* Map Legend */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full border border-white"></div>
            <span>Your Location</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full border border-white"></div>
            <span>Safe Stops</span>
          </div>
          {routeCoordinates && (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-1 bg-blue-500 rounded"></div>
              <span>Route</span>
            </div>
          )}
        </div>
        <div className="text-gray-500">
          Click markers for details • {safeStops.length} stops found
        </div>
      </div>

      {/* Selected Stop Info */}
      {selectedStop && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-900 flex items-center space-x-2">
                <span>{selectedStop.icon}</span>
                <span>{selectedStop.name}</span>
              </div>
              <div className="text-sm text-blue-700">
                {selectedStop.category} •{" "}
                {(selectedStop.distance / 1000).toFixed(1)} km away
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedStop.amenities.map((amenity: string, i: number) => (
                  <span
                    key={i}
                    className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                const coords = selectedStop.coordinates;
                if (coords && coords.length >= 2) {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`,
                    "_blank"
                  );
                }
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
            >
              Navigate
            </button>
          </div>
        </div>
      )}

      {/* Safe Stops Grid */}
      {safeStops.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {safeStops.slice(0, 8).map((stop, index) => (
            <div
              key={`${stop.name}-${index}`}
              className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                selectedStop?.name === stop.name
                  ? "bg-blue-100 border-blue-300"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => handleStopSelect(stop)}
            >
              <div className="text-center">
                <div className="text-lg mb-1">{stop.icon}</div>
                <div className="font-medium text-xs text-gray-900 truncate">
                  {stop.name}
                </div>
                <div className="text-xs text-gray-500">
                  {(stop.distance / 1000).toFixed(1)} km
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
