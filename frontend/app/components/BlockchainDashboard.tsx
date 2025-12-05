"use client";

import { useState, useEffect } from "react";
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { realBlockchainService as blockchainService, SafetyScore, DriverRewards, WellnessLog } from "../lib/realBlockchainService";

interface BlockchainDashboardProps {
  currentSafetyMetrics?: {
    drowsinessLevel: number;
    stressLevel: number;
    interventionCount: number;
    routeCompliance: number;
    drivingDuration: number;
  };
}

export default function BlockchainDashboard({ currentSafetyMetrics }: BlockchainDashboardProps) {
  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  const [rewards, setRewards] = useState<DriverRewards>({
    totalEarned: '0',
    totalRedeemed: '0',
    currentBalance: '0',
    lastUpdate: 0,
    totalScore: 0,
    isActive: false
  });
  const [safetyScore, setSafetyScore] = useState<SafetyScore | null>(null);
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [balances, setBalances] = useState({ CELO: '0', cUSD: '0' });
  const [isLoading, setIsLoading] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [selectedReward, setSelectedReward] = useState('fuel');
  const [achievement, setAchievement] = useState<{ eligible: boolean; achievementType?: number; description?: string }>({ eligible: false });

  // Load data on component mount
  useEffect(() => {
    loadBlockchainData();
  }, []);

  // Update safety score when metrics change
  useEffect(() => {
    if (currentSafetyMetrics) {
      const score = blockchainService.calculateSafetyScore(currentSafetyMetrics);
      setSafetyScore(score);
    }
  }, [currentSafetyMetrics]);

  const loadBlockchainData = async () => {
    setIsLoading(true);
    try {
      const [rewardsData, logsData, balanceData, achievementData] = await Promise.all([
        blockchainService.getDriverRewards(),
        blockchainService.getDriverLogs(),
        blockchainService.getAccountBalances(),
        blockchainService.checkAchievementEligibility()
      ]);

      setRewards(rewardsData);
      setLogs(logsData);
      setBalances(balanceData);
      setAchievement(achievementData);
    } catch (error) {
      console.error('Error loading blockchain data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordSession = async () => {
    if (!currentSafetyMetrics || !safetyScore) return;

    setIsLoading(true);
    try {
      // Record wellness log
      const logResult = await blockchainService.recordWellnessLog(
        Math.floor(currentSafetyMetrics.drowsinessLevel * 10),
        Math.floor(currentSafetyMetrics.stressLevel * 10),
        currentSafetyMetrics.interventionCount,
        currentSafetyMetrics.routeCompliance,
        "37.7749,-122.4194" // Mock GPS coordinates
      );

      if (logResult.success) {
        // Distribute rewards if score is good enough
        const rewardResult = await blockchainService.distributeRewards(
          safetyScore,
          currentSafetyMetrics.drivingDuration
        );

        if (rewardResult.success) {
          alert(`Session recorded! Earned ${rewardResult.rewardAmount} SDT tokens`);
        } else {
          alert(`Session recorded but no rewards: ${rewardResult.error}`);
        }

        // Reload data
        await loadBlockchainData();
      } else {
        alert(`Error recording session: ${logResult.error}`);
      }
    } catch (error) {
      console.error('Error recording session:', error);
      alert('Error recording session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemRewards = async () => {
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const result = await blockchainService.redeemRewards(redeemAmount, selectedReward);
      
      if (result.success) {
        alert(`Successfully redeemed ${redeemAmount} SDT for ${selectedReward}!`);
        setRedeemAmount('');
        await loadBlockchainData();
      } else {
        alert(`Error redeeming rewards: ${result.error}`);
      }
    } catch (error) {
      console.error('Error redeeming rewards:', error);
      alert('Error redeeming rewards');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };



  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🔗 Blockchain Dashboard</h2>
        <div className="flex items-center space-x-4">
          {/* Wallet Connection */}
          {isConnected ? (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <ConnectButton />
          )}
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Celo Alfajores</span>
          </div>
        </div>
      </div>

      {/* Wallet Connection Required Message */}
      {!isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="text-2xl mr-3">👛</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Connect Your Wallet</h3>
              <p className="text-sm text-blue-800 mb-2">
                Connect your MetaMask or other Web3 wallet to:
              </p>
              <ul className="text-sm text-blue-700 space-y-1 ml-4">
                <li>• Earn SafeDrive Tokens (SDT) for safe driving</li>
                <li>• Mint achievement NFTs</li>
                <li>• Redeem rewards for fuel discounts</li>
                <li>• Track your blockchain-verified driving history</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                💡 Make sure you're on Celo Alfajores testnet
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Safety Score */}
      {safetyScore && (
        <div className={`rounded-lg p-4 mb-6 ${getScoreBgColor(safetyScore.overallScore)}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Current Safety Score</h3>
            <span className={`text-2xl font-bold ${getScoreColor(safetyScore.overallScore)}`}>
              {safetyScore.overallScore}%
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Alertness:</span>
              <span className="ml-2 font-medium">{safetyScore.drowsinessScore}%</span>
            </div>
            <div>
              <span className="text-gray-600">Stress:</span>
              <span className="ml-2 font-medium">{safetyScore.stressScore}%</span>
            </div>
            <div>
              <span className="text-gray-600">Route:</span>
              <span className="ml-2 font-medium">{safetyScore.routeCompliance}%</span>
            </div>
            <div>
              <span className="text-gray-600">Interventions:</span>
              <span className="ml-2 font-medium">{safetyScore.interventionCount}</span>
            </div>
          </div>
          
          {currentSafetyMetrics && (
            <button
              onClick={handleRecordSession}
              disabled={isLoading}
              className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Recording...' : '📝 Record Driving Session'}
            </button>
          )}
        </div>
      )}

      {/* Rewards & Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* SDT Rewards */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🏆 Safe Driving Tokens</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Balance:</span>
              <span className="font-bold text-blue-600">{rewards.currentBalance} SDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Earned:</span>
              <span className="font-medium">{rewards.totalEarned} SDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Redeemed:</span>
              <span className="font-medium">{rewards.totalRedeemed} SDT</span>
            </div>
          </div>
        </div>

        {/* Celo Balances */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">💰 Celo Wallet</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">CELO:</span>
              <span className="font-bold text-green-600">{parseFloat(balances.CELO).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">cUSD:</span>
              <span className="font-bold text-green-600">{parseFloat(balances.cUSD).toFixed(4)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Address: {process.env.NEXT_PUBLIC_WALLET_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_WALLET_ADDRESS?.slice(-4)}
            </div>
          </div>
        </div>
      </div>

      {/* Redeem Rewards */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">🎁 Redeem Rewards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (SDT)</label>
            <input
              type="number"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reward Type</label>
            <select
              value={selectedReward}
              onChange={(e) => setSelectedReward(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fuel">⛽ Fuel Discount</option>
              <option value="insurance">🛡️ Insurance Discount</option>
              <option value="maintenance">🔧 Maintenance Credit</option>
              <option value="parking">🅿️ Parking Credit</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRedeemRewards}
              disabled={isLoading || !redeemAmount}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Redeeming...' : 'Redeem'}
            </button>
          </div>
        </div>
      </div>

      {/* Achievement Status */}
      {achievement.eligible && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🏅</span>
            <div>
              <h4 className="font-semibold text-yellow-800">Achievement Unlocked!</h4>
              <p className="text-yellow-700">{achievement.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Recent Driving Sessions</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No driving sessions recorded yet</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {logs.slice(-5).reverse().map((log, index) => (
                <div key={index} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                  <div>
                    <span className="font-medium">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex space-x-4 text-xs">
                    <span>Stress: {log.stressLevel}/10</span>
                    <span>Route: {log.routeCompliance}%</span>
                    <span>Alerts: {log.interventions}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-sm text-gray-600 text-center">
            Total Sessions: {logs.length} | Immutable blockchain records
          </div>
        </div>
      </div>
    </div>
  );
}