// ── Caption types for Whisper auto-captions ──

/** A single word with precise timing from Whisper transcription */
export interface CaptionWord {
	/** The word text */
	text: string;
	/** Start time in milliseconds */
	startMs: number;
	/** End time in milliseconds */
	endMs: number;
	/** Confidence score from Whisper (0-1) */
	confidence: number;
}

/** A line of caption text (group of words displayed together) */
export interface CaptionLine {
	/** Unique identifier */
	id: string;
	/** Words in this line */
	words: CaptionWord[];
	/** Start time in milliseconds (derived from first word) */
	startMs: number;
	/** End time in milliseconds (derived from last word) */
	endMs: number;
}

/** Full caption track for a video */
export interface CaptionTrack {
	/** Unique identifier */
	id: string;
	/** Detected language code (e.g. "en", "es") */
	language: string;
	/** All caption lines */
	lines: CaptionLine[];
	/** Whisper model used for transcription */
	modelId: string;
	/** Timestamp when transcription was created */
	createdAt: number;
}

/** Vertical position of captions on screen */
export type CaptionPosition = "top" | "center" | "bottom";

/** Animation style for caption display */
export type CaptionAnimation = "none" | "word-highlight" | "fade-in";

/** Style configuration for caption rendering */
export interface CaptionStyle {
	/** Font family name */
	fontFamily: string;
	/** Font size in pixels (at 1080p reference; scaled proportionally) */
	fontSize: number;
	/** Font color */
	fontColor: string;
	/** Background color (with alpha for opacity) */
	backgroundColor: string;
	/** Background opacity (0-1) */
	backgroundOpacity: number;
	/** Vertical position on screen */
	position: CaptionPosition;
	/** Animation style */
	animation: CaptionAnimation;
	/** Active word highlight color (used with word-highlight animation) */
	activeWordColor: string;
}

/** Default caption style */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
	fontFamily: "Inter",
	fontSize: 48,
	fontColor: "#FFFFFF",
	backgroundColor: "#000000",
	backgroundOpacity: 0.7,
	position: "bottom",
	animation: "word-highlight",
	activeWordColor: "#2563eb",
};

/** Supported Whisper model definitions */
export interface WhisperModel {
	id: string;
	name: string;
	sizeBytes: number;
	sizeLabel: string;
	url: string;
}

/** Available whisper models */
export const WHISPER_MODELS: WhisperModel[] = [
	{
		id: "tiny",
		name: "Tiny",
		sizeBytes: 75_000_000,
		sizeLabel: "~75 MB",
		url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
	},
	{
		id: "base",
		name: "Base",
		sizeBytes: 142_000_000,
		sizeLabel: "~142 MB",
		url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
	},
	{
		id: "small",
		name: "Small",
		sizeBytes: 466_000_000,
		sizeLabel: "~466 MB",
		url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
	},
];

/** Model download/status information */
export interface WhisperModelStatus {
	modelId: string;
	downloaded: boolean;
	path?: string;
	sizeBytes?: number;
}

/** Progress callback for model downloads */
export interface ModelDownloadProgress {
	modelId: string;
	downloadedBytes: number;
	totalBytes: number;
	percent: number;
}

// ── Recording analysis types ──

export interface RecordingProfile {
	silentSegments: TimeSegment[];
	idleSegments: TimeSegment[];
	activeSegments: TimeSegment[];
	clickClusters: ClickCluster[];
}

export interface TimeSegment {
	startMs: number;
	endMs: number;
	/** Optional metadata describing why this segment was flagged */
	reason?: string;
}

export interface ClickCluster {
	startMs: number;
	endMs: number;
	cx: number;
	cy: number;
	clickCount: number;
}

// ── Smart trim types ──

export type TrimReason = "idle-cursor" | "dead-air" | "low-activity" | "loading-screen";

export interface TrimSuggestion {
	id: string;
	startMs: number;
	endMs: number;
	reason: TrimReason;
	confidence: number;
	description?: string;
}

// ── Clip extraction ──

export interface ExtractedClip {
	id: string;
	startMs: number;
	endMs: number;
	score: number;
	reason?: string;
	title: string;
}

// ── AI service types ──

export type AIProvider = "local" | "cloud" | "openai" | "anthropic";

export interface AIServiceConfig {
	provider: AIProvider;
	modelId?: string;
	model?: string;
	apiKey?: string;
	baseUrl?: string;
	ollamaUrl?: string;
}

export interface AIServiceResult {
	success: boolean;
	text?: string;
	error?: string;
}

export interface AIAvailability {
	localAvailable: boolean;
	cloudAvailable: boolean;
	activeProvider: AIProvider | null;
}

// ── Narration types ──

export interface NarrationSegment {
	id?: string;
	text: string;
	startMs: number;
	endMs: number;
	audioPath?: string;
}

export interface NarrationTrack {
	segments: NarrationSegment[];
	voiceId?: string;
	language?: string;
	audioPath?: string | null;
}

// ── Polish types ──

export interface PolishPreview {
	zoomCount: number;
	trimCount: number;
	speedRampCount: number;
	wallpaperChanged: boolean;
	borderRadiusChanged: boolean;
	paddingChanged: boolean;
}
