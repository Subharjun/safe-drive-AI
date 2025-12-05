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
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">DW</span>
                </div>
                <span className="ml-3 text-xl font-semibold text-gray-900">
                  Driver Wellness
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ClientClock />

              {/* Session Management Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="text-sm">Session</span>
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
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportSessionData();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <span className="mr-2">💾</span>
                        Export All Data
                      </button>
                      
                      <button
                        onClick={() => {
                          clearSearchLocations();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                      >
                        <span className="mr-2">📍</span>
                        Clear Search Locations
                      </button>
                      
                      <button
                        onClick={() => {
                          clearMongoSessions();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                      >
                        <span className="mr-2">📊</span>
                        Clear MongoDB Sessions
                      </button>
                      
                      <button
                        onClick={() => {
                          clearSessionData();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <span className="mr-2">🗑️</span>
                        Clear All Data
                      </button>
                      <div className="border-t border-gray-100 my-1"></div>
                      <button
                        onClick={() => {
                          window.location.reload();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <span className="mr-2">🔄</span>
                        Refresh App
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">U</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Draggable Live Route Tracker */}
      <LiveRouteTracker />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            © 2024 Driver Wellness Monitor. AI-Enhanced Safety System.
          </div>
        </div>
      </footer>
    </div>
  );
}
