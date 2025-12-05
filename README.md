# SafeDrive AI - Real-Time Driver Wellness Monitoring

> **🚨 IMPORTANT**: This system uses **REAL AI**, not mock data! Powered by Hugging Face and Groq APIs for genuine driver behavior analysis.

A comprehensive real-time driver safety and wellness monitoring solution that uses computer vision, AI analysis, and smart interventions to keep drivers and passengers safe.

## ✨ Real AI Integration (Live Video Analysis!)

This is **NOT a simulation**. SafeDrive AI analyzes **LIVE VIDEO** in real-time:

### 📹 How It Works:
1. **Webcam captures live video** at 30fps (640x480)
2. **Frame extracted every 2 seconds** from continuous stream
3. **Sent to AI via WebSocket** for instant analysis
4. **Groq Vision + HF API** analyze the frame
5. **Results displayed immediately** on dashboard
6. **Process repeats continuously** while monitoring

### 🤖 AI Technologies:
- ✅ **Groq Vision API** (`llama-3.2-11b-vision-preview`) - Drowsiness from live frames
- ✅ **Hugging Face API** (3 production models) - Emotion detection from live frames
- ✅ **Groq Text API** (`llama3-8b-8192`) - Dynamic safety recommendations
- ✅ **WebSocket** - Real-time bidirectional communication
- ✅ **OpenCV** - Fallback when APIs unavailable

**This is REAL-TIME video analysis, not batch image processing!**

**Proof**: Start monitoring and watch the logs show `🤖 Groq Vision Drowsiness` every 2 seconds!

## 🚗 Features

### Real-time Monitoring
- **Video-based drowsiness detection** using facial analysis and eye tracking
- **Stress level monitoring** through facial expression analysis
- **Steering pattern analysis** for fatigue detection
- **Live wellness scoring** with immediate feedback

### AI-Powered Analysis (100% REAL AI!)
- **Groq Vision AI** - Primary drowsiness detection
  - `llama-3.2-11b-vision-preview` - Analyzes facial images for drowsiness signs
  - Detects: droopy eyelids, eye closure, yawning, head tilting, micro-sleeps
  - Returns AI-generated drowsiness scores with reasoning
- **Hugging Face API** - Real-time facial emotion detection
  - `dima806/facial_emotions_image_detection` - Primary emotion detector
  - `trpakov/vit-face-expression` - Vision transformer for faces
  - `Rajaram1996/FacialEmoRecog` - Backup emotion recognition
  - Sends actual face images, not text descriptions
- **Groq Text AI** - Dynamic safety recommendations
  - `llama3-8b-8192` - Context-aware safety recommendations
  - Generates unique advice based on real-time driver state
- **OpenCV Computer Vision** - Fallback when APIs unavailable
  - Eye Aspect Ratio (EAR) calculation
  - Temporal smoothing for realistic behavior
  - Facial landmark detection

### Smart Interventions
- **Real-time safety alerts** with severity levels
- **Personalized recommendations** based on AI analysis
- **Safe stop suggestions** using ORS API
- **Route optimization** for driver wellness

### Comprehensive Dashboard
- **Live video monitoring** with real-time analysis
- **Wellness metrics** and historical trends
- **Safety alerts** management system
- **Route planning** with safety considerations
- **Analytics dashboard** with insights and reporting

## 🛠 Technology Stack

### Backend (FastAPI)
- **FastAPI** - High-performance async API framework
- **WebSocket** - Real-time communication
- **OpenCV** - Computer vision processing
- **Transformers** - Hugging Face model integration
- **Motor** - Async MongoDB driver

### Frontend (Next.js)
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **React Webcam** - Camera integration

### AI & APIs (Production-Ready)
- **Hugging Face Inference API**:
  - `dima806/facial_emotions_image_detection` - Facial emotion detection
  - `trpakov/vit-face-expression` - Vision transformer
  - `Rajaram1996/FacialEmoRecog` - Emotion recognition
  - Real image analysis, not text-based simulation
- **Groq API**:
  - `llama-3.2-11b-vision-preview` - Vision analysis
  - `llama3-8b-8192` - Text generation for recommendations
  - `dima806/facial_emotions_image_detection` - Facial emotion detection
  - `microsoft/resnet-50` - Computer vision
- **Groq API** - AI-powered recommendations
- **ORS API** - Route optimization and POI search
- **MongoDB Atlas** - Cloud database

### Infrastructure
- **Docker** - Containerization
- **Redis** - Caching and session management
- **WebSocket** - Real-time data streaming

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Using Docker (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd driver-wellness-monitor
```

2. **Start the application**
```bash
docker-compose up -d
```

3. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Local Development

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📊 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   AI Models     │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│ (Hugging Face)  │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • WebSocket     │    │ • Drowsiness    │
│ • Video Stream  │    │ • CV Processing │    │ • Emotion       │
│ • Analytics     │    │ • API Routes    │    │ • Vision        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │              │   External APIs │             │
         └──────────────►│                 │◄────────────┘
                        │ • Groq API      │
                        │ • ORS API       │
                        │ • MongoDB Atlas │
                        └─────────────────┘
```

## 🔧 Configuration

### Environment Variables

Create `backend/.env` with:

```env
# Hugging Face API (Emotion Detection)
HF_API_KEY=your_huggingface_api_key_here

# Groq API (AI Recommendations & Vision)
GROQ_API_KEY=your_groq_api_key_here

# ORS API (Route Optimization)
ORS_API_KEY=your_ors_api_key_here

# MongoDB Atlas (Database)
MONGO_URI=your_mongodb_connection_string_here
```

**Note**: The HF API key is already configured for testing. Get your own keys:
- Hugging Face: https://huggingface.co/settings/tokens
- Groq: https://console.groq.com/keys
- OpenRouteService: https://openrouteservice.org/dev/#/signup

## 📱 Usage Guide

### 1. Start Monitoring
- Navigate to the "Live Monitor" tab
- Click "Start Monitoring" to begin video analysis
- Grant camera permissions when prompted

### 2. View Real-time Analysis
- Monitor drowsiness and stress levels in real-time
- Receive AI-powered safety recommendations
- Track wellness metrics and trends

### 3. Safety Alerts
- View active safety alerts in the "Safety Alerts" tab
- Acknowledge or dismiss alerts as needed
- Find nearby safe stops for breaks

### 4. Route Planning
- Use "Route Optimizer" for safety-focused navigation
- Set preferences for maximum driving time
- Get recommendations for rest stops

### 5. Analytics
- Review historical wellness data
- Analyze trends and patterns
- Get AI insights and recommendations

## 🔍 API Endpoints

### WebSocket
- `ws://localhost:8000/ws/monitor` - Real-time monitoring

### REST API
- `GET /` - Health check
- `GET /health` - System health status
- `GET /api/test-ai` - **Test all AI systems** (HF, Groq, MongoDB)
- `POST /api/test-emotion-detection` - **Test emotion detection with image**
- `POST /api/steering-analysis` - Analyze steering patterns
- `GET /api/safe-stops` - Find nearby safe stops
- `GET /api/analytics` - Get wellness analytics

### Testing AI Integration
```bash
# Test all AI components
curl http://localhost:8000/api/test-ai

# Test emotion detection with an image
curl -X POST http://localhost:8000/api/test-emotion-detection \
  -F "file=@test_face.jpg"
```

See [TEST_AI_GUIDE.md](TEST_AI_GUIDE.md) for comprehensive testing instructions.

## 🧠 AI Models & Detection

### Drowsiness Detection
- **Eye Aspect Ratio (EAR)** calculation
- **Facial landmark detection** using OpenCV
- **Real-time scoring** (0-1 scale)

### Stress Analysis
- **Facial emotion recognition** using Hugging Face models
- **Multi-emotion classification** (happy, sad, angry, etc.)
- **Stress level mapping** based on emotional state

### Steering Pattern Analysis
- **Movement variability** calculation
- **Correction frequency** analysis
- **Fatigue scoring** based on driving patterns

## 📈 Monitoring Metrics

### Wellness Score Components
- **Drowsiness Level** (50% weight)
- **Stress Level** (30% weight)
- **Steering Fatigue** (20% weight)

### Alert Severity Levels
- 🟢 **Low** (0-30%): Normal operation
- 🟡 **Medium** (30-60%): Caution advised
- 🟠 **High** (60-80%): Break recommended
- 🔴 **Critical** (80-100%): Immediate action required

## 🛡️ Safety Features

### Immediate Interventions
- **Real-time alerts** for dangerous conditions
- **Emergency stop recommendations**
- **Safe location suggestions**

### Preventive Measures
- **Break reminders** based on driving time
- **Route optimization** for safety
- **Wellness trend monitoring**

### Emergency Actions
- **Emergency stop** button
- **Emergency contact** integration
- **Location sharing** capabilities

## 🔮 Future Enhancements

### Advanced AI Features
- **Voice analysis** for stress detection
- **Heart rate monitoring** via wearables
- **Predictive fatigue modeling**

### Enhanced Integrations
- **Vehicle CAN bus** integration
- **Weather API** for route safety
- **Traffic condition** analysis

### Mobile Applications
- **iOS/Android apps** for passengers
- **Smartwatch integration**
- **Family monitoring** features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/docs`
- Review the troubleshooting guide

## 🙏 Acknowledgments

- **Hugging Face** for pre-trained AI models
- **OpenCV** for computer vision capabilities
- **Groq** for AI-powered recommendations
- **OpenRouteService** for routing and POI data
- **MongoDB Atlas** for cloud database services

---

**⚠️ Safety Notice**: This system is designed to assist drivers but should not replace proper rest, attention, and safe driving practices. Always prioritize safety and pull over if you feel drowsy or unwell.

deploy.js and blockchainService fake mock data, why? I want realistic , I wanna compile and deploy smart contract 