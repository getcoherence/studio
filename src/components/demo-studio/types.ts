// ── Demo Studio shared types ──────────────────────────────────────────

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
	audioPath?: string; // TTS narration audio file path
}

// ── Chat message types ────────────────────────────────────────────────

export type DemoChatMessageType =
	| "user-prompt"
	| "system"
	| "thinking"
	| "action"
	| "narration"
	| "pause"
	| "error"
	| "completion";

export interface DemoChatMessage {
	id: string;
	type: DemoChatMessageType;
	content: string;
	timestamp: number;
	screenshotDataUrl?: string;
	audioPath?: string; // TTS narration audio file path
	actionType?: string;
	actionTarget?: string;
}

// ── Agent status ──────────────────────────────────────────────────────

export type DemoAgentStatus = "idle" | "running" | "paused" | "complete";
