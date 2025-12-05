"""
Centralized configuration for backend services
All API keys and settings are managed through environment variables
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

@dataclass
class APIConfig:
    """Configuration for external APIs"""
    ors_api_key: str
    groq_api_key: str
    mongo_uri: str
    hf_api_key: str

@dataclass
class AppConfig:
    """Application configuration"""
    name: str = "Driver Wellness Monitor Backend"
    version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

@dataclass
class AIConfig:
    """AI model configuration"""
    drowsiness_model: str = "dima806/facial_emotions_image_detection"
    emotion_model: str = "j-hartmann/emotion-english-distilroberta-base"
    vision_model: str = "microsoft/resnet-50"
    confidence_threshold: float = 0.6
    processing_interval: int = 2  # seconds

@dataclass
class MonitoringConfig:
    """Wellness monitoring configuration"""
    update_interval: int = 2000  # milliseconds
    history_limit: int = 100
    alert_thresholds: Dict[str, Dict[str, float]] = None
    
    def __post_init__(self):
        if self.alert_thresholds is None:
            self.alert_thresholds = {
                "drowsiness": {"low": 0.3, "medium": 0.6, "high": 0.8},
                "stress": {"low": 0.3, "medium": 0.6, "high": 0.8}
            }

class Config:
    """Main configuration class that loads from environment variables"""
    
    def __init__(self):
        self.api = self._load_api_config()
        self.app = self._load_app_config()
        self.ai = self._load_ai_config()
        self.monitoring = self._load_monitoring_config()
    
    def _load_api_config(self) -> APIConfig:
        """Load API configuration from environment variables"""
        return APIConfig(
            ors_api_key=os.getenv("ORS_API_KEY", ""),
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            mongo_uri=os.getenv("MONGO_URI", ""),
            hf_api_key=os.getenv("HF_API_KEY", "")
        )
    
    def _load_app_config(self) -> AppConfig:
        """Load application configuration"""
        return AppConfig(
            debug=os.getenv("DEBUG", "false").lower() == "true",
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8000"))
        )
    
    def _load_ai_config(self) -> AIConfig:
        """Load AI model configuration"""
        return AIConfig(
            drowsiness_model=os.getenv("DROWSINESS_MODEL", "dima806/facial_emotions_image_detection"),
            emotion_model=os.getenv("EMOTION_MODEL", "j-hartmann/emotion-english-distilroberta-base"),
            vision_model=os.getenv("VISION_MODEL", "microsoft/resnet-50"),
            confidence_threshold=float(os.getenv("CONFIDENCE_THRESHOLD", "0.6")),
            processing_interval=int(os.getenv("PROCESSING_INTERVAL", "2"))
        )
    
    def _load_monitoring_config(self) -> MonitoringConfig:
        """Load monitoring configuration"""
        return MonitoringConfig(
            update_interval=int(os.getenv("UPDATE_INTERVAL", "2000")),
            history_limit=int(os.getenv("HISTORY_LIMIT", "100"))
        )
    
    def validate(self) -> Dict[str, Any]:
        """Validate configuration and return validation results"""
        errors = []
        warnings = []
        
        # Check required API keys
        if not self.api.ors_api_key:
            errors.append("ORS_API_KEY is required")
        
        if not self.api.groq_api_key:
            errors.append("GROQ_API_KEY is required")
        
        if not self.api.mongo_uri:
            errors.append("MONGO_URI is required")
        
        # Check AI configuration
        if self.ai.confidence_threshold < 0 or self.ai.confidence_threshold > 1:
            warnings.append("CONFIDENCE_THRESHOLD should be between 0 and 1")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def get_api_headers(self, service: str) -> Dict[str, str]:
        """Get headers for API requests"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"{self.app.name}/{self.app.version}"
        }
        
        if service == "ors":
            headers["Authorization"] = self.api.ors_api_key
        elif service == "groq":
            headers["Authorization"] = f"Bearer {self.api.groq_api_key}"
        
        return headers
    
    def get_api_url(self, service: str, endpoint: str = "") -> str:
        """Get API URLs for different services"""
        urls = {
            "ors_geocoding": f"https://api.openrouteservice.org/geocode/search",
            "ors_directions": f"https://api.openrouteservice.org/v2/directions/driving-car",
            "ors_pois": f"https://api.openrouteservice.org/pois",
            "groq_chat": f"https://api.groq.com/openai/v1/chat/completions",
            "nominatim": f"https://nominatim.openstreetmap.org/search"
        }
        
        return urls.get(f"{service}_{endpoint}", urls.get(service, ""))

# Global configuration instance
config = Config()

# Validate configuration on import
validation = config.validate()
if not validation["valid"]:
    print(f"❌ Configuration errors: {', '.join(validation['errors'])}")
    
if validation["warnings"]:
    print(f"⚠️ Configuration warnings: {', '.join(validation['warnings'])}")

# Export commonly used configs
api_config = config.api
app_config = config.app
ai_config = config.ai
monitoring_config = config.monitoring

__all__ = [
    "config",
    "api_config", 
    "app_config",
    "ai_config",
    "monitoring_config",
    "Config",
    "APIConfig",
    "AppConfig", 
    "AIConfig",
    "MonitoringConfig"
]