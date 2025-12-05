# SafeDrive AI - Render Deployment Guide

## 🚀 Deployed URLs

- **Backend**: https://safedrive-backend-j75m.onrender.com
- **Frontend**: (Will be deployed next)

---

## ✅ Backend Deployment (COMPLETED)

### Backend Environment Variables (Already Set)

```
HF_API_KEY = your_huggingface_api_key
GROQ_API_KEY = your_groq_api_key
ORS_API_KEY = your_ors_api_key
MONGO_URI = your_mongodb_connection_string
DEBUG = false
PYTHON_VERSION = 3.11.0
```

### Test Backend

```bash
curl https://safedrive-backend-j75m.onrender.com/health
curl https://safedrive-backend-j75m.onrender.com/api/test-ai
```

---

## 📦 Frontend Deployment (NEXT STEPS)

### Step 1: Go to Render Dashboard

- Visit: https://dashboard.render.com/
- Click "New +" → "Web Service"

### Step 2: Connect Repository

- Select: `Subharjun/safe-drive-AI`
- Click "Connect"

### Step 3: Configure Service

```
Name: safedrive-frontend
Region: Oregon (US West)
Branch: main
Root Directory: frontend
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
Instance Type: Free
```

### Step 4: Add Environment Variables

Click "Advanced" → "Add Environment Variable" for each:

#### Required Variables:

**1. Node Version**

```
Key: NODE_VERSION
Value: 18.17.0
```

**2. Backend URL**

```
Key: NEXT_PUBLIC_BACKEND_URL
Value: https://safedrive-backend-j75m.onrender.com
```

**3. Groq API Key**

```
Key: NEXT_PUBLIC_GROQ_API_KEY
Value: your_groq_api_key_here
```

**4. MongoDB URI**

```
Key: MONGODB_URI
Value: your_mongodb_connection_string_here
```

**5. Celo RPC URL**

```
Key: NEXT_PUBLIC_CELO_RPC_URL
Value: https://alfajores-forno.celo-testnet.org
```

**6. Celo Network**

```
Key: NEXT_PUBLIC_CELO_NETWORK
Value: alfajores
```

**7. ORS API Key**

```
Key: NEXT_PUBLIC_ORS_API_KEY
Value: your_ors_api_key_here
```

> **Note**: Use your actual API keys from your local `.env` files when setting these in Render dashboard.

### Step 5: Deploy

- Click "Create Web Service"
- Wait 5-10 minutes for deployment
- You'll get a URL like: `https://safedrive-frontend-xyz.onrender.com`

---

## 🔒 Security Notes

### ✅ Safe to Deploy (Public)

- Backend URL
- API keys (Groq, ORS, HF)
- MongoDB connection string
- Celo RPC URL

### ❌ NEVER Deploy (Keep Secret)

- Private keys
- Wallet private keys
- Personal credentials

**For blockchain features**: Users will connect their own wallets (MetaMask, WalletConnect) - no hardcoded private keys needed!

---

## 🧪 Testing After Deployment

### Test Backend

```bash
# Health check
curl https://safedrive-backend-j75m.onrender.com/health

# AI systems test
curl https://safedrive-backend-j75m.onrender.com/api/test-ai
```

### Test Frontend

1. Open: `https://your-frontend-url.onrender.com`
2. Click "Live Monitor"
3. Click "Start Monitoring"
4. Allow camera access
5. Watch real-time AI analysis!

### Test WebSocket Connection

- Open browser console (F12)
- Look for: "WebSocket connected"
- Should see real-time updates every 2 seconds

---

## 🔧 Troubleshooting

### Frontend Build Fails

**Error**: `Module not found`

```bash
# Check package.json is correct
# Verify all dependencies are listed
# Try locally: npm install && npm run build
```

### WebSocket Connection Fails

**Error**: `WebSocket connection failed`

- Check backend URL is correct
- Verify CORS settings in backend
- Check browser console for errors

### Camera Not Working

**Error**: `NotAllowedError`

- Allow camera permissions in browser
- Use HTTPS (Render provides this automatically)
- Try different browser (Chrome recommended)

---

## 📊 Monitoring

### Render Dashboard

- View logs: Service → Logs tab
- Check metrics: Service → Metrics tab
- Monitor deploys: Service → Events tab

### Backend Logs

Look for:

```
✅ Lightweight mode: Using API-based analysis
INFO: Uvicorn running on http://0.0.0.0:10000
🤖 Groq Vision Drowsiness: 0.XX
✅ HF API emotion detection: ...
```

### Frontend Logs

Look for:

```
WebSocket connected
Received analysis: {drowsiness: 0.XX, stress: 0.XX}
```

---

## 🚀 Post-Deployment

### Update README

Add deployed URLs to README.md:

```markdown
## 🌐 Live Demo

- **Frontend**: https://your-frontend-url.onrender.com
- **Backend API**: https://safedrive-backend-j75m.onrender.com
```

### Share with Users

```
🎉 SafeDrive AI is now live!

Frontend: https://your-frontend-url.onrender.com
Backend: https://safedrive-backend-j75m.onrender.com

Features:
✅ Real-time AI driver monitoring
✅ Live video analysis with Groq Vision
✅ Emotion detection with Hugging Face
✅ Dynamic safety recommendations
✅ Blockchain-powered wellness tracking
```

---

## 📝 Deployment Checklist

### Backend ✅

- [x] Deployed to Render
- [x] Environment variables set
- [x] Health check passing
- [x] AI test endpoint working
- [x] CORS configured

### Frontend (In Progress)

- [ ] Create web service on Render
- [ ] Configure build settings
- [ ] Add environment variables
- [ ] Deploy and test
- [ ] Verify WebSocket connection
- [ ] Test camera access
- [ ] Test AI analysis

---

**Next**: Deploy frontend following Step 1-5 above!
