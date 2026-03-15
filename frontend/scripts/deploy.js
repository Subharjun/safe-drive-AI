const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const networkName = hre.network.name;
  const chainId = hre.network.config.chainId;
  
  console.log(`🚀 Deploying contracts to Celo ${networkName}...`);

  // Get the deployer account
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signers available. Check your hardhat.config.js and private key.");
  }
  
  const deployer = signers[0];
  console.log("📝 Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "CELO");

  if (balance === 0n) {
    console.log("❌ Insufficient balance. Please fund your account with CELO tokens.");
    const faucetUrl = networkName === "sepolia" ? "https://faucet.celo.org/sepolia" : "https://faucet.celo.org/alfajores";
    console.log(`🔗 Get testnet CELO from: ${faucetUrl}`);
    return;
  }

  try {
    // Deploy SafeDrivingToken
    console.log("\n📄 Deploying SafeDrivingToken...");
    const SafeDrivingToken = await ethers.getContractFactory("SafeDrivingToken");
    const safeDrivingToken = await SafeDrivingToken.deploy();
    await safeDrivingToken.waitForDeployment();
    const safeDrivingTokenAddress = await safeDrivingToken.getAddress();
    console.log("✅ SafeDrivingToken deployed to:", safeDrivingTokenAddress);

    // Deploy DriverWellnessNFT
    console.log("\n📄 Deploying DriverWellnessNFT...");
    const DriverWellnessNFT = await ethers.getContractFactory("DriverWellnessNFT");
    const driverWellnessNFT = await DriverWellnessNFT.deploy();
    await driverWellnessNFT.waitForDeployment();
    const driverWellnessNFTAddress = await driverWellnessNFT.getAddress();
    console.log("✅ DriverWellnessNFT deployed to:", driverWellnessNFTAddress);

    // Set up contract interactions
    console.log("\n⚙️ Setting up contract permissions...");
    
    // Add the deployer as authorized updater for both contracts
    await safeDrivingToken.addAuthorizedUpdater(deployer.address);
    console.log("✅ Added deployer as authorized updater for SafeDrivingToken");
    
    await driverWellnessNFT.addAuthorizedLogger(deployer.address);
    console.log("✅ Added deployer as authorized logger for DriverWellnessNFT");

    // Register the deployer as a driver for testing
    await safeDrivingToken.registerDriver(deployer.address);
    console.log("✅ Registered deployer as test driver");

    // Update contract addresses in frontend
    const contractAddresses = `export const CONTRACT_ADDRESSES = {
  SAFE_DRIVING_TOKEN: "${safeDrivingTokenAddress}",
  DRIVER_WELLNESS_NFT: "${driverWellnessNFTAddress}",
  NETWORK: "${networkName}",
  CHAIN_ID: ${chainId},
  DEPLOYER: "${deployer.address}"
};

// Contract ABIs (simplified for frontend use)
export const SAFE_DRIVING_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function updateSafetyScore(address driver, uint256 newScore, uint256 drivingDuration) external",
  "function redeemReward(uint256 amount, string memory rewardType) external",
  "function getDriverInfo(address driver) view returns (uint256, uint256, uint256, uint256, uint256, bool)",
  "function registerDriver(address driver) external",
  "event RewardMinted(address indexed driver, uint256 amount, uint256 safetyScore)",
  "event RewardRedeemed(address indexed driver, uint256 amount, string rewardType)"
];

export const DRIVER_WELLNESS_NFT_ABI = [
  "function recordWellnessLog(address driver, uint256 drowsinessEvents, uint256 stressLevel, uint256 interventions, uint256 routeCompliance, string memory gpsCoordinates) external",
  "function mintAchievement(address driver, uint8 achievementType, uint256 safetyScore, uint256 drivingHours) external",
  "function getDriverLogs(address driver) view returns (tuple(uint256,uint256,uint256,uint256,uint256,string,bytes32)[])",
  "function getDriverLogCount(address driver) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "event WellnessLogRecorded(address indexed driver, uint256 timestamp, string logData)",
  "event AchievementMinted(address indexed driver, uint256 tokenId, string achievementType)"
];
`;

    fs.writeFileSync(
      path.join(__dirname, '../app/lib/contractAddresses.ts'),
      contractAddresses
    );

    console.log("\n🎉 Deployment completed successfully!");
    console.log("📋 Contract Addresses:");
    console.log("SafeDrivingToken:", safeDrivingTokenAddress);
    console.log("DriverWellnessNFT:", driverWellnessNFTAddress);
    const explorerBase = networkName === "sepolia" ? "https://explorer.celo.org/sepolia" : "https://explorer.celo.org/alfajores";
    console.log("\n🔗 View on Celo Explorer:");
    console.log(`${explorerBase}/address/${safeDrivingTokenAddress}`);
    console.log(`${explorerBase}/address/${driverWellnessNFTAddress}`);
    
    console.log("\n📱 Next Steps:");
    console.log("1. Update your .env.local with the contract addresses");
    console.log("2. Test the contracts using the blockchain dashboard");
    console.log("3. Fund your wallet with testnet CELO if needed");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });