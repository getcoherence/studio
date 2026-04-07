// ── Core Effects Plugin ─────────────────────────────────────────────────
//
// Registers the built-in background effects as plugins.

import type { LucidPlugin } from "../types";
import {
	Confetti,
	Fireflies,
	FlowingGradient,
	PerspectiveGrid,
	Sakura,
	Snow,
	Sparks,
} from "@/lib/remotion/helpers/ParticleEffects";

export const coreEffectsPlugin: LucidPlugin = {
	id: "core-effects",
	name: "Core Effects",
	version: "1.0.0",
	register(registry) {
		// Particle effects
		registry.registerEffect({ id: "confetti", name: "Confetti", description: "Colorful paper pieces raining down", category: "particles", component: Confetti });
		registry.registerEffect({ id: "snow", name: "Snow", description: "Soft snowflakes drifting", category: "particles", component: Snow });
		registry.registerEffect({ id: "fireflies", name: "Fireflies", description: "Warm glowing dots floating", category: "particles", component: Fireflies });
		registry.registerEffect({ id: "sakura", name: "Sakura", description: "Cherry blossom petals falling", category: "particles", component: Sakura });
		registry.registerEffect({ id: "sparks", name: "Sparks", description: "Shooting star trails", category: "particles", component: Sparks });

		// Geometric
		registry.registerEffect({ id: "perspective-grid", name: "Perspective Grid", description: "Synthwave scrolling grid", category: "geometric", component: PerspectiveGrid });

		// Gradient
		registry.registerEffect({ id: "flowing-gradient", name: "Flowing Gradient", description: "Animated rainbow gradient", category: "gradient", component: FlowingGradient });
	},
};
