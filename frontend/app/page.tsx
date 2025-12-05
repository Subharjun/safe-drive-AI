'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from './components/DashboardLayout'
import VideoMonitor from './components/VideoMonitor'
import RouteOptimizer from './components/RouteOptimizer'
import CombinedDashboard from './components/CombinedDashboard'

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
    { id: 'dashboard', label: 'Wellness Dashboard', icon: '📊' }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'monitor':
        return <VideoMonitor onDataUpdate={setMonitoringData} />
      case 'routes':
        return <RouteOptimizer />
      case 'dashboard':
        return <CombinedDashboard data={monitoringData} onNavigateToMonitor={() => setActiveTab('monitor')} />
      default:
        return <CombinedDashboard data={monitoringData} onNavigateToMonitor={() => setActiveTab('monitor')} />
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Driver Wellness Monitor
              </h1>
              <p className="text-gray-600 mt-1">
                AI-Enhanced Safety and Wellness Monitoring System
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('routes')}
                className="btn-secondary text-sm flex items-center space-x-2"
              >
                <span>🗺️</span>
                <span>Quick Maps</span>
              </button>
              <div className={`status-indicator ${
                monitoringData.isActive ? 'status-safe' : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  monitoringData.isActive ? 'bg-success-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                {monitoringData.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}