// ── Composition Templates ────────────────────────────────────────────────
//
// Predefined scene compositions that transform simple storyboard instructions
// into rich, cinematic Scene Builder scenes with proper layers, animations,
// and transitions.
//
// Each template is a function that takes params and returns 1-3 Scene objects.

import type { ImageContent, Scene, SceneLayer, TextContent } from "@/lib/scene-renderer/types";

let _id = 1;
function uid(): string {
	return `comp-${Date.now()}-${_id++}`;
}

// ── Template: Title Card ─────────────────────────────────────────────────
// Animated background + large text with cinematic entrance

export function titleCard(opts: {
	title: string;
	subtitle?: string;
	background?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 2500;
	const layers: SceneLayer[] = [];

	// Title text — blur-in entrance
	layers.push({
		id: uid(),
		type: "text",
		startMs: 0,
		endMs: duration,
		position: { x: 10, y: opts.subtitle ? 32 : 38 },
		size: { width: 80, height: 18 },
		zIndex: 1,
		entrance: { type: "blur-in", durationMs: 800, easing: "ease-out", delay: 300 },
		exit: { type: "fade", durationMs: 400, easing: "ease-in", delay: 0 },
		content: {
			text: opts.title,
			fontSize: 64,
			fontFamily: "Inter, system-ui, sans-serif",
			fontWeight: "700",
			color: "#ffffff",
			textAlign: "center",
			lineHeight: 1.2,
		} satisfies TextContent,
	});

	// Subtitle — typewriter entrance with delay
	if (opts.subtitle) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: { x: 15, y: 55 },
			size: { width: 70, height: 10 },
			zIndex: 2,
			entrance: { type: "typewriter", durationMs: 1500, easing: "linear", delay: 1000 },
			exit: { type: "fade", durationMs: 400, easing: "ease-in", delay: 0 },
			content: {
				text: opts.subtitle,
				fontSize: 26,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "400",
				color: "#ffffff99",
				textAlign: "center",
				lineHeight: 1.4,
			} satisfies TextContent,
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "animated-midnight",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 600 },
		layers,
	};
}

// ── Template: Hero Reveal ────────────────────────────────────────────────
// Full page screenshot with ken-burns zoom toward a focus area + narration

export function heroReveal(opts: {
	screenshotSrc: string;
	narration: string;
	focusPoint?: { x: number; y: number };
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3000;
	const layers: SceneLayer[] = [];

	// Screenshot — full-frame with ken-burns toward focus
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 3, y: 3 },
		size: { width: 94, height: 72 },
		zIndex: 1,
		entrance: {
			type: "ken-burns",
			durationMs: duration,
			easing: "linear",
			delay: 0,
			focusPoint: opts.focusPoint ?? { x: 0.5, y: 0.3 },
		},
		exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "cover",
			borderRadius: 12,
			shadow: true,
		} satisfies ImageContent,
	});

	// Narration text overlay at bottom
	layers.push({
		id: uid(),
		type: "text",
		startMs: 0,
		endMs: duration,
		position: { x: 5, y: 80 },
		size: { width: 90, height: 15 },
		zIndex: 2,
		entrance: { type: "fade", durationMs: 500, easing: "ease-out", delay: 400 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			text: opts.narration,
			fontSize: 22,
			fontFamily: "Inter, system-ui, sans-serif",
			fontWeight: "500",
			color: "#ffffffcc",
			textAlign: "center",
			lineHeight: 1.4,
		} satisfies TextContent,
	});

	return {
		id: uid(),
		durationMs: duration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 500 },
		layers,
	};
}

// ── Template: Feature Zoom ───────────────────────────────────────────────
// Full page screenshot → zoom into a specific element (2-scene sequence)
// Creates the cinematic "let me show you this" drill-down effect

export function featureZoom(opts: {
	screenshotSrc: string;
	narration: string;
	/** Crop region in the source image (0-1 normalized) */
	cropRegion: { x: number; y: number; width: number; height: number };
	durationMs?: number;
}): Scene[] {
	const fullDuration = opts.durationMs ?? 2500;
	const zoomDuration = Math.round(fullDuration * 0.8);

	// Scene 1: Full page with ken-burns zooming toward the crop region
	const fullScene: Scene = {
		id: uid(),
		durationMs: fullDuration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 500 },
		layers: [
			{
				id: uid(),
				type: "image",
				startMs: 0,
				endMs: fullDuration,
				position: { x: 3, y: 3 },
				size: { width: 94, height: 72 },
				zIndex: 1,
				entrance: {
					type: "ken-burns",
					durationMs: fullDuration,
					easing: "ease-in-out",
					delay: 0,
					focusPoint: {
						x: opts.cropRegion.x + opts.cropRegion.width / 2,
						y: opts.cropRegion.y + opts.cropRegion.height / 2,
					},
				},
				exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
				content: {
					src: opts.screenshotSrc,
					fit: "cover",
					borderRadius: 12,
					shadow: true,
				} satisfies ImageContent,
			},
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: fullDuration,
				position: { x: 5, y: 80 },
				size: { width: 90, height: 15 },
				zIndex: 2,
				entrance: { type: "fade", durationMs: 500, easing: "ease-out", delay: 300 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					text: opts.narration,
					fontSize: 22,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "500",
					color: "#ffffffcc",
					textAlign: "center",
					lineHeight: 1.4,
				} satisfies TextContent,
			},
		],
	};

	// Scene 2: Cropped element isolated on dark background with zoom-in entrance
	const zoomScene: Scene = {
		id: uid(),
		durationMs: zoomDuration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "zoom", durationMs: 400 },
		layers: [
			{
				id: uid(),
				type: "image",
				startMs: 0,
				endMs: zoomDuration,
				position: { x: 8, y: 8 },
				size: { width: 84, height: 68 },
				zIndex: 1,
				entrance: { type: "zoom-in", durationMs: 600, easing: "ease-out", delay: 0 },
				exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
				content: {
					src: opts.screenshotSrc,
					fit: "contain",
					borderRadius: 16,
					shadow: true,
					cropRegion: opts.cropRegion,
				} satisfies ImageContent,
			},
		],
	};

	return [fullScene, zoomScene];
}

// ── Template: Element Isolate ────────────────────────────────────────────
// A cropped element floating standalone on a dark background with shadow

export function elementIsolate(opts: {
	screenshotSrc: string;
	narration: string;
	cropRegion: { x: number; y: number; width: number; height: number };
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 4000;

	return {
		id: uid(),
		durationMs: duration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "dissolve", durationMs: 500 },
		layers: [
			// Cropped element centered
			{
				id: uid(),
				type: "image",
				startMs: 0,
				endMs: duration,
				position: { x: 10, y: 10 },
				size: { width: 80, height: 60 },
				zIndex: 1,
				entrance: { type: "zoom-in", durationMs: 600, easing: "ease-out", delay: 0 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					src: opts.screenshotSrc,
					fit: "contain",
					borderRadius: 16,
					shadow: true,
					cropRegion: opts.cropRegion,
				} satisfies ImageContent,
			},
			// Narration
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 5, y: 78 },
				size: { width: 90, height: 15 },
				zIndex: 2,
				entrance: { type: "slide-up", durationMs: 400, easing: "ease-out", delay: 500 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					text: opts.narration,
					fontSize: 22,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "500",
					color: "#ffffffcc",
					textAlign: "center",
					lineHeight: 1.4,
				} satisfies TextContent,
			},
		],
	};
}

// ── Template: Typing Sequence ────────────────────────────────────────────
// Kinetic typography — text types across the screen as a bridge between scenes

export function typingSequence(opts: {
	text: string;
	background?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3000;

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "animated-midnight",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 400 },
		layers: [
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 10, y: 36 },
				size: { width: 80, height: 20 },
				zIndex: 1,
				entrance: { type: "typewriter", durationMs: duration * 0.7, easing: "linear", delay: 200 },
				exit: { type: "blur-in", durationMs: 400, easing: "ease-in", delay: 0 },
				content: {
					text: opts.text,
					fontSize: 48,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "600",
					color: "#ffffff",
					textAlign: "center",
					lineHeight: 1.3,
				} satisfies TextContent,
			},
		],
	};
}

// ── Template: Simple Screenshot ──────────────────────────────────────────
// Basic screenshot + narration (fallback for when no fancy composition is needed)

export function simpleScreenshot(opts: {
	screenshotSrc: string;
	narration: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 4000;

	return {
		id: uid(),
		durationMs: duration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 500 },
		layers: [
			{
				id: uid(),
				type: "image",
				startMs: 0,
				endMs: duration,
				position: { x: 5, y: 5 },
				size: { width: 90, height: 70 },
				zIndex: 1,
				entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 0 },
				exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
				content: {
					src: opts.screenshotSrc,
					fit: "contain",
					borderRadius: 8,
					shadow: true,
				} satisfies ImageContent,
			},
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 5, y: 80 },
				size: { width: 90, height: 15 },
				zIndex: 2,
				entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 300 },
				exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
				content: {
					text: opts.narration,
					fontSize: 22,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "500",
					color: "#ffffffcc",
					textAlign: "center",
					lineHeight: 1.4,
				} satisfies TextContent,
			},
		],
	};
}
