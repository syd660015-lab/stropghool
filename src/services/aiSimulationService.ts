import { GoogleGenAI, Type } from "@google/genai";
import { SimulationProfile } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // In a real Vercel production build, this should be defined in env
      // But we prevent early crash by using a dummy key if missing during build
      console.warn("GEMINI_API_KEY is missing. AI simulation will use fallback.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface SimulationEvent {
  type: 'correct' | 'error' | 'correction';
  delay: number; // delay from previous event in ms
}

export async function generateSimulationEvents(profile: SimulationProfile, testNum: number): Promise<SimulationEvent[]> {
  const ai = getAI();
  if (!ai) return generateFallbackEvents(profile, testNum);

  const systemInstruction = `
    You are a simulator for the Stroop Neuropsychological Test. 
    You need to generate a realistic sequence of participant responses (Correct, Error, Correction) for a 45-second session.
    
    Test Level: ${testNum} (1: Word Reading, 2: Word Reading with Color, 3: Color Naming, 4: Interference/Naming ink color).
    Profile: ${profile.name} - ${profile.description}
    Base Metrics: Speed ${profile.baseSpeed}ms, Error Rate ${(profile.errorRate * 100)}%, Recovery Rate ${(profile.recoveryRate * 100)}%.
    
    Rules for sequence:
    1. The sum of all delays should be around 45,000ms.
    2. 'correction' MUST always follow an 'error'.
    3. Test 4 (Interference) should significantly increase error rate and delay for cognitive decline or ADHD profiles.
    4. Delays should have natural variance (+/- 20%).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate the response sequence for this 45-second Stroop test segment.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['correct', 'error', 'correction'] },
                  delay: { type: Type.NUMBER, description: "milliseconds from previous event" }
                },
                required: ['type', 'delay']
              }
            }
          },
          required: ['events']
        }
      }
    });

    const data = JSON.parse(response.text);
    return data.events;
  } catch (error) {
    console.error("AI Simulation Failed:", error);
    // Fallback to basic randomization if AI fails
    return generateFallbackEvents(profile, testNum);
  }
}

function generateFallbackEvents(profile: SimulationProfile, testNum: number): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  let totalTime = 0;
  const maxTime = 44000;
  
  // Complexity factor for test 4
  const complexity = testNum === 4 ? 1.8 : 1.0;

  while (totalTime < maxTime) {
    const isError = Math.random() < (profile.errorRate * complexity);
    const delay = profile.baseSpeed * complexity * (0.8 + Math.random() * 0.4);
    
    if (isError) {
      events.push({ type: 'error', delay });
      totalTime += delay;
      
      if (Math.random() < profile.recoveryRate) {
        const correctDelay = 300 + Math.random() * 400; // time to realize error
        events.push({ type: 'correction', delay: correctDelay });
        totalTime += correctDelay;
      }
    } else {
      events.push({ type: 'correct', delay });
      totalTime += delay;
    }
  }
  
  return events;
}
