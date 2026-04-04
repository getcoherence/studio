/**
 * Simple module-level store for passing demo projects from VideoEditor to SceneEditor.
 * Avoids circular imports between the two components.
 */

import type { SceneProject } from "@/lib/scene-renderer";

let pending: SceneProject | null = null;

export function setPendingDemoProject(project: SceneProject): void {
	pending = project;
}

export function consumePendingDemoProject(): SceneProject | null {
	const p = pending;
	pending = null;
	return p;
}

// ── AI Composition store ────────────────────────────────────────────────

export interface AiCompositionData {
	code: string;
	screenshots: string[];
}

let pendingAi: AiCompositionData | null = null;

export function setPendingAiComposition(data: AiCompositionData): void {
	pendingAi = data;
}

export function consumePendingAiComposition(): AiCompositionData | null {
	const d = pendingAi;
	pendingAi = null;
	return d;
}
