// ── Cinematic Composition Engine ─────────────────────────────────────────
//
// Generates a SceneProject optimized for Remotion's capabilities:
// - ~70% bold text-only slides (per-character entrance, blur-in)
// - ~20% tight UI element crops (floating on dark bg with shadow)
// - ~10% full page in device mockup (hero + closing)
// - Fast pacing: 1.5-2.5s per scene
// - Brand color accents extracted from screenshot analysis
//
// Unlike the standard compositionEngine which is screenshot-heavy, this
// produces content that looks like a polished product video (Adaptive.ai style).

import type { DemoStep } from "@/components/demo-studio/types";
import type { Scene, SceneProject } from "@/lib/scene-renderer/types";
import { deviceMockup, heroReveal, titleCard } from "./compositionTemplates";

// ── Types ────────────────────────────────────────────────────────────────

export interface BrandInfo {
	/** Primary brand color extracted from the site */
	primaryColor: string;
	/** Secondary/accent color */
	accentColor?: string;
	/** Brand font family (if detected) */
	fontFamily?: string;
	/** Product name */
	productName?: string;
}

type CinematicTemplateId =
	| "boldText"
	| "perCharText"
	| "rollingNumber"
	| "floatingCard"
	| "deviceFrame"
	| "heroShot";

// ── Main entry point ─────────────────────────────────────────────────────

let _uid = 1;
function uid(): string {
	return `cin-${Date.now()}-${_uid++}`;
}

/**
 * Build a cinematic SceneProject from DemoSteps.
 * Designed for Remotion rendering — text-forward, fast cuts, minimal screenshots.
 */
export function composeCinematicProject(
	steps: DemoStep[],
	opts?: { title?: string; brand?: BrandInfo },
): SceneProject {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const scenes: Scene[] = [];
	const videoTitle = opts?.title || "Product Demo";
	const brand = opts?.brand ?? detectBrandFromSteps(stepsWithScreenshots);
	const accent = brand.primaryColor;

	// ── Opening: bold title on black ──
	scenes.push(
		cinematicTitleSlide({
			text: videoTitle,
			accent,
			durationMs: 2000,
		}),
	);

	// ── Compose each step ──
	const usedTemplates: CinematicTemplateId[] = [];

	for (let i = 0; i < stepsWithScreenshots.length; i++) {
		const step = stepsWithScreenshots[i];
		if (!step.screenshotDataUrl) continue;

		const narration = step.action.narration || "";
		const headline = step.headline || deriveHeadline(narration);
		const hasNumbers = /\$?\d[\d,.]*[%xX+]?/.test(narration);
		const els = step.uiElements ?? [];
		const cards = els.filter((e) => e.type === "card");
		const bestElement = cards[0] ?? els[0];
		const bestCrop = bestElement?.bounds ?? step.cropRegion;
		const isFirst = i === 0;
		const isLast = i === stepsWithScreenshots.length - 1;

		// Pick template
		const template = pickCinematicTemplate({
			sceneIndex: i,
			totalScenes: stepsWithScreenshots.length,
			hasNumbers,
			hasCrop: !!bestCrop,
			previousTemplates: usedTemplates,
			isFirst,
			isLast,
		});

		const stepScenes = generateCinematicScenes({
			template,
			step,
			headline,
			narration,
			accent,
			brand,
			bestCrop,
			isFirst,
			isLast,
		});

		scenes.push(...stepScenes);
		usedTemplates.push(template);
	}

	// ── Closing: product name or title on black ──
	scenes.push(
		cinematicTitleSlide({
			text: brand.productName || videoTitle,
			subtitle: "See what's possible.",
			accent,
			durationMs: 2500,
		}),
	);

	return {
		id: uid(),
		name: videoTitle,
		styleId: "cinematic",
		scenes,
		resolution: { width: 1920, height: 1080 },
		fps: 30,
	};
}

// ── Template selection ──────────────────────────────────────────────────

interface PickContext {
	sceneIndex: number;
	totalScenes: number;
	hasNumbers: boolean;
	hasCrop: boolean;
	previousTemplates: CinematicTemplateId[];
	isFirst: boolean;
	isLast: boolean;
}

function pickCinematicTemplate(ctx: PickContext): CinematicTemplateId {
	const { hasNumbers, hasCrop, previousTemplates, isFirst, isLast, sceneIndex, totalScenes } = ctx;
	const prev = previousTemplates[previousTemplates.length - 1];

	// First scene: hero shot (establishing product visual)
	if (isFirst) return "heroShot";

	// Last scene: device frame (closing product shot)
	if (isLast) return "deviceFrame";

	// Numbers → rolling counter (max 1 per video)
	const hasRolled = previousTemplates.includes("rollingNumber");
	if (hasNumbers && !hasRolled) return "rollingNumber";

	// Floating card: only at the midpoint of the video (one "product moment")
	// This keeps screenshots to ~10-20% of scenes
	const mid = Math.floor(totalScenes / 2);
	const nearMid = Math.abs(sceneIndex - mid) <= 1;
	const cardCount = previousTemplates.filter((t) => t === "floatingCard").length;
	if (hasCrop && nearMid && cardCount < 2 && prev !== "floatingCard") return "floatingCard";

	// Everything else: bold text — alternate between styles for variety
	const textTemplates: CinematicTemplateId[] = ["boldText", "perCharText"];
	const filtered = textTemplates.filter((t) => t !== prev);
	return filtered[sceneIndex % filtered.length] || "boldText";
}

// ── Scene generation ────────────────────────────────────────────────────

interface GenerateContext {
	template: CinematicTemplateId;
	step: DemoStep;
	headline: string;
	narration: string;
	accent: string;
	brand: BrandInfo;
	bestCrop?: { x: number; y: number; width: number; height: number };
	isFirst: boolean;
	isLast: boolean;
}

function generateCinematicScenes(ctx: GenerateContext): Scene[] {
	const { template, step, headline, accent, brand, bestCrop } = ctx;
	const src = step.screenshotDataUrl!;
	const focusPoint = step.focusPoint ?? { x: 0.5, y: 0.4 };
	const font = brand.fontFamily || "'Inter', system-ui, sans-serif";

	switch (template) {
		case "boldText":
			return [
				cinematicTitleSlide({
					text: headline,
					accent,
					font,
					durationMs: 1800,
				}),
			];

		case "perCharText":
			return [
				cinematicPerCharSlide({
					text: headline,
					accent,
					font,
					durationMs: 2200,
				}),
			];

		case "rollingNumber": {
			const stat = extractStat(ctx.narration);
			if (stat) {
				return [
					cinematicRollingNumberSlide({
						stat,
						headline,
						accent,
						font,
						durationMs: 2500,
					}),
				];
			}
			// Fallback to bold text if no stat found
			return [
				cinematicTitleSlide({
					text: headline,
					accent,
					font,
					durationMs: 1800,
				}),
			];
		}

		case "floatingCard":
			return [
				cinematicFloatingCardSlide({
					src,
					cropRegion: bestCrop ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
					headline,
					accent,
					font,
					durationMs: 2200,
				}),
			];

		case "heroShot":
			return [
				heroReveal({
					screenshotSrc: src,
					narration: "",
					focusPoint,
					durationMs: 2000,
				}),
			];

		case "deviceFrame":
			return [
				deviceMockup({
					screenshotSrc: src,
					narration: headline,
					background: "#000000",
					durationMs: 2500,
				}),
			];

		default:
			return [
				cinematicTitleSlide({
					text: headline,
					accent,
					font,
					durationMs: 1800,
				}),
			];
	}
}

// ── Cinematic slide builders ────────────────────────────────────────────

/**
 * Bold text centered on black — blur-in entrance, cinematic feel.
 * Uses the standard SceneLayer data model so it works with existing renderers.
 */
function cinematicTitleSlide(opts: {
	text: string;
	subtitle?: string;
	accent: string;
	font?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 1800;

	return titleCard({
		title: opts.text,
		subtitle: opts.subtitle,
		background: "#000000",
		durationMs: duration,
	});
}

/**
 * Per-character animated text slide.
 * Uses a "text" layer with a special marker in the content that RemotionLayer
 * can detect to use PerCharacterText rendering. We store the animation metadata
 * using the existing layer data model — the magic happens at render time by
 * checking the SceneProject's styleId.
 */
function cinematicPerCharSlide(opts: {
	text: string;
	accent: string;
	font?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 2200;
	const font = opts.font || "'Inter', system-ui, sans-serif";

	return {
		id: uid(),
		durationMs: duration,
		background: "#000000",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 400 },
		layers: [
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 8, y: 28 },
				size: { width: 84, height: 40 },
				zIndex: 1,
				// Use slide-up as the animation type — for cinematic styleId,
				// RemotionLayer will upgrade this to per-character springs.
				entrance: { type: "slide-up", durationMs: duration * 0.6, easing: "spring", delay: 100 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					text: opts.text,
					fontSize: 84,
					fontFamily: font,
					fontWeight: "800",
					color: "#ffffff",
					textAlign: "center",
					lineHeight: 1.15,
				},
			},
			// Subtle accent line below text
			{
				id: uid(),
				type: "shape",
				startMs: 0,
				endMs: duration,
				position: { x: 42, y: 68 },
				size: { width: 16, height: 0.3 },
				zIndex: 2,
				entrance: { type: "wipe", durationMs: 600, easing: "ease-out", delay: 400 },
				exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
				content: {
					shape: "rectangle",
					fill: opts.accent,
				},
			},
		],
	};
}

/**
 * Rolling number slide — large stat with headline below.
 * The stat is rendered as a text layer; when styleId=cinematic,
 * RemotionLayer swaps in the RollingNumber component.
 */
function cinematicRollingNumberSlide(opts: {
	stat: { prefix: string; number: string; suffix: string };
	headline: string;
	accent: string;
	font?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 2500;
	const font = opts.font || "'Inter', system-ui, sans-serif";
	const displayText = `${opts.stat.prefix}${opts.stat.number}${opts.stat.suffix}`;

	return {
		id: uid(),
		durationMs: duration,
		background: "#000000",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 400 },
		layers: [
			// Large stat number
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 10, y: 18 },
				size: { width: 80, height: 35 },
				zIndex: 1,
				entrance: { type: "bounce", durationMs: 1000, easing: "spring", delay: 200 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					text: displayText,
					fontSize: 120,
					fontFamily: font,
					fontWeight: "800",
					color: opts.accent,
					textAlign: "center",
					lineHeight: 1.1,
				},
			},
			// Headline below
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 15, y: 58 },
				size: { width: 70, height: 15 },
				zIndex: 2,
				entrance: { type: "blur-in", durationMs: 600, easing: "ease-out", delay: 500 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					text: opts.headline,
					fontSize: 32,
					fontFamily: font,
					fontWeight: "500",
					color: "#ffffffbb",
					textAlign: "center",
					lineHeight: 1.3,
				},
			},
		],
	};
}

/**
 * Floating card slide — cropped UI element on dark bg with shadow.
 * Uses an image layer with crop; for cinematic styleId, RemotionLayer
 * swaps in the FloatingCard component for the perspective/shadow treatment.
 */
function cinematicFloatingCardSlide(opts: {
	src: string;
	cropRegion: { x: number; y: number; width: number; height: number };
	headline: string;
	accent: string;
	font?: string;
	durationMs?: number;
}): Scene {
	const duration = opts.durationMs ?? 2200;
	const font = opts.font || "'Inter', system-ui, sans-serif";

	return {
		id: uid(),
		durationMs: duration,
		background: "#000000",
		animatedBgSpeed: 1,
		transition: { type: "fade", durationMs: 400 },
		layers: [
			// Cropped UI element — centered, floating
			{
				id: uid(),
				type: "image",
				startMs: 0,
				endMs: duration,
				position: { x: 12, y: 6 },
				size: { width: 76, height: 68 },
				zIndex: 1,
				entrance: { type: "zoom-in", durationMs: 600, easing: "ease-out", delay: 100 },
				exit: { type: "fade", durationMs: 300, easing: "ease-in", delay: 0 },
				content: {
					src: opts.src,
					fit: "contain",
					borderRadius: 16,
					shadow: true,
					cropRegion: opts.cropRegion,
				},
			},
			// Headline below the card
			{
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: duration,
				position: { x: 10, y: 78 },
				size: { width: 80, height: 15 },
				zIndex: 2,
				entrance: { type: "blur-in", durationMs: 500, easing: "ease-out", delay: 300 },
				exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
				content: {
					text: opts.headline,
					fontSize: 28,
					fontFamily: font,
					fontWeight: "600",
					color: "#ffffff",
					textAlign: "center",
					lineHeight: 1.3,
				},
			},
			// Accent underline
			{
				id: uid(),
				type: "shape",
				startMs: 0,
				endMs: duration,
				position: { x: 42, y: 93 },
				size: { width: 16, height: 0.3 },
				zIndex: 3,
				entrance: { type: "wipe", durationMs: 500, easing: "ease-out", delay: 500 },
				exit: { type: "fade", durationMs: 200, easing: "ease-in", delay: 0 },
				content: {
					shape: "rectangle",
					fill: opts.accent,
				},
			},
		],
	};
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Extract a short headline (3-6 words) from a narration sentence.
 */
function deriveHeadline(narration: string): string {
	if (!narration) return "";
	const words = narration.split(/\s+/);
	if (words.length <= 6) return narration.replace(/[.!,]+$/, "");

	const dashSplit = narration.match(/^([^—–:]+)[—–:]/);
	if (dashSplit && dashSplit[1].split(/\s+/).length <= 7) {
		return dashSplit[1].trim().replace(/[.!,]+$/, "");
	}

	return words
		.slice(0, 5)
		.join(" ")
		.replace(/[.!,]+$/, "");
}

/**
 * Extract a stat (number with prefix/suffix) from narration text.
 */
function extractStat(text: string): { prefix: string; number: string; suffix: string } | null {
	const match = text.match(/(\$?)([\d,]+(?:\.\d+)?)\s*([%xX+KkMmBb]*(?:\/\w+)?)/);
	if (!match) return null;
	return {
		prefix: match[1] || "",
		number: match[2],
		suffix: match[3] || "",
	};
}

/**
 * Best-effort brand color detection from step analysis data.
 * Looks at dominant colors across screenshots and picks the most common
 * non-grey/non-white/non-black color as the primary brand color.
 */
function detectBrandFromSteps(steps: DemoStep[]): BrandInfo {
	const colors: string[] = [];

	for (const step of steps) {
		if (!step.analysis) continue;
		const a = step.analysis;
		if (a.dominantColors) {
			colors.push(...a.dominantColors.map((c) => c.hex));
		}
	}

	// Filter out near-black, near-white, and grey colors
	const brandColors = colors.filter((c) => {
		const rgb = parseHex(c);
		if (!rgb) return false;
		const { r, g, b } = rgb;
		// Skip very dark
		if (r < 30 && g < 30 && b < 30) return false;
		// Skip very light
		if (r > 225 && g > 225 && b > 225) return false;
		// Skip grey (r ≈ g ≈ b within 15)
		const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
		if (maxDiff < 15) return false;
		return true;
	});

	return {
		primaryColor: brandColors[0] || "#2563eb", // Default: Lucid blue
	};
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
	const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
	if (!m) return null;
	return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
