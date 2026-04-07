// ── Core Animations Plugin ──────────────────────────────────────────────
//
// Registers the built-in text animation types.

import type { LucidPlugin } from "../types";

export const coreAnimationsPlugin: LucidPlugin = {
	id: "core-animations",
	name: "Core Animations",
	version: "1.0.0",
	register(registry) {
		registry.registerAnimation({ id: "chars", name: "Per-Char", description: "Characters animate in one by one" });
		registry.registerAnimation({ id: "words", name: "Words", description: "Words animate in one by one" });
		registry.registerAnimation({ id: "scale", name: "Scale", description: "Text scales up from center" });
		registry.registerAnimation({ id: "clip", name: "Clip", description: "Text revealed by expanding clip" });
		registry.registerAnimation({ id: "gradient", name: "Gradient", description: "Animated gradient text fill" });
		registry.registerAnimation({ id: "blur-in", name: "Blur", description: "Text fades in from blur" });
		registry.registerAnimation({ id: "bounce", name: "Bounce", description: "Words bounce in with spring" });
		registry.registerAnimation({ id: "wave", name: "Wave", description: "Characters wave up and down" });
		registry.registerAnimation({ id: "typewriter", name: "Typewriter", description: "Characters appear with cursor" });
		registry.registerAnimation({ id: "staccato", name: "Staccato", description: "Words pop in with overshoot" });
		registry.registerAnimation({ id: "split", name: "Split", description: "Words fly from edges to center" });
		registry.registerAnimation({ id: "drop", name: "Drop", description: "Words drop in from above" });
		registry.registerAnimation({ id: "scramble", name: "Scramble", description: "Glitch scramble reveal" });
		registry.registerAnimation({ id: "matrix", name: "Matrix", description: "Characters decode from random glyphs" });
		registry.registerAnimation({ id: "rotate-3d", name: "3D Rotate", description: "Per-character 3D perspective rotation" });
		registry.registerAnimation({ id: "glitch-in", name: "Glitch In", description: "Chromatic aberration reveal" });
		registry.registerAnimation({ id: "none", name: "None", description: "No animation" });
	},
};
