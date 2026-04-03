// ── Demo Studio shared types ──────────────────────────────────────────

import type { DemoModeId } from "@/lib/ai/demoModes";

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
}

export interface DemoConfig {
	url: string;
	prompt: string;
	maxSteps: number;
	mode: DemoModeId;
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
}

// ── Storyboard types (Phase 2 output) ────────────────────────────────

export interface StoryboardScene {
	/** URL to navigate to */
	url: string;
	/** Pixel Y position to scroll to (0 = top) */
	scrollToY: number;
	/** CSS selector to zoom into for a highlight shot */
	zoomTarget?: string;
	/** Pre-written narration for this scene */
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
