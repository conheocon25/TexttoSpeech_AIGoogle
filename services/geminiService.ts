import { GoogleGenAI, Modality } from "@google/genai";
import { base64ToArrayBuffer } from '../utils';

// We use the recommended preview model for TTS as per instructions, 
// though the prompt referenced 'pro', 'flash' is standard for the TTS preview currently.
// Using the exact model from guidelines or prompt reference if functional. 
// System instruction recommends: 'gemini-2.5-flash-preview-tts'
const MODEL_NAME = 'gemini-2.5-flash-preview-tts';

export const generateSpeech = async (
  text: string, 
  voiceName: string
): Promise<ArrayBuffer> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ text: text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      }
    });

    // The API returns raw PCM data in the inlineData of the first candidate part
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      if (parts && parts.length > 0) {
        const audioPart = parts.find(p => p.inlineData);
        if (audioPart && audioPart.inlineData && audioPart.inlineData.data) {
          return base64ToArrayBuffer(audioPart.inlineData.data);
        }
      }
    }
    
    throw new Error("No audio data returned from Gemini API");
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};
