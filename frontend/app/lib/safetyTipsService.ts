/**
 * Real-time Safety Tips Service using Groq AI
 * Generates dynamic safety recommendations based on live monitoring data
 */

import { config } from './config';

interface MonitoringData {
  drowsiness: number;
  stress: number;
  isActive: boolean;
  lastUpdate: Date | null;
  detailedMetrics?: any;
}

interface SafetyTip {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'drowsiness' | 'stress' | 'general' | 'emergency';
  message: string;
  action?: string;
  timestamp: Date;
}

export class SafetyTipsService {
  private static instance: SafetyTipsService;
  private lastTipsUpdate: Date | null = null;
  private currentTips: SafetyTip[] = [];
  
  static getInstance(): SafetyTipsService {
    if (!SafetyTipsService.instance) {
      SafetyTipsService.instance = new SafetyTipsService();
    }
    return SafetyTipsService.instance;
  }

  /**
   * Generate real-time safety tips using Groq AI
   */
  async generateSafetyTips(monitoringData: MonitoringData): Promise<SafetyTip[]> {
    try {
      // Don't generate tips too frequently (max once per 30 seconds)
      if (this.lastTipsUpdate && 
          Date.now() - this.lastTipsUpdate.getTime() < 30000) {
        return this.currentTips;
      }

      const prompt = this.buildPrompt(monitoringData);
      const response = await this.callGroqAPI(prompt);
      const tips = this.parseTipsResponse(response, monitoringData);
      
      this.currentTips = tips;
      this.lastTipsUpdate = new Date();
      
      return tips;
    } catch (error) {
      console.error('Error generating safety tips:', error);
      return this.getFallbackTips(monitoringData);
    }
  }

  /**
   * Build context-aware prompt for Groq AI
   */
  private buildPrompt(data: MonitoringData): string {
    const drowsinessLevel = this.getDrowsinessLevel(data.drowsiness);
    const stressLevel = this.getStressLevel(data.stress);
    const timeOfDay = new Date().getHours();
    const isNightTime = timeOfDay < 6 || timeOfDay > 22;
    
    return `
You are an AI safety expert providing real-time driving safety recommendations.

Current Driver Status:
- Drowsiness Level: ${(data.drowsiness * 100).toFixed(1)}% (${drowsinessLevel})
- Stress Level: ${(data.stress * 100).toFixed(1)}% (${stressLevel})
- Time: ${new Date().toLocaleTimeString()}
- Night Driving: ${isNightTime ? 'Yes' : 'No'}
- Monitoring Active: ${data.isActive ? 'Yes' : 'No'}

Provide 3-5 specific, actionable safety recommendations in JSON format:
{
  "tips": [
    {
      "priority": "high|medium|low|critical",
      "category": "drowsiness|stress|general|emergency", 
      "message": "Clear, specific recommendation",
      "action": "Immediate action to take (optional)"
    }
  ]
}

Focus on:
- Immediate safety actions if levels are high
- Preventive measures for current conditions
- Time-of-day specific advice
- Practical, actionable steps
- Emergency protocols if critical

Keep messages concise, clear, and actionable.
    `.trim();
  }

  /**
   * Call Groq API for AI-generated tips
   */
  private async callGroqAPI(prompt: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apis.groq.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.apis.groq.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional driver safety expert. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Parse Groq response into SafetyTip objects
   */
  private parseTipsResponse(response: string, monitoringData: MonitoringData): SafetyTip[] {
    try {
      const parsed = JSON.parse(response);
      const tips: SafetyTip[] = [];

      if (parsed.tips && Array.isArray(parsed.tips)) {
        parsed.tips.forEach((tip: any, index: number) => {
          tips.push({
            id: `groq-${Date.now()}-${index}`,
            priority: tip.priority || 'medium',
            category: tip.category || 'general',
            message: tip.message || '',
            action: tip.action,
            timestamp: new Date()
          });
        });
      }

      // Add emergency tips if critical levels detected
      if (monitoringData.drowsiness > 0.8 || monitoringData.stress > 0.9) {
        tips.unshift({
          id: `emergency-${Date.now()}`,
          priority: 'critical',
          category: 'emergency',
          message: 'IMMEDIATE ACTION REQUIRED: Pull over safely and take a break',
          action: 'Find the nearest safe location and stop driving',
          timestamp: new Date()
        });
      }

      return tips;
    } catch (error) {
      console.error('Error parsing Groq response:', error);
      return this.getFallbackTips(monitoringData);
    }
  }

  /**
   * Get fallback tips when AI service is unavailable
   */
  private getFallbackTips(data: MonitoringData): SafetyTip[] {
    const tips: SafetyTip[] = [];
    const now = new Date();

    if (data.drowsiness > 0.7) {
      tips.push({
        id: `fallback-drowsy-${now.getTime()}`,
        priority: 'critical',
        category: 'drowsiness',
        message: 'High drowsiness detected - pull over immediately',
        action: 'Find a safe place to rest for 15-20 minutes',
        timestamp: now
      });
    } else if (data.drowsiness > 0.4) {
      tips.push({
        id: `fallback-drowsy-mod-${now.getTime()}`,
        priority: 'high',
        category: 'drowsiness',
        message: 'Moderate drowsiness - take a break soon',
        action: 'Plan a rest stop within the next 15 minutes',
        timestamp: now
      });
    }

    if (data.stress > 0.8) {
      tips.push({
        id: `fallback-stress-${now.getTime()}`,
        priority: 'high',
        category: 'stress',
        message: 'High stress levels detected',
        action: 'Practice deep breathing and consider taking a break',
        timestamp: now
      });
    }

    if (tips.length === 0) {
      tips.push({
        id: `fallback-general-${now.getTime()}`,
        priority: 'low',
        category: 'general',
        message: 'Maintain good driving posture and stay hydrated',
        timestamp: now
      });
    }

    return tips;
  }

  /**
   * Get drowsiness level description
   */
  private getDrowsinessLevel(score: number): string {
    if (score > 0.8) return 'Critical';
    if (score > 0.6) return 'High';
    if (score > 0.3) return 'Moderate';
    return 'Low';
  }

  /**
   * Get stress level description
   */
  private getStressLevel(score: number): string {
    if (score > 0.8) return 'Very High';
    if (score > 0.6) return 'High';
    if (score > 0.4) return 'Moderate';
    return 'Low';
  }

  /**
   * Get current tips without regenerating
   */
  getCurrentTips(): SafetyTip[] {
    return this.currentTips;
  }

  /**
   * Clear current tips
   */
  clearTips(): void {
    this.currentTips = [];
    this.lastTipsUpdate = null;
  }
}

// Export singleton instance
export const safetyTipsService = SafetyTipsService.getInstance();

// Export types
export type { SafetyTip, MonitoringData };