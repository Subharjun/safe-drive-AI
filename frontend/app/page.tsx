'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from './components/DashboardLayout'
import VideoMonitor from './components/VideoMonitor'
import RouteOptimizer from './components/RouteOptimizer'
import CombinedDashboard from './components/CombinedDashboard'
import SafetyAlerts from './components/SafetyAlerts'
import BlockchainDashboard from './components/BlockchainDashboard'

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [monitoringData, setMonitoringData] = useState<{
    drowsiness: number;
    stress: number;
    isActive: boolean;
    lastUpdate: Date | null;
  }>({
    drowsiness: 0,
    stress: 0,
    isActive: false,
    lastUpdate: null
  })

  // Listen for custom tab switch events from components
  useEffect(() => {
    const handleTabSwitch = (event: CustomEvent) => {
      setActiveTab(event.detail)
    }

    window.addEventListener('switchTab', handleTabSwitch as EventListener)
    
    return () => {
      window.removeEventListener('switchTab', handleTabSwitch as EventListener)
    }
  }, [])

  const tabs = [
    { id: 'routes', label: 'Navigation & Routes', icon: '🗺️' },
    { id: 'monitor', label: 'Live Monitor', icon: '📹' },
    { id: 'dashboard', label: 'Wellness & Analytics', icon: '📊' },
    { id: 'alerts', label: 'Safety Alerts', icon: '🚨' },
    { id: 'blockchain', label: 'Blockchain', icon: '🔗' }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'monitor':
        return <VideoMonitor onDataUpdate={setMonitoringData} />
      case 'routes':
        return <RouteOptimizer />
      case 'dashboard':
        return <CombinedDashboard data={monitoringData} onNavigateToMonitor={() => setActiveTab('monitor')} />
      case 'alerts':
        return <SafetyAlerts data={monitoringData} />
      case 'blockchain':
        return <BlockchainDashboard 
          currentSafetyMetrics={
            monitoringData.isActive
              ? {
                  drowsinessLevel: monitoringData.drowsiness * 100,
                  stressLevel: monitoringData.stress * 100,
                  interventionCount: 0,
                  routeCompliance: 95,
                  drivingDuration: 0,
                }
              : undefined
          }
        />
      default:
        return <CombinedDashboard data={monitoringData} onNavigateToMonitor={() => setActiveTab('monitor')} />
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Professional Header with Gradient */}
        <div className="glass rounded-2xl p-4 sm:p-8 animate-slide-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🚗</span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SafeDrive AI
                  </h1>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium">
                    AI-Powered Driver Wellness & Safety Platform
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => setActiveTab('routes')}
                className="btn-secondary text-xs sm:text-sm flex items-center space-x-2 no-print"
              >
                <span>🗺️</span>
                <span>Quick Maps</span>
              </button>
              <div className={`status-indicator ${
                monitoringData.isActive ? 'status-safe animate-pulse-glow' : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full mr-2 ${
                  monitoringData.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                <span className="font-semibold">{monitoringData.isActive ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Navigation Tabs */}
        <div className="glass rounded-2xl overflow-hidden animate-slide-in">
          <div className="border-b border-gray-200/50 overflow-x-auto bg-gradient-to-r from-gray-50 to-blue-50/30">
            <nav className="flex space-x-1 px-4 sm:px-6 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-4 sm:px-6 font-semibold text-xs sm:text-sm transition-all duration-300 whitespace-nowrap relative ${
                    activeTab === tab.id
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">
                      {tab.label.split(' ')[0]}
                    </span>
                  </div>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-full"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Tab Content with Animation */}
          <div className="p-4 sm:p-8 bg-white/50">
            <div className="animate-fade-in">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}