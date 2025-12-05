# 🚀 Deployment Guide: GitHub + Render

## 📋 Prerequisites

- GitHub account
- Render account (free tier works)
- Git installed on your machine
- Project ready (already done ✅)

---

## 🔐 IMPORTANT: Secure Your Secrets!

Before uploading to GitHub, make sure these files are in `.gitignore`:

- ✅ `.env.local` (contains wallet private keys!)
- ✅ `.env` (contains API keys)
- ✅ `node_modules/`
- ✅ `venv/`
- ✅ `__pycache__/`

**Your `.gitignore` is already configured correctly!** ✅

---

## 📤 Part 1: Upload to GitHub

### Step 1: Initialize Git Repository

Open PowerShell in your project root and run:

```powershell
# Navigate to project directory
cd C:\Users\subha\OneDrive\Desktop\mobilo

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: SafeDrive AI - Blockchain Driver Wellness Platform"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com
2. Click the **"+"** icon → **"New repository"**
3. Repository name: `safedrive-ai`
4. Description: `Blockchain-powered driver wellness platform with AI monitoring and Celo rewards`
5. Choose **Public** (for hackathon visibility) or **Private**
6. **DO NOT** initialize with README (you already have one)
7. Click **"Create repository"**

### Step 3: Push to GitHub

GitHub will show you commands. Use these:

```powershell
# Add remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/safedrive-ai.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

### Step 4: Verify Upload

1. Refresh your GitHub repository page
2. You should see all your files
3. Check that `.env.local` is **NOT** visible (it should be ignored)

---

## 🌐 Part 2: Deploy to Render

### Option A: Automatic Deployment (Recommended)

#### Backend Deployment:

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:

   - **Name:** `safedrive-backend`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free

5. Add Environment Variables:

   ```
   PYTHON_VERSION=3.11.0
   GROQ_API_KEY=your_groq_api_key_here
   ORS_API_KEY=your_ors_api_key_here
   MONGO_URI=your_mongodb_connection_string_here
   ```

6. Click **"Create Web Service"**
7. Wait for deployment (5-10 minutes)
8. Copy the backend URL (e.g., `https://safedrive-backend.onrender.com`)

#### Frontend Deployment:

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:

   - **Name:** `safedrive-frontend`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

4. Add Environment Variables:

   ```
   NODE_VERSION=18.17.0
   NEXT_PUBLIC_API_URL=https://safedrive-backend.onrender.com
   NEXT_PUBLIC_SOCKET_URL=https://safedrive-backend.onrender.com
   NEXT_PUBLIC_CELO_NETWORK=alfajores
   NEXT_PUBLIC_CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
   NEXT_PUBLIC_WALLET_PRIVATE_KEY=your_wallet_private_key_here
   NEXT_PUBLIC_WALLET_ADDRESS=your_wallet_address_here
   NEXT_PUBLIC_ORS_API_KEY=your_ors_api_key_here
   NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key_here
   ```

5. Click **"Create Web Service"**
6. Wait for deployment (10-15 minutes)
7. Your app will be live at `https://safedrive-frontend.onrender.com`

---

## ✅ Post-Deployment Checklist

### Test Backend:

```bash
# Health check
curl https://safedrive-backend.onrender.com/

# Should return: {"message": "Driver Wellness Monitor API", "status": "active"}
```

### Test Frontend:

1. Visit `https://safedrive-frontend.onrender.com`
2. Check if the dashboard loads
3. Test video monitoring
4. Verify blockchain dashboard shows contract addresses

### Common Issues & Fixes:

#### Issue 1: Backend fails to start

**Solution:** Check logs in Render dashboard

- Verify Python version is 3.11
- Ensure all environment variables are set
- Check MongoDB connection string

#### Issue 2: Frontend can't connect to backend

**Solution:** Update CORS in `backend/main.py`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://safedrive-frontend.onrender.com"  # Add this
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Issue 3: Build timeout

**Solution:** Render free tier has 15-minute build limit

- Optimize dependencies
- Use build cache
- Consider upgrading to paid tier

#### Issue 4: Cold starts (app sleeps after 15 min)

**Solution:** Free tier apps sleep when inactive

- First request takes 30-60 seconds to wake up
- Upgrade to paid tier for always-on
- Use a service like UptimeRobot to ping every 14 minutes

---

## 🔄 Continuous Deployment

Once set up, any push to GitHub will automatically deploy:

```powershell
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push origin main

# Render will automatically rebuild and deploy!
```

---

## 📊 Monitoring Your Deployment

### Render Dashboard:

- View logs: Click on service → "Logs" tab
- Check metrics: CPU, Memory, Request count
- View events: Deployments, restarts, errors

### Health Checks:

- Backend: `https://safedrive-backend.onrender.com/`
- Frontend: `https://safedrive-frontend.onrender.com/`

---

## 🎯 Production Optimizations (Optional)

### 1. Custom Domain:

- Buy domain (e.g., safedrive.ai)
- Add to Render: Settings → Custom Domain
- Update DNS records

### 2. Environment-Specific Configs:

```javascript
// frontend/next.config.js
const isProd = process.env.NODE_ENV === "production";

module.exports = {
  env: {
    API_URL: isProd
      ? "https://safedrive-backend.onrender.com"
      : "http://localhost:8000",
  },
};
```

### 3. Database Optimization:

- Use MongoDB Atlas with proper indexes
- Enable connection pooling
- Set up read replicas

### 4. Caching:

- Add Redis for session management
- Enable CDN for static assets
- Implement API response caching

---

## 🔐 Security Best Practices

### 1. Environment Variables:

- ✅ Never commit `.env` files
- ✅ Use Render's environment variable management
- ✅ Rotate API keys regularly

### 2. CORS Configuration:

- ✅ Only allow specific origins
- ✅ Don't use `allow_origins=["*"]` in production

### 3. Rate Limiting:

```python
# backend/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/endpoint")
@limiter.limit("10/minute")
async def endpoint():
    pass
```

### 4. HTTPS Only:

- ✅ Render provides free SSL
- ✅ Redirect HTTP to HTTPS
- ✅ Use secure cookies

---

## 📱 Mobile Deployment (Future)

### React Native App:

1. Use Expo for easy deployment
2. Connect to same backend API
3. Deploy to App Store / Play Store

### Progressive Web App (PWA):

1. Add service worker
2. Enable offline mode
3. Add to home screen capability

---

## 🆘 Troubleshooting

### Logs Not Showing:

```python
# Add to backend/main.py
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/")
async def root():
    logger.info("Health check endpoint called")
    return {"status": "ok"}
```

### Database Connection Issues:

```python
# Test MongoDB connection
from motor.motor_asyncio import AsyncIOMotorClient

async def test_db():
    client = AsyncIOMotorClient(MONGO_URI)
    try:
        await client.admin.command('ping')
        print("✅ MongoDB connected")
    except Exception as e:
        print(f"❌ MongoDB error: {e}")
```

### Build Failures:

1. Check Render logs for specific error
2. Test build locally first
3. Verify all dependencies in requirements.txt/package.json
4. Check Node/Python version compatibility

---

## 🎉 Success Checklist

- [ ] Code pushed to GitHub
- [ ] Backend deployed on Render
- [ ] Frontend deployed on Render
- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] CORS configured correctly
- [ ] Database connected
- [ ] Blockchain integration working
- [ ] All features functional
- [ ] Logs monitoring set up

---

## 🔗 Useful Links

- **GitHub Repo:** `https://github.com/YOUR_USERNAME/safedrive-ai`
- **Backend URL:** `https://safedrive-backend.onrender.com`
- **Frontend URL:** `https://safedrive-frontend.onrender.com`
- **Render Dashboard:** `https://dashboard.render.com`
- **Celo Explorer:** `https://explorer.celo.org/alfajores`

---

## 📞 Support

If you encounter issues:

1. Check Render logs first
2. Review this guide
3. Check Render documentation: https://render.com/docs
4. GitHub Issues: Create issue in your repo

---

**🚀 You're ready to deploy! Follow the steps above and your app will be live!**

Good luck with your hackathon! 🏆
