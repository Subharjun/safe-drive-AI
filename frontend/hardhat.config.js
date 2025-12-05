require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config({ path: '.env.local' });

// Load environment variables
const PRIVATE_KEY = process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    alfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 44787,
      gas: "auto",
      gasPrice: "auto",
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 42220,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};