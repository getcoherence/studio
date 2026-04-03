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
		const analysis = step.analysis ?? null;
		const focusPoint = step.focusPoint ?? analysis?.saliencyPeak ?? { x: 0.5, y: 0.4 };

		const { scenes: stepScenes, templateUsed } = composeStep({
			step,
			analysis,
			narration,
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
	const { analysis, narration, sceneIndex, totalScenes, previousTemplates } = ctx;
	const regions = analysis?.uiRegions ?? [];
	const contentRegions = regions.filter((r) => r.type !== "nav" && r.type !== "footer");
	const cards = contentRegions.filter((r) => r.type === "card");
	const complexity = analysis?.complexityScore ?? 0.5;
	const hasNumbers = /\d+[%xX+]|\$\d/.test(narration);
	const isLongNarration = narration.length > 80;

	const scores: Record<TemplateId, number> = {
		heroReveal: 0.2,
		deviceMockup: 0.25,
		featureSpotlight: 0.15,
		splitReveal: 0.1,
		offsetCard: 0.45, // Text + image — most polished template
		statsBanner: 0.1,
		typingWithImage: 0.4, // Text + image — good variety
		simpleScreenshot: 0.05, // Last resort
	};

	// ── Position-based scoring ──
	if (sceneIndex === 0) {
		scores.heroReveal += 0.6; // First screenshot = establishing shot
		scores.deviceMockup += 0.3;
	}
	if (sceneIndex === totalScenes - 1) {
		scores.deviceMockup += 0.3; // Last scene: show the full product
		scores.heroReveal += 0.2;
	}

	// ── Analysis-based scoring ──
	if (
		contentRegions.length === 1 &&
		contentRegions[0].area > 0.05 &&
		contentRegions[0].area < 0.5
	) {
		scores.featureSpotlight += 0.5; // Single prominent region → spotlight it
		scores.offsetCard += 0.3;
	}

	if (cards.length >= 2) {
		scores.splitReveal += 0.5; // Multiple cards → show side by side
		scores.featureSpotlight += 0.2;
	}

	if (complexity > 0.6) {
		scores.deviceMockup += 0.3; // Complex pages look good in device frame
		scores.heroReveal += 0.2;
	}

	if (complexity < 0.3) {
		scores.offsetCard += 0.3; // Simple pages: offset with text
		scores.typingWithImage += 0.2;
	}

	// ── Narration-based scoring ──
	if (hasNumbers) {
		scores.statsBanner += 0.6; // Numbers → big stat display
	}

	if (isLongNarration) {
		scores.offsetCard += 0.3; // Long text needs space
		scores.typingWithImage += 0.3;
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
	const { step, analysis, narration, focusPoint } = ctx;
	const src = step.screenshotDataUrl!;
	const regions = (analysis?.uiRegions ?? []).filter(
		(r) => r.type !== "nav" && r.type !== "footer",
	);
	// Prefer smaller focused regions for spotlights/crops (skip huge page-wide sections)
	const focusedRegions = regions.filter((r) => r.area < 0.4);
	const bestRegion = focusedRegions[0] ?? regions[0];
	const bg = pickBackground(analysis, ctx.sceneIndex);
	const typingMs = Math.max(2500, Math.min(5000, 1200 + narration.length * 35));

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
					narration,
					background: bg,
					durationMs: 3500,
				}),
			];

		case "featureSpotlight":
			return [
				featureSpotlight({
					screenshotSrc: src,
					narration,
					highlightRegion: bestRegion?.bounds ?? regionFromFocus(focusPoint),
					durationMs: 3500,
				}),
			];

		case "splitReveal": {
			const left = regions[0]?.bounds ?? { x: 0.05, y: 0.1, width: 0.4, height: 0.6 };
			const right = regions[1]?.bounds ?? { x: 0.55, y: 0.1, width: 0.4, height: 0.6 };
			return [
				splitReveal({
					screenshotSrc: src,
					narration,
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
					narration,
					side,
					// Use section crop if detected, otherwise show full screenshot
					cropRegion: step.cropRegion,
					background: bg,
					durationMs: 3500,
				}),
			];
		}

		case "statsBanner":
			return [
				statsBanner({
					screenshotSrc: src,
					narration,
					cropRegion: step.cropRegion,
					background: bg,
					durationMs: 3500,
				}),
			];

		case "typingWithImage":
			return [
				typingSequence({
					text: narration || "…",
					durationMs: typingMs,
					background: bg,
					featureImage: {
						src,
						cropRegion: step.cropRegion ?? { x: 0, y: 0, width: 1, height: 1 },
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
