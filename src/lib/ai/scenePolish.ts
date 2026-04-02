/**
 * AI Scene Polish — enhances a demo scene project with better animations,
 * backgrounds, transitions, and timing. Works by analyzing each scene's
 * content and applying professional motion design rules.
 *
 * Can run purely with heuristics (instant) or optionally use AI for
 * smarter per-scene decisions.
 */

import type { Scene, SceneLayer, SceneProject, SceneTransition } from "@/lib/scene-renderer";

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
