/**
 * Location Service - Uses Groq API to find nearby places
 * Works for both safety stops and navigation
 */

interface Place {
  name: string;
  category: string;
  icon: string;
  distance: number;
  coordinates: [number, number]; // [lon, lat]
  address: string;
  amenities: string[];
}

class LocationService {
  private groqApiKey: string;
  private backendUrl: string;

  constructor() {
    this.groqApiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
    this.backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  }

  /**
   * Find nearby places using Groq AI
   */
  async findNearbyPlaces(
    lat: number,
    lon: number,
    type: "safety" | "general" = "safety"
  ): Promise<Place[]> {
    try {
      console.log(
        `🔍 Finding nearby ${type} places near ${lat.toFixed(4)}, ${lon.toFixed(
          4
        )}`
      );

      // First try backend API (ORS)
      const backendPlaces = await this.findViaBackend(lat, lon);
      if (backendPlaces.length > 0) {
        console.log(`✅ Found ${backendPlaces.length} places via backend`);
        return backendPlaces;
      }

      // Fallback to Groq AI
      console.log("⚠️ Backend failed, using Groq AI...");
      const groqPlaces = await this.findViaGroq(lat, lon, type);
      console.log(`✅ Found ${groqPlaces.length} places via Groq AI`);
      return groqPlaces;
    } catch (error) {
      console.error("❌ Error finding places:", error);
      // Return mock data as last resort
      return this.getMockPlaces(lat, lon);
    }
  }

  /**
   * Find places via backend (ORS API)
   */
  private async findViaBackend(lat: number, lon: number): Promise<Place[]> {
    try {
      const response = await fetch(
        `${this.backendUrl}/api/safe-stops?lat=${lat}&lon=${lon}&radius=10000`,
        { timeout: 8000 } as any
      );

      if (response.ok) {
        const data = await response.json();
        return data.safe_stops || [];
      }
      return [];
    } catch (error) {
      console.log("Backend API unavailable");
      return [];
    }
  }

  /**
   * Find places using Groq AI
   */
  private async findViaGroq(
    lat: number,
    lon: number,
    type: string
  ): Promise<Place[]> {
    try {
      const prompt =
        type === "safety"
          ? `Find 5-10 real nearby safe stops (gas stations, rest areas, service stations, parking areas) near coordinates ${lat.toFixed(
              4
            )}, ${lon.toFixed(4)}.

For each place, provide:
- name (actual place name if known, or descriptive name)
- category (Gas Station, Rest Area, Service Station, Parking, etc.)
- approximate distance in meters
- estimated coordinates (slightly offset from center)
- amenities available

Respond ONLY with a JSON array:
[{"name": "...", "category": "...", "distance": 1500, "coordinates": [lon, lat], "amenities": ["Fuel", "Restrooms"]}]`
          : `Find 5-10 real nearby points of interest near coordinates ${lat.toFixed(
              4
            )}, ${lon.toFixed(4)}.

Include restaurants, hotels, attractions, services.

Respond ONLY with a JSON array:
[{"name": "...", "category": "...", "distance": 1500, "coordinates": [lon, lat], "amenities": ["..."]}]`;

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Groq API failed");
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "[]";

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const places = JSON.parse(jsonMatch[0]);

        // Format places
        return places.map((place: any, index: number) => ({
          name: place.name || `Location #${index + 1}`,
          category: place.category || "Point of Interest",
          icon: this.getCategoryIcon(place.category),
          distance: place.distance || Math.random() * 5000 + 500,
          coordinates: place.coordinates || [
            lon + (Math.random() - 0.5) * 0.05,
            lat + (Math.random() - 0.5) * 0.05,
          ],
          address: `Near ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          amenities: place.amenities || ["Services Available"],
        }));
      }

      return [];
    } catch (error) {
      console.error("Groq AI failed:", error);
      return [];
    }
  }

  /**
   * Get mock places as fallback
   */
  private getMockPlaces(lat: number, lon: number): Place[] {
    const types = [
      {
        name: "Shell Gas Station",
        category: "Gas Station",
        icon: "⛽",
        amenities: ["Fuel", "Restrooms", "Food"],
      },
      {
        name: "Highway Rest Area",
        category: "Rest Area",
        icon: "🛑",
        amenities: ["Restrooms", "Parking", "Vending"],
      },
      {
        name: "Service Plaza",
        category: "Service Station",
        icon: "🏪",
        amenities: ["Fuel", "Food", "ATM"],
      },
      {
        name: "Truck Stop",
        category: "Truck Stop",
        icon: "🚛",
        amenities: ["Fuel", "Parking", "Showers"],
      },
      {
        name: "Public Parking",
        category: "Parking",
        icon: "🅿️",
        amenities: ["Parking", "Security"],
      },
    ];

    return types.map((type, index) => ({
      ...type,
      distance: Math.random() * 5000 + 500,
      coordinates: [
        lon + (Math.random() - 0.5) * 0.05,
        lat + (Math.random() - 0.5) * 0.05,
      ] as [number, number],
      address: `Near ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    }));
  }

  /**
   * Get icon for category
   */
  private getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      "Gas Station": "⛽",
      "Rest Area": "🛑",
      "Service Station": "🏪",
      "Truck Stop": "🚛",
      Parking: "🅿️",
      Restaurant: "🍽️",
      Hotel: "🏨",
      Hospital: "🏥",
      Police: "👮",
      Pharmacy: "💊",
    };

    for (const [key, icon] of Object.entries(icons)) {
      if (category.toLowerCase().includes(key.toLowerCase())) {
        return icon;
      }
    }

    return "📍";
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}

export const locationService = new LocationService();
export type { Place };
