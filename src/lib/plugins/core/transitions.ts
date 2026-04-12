// ── Core Transitions Plugin ─────────────────────────────────────────────
//
// Registers the built-in transitions (fade, slide, wipe, zoom-morph)
// plus the custom transitions (striped-slam, zoom-punch, etc.)

import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
	depthParallax,
	irisZoom,
	portal,
	shatter,
	warpDissolve,
	zoomThrough,
} from "@/lib/remotion/helpers/CinematicTransitions";
import type { LucidPlugin } from "../types";

export const coreTransitionsPlugin: LucidPlugin = {
	id: "core-transitions",
	name: "Core Transitions",
	version: "1.0.0",
	register(registry) {
		// Standard Remotion transitions
		registry.registerTransition({
			id: "fade",
			name: "Fade",
			description: "Subtle crossfade",
			energy: "low",
			defaultDuration: 8,
			codeExpression: "fade()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "slide-left",
			name: "Slide Left",
			description: "New scene slides in from the right",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-right" })',
			create: () => slide({ direction: "from-right" }),
		});
		registry.registerTransition({
			id: "slide-right",
			name: "Slide Right",
			description: "New scene slides in from the left",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-left" })',
			create: () => slide({ direction: "from-left" }),
		});
		registry.registerTransition({
			id: "slide-up",
			name: "Slide Up",
			description: "New scene comes from the bottom",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-bottom" })',
			create: () => slide({ direction: "from-bottom" }),
		});
		registry.registerTransition({
			id: "slide-down",
			name: "Slide Down",
			description: "New scene drops from the top",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-top" })',
			create: () => slide({ direction: "from-top" }),
		});
		registry.registerTransition({
			id: "wipe-left",
			name: "Wipe Left",
			description: "Bold wipe from right",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-right" })',
			create: () => wipe({ direction: "from-right" }),
		});
		registry.registerTransition({
			id: "wipe-right",
			name: "Wipe Right",
			description: "Bold wipe from left",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-left" })',
			create: () => wipe({ direction: "from-left" }),
		});
		registry.registerTransition({
			id: "wipe-up",
			name: "Wipe Up",
			description: "Bold wipe from bottom",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-bottom" })',
			create: () => wipe({ direction: "from-bottom" }),
		});
		registry.registerTransition({
			id: "wipe-down",
			name: "Wipe Down",
			description: "Bold wipe from top",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-top" })',
			create: () => wipe({ direction: "from-top" }),
		});
		// Zoom morph (uses zoomMorph from CinematicHelpers via MODULE_SCOPE)
		registry.registerTransition({
			id: "zoom-morph",
			name: "Zoom Morph",
			description: "Cinematic fly-through zoom",
			energy: "high",
			defaultDuration: 16,
			useSpringTiming: true,
			codeExpression: "zoomMorph()",
			create: () => fade(), // placeholder — actual uses code path
		});
		// Custom transitions
		registry.registerTransition({
			id: "striped-slam",
			name: "Striped Slam",
			description: "Horizontal bars slam in from both sides",
			energy: "maximum",
			defaultDuration: 50,
			codeExpression: "stripedSlam()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "zoom-punch",
			name: "Zoom Punch",
			description: "Old retreats, new punches in",
			energy: "high",
			defaultDuration: 35,
			useSpringTiming: true,
			codeExpression: "zoomPunch()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "diagonal-reveal",
			name: "Diagonal Reveal",
			description: "Dark panel sweeps with accent line",
			energy: "high",
			defaultDuration: 40,
			codeExpression: "diagonalReveal()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "color-burst",
			name: "Color Burst",
			description: "Sharp radial flash at the cut",
			energy: "high",
			defaultDuration: 40,
			codeExpression: "colorBurst()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "vertical-shutter",
			name: "Vertical Shutter",
			description: "Venetian blind panels snap shut/open",
			energy: "high",
			defaultDuration: 35,
			codeExpression: "verticalShutter()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "glitch-slam",
			name: "Glitch Slam",
			description: "Horizontal shake + RGB strip tears",
			energy: "maximum",
			defaultDuration: 30,
			codeExpression: "glitchSlam()",
			create: () => fade(),
		});
		// Cut
		registry.registerTransition({
			id: "cut",
			name: "Cut (instant)",
			description: "No transition, instant cut",
			energy: "low",
			defaultDuration: 1,
			codeExpression: "fade()",
			create: () => fade(),
		});

		// ── Cinematic 3D transitions ──

		registry.registerTransition({
			id: "zoom-through",
			name: "Zoom Through",
			description: "Camera flies through current scene into the next — portal/dimension shift feel",
			energy: "maximum",
			defaultDuration: 40,
			codeExpression: "zoomThrough()",
			create: () => (zoomThrough as any)(),
		});
		registry.registerTransition({
			id: "portal",
			name: "Portal",
			description: "Circular reveal expanding from focal point — dimensional rift",
			energy: "high",
			defaultDuration: 35,
			codeExpression: "portal()",
			create: (accent) => (portal as any)({ glowColor: accent }),
		});
		registry.registerTransition({
			id: "depth-parallax",
			name: "Depth Parallax",
			description: "3D perspective shift — scenes arranged in spatial depth",
			energy: "medium",
			defaultDuration: 30,
			codeExpression: "depthParallax()",
			create: () => (depthParallax as any)(),
		});
		registry.registerTransition({
			id: "warp-dissolve",
			name: "Warp Dissolve",
			description: "Reality bends and warps — dream sequence / dimension shift",
			energy: "high",
			defaultDuration: 35,
			codeExpression: "warpDissolve()",
			create: () => (warpDissolve as any)(),
		});
		registry.registerTransition({
			id: "iris-zoom",
			name: "Iris Zoom",
			description: "Camera aperture closes on old scene, reveals new — cinematic iris",
			energy: "medium",
			defaultDuration: 30,
			codeExpression: "irisZoom()",
			create: () => (irisZoom as any)(),
		});
		registry.registerTransition({
			id: "shatter",
			name: "Shatter",
			description: "Scene breaks into geometric shards flying outward — high-energy dramatic",
			energy: "maximum",
			defaultDuration: 40,
			codeExpression: "shatter()",
			create: () => (shatter as any)(),
		});
	},
};
