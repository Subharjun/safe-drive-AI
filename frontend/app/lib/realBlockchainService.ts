import { ethers } from 'ethers';

// Contract addresses and ABIs - will be populated after deployment
let CONTRACT_ADDRESSES: any = {
  SAFE_DRIVING_TOKEN: "",
  DRIVER_WELLNESS_NFT: "",
  NETWORK: "alfajores",
  CHAIN_ID: 44787,
  DEPLOYER: ""
};

let SAFE_DRIVING_TOKEN_ABI: any[] = [];
let DRIVER_WELLNESS_NFT_ABI: any[] = [];

// Try to import contract addresses if they exist
try {
  const contractModule = require('./contractAddresses');
  CONTRACT_ADDRESSES = contractModule.CONTRACT_ADDRESSES;
  SAFE_DRIVING_TOKEN_ABI = contractModule.SAFE_DRIVING_TOKEN_ABI;
  DRIVER_WELLNESS_NFT_ABI = contractModule.DRIVER_WELLNESS_NFT_ABI;
} catch (error) {
  console.log('⚠️ Contract addresses not found. Deploy contracts first using: npm run deploy');
}

export interface SafetyScore {
  drowsinessScore: number;
  stressScore: number;
  interventionCount: number;
  routeCompliance: number;
  overallScore: number;
}

export interface WellnessLog {
  timestamp: number;
  drowsinessEvents: number;
  stressLevel: number;
  interventions: number;
  routeCompliance: number;
  gpsCoordinates: string;
  dataHash: string;
}

export interface DriverRewards {
  totalEarned: string;
  totalRedeemed: string;
  currentBalance: string;
  lastUpdate: number;
  totalScore: number;
  isActive: boolean;
}

class RealBlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private safeDrivingToken: ethers.Contract | null = null;
  private driverWellnessNFT: ethers.Contract | null = null;
  private driverAddress: string;

  constructor() {
    this.driverAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS || '';
    this.initializeContracts();
  }

  // Check if contracts are ready for use
  private areContractsReady(): boolean {
    return !!(this.safeDrivingToken && this.driverWellnessNFT && this.wallet);
  }

  // Get deployment status
  getDeploymentStatus(): { deployed: boolean; message: string; contractAddresses?: any } {
    if (!CONTRACT_ADDRESSES.SAFE_DRIVING_TOKEN || !CONTRACT_ADDRESSES.DRIVER_WELLNESS_NFT) {
      return {
        deployed: false,
        message: 'Contracts not deployed. Run: npm run deploy'
      };
    }

    if (!this.areContractsReady()) {
      return {
        deployed: false,
        message: 'Contracts deployed but not initialized. Check wallet configuration.'
      };
    }

    return {
      deployed: true,
      message: 'Contracts ready for use',
      contractAddresses: CONTRACT_ADDRESSES
    };
  }

  private async initializeContracts() {
    if (typeof window === 'undefined') return;

    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://alfajores-forno.celo-testnet.org'
      );

      // Initialize wallet
      const privateKey = process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY;
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
      }

      // Check if contracts are deployed
      if (!CONTRACT_ADDRESSES.SAFE_DRIVING_TOKEN || !CONTRACT_ADDRESSES.DRIVER_WELLNESS_NFT) {
        console.log('⚠️ Contracts not deployed yet. Please run: npm run deploy');
        return;
      }

      // Initialize contracts only if ABIs are available
      if (SAFE_DRIVING_TOKEN_ABI.length > 0 && CONTRACT_ADDRESSES.SAFE_DRIVING_TOKEN) {
        this.safeDrivingToken = new ethers.Contract(
          CONTRACT_ADDRESSES.SAFE_DRIVING_TOKEN,
          SAFE_DRIVING_TOKEN_ABI,
          this.wallet || this.provider
        );
      }

      if (DRIVER_WELLNESS_NFT_ABI.length > 0 && CONTRACT_ADDRESSES.DRIVER_WELLNESS_NFT) {
        this.driverWellnessNFT = new ethers.Contract(
          CONTRACT_ADDRESSES.DRIVER_WELLNESS_NFT,
          DRIVER_WELLNESS_NFT_ABI,
          this.wallet || this.provider
        );
      }

      console.log('✅ Blockchain service initialized');
      console.log('SafeDrivingToken:', CONTRACT_ADDRESSES.SAFE_DRIVING_TOKEN);
      console.log('DriverWellnessNFT:', CONTRACT_ADDRESSES.DRIVER_WELLNESS_NFT);
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
    }
  }

  // Calculate overall safety score from AI metrics
  calculateSafetyScore(metrics: {
    drowsinessLevel: number;
    stressLevel: number;
    interventionCount: number;
    routeCompliance: number;
    drivingDuration: number;
  }): SafetyScore {
    // Weighted scoring algorithm
    const drowsinessScore = Math.max(0, 100 - (metrics.drowsinessLevel * 20));
    const stressScore = Math.max(0, 100 - (metrics.stressLevel * 15));
    const interventionPenalty = Math.min(30, metrics.interventionCount * 5);
    const routeScore = metrics.routeCompliance;

    const overallScore = Math.round(
      (drowsinessScore * 0.3) +
      (stressScore * 0.25) +
      (routeScore * 0.25) +
      (Math.max(0, 100 - interventionPenalty) * 0.2)
    );

    return {
      drowsinessScore,
      stressScore,
      interventionCount: metrics.interventionCount,
      routeCompliance: routeScore,
      overallScore: Math.min(100, Math.max(0, overallScore))
    };
  }

  // Record wellness data on blockchain
  async recordWellnessLog(
    drowsinessEvents: number,
    stressLevel: number,
    interventions: number,
    routeCompliance: number,
    gpsCoordinates: string
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.areContractsReady()) {
        const status = this.getDeploymentStatus();
        return {
          success: false,
          error: status.message
        };
      }

      console.log('📝 Recording wellness log on blockchain...');
      
      const tx = await this.driverWellnessNFT!.recordWellnessLog(
        this.driverAddress,
        drowsinessEvents,
        stressLevel,
        interventions,
        routeCompliance,
        gpsCoordinates
      );

      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      console.log('✅ Wellness log recorded successfully!');
      return {
        success: true,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      console.error('❌ Error recording wellness log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Calculate and distribute rewards based on safety score
  async distributeRewards(
    safetyScore: SafetyScore,
    drivingDuration: number
  ): Promise<{ success: boolean; rewardAmount?: string; transactionHash?: string; error?: string }> {
    try {
      if (!this.areContractsReady()) {
        const status = this.getDeploymentStatus();
        return {
          success: false,
          error: status.message
        };
      }

      if (safetyScore.overallScore < 70) {
        return {
          success: false,
          error: 'Safety score too low for rewards (minimum 70%)'
        };
      }

      console.log('🏆 Distributing rewards based on safety score...');
      
      const tx = await this.safeDrivingToken!.updateSafetyScore(
        this.driverAddress,
        safetyScore.overallScore,
        drivingDuration
      );

      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      // Parse the RewardMinted event to get the actual reward amount
      let rewardAmount = '0';
      if (this.safeDrivingToken && receipt.logs) {
        const rewardEvent = receipt.logs.find((log: any) => {
          try {
            const parsed = this.safeDrivingToken!.interface.parseLog(log);
            return parsed?.name === 'RewardMinted';
          } catch {
            return false;
          }
        });
        rewardAmount = rewardEvent ? ethers.formatEther(rewardEvent.args?.amount || '0') : '0';
      }

      console.log('✅ Rewards distributed successfully!');
      return {
        success: true,
        rewardAmount,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      console.error('❌ Error distributing rewards:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Redeem rewards for real-world benefits
  async redeemRewards(
    amount: string,
    rewardType: string
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.areContractsReady()) {
        const status = this.getDeploymentStatus();
        return {
          success: false,
          error: status.message
        };
      }

      console.log('💰 Redeeming rewards...');
      
      const amountInWei = ethers.parseEther(amount);
      const tx = await this.safeDrivingToken!.redeemReward(amountInWei, rewardType);

      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      console.log('✅ Rewards redeemed successfully!');
      return {
        success: true,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      console.error('❌ Error redeeming rewards:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get driver's current rewards from blockchain
  async getDriverRewards(): Promise<DriverRewards> {
    try {
      if (!this.safeDrivingToken) {
        console.log('SafeDrivingToken contract not initialized, returning default values');
        return {
          totalEarned: '0',
          totalRedeemed: '0',
          currentBalance: '0',
          lastUpdate: Date.now(),
          totalScore: 0,
          isActive: false
        };
      }

      console.log('📊 Fetching driver rewards from blockchain...');
      
      const [totalScore, lastUpdateTime, totalRewardsEarned, totalRewardsRedeemed, currentBalance, isActive] = 
        await this.safeDrivingToken.getDriverInfo(this.driverAddress);

      return {
        totalEarned: ethers.formatEther(totalRewardsEarned),
        totalRedeemed: ethers.formatEther(totalRewardsRedeemed),
        currentBalance: ethers.formatEther(currentBalance),
        lastUpdate: Number(lastUpdateTime) * 1000, // Convert to milliseconds
        totalScore: Number(totalScore),
        isActive
      };
    } catch (error) {
      console.error('❌ Error getting driver rewards:', error);
      return {
        totalEarned: '0',
        totalRedeemed: '0',
        currentBalance: '0',
        lastUpdate: Date.now(),
        totalScore: 0,
        isActive: false
      };
    }
  }

  // Get driver's wellness logs from blockchain
  async getDriverLogs(): Promise<WellnessLog[]> {
    try {
      if (!this.driverWellnessNFT) {
        console.log('DriverWellnessNFT contract not initialized, returning empty logs');
        return [];
      }

      console.log('📋 Fetching driver logs from blockchain...');
      
      const logs = await this.driverWellnessNFT.getDriverLogs(this.driverAddress);
      
      return logs.map((log: any) => ({
        timestamp: Number(log.timestamp) * 1000, // Convert to milliseconds
        drowsinessEvents: Number(log.drowsinessEvents),
        stressLevel: Number(log.stressLevel),
        interventions: Number(log.interventions),
        routeCompliance: Number(log.routeCompliance),
        gpsCoordinates: log.gpsCoordinates,
        dataHash: log.dataHash
      }));
    } catch (error) {
      console.error('❌ Error getting driver logs:', error);
      return [];
    }
  }

  // Get account balances (CELO and cUSD)
  async getAccountBalances(): Promise<{ CELO: string; cUSD: string }> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      console.log('💰 Fetching account balances...');
      
      const celoBalance = await this.provider.getBalance(this.driverAddress);
      
      // cUSD contract address on Alfajores
      const cUSDAddress = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';
      const cUSDContract = new ethers.Contract(
        cUSDAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );
      
      const cUSDBalance = await cUSDContract.balanceOf(this.driverAddress);

      return {
        CELO: ethers.formatEther(celoBalance),
        cUSD: ethers.formatEther(cUSDBalance)
      };
    } catch (error) {
      console.error('❌ Error getting balances:', error);
      return { CELO: '0', cUSD: '0' };
    }
  }

  // Check if driver qualifies for NFT achievement
  async checkAchievementEligibility(): Promise<{ eligible: boolean; achievementType?: number; description?: string }> {
    try {
      const logs = await this.getDriverLogs();
      const rewards = await this.getDriverRewards();

      // Bronze Achievement: 10 safe driving sessions
      if (logs.length >= 10 && parseFloat(rewards.totalEarned) >= 5) {
        return {
          eligible: true,
          achievementType: 0, // SAFE_DRIVER_BRONZE
          description: 'Complete 10 safe driving sessions'
        };
      }

      // Silver Achievement: 50 safe driving sessions
      if (logs.length >= 50 && parseFloat(rewards.totalEarned) >= 25) {
        return {
          eligible: true,
          achievementType: 1, // SAFE_DRIVER_SILVER
          description: 'Complete 50 safe driving sessions'
        };
      }

      // Gold Achievement: 100 safe driving sessions
      if (logs.length >= 100 && parseFloat(rewards.totalEarned) >= 100) {
        return {
          eligible: true,
          achievementType: 2, // SAFE_DRIVER_GOLD
          description: 'Complete 100 safe driving sessions'
        };
      }

      return { eligible: false };
    } catch (error) {
      console.error('❌ Error checking achievement eligibility:', error);
      return { eligible: false };
    }
  }

  // Mint achievement NFT
  async mintAchievement(
    achievementType: number,
    safetyScore: number,
    drivingHours: number
  ): Promise<{ success: boolean; transactionHash?: string; tokenId?: string; error?: string }> {
    try {
      if (!this.areContractsReady()) {
        const status = this.getDeploymentStatus();
        return {
          success: false,
          error: status.message
        };
      }

      console.log('🏅 Minting achievement NFT...');
      
      const tx = await this.driverWellnessNFT!.mintAchievement(
        this.driverAddress,
        achievementType,
        safetyScore,
        drivingHours
      );

      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      // Parse the AchievementMinted event to get the token ID
      let tokenId: string | undefined;
      if (this.driverWellnessNFT && receipt.logs) {
        const achievementEvent = receipt.logs.find((log: any) => {
          try {
            const parsed = this.driverWellnessNFT!.interface.parseLog(log);
            return parsed?.name === 'AchievementMinted';
          } catch {
            return false;
          }
        });
        tokenId = achievementEvent ? achievementEvent.args?.tokenId?.toString() : undefined;
      }

      console.log('✅ Achievement NFT minted successfully!');
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tokenId
      };
    } catch (error) {
      console.error('❌ Error minting achievement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get contract addresses for display
  getContractAddresses() {
    return CONTRACT_ADDRESSES;
  }
}

export const realBlockchainService = new RealBlockchainService();