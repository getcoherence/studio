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
			background: "animated-midnight",
			durationMs: 3000,
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
	const { step, analysis, narration, sceneIndex, totalScenes, previousTemplates } = ctx;
	const complexity = analysis?.complexityScore ?? 0.5;
	const hasNumbers = /\d+[%xX+]|\$\d/.test(narration);

	// UI elements from DOM detection (cards, sections, heading groups)
	const els = step.uiElements ?? [];
	const domCards = els.filter((e) => e.type === "card");
	const domSections = els.filter((e) => e.type === "section" || e.type === "heading-group");
	const hasElements = els.length > 0;

	const scores: Record<TemplateId, number> = {
		heroReveal: 0.2,
		deviceMockup: 0.2,
		featureSpotlight: 0.15,
		splitReveal: 0.1,
		offsetCard: 0.4,
		statsBanner: 0.1,
		typingWithImage: 0.35,
		simpleScreenshot: 0.05,
	};

	// ── Position-based scoring ──
	if (sceneIndex === 0) {
		scores.heroReveal += 0.6;
		scores.deviceMockup += 0.3;
	}
	if (sceneIndex === totalScenes - 1) {
		scores.deviceMockup += 0.3;
	}

	// ── DOM element-based scoring (strongest signals) ──
	if (domCards.length >= 2) {
		scores.splitReveal += 0.6; // Two cards → show side by side
		scores.featureSpotlight += 0.3;
	}
	if (domCards.length === 1) {
		scores.featureSpotlight += 0.5; // Single card → spotlight it
		scores.offsetCard += 0.4; // Or offset with headline
	}
	if (domSections.length > 0 && domCards.length === 0) {
		scores.offsetCard += 0.3; // Section without cards → headline + crop
		scores.typingWithImage += 0.3;
	}
	if (!hasElements) {
		scores.deviceMockup += 0.3; // No elements found → show full page in frame
		scores.heroReveal += 0.2;
	}

	// ── Complexity-based scoring ──
	if (complexity > 0.6) {
		scores.deviceMockup += 0.2;
	}
	if (complexity < 0.3) {
		scores.offsetCard += 0.2;
		scores.typingWithImage += 0.2;
	}

	// ── Narration-based scoring ──
	if (hasNumbers) {
		scores.statsBanner += 0.6;
	}

	if (narration.length > 80) {
		scores.offsetCard += 0.2;
		scores.typingWithImage += 0.2;
	}

	// ── Variety enforcement ──
	const prev1 = previousTemplates[previousTemplates.length - 1];
	const prev2 = previousTemplates[previousTemplates.length - 2];

	for (const template of Object.keys(scores) as TemplateId[]) {
		if (template === prev1) scores[template] -= 0.8; // Heavy penalty for immediate repeat
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
	const typingMs = Math.max(2500, Math.min(5000, 1200 + headline.length * 50));

	// UI elements detected in the DOM (cards, sections, heading groups)
	const els = step.uiElements ?? [];
	const cards = els.filter((e) => e.type === "card");
	const sections = els.filter((e) => e.type === "section" || e.type === "heading-group");
	// Best single element: prefer cards, then sections, then sectionBounds crop
	const bestElement = cards[0] ?? sections[0];
	const bestCrop = bestElement?.bounds ?? step.cropRegion;

	switch (template) {
		case "heroReveal":
			return [
				heroReveal({
					screenshotSrc: src,
					narration: "",
					focusPoint,
					durationMs: 3000,
				}),
			];

		case "deviceMockup":
			return [
				deviceMockup({
					screenshotSrc: src,
					narration: headline, // Short headline, not full narration
					background: bg,
					durationMs: 3500,
				}),
			];

		case "featureSpotlight":
			return [
				featureSpotlight({
					screenshotSrc: src,
					narration: headline,
					highlightRegion: bestCrop ?? regionFromFocus(focusPoint),
					durationMs: 3500,
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
					durationMs: 3500,
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
					durationMs: 3500,
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
					durationMs: 3500,
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
					durationMs: 3000,
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

const ALL_BACKGROUNDS = [
	"animated-midnight",
	"animated-aurora",
	"animated-ocean-wave",
	"animated-sunset-flow",
	"animated-neon-pulse",
];

function pickBackground(_analysis: ScreenshotAnalysis | null, sceneIndex: number): string {
	// Rotate through backgrounds by scene index for guaranteed variety
	return ALL_BACKGROUNDS[sceneIndex % ALL_BACKGROUNDS.length];
}
