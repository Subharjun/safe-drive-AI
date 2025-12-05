/**
 * Centralized configuration for all API keys and settings
 * This ensures all components use environment variables dynamically
 */

// Validate that required environment variables are present
const requiredEnvVars = {
  ORS_API_KEY: process.env.NEXT_PUBLIC_ORS_API_KEY,
  GROQ_API_KEY: process.env.NEXT_PUBLIC_GROQ_API_KEY,
} as const;

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env.local file');
}

export const config = {
  // API Keys
  apis: {
    openRouteService: {
      key: process.env.NEXT_PUBLIC_ORS_API_KEY || '',
      baseUrl: 'https://api.openrouteservice.org',
      endpoints: {
        geocoding: '/geocode/search',
        directions: '/v2/directions/driving-car',
        pois: '/pois',
      },
    },
    groq: {
      key: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'mixtral-8x7b-32768',
    },
    nominatim: {
      baseUrl: 'https://nominatim.openstreetmap.org',
      endpoint: '/search',
    },
  },

  // Database
  database: {
    mongoUri: process.env.MONGODB_URI || '',
  },

  // Application Settings
  app: {
    name: 'Driver Wellness Monitor',
    version: '1.0.0',
    description: 'AI-Enhanced Safety and Wellness Monitoring System',
  },

  // Map Settings
  map: {
    defaultLocation: {
      lat: 37.7749,
      lon: -122.4194,
      name: 'San Francisco, CA',
    },
    zoom: {
      default: 13,
      expanded: 14,
      compact: 12,
    },
    tileLayer: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },

  // Route Settings
  routing: {
    maxRecentRoutes: 5,
    defaultPreferences: {
      maxDrivingTime: 2, // hours
      preferRestAreas: true,
      avoidTolls: false,
      prioritizeSafety: true,
    },
    geocoding: {
      maxRetries: 3,
      timeout: 10000, // 10 seconds
    },
  },

  // Wellness Monitoring
  wellness: {
    updateInterval: 2000, // 2 seconds
    historyLimit: 100, // max data points to store
    alertThresholds: {
      drowsiness: {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
      },
      stress: {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
      },
    },
  },

  // UI Settings
  ui: {
    theme: {
      primary: '#2563eb',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
    animations: {
      duration: 300,
      easing: 'ease-in-out',
    },
  },
} as const;

// Helper functions for API URLs
export const getApiUrl = {
  orsGeocoding: (query: string) => 
    `${config.apis.openRouteService.baseUrl}${config.apis.openRouteService.endpoints.geocoding}?api_key=${config.apis.openRouteService.key}&text=${encodeURIComponent(query)}&size=1`,
  
  orsDirections: () => 
    `${config.apis.openRouteService.baseUrl}${config.apis.openRouteService.endpoints.directions}`,
  
  orsPois: () => 
    `${config.apis.openRouteService.baseUrl}${config.apis.openRouteService.endpoints.pois}`,
  
  nominatimGeocoding: (query: string) => 
    `${config.apis.nominatim.baseUrl}${config.apis.nominatim.endpoint}?format=json&q=${encodeURIComponent(query)}&limit=1`,
  
  groqChat: () => 
    `${config.apis.groq.baseUrl}/chat/completions`,
};

// Validation helper
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!config.apis.openRouteService.key) {
    errors.push('OpenRouteService API key is missing');
  }
  
  if (!config.apis.groq.key) {
    errors.push('Groq API key is missing');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Export individual configs for convenience
export const { apis, database, app, map, routing, wellness, ui } = config;

export default config;