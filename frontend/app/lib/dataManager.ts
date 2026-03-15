/**
 * Data Management System for Driver Wellness Monitor
 * Handles localStorage, sessionStorage, and MongoDB operations
 */

interface SessionData {
  routes: any[];
  wellness: any[];
  preferences: any;
  timestamp: string;
}

interface StorageOptions {
  persistent?: boolean; // Use localStorage (true) or sessionStorage (false)
  autoSave?: boolean;   // Auto-save changes
  maxItems?: number;    // Maximum items to store
}

export class DataManager {
  private static instance: DataManager;
  private storageKey = 'driverWellnessData';
  
  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  /**
   * Save data to storage (persists across tabs, resets on reload unless persistent)
   */
  saveData(key: string, data: any, options: StorageOptions = {}): void {
    const { persistent = false, maxItems = 100 } = options;
    const storage = persistent ? localStorage : sessionStorage;
    
    try {
      // Get existing data
      const existingData = this.getData(key, { persistent }) || [];
      
      // Add new data
      let updatedData;
      if (Array.isArray(existingData)) {
        updatedData = [data, ...existingData].slice(0, maxItems);
      } else {
        updatedData = data;
      }
      
      storage.setItem(key, JSON.stringify(updatedData));
      console.log(`💾 Saved ${key} to ${persistent ? 'localStorage' : 'sessionStorage'}`);
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }

  /**
   * Get data from storage
   */
  getData(key: string, options: StorageOptions = {}): any {
    const { persistent = false } = options;
    const storage = persistent ? localStorage : sessionStorage;
    
    try {
      const data = storage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear specific data
   */
  clearData(key: string, options: StorageOptions = {}): void {
    const { persistent = false } = options;
    const storage = persistent ? localStorage : sessionStorage;
    
    storage.removeItem(key);
    console.log(`🗑️ Cleared ${key} from ${persistent ? 'localStorage' : 'sessionStorage'}`);
  }

  /**
   * Clear all application data
   */
  clearAllData(): void {
    // Clear localStorage
    const localKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('driverWellness') || 
      key.startsWith('route') || 
      key.startsWith('wellness')
    );
    localKeys.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('driverWellness') || 
      key.startsWith('route') || 
      key.startsWith('wellness')
    );
    sessionKeys.forEach(key => sessionStorage.removeItem(key));
    
    console.log('🧹 Cleared all application data');
  }

  /**
   * Export all data for backup
   */
  exportData(): string {
    const data = {
      localStorage: this.getStorageData(localStorage),
      sessionStorage: this.getStorageData(sessionStorage),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from backup
   */
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      // Restore localStorage
      if (data.localStorage) {
        Object.entries(data.localStorage).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      }
      
      // Restore sessionStorage
      if (data.sessionStorage) {
        Object.entries(data.sessionStorage).forEach(([key, value]) => {
          sessionStorage.setItem(key, JSON.stringify(value));
        });
      }
      
      console.log('📥 Data imported successfully');
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Get storage data for export
   */
  private getStorageData(storage: Storage): Record<string, any> {
    const data: Record<string, any> = {};
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (key.startsWith('driverWellness') || key.startsWith('route') || key.startsWith('wellness'))) {
        try {
          data[key] = JSON.parse(storage.getItem(key) || '');
        } catch {
          data[key] = storage.getItem(key);
        }
      }
    }
    
    return data;
  }

  /**
   * Save route data (persists across sessions)
   */
  saveRoute(route: any): void {
    this.saveData('recentRoutes', route, { persistent: true, maxItems: 5 });
    
    // Also save active route for live tracking
    if (route.coordinates) {
      this.saveData('activeRoute', route, { persistent: false }); // Active route clears on reload
    }
  }

  /**
   * Get recent routes
   */
  getRecentRoutes(): any[] {
    return this.getData('recentRoutes', { persistent: false }) || [];
  }

  /**
   * Save wellness data (now uses MongoDB via backend API)
   * Note: Data is automatically saved by backend when monitoring is active
   */
  saveWellnessData(data: any): void {
    // Data is now saved automatically by backend API
    // This method kept for backward compatibility
    console.log('💾 Wellness data saved to MongoDB via backend API');
  }

  /**
   * Get wellness history from MongoDB
   */
  async getWellnessHistory(): Promise<any[]> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/wellness/history`);
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Retrieved ${data.count} wellness records from MongoDB`);
        return data.history || [];
      } else {
        console.error('Failed to fetch wellness history from MongoDB');
        return [];
      }
    } catch (error) {
      console.error('Error fetching wellness history:', error);
      return [];
    }
  }

  /**
   * Get grouped wellness sessions from MongoDB
   */
  async getWellnessSessions(): Promise<any[]> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/wellness/sessions`);
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Retrieved ${data.total_sessions} sessions (${data.total_records} records) from MongoDB`);
        return data.sessions || [];
      } else {
        console.error('Failed to fetch wellness sessions from MongoDB');
        return [];
      }
    } catch (error) {
      console.error('Error fetching wellness sessions:', error);
      return [];
    }
  }

  /**
   * Delete a specific wellness session from MongoDB
   */
  async deleteSession(sessionId: string, startTime: string, endTime: string): Promise<boolean> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/wellness/sessions/${sessionId}?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`🗑️ Deleted session ${sessionId}: ${data.message}`);
        return true;
      } else {
        console.error('Failed to delete wellness session');
        return false;
      }
    } catch (error) {
      console.error('Error deleting wellness session:', error);
      return false;
    }
  }

  /**
   * Clear all wellness data from MongoDB
   */
  async clearWellnessData(): Promise<boolean> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/wellness/clear`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`🗑️ Cleared ${data.deleted_count} records from MongoDB`);
        return true;
      } else {
        console.error('Failed to clear wellness data from MongoDB');
        return false;
      }
    } catch (error) {
      console.error('Error clearing wellness data:', error);
      return false;
    }
  }

  /**
   * Save user preferences (persistent)
   */
  savePreferences(preferences: any): void {
    this.saveData('userPreferences', preferences, { persistent: true });
  }

  /**
   * Get user preferences
   */
  getPreferences(): any {
    return this.getData('userPreferences', { persistent: true }) || {};
  }

  /**
   * Delete data from MongoDB (requires backend API)
   */
  async deleteFromMongoDB(collection: string, filter: any = {}): Promise<boolean> {
    try {
      const response = await fetch('/api/data/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection,
          filter
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`🗑️ Deleted ${result.deletedCount} documents from ${collection}`);
        return true;
      } else {
        console.error('Failed to delete from MongoDB:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error deleting from MongoDB:', error);
      return false;
    }
  }

  /**
   * Clear search locations from MongoDB
   */
  async clearSearchLocations(): Promise<boolean> {
    return this.deleteFromMongoDB('search_locations');
  }

  /**
   * Clear session data from MongoDB (monitoring_sessions collection)
   */
  async clearSessionData(): Promise<boolean> {
    return this.deleteFromMongoDB('monitoring_sessions');
  }

  /**
   * Clear only analytics/monitoring data permanently
   */
  async clearAnalyticsData(): Promise<boolean> {
    try {
      // Clear from MongoDB
      const mongoCleared = await this.deleteFromMongoDB('monitoring_sessions');
      
      // Clear from localStorage
      this.clearData('wellnessHistory');
      
      console.log('✅ Analytics data cleared permanently');
      return mongoCleared;
    } catch (error) {
      console.error('❌ Error clearing analytics data:', error);
      return false;
    }
  }

  /**
   * Clear all MongoDB data - deletes from actual backend collections
   */
  async clearAllMongoData(): Promise<boolean> {
    // These are the actual collection names used by the backend
    const collections = [
      'monitoring_sessions',  // Main wellness data
      'search_locations',     // Search history
      'route_history'         // Route data
    ];
    
    const results = await Promise.all(
      collections.map(collection => this.deleteFromMongoDB(collection))
    );
    
    console.log('🗑️ MongoDB deletion results:', results);
    return results.every(result => result);
  }
}

// Export singleton instance
export const dataManager = DataManager.getInstance();

// Export convenience functions
export const {
  saveData,
  getData,
  clearData,
  clearAllData,
  exportData,
  importData,
  saveRoute,
  getRecentRoutes,
  saveWellnessData,
  getWellnessHistory,
  getWellnessSessions,
  deleteSession,
  clearWellnessData,
  savePreferences,
  getPreferences,
  deleteFromMongoDB,
  clearSearchLocations,
  clearSessionData,
  clearAllMongoData,
  clearAnalyticsData,
} = dataManager;