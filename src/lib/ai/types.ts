// Caption types
export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface CaptionLine {
  words: CaptionWord[];
  startMs: number;
  endMs: number;
}

export interface CaptionTrack {
  language: string;
  lines: CaptionLine[];
}

// Caption styling
export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundRadius: number;
  position: 'top' | 'center' | 'bottom';
  bottomOffset: number;
  maxWidth: number;
  animation: 'none' | 'word-highlight' | 'fade-in';
}

// Narration types
export interface NarrationSegment {
  text: string;
  startMs: number;
  endMs: number;
  audioPath?: string;
}

export interface NarrationTrack {
  segments: NarrationSegment[];
  voiceId: string;
  language: string;
}

// Clip extraction
export interface ExtractedClip {
  id: string;
  startMs: number;
  endMs: number;
  score: number;
  reason: string;
  title: string;
}

// Smart trim suggestion
export interface TrimSuggestion {
  id: string;
  startMs: number;
  endMs: number;
  reason: 'dead-air' | 'loading-screen' | 'idle-cursor' | 'low-activity';
  confidence: number;
}

// AI service config
export interface AIServiceConfig {
  provider: 'local' | 'openai' | 'anthropic';
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
}

// Whisper model
export interface WhisperModelInfo {
  id: string;
  name: string;
  size: string;
  downloaded: boolean;
  path?: string;
}
