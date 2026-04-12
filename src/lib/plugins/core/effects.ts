// ── Core Effects Plugin ─────────────────────────────────────────────────
//
// Registers the built-in background effects as plugins.

import {
	Bubbles,
	Confetti,
	Embers,
	Fireflies,
	FlowingGradient,
	LightRays,
	Mist,
	PerspectiveGrid,
	Sakura,
	Snow,
	Sparks,
	Stars,
} from "@/lib/remotion/helpers/ParticleEffects";
import { PixiOverlay } from "@/lib/remotion/helpers/PixiOverlay";
import type { LucidPlugin } from "../types";

export const coreEffectsPlugin: LucidPlugin = {
	id: "core-effects",
	name: "Core Effects",
	version: "1.0.0",
	register(registry) {
		// Particle effects
		registry.registerEffect({
			id: "confetti",
			name: "Confetti",
			description: "Colorful paper pieces raining down",
			category: "particles",
			component: Confetti,
		});
		registry.registerEffect({
			id: "snow",
			name: "Snow",
			description: "Soft snowflakes drifting",
			category: "particles",
			component: Snow,
		});
		registry.registerEffect({
			id: "fireflies",
			name: "Fireflies",
			description: "Warm glowing dots floating",
			category: "particles",
			component: Fireflies,
		});
		registry.registerEffect({
			id: "sakura",
			name: "Sakura",
			description: "Cherry blossom petals falling",
			category: "particles",
			component: Sakura,
		});
		registry.registerEffect({
			id: "sparks",
			name: "Sparks",
			description: "Shooting star trails",
			category: "particles",
			component: Sparks,
		});

		// Geometric
		registry.registerEffect({
			id: "perspective-grid",
			name: "Perspective Grid",
			description: "Synthwave scrolling grid",
			category: "geometric",
			component: PerspectiveGrid,
		});

		// Gradient
		registry.registerEffect({
			id: "flowing-gradient",
			name: "Flowing Gradient",
			description: "Animated rainbow gradient",
			category: "gradient",
			component: FlowingGradient,
		});

		// ── New particle types (animation engine) ──

		registry.registerEffect({
			id: "mist",
			name: "Mist",
			description: "Slow-moving translucent cloud layers",
			category: "ambient",
			component: Mist,
		});
		registry.registerEffect({
			id: "light-rays",
			name: "Light Rays",
			description: "Diagonal light shafts with fade",
			category: "ambient",
			component: LightRays,
		});
		registry.registerEffect({
			id: "bubbles",
			name: "Bubbles",
			description: "Rising translucent circles with wobble",
			category: "particles",
			component: Bubbles,
		});
		registry.registerEffect({
			id: "embers",
			name: "Embers",
			description: "Rising glowing particles with drift",
			category: "particles",
			component: Embers,
		});
		registry.registerEffect({
			id: "stars",
			name: "Stars",
			description: "Twinkling static star field",
			category: "ambient",
			component: Stars,
		});

		// ── GPU-accelerated overlay ──

		registry.registerEffect({
			id: "pixi-overlay",
			name: "PixiJS Overlay",
			description: "GPU-accelerated particle and filter effects",
			category: "texture",
			component: PixiOverlay,
		});
	},
};
