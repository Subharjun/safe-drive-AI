// Browser-compatible Celo integration
import { ethers } from 'ethers';

// Celo network configuration
export const CELO_CONFIG = {
  alfajores: {
    rpcUrl: 'https://alfajores-forno.celo-testnet.org',
    chainId: 44787,
    name: 'Celo Alfajores Testnet',
    nativeCurrency: {
      name: 'Celo',
      symbol: 'CELO',
      decimals: 18,
    },
    blockExplorerUrls: ['https://explorer.celo.org/alfajores'],
  },
  mainnet: {
    rpcUrl: 'https://forno.celo.org',
    chainId: 42220,
    name: 'Celo Mainnet',
    nativeCurrency: {
      name: 'Celo',
      symbol: 'CELO',
      decimals: 18,
    },
    blockExplorerUrls: ['https://explorer.celo.org'],
  },
};

// Initialize Celo provider (browser-compatible)
export const initializeCelo = () => {
  const network = process.env.NEXT_PUBLIC_CELO_NETWORK || 'alfajores';
  const rpcUrl = CELO_CONFIG[network as keyof typeof CELO_CONFIG].rpcUrl;
  
  if (typeof window !== 'undefined') {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY;
    
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey, provider);
      return { provider, wallet };
    }
    
    return { provider, wallet: null };
  }
  
  return null;
};

// cUSD contract address on Alfajores
const CUSD_ADDRESS = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';

// Get cUSD contract (simplified for browser)
export const getCUSDContract = (provider: ethers.Provider) => {
  // Simplified ERC20 ABI for balance and transfer
  const erc20Abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)'
  ];
  
  return new ethers.Contract(CUSD_ADDRESS, erc20Abi, provider);
};

// Utility functions
export const formatCeloAmount = (amount: string | number): string => {
  return ethers.formatEther(amount.toString());
};

export const parseCeloAmount = (amount: string): string => {
  return ethers.parseEther(amount).toString();
};

// Get account balance (simplified)
export const getAccountBalance = async (provider: ethers.Provider, address: string) => {
  try {
    const [celoBalance, cUSDContract] = await Promise.all([
      provider.getBalance(address),
      getCUSDContract(provider)
    ]);
    
    const cUSDBalance = await cUSDContract.balanceOf(address);

    return {
      CELO: formatCeloAmount(celoBalance.toString()),
      cUSD: formatCeloAmount(cUSDBalance.toString()),
    };
  } catch (error) {
    console.error('Error getting balance:', error);
    return { CELO: '0', cUSD: '0' };
  }
};

// Send cUSD transaction (simplified)
export const sendCUSD = async (
  wallet: ethers.Wallet,
  to: string,
  amount: string
) => {
  try {
    if (!wallet.provider) {
      throw new Error('Wallet provider not available');
    }
    
    const cUSDContract = getCUSDContract(wallet.provider);
    const contractWithSigner = cUSDContract.connect(wallet) as ethers.Contract;
    const amountInWei = parseCeloAmount(amount);
    
    const tx = await contractWithSigner.transfer(to, amountInWei);
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('Error sending cUSD:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Contract addresses for custom tokens (you'll deploy these)
export const CONTRACT_ADDRESSES = {
  SAFE_DRIVING_TOKEN: '', // Will be filled after deployment
  DRIVER_WELLNESS_NFT: '', // Will be filled after deployment
};