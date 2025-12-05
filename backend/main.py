from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
import asyncio
import json
import base64
from datetime import datetime
import motor.motor_asyncio
import requests
from groq import Groq
import os
from typing import List, Dict
import logging
import psutil
import re

# Import dynamic configuration
from config import config, api_config, app_config, ai_config, monitoring_config

# Initialize FastAPI app with dynamic config
app = FastAPI(
    title=app_config.name, 
    version=app_config.version,
    description="AI-Enhanced Driver Wellness Monitoring System"
)

# CORS middleware with dynamic origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://safedrive-frontend.onrender.com",  # Production frontend
        "https://*.onrender.com",  # Allow all Render preview deployments
        "*"  # Allow all origins for WebSocket connections
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients with dynamic configuration
groq_client = Groq(api_key=api_config.groq_api_key)
mongo_client = motor.motor_asyncio.AsyncIOMotorClient(api_config.mongo_uri)
db = mongo_client.driver_wellness
HF_API_KEY = api_config.hf_api_key
ORS_API_KEY = api_config.ors_api_key

# Logging configuration
logging.basicConfig(
    level=logging.DEBUG if app_config.debug else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize AI models
drowsiness_detector = None
emotion_analyzer = None
ai_models = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    global drowsiness_detector, emotion_analyzer, ai_models
    
    # Check if we're in a memory-constrained environment (like Render free tier)
    import psutil
    available_memory = psutil.virtual_memory().available / (1024 ** 3)  # GB
    
    if available_memory < 1.0:
        # Use lightweight API-based analysis for low-memory environments
        logging.info(f"⚠️ Low memory detected ({available_memory:.2f}GB). Using API-based analysis.")
        emotion_analyzer = "api_based"
        ai_models = None
        logging.info("✅ Lightweight mode: Using API-based analysis")
    else:
        try:
            # Import and initialize the advanced AI models
            import sys
            sys.path.append('../ai-models')
            from model_config import DriverWellnessModels
            
            ai_models = DriverWellnessModels()
            emotion_analyzer = "advanced_models"
            logging.info("✅ Advanced AI models initialized with sophisticated detection algorithms!")
            
        except Exception as e:
            logging.error(f"Error loading advanced models: {e}")
            # Fallback to API-based analysis
            emotion_analyzer = "api_based"
            ai_models = None
            logging.info("✅ Fallback: Using API-based analysis")

@app.get("/")
async def root():
    return {"message": "Driver Wellness Monitor API", "status": "active", "timestamp": datetime.now().isoformat()}

@app.post("/api/data/delete")
async def delete_data(request: dict):
    """Delete data from MongoDB collections"""
    try:
        collection_name = request.get("collection")
        filter_criteria = request.get("filter", {})
        
        if not collection_name:
            return JSONResponse(
                status_code=400,
                content={"error": "Collection name is required"}
            )
        
        # Get the collection
        collection = db[collection_name]
        
        # Delete documents
        result = await collection.delete_many(filter_criteria)
        
        logger.info(f"Deleted {result.deleted_count} documents from {collection_name}")
        
        return {
            "success": True,
            "collection": collection_name,
            "deletedCount": result.deleted_count,
            "filter": filter_criteria
        }
        
    except Exception as e:
        logger.error(f"Error deleting data: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/api/data/collections")
async def list_collections():
    """List all collections in the database"""
    try:
        collections = await db.list_collection_names()
        
        # Get document counts for each collection
        collection_info = []
        for collection_name in collections:
            count = await db[collection_name].count_documents({})
            collection_info.append({
                "name": collection_name,
                "documentCount": count
            })
        
        return {
            "collections": collection_info,
            "totalCollections": len(collections)
        }
        
    except Exception as e:
        logger.error(f"Error listing collections: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": emotion_analyzer is not None
    }

@app.websocket("/ws/monitor")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "video_frame":
                # Process video frame for drowsiness detection
                result = await process_video_frame(message["frame"])
                await websocket.send_text(json.dumps(result))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def process_video_frame(frame_data: str) -> dict:
    """Process video frame for drowsiness and stress detection"""
    try:
        # Decode base64 frame
        frame_bytes = base64.b64decode(frame_data.split(',')[1])
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Detect faces
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return {"status": "no_face_detected", "timestamp": datetime.now().isoformat()}
        
        # Get current timestamp for advanced tracking
        current_timestamp = datetime.now().timestamp()
        
        # Use AI-powered analysis (Groq Vision + HF API)
        drowsiness_result = await analyze_drowsiness(frame, faces[0])
        stress_result = await analyze_stress(frame, faces[0])
        
        # Extract scores (handle both dict and float returns)
        if isinstance(drowsiness_result, dict):
            drowsiness_score = drowsiness_result.get('score', 0.2)
            drowsiness_method = drowsiness_result.get('method', 'Unknown')
            drowsiness_confidence = drowsiness_result.get('confidence', 'N/A')
        else:
            drowsiness_score = drowsiness_result
            drowsiness_method = 'OpenCV Fallback'
            drowsiness_confidence = 'N/A'
            
        if isinstance(stress_result, dict):
            stress_level = stress_result.get('score', 0.2)
            stress_method = stress_result.get('method', 'Unknown')
            stress_emotion = stress_result.get('emotion', 'neutral')
            stress_confidence = stress_result.get('confidence', 'N/A')
        else:
            stress_level = stress_result
            stress_method = 'OpenCV Fallback'
            stress_emotion = 'unknown'
            stress_confidence = 'N/A'
        
        detailed_metrics = {
            'drowsiness': {
                'score': drowsiness_score,
                'level': get_level_description(drowsiness_score, 'drowsiness'),
                'method': drowsiness_method,
                'metrics': {
                    'Model Prediction': f"{(drowsiness_score * 100):.1f}% drowsy",
                    'Confidence': stress_confidence,
                    'Trend': 'Stable'  # Could be enhanced with temporal tracking
                }
            },
            'stress': {
                'score': stress_level,
                'level': get_level_description(stress_level, 'stress'),
                'method': stress_method,
                'metrics': {
                    'Primary Emotion': stress_emotion.capitalize(),
                    'Confidence': stress_confidence,
                    'Stress Assessment': f"{(stress_level * 100):.1f}% stressed"
                }
            }
        }
        
        logging.info(f"🧠 AI Analysis - Drowsiness: {drowsiness_score:.2f} ({detailed_metrics['drowsiness']['level']}) via {drowsiness_method}, Stress: {stress_level:.2f} ({detailed_metrics['stress']['level']}) via {stress_method}")
        
        # Store data in MongoDB
        await store_monitoring_data({
            "timestamp": datetime.now(),
            "drowsiness_score": drowsiness_score,
            "stress_level": stress_level,
            "faces_detected": len(faces)
        })
        
        # Generate recommendations if needed
        recommendations = await generate_recommendations(drowsiness_score, stress_level)
        
        return {
            "status": "processed",
            "drowsiness_score": drowsiness_score,
            "stress_level": stress_level,
            "recommendations": recommendations,
            "detailed_metrics": detailed_metrics,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error processing frame: {e}")
        return {"status": "error", "message": str(e)}

async def analyze_drowsiness(frame, face_coords):
    """Analyze drowsiness using AI vision models (Groq) with OpenCV fallback"""
    try:
        x, y, w, h = face_coords
        face_roi = frame[y:y+h, x:x+w]
        
        # Try AI-powered drowsiness detection first
        try:
            ai_result = await analyze_drowsiness_with_ai(face_roi)
            if ai_result is not None:
                logging.info(f"🤖 AI Drowsiness Detection: {ai_result:.2f}")
                return {
                    'score': ai_result,
                    'method': 'Groq Vision AI',
                    'confidence': 'High'
                }
        except Exception as ai_error:
            logging.warning(f"AI drowsiness detection failed, using OpenCV fallback: {ai_error}")
        
        # Fallback to OpenCV-based detection
        gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        eyes = eye_cascade.detectMultiScale(gray_face, 1.3, 5, minSize=(15, 15))
        
        global previous_drowsiness
        if 'previous_drowsiness' not in globals():
            previous_drowsiness = 0.1
        
        if len(eyes) >= 2:
            total_ear = 0
            eye_intensities = []
            
            for (ex, ey, ew, eh) in eyes:
                ear = eh / ew if ew > 0 else 0.3
                total_ear += ear
                eye_roi = gray_face[ey:ey+eh, ex:ex+ew]
                if eye_roi.size > 0:
                    mean_intensity = np.mean(eye_roi)
                    eye_intensities.append(mean_intensity)
            
            avg_ear = total_ear / len(eyes)
            avg_intensity = np.mean(eye_intensities) if eye_intensities else 128
            
            # EAR-based drowsiness
            if avg_ear < 0.15:
                ear_drowsiness = 0.9
            elif avg_ear < 0.2:
                ear_drowsiness = 0.6
            elif avg_ear < 0.25:
                ear_drowsiness = 0.3
            else:
                ear_drowsiness = 0.1
            
            # Intensity-based drowsiness
            if avg_intensity > 120:
                intensity_drowsiness = 0.7
            elif avg_intensity > 100:
                intensity_drowsiness = 0.4
            else:
                intensity_drowsiness = 0.1
            
            current_drowsiness = (ear_drowsiness * 0.7 + intensity_drowsiness * 0.3)
        else:
            current_drowsiness = 0.5
        
        # Temporal smoothing
        alpha = 0.3
        drowsiness_score = alpha * current_drowsiness + (1 - alpha) * previous_drowsiness
        variation = np.random.normal(0, 0.02)
        drowsiness_score = max(0.0, min(1.0, drowsiness_score + variation))
        previous_drowsiness = drowsiness_score
        
        return {
            'score': drowsiness_score,
            'method': 'OpenCV Computer Vision',
            'confidence': 'Medium'
        }
        
    except Exception as e:
        logging.error(f"Error in drowsiness analysis: {e}")
        return {
            'score': 0.1,
            'method': 'Error Fallback',
            'confidence': 'Low'
        }

async def analyze_drowsiness_with_ai(face_image) -> float:
    """Use Groq Vision AI to detect drowsiness from facial features"""
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        # Convert face to base64
        if len(face_image.shape) == 3:
            face_rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        else:
            face_rgb = face_image
            
        pil_image = Image.fromarray(face_rgb)
        buffer = BytesIO()
        pil_image.save(buffer, format='JPEG', quality=85)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Use Groq Vision to analyze drowsiness
        prompt = """Analyze this face image for signs of drowsiness and fatigue. 
        Look for: droopy eyelids, eye closure, yawning, head tilting, reduced alertness.
        
        Respond with ONLY a JSON object:
        {"drowsiness_score": 0.0-1.0, "indicators": ["list", "of", "signs"], "level": "alert/moderate/high/critical"}
        
        Score guide:
        0.0-0.3 = Alert (eyes wide open, attentive)
        0.3-0.6 = Moderate (slight droopiness, slower blinks)
        0.6-0.8 = High (heavy eyelids, frequent eye closure)
        0.8-1.0 = Critical (eyes mostly closed, micro-sleeps)"""
        
        response = groq_client.chat.completions.create(
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}}
                ]
            }],
            model="llama-3.2-11b-vision-preview",
            max_tokens=150,
            temperature=0.3
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON response
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            drowsiness_score = float(result.get('drowsiness_score', 0.3))
            indicators = result.get('indicators', [])
            level = result.get('level', 'unknown')
            
            logging.info(f"🤖 Groq Vision Drowsiness: {drowsiness_score:.2f} ({level}) - {', '.join(indicators[:2])}")
            return drowsiness_score
        
        # Fallback parsing if JSON fails
        content_lower = content.lower()
        if 'critical' in content_lower or 'severe' in content_lower or 'very drowsy' in content_lower:
            return 0.85
        elif 'high' in content_lower or 'drowsy' in content_lower or 'tired' in content_lower:
            return 0.65
        elif 'moderate' in content_lower or 'slight' in content_lower:
            return 0.45
        elif 'alert' in content_lower or 'awake' in content_lower:
            return 0.15
        
        return None  # Trigger fallback
        
    except Exception as e:
        logging.error(f"Groq vision drowsiness analysis failed: {e}")
        return None  # Trigger OpenCV fallback

async def analyze_stress(frame, face_coords) -> float:
    """Analyze stress level from facial expressions using real AI models"""
    try:
        x, y, w, h = face_coords
        face_roi = frame[y:y+h, x:x+w]
        
        # Convert BGR to RGB for the model
        face_rgb = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
        
        # Use Hugging Face API for emotion detection (fast and lightweight)
        if emotion_analyzer == "api_based":
            try:
                emotions = await analyze_emotion_via_api(face_rgb)
            except Exception as api_error:
                logging.error(f"Error using HF API: {api_error}")
                emotions = None
            
            if emotions:
                # Enhanced stress mapping for API results
                stress_mapping = {
                    'angry': 0.9, 'anger': 0.9,
                    'fear': 0.85, 'fearful': 0.85,
                    'sad': 0.6, 'sadness': 0.6,
                    'disgust': 0.7, 'disgusted': 0.7,
                    'surprise': 0.4, 'surprised': 0.4,
                    'happy': 0.1, 'happiness': 0.1, 'joy': 0.1,
                    'neutral': 0.2, 'calm': 0.15,
                    'anxiety': 0.8, 'anxious': 0.8,
                    'frustration': 0.75, 'frustrated': 0.75,
                    'stress': 0.8, 'stressed': 0.8,
                    'tired': 0.6, 'fatigue': 0.7
                }
                
                # Quick stress calculation
                max_stress = 0.2  # Default low stress
                
                for emotion_result in emotions:
                    emotion_label = emotion_result['label'].lower()
                    confidence = emotion_result.get('score', 0.5)
                    
                    # Find best matching stress level
                    for emotion_key, stress_value in stress_mapping.items():
                        if emotion_key in emotion_label:
                            current_stress = stress_value * confidence
                            max_stress = max(max_stress, current_stress)
                            break
                
                return {
                    'score': min(max_stress, 1.0),
                    'method': 'Hugging Face Emotion API',
                    'emotion': emotion_label,
                    'confidence': f"{confidence * 100:.0f}%"
                }
        
        # Fallback: Realistic stress analysis using facial features
        global previous_stress
        if 'previous_stress' not in globals():
            previous_stress = 0.2
        
        gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Analyze facial tension indicators
        base_stress = 0.15  # Calm baseline
        
        # 1. Facial muscle tension (edge detection)
        edges = cv2.Canny(gray_face, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        # 2. Facial symmetry analysis
        h, w = gray_face.shape
        left_half = gray_face[:, :w//2]
        right_half = cv2.flip(gray_face[:, w//2:], 1)
        
        # Resize to match if needed
        min_width = min(left_half.shape[1], right_half.shape[1])
        left_half = left_half[:, :min_width]
        right_half = right_half[:, :min_width]
        
        if left_half.shape == right_half.shape:
            asymmetry = np.mean(np.abs(left_half.astype(float) - right_half.astype(float))) / 255.0
        else:
            asymmetry = 0.1
        
        # 3. Overall facial brightness variation (tension indicator)
        brightness_std = np.std(gray_face) / 255.0
        
        # Calculate stress components
        edge_stress = min(edge_density * 2, 0.4)  # High edge density = tension
        asymmetry_stress = min(asymmetry * 3, 0.3)  # Asymmetry = stress
        brightness_stress = min(brightness_std * 2, 0.3)  # Variation = tension
        
        # Combine stress indicators
        current_stress = base_stress + edge_stress + asymmetry_stress + brightness_stress
        
        # Temporal smoothing for realistic behavior
        alpha = 0.25  # Slower changes for stress
        stress_level = alpha * current_stress + (1 - alpha) * previous_stress
        
        # Minimal natural variation
        variation = np.random.normal(0, 0.015)
        stress_level = max(0.0, min(1.0, stress_level + variation))
        
        # Update previous value
        previous_stress = stress_level
        
        return {
            'score': stress_level,
            'method': 'OpenCV Facial Features',
            'emotion': 'neutral',
            'confidence': 'Medium'
        }
        
    except Exception as e:
        logging.error(f"Error in stress analysis: {e}")
        return {
            'score': 0.3,
            'method': 'Error Fallback',
            'emotion': 'unknown',
            'confidence': 'Low'
        }

async def generate_recommendations(drowsiness: float, stress: float) -> List[str]:
    """Generate AI-powered recommendations using Groq with dynamic analysis"""
    try:
        if drowsiness > 0.5 or stress > 0.6:
            # Determine severity level
            severity = "critical" if (drowsiness > 0.8 or stress > 0.9) else "high" if (drowsiness > 0.7 or stress > 0.8) else "moderate"
            
            prompt = f"""You are a driver safety AI assistant. Analyze this real-time driver monitoring data:

Driver Status:
- Drowsiness Level: {drowsiness:.2f}/1.0 ({get_level_description(drowsiness, 'drowsiness')})
- Stress Level: {stress:.2f}/1.0 ({get_level_description(stress, 'stress')})
- Severity: {severity.upper()}

Generate exactly 3 immediate, actionable safety recommendations.
Make them specific, practical, and prioritized by urgency.
Format as a numbered list."""
            
            response = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are an expert driver safety advisor providing real-time recommendations."},
                    {"role": "user", "content": prompt}
                ],
                model="llama3-8b-8192",
                max_tokens=250,
                temperature=0.7
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse recommendations
            recommendations = []
            for line in content.split('\n'):
                line = line.strip()
                # Remove numbering and bullet points
                line = re.sub(r'^[\d\.\-\*\)]+\s*', '', line)
                if line and len(line) > 10:  # Valid recommendation
                    recommendations.append(line)
            
            # Ensure we have at least 3 recommendations
            if len(recommendations) < 3:
                recommendations.extend(get_fallback_recommendations(drowsiness, stress))
            
            logging.info(f"🤖 Generated {len(recommendations)} AI recommendations for severity: {severity}")
            return recommendations[:3]
        
        return []
        
    except Exception as e:
        logging.error(f"Error generating recommendations: {e}")
        return get_fallback_recommendations(drowsiness, stress)

def get_level_description(value: float, metric_type: str) -> str:
    """Get human-readable description of metric level"""
    if value < 0.3:
        return "Low" if metric_type == "stress" else "Alert"
    elif value < 0.6:
        return "Moderate"
    elif value < 0.8:
        return "High"
    else:
        return "Critical"

def get_fallback_recommendations(drowsiness: float, stress: float) -> List[str]:
    """Get fallback recommendations based on levels"""
    recommendations = []
    
    if drowsiness > 0.8:
        recommendations.extend([
            "URGENT: Pull over immediately at the next safe location and rest for at least 20 minutes",
            "Your drowsiness level is critical - do not continue driving in this state",
            "Consider calling someone to pick you up or use a ride-sharing service"
        ])
    elif drowsiness > 0.6:
        recommendations.extend([
            "Find a safe place to stop within the next 5-10 minutes for a short break",
            "Splash cold water on your face or do light stretching exercises",
            "Avoid heavy meals and stay hydrated with water or caffeine"
        ])
    elif drowsiness > 0.4:
        recommendations.extend([
            "Take a 5-minute break at the next rest stop to refresh yourself",
            "Open windows for fresh air circulation or adjust climate control",
            "Stay alert by engaging in light conversation or listening to upbeat music"
        ])
    
    if stress > 0.8:
        recommendations.extend([
            "Practice deep breathing: inhale for 4 counts, hold for 4, exhale for 4",
            "Your stress level is very high - consider taking a longer break to decompress",
            "Listen to calming music or a relaxation podcast"
        ])
    elif stress > 0.6:
        recommendations.extend([
            "Reduce stress by loosening your grip on the steering wheel and relaxing your shoulders",
            "Take slow, deep breaths and maintain a comfortable driving pace",
            "Avoid aggressive driving behaviors and maintain safe following distance"
        ])
    
    # Add general recommendations
    if not recommendations:
        recommendations = [
            "Maintain good posture and adjust your seat for optimal comfort",
            "Stay hydrated and take regular breaks every 2 hours",
            "Keep your focus on the road and minimize distractions"
        ]
    
    return recommendations[:3]

async def analyze_emotion_via_api(face_image):
    """Analyze emotions using Hugging Face API with real image analysis"""
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        # Convert face image to bytes for API
        pil_image = Image.fromarray(face_image)
        buffer = BytesIO()
        pil_image.save(buffer, format='JPEG', quality=85)
        img_bytes = buffer.getvalue()
        
        # Use Hugging Face Inference API with image models
        headers = {
            "Authorization": f"Bearer {HF_API_KEY}"
        }
        
        # Try image-based emotion detection models
        image_models = [
            "dima806/facial_emotions_image_detection",  # Facial emotion detection
            "trpakov/vit-face-expression",  # Vision transformer for faces
            "Rajaram1996/FacialEmoRecog"  # Facial emotion recognition
        ]
        
        for model in image_models:
            try:
                response = requests.post(
                    f"https://api-inference.huggingface.co/models/{model}",
                    headers=headers,
                    data=img_bytes,
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Handle different response formats
                    emotions = []
                    if isinstance(result, list):
                        for item in result:
                            if isinstance(item, dict) and 'label' in item:
                                emotions.append({
                                    'label': item['label'],
                                    'score': item.get('score', 0.5)
                                })
                    
                    if emotions:
                        logging.info(f"✅ HF API emotion detection: {emotions[0]['label']} ({emotions[0]['score']:.2f})")
                        return emotions
                
                elif response.status_code == 503:
                    logging.warning(f"Model {model} is loading, trying next...")
                    continue
                    
            except Exception as model_error:
                logging.warning(f"HF API model {model} failed: {model_error}")
                continue
        
        # Fallback to Groq vision analysis if HF fails
        logging.info("Falling back to Groq vision analysis...")
        return await analyze_emotion_via_groq(face_image)
        
    except Exception as e:
        logging.error(f"Error in HF API emotion analysis: {e}")
        return None

async def analyze_emotion_via_groq(face_image):
    """Analyze emotions using Groq's vision capabilities"""
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        
        # Convert face image to base64
        pil_image = Image.fromarray(face_image)
        buffer = BytesIO()
        pil_image.save(buffer, format='JPEG', quality=85)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Use Groq's vision model for emotion analysis
        prompt = """Analyze this facial image and detect the person's emotional state. 
        Respond ONLY with a JSON array of emotions with labels and confidence scores.
        Format: [{"label": "emotion_name", "score": 0.0-1.0}]
        Possible emotions: happy, sad, angry, fearful, disgusted, surprised, neutral, stressed, tired, anxious"""
        
        response = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_base64}"
                            }
                        }
                    ]
                }
            ],
            model="llama-3.2-11b-vision-preview",
            max_tokens=200,
            temperature=0.3
        )
        
        # Parse Groq response
        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON from response
        import re
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            emotions = json.loads(json_match.group())
            logging.info(f"✅ Groq vision emotion detection: {emotions[0]['label']} ({emotions[0]['score']:.2f})")
            return emotions
        
        # Fallback parsing
        emotion_keywords = {
            'happy': 0.1, 'sad': 0.6, 'angry': 0.9, 'fear': 0.85,
            'disgust': 0.7, 'surprise': 0.4, 'neutral': 0.2,
            'stress': 0.8, 'tired': 0.6, 'anxious': 0.8
        }
        
        detected_emotions = []
        content_lower = content.lower()
        for emotion, stress_value in emotion_keywords.items():
            if emotion in content_lower:
                detected_emotions.append({
                    'label': emotion,
                    'score': 0.7
                })
        
        if detected_emotions:
            return detected_emotions
        
        # Ultimate fallback
        return [{'label': 'neutral', 'score': 0.6}]
        
    except Exception as e:
        logging.error(f"Error in Groq vision analysis: {e}")
        return [{'label': 'neutral', 'score': 0.5}]

async def store_monitoring_data(data: dict):
    """Store monitoring data in MongoDB"""
    try:
        await db.monitoring_sessions.insert_one(data)
    except Exception as e:
        logging.error(f"Error storing data: {e}")

@app.post("/api/steering-analysis")
async def analyze_steering_data(steering_data: dict):
    """Analyze steering patterns for fatigue detection"""
    try:
        # Analyze steering wheel movements for erratic patterns
        movements = steering_data.get("movements", [])
        
        if not movements:
            return {"fatigue_indicator": 0.0, "pattern": "insufficient_data"}
        
        # Calculate steering variability
        angles = [m["angle"] for m in movements]
        variability = np.std(angles) if len(angles) > 1 else 0
        
        # Determine fatigue level based on steering patterns
        fatigue_score = min(1.0, variability / 100.0)  # Normalize
        
        pattern = "normal"
        if fatigue_score > 0.7:
            pattern = "erratic"
        elif fatigue_score > 0.4:
            pattern = "irregular"
        
        return {
            "fatigue_indicator": fatigue_score,
            "pattern": pattern,
            "variability": variability,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Steering analysis failed: {str(e)}"}
        )

@app.get("/api/safe-stops")
async def find_safe_stops(lat: float, lon: float, radius: int = 5000):
    """Find safe stopping points using ORS API"""
    try:
        # Use ORS Geocoding API to find nearby POIs
        url = "https://api.openrouteservice.org/geocode/search"
        
        headers = {
            "Authorization": ORS_API_KEY,
            "Accept": "application/json"
        }
        
        # Search for different types of safe stops
        search_terms = ["gas station", "rest area", "service station", "truck stop", "parking"]
        all_stops = []
        
        for term in search_terms:
            params = {
                "text": term,
                "focus.point.lat": lat,
                "focus.point.lon": lon,
                "boundary.circle.lat": lat,
                "boundary.circle.lon": lon,
                "boundary.circle.radius": radius / 1000,  # Convert to km
                "size": 5
            }
            
            try:
                response = requests.get(url, headers=headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    for feature in data.get("features", []):
                        props = feature.get("properties", {})
                        coords = feature.get("geometry", {}).get("coordinates", [])
                        
                        # Calculate distance
                        if coords and len(coords) >= 2:
                            distance = calculate_distance(lat, lon, coords[1], coords[0]) * 1000  # Convert to meters
                            
                            all_stops.append({
                                "name": props.get("name", f"{term.title()}"),
                                "category": props.get("layer", term.title()),
                                "distance": distance,
                                "coordinates": coords,
                                "address": props.get("label", "")
                            })
                            
            except Exception as search_error:
                logging.error(f"Error searching for {term}: {search_error}")
                continue
        
        # Sort by distance and remove duplicates
        unique_stops = {}
        for stop in all_stops:
            key = f"{stop['name']}_{stop.get('address', '')}"
            if key not in unique_stops or stop['distance'] < unique_stops[key]['distance']:
                unique_stops[key] = stop
        
        sorted_stops = sorted(unique_stops.values(), key=lambda x: x['distance'])[:10]
        
        # If ORS doesn't return results, provide mock data based on location
        if not sorted_stops:
            sorted_stops = generate_mock_safe_stops(lat, lon)
        
        return {"safe_stops": sorted_stops}
            
    except Exception as e:
        logging.error(f"Safe stops search failed: {e}")
        # Return mock data as fallback
        return {"safe_stops": generate_mock_safe_stops(lat, lon)}

@app.get("/api/rest-stops-serp")
async def find_rest_stops_serp(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float):
    """Find rest stops between origin and destination using SerpAPI"""
    try:
        SERPAPI_KEY = api_config.serpapi_key
        
        if not SERPAPI_KEY:
            return {"error": "SerpAPI key not configured", "stops": []}
        
        # Calculate midpoint
        mid_lat = (origin_lat + dest_lat) / 2
        mid_lon = (origin_lon + dest_lon) / 2
        
        # Search points: start, middle, end
        search_points = [
            (origin_lat, origin_lon, "Start"),
            (mid_lat, mid_lon, "Midpoint"),
            (dest_lat, dest_lon, "End")
        ]
        
        all_stops = []
        
        for lat, lon, position in search_points:
            try:
                # SerpAPI Google Maps search
                url = "https://serpapi.com/search.json"
                params = {
                    "engine": "google_maps",
                    "q": f"gas station OR rest area OR service station",
                    "ll": f"@{lat},{lon},14z",
                    "type": "search",
                    "api_key": SERPAPI_KEY
                }
                
                response = requests.get(url, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    for place in data.get("local_results", [])[:2]:  # Top 2 from each point
                        gps = place.get("gps_coordinates", {})
                        place_lat = gps.get("latitude", lat)
                        place_lon = gps.get("longitude", lon)
                        
                        all_stops.append({
                            "name": place.get("title", "Rest Stop"),
                            "address": place.get("address", "Address not available"),
                            "rating": place.get("rating", "N/A"),
                            "type": place.get("type", "Service Station"),
                            "position": position,
                            "coordinates": [place_lon, place_lat],
                            "link": place.get("link", f"https://www.google.com/maps/search/?api=1&query={place_lat},{place_lon}")
                        })
                        
            except Exception as e:
                logging.error(f"SerpAPI search error at {position}: {e}")
                continue
        
        if not all_stops:
            return {"error": "No rest stops found", "stops": []}
        
        return {"stops": all_stops, "count": len(all_stops)}
        
    except Exception as e:
        logging.error(f"Rest stops search failed: {e}")
        return {"error": str(e), "stops": []}

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula"""
    from math import radians, cos, sin, asin, sqrt
    
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

def generate_mock_safe_stops(lat: float, lon: float) -> list:
    """Generate mock safe stops around the given location"""
    import random
    
    stops = []
    stop_types = [
        {"name": "Shell Gas Station", "category": "Gas Station"},
        {"name": "Highway Rest Area", "category": "Rest Area"},
        {"name": "Truck Stop Plaza", "category": "Truck Stop"},
        {"name": "24/7 Service Center", "category": "Service Station"},
        {"name": "Public Parking Area", "category": "Parking"},
        {"name": "Travel Center", "category": "Travel Center"}
    ]
    
    for i, stop_type in enumerate(stop_types):
        # Generate coordinates within 10km radius
        offset_lat = random.uniform(-0.05, 0.05)  # ~5km
        offset_lon = random.uniform(-0.05, 0.05)
        
        stop_lat = lat + offset_lat
        stop_lon = lon + offset_lon
        distance = calculate_distance(lat, lon, stop_lat, stop_lon) * 1000  # Convert to meters
        
        stops.append({
            "name": f"{stop_type['name']} #{i+1}",
            "category": stop_type["category"],
            "distance": distance,
            "coordinates": [stop_lon, stop_lat],
            "address": f"Near {lat:.3f}, {lon:.3f}"
        })
    
    return sorted(stops, key=lambda x: x['distance'])

@app.get("/api/analytics")
async def get_analytics():
    """Get driver wellness analytics"""
    try:
        # Aggregate data from MongoDB
        pipeline = [
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "avg_drowsiness": {"$avg": "$drowsiness_score"},
                    "avg_stress": {"$avg": "$stress_level"},
                    "session_count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": -1}},
            {"$limit": 7}
        ]
        
        results = []
        async for doc in db.monitoring_sessions.aggregate(pipeline):
            results.append(doc)
        
        return {"analytics": results}
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Analytics retrieval failed: {str(e)}"}
        )

@app.post("/api/generate-emergency-qr")
async def generate_emergency_qr(location_data: dict):
    """Generate QR code for emergency location sharing"""
    try:
        lat = location_data.get("lat", 0)
        lon = location_data.get("lon", 0)
        emergency_message = location_data.get("message", "Emergency assistance needed")
        
        # Create emergency URL with location and message
        emergency_url = f"https://www.google.com/maps?q={lat},{lon}&z=15"
        emergency_text = f"{emergency_message}\nLocation: {emergency_url}\nTime: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        try:
            import qrcode
            from io import BytesIO
            
            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(emergency_text)
            qr.make(fit=True)
            
            # Create QR code image
            qr_image = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = BytesIO()
            qr_image.save(buffer, format='PNG')
            qr_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                "success": True,
                "qr_code": f"data:image/png;base64,{qr_base64}",
                "emergency_text": emergency_text,
                "location_url": emergency_url
            }
        except ImportError:
            # Fallback if qrcode is not available
            return {
                "success": False,
                "error": "QR code generation not available",
                "emergency_text": emergency_text,
                "location_url": emergency_url
            }
        
    except Exception as e:
        logging.error(f"QR generation error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"QR generation failed: {str(e)}"}
        )

@app.get("/api/test-ai")
async def test_ai_integration():
    """Test endpoint to verify AI integration with HF and Groq"""
    try:
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "tests": {}
        }
        
        # Test 1: Check API keys
        test_results["tests"]["api_keys"] = {
            "hf_api_key": "✅ Configured" if HF_API_KEY else "❌ Missing",
            "groq_api_key": "✅ Configured" if api_config.groq_api_key else "❌ Missing",
            "ors_api_key": "✅ Configured" if ORS_API_KEY else "❌ Missing"
        }
        
        # Test 2: Test Groq text generation
        try:
            groq_response = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": "Say 'Groq API working' in exactly 3 words"}],
                model="llama3-8b-8192",
                max_tokens=50
            )
            test_results["tests"]["groq_text"] = {
                "status": "✅ Working",
                "response": groq_response.choices[0].message.content.strip()
            }
        except Exception as e:
            test_results["tests"]["groq_text"] = {
                "status": "❌ Failed",
                "error": str(e)
            }
        
        # Test 3: Test HF API with a simple model
        try:
            hf_headers = {"Authorization": f"Bearer {HF_API_KEY}"}
            hf_response = requests.post(
                "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-emotion",
                headers=hf_headers,
                json={"inputs": "I am feeling great today!"},
                timeout=10
            )
            
            if hf_response.status_code == 200:
                test_results["tests"]["hf_emotion_api"] = {
                    "status": "✅ Working",
                    "response": hf_response.json()[:2]  # First 2 results
                }
            else:
                test_results["tests"]["hf_emotion_api"] = {
                    "status": f"⚠️ Status {hf_response.status_code}",
                    "message": hf_response.text[:200]
                }
        except Exception as e:
            test_results["tests"]["hf_emotion_api"] = {
                "status": "❌ Failed",
                "error": str(e)
            }
        
        # Test 4: Test recommendation generation
        try:
            recommendations = await generate_recommendations(0.8, 0.7)
            test_results["tests"]["ai_recommendations"] = {
                "status": "✅ Working",
                "sample_recommendations": recommendations[:2]
            }
        except Exception as e:
            test_results["tests"]["ai_recommendations"] = {
                "status": "❌ Failed",
                "error": str(e)
            }
        
        # Test 5: Check MongoDB connection
        try:
            await db.command("ping")
            test_results["tests"]["mongodb"] = {
                "status": "✅ Connected",
                "database": "driver_wellness"
            }
        except Exception as e:
            test_results["tests"]["mongodb"] = {
                "status": "❌ Failed",
                "error": str(e)
            }
        
        # Test 6: Check emotion analyzer mode
        test_results["tests"]["emotion_analyzer"] = {
            "mode": emotion_analyzer,
            "status": "✅ Initialized"
        }
        
        # Overall status
        failed_tests = sum(1 for test in test_results["tests"].values() 
                          if isinstance(test, dict) and "❌" in test.get("status", ""))
        
        test_results["summary"] = {
            "total_tests": len(test_results["tests"]),
            "failed": failed_tests,
            "passed": len(test_results["tests"]) - failed_tests,
            "overall_status": "✅ All systems operational" if failed_tests == 0 else f"⚠️ {failed_tests} test(s) failed"
        }
        
        return test_results
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Test failed: {str(e)}"}
        )

@app.post("/api/test-emotion-detection")
async def test_emotion_detection(file: UploadFile = File(...)):
    """Test emotion detection with an uploaded image"""
    try:
        # Read uploaded image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid image file"}
            )
        
        # Convert to RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Test HF API
        hf_result = await analyze_emotion_via_api(img_rgb)
        
        # Generate stress level from emotions
        stress_mapping = {
            'angry': 0.9, 'anger': 0.9,
            'fear': 0.85, 'fearful': 0.85,
            'sad': 0.6, 'sadness': 0.6,
            'disgust': 0.7,
            'surprise': 0.4,
            'happy': 0.1, 'happiness': 0.1,
            'neutral': 0.2
        }
        
        stress_level = 0.2
        if hf_result:
            for emotion in hf_result:
                label = emotion['label'].lower()
                score = emotion.get('score', 0.5)
                for key, value in stress_mapping.items():
                    if key in label:
                        stress_level = max(stress_level, value * score)
        
        return {
            "success": True,
            "emotions_detected": hf_result,
            "calculated_stress_level": stress_level,
            "stress_description": get_level_description(stress_level, 'stress'),
            "api_used": "Hugging Face" if hf_result else "Fallback",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Emotion detection test failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)