# MetaMask & Blockchain Integration Setup

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
cd frontend
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
```

### Step 2: Get WalletConnect Project ID

1. Go to https://cloud.walletconnect.com/
2. Sign up/Login
3. Create a new project
4. Copy your Project ID

### Step 3: Add to Environment Variables

Add to `frontend/.env.local`:
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Step 4: Restart Development Server

```bash
npm run dev
```

---

## ✅ What's Now Working

### Wallet Connection
- ✅ Connect MetaMask, Coinbase Wallet, WalletConnect
- ✅ Auto-detect Celo network
- ✅ Show connected wallet address
- ✅ Disconnect wallet option

### Blockchain Features
- ✅ Smart contracts deployed on Celo Alfajores
- ✅ SafeDrivingToken (SDT): `0xC56F1F1D944Ab993301941AbFF45296c08B1c3cA`
- ✅ DriverWellnessNFT: `0x362Ce27FA651a4973919a79B6B91dDB4790e0C5f`
- ✅ Real-time safety score calculation
- ✅ Blockchain-verified driving logs

---

## 🎯 How to Use

### 1. Add Celo Alfajores to MetaMask

**Option A: Automatic (Recommended)**
- Click "Connect Wallet" button
- RainbowKit will prompt you to add Celo network
- Click "Approve" to add network

**Option B: Manual**
1. Open MetaMask
2. Click network dropdown
3. Click "Add Network"
4. Enter these details:
   ```
   Network Name: Celo Alfajores Testnet
   RPC URL: https://alfajores-forno.celo-testnet.org
   Chain ID: 44787
   Currency Symbol: CELO
   Block Explorer: https://alfajores.celoscan.io
   ```

### 2. Get Test CELO

1. Go to https://faucet.celo.org/alfajores
2. Enter your wallet address
3. Click "Get CELO"
4. Wait 30 seconds for tokens to arrive

### 3. Start Earning Tokens

1. Connect your wallet in the Blockchain Dashboard
2. Go to "Live Monitor" tab
3. Start monitoring your driving
4. After session ends, click "Record Driving Session"
5. Approve the transaction in MetaMask
6. Earn SDT tokens based on your safety score!

---

## 💰 Token Rewards System

### How Tokens Are Earned

```
Safety Score Calculation:
- Alertness (30%): 100 - (drowsiness * 100)
- Stress Management (25%): 100 - (stress * 100)
- Route Compliance (25%): Based on route adherence
- Interventions (20%): Penalty for safety alerts

Overall Score = Weighted average of above

Token Reward = (Overall Score / 100) * 10 SDT
```

### Example Rewards

| Safety Score | SDT Earned | Description |
|--------------|------------|-------------|
| 95-100% | 9.5-10 SDT | Excellent! Perfect driving |
| 85-94% | 8.5-9.4 SDT | Great! Very safe driving |
| 75-84% | 7.5-8.4 SDT | Good! Safe driving |
| 65-74% | 6.5-7.4 SDT | Fair - Room for improvement |
| <65% | <6.5 SDT | Needs improvement |

### Redeeming Rewards

1. Accumulate SDT tokens
2. Go to "Redeem Rewards" section
3. Choose reward type:
   - ⛽ Fuel Discount
   - 🍔 Food Voucher
   - 🎁 Gift Card
   - 🏆 Premium Features
4. Enter amount to redeem
5. Approve transaction
6. Receive reward code!

---

## 🏆 NFT Achievements

### Achievement Types

1. **Safe Driver** (Bronze)
   - Requirement: 10 sessions with 80%+ safety score
   - Reward: Bronze NFT + 50 bonus SDT

2. **Road Warrior** (Silver)
   - Requirement: 50 sessions with 85%+ safety score
   - Reward: Silver NFT + 200 bonus SDT

3. **Elite Driver** (Gold)
   - Requirement: 100 sessions with 90%+ safety score
   - Reward: Gold NFT + 500 bonus SDT

4. **Perfect Record** (Platinum)
   - Requirement: 25 consecutive sessions with 95%+ score
   - Reward: Platinum NFT + 1000 bonus SDT

### How to Mint NFTs

1. Meet achievement requirements
2. Dashboard will show "Eligible for Achievement"
3. Click "Mint Achievement NFT"
4. Approve transaction in MetaMask
5. NFT appears in your wallet!
6. View on OpenSea or Celo Explorer

---

## 🔧 Troubleshooting

### "Wrong Network" Error

**Solution**: Switch to Celo Alfajores
1. Open MetaMask
2. Click network dropdown
3. Select "Celo Alfajores Testnet"

### "Insufficient Funds" Error

**Solution**: Get test CELO from faucet
1. Visit https://faucet.celo.org/alfajores
2. Enter your address
3. Get free test tokens

### "Transaction Failed" Error

**Possible Causes**:
1. Not enough CELO for gas fees
2. Contract interaction failed
3. Network congestion

**Solution**:
1. Check CELO balance
2. Try again with higher gas
3. Wait a few minutes and retry

### Wallet Not Connecting

**Solution**:
1. Refresh the page
2. Clear browser cache
3. Try different browser
4. Update MetaMask extension

---

## 📊 Viewing Your Blockchain Data

### On Celo Explorer

1. Go to https://alfajores.celoscan.io
2. Enter your wallet address
3. View:
   - SDT token balance
   - NFT collection
   - Transaction history
   - Smart contract interactions

### In MetaMask

1. Open MetaMask
2. Click "Assets" tab
3. Click "Import Tokens"
4. Enter SDT contract: `0xC56F1F1D944Ab993301941AbFF45296c08B1c3cA`
5. SDT tokens will appear in your wallet!

### In Dashboard

- Real-time balance display
- Transaction history
- Earned vs Redeemed tokens
- Achievement progress
- Safety score trends

---

## 🎨 Customization

### Change Network (Mainnet)

Edit `frontend/app/lib/wagmi.ts`:
```typescript
import { celo } from 'wagmi/chains'; // Use mainnet instead of alfajores

export const config = getDefaultConfig({
  chains: [celo], // Remove celoAlfajores for production
  // ...
});
```

### Add More Wallets

RainbowKit supports:
- MetaMask
- Coinbase Wallet
- WalletConnect
- Rainbow
- Trust Wallet
- And many more!

All work automatically with the current setup.

---

## 🚀 Production Deployment

### Before Going Live

1. **Deploy to Celo Mainnet**
   ```bash
   npm run deploy -- --network celo
   ```

2. **Update Contract Addresses**
   - Update `contractAddresses.ts` with mainnet addresses

3. **Switch to Mainnet**
   - Change wagmi config to use `celo` chain
   - Update RPC URLs

4. **Security Audit**
   - Audit smart contracts
   - Test all functions
   - Check for vulnerabilities

5. **Get Real CELO**
   - Users need real CELO for gas fees
   - Provide instructions for buying CELO

---

## 📝 Smart Contract Functions

### SafeDrivingToken (SDT)

```solidity
// Mint tokens (only owner)
function mint(address to, uint256 amount)

// Burn tokens
function burn(uint256 amount)

// Transfer tokens
function transfer(address to, uint256 amount)

// Check balance
function balanceOf(address account) returns (uint256)
```

### DriverWellnessNFT

```solidity
// Mint achievement NFT
function mintAchievement(address driver, uint256 achievementType)

// Get driver achievements
function getDriverAchievements(address driver) returns (uint256[])

// Check if eligible
function isEligibleForAchievement(address driver, uint256 achievementType) returns (bool)
```

---

## 🎉 Success!

You now have a fully functional blockchain-integrated driver wellness system with:

✅ MetaMask wallet connection
✅ Real token rewards (SDT)
✅ NFT achievements
✅ Blockchain-verified driving logs
✅ Reward redemption system
✅ Multi-wallet support

**Start driving safely and earn rewards!** 🚗💰
