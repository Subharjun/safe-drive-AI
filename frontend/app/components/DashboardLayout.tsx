"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import ClientClock from "./ClientClock";
import { dataManager } from "../lib/dataManager";
import LiveRouteTracker from "./LiveRouteTracker";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const clearSessionData = async () => {
    const confirmed = confirm(
      "This will clear all local data and MongoDB data. Are you sure?"
    );
    
    if (!confirmed) return;

    try {
      // Clear local storage
      dataManager.clearAllData();

      // Clear MongoDB data
      const mongoCleared = await dataManager.clearAllMongoData();
      
      if (mongoCleared) {
        alert("All session data cleared successfully (local + MongoDB)!");
      } else {
        alert("Local data cleared. MongoDB clearing failed - check backend connection.");
      }

      // Reload the page to reset the app state
      window.location.reload();
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("Error clearing data. Check console for details.");
    }
  };

  const clearSearchLocations = async () => {
    try {
      const success = await dataManager.clearSearchLocations();
      if (success) {
        alert("Search locations cleared from MongoDB!");
      } else {
        alert("Failed to clear search locations. Check backend connection.");
      }
    } catch (error) {
      console.error("Error clearing search locations:", error);
      alert("Error clearing search locations.");
    }
  };

  const clearMongoSessions = async () => {
    try {
      const success = await dataManager.clearSessionData();
      if (success) {
        alert("Session data cleared from MongoDB!");
      } else {
        alert("Failed to clear session data. Check backend connection.");
      }
    } catch (error) {
      console.error("Error clearing session data:", error);
      alert("Error clearing session data.");
    }
  };

  const exportSessionData = () => {
    const dataStr = dataManager.exportData();
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `driver-wellness-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Professional Top Navigation */}
      <nav className="glass border-b border-white/20 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-18">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                  <span className="text-white font-bold text-lg sm:text-xl">🚗</span>
                </div>
                <div>
                  <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SafeDrive AI
                  </span>
                  <p className="text-xs text-gray-600 hidden sm:block">Intelligent Safety Platform</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              <ClientClock />

              {/* Session Management Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-all px-3 py-2 rounded-lg hover:bg-white/50 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="text-sm hidden sm:inline">Settings</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 glass rounded-xl shadow-2xl border border-white/20 z-50 animate-slide-in">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          exportSessionData();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors font-medium"
                      >
                        <span className="mr-3">💾</span>
                        Export All Data
                      </button>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      
                      <button
                        onClick={() => {
                          clearSearchLocations();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors font-medium"
                      >
                        <span className="mr-3">📍</span>
                        Clear Search Locations
                      </button>
                      
                      <button
                        onClick={() => {
                          clearMongoSessions();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors font-medium"
                      >
                        <span className="mr-3">📊</span>
                        Clear MongoDB Sessions
                      </button>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      
                      <button
                        onClick={() => {
                          clearSessionData();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                      >
                        <span className="mr-3">🗑️</span>
                        Clear All Data
                      </button>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      
                      <button
                        onClick={() => {
                          window.location.reload();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <span className="mr-3">🔄</span>
                        Refresh App
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform cursor-pointer">
                <span className="text-white text-sm sm:text-base font-bold">U</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Draggable Live Route Tracker */}
      <LiveRouteTracker />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:py-8 px-3 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Professional Footer */}
      <footer className="glass border-t border-white/20 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto py-6 px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-gray-700">
                © 2024 SafeDrive AI
              </p>
              <p className="text-xs text-gray-500">
                Powered by Blockchain & Artificial Intelligence
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="badge badge-blue">Celo Blockchain</span>
              <span className="badge badge-green">AI-Powered</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
