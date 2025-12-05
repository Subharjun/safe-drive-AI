# SafeDrive AI - Setup Guide

## 🚀 Quick Setup (5 Minutes)

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- Git

---

## Step 1: Clone Repository

```bash
git clone https://github.com/Subharjun/safe-drive-AI.git
cd safe-drive-AI
```

---

## Step 2: Backend Setup

### 2.1 Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2.2 Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit .env with your API keys
# Use any text editor (notepad, vim, nano, etc.)
```

**Required API Keys** (Get them free):

1. **Hugging Face API** (for emotion detection)
   - Sign up: https://huggingface.co/join
   - Get token: https://huggingface.co/settings/tokens
   - Add to `.env`: `HF_API_KEY=hf_xxxxxxxxxxxxx`

2. **Groq API** (for AI recommendations)
   - Sign up: https://console.groq.com
   - Get key: https://console.groq.com/keys
   - Add to `.env`: `GROQ_API_KEY=gsk_xxxxxxxxxxxxx`

3. **OpenRouteService** (for route optimization)
   - Sign up: https://openrouteservice.org/dev/#/signup
   - Get key from dashboard
   - Add to `.env`: `ORS_API_KEY=xxxxxxxxxxxxx`

4. **MongoDB Atlas** (for database)
   - Sign up: https://www.mongodb.com/cloud/atlas/register
   - Create free cluster
   - Get connection string
   - Add to `.env`: `MONGO_URI=mongodb+srv://...`

**Your `backend/.env` should look like:**
```env
HF_API_KEY=hf_your_actual_key_here
GROQ_API_KEY=gsk_your_actual_key_here
ORS_API_KEY=your_actual_key_here
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/...
```

### 2.3 Start Backend

```bash
python main.py
```

You should see:
```
✅ Lightweight mode: Using API-based analysis
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## Step 3: Frontend Setup

### 3.1 Install Dependencies

```bash
cd ../frontend
npm install
```

### 3.2 Configure Environment Variables

```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with your keys
```

**Your `frontend/.env.local` should have:**
```env
NEXT_PUBLIC_GROQ_API_KEY=gsk_your_actual_key_here
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/...
NEXT_PUBLIC_CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
```

### 3.3 Start Frontend

```bash
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

---

## Step 4: Test the System

### 4.1 Test Backend AI

Open a new terminal:
```bash
cd backend
python test_ai_quick.py
```

Expected output:
```
✅ Backend Health: PASSED
✅ AI Systems: PASSED
✅ Groq Recommendations: PASSED

All 3 tests passed! 🎉
```

### 4.2 Test Frontend

1. Open browser: http://localhost:3000
2. Click **"Live Monitor"** tab
3. Click **"Start Monitoring"**
4. Allow camera access
5. Watch real-time AI analysis!

---

## 🔧 Troubleshooting

### Backend won't start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`
```bash
pip install -r requirements.txt
```

**Error**: `Configuration errors: HF_API_KEY is required`
```bash
# Make sure backend/.env exists and has all keys
cat backend/.env  # Linux/Mac
type backend\.env  # Windows
```

### Frontend won't start

**Error**: `Module not found: Can't resolve 'react'`
```bash
rm -rf node_modules package-lock.json
npm install
```

**Error**: `EADDRINUSE: address already in use :::3000`
```bash
# Kill process on port 3000
npx kill-port 3000
npm run dev
```

### Camera not working

**Error**: `NotAllowedError: Permission denied`
- Allow camera access in browser settings
- Check if another app is using the camera
- Try a different browser (Chrome recommended)

### AI not responding

**Error**: `WebSocket connection failed`
- Make sure backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify firewall isn't blocking WebSocket

**Error**: `HF API returns 503`
- Model is loading (wait 20-30 seconds)
- System will automatically use Groq fallback
- Check HF API key is valid

---

## 📚 Next Steps

1. **Deploy to Production**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. **Understand the AI**: Read [REAL_AI_PROOF.md](REAL_AI_PROOF.md)
3. **Test Thoroughly**: Follow [TEST_AI_GUIDE.md](TEST_AI_GUIDE.md)
4. **Learn the Flow**: Check [LIVE_VIDEO_FLOW.md](LIVE_VIDEO_FLOW.md)

---

## 🆘 Still Having Issues?

1. **Check logs**: Look for error messages in terminal
2. **Verify API keys**: Test each API key individually
3. **Check versions**: Ensure Python 3.8+ and Node 18+
4. **Clear cache**: Delete `__pycache__`, `.next`, `node_modules`
5. **Start fresh**: Clone repo again in new directory

---

## ✅ Success Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] All API keys configured
- [ ] Test script passes all tests
- [ ] Camera access granted
- [ ] Live monitoring shows real-time analysis
- [ ] Recommendations appear when drowsiness/stress is high

---

**🎉 You're all set! SafeDrive AI is ready to keep drivers safe with real AI analysis.**

**Repository**: https://github.com/Subharjun/safe-drive-AI
