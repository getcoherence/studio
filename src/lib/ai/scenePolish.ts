/**
 * AI Scene Polish — enhances a demo scene project with better animations,
 * backgrounds, transitions, and timing. Works by analyzing each scene's
 * content and applying professional motion design rules.
 *
 * Can run purely with heuristics (instant) or optionally use AI for
 * smarter per-scene decisions.
 */

import type {
	AnimationType,
	Scene,
	SceneLayer,
	SceneProject,
	SceneTransition,
} from "@/lib/scene-renderer";

// ── Animated backgrounds (premium dark options) ──

const POLISH_BACKGROUNDS = [
	"mesh-apple-dark",
	"animated-midnight",
	"animated-ocean-wave",
	"particle-bokeh-cool",
];

// ── Polish logic ──────────────────────────────────────────────────────

export interface ScenePolishPreview {
	backgroundsChanged: number;
	transitionsAdded: number;
	animationsEnhanced: number;
	durationsAdjusted: number;
	totalScenes: number;
}

/**
 * Apply polish to a scene project. Returns a new project (does not mutate).
 *
 * Enhancements:
 * 1. Animated background (consistent across project, different for last scene)
 * 2. Fade transitions between all scenes (zoom for final scene)
 * 3. Ken-burns on image layers (slow zoom effect on screenshots)
 * 4. Staggered entrance animations (title first, then subtitle, then image)
 * 5. Duration tuning based on text length
 * 6. Better text styling (semi-transparent background pill for readability)
 */
export function polishSceneProject(project: SceneProject): {
	project: SceneProject;
	preview: ScenePolishPreview;
} {
	const preview: ScenePolishPreview = {
		backgroundsChanged: 0,
		transitionsAdded: 0,
		animationsEnhanced: 0,
		durationsAdjusted: 0,
		totalScenes: project.scenes.length,
	};

	// Pick a consistent background for the project
	const mainBg = POLISH_BACKGROUNDS[Math.floor(Math.random() * POLISH_BACKGROUNDS.length)];
	const lastBg = POLISH_BACKGROUNDS.find((b) => b !== mainBg) ?? "animated-midnight";

	const polishedScenes: Scene[] = project.scenes.map((scene, sceneIdx) => {
		const isFirst = sceneIdx === 0;
		const isLast = sceneIdx === project.scenes.length - 1;

		// 1. Background
		let background = scene.background;
		if (background === "#09090b" || background === "#000000" || background === "#0f172a") {
			background = isLast ? lastBg : mainBg;
			preview.backgroundsChanged++;
		}

		// 2. Transitions
		let transition: SceneTransition = scene.transition;
		if (isFirst) {
			transition = { type: "none", durationMs: 0 };
		} else if (isLast) {
			if (transition.type === "none") {
				transition = { type: "zoom", durationMs: 500 };
				preview.transitionsAdded++;
			}
		} else {
			if (transition.type === "none") {
				transition = { type: "fade", durationMs: 400 };
				preview.transitionsAdded++;
			}
		}

		// 3. Duration tuning based on content
		let durationMs = scene.durationMs;
		const textLayers = scene.layers.filter((l) => l.type === "text");
		const totalTextLength = textLayers.reduce((sum, l) => {
			const content = l.content as { text?: string };
			return sum + (content.text?.length ?? 0);
		}, 0);

		// Longer duration for text-heavy scenes, shorter for image-only
		if (totalTextLength > 100 && durationMs < 5000) {
			durationMs = 5000;
			preview.durationsAdjusted++;
		} else if (totalTextLength > 50 && durationMs < 4000) {
			durationMs = 4000;
			preview.durationsAdjusted++;
		} else if (totalTextLength === 0 && durationMs > 3500) {
			durationMs = 3000;
			preview.durationsAdjusted++;
		}

		// 4. Enhance layer animations
		const layers: SceneLayer[] = scene.layers.map((layer, layerIdx) => {
			const enhanced = { ...layer };

			if (layer.type === "image") {
				// Ken-burns on screenshots
				if (layer.entrance.type === "fade" || layer.entrance.type === "none") {
					enhanced.entrance = {
						type: "ken-burns",
						durationMs: durationMs, // Ken-burns runs the whole scene
						easing: "ease-out",
						delay: 0,
					};
					preview.animationsEnhanced++;
				}
			}

			if (layer.type === "text") {
				const isTitle = (layer.content as { fontSize?: number }).fontSize
					? (layer.content as { fontSize: number }).fontSize >= 36
					: false;

				if (isTitle) {
					// Title: blur-in, no delay
					if (layer.entrance.type === "fade" || layer.entrance.type === "none") {
						enhanced.entrance = {
							type: "blur-in",
							durationMs: 500,
							easing: "ease-out",
							delay: isFirst ? 200 : 100,
						};
						preview.animationsEnhanced++;
					}
				} else {
					// Subtitle/narration: slide-up with stagger
					if (layer.entrance.type === "fade" || layer.entrance.type === "none") {
						enhanced.entrance = {
							type: "slide-up",
							durationMs: 400,
							easing: "ease-out",
							delay: 300 + layerIdx * 150,
						};
						preview.animationsEnhanced++;
					}
				}

				// Add exit animation to text
				if (layer.exit.type === "none" && !isLast) {
					enhanced.exit = {
						type: "fade",
						durationMs: 300,
						easing: "ease-in",
						delay: 0,
					};
				}
			}

			// Update endMs to match new duration
			enhanced.endMs = durationMs;

			return enhanced;
		});

		return {
			...scene,
			background,
			transition,
			durationMs,
			layers,
		};
	});

	return {
		project: { ...project, scenes: polishedScenes },
		preview,
	};
}

// ── AI-Powered Polish (vision model) ──────────────────────────────────

const AI_POLISH_PROMPT = `You are a motion design expert. Analyze this screenshot from a product demo video and suggest enhancements.

Respond with JSON only:
{
  "focusArea": "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right",
  "imageAnimation": "ken-burns" | "zoom-in" | "fade",
  "textAnimation": "blur-in" | "slide-up" | "fade",
  "suggestedDurationMs": 3000-6000,
  "background": "mesh-apple-dark" | "animated-midnight" | "animated-ocean-wave" | "particle-bokeh-cool",
  "reasoning": "brief explanation"
}

Rules:
- focusArea: where the most important content is (hero text, dashboard, key feature)
- imageAnimation: ken-burns for screenshots with lots of content, zoom-in for focused elements, fade for simple pages
- textAnimation: blur-in for titles/headers, slide-up for descriptions
- suggestedDurationMs: longer for text-heavy pages (5000), shorter for visual pages (3000)
- background: pick one that complements the screenshot's color palette`;

interface AIPolishSuggestion {
	focusArea: string;
	imageAnimation: string;
	textAnimation: string;
	suggestedDurationMs: number;
	background: string;
	reasoning: string;
}

/**
 * AI-enhanced polish — sends each scene's screenshot to a vision model
 * for per-scene analysis, then applies the recommendations.
 * Falls back to heuristic polish if vision fails.
 */
export async function aiPolishSceneProject(
	project: SceneProject,
	onProgress?: (sceneIndex: number, total: number) => void,
): Promise<{ project: SceneProject; preview: ScenePolishPreview }> {
	// Start with heuristic polish as the base
	const { project: basePolished, preview } = polishSceneProject(project);

	const scenes = [...basePolished.scenes];
	let aiEnhanced = 0;

	for (let i = 0; i < scenes.length; i++) {
		const scene = scenes[i];
		onProgress?.(i, scenes.length);

		// Find the image layer (screenshot)
		const imageLayer = scene.layers.find((l) => l.type === "image");
		if (!imageLayer || !(imageLayer.content as { src?: string }).src) continue;

		const src = (imageLayer.content as { src: string }).src;
		if (!src.startsWith("data:image")) continue;

		try {
			const base64 = src.replace(/^data:image\/\w+;base64,/, "");
			const result = await window.electronAPI?.aiAnalyzeImage(
				"Analyze this demo screenshot for motion design enhancements.",
				base64,
				AI_POLISH_PROMPT,
			);

			if (!result?.success || !result.text) continue;

			// Parse the suggestion
			let json = result.text.trim();
			const match = json.match(/\{[\s\S]*\}/);
			if (match) json = match[0];
			const suggestion = JSON.parse(json) as AIPolishSuggestion;

			// Apply AI suggestion to the scene
			const validAnimations: AnimationType[] = [
				"ken-burns",
				"zoom-in",
				"fade",
				"blur-in",
				"slide-up",
			];

			// Update image layer animation
			if (validAnimations.includes(suggestion.imageAnimation as AnimationType)) {
				const imgIdx = scene.layers.findIndex((l) => l.type === "image");
				if (imgIdx >= 0) {
					scenes[i] = {
						...scenes[i],
						layers: scenes[i].layers.map((l, li) =>
							li === imgIdx
								? {
										...l,
										entrance: {
											...l.entrance,
											type: suggestion.imageAnimation as AnimationType,
										},
									}
								: l,
						),
					};
				}
			}

			// Update text layer animations
			if (validAnimations.includes(suggestion.textAnimation as AnimationType)) {
				scenes[i] = {
					...scenes[i],
					layers: scenes[i].layers.map((l) =>
						l.type === "text"
							? {
									...l,
									entrance: {
										...l.entrance,
										type: suggestion.textAnimation as AnimationType,
									},
								}
							: l,
					),
				};
			}

			// Update duration
			if (suggestion.suggestedDurationMs >= 2000 && suggestion.suggestedDurationMs <= 8000) {
				scenes[i] = {
					...scenes[i],
					durationMs: suggestion.suggestedDurationMs,
					layers: scenes[i].layers.map((l) => ({
						...l,
						endMs: suggestion.suggestedDurationMs,
					})),
				};
			}

			// Update background
			if (POLISH_BACKGROUNDS.includes(suggestion.background)) {
				scenes[i] = { ...scenes[i], background: suggestion.background };
			}

			aiEnhanced++;
		} catch {
			// Skip this scene, keep heuristic polish
			continue;
		}
	}

	preview.animationsEnhanced += aiEnhanced;

	return {
		project: { ...basePolished, scenes },
		preview,
	};
}
