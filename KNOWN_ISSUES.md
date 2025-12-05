# SafeDrive AI - Known Issues & Status

## ✅ Working Features

1. **Live Video Monitoring** - Real-time webcam capture every 5 seconds
2. **AI Analysis** - Groq Vision + HF API for drowsiness/stress detection
3. **Analytics Dashboard** - Shows real data from monitoring sessions
4. **Data Management** - Can permanently delete analytics data
5. **Mobile Responsive** - UI works on phones and tablets
6. **Backend Deployment** - Deployed on Render at https://safedrive-backend-j75m.onrender.com

## ⚠️ Known Issues

### 1. Python 3.13 Compatibility (TypeAlias Error)

**Error**: `TypeAlias` compatibility issue with uvicorn reload

**Workaround**:
```bash
# Don't use --reload flag
python main.py

# Or downgrade Python to 3.11
```

**Status**: Minor - doesn't affect functionality, just development

---

### 2. Safety Alerts Not Triggering

**Issue**: Emergency stop button doesn't show nearby stops

**Root Cause**: 
- Alerts only trigger when drowsiness > 0.6 or stress > 0.7
- Need to be actively monitoring for alerts to generate
- Location permission might not be granted

**Fix Needed**:
- Add manual "Find Safe Stops" button
- Lower alert thresholds for testing
- Add geolocation permission check

**Status**: Needs fix

---

### 3. Blockchain Credits Not Generating

**Issue**: 0 SDT tokens shown, no credits earned

**Root Cause**:
- Blockchain service requires wallet connection
- Smart contracts need to be called after each session
- Currently using hardcoded wallet address (not user's wallet)

**Current Blockchain Status**:
- ✅ Smart contracts deployed on Celo Alfajores
- ✅ SafeDrivingToken: `0xC56F1F1D944Ab993301941AbFF45296c08B1c3cA`
- ✅ DriverWellnessNFT: `0x362Ce27FA651a4973919a79B6B91dDB4790e0C5f`
- ❌ Not automatically rewarding users
- ❌ No MetaMask integration for user wallets

**What's Needed**:
1. MetaMask wallet connection
2. Automatic reward distribution after monitoring sessions
3. User can claim rewards with their own wallet

**Status**: Partially implemented - needs wallet integration

---

### 4. MetaMask Wallet Connection

**Issue**: No way for users to connect their own wallet

**Current State**:
- Using hardcoded wallet address in `.env`
- No "Connect Wallet" button
- No Web3 wallet integration

**What's Needed**:
1. Add "Connect Wallet" button
2. Integrate RainbowKit or WalletConnect
3. Let users sign transactions with their wallet
4. Reward tokens to connected wallet address

**Status**: Not implemented

---

## 🔧 Quick Fixes

### Fix 1: Add Manual Safe Stops Button

```typescript
// In SafetyAlerts.tsx
<button onClick={findNearbyStops}>
  🚨 Find Emergency Stops Now
</button>
```

### Fix 2: Lower Alert Thresholds (for testing)

```typescript
// Change from:
if (data.drowsiness > 0.8) // Critical
if (data.drowsiness > 0.6) // High

// To:
if (data.drowsiness > 0.5) // Critical (for testing)
if (data.drowsiness > 0.3) // High (for testing)
```

### Fix 3: Add Blockchain Reward After Session

```typescript
// After monitoring stops, call:
await blockchainService.recordSession({
  drowsiness: avgDrowsiness,
  stress: avgStress,
  duration: sessionDuration
});
```

### Fix 4: Add MetaMask Connection

```typescript
// Add to BlockchainDashboard:
import { useAccount, useConnect } from 'wagmi';

const { address, isConnected } = useAccount();
const { connect, connectors } = useConnect();

<button onClick={() => connect({ connector: connectors[0] })}>
  Connect MetaMask
</button>
```

---

## 📋 Priority Fixes

### High Priority
1. ✅ Fix data deletion (DONE)
2. ✅ Fix AI metrics display (DONE)
3. ⏳ Add manual safe stops button
4. ⏳ Add MetaMask wallet connection

### Medium Priority
1. ⏳ Automatic blockchain rewards
2. ⏳ Lower alert thresholds for testing
3. ⏳ Add geolocation permission check

### Low Priority
1. ⏳ Python 3.13 compatibility
2. ⏳ Improve AI accuracy with more frequent analysis
3. ⏳ Add more blockchain features (NFT minting, etc.)

---

## 🚀 Deployment Status

### Backend
- ✅ Deployed on Render
- ✅ URL: https://safedrive-backend-j75m.onrender.com
- ✅ AI APIs working (Groq + HF)
- ✅ MongoDB connected
- ✅ WebSocket working

### Frontend
- ⏳ Not yet deployed
- ⏳ Needs: NEXT_PUBLIC_BACKEND_URL env var
- ⏳ Needs: Blockchain wallet integration

---

## 📝 Next Steps

1. **Deploy Frontend to Render**
   - Set environment variables
   - Test WebSocket connection
   - Verify AI analysis works

2. **Add Wallet Connection**
   - Install wagmi/RainbowKit
   - Add "Connect Wallet" button
   - Test with MetaMask

3. **Fix Safety Alerts**
   - Add manual emergency button
   - Test geolocation
   - Lower thresholds for testing

4. **Enable Blockchain Rewards**
   - Call smart contract after sessions
   - Mint tokens to user wallet
   - Show transaction history

---

## 🆘 Current Workarounds

### For Testing Blockchain:
1. Use the hardcoded wallet address
2. Manually call smart contract functions
3. Check Celo Explorer for transactions

### For Testing Alerts:
1. Manually trigger high drowsiness (close eyes)
2. Wait 5 seconds for AI analysis
3. Check browser console for logs

### For Safe Stops:
1. Use Navigation & Routes tab
2. Enter location manually
3. View map for nearby stops

---

**Last Updated**: December 5, 2025
**Status**: Active Development
**Version**: 1.0.0-beta
