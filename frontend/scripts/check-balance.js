const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

async function checkBalance() {
  console.log("🔍 Checking wallet balance before deployment...");

  const rpcUrl = "https://alfajores-forno.celo-testnet.org";
  const privateKey = process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY;
  const walletAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS;

  if (!privateKey || !walletAddress) {
    console.log("❌ Missing wallet configuration in environment variables");
    console.log("Please set NEXT_PUBLIC_WALLET_PRIVATE_KEY and NEXT_PUBLIC_WALLET_ADDRESS");
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(walletAddress);
    const balanceInCelo = ethers.formatEther(balance);

    console.log("📋 Wallet Information:");
    console.log("Address:", walletAddress);
    console.log("Balance:", balanceInCelo, "CELO");
    console.log("Network: Celo Alfajores Testnet");

    if (parseFloat(balanceInCelo) < 0.1) {
      console.log("\n⚠️  Low balance detected!");
      console.log("You need at least 0.1 CELO for deployment gas fees.");
      console.log("🔗 Get testnet CELO from: https://faucet.celo.org/alfajores");
      console.log("📝 Enter your address:", walletAddress);
    } else {
      console.log("\n✅ Sufficient balance for deployment!");
      console.log("You can proceed with: npm run deploy");
    }

    // Check cUSD balance too
    const cUSDAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
    const cUSDContract = new ethers.Contract(
      cUSDAddress,
      ["function balanceOf(address) view returns (uint256)"],
      provider
    );
    
    const cUSDBalance = await cUSDContract.balanceOf(walletAddress);
    const cUSDFormatted = ethers.formatEther(cUSDBalance);
    console.log("cUSD Balance:", cUSDFormatted, "cUSD");

  } catch (error) {
    console.error("❌ Error checking balance:", error.message);
  }
}

if (require.main === module) {
  checkBalance();
}

module.exports = { checkBalance };