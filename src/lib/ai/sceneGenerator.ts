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

const SYSTEM_PROMPT = `You are a video scene designer for Lucid Studio. Given a prompt, create a scene project as JSON.

Available backgrounds (use these exact IDs):
- Animated gradients: animated-aurora, animated-sunset-flow, animated-ocean-wave, animated-neon-pulse, animated-midnight, animated-forest
- Particle effects: particle-bokeh-warm, particle-bokeh-cool
- Mesh gradients: mesh-apple-dark, mesh-vapor
- Or any hex color like #09090b, #1a1a2e, #0f172a

Available text entrance/exit animations: none, fade, typewriter, slide-left, slide-right, slide-up, slide-down, bounce, zoom-in, zoom-out, blur-in, wipe, rotate-in

Available scene transitions: none, fade, wipe-left, wipe-right, wipe-up, dissolve, zoom

Create 3-5 scenes, each 3-6 seconds long. Use varied backgrounds and animations. Text should be large (40-72px), centered, and use appropriate entrance animations with staggered delays for a polished look.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "name": "project name",
  "scenes": [
    {
      "durationMs": 5000,
      "background": "animated-aurora",
      "transition": { "type": "fade", "durationMs": 500 },
      "layers": [
        {
          "type": "text",
          "content": {
            "text": "Title Text",
            "fontSize": 64,
            "fontWeight": "700",
            "color": "#ffffff",
            "textAlign": "center"
          },
          "position": { "x": 10, "y": 35 },
          "size": { "width": 80, "height": 20 },
          "entrance": { "type": "fade", "durationMs": 800, "delay": 0 }
        }
      ]
    }
  ]
}

Guidelines:
- First scene transition should be "none" (no transition into the first scene)
- Use fade transitions between most scenes. Use wipe or zoom occasionally for variety
- Keep text concise and impactful. Subtitles should be smaller (20-32px) and slightly transparent
- Position layers using percentage values (0-100) for x, y, width, height
- Stagger layer entrance delays (0, 400, 800ms) for a professional cascading effect
- Use bold weights (600-800) for titles, normal (400) for body text
- For shape layers, use type "shape" with content: { "shape": "rounded-rect", "fill": "#2563eb" }`;

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
