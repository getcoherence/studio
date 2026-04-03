// ── Composition Templates ────────────────────────────────────────────────
//
// Predefined scene compositions that transform simple storyboard instructions
// into rich, cinematic Scene Builder scenes with proper layers, animations,
// and transitions.
//
// Each template is a function that takes params and returns 1-3 Scene objects.

import type {
	ImageContent,
	Scene,
	SceneLayer,
	ShapeContent,
	TextContent,
} from "@/lib/scene-renderer/types";

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

	// Title text — bold, centered, impactful
	layers.push({
		id: uid(),
		type: "text",
		startMs: 0,
		endMs: duration,
		position: { x: 8, y: opts.subtitle ? 28 : 32 },
		size: { width: 84, height: 30 },
		zIndex: 1,
		entrance: { type: "blur-in", durationMs: 600, easing: "ease-out", delay: 200 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			text: opts.title,
			fontSize: 80,
			fontFamily: "Inter, system-ui, sans-serif",
			fontWeight: "800",
			color: "#ffffff",
			textAlign: "center",
			lineHeight: 1.15,
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
	// Expand to fill canvas when no narration overlay
	const imgHeight = opts.narration ? 72 : 92;
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 3, y: 3 },
		size: { width: 94, height: imgHeight },
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

	// Narration text overlay at bottom (only when narration provided)
	if (opts.narration) {
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
	}

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
	/** When provided, shows a cropped screenshot alongside the text */
	featureImage?: {
		src: string;
		cropRegion: { x: number; y: number; width: number; height: number };
	};
}): Scene {
	const duration = opts.durationMs ?? 3000;
	const hasImage = !!opts.featureImage;

	const layers: SceneLayer[] = [
		{
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			// With image: text left side. Without: bold centered.
			position: hasImage ? { x: 4, y: 22 } : { x: 8, y: 28 },
			size: hasImage ? { width: 42, height: 50 } : { width: 84, height: 40 },
			zIndex: 2,
			entrance: { type: "typewriter", durationMs: duration * 0.55, easing: "linear", delay: 150 },
			exit: { type: "blur-in", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				text: opts.text,
				fontSize: hasImage ? 40 : 64,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "800",
				color: "#ffffff",
				textAlign: hasImage ? "left" : "center",
				lineHeight: 1.2,
			} satisfies TextContent,
		},
	];

	// Feature image — cropped UI element on the right side
	if (opts.featureImage) {
		layers.push({
			id: uid(),
			type: "image",
			startMs: 0,
			endMs: duration,
			position: { x: 50, y: 8 },
			size: { width: 46, height: 80 },
			zIndex: 1,
			entrance: { type: "zoom-in", durationMs: 600, easing: "ease-out", delay: 400 },
			exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				src: opts.featureImage.src,
				fit: "contain",
				borderRadius: 16,
				shadow: true,
				cropRegion: opts.featureImage.cropRegion,
			} satisfies ImageContent,
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "animated-midnight",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 400 },
		layers,
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
	const layers: SceneLayer[] = [
		{
			id: uid(),
			type: "image",
			startMs: 0,
			endMs: duration,
			position: { x: 5, y: 5 },
			size: { width: 90, height: opts.narration ? 70 : 90 },
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
	];

	if (opts.narration) {
		layers.push({
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
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 500 },
		layers,
	};
}

// ── Template: Device Mockup ─────────────────────────────────────────────
// Screenshot inside a browser chrome frame with narration text below

export function deviceMockup(opts: {
	screenshotSrc: string;
	narration: string;
	background?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3500;
	const hasNarration = !!opts.narration;
	const frameHeight = hasNarration ? 68 : 88;
	const layers: SceneLayer[] = [];

	// Browser frame
	layers.push({
		id: uid(),
		type: "shape",
		startMs: 0,
		endMs: duration,
		position: { x: 10, y: 4 },
		size: { width: 80, height: frameHeight },
		zIndex: 0,
		entrance: { type: "zoom-in", durationMs: 500, easing: "ease-out", delay: 0 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			shape: "rounded-rect",
			fill: "#ffffff06",
			stroke: "#ffffff12",
			strokeWidth: 1,
		} satisfies ShapeContent,
	});

	// Tab bar
	layers.push({
		id: uid(),
		type: "shape",
		startMs: 0,
		endMs: duration,
		position: { x: 10, y: 4 },
		size: { width: 80, height: 4 },
		zIndex: 1,
		entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 100 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: { shape: "rounded-rect", fill: "#1a1a2e" } satisfies ShapeContent,
	});

	// Traffic light dots
	const dotColors = ["#ff5f57", "#ffbd2e", "#28c840"];
	for (let d = 0; d < 3; d++) {
		layers.push({
			id: uid(),
			type: "shape",
			startMs: 0,
			endMs: duration,
			position: { x: 12 + d * 1.5, y: 5.2 },
			size: { width: 0.6, height: 1 },
			zIndex: 2,
			entrance: { type: "fade", durationMs: 300, easing: "ease-out", delay: 200 + d * 50 },
			exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
			content: { shape: "circle", fill: dotColors[d] } satisfies ShapeContent,
		});
	}

	// Screenshot inside frame
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 11, y: 9 },
		size: { width: 78, height: frameHeight - 6 },
		zIndex: 3,
		entrance: { type: "fade", durationMs: 500, easing: "ease-out", delay: 200 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "cover",
			borderRadius: 4,
			shadow: false,
		} satisfies ImageContent,
	});

	// Narration text below the frame
	if (hasNarration) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: { x: 10, y: 76 },
			size: { width: 80, height: 20 },
			zIndex: 4,
			entrance: { type: "fade", durationMs: 500, easing: "ease-out", delay: 400 },
			exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				text: opts.narration,
				fontSize: 24,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "500",
				color: "#ffffffcc",
				textAlign: "center",
				lineHeight: 1.3,
			} satisfies TextContent,
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "#09090b",
		animatedBgSpeed: 0.5,
		transition: { type: "fade", durationMs: 500 },
		layers,
	};
}

// ── Template: Feature Spotlight ─────────────────────────────────────────
// Full screenshot dimmed, highlight region shown bright with accent border

export function featureSpotlight(opts: {
	screenshotSrc: string;
	narration: string;
	highlightRegion: { x: number; y: number; width: number; height: number };
	accentColor?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3500;
	const accent = opts.accentColor ?? "#2563eb";
	const hr = opts.highlightRegion;
	const layers: SceneLayer[] = [];

	// Full screenshot (dimmed by overlay)
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 3, y: 3 },
		size: { width: 94, height: 92 },
		zIndex: 1,
		entrance: { type: "fade", durationMs: 500, easing: "ease-out", delay: 0 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "contain",
			borderRadius: 16,
			shadow: true,
		} satisfies ImageContent,
	});

	// Dark overlay
	layers.push({
		id: uid(),
		type: "shape",
		startMs: 0,
		endMs: duration,
		position: { x: 3, y: 3 },
		size: { width: 94, height: 92 },
		zIndex: 2,
		entrance: { type: "fade", durationMs: 600, easing: "ease-out", delay: 300 },
		exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
		content: { shape: "rounded-rect", fill: "rgba(0,0,0,0.5)" } satisfies ShapeContent,
	});

	// Highlighted crop (bright)
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 3 + hr.x * 94, y: 3 + hr.y * 92 },
		size: { width: hr.width * 94, height: hr.height * 92 },
		zIndex: 3,
		entrance: { type: "zoom-in", durationMs: 600, easing: "ease-out", delay: 400 },
		exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "contain",
			borderRadius: 12,
			shadow: true,
			cropRegion: hr,
		} satisfies ImageContent,
	});

	// Accent border around highlight
	layers.push({
		id: uid(),
		type: "shape",
		startMs: 0,
		endMs: duration,
		position: { x: 2.5 + hr.x * 94, y: 2.5 + hr.y * 92 },
		size: { width: hr.width * 94 + 1, height: hr.height * 92 + 1 },
		zIndex: 4,
		entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 600 },
		exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
		content: {
			shape: "rounded-rect",
			fill: "transparent",
			stroke: accent,
			strokeWidth: 2,
		} satisfies ShapeContent,
	});

	// Narration text at top
	if (opts.narration) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: { x: 5, y: 3 },
			size: { width: 40, height: 20 },
			zIndex: 6,
			entrance: { type: "blur-in", durationMs: 600, easing: "ease-out", delay: 400 },
			exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
			content: {
				text: opts.narration,
				fontSize: 28,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "600",
				color: "#ffffff",
				textAlign: "left",
				lineHeight: 1.3,
			} satisfies TextContent,
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "dissolve", durationMs: 500 },
		layers,
	};
}

// ── Template: Split Reveal ──────────────────────────────────────────────
// Two cropped regions side by side with narration below

export function splitReveal(opts: {
	screenshotSrc: string;
	narration: string;
	leftRegion: { x: number; y: number; width: number; height: number };
	rightRegion: { x: number; y: number; width: number; height: number };
	background?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3500;
	const layers: SceneLayer[] = [];

	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 3, y: 8 },
		size: { width: 45, height: 70 },
		zIndex: 1,
		entrance: { type: "slide-left", durationMs: 600, easing: "ease-out", delay: 200 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "contain",
			borderRadius: 16,
			shadow: true,
			cropRegion: opts.leftRegion,
		} satisfies ImageContent,
	});
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 52, y: 8 },
		size: { width: 45, height: 70 },
		zIndex: 1,
		entrance: { type: "slide-right", durationMs: 600, easing: "ease-out", delay: 400 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "contain",
			borderRadius: 16,
			shadow: true,
			cropRegion: opts.rightRegion,
		} satisfies ImageContent,
	});

	if (opts.narration) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: { x: 5, y: 82 },
			size: { width: 90, height: 15 },
			zIndex: 3,
			entrance: { type: "typewriter", durationMs: duration * 0.5, easing: "linear", delay: 600 },
			exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				text: opts.narration,
				fontSize: 24,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "500",
				color: "#ffffffcc",
				textAlign: "center",
				lineHeight: 1.3,
			} satisfies TextContent,
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "animated-midnight",
		animatedBgSpeed: 0.7,
		transition: { type: "fade", durationMs: 500 },
		layers,
	};
}

// ── Template: Offset Card ───────────────────────────────────────────────
// Screenshot on one side, narration text on the other

export function offsetCard(opts: {
	screenshotSrc: string;
	narration: string;
	side?: "left" | "right";
	cropRegion?: { x: number; y: number; width: number; height: number };
	background?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3500;
	const isRight = (opts.side ?? "right") === "right";
	const layers: SceneLayer[] = [];

	// Screenshot
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: isRight ? { x: 50, y: 6 } : { x: 3, y: 6 },
		size: { width: 46, height: 82 },
		zIndex: 1,
		entrance: {
			type: isRight ? "slide-right" : "slide-left",
			durationMs: 600,
			easing: "ease-out",
			delay: 200,
		},
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "contain",
			borderRadius: 16,
			shadow: true,
			cropRegion: opts.cropRegion,
		} satisfies ImageContent,
	});

	// Narration text
	if (opts.narration) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: isRight ? { x: 4, y: 25 } : { x: 52, y: 25 },
			size: { width: 42, height: 45 },
			zIndex: 2,
			entrance: { type: "blur-in", durationMs: 700, easing: "ease-out", delay: 400 },
			exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				text: opts.narration,
				fontSize: 34,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "600",
				color: "#ffffff",
				textAlign: "left",
				lineHeight: 1.35,
			} satisfies TextContent,
		});
	}

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "animated-midnight",
		animatedBgSpeed: 0.5,
		transition: { type: "fade", durationMs: 500 },
		layers,
	};
}

// ── Template: Stats Banner ──────────────────────────────────────────────
// Large stat number + narration + small screenshot

export function statsBanner(opts: {
	screenshotSrc: string;
	narration: string;
	stat?: string;
	cropRegion?: { x: number; y: number; width: number; height: number };
	background?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 3500;
	const stat = opts.stat ?? extractStat(opts.narration) ?? "";
	const layers: SceneLayer[] = [];

	if (stat) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: { x: 10, y: 18 },
			size: { width: 55, height: 30 },
			zIndex: 2,
			entrance: { type: "bounce", durationMs: 800, easing: "spring", delay: 200 },
			exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				text: stat,
				fontSize: 96,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "800",
				color: "#ffffff",
				textAlign: "left",
				lineHeight: 1.1,
			} satisfies TextContent,
		});
	}

	if (opts.narration) {
		layers.push({
			id: uid(),
			type: "text",
			startMs: 0,
			endMs: duration,
			position: { x: 10, y: stat ? 50 : 30 },
			size: { width: 55, height: 20 },
			zIndex: 2,
			entrance: { type: "typewriter", durationMs: duration * 0.5, easing: "linear", delay: 500 },
			exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
			content: {
				text: opts.narration,
				fontSize: 26,
				fontFamily: "Inter, system-ui, sans-serif",
				fontWeight: "500",
				color: "#ffffffbb",
				textAlign: "left",
				lineHeight: 1.4,
			} satisfies TextContent,
		});
	}

	// Small screenshot for context
	layers.push({
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: duration,
		position: { x: 62, y: 20 },
		size: { width: 34, height: 55 },
		zIndex: 1,
		entrance: { type: "fade", durationMs: 600, easing: "ease-out", delay: 400 },
		exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
		content: {
			src: opts.screenshotSrc,
			fit: "contain",
			borderRadius: 16,
			shadow: true,
			cropRegion: opts.cropRegion,
		} satisfies ImageContent,
	});

	return {
		id: uid(),
		durationMs: duration,
		background: opts.background ?? "animated-midnight",
		animatedBgSpeed: 0.5,
		transition: { type: "fade", durationMs: 500 },
		layers,
	};
}

function extractStat(text: string): string | null {
	const match = text.match(/\$?\d[\d,.]*[%xX+]?(?:\/\w+)?(?:\s*[MKBmkb])?/);
	return match ? match[0] : null;
}
