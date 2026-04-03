// ── Composition Engine ───────────────────────────────────────────────────
//
// Replaces the hardcoded buildSceneProject() with intelligent, analysis-driven
// template selection. Uses OpenCV analysis data (saliency, UI regions, colors,
// complexity) to pick the best composition for each scene, with variety
// enforcement to ensure no two consecutive scenes look the same.

import type { DemoStep } from "@/components/demo-studio/types";
import type { ScreenshotAnalysis } from "@/lib/cv/types";
import type { Scene, SceneProject } from "@/lib/scene-renderer/types";
import {
	deviceMockup,
	featureSpotlight,
	heroReveal,
	offsetCard,
	simpleScreenshot,
	splitReveal,
	statsBanner,
	titleCard,
	typingSequence,
} from "./compositionTemplates";

// ── Template IDs ─────────────────────────────────────────────────────────

type TemplateId =
	| "textOnly"
	| "heroReveal"
	| "deviceMockup"
	| "featureSpotlight"
	| "splitReveal"
	| "offsetCard"
	| "statsBanner"
	| "typingWithImage"
	| "simpleScreenshot";

// ── Main entry point ─────────────────────────────────────────────────────

let _uid = 1;
function uid(): string {
	return `proj-${Date.now()}-${_uid++}`;
}

/**
 * Build a complete SceneProject from DemoSteps with analysis data.
 * Replaces the hardcoded buildSceneProject() in DemoStudioPage.tsx.
 */
export function composeProject(steps: DemoStep[], opts?: { title?: string }): SceneProject {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const scenes: Scene[] = [];
	const videoTitle = opts?.title || "Product Demo";

	// ── Opening hook ──
	scenes.push(
		titleCard({
			title: videoTitle,
			background: "#000000",
			durationMs: 2000,
		}),
	);

	// ── Compose each step ──
	const usedTemplates: TemplateId[] = [];

	for (let i = 0; i < stepsWithScreenshots.length; i++) {
		const step = stepsWithScreenshots[i];
		if (!step.screenshotDataUrl) continue;

		const narration = step.action.narration || "";
		const headline = step.headline || deriveHeadline(narration);
		const analysis = step.analysis ?? null;
		const focusPoint = step.focusPoint ?? analysis?.saliencyPeak ?? { x: 0.5, y: 0.4 };

		const { scenes: stepScenes, templateUsed } = composeStep({
			step,
			analysis,
			narration,
			headline,
			focusPoint,
			sceneIndex: i,
			totalScenes: stepsWithScreenshots.length,
			previousTemplates: usedTemplates,
		});

		scenes.push(...stepScenes);
		usedTemplates.push(templateUsed);
	}

	return {
		id: uid(),
		name: videoTitle,
		scenes,
		resolution: { width: 1920, height: 1080 },
		fps: 30,
	};
}

// ── Per-step composition ─────────────────────────────────────────────────

interface ComposeContext {
	step: DemoStep;
	analysis: ScreenshotAnalysis | null;
	narration: string;
	headline: string;
	focusPoint: { x: number; y: number };
	sceneIndex: number;
	totalScenes: number;
	previousTemplates: TemplateId[];
}

function composeStep(ctx: ComposeContext): {
	scenes: Scene[];
	templateUsed: TemplateId;
} {
	const scores = scoreTemplates(ctx);

	// Pick the highest-scoring template
	let bestTemplate: TemplateId = "simpleScreenshot";
	let bestScore = -1;
	for (const [template, score] of Object.entries(scores)) {
		if (score > bestScore) {
			bestScore = score;
			bestTemplate = template as TemplateId;
		}
	}

	const scenes = generateScenes(bestTemplate, ctx);
	return { scenes, templateUsed: bestTemplate };
}

// ── Template scoring ─────────────────────────────────────────────────────

function scoreTemplates(ctx: ComposeContext): Record<TemplateId, number> {
	const { step, narration, sceneIndex, totalScenes, previousTemplates } = ctx;
	const hasNumbers = /\d+[%xX+]|\$\d/.test(narration);
	const els = step.uiElements ?? [];
	const domCards = els.filter((e) => e.type === "card");

	// TEXT-FIRST PHILOSOPHY: Most scenes should be text-only on black.
	// Screenshots appear only at key moments (first, middle feature, last).
	const scores: Record<TemplateId, number> = {
		textOnly: 0.7, // DEFAULT: bold headline on black
		heroReveal: 0.1,
		deviceMockup: 0.15,
		featureSpotlight: 0.1,
		splitReveal: 0.05,
		offsetCard: 0.25,
		statsBanner: 0.1,
		typingWithImage: 0.2,
		simpleScreenshot: 0.0,
	};

	// ── Key screenshot moments ──
	// Scene 0: always hero reveal (establishing shot)
	if (sceneIndex === 0) {
		scores.heroReveal += 0.8;
		scores.textOnly -= 0.5;
	}
	// Last scene: device mockup (closing product shot)
	if (sceneIndex === totalScenes - 1) {
		scores.deviceMockup += 0.6;
		scores.textOnly -= 0.3;
	}
	// Middle feature scene: if cards detected, show them
	const isMidpoint = sceneIndex === Math.floor(totalScenes / 2);
	if (isMidpoint && domCards.length >= 1) {
		scores.offsetCard += 0.5;
		scores.featureSpotlight += 0.4;
		scores.textOnly -= 0.3;
	}
	// If cards detected and we haven't shown a screenshot recently
	const recentHasScreenshot = previousTemplates
		.slice(-2)
		.some((t) => t !== "textOnly" && t !== "statsBanner");
	if (domCards.length >= 2 && !recentHasScreenshot) {
		scores.splitReveal += 0.5;
		scores.textOnly -= 0.2;
	}

	// ── Narration-based ──
	if (hasNumbers) {
		scores.statsBanner += 0.5;
		scores.textOnly -= 0.2;
	}

	// ── Variety enforcement ──
	const prev1 = previousTemplates[previousTemplates.length - 1];
	const prev2 = previousTemplates[previousTemplates.length - 2];

	for (const template of Object.keys(scores) as TemplateId[]) {
		if (template === prev1) scores[template] -= 0.6;
		if (template === prev2) scores[template] -= 0.3;
		if (template === prev2) scores[template] -= 0.4; // Moderate penalty for near-repeat
	}

	// Ensure no negative scores
	for (const key of Object.keys(scores) as TemplateId[]) {
		scores[key] = Math.max(0, scores[key]);
	}

	return scores;
}

// ── Scene generation ─────────────────────────────────────────────────────

function generateScenes(template: TemplateId, ctx: ComposeContext): Scene[] {
	const { step, analysis, narration, headline, focusPoint } = ctx;
	const src = step.screenshotDataUrl!;
	const bg = pickBackground(analysis, ctx.sceneIndex);
	// Fast pacing — headlines are short (3-6 words), don't need long scenes
	const typingMs = Math.max(1800, Math.min(3000, 800 + headline.length * 40));

	// UI elements detected in the DOM (cards, sections, heading groups)
	const els = step.uiElements ?? [];
	const cards = els.filter((e) => e.type === "card");
	const sections = els.filter((e) => e.type === "section" || e.type === "heading-group");
	// Best single element: prefer cards, then sections, then sectionBounds crop
	const bestElement = cards[0] ?? sections[0];
	const bestCrop = bestElement?.bounds ?? step.cropRegion;

	switch (template) {
		case "textOnly":
			return [
				titleCard({
					title: headline,
					background: "#000000",
					durationMs: typingMs,
				}),
			];

		case "heroReveal":
			return [
				heroReveal({
					screenshotSrc: src,
					narration: "",
					focusPoint,
					durationMs: 2000,
				}),
			];

		case "deviceMockup":
			return [
				deviceMockup({
					screenshotSrc: src,
					narration: headline, // Short headline, not full narration
					background: bg,
					durationMs: 2500,
				}),
			];

		case "featureSpotlight":
			return [
				featureSpotlight({
					screenshotSrc: src,
					narration: headline,
					highlightRegion: bestCrop ?? regionFromFocus(focusPoint),
					durationMs: 2500,
				}),
			];

		case "splitReveal": {
			// Use two detected cards if available, otherwise split viewport
			const left = cards[0]?.bounds ?? { x: 0.02, y: 0.1, width: 0.45, height: 0.6 };
			const right = cards[1]?.bounds ?? { x: 0.52, y: 0.1, width: 0.45, height: 0.6 };
			return [
				splitReveal({
					screenshotSrc: src,
					narration: headline,
					leftRegion: left,
					rightRegion: right,
					background: bg,
					durationMs: 2500,
				}),
			];
		}

		case "offsetCard": {
			const side = ctx.sceneIndex % 2 === 0 ? "right" : "left";
			return [
				offsetCard({
					screenshotSrc: src,
					narration: headline,
					side,
					cropRegion: bestCrop, // Crop to specific card/element, not full page
					background: bg,
					durationMs: 2500,
				}),
			];
		}

		case "statsBanner":
			return [
				statsBanner({
					screenshotSrc: src,
					narration: headline,
					cropRegion: bestCrop,
					background: bg,
					durationMs: 2500,
				}),
			];

		case "typingWithImage":
			return [
				typingSequence({
					text: headline || "…",
					durationMs: typingMs,
					background: bg,
					featureImage: {
						src,
						cropRegion: bestCrop ?? { x: 0, y: 0, width: 1, height: 1 },
					},
				}),
			];

		case "simpleScreenshot":
		default:
			return [
				simpleScreenshot({
					screenshotSrc: src,
					narration,
					durationMs: 2000,
				}),
			];
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract a short headline (3-6 words) from a narration sentence.
 * Used as fallback when the AI doesn't provide a headline field.
 */
function deriveHeadline(narration: string): string {
	if (!narration) return "";
	// If already short enough, use as-is
	const words = narration.split(/\s+/);
	if (words.length <= 6) return narration.replace(/[.!,]+$/, "");

	// Try to extract a meaningful fragment:
	// 1. Text before a dash/colon (often the key phrase)
	const dashSplit = narration.match(/^([^—–:]+)[—–:]/);
	if (dashSplit && dashSplit[1].split(/\s+/).length <= 7) {
		return dashSplit[1].trim().replace(/[.!,]+$/, "");
	}

	// 2. First 5 words, cleaned up
	return words
		.slice(0, 5)
		.join(" ")
		.replace(/[.!,]+$/, "");
}

function regionFromFocus(fp: { x: number; y: number }) {
	const w = 0.8;
	const h = 0.75;
	return {
		x: Math.max(0, Math.min(1 - w, fp.x - w / 2)),
		y: Math.max(0, Math.min(1 - h, fp.y - h / 2)),
		width: w,
		height: h,
	};
}

// Alternate between clean solid backgrounds and subtle animated ones
// Inspired by Adaptive.ai video: mostly black/white with occasional color
const BACKGROUNDS = [
	"#000000",
	"animated-midnight",
	"#09090b",
	"animated-aurora",
	"#000000",
	"animated-ocean-wave",
	"#09090b",
	"animated-sunset-flow",
];

function pickBackground(_analysis: ScreenshotAnalysis | null, sceneIndex: number): string {
	return BACKGROUNDS[sceneIndex % BACKGROUNDS.length];
}
