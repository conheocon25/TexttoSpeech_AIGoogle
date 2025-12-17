export interface Scene {
  id: string; // e.g., "1", "2", "C3"
  text: string;
  audioData?: ArrayBuffer; // Raw PCM data from Gemini
  audioUrl?: string; // Blob URL for playback
  isGenerating: boolean;
  isPlaying: boolean;
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female'
}

export interface VoiceOption {
  name: string;
  gender: Gender;
}

export const PREVIEW_TEXT = "Xin chào bạn, hy vọng giọng tôi sẽ phù hợp với bạn";

// Selected 10 voices as requested (5 Male, 5 Female)
export const VOICE_OPTIONS: VoiceOption[] = [
  // Female
  { name: 'Kore', gender: Gender.FEMALE },
  { name: 'Zephyr', gender: Gender.FEMALE },
  { name: 'Aoede', gender: Gender.FEMALE },
  { name: 'Leda', gender: Gender.FEMALE },
  { name: 'Vindemiatrix', gender: Gender.FEMALE },
  // Male
  { name: 'Fenrir', gender: Gender.MALE },
  { name: 'Puck', gender: Gender.MALE },
  { name: 'Charon', gender: Gender.MALE },
  { name: 'Orus', gender: Gender.MALE },
  { name: 'Sadachbia', gender: Gender.MALE },
];
