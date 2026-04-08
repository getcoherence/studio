// ── Demo Studio shared types ──────────────────────────────────────────

import type { DemoModeId } from "@/lib/ai/demoModes";
import type { ScreenshotAnalysis } from "@/lib/cv/types";

/** Controls composition strategy and default renderer */
export type OutputStyle = "product-demo" | "cinematic" | "ai-cinematic";

export interface PageElement {
	type: "button" | "link" | "input" | "select";
	text: string;
	selector: string;
	visible: boolean;
}

export interface PageInfo {
	url: string;
	title: string;
	visibleText: string;
	elements: PageElement[];
	headings?: Array<{ tag: string; text: string }>;
	stats?: string[];
	features?: string[];
}

export interface DemoConfig {
	url: string;
	prompt: string;
	maxSteps: number;
	mode: DemoModeId;
	outputStyle: OutputStyle;
	/** When true, the AI will generate cinematic video clips for 1-3 hero scenes */
	includeVideoClips?: boolean;
}

export interface DemoAction {
	action: "click" | "type" | "scroll" | "navigate" | "wait" | "pause" | "done";
	target?: string;
	value?: string;
	narration: string;
	waitMs?: number;
	reasoning?: string;
}

export interface DemoStep {
	action: DemoAction;
	timestamp: number;
	screenshotDataUrl?: string;
	audioPath?: string;
	isZoomShot?: boolean; // true for cropped zoom screenshots
	/** Ken-burns focus point (0-1 normalized), detected from prominent page elements */
	focusPoint?: { x: number; y: number };
	/** Short visual headline for the slide (3-6 words, from storyboard) */
	headline?: string;
	/** Vision-detected crop region (0-1 normalized) for the most relevant UI element */
	cropRegion?: { x: number; y: number; width: number; height: number };
	/** OpenCV analysis results (replaces vision API) */
	analysis?: ScreenshotAnalysis;
	/** Individual UI elements detected in the viewport */
	uiElements?: Array<{
		type: string;
		text: string;
		bounds: { x: number; y: number; width: number; height: number };
	}>;
}

// ── Storyboard types (Phase 2 output) ────────────────────────────────

export interface StoryboardScene {
	/** URL to navigate to */
	url: string;
	/** Pixel Y position to scroll to (0 = top) */
	scrollToY: number;
	/** CSS selector to zoom into for a highlight shot */
	zoomTarget?: string;
	/** Short visual headline for the slide (3-6 words) */
	headline?: string;
	/** Pre-written narration/voiceover for this scene */
	narration: string;
	/** Suggested scene duration in ms */
	durationMs: number;
}

export interface Storyboard {
	title: string;
	scenes: StoryboardScene[];
}

// ── Site map types (Phase 1 output) ──────────────────────────────────

export interface SiteMapPage {
	url: string;
	title: string;
	summary: string;
	features: string[];
	interactiveElements: string[];
	/** Section headings found on the page with Y scroll positions */
	sections: { text: string; yPosition: number }[];
}

// ── Chat message types ────────────────────────────────────────────────

export type DemoChatMessageType =
	| "user-prompt"
	| "system"
	| "thinking"
	| "action"
	| "narration"
	| "storyboard"
	| "pause"
	| "error"
	| "completion";

export interface DemoChatMessage {
	id: string;
	type: DemoChatMessageType;
	content: string;
	timestamp: number;
	screenshotDataUrl?: string;
	audioPath?: string;
	actionType?: string;
	actionTarget?: string;
}

// ── Agent status ──────────────────────────────────────────────────────

export type DemoAgentStatus = "idle" | "running" | "paused" | "complete";
