// ── AI Scene Generator ────────────────────────────────────────────────────
//
// Generates a complete SceneProject from a text prompt using the configured
// AI provider via the Electron API.

import {
	type Scene,
	type SceneLayer,
	type SceneProject,
	type SceneTransition,
	type TextContent,
} from "@/lib/scene-renderer";

const SYSTEM_PROMPT = `You are a world-class motion designer creating cinematic video presentations. Your style: Apple keynotes, Stripe product announcements, Linear changelogs. Every pixel is intentional.

IRON RULES — violating these makes the output look amateur:

TYPOGRAPHY
- Max 2 text layers per scene. Period.
- Title: 56-72px, weight 700, color "#ffffff", textAlign "center"
- Subtitle: 24-28px, weight 400, color "#ffffff99", textAlign "center"
- Never put more than 5 words in a title. Split long content across scenes.
- Font: always "Inter, system-ui, sans-serif" (do not change)

LAYOUT (percentage-based positioning)
- Title: x:10, y:36, width:80, height:16
- Subtitle: x:15, y:55, width:70, height:10
- NEVER stack text below y:70 (gets cut off) or above y:15 (looks cramped)
- NEVER overlap layers. Each layer occupies its own vertical band.

VISUAL HIERARCHY
- Scene 1 (opener): Large title + subtle tagline. This is the hook.
- Middle scenes: One key message per scene. Title + supporting line.
- Final scene: CTA or URL. Slightly different background for emphasis.

TIMING & MOTION
- Scene duration: 3000-4000ms. Never longer.
- Title entrance: "blur-in" 500ms delay 0. Subtitle: "fade" 400ms delay 400.
- Exit animations: "none" (let transitions handle it)
- Transitions: "fade" 400ms between all scenes. Use "zoom" ONLY for the final reveal.

BACKGROUNDS
- Use ONE background for the entire project (visual consistency). Exception: final CTA scene may use a different one.
- BEST: "mesh-apple-dark", "#09090b", "animated-midnight", "#0f172a"
- ACCEPTABLE: "animated-ocean-wave", "mesh-vapor", "particle-bokeh-cool"
- NEVER USE: aurora, neon, bright gradients, or any light background

COLOR PALETTE
- Primary text: #ffffff
- Secondary text: #ffffff99
- ONE accent color if needed: #2563eb (use sparingly — e.g., wrap one word in a subtitle)
- Never use red, green, yellow, or multiple accent colors

ANIMATIONS ALLOWED
- Titles: "blur-in" or "fade" ONLY
- Subtitles: "fade" ONLY
- BANNED: "bounce", "rotate-in", "slide-left", "slide-right", "typewriter" (all look cheap on titles)

SCENE COUNT: Exactly 5 scenes for standard prompts. 3-4 for very short prompts.

Return ONLY valid JSON (no markdown, no explanation):
{"name":"...","scenes":[{"durationMs":3500,"background":"mesh-apple-dark","transition":{"type":"fade","durationMs":400},"layers":[{"type":"text","content":{"text":"Title","fontSize":64,"fontWeight":"700","fontFamily":"Inter, system-ui, sans-serif","color":"#ffffff","textAlign":"center"},"position":{"x":10,"y":36},"size":{"width":80,"height":16},"entrance":{"type":"blur-in","durationMs":500,"delay":0}},{"type":"text","content":{"text":"Subtitle here","fontSize":26,"fontWeight":"400","fontFamily":"Inter, system-ui, sans-serif","color":"#ffffff99","textAlign":"center"},"position":{"x":15,"y":55},"size":{"width":70,"height":10},"entrance":{"type":"fade","durationMs":400,"delay":400}}]}]}`;

// ── Preset templates ────────────────────────────────────────────────────

export interface SceneTemplate {
	id: string;
	name: string;
	description: string;
	thumbnail: string; // emoji for now
	prompt: string;
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
	{
		id: "product-launch",
		name: "Product Launch",
		description: "Announce a new product or major release",
		thumbnail: "🚀",
		prompt:
			"Create a cinematic product launch announcement video. Scene 1: Bold product name with tagline. Scene 2: The key problem it solves. Scene 3: The hero feature with a punchy description. Scene 4: Social proof or a key metric. Scene 5: Call to action with the URL.",
	},
	{
		id: "feature-walkthrough",
		name: "Feature Walkthrough",
		description: "Highlight a specific feature or workflow",
		thumbnail: "✨",
		prompt:
			"Create a feature walkthrough video. Scene 1: Feature name with a one-line value prop. Scene 2: Step 1 of the workflow. Scene 3: Step 2 — the key interaction. Scene 4: The result or outcome. Scene 5: Try it today with URL.",
	},
	{
		id: "testimonial",
		name: "Testimonial / Quote",
		description: "Showcase a customer quote or social proof",
		thumbnail: "💬",
		prompt:
			'Create a testimonial/social proof video. Scene 1: "What our customers say" or similar hook. Scene 2: Customer quote (keep it short, attributed to a name and title). Scene 3: A key metric or result (e.g., "3x faster deployments"). Scene 4: Second short quote from a different customer. Scene 5: Join them — CTA with URL.',
	},
	{
		id: "changelog",
		name: "Changelog / Update",
		description: "Summarize recent product updates",
		thumbnail: "📋",
		prompt:
			"Create a product changelog/update video. Scene 1: 'What's New' with the month or version. Scene 2: First update — name and one-line description. Scene 3: Second update — the highlight feature. Scene 4: Third update or improvement. Scene 5: Update now — CTA.",
	},
	{
		id: "comparison",
		name: "Before / After",
		description: "Show a before-and-after transformation",
		thumbnail: "⚡",
		prompt:
			'Create a before/after comparison video. Scene 1: The problem or "before" state with a pain point. Scene 2: Emphasize the frustration or cost of the old way. Scene 3: "Now with [Product]" — the transformation. Scene 4: The key result or benefit. Scene 5: Get started — CTA with URL.',
	},
];

let _nextId = 1;
function uid(): string {
	return `ai-${Date.now()}-${_nextId++}`;
}

/**
 * Generate a complete SceneProject from a text prompt using AI.
 * Returns null if generation fails.
 */
export async function generateSceneProject(prompt: string): Promise<SceneProject | null> {
	// Try the structured JSON endpoint first, fall back to text analysis
	let raw: unknown;

	try {
		const jsonResult = await window.electronAPI.aiGenerateJSON(prompt, SYSTEM_PROMPT);

		if (jsonResult.success && jsonResult.data) {
			raw = jsonResult.data;
		}
	} catch {
		// Fall through to aiAnalyze
	}

	// Fallback: use text-based analysis and parse JSON manually
	if (!raw) {
		const textResult = await window.electronAPI.aiAnalyze(prompt, SYSTEM_PROMPT);
		if (!textResult.success || !textResult.text) return null;

		try {
			// Strip markdown code fences if present
			let jsonStr = textResult.text.trim();
			if (jsonStr.startsWith("```")) {
				jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
			}
			raw = JSON.parse(jsonStr);
		} catch (e) {
			console.error("Failed to parse AI response as JSON:", e);
			return null;
		}
	}

	return validateAndBuildProject(raw);
}

/**
 * Validate the raw AI output and construct a proper SceneProject,
 * filling in defaults for missing fields.
 */
function validateAndBuildProject(raw: unknown): SceneProject | null {
	if (!raw || typeof raw !== "object") return null;
	const data = raw as Record<string, unknown>;

	const scenesRaw = data.scenes;
	if (!Array.isArray(scenesRaw) || scenesRaw.length === 0) return null;

	const scenes: Scene[] = [];

	for (let i = 0; i < scenesRaw.length; i++) {
		const s = scenesRaw[i];
		if (!s || typeof s !== "object") continue;
		const sd = s as Record<string, unknown>;

		const durationMs = clampNumber(sd.durationMs, 1000, 30000, 5000);
		const background = typeof sd.background === "string" ? sd.background : "#09090b";
		const transition = parseTransition(sd.transition, i === 0);

		const layersRaw = Array.isArray(sd.layers) ? sd.layers : [];
		const layers: SceneLayer[] = [];

		for (let j = 0; j < layersRaw.length; j++) {
			const layer = parseLayer(layersRaw[j], durationMs, j + 1);
			if (layer) layers.push(layer);
		}

		scenes.push({
			id: uid(),
			durationMs,
			background,
			animatedBgSpeed: 1,
			transition,
			layers,
		});
	}

	if (scenes.length === 0) return null;

	return {
		id: uid(),
		name: typeof data.name === "string" ? data.name : "AI Generated Project",
		scenes,
		resolution: { width: 1920, height: 1080 },
		fps: 30,
	};
}

function parseTransition(raw: unknown, isFirst: boolean): SceneTransition {
	if (isFirst) return { type: "none", durationMs: 0 };
	if (!raw || typeof raw !== "object") return { type: "fade", durationMs: 500 };

	const t = raw as Record<string, unknown>;
	const validTypes = [
		"none",
		"fade",
		"wipe-left",
		"wipe-right",
		"wipe-up",
		"dissolve",
		"zoom",
	] as const;
	const type = validTypes.includes(t.type as (typeof validTypes)[number])
		? (t.type as SceneTransition["type"])
		: "fade";
	const durationMs = type === "none" ? 0 : clampNumber(t.durationMs, 200, 2000, 500);

	return { type, durationMs };
}

function parseLayer(raw: unknown, sceneDuration: number, zIndex: number): SceneLayer | null {
	if (!raw || typeof raw !== "object") return null;
	const d = raw as Record<string, unknown>;

	const type = d.type === "image" ? "image" : d.type === "shape" ? "shape" : "text";
	const contentRaw = (d.content as Record<string, unknown>) ?? {};
	const positionRaw = (d.position as Record<string, unknown>) ?? {};
	const sizeRaw = (d.size as Record<string, unknown>) ?? {};
	const entranceRaw = (d.entrance as Record<string, unknown>) ?? {};
	const exitRaw = (d.exit as Record<string, unknown>) ?? {};

	const position = {
		x: clampNumber(positionRaw.x, 0, 100, 10),
		y: clampNumber(positionRaw.y, 0, 100, 30),
	};
	const size = {
		width: clampNumber(sizeRaw.width, 5, 100, 80),
		height: clampNumber(sizeRaw.height, 3, 100, 20),
	};

	const validAnimTypes = [
		"none",
		"fade",
		"slide-left",
		"slide-right",
		"slide-up",
		"slide-down",
		"typewriter",
		"bounce",
		"zoom-in",
		"zoom-out",
		"blur-in",
		"wipe",
		"rotate-in",
	] as const;

	const entranceType = validAnimTypes.includes(entranceRaw.type as (typeof validAnimTypes)[number])
		? (entranceRaw.type as (typeof validAnimTypes)[number])
		: "fade";

	const exitType = validAnimTypes.includes(exitRaw.type as (typeof validAnimTypes)[number])
		? (exitRaw.type as (typeof validAnimTypes)[number])
		: "none";

	const entrance = {
		type: entranceType,
		durationMs: clampNumber(entranceRaw.durationMs, 100, 3000, 500),
		easing: "ease-out" as const,
		delay: clampNumber(entranceRaw.delay, 0, 5000, 0),
	};

	const exit = {
		type: exitType,
		durationMs: clampNumber(exitRaw.durationMs, 100, 3000, 500),
		easing: "ease-out" as const,
		delay: clampNumber(exitRaw.delay, 0, 5000, 0),
	};

	let content: SceneLayer["content"];

	if (type === "text") {
		content = {
			text: typeof contentRaw.text === "string" ? contentRaw.text : "Text",
			fontSize: clampNumber(contentRaw.fontSize, 12, 120, 48),
			fontFamily:
				typeof contentRaw.fontFamily === "string"
					? contentRaw.fontFamily
					: "Inter, system-ui, sans-serif",
			fontWeight:
				typeof contentRaw.fontWeight === "string"
					? contentRaw.fontWeight
					: String(clampNumber(contentRaw.fontWeight, 100, 900, 600)),
			color: typeof contentRaw.color === "string" ? contentRaw.color : "#ffffff",
			backgroundColor:
				typeof contentRaw.backgroundColor === "string" ? contentRaw.backgroundColor : undefined,
			textAlign:
				contentRaw.textAlign === "left" || contentRaw.textAlign === "right"
					? contentRaw.textAlign
					: "center",
			lineHeight: clampNumber(contentRaw.lineHeight, 0.8, 3, 1.4),
		} satisfies TextContent;
	} else if (type === "shape") {
		content = {
			shape:
				contentRaw.shape === "circle"
					? "circle"
					: contentRaw.shape === "rectangle"
						? "rectangle"
						: "rounded-rect",
			fill: typeof contentRaw.fill === "string" ? contentRaw.fill : "#2563eb",
			stroke: typeof contentRaw.stroke === "string" ? contentRaw.stroke : undefined,
			strokeWidth: typeof contentRaw.strokeWidth === "number" ? contentRaw.strokeWidth : 0,
		};
	} else {
		content = {
			src: typeof contentRaw.src === "string" ? contentRaw.src : "",
			fit: contentRaw.fit === "cover" || contentRaw.fit === "fill" ? contentRaw.fit : "contain",
			borderRadius: clampNumber(contentRaw.borderRadius, 0, 100, 8),
			shadow: typeof contentRaw.shadow === "boolean" ? contentRaw.shadow : true,
		};
	}

	return {
		id: uid(),
		type,
		startMs: 0,
		endMs: sceneDuration,
		position,
		size,
		zIndex,
		entrance,
		exit,
		content,
	};
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || Number.isNaN(value)) return fallback;
	return Math.max(min, Math.min(max, value));
}
