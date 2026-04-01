/** Shared AI feature types for Lucid Studio */

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

export type TrimReason = "idle-cursor" | "dead-air" | "low-activity";

export interface TrimSuggestion {
	id: string;
	startMs: number;
	endMs: number;
	reason: TrimReason;
	confidence: number; // 0-1
	description: string;
}

// ── Clip extraction types ──

export interface ExtractedClip {
	id: string;
	startMs: number;
	endMs: number;
	score: number; // 0-1
	title: string;
}

// ── AI service types ──

export type AIProvider = "local" | "cloud";

export interface AIServiceConfig {
	provider: AIProvider;
	apiKey?: string;
	model?: string;
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
	id: string;
	startMs: number;
	endMs: number;
	text: string;
}

export interface NarrationTrack {
	segments: NarrationSegment[];
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
