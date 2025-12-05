/**
 * Dynamic API client for all external services
 * Uses centralized configuration for all API calls
 */

import { config, getApiUrl } from './config';

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public service?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class APIClient {
  private static instance: APIClient;
  
  static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (response.ok) {
          return response;
        }

        // If it's the last retry or a client error, throw
        if (i === retries - 1 || response.status < 500) {
          throw new APIError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }
      } catch (error) {
        if (i === retries - 1) {
          throw error instanceof APIError 
            ? error 
            : new APIError(`Network error: ${error}`);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    
    throw new APIError('Max retries exceeded');
  }

  /**
   * Geocoding with multiple API fallbacks
   */
  async geocodeLocation(location: string): Promise<[number, number] | null> {
    const apis = [
      {
        name: 'OpenRouteService',
        url: getApiUrl.orsGeocoding(location),
        parser: (data: any) => data.features?.[0]?.geometry?.coordinates as [number, number],
      },
      {
        name: 'Nominatim',
        url: getApiUrl.nominatimGeocoding(location),
        parser: (data: any) => 
          data[0] ? [parseFloat(data[0].lon), parseFloat(data[0].lat)] as [number, number] : null,
      },
    ];

    for (const api of apis) {
      try {
        console.log(`🌍 Trying ${api.name} for: ${location}`);
        const response = await this.fetchWithRetry(api.url);
        const data = await response.json();
        const coordinates = api.parser(data);

        if (coordinates && coordinates.length === 2) {
          console.log(`✅ ${api.name} success:`, coordinates);
          return coordinates;
        }
      } catch (error) {
        console.log(`❌ ${api.name} failed:`, error);
      }
    }

    // Try to parse as direct coordinates
    const coordMatch = location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      const coords: [number, number] = [parseFloat(coordMatch[2]), parseFloat(coordMatch[1])];
      console.log('📍 Parsed as coordinates:', coords);
      return coords;
    }

    return null;
  }

  /**
   * Calculate route using OpenRouteService
   */
  async calculateRoute(
    origin: [number, number],
    destination: [number, number],
    preferences: any = {}
  ): Promise<any> {
    try {
      const response = await this.fetchWithRetry(
        getApiUrl.orsDirections(),
        {
          method: 'POST',
          headers: {
            Authorization: config.apis.openRouteService.key,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            coordinates: [origin, destination],
            format: 'json',
            instructions: true,
            preference: preferences.prioritizeSafety ? 'recommended' : 'fastest',
            options: preferences.avoidTolls ? { avoid_features: ['tollways'] } : {},
          }),
        }
      );

      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        throw new APIError('No routes found between these locations');
      }

      return data.routes[0];
    } catch (error) {
      throw new APIError(
        `Route calculation failed: ${error}`,
        undefined,
        'OpenRouteService'
      );
    }
  }

  /**
   * Get AI recommendations using Groq
   */
  async getAIRecommendations(
    drowsinessLevel: number,
    stressLevel: number,
    context: any = {}
  ): Promise<string[]> {
    try {
      const prompt = `
        Driver wellness analysis:
        - Drowsiness level: ${(drowsinessLevel * 100).toFixed(1)}%
        - Stress level: ${(stressLevel * 100).toFixed(1)}%
        - Context: ${JSON.stringify(context)}
        
        Provide 3-5 specific, actionable safety recommendations for this driver.
        Focus on immediate actions they can take to improve their condition.
        Keep recommendations concise and practical.
      `;

      const response = await this.fetchWithRetry(
        getApiUrl.groqChat(),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apis.groq.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.apis.groq.model,
            messages: [
              {
                role: 'system',
                content: 'You are a driver safety expert providing wellness recommendations.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        }
      );

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse recommendations from response
      return content
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((rec: string) => rec.length > 10)
        .slice(0, 5);
        
    } catch (error) {
      console.error('AI recommendations failed:', error);
      // Return fallback recommendations
      return this.getFallbackRecommendations(drowsinessLevel, stressLevel);
    }
  }

  /**
   * Fallback recommendations when AI service is unavailable
   */
  private getFallbackRecommendations(drowsiness: number, stress: number): string[] {
    const recommendations = [];

    if (drowsiness > 0.7) {
      recommendations.push('Pull over safely and take a 15-20 minute nap');
      recommendations.push('Do not continue driving until you feel alert');
    } else if (drowsiness > 0.5) {
      recommendations.push('Take a break and get some fresh air');
      recommendations.push('Consider switching drivers if possible');
    }

    if (stress > 0.7) {
      recommendations.push('Practice deep breathing exercises');
      recommendations.push('Take a few minutes to relax before continuing');
    } else if (stress > 0.5) {
      recommendations.push('Listen to calming music');
      recommendations.push('Adjust your driving position for comfort');
    }

    if (recommendations.length === 0) {
      recommendations.push('Stay hydrated and maintain good posture');
      recommendations.push('Take regular breaks every 2 hours');
    }

    return recommendations;
  }

  /**
   * Find nearby points of interest
   */
  async findNearbyPOIs(
    lat: number,
    lon: number,
    radius: number = 5000
  ): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(
        getApiUrl.orsPois(),
        {
          method: 'POST',
          headers: {
            Authorization: config.apis.openRouteService.key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            request: 'pois',
            geometry: {
              bbox: [lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05],
              geojson: {
                type: 'Point',
                coordinates: [lon, lat],
              },
              buffer: radius,
            },
            filters: {
              category_ids: [142, 560, 561, 562], // Gas stations, rest areas, restaurants
            },
            limit: 10,
          }),
        }
      );

      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error('POI search failed:', error);
      return [];
    }
  }
}

// Export singleton instance
export const apiClient = APIClient.getInstance();

// Export convenience functions
export const {
  geocodeLocation,
  calculateRoute,
  getAIRecommendations,
  findNearbyPOIs,
} = apiClient;