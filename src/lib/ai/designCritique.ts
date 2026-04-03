// ── AI Design Critique ────────────────────────────────────────────────────
//
// Vision-model-powered critique that evaluates generated scenes against
// design principles and the selected style. Returns scored feedback and
// machine-readable mutations that can be auto-applied.

import type { Scene, SceneProject } from "@/lib/scene-renderer";
import { renderScene } from "@/lib/scene-renderer/sceneRenderer";
import { type DesignStyleId, getDesignStyle } from "./designStyles";

// ── Types ────────────────────────────────────────────────────────────────

export interface CritiqueScore {
	category:
		| "visual-hierarchy"
		| "contrast"
		| "spacing"
		| "color-harmony"
		| "typography"
		| "animation"
		| "overall";
	score: number; // 1-10
	note: string;
}

export interface SceneMutation {
	type: "update-background" | "update-layer-animation" | "update-layer-content" | "update-duration";
	layerIndex?: number;
	changes: Record<string, unknown>;
	reason: string;
}

export interface SceneCritique {
	sceneIndex: number;
	scores: CritiqueScore[];
	overallScore: number;
	topIssues: string[];
	mutations: SceneMutation[];
}

export interface CritiqueResult {
	sceneCritiques: SceneCritique[];
	projectScore: number;
	summary: string;
}

// ── Critique Prompt ──────────────────────────────────────────────────────

function buildCritiquePrompt(styleId: DesignStyleId, sceneJson: string): string {
	const style = getDesignStyle(styleId);

	return `You are an elite design critic reviewing a video scene for a ${style.name}-style presentation.

STYLE CONTEXT:
${style.description}. ${style.referenceDescriptions[0] ?? ""}

DESIGN RULES FOR THIS STYLE (violations are critical issues):
${style.systemPromptFragment.split("\n").slice(0, 30).join("\n")}

SCENE DATA:
${sceneJson}

Evaluate this scene on a screenshot + data. Score each category 1-10 and suggest specific fixes.

Respond with JSON ONLY:
{
  "scores": [
    {"category": "visual-hierarchy", "score": 8, "note": "Clear focal point, good title dominance"},
    {"category": "contrast", "score": 7, "note": "Text readable but subtitle could be brighter"},
    {"category": "spacing", "score": 6, "note": "Title too close to subtitle, needs more vertical gap"},
    {"category": "color-harmony", "score": 9, "note": "Colors match the style palette well"},
    {"category": "typography", "score": 7, "note": "Font size good but weight could be bolder"},
    {"category": "animation", "score": 8, "note": "Entrance fits the style, timing is smooth"},
    {"category": "overall", "score": 7, "note": "Solid scene but spacing and contrast need work"}
  ],
  "topIssues": ["Subtitle too close to title — increase y gap by 5%", "Consider bolder font weight for title"],
  "mutations": [
    {"type": "update-layer-content", "layerIndex": 0, "changes": {"fontWeight": "800"}, "reason": "Bolder weight matches style"},
    {"type": "update-layer-animation", "layerIndex": 1, "changes": {"position": {"y": 58}}, "reason": "More breathing room between title and subtitle"}
  ]
}

RULES:
- Be specific and actionable. "Make it better" is useless. "Increase title fontSize to 72px" is useful.
- Score relative to Dribbble/Awwwards quality. 7 = good, 8 = great, 9 = exceptional, 10 = perfect.
- Focus on what violates the style rules above. Style violations are the most critical issues.
- Suggest max 3 mutations per scene. Only the most impactful changes.
- mutation types: "update-background" (changes: {background}), "update-layer-animation" (changes: {entrance or exit fields}), "update-layer-content" (changes: {any content/position/size fields}), "update-duration" (changes: {durationMs})`;
}

// ── Screenshot Capture ───────────────────────────────────────────────────

/**
 * Render a scene to an offscreen canvas and return base64 PNG.
 */
function captureSceneScreenshot(scene: Scene, width: number, height: number): string | null {
	try {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;

		// Render at t=0 (static frame with all layers visible)
		renderScene(ctx, scene, 0, width, height);

		// Export as base64 (strip the data:image/png;base64, prefix)
		const dataUrl = canvas.toDataURL("image/png");
		return dataUrl.replace(/^data:image\/\w+;base64,/, "");
	} catch {
		return null;
	}
}

// ── Main Critique Function ───────────────────────────────────────────────

/**
 * Run a vision-model critique on all scenes in a project.
 * Returns scored feedback and optional auto-apply mutations.
 */
export async function critiqueSceneProject(
	project: SceneProject,
	onProgress?: (sceneIndex: number, total: number) => void,
): Promise<CritiqueResult> {
	const styleId = (project.styleId as DesignStyleId) ?? "classic-dark";
	const sceneCritiques: SceneCritique[] = [];
	const { width, height } = project.resolution;

	for (let i = 0; i < project.scenes.length; i++) {
		const scene = project.scenes[i];
		onProgress?.(i, project.scenes.length);

		// Capture screenshot
		const screenshot = captureSceneScreenshot(scene, width, height);

		// Build scene JSON context (without image data to keep prompt small)
		const sceneData = {
			...scene,
			layers: scene.layers.map((l) => ({
				...l,
				content: l.type === "image" ? { ...l.content, src: "(screenshot)" } : l.content,
			})),
		};

		const critiquePrompt = buildCritiquePrompt(styleId, JSON.stringify(sceneData, null, 2));

		try {
			let result;

			// Try vision first, fall back to text-only if vision fails
			if (screenshot) {
				result = await window.electronAPI?.aiAnalyzeImage(
					critiquePrompt,
					screenshot,
					"You are an elite design critic. Evaluate this scene screenshot.",
				);
			}

			// Fall back to text-only analysis if vision unavailable or failed
			if (!result?.success || !result.text) {
				result = await window.electronAPI?.aiAnalyze(
					critiquePrompt,
					"You are an elite design critic. Evaluate this scene based on its data.",
				);
			}

			if (!result?.success || !result.text) {
				sceneCritiques.push(buildFallbackCritique(i));
				continue;
			}

			// Parse response
			let json = result.text.trim();
			const match = json.match(/\{[\s\S]*\}/);
			if (match) json = match[0];
			const parsed = JSON.parse(json) as {
				scores?: CritiqueScore[];
				topIssues?: string[];
				mutations?: SceneMutation[];
			};

			const scores = Array.isArray(parsed.scores) ? parsed.scores : [];
			const overallEntry = scores.find((s) => s.category === "overall");
			const overallScore = overallEntry?.score ?? averageScores(scores);

			sceneCritiques.push({
				sceneIndex: i,
				scores,
				overallScore,
				topIssues: Array.isArray(parsed.topIssues) ? parsed.topIssues : [],
				mutations: Array.isArray(parsed.mutations) ? parsed.mutations : [],
			});
		} catch {
			sceneCritiques.push(buildFallbackCritique(i));
		}
	}

	const projectScore =
		sceneCritiques.length > 0
			? Math.round(
					(sceneCritiques.reduce((sum, c) => sum + c.overallScore, 0) / sceneCritiques.length) * 10,
				) / 10
			: 0;

	const lowScenes = sceneCritiques.filter((c) => c.overallScore < 7);
	const summary =
		lowScenes.length === 0
			? `All ${sceneCritiques.length} scenes scored 7+ — looking sharp.`
			: `${lowScenes.length} of ${sceneCritiques.length} scenes need improvement. Focus on: ${lowScenes.flatMap((c) => c.topIssues.slice(0, 1)).join("; ")}`;

	return { sceneCritiques, projectScore, summary };
}

// ── Apply Mutations ──────────────────────────────────────────────────────

/**
 * Apply critique mutations to a project, returning a new (immutable) project.
 */
export function applyCritiqueMutations(
	project: SceneProject,
	critiques: SceneCritique[],
): SceneProject {
	const scenes = [...project.scenes];

	for (const critique of critiques) {
		const i = critique.sceneIndex;
		if (i < 0 || i >= scenes.length) continue;

		for (const mutation of critique.mutations) {
			try {
				scenes[i] = applyMutation(scenes[i], mutation);
			} catch {
				// Skip invalid mutations
			}
		}
	}

	return { ...project, scenes };
}

function applyMutation(scene: Scene, mutation: SceneMutation): Scene {
	switch (mutation.type) {
		case "update-background": {
			const bg = mutation.changes.background;
			if (typeof bg === "string") {
				return { ...scene, background: bg };
			}
			return scene;
		}
		case "update-duration": {
			const dur = mutation.changes.durationMs;
			if (typeof dur === "number" && dur >= 1000 && dur <= 30000) {
				return {
					...scene,
					durationMs: dur,
					layers: scene.layers.map((l) => ({ ...l, endMs: dur })),
				};
			}
			return scene;
		}
		case "update-layer-animation": {
			const idx = mutation.layerIndex;
			if (idx == null || idx < 0 || idx >= scene.layers.length) return scene;
			const changes = mutation.changes as Record<string, unknown>;
			return {
				...scene,
				layers: scene.layers.map((l, li) => {
					if (li !== idx) return l;
					const entrance = changes.entrance
						? { ...l.entrance, ...(changes.entrance as Record<string, unknown>) }
						: l.entrance;
					const exit = changes.exit
						? { ...l.exit, ...(changes.exit as Record<string, unknown>) }
						: l.exit;
					return { ...l, entrance: entrance as typeof l.entrance, exit: exit as typeof l.exit };
				}),
			};
		}
		case "update-layer-content": {
			const idx = mutation.layerIndex;
			if (idx == null || idx < 0 || idx >= scene.layers.length) return scene;
			const changes = mutation.changes as Record<string, unknown>;
			return {
				...scene,
				layers: scene.layers.map((l, li) => {
					if (li !== idx) return l;
					const updated = { ...l };
					if (changes.position)
						updated.position = { ...l.position, ...(changes.position as Record<string, number>) };
					if (changes.size)
						updated.size = { ...l.size, ...(changes.size as Record<string, number>) };
					// Merge content changes
					const contentChanges = { ...changes };
					delete contentChanges.position;
					delete contentChanges.size;
					if (Object.keys(contentChanges).length > 0) {
						updated.content = { ...l.content, ...contentChanges } as typeof l.content;
					}
					return updated;
				}),
			};
		}
		default:
			return scene;
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────

function averageScores(scores: CritiqueScore[]): number {
	if (scores.length === 0) return 5;
	return Math.round((scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 10) / 10;
}

function buildFallbackCritique(sceneIndex: number): SceneCritique {
	return {
		sceneIndex,
		scores: [
			{ category: "overall", score: 5, note: "Could not analyze — vision model unavailable" },
		],
		overallScore: 5,
		topIssues: ["Vision model unavailable — try with OpenAI or Anthropic provider"],
		mutations: [],
	};
}
