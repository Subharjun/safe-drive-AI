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
   * Save route data (persists across tabs)
   */
  saveRoute(route: any): void {
    this.saveData('recentRoutes', route, { persistent: false, maxItems: 5 });
    
    // Also save active route for live tracking
    if (route.coordinates) {
      this.saveData('activeRoute', route, { persistent: false });
    }
  }

  /**
   * Get recent routes
   */
  getRecentRoutes(): any[] {
    return this.getData('recentRoutes', { persistent: false }) || [];
  }

  /**
   * Save wellness data
   */
  saveWellnessData(data: any): void {
    this.saveData('wellnessHistory', data, { persistent: false, maxItems: 100 });
  }

  /**
   * Get wellness history
   */
  getWellnessHistory(): any[] {
    return this.getData('wellnessHistory', { persistent: false }) || [];
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
   * Clear session data from MongoDB
   */
  async clearSessionData(): Promise<boolean> {
    return this.deleteFromMongoDB('wellness_sessions');
  }

  /**
   * Clear all MongoDB data
   */
  async clearAllMongoData(): Promise<boolean> {
    const collections = ['search_locations', 'wellness_sessions', 'route_history'];
    const results = await Promise.all(
      collections.map(collection => this.deleteFromMongoDB(collection))
    );
    
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
  savePreferences,
  getPreferences,
  deleteFromMongoDB,
  clearSearchLocations,
  clearSessionData,
  clearAllMongoData,
} = dataManager;