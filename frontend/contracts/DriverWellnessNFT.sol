// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract DriverWellnessNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Events
    event AchievementMinted(address indexed driver, uint256 tokenId, string achievementType);
    event WellnessLogRecorded(address indexed driver, uint256 timestamp, string logData);
    
    // Achievement types
    enum AchievementType {
        SAFE_DRIVER_BRONZE,
        SAFE_DRIVER_SILVER,
        SAFE_DRIVER_GOLD,
        WELLNESS_CHAMPION,
        ROUTE_MASTER,
        EMERGENCY_HERO
    }
    
    // NFT metadata structure
    struct WellnessNFT {
        AchievementType achievementType;
        uint256 mintTimestamp;
        uint256 safetyScore;
        uint256 drivingHours;
        string metadataURI;
    }
    
    // Driver wellness logs (immutable records)
    struct WellnessLog {
        uint256 timestamp;
        uint256 drowsinessEvents;
        uint256 stressLevel;
        uint256 interventions;
        uint256 routeCompliance;
        string gpsCoordinates;
        bytes32 dataHash;
    }
    
    // Mappings
    mapping(uint256 => WellnessNFT) public nftData;
    mapping(address => WellnessLog[]) public driverLogs;
    mapping(address => bool) public authorizedLoggers;
    mapping(AchievementType => string) public achievementURIs;
    
    // State variables
    uint256 public totalAchievements;
    
    constructor() ERC721("DriverWellnessNFT", "DWNFT") {
        authorizedLoggers[msg.sender] = true;
        
        // Set default achievement URIs (IPFS links)
        achievementURIs[AchievementType.SAFE_DRIVER_BRONZE] = "ipfs://QmBronzeSafeDriver";
        achievementURIs[AchievementType.SAFE_DRIVER_SILVER] = "ipfs://QmSilverSafeDriver";
        achievementURIs[AchievementType.SAFE_DRIVER_GOLD] = "ipfs://QmGoldSafeDriver";
        achievementURIs[AchievementType.WELLNESS_CHAMPION] = "ipfs://QmWellnessChampion";
        achievementURIs[AchievementType.ROUTE_MASTER] = "ipfs://QmRouteMaster";
        achievementURIs[AchievementType.EMERGENCY_HERO] = "ipfs://QmEmergencyHero";
    }
    
    modifier onlyAuthorizedLogger() {
        require(authorizedLoggers[msg.sender], "Not authorized to log");
        _;
    }
    
    // Add authorized logger (AI backend)
    function addAuthorizedLogger(address logger) external onlyOwner {
        authorizedLoggers[logger] = true;
    }
    
    // Record immutable wellness log
    function recordWellnessLog(
        address driver,
        uint256 drowsinessEvents,
        uint256 stressLevel,
        uint256 interventions,
        uint256 routeCompliance,
        string memory gpsCoordinates
    ) external onlyAuthorizedLogger {
        // Create data hash for integrity
        bytes32 dataHash = keccak256(abi.encodePacked(
            driver,
            block.timestamp,
            drowsinessEvents,
            stressLevel,
            interventions,
            routeCompliance,
            gpsCoordinates
        ));
        
        WellnessLog memory newLog = WellnessLog({
            timestamp: block.timestamp,
            drowsinessEvents: drowsinessEvents,
            stressLevel: stressLevel,
            interventions: interventions,
            routeCompliance: routeCompliance,
            gpsCoordinates: gpsCoordinates,
            dataHash: dataHash
        });
        
        driverLogs[driver].push(newLog);
        
        emit WellnessLogRecorded(driver, block.timestamp, gpsCoordinates);
    }
    
    // Mint achievement NFT
    function mintAchievement(
        address driver,
        AchievementType achievementType,
        uint256 safetyScore,
        uint256 drivingHours
    ) external onlyAuthorizedLogger {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(driver, tokenId);
        
        string memory uri = achievementURIs[achievementType];
        _setTokenURI(tokenId, uri);
        
        nftData[tokenId] = WellnessNFT({
            achievementType: achievementType,
            mintTimestamp: block.timestamp,
            safetyScore: safetyScore,
            drivingHours: drivingHours,
            metadataURI: uri
        });
        
        totalAchievements++;
        
        emit AchievementMinted(driver, tokenId, _getAchievementName(achievementType));
    }
    
    // Get driver's wellness logs
    function getDriverLogs(address driver) external view returns (WellnessLog[] memory) {
        return driverLogs[driver];
    }
    
    // Get driver's log count
    function getDriverLogCount(address driver) external view returns (uint256) {
        return driverLogs[driver].length;
    }
    
    // Get specific log by index
    function getDriverLogByIndex(address driver, uint256 index) external view returns (WellnessLog memory) {
        require(index < driverLogs[driver].length, "Log index out of bounds");
        return driverLogs[driver][index];
    }
    
    // Verify log integrity
    function verifyLogIntegrity(address driver, uint256 logIndex) external view returns (bool) {
        require(logIndex < driverLogs[driver].length, "Log index out of bounds");
        
        WellnessLog memory log = driverLogs[driver][logIndex];
        
        bytes32 calculatedHash = keccak256(abi.encodePacked(
            driver,
            log.timestamp,
            log.drowsinessEvents,
            log.stressLevel,
            log.interventions,
            log.routeCompliance,
            log.gpsCoordinates
        ));
        
        return calculatedHash == log.dataHash;
    }
    
    // Update achievement URI
    function updateAchievementURI(AchievementType achievementType, string memory newURI) external onlyOwner {
        achievementURIs[achievementType] = newURI;
    }
    
    // Internal function to get achievement name
    function _getAchievementName(AchievementType achievementType) internal pure returns (string memory) {
        if (achievementType == AchievementType.SAFE_DRIVER_BRONZE) return "Safe Driver Bronze";
        if (achievementType == AchievementType.SAFE_DRIVER_SILVER) return "Safe Driver Silver";
        if (achievementType == AchievementType.SAFE_DRIVER_GOLD) return "Safe Driver Gold";
        if (achievementType == AchievementType.WELLNESS_CHAMPION) return "Wellness Champion";
        if (achievementType == AchievementType.ROUTE_MASTER) return "Route Master";
        if (achievementType == AchievementType.EMERGENCY_HERO) return "Emergency Hero";
        return "Unknown Achievement";
    }
    
    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}