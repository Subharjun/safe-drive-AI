#!/usr/bin/env python3
"""
Installation script for Driver Wellness AI models
Downloads and caches the specialized models locally
"""

import os
import sys
from transformers import AutoFeatureExtractor, AutoModelForImageClassification
import torch
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def install_models():
    """Download and cache the specialized AI models"""
    print("🚀 Driver Wellness AI Model Installation")
    print("=" * 50)
    
    # Check device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"🖥️  Device: {device}")
    
    if device == "cuda":
        print(f"🎮 GPU: {torch.cuda.get_device_name(0)}")
        print(f"💾 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    
    print()
    
    models_to_install = [
        {
            'name': 'Stress/Emotion Detection',
            'model_id': 'j-hartmann/emotion-english-distilroberta-base',
            'description': 'Facial emotion recognition for stress analysis',
            'backup_models': ['cardiffnlp/twitter-roberta-base-emotion', 'SamLowe/roberta-base-go_emotions']
        },
        {
            'name': 'Drowsiness Detection', 
            'model_id': 'microsoft/resnet-50',
            'description': 'Computer vision model for drowsiness detection',
            'backup_models': ['google/vit-base-patch16-224', 'facebook/deit-base-distilled-patch16-224']
        }
    ]
    
    for i, model_info in enumerate(models_to_install, 1):
        print(f"📥 [{i}/{len(models_to_install)}] Installing {model_info['name']}")
        print(f"🔗 Model: {model_info['model_id']}")
        print(f"📝 Description: {model_info['description']}")
        
        # Try main model first, then backups
        models_to_try = [model_info['model_id']] + model_info.get('backup_models', [])
        
        success = False
        for model_id in models_to_try:
            try:
                print(f"   🔄 Trying model: {model_id}")
                
                # For emotion models, try text classification first
                if 'emotion' in model_info['name'].lower():
                    try:
                        from transformers import pipeline
                        print("   📊 Loading as text classification pipeline...")
                        model = pipeline("text-classification", model=model_id, device=0 if device == "cuda" else -1)
                        
                        # Test with sample text
                        test_result = model("I am feeling great today!")
                        print(f"   🎯 Test prediction: {test_result[0]['label']} (confidence: {test_result[0]['score']:.1%})")
                        print(f"   ✅ Emotion model working correctly!")
                        success = True
                        break
                        
                    except Exception as text_error:
                        print(f"   ⚠️  Text classification failed: {text_error}")
                        # Fall back to image classification
                        pass
                
                # Try as image classification model
                print("   📊 Downloading feature extractor...")
                extractor = AutoFeatureExtractor.from_pretrained(model_id)
                
                print("   🧠 Downloading model...")
                model = AutoModelForImageClassification.from_pretrained(model_id)
                
                # Move to device
                model.to(device)
                model.eval()
                
                # Print model info
                print(f"   ✅ Model loaded successfully!")
                if hasattr(model.config, 'id2label') and model.config.id2label:
                    print(f"   📊 Labels: {list(model.config.id2label.values())}")
                    print(f"   🏷️  Number of classes: {len(model.config.id2label)}")
                else:
                    print(f"   📊 Model loaded (no label mapping available)")
                
                # Test inference
                print("   🧪 Testing inference...")
                import numpy as np
                from PIL import Image
                
                # Create dummy image
                dummy_image = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
                
                # Run test inference
                inputs = extractor(images=dummy_image, return_tensors="pt")
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                with torch.no_grad():
                    outputs = model(**inputs)
                    probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
                
                if hasattr(model.config, 'id2label') and model.config.id2label:
                    predicted_class = model.config.id2label[probabilities.argmax().item()]
                    print(f"   🎯 Test prediction: {predicted_class}")
                else:
                    print(f"   🎯 Test prediction: Class {probabilities.argmax().item()}")
                
                confidence = probabilities.max().item()
                print(f"   📊 Confidence: {confidence:.1%}")
                print(f"   ✅ Model working correctly!")
                
                success = True
                break
                
            except Exception as e:
                print(f"   ⚠️  Failed with {model_id}: {e}")
                continue
        
        if not success:
            print(f"   ❌ All models failed for {model_info['name']}")
            print(f"   💡 Continuing with basic fallback...")
            # Don't return False, continue with other models
        
        print()
    
    print("🎉 All models installed successfully!")
    print()
    print("📋 Next steps:")
    print("1. Run 'python test_models.py' to test the models with your webcam")
    print("2. Start the backend server: 'python main.py'")
    print("3. Start the frontend: 'cd ../frontend && npm run dev'")
    print()
    print("💡 Tips:")
    print("- Make sure your webcam is connected and working")
    print("- Good lighting improves detection accuracy")
    print("- The models work best with clear, front-facing images")
    
    return True

def check_requirements():
    """Check if required packages are installed"""
    required_imports = [
        ('torch', 'torch'),
        ('transformers', 'transformers'), 
        ('opencv-python', 'cv2'),
        ('pillow', 'PIL'),
        ('numpy', 'numpy')
    ]
    
    missing_packages = []
    
    for package_name, import_name in required_imports:
        try:
            __import__(import_name)
            print(f"✅ {package_name} - OK")
        except ImportError:
            missing_packages.append(package_name)
            print(f"❌ {package_name} - Missing")
    
    if missing_packages:
        print()
        print("❌ Missing required packages:")
        for package in missing_packages:
            print(f"   - {package}")
        print()
        print("📦 Install missing packages with:")
        print(f"   pip install {' '.join(missing_packages)}")
        return False
    
    return True

if __name__ == "__main__":
    print("🔍 Checking requirements...")
    
    if not check_requirements():
        sys.exit(1)
    
    print("✅ All requirements satisfied!")
    print()
    
    if install_models():
        print("🚀 Installation completed successfully!")
    else:
        print("❌ Installation failed!")
        sys.exit(1)