export const CONTRACT_ADDRESSES = {
  SAFE_DRIVING_TOKEN: "0x6A8681232e3798FEb61D7032aa9C42875fe915Fc",
  DRIVER_WELLNESS_NFT: "0xDBAA771B9ab3a4bE228Fc5853777c19AE16BF13A",
  NETWORK: "sepolia",
  CHAIN_ID: 11142220,
  DEPLOYER: "0x4dA237f9290cfbA08A66831f0fD4ABbECBc71343"
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
