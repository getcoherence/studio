// ── Quality Gates ───────────────────────────────────────────────────────
//
// Scoring and validation system for scene plans. Prevents the "animated
// PowerPoint" failure mode by evaluating plans across multiple quality
// dimensions before rendering.
//
// Inspired by OpenMontage's slideshow risk scorer, variation checker,
// and delivery promise system.

import type { ScenePlan, ScenePlanItem } from "./scenePlan";

// ── Slideshow Risk Scorer ──────────────────────────────────────────────

export interface SlideshowRiskResult {
	/** Weighted total score 0-10. Higher = worse. */
	score: number;
	/** Verdict based on score thresholds */
	verdict: "pass" | "revise" | "block";
	/** Per-dimension breakdown */
	dimensions: Record<string, { score: number; weight: number; details: string }>;
	/** Actionable suggestions for the AI to fix */
	suggestions: string[];
}

/** Scene types that are primarily text-driven (no rich data/visuals) */
const TEXT_HEAVY_TYPES = new Set([
	"hero-text",
	"impact-word",
	"stacked-text",
	"outline-hero",
	"echo-hero",
	"glitch-intro",
	"cinematic-title",
]);

/** Scene types that have rich data or visual structure */
const RICH_TYPES = new Set([
	"metrics-dashboard",
	"before-after",
	"process-ladder",
	"notification-chaos",
	"chat-narrative",
	"data-flow-network",
	"dashboard-deconstructed",
	"glass-stats",
	"device-showcase",
	"icon-showcase",
	"countdown",
	"contrast-pairs",
	"avatar-constellation",
	"image-crossfade",
]);

/** Scene types that claim cinematic quality */
const CINEMATIC_TYPES = new Set([
	"cinematic-title",
	"camera-text",
	"ghost-hook",
	"product-glow",
	"device-showcase",
]);

/** Animations that are minimal/passive motion */
const WEAK_ANIMATIONS = new Set(["scale", "clip", "none"]);

/**
 * Score a scene plan for slideshow risk across 6 dimensions.
 *
 * Thresholds:
 *   >= 4.0 → BLOCK (do not render, too many issues)
 *   >= 3.0 → REVISE (AI should address flagged issues)
 *   < 3.0  → PASS
 */
export function scoreSlideshowRisk(plan: ScenePlan): SlideshowRiskResult {
	const scenes = plan.scenes;
	if (scenes.length === 0) {
		return {
			score: 0,
			verdict: "pass",
			dimensions: {},
			suggestions: [],
		};
	}

	const suggestions: string[] = [];

	// ── Dimension 1: Repetition (weight 0.20) ──
	const repetitionScore = scoreRepetition(scenes, suggestions);

	// ── Dimension 2: Decorative Visuals (weight 0.15) ──
	const decorativeScore = scoreDecorativeVisuals(scenes, suggestions);

	// ── Dimension 3: Weak Motion (weight 0.20) ──
	const weakMotionScore = scoreWeakMotion(scenes, suggestions);

	// ── Dimension 4: Weak Shot Intent (weight 0.15) ──
	const weakShotScore = scoreWeakShotIntent(scenes, suggestions);

	// ── Dimension 5: Typography Overreliance (weight 0.20) ──
	const typographyScore = scoreTypographyOverreliance(scenes, suggestions);

	// ── Dimension 6: Unsupported Cinematic Claims (weight 0.10) ──
	const cinematicScore = scoreUnsupportedCinematic(scenes, suggestions);

	const dimensions: SlideshowRiskResult["dimensions"] = {
		repetition: { score: repetitionScore, weight: 0.2, details: "" },
		decorative_visuals: { score: decorativeScore, weight: 0.15, details: "" },
		weak_motion: { score: weakMotionScore, weight: 0.2, details: "" },
		weak_shot_intent: { score: weakShotScore, weight: 0.15, details: "" },
		typography_overreliance: { score: typographyScore, weight: 0.2, details: "" },
		unsupported_cinematic: { score: cinematicScore, weight: 0.1, details: "" },
	};

	// Weighted sum → scale to 0-10
	const weightedSum =
		repetitionScore * 0.2 +
		decorativeScore * 0.15 +
		weakMotionScore * 0.2 +
		weakShotScore * 0.15 +
		typographyScore * 0.2 +
		cinematicScore * 0.1;

	const score = Math.round(weightedSum * 100) / 100;

	const verdict: SlideshowRiskResult["verdict"] =
		score >= 4.0 ? "block" : score >= 3.0 ? "revise" : "pass";

	return { score, verdict, dimensions, suggestions };
}

function scoreRepetition(scenes: ScenePlanItem[], suggestions: string[]): number {
	let maxConsecutive = 1;
	let currentRun = 1;

	for (let i = 1; i < scenes.length; i++) {
		if (scenes[i].type === scenes[i - 1].type) {
			currentRun++;
			maxConsecutive = Math.max(maxConsecutive, currentRun);
		} else {
			currentRun = 1;
		}
	}

	// Also check animation repetition
	let maxAnimRun = 1;
	let animRun = 1;
	for (let i = 1; i < scenes.length; i++) {
		if (scenes[i].animation === scenes[i - 1].animation) {
			animRun++;
			maxAnimRun = Math.max(maxAnimRun, animRun);
		} else {
			animRun = 1;
		}
	}

	// Count unique scene types
	const uniqueTypes = new Set(scenes.map((s) => s.type)).size;
	const typeRatio = uniqueTypes / Math.max(scenes.length, 1);

	let score = 0;

	if (maxConsecutive >= 4) {
		score += 6;
		suggestions.push(
			`${maxConsecutive} consecutive scenes use the same type "${scenes.find((_, i) => i > 0 && scenes[i].type === scenes[i - 1].type)?.type}". Break up the repetition with different scene types.`,
		);
	} else if (maxConsecutive >= 3) {
		score += 3;
		suggestions.push(
			"3 consecutive scenes share the same type. Insert a contrasting scene type between them.",
		);
	}

	if (maxAnimRun >= 4) {
		score += 2;
		suggestions.push(
			"Multiple consecutive scenes use the same animation. Vary text animation styles.",
		);
	}

	if (typeRatio < 0.3 && scenes.length >= 5) {
		score += 2;
		suggestions.push(
			`Only ${uniqueTypes} unique scene types across ${scenes.length} scenes. Use more variety.`,
		);
	}

	return Math.min(score, 10);
}

function scoreDecorativeVisuals(scenes: ScenePlanItem[], suggestions: string[]): number {
	// Scenes with no headline content, no data, no clear purpose
	let decorativeCount = 0;
	for (const scene of scenes) {
		const hasContent =
			(scene.headline ?? "").length > 10 ||
			scene.subtitle ||
			scene.metrics?.length ||
			scene.beforeLines?.length ||
			scene.processSteps?.length ||
			scene.chatMessages?.length ||
			scene.notifications?.length ||
			scene.contrastPairs?.length ||
			scene.iconItems?.length ||
			// Text-layout scenes where content lives in stackedLines / scrollingListLines etc.
			scene.stackedLines?.length ||
			scene.scrollingListLines?.length ||
			scene.cameraTextWords?.length ||
			scene.slotMachineWords?.length ||
			scene.cards?.length;

		if (!hasContent && !RICH_TYPES.has(scene.type)) {
			decorativeCount++;
		}
	}

	const ratio = decorativeCount / Math.max(scenes.length, 1);
	if (ratio > 0.4) {
		suggestions.push(
			`${decorativeCount} of ${scenes.length} scenes lack meaningful content. Add data, comparisons, or substance.`,
		);
		return 7;
	}
	if (ratio > 0.2) {
		suggestions.push(
			"Several scenes feel decorative. Ensure each scene communicates something specific.",
		);
		return 4;
	}
	return ratio * 10;
}

function scoreWeakMotion(scenes: ScenePlanItem[], suggestions: string[]): number {
	let weakCount = 0;
	for (const scene of scenes) {
		const hasWeakAnimation = WEAK_ANIMATIONS.has(scene.animation);
		const hasNoEffect = !scene.backgroundEffect || scene.backgroundEffect === "none";
		const hasNoLottie = !scene.lottieOverlay && !scene.lottieBackground;
		const hasNoVideo = !scene.videoPrompt && !scene.videoClipPath;

		if (hasWeakAnimation && hasNoEffect && hasNoLottie && hasNoVideo) {
			weakCount++;
		}
	}

	const ratio = weakCount / Math.max(scenes.length, 1);
	if (ratio > 0.6) {
		suggestions.push(
			`${weakCount} of ${scenes.length} scenes have minimal motion. Add background effects, stronger animations, or Lottie overlays.`,
		);
		return 8;
	}
	if (ratio > 0.4) {
		suggestions.push(
			"Many scenes lack visual motion. Add backgroundEffect or use more dynamic animations.",
		);
		return 5;
	}
	return ratio * 8;
}

function scoreWeakShotIntent(scenes: ScenePlanItem[], suggestions: string[]): number {
	// Check if scenes have clear narrative purpose via shotIntent or meaningful sequencing
	let aimlessCount = 0;

	for (const scene of scenes) {
		const hasIntent = scene.shotIntent?.narrativeRole || scene.shotIntent?.informationRole;
		const hasClearPurpose =
			scene.type === "cta" ||
			scene.type === "before-after" ||
			scene.type === "metrics-dashboard" ||
			scene.type === "process-ladder" ||
			scene.type === "countdown" ||
			scene.type === "contrast-pairs";

		if (!hasIntent && !hasClearPurpose && TEXT_HEAVY_TYPES.has(scene.type)) {
			aimlessCount++;
		}
	}

	const ratio = aimlessCount / Math.max(scenes.length, 1);
	if (ratio > 0.5) {
		suggestions.push(
			"Over half the scenes have no clear narrative purpose. Add shotIntent.narrativeRole (hook, problem, solution, evidence, cta) to guide the visual treatment.",
		);
		return 6;
	}
	return ratio * 8;
}

function scoreTypographyOverreliance(scenes: ScenePlanItem[], suggestions: string[]): number {
	const textHeavyCount = scenes.filter((s) => TEXT_HEAVY_TYPES.has(s.type)).length;
	const ratio = textHeavyCount / Math.max(scenes.length, 1);

	if (ratio > 0.7) {
		suggestions.push(
			`${textHeavyCount} of ${scenes.length} scenes are text-only. Replace some with data visualizations, comparisons, or rich scene types.`,
		);
		return 8;
	}
	if (ratio > 0.5) {
		suggestions.push(
			"Majority of scenes are text-heavy. Balance with metrics-dashboard, before-after, process-ladder, or other data-driven types.",
		);
		return 5;
	}
	return ratio * 7;
}

function scoreUnsupportedCinematic(scenes: ScenePlanItem[], suggestions: string[]): number {
	const cinematicCount = scenes.filter((s) => CINEMATIC_TYPES.has(s.type)).length;
	const hasEffects = scenes.filter(
		(s) => s.backgroundEffect && s.backgroundEffect !== "none",
	).length;
	const hasVariety = new Set(scenes.map((s) => s.type)).size >= scenes.length * 0.5;

	if (cinematicCount >= 3 && hasEffects < 2 && !hasVariety) {
		suggestions.push(
			"Multiple cinematic scene types used but without supporting visual richness. Add background effects, transitions, and scene variety to earn the cinematic label.",
		);
		return 7;
	}
	if (cinematicCount >= 2 && hasEffects < 1) {
		return 4;
	}
	return 0;
}

// ── Variation Checker ──────────────────────────────────────────────────

export interface VariationResult {
	passed: boolean;
	violations: Array<{
		rule: string;
		sceneIndices: number[];
		suggestion: string;
	}>;
}

/**
 * Check a scene plan for sufficient variation across scene types,
 * animations, backgrounds, effects, and transitions.
 */
export function checkVariation(plan: ScenePlan): VariationResult {
	const scenes = plan.scenes;
	const violations: VariationResult["violations"] = [];

	if (scenes.length < 3) {
		return { passed: true, violations: [] };
	}

	// Rule 1: No 3+ consecutive same type
	checkConsecutiveField(scenes, "type", 3, "scene type", violations);

	// Rule 2: No 3+ consecutive same animation
	checkConsecutiveField(scenes, "animation", 3, "animation style", violations);

	// Rule 3: No 3+ consecutive same background
	checkConsecutiveBackground(scenes, violations);

	// Rule 4: No 4+ consecutive scenes without backgroundEffect
	checkEffectGaps(scenes, violations);

	// Rule 5: At least 2 different transition types (if plan has 4+ scenes)
	if (scenes.length >= 4) {
		const transitions = new Set(
			scenes
				.filter((s) => s.transitionOut && s.transitionOut !== "cut")
				.map((s) => s.transitionOut),
		);
		if (transitions.size < 2) {
			violations.push({
				rule: "transition_variety",
				sceneIndices: [],
				suggestion:
					"Use at least 2 different transition types. Mix energy levels (fade for calm, striped-slam for impact).",
			});
		}
	}

	// Rule 6: Warn if all scenes use the same font
	const fonts = new Set(scenes.map((s) => s.font));
	if (fonts.size === 1 && scenes.length >= 5) {
		violations.push({
			rule: "font_monotony",
			sceneIndices: [],
			suggestion: `All ${scenes.length} scenes use "${scenes[0].font}". Consider mixing in a contrasting font for emphasis scenes.`,
		});
	}

	return { passed: violations.length === 0, violations };
}

function checkConsecutiveField(
	scenes: ScenePlanItem[],
	field: keyof ScenePlanItem,
	maxRun: number,
	label: string,
	violations: VariationResult["violations"],
) {
	let run = 1;
	for (let i = 1; i < scenes.length; i++) {
		if (scenes[i][field] === scenes[i - 1][field]) {
			run++;
			if (run >= maxRun) {
				violations.push({
					rule: `consecutive_${field}`,
					sceneIndices: Array.from({ length: run }, (_, j) => i - run + 1 + j),
					suggestion: `${run} consecutive scenes use the same ${label} "${String(scenes[i][field])}". Insert a different ${label} to break the pattern.`,
				});
			}
		} else {
			run = 1;
		}
	}
}

function checkConsecutiveBackground(
	scenes: ScenePlanItem[],
	violations: VariationResult["violations"],
) {
	let run = 1;
	for (let i = 1; i < scenes.length; i++) {
		const prev = normalizeBackground(scenes[i - 1].background);
		const curr = normalizeBackground(scenes[i].background);
		if (prev === curr) {
			run++;
			if (run >= 3) {
				violations.push({
					rule: "consecutive_background",
					sceneIndices: Array.from({ length: run }, (_, j) => i - run + 1 + j),
					suggestion: `${run} consecutive scenes use similar backgrounds. Alternate between dark/light or use different gradient directions.`,
				});
			}
		} else {
			run = 1;
		}
	}
}

/** Normalize background to a family for comparison (e.g. all dark solids are "dark") */
function normalizeBackground(bg: string): string {
	if (!bg) return "unknown";
	// Exact match
	if (bg.startsWith("#")) {
		const r = Number.parseInt(bg.slice(1, 3), 16);
		const g = Number.parseInt(bg.slice(3, 5), 16);
		const b = Number.parseInt(bg.slice(5, 7), 16);
		const luminance = (r * 299 + g * 587 + b * 114) / 1000;
		return luminance < 60 ? "dark-solid" : luminance > 200 ? "light-solid" : "mid-solid";
	}
	if (bg.includes("linear-gradient")) {
		return bg.includes("#0") || bg.includes("#1") ? "dark-gradient" : "light-gradient";
	}
	return bg;
}

function checkEffectGaps(scenes: ScenePlanItem[], violations: VariationResult["violations"]) {
	let gap = 0;
	for (let i = 0; i < scenes.length; i++) {
		if (!scenes[i].backgroundEffect || scenes[i].backgroundEffect === "none") {
			gap++;
			if (gap >= 4) {
				violations.push({
					rule: "effect_desert",
					sceneIndices: Array.from({ length: gap }, (_, j) => i - gap + 1 + j),
					suggestion: `${gap} consecutive scenes have no background effects. Add at least one particle overlay, animated gradient, or visual effect to break the flatness.`,
				});
			}
		} else {
			gap = 0;
		}
	}
}

// ── Delivery Promise ───────────────────────────────────────────────────

export type DeliveryPromiseType =
	| "motion_led"
	| "data_explainer"
	| "source_led"
	| "hybrid_motion"
	| "text_narrative";

export interface DeliveryPromise {
	type: DeliveryPromiseType;
	/** Minimum % of scenes that must have real animation (effects, video, lottie) */
	minimumMotionRatio: number;
	/** Minimum % of scenes with backgroundEffect or particles */
	minimumEffectCoverage: number;
	/** Minimum number of distinct scene types */
	minimumTypeVariety: number;
}

const PROMISE_REQUIREMENTS: Record<DeliveryPromiseType, Omit<DeliveryPromise, "type">> = {
	motion_led: { minimumMotionRatio: 0.7, minimumEffectCoverage: 0.5, minimumTypeVariety: 4 },
	data_explainer: { minimumMotionRatio: 0.5, minimumEffectCoverage: 0.3, minimumTypeVariety: 3 },
	source_led: { minimumMotionRatio: 0.3, minimumEffectCoverage: 0.2, minimumTypeVariety: 2 },
	hybrid_motion: { minimumMotionRatio: 0.5, minimumEffectCoverage: 0.4, minimumTypeVariety: 3 },
	text_narrative: { minimumMotionRatio: 0.3, minimumEffectCoverage: 0.2, minimumTypeVariety: 3 },
};

/**
 * Classify what a scene plan promises to deliver based on its content.
 */
export function classifyPromise(plan: ScenePlan): DeliveryPromise {
	const scenes = plan.scenes;
	const dataScenes = scenes.filter(
		(s) =>
			s.metrics?.length ||
			s.processSteps?.length ||
			s.contrastPairs?.length ||
			s.dashboardMetrics?.length,
	).length;
	const sourceScenes = scenes.filter(
		(s) => s.screenshotIndex !== undefined || s.videoClipPath,
	).length;
	const videoScenes = scenes.filter((s) => s.videoPrompt).length;

	const dataRatio = dataScenes / Math.max(scenes.length, 1);
	const sourceRatio = sourceScenes / Math.max(scenes.length, 1);

	let type: DeliveryPromiseType;

	if (videoScenes >= 2 || scenes.filter((s) => s.backgroundEffect).length / scenes.length > 0.6) {
		type = "motion_led";
	} else if (dataRatio > 0.4) {
		type = "data_explainer";
	} else if (sourceRatio > 0.4) {
		type = "source_led";
	} else if (videoScenes >= 1 || sourceScenes >= 1) {
		type = "hybrid_motion";
	} else {
		type = "text_narrative";
	}

	return { type, ...PROMISE_REQUIREMENTS[type] };
}

/**
 * Validate that a scene plan honors its delivery promise.
 */
export function validatePromise(
	plan: ScenePlan,
	promise: DeliveryPromise,
): { honored: boolean; violations: string[] } {
	const scenes = plan.scenes;
	const violations: string[] = [];

	// Check motion ratio
	const motionScenes = scenes.filter((s) => {
		const hasEffect = s.backgroundEffect && s.backgroundEffect !== "none";
		const hasLottie = s.lottieOverlay || s.lottieBackground;
		const hasVideo = s.videoPrompt || s.videoClipPath;
		const hasStrongAnimation = !WEAK_ANIMATIONS.has(s.animation);
		return hasEffect || hasLottie || hasVideo || hasStrongAnimation;
	}).length;
	const motionRatio = motionScenes / Math.max(scenes.length, 1);

	if (motionRatio < promise.minimumMotionRatio) {
		violations.push(
			`Motion ratio ${(motionRatio * 100).toFixed(0)}% is below the ${(promise.minimumMotionRatio * 100).toFixed(0)}% minimum for "${promise.type}" videos. Add background effects, Lottie overlays, or stronger animations.`,
		);
	}

	// Check effect coverage
	const effectScenes = scenes.filter(
		(s) => s.backgroundEffect && s.backgroundEffect !== "none",
	).length;
	const effectRatio = effectScenes / Math.max(scenes.length, 1);

	if (effectRatio < promise.minimumEffectCoverage) {
		violations.push(
			`Effect coverage ${(effectRatio * 100).toFixed(0)}% is below the ${(promise.minimumEffectCoverage * 100).toFixed(0)}% minimum. Add backgroundEffect to more scenes.`,
		);
	}

	// Check type variety
	const uniqueTypes = new Set(scenes.map((s) => s.type)).size;
	if (uniqueTypes < promise.minimumTypeVariety) {
		violations.push(
			`Only ${uniqueTypes} unique scene types, need at least ${promise.minimumTypeVariety} for "${promise.type}" videos.`,
		);
	}

	return { honored: violations.length === 0, violations };
}

// ── Choreography Audit ────────────────────────────────────────────────
//
// Post-generation timing analysis. Flags dead zones, simultaneous
// entrances, narration/visual misalignment, and stagger gaps.

export interface ChoreographyIssue {
	sceneIndex: number;
	severity: "warning" | "error";
	type:
		| "dead-zone"
		| "simultaneous-entrance"
		| "narration-overflow"
		| "narration-gap"
		| "stagger-missing"
		| "sfx-overflow";
	suggestion: string;
}

export interface ChoreographyResult {
	issues: ChoreographyIssue[];
	suggestions: string[];
}

const ANIMATION_SETTLE_FRAMES: Record<string, number> = {
	chars: 45,
	words: 36,
	scale: 24,
	clip: 20,
	gradient: 30,
	glitch: 28,
	"blur-in": 24,
	bounce: 36,
	wave: 40,
	typewriter: 60,
	staccato: 30,
	split: 28,
	drop: 30,
	scramble: 40,
	matrix: 50,
	"rotate-3d": 30,
	"glitch-in": 24,
	"mask-reveal": 30,
	none: 0,
};

export function auditChoreography(plan: ScenePlan): ChoreographyResult {
	const scenes = plan.scenes;
	const issues: ChoreographyIssue[] = [];

	for (let i = 0; i < scenes.length; i++) {
		const scene = scenes[i];
		const dur = scene.durationFrames || 90;
		const layers = scene.layers || [];

		// 1. Dead zone: scene too short for its animation to settle
		const settleFrames = ANIMATION_SETTLE_FRAMES[scene.animation] || 24;
		const headlineLen = (scene.headline || "").length;
		const readingFrames = Math.ceil(headlineLen * 1.2);
		const minUseful = settleFrames + readingFrames;
		if (dur < minUseful && dur < 60) {
			issues.push({
				sceneIndex: i,
				severity: "warning",
				type: "dead-zone",
				suggestion: `Scene ${i + 1} "${scene.headline?.slice(0, 30)}" is ${dur} frames but animation + reading needs ~${minUseful}. Extend to at least ${Math.max(60, minUseful)} frames.`,
			});
		}

		// 2. Simultaneous entrance: multiple layers start at frame 0 with no stagger
		const frame0Layers = layers.filter(
			(l) => l.startFrame === 0 && !l.id?.startsWith("lottie-") && !(l as any)._incompatible,
		);
		if (frame0Layers.length >= 3) {
			const hasStagger = frame0Layers.some((l) => (l as any).settings?.stagger > 0);
			if (!hasStagger) {
				issues.push({
					sceneIndex: i,
					severity: "warning",
					type: "simultaneous-entrance",
					suggestion: `Scene ${i + 1} has ${frame0Layers.length} layers all entering at frame 0 with no stagger. Add stagger or offset startFrame by 4-8 frames between layers.`,
				});
			}
		}

		// 3. Stagger missing: text-heavy scenes with 2+ text layers and no timing spread
		const textLayers = layers.filter((l) => l.type === "text" && !(l as any)._incompatible);
		if (textLayers.length >= 2) {
			const starts = textLayers.map((l) => l.startFrame);
			const allSame = starts.every((s) => s === starts[0]);
			if (allSame) {
				issues.push({
					sceneIndex: i,
					severity: "warning",
					type: "stagger-missing",
					suggestion: `Scene ${i + 1} has ${textLayers.length} text layers all starting at frame ${starts[0]}. Stagger by 6-12 frames for visual rhythm.`,
				});
			}
		}

		// 4. Narration overflow: narration extends past scene boundary
		if (scene.narrationDurationMs && scene.narrationDurationMs > 0) {
			const narrationFrames = Math.ceil((scene.narrationDurationMs / 1000) * 30);
			const headroom = 6 + 30;
			if (narrationFrames + headroom > dur) {
				const overflowMs = Math.round(((narrationFrames + headroom - dur) / 30) * 1000);
				issues.push({
					sceneIndex: i,
					severity: "error",
					type: "narration-overflow",
					suggestion: `Scene ${i + 1} narration (${Math.round(scene.narrationDurationMs / 1000)}s) overflows scene by ${overflowMs}ms. Extend scene to ${narrationFrames + headroom} frames or shorten narration text.`,
				});
			}
		}

		// 5. Narration gap: scene has no narration but neighbors do (orphaned silence)
		if (plan.hasNarration && !scene.narration && scenes.length > 2) {
			const prevHas = i > 0 && !!scenes[i - 1].narration;
			const nextHas = i < scenes.length - 1 && !!scenes[i + 1].narration;
			if (prevHas && nextHas) {
				issues.push({
					sceneIndex: i,
					severity: "warning",
					type: "narration-gap",
					suggestion: `Scene ${i + 1} "${scene.headline?.slice(0, 30)}" has no narration but is between two narrated scenes. This creates an awkward silence gap.`,
				});
			}
		}

		// 6. SFX overflow: cue extends past scene boundary
		const cues = (scene as any).sfxCues as
			| Array<{ sfx: string; atFrame: number; durationSec?: number }>
			| undefined;
		if (cues) {
			for (const cue of cues) {
				const sfxEnd = cue.atFrame + Math.round((cue.durationSec ?? 1.5) * 30);
				if (sfxEnd > dur) {
					issues.push({
						sceneIndex: i,
						severity: "warning",
						type: "sfx-overflow",
						suggestion: `Scene ${i + 1} SFX "${cue.sfx?.slice(0, 20)}" at frame ${cue.atFrame} extends ${sfxEnd - dur} frames past scene end.`,
					});
				}
			}
		}
	}

	return {
		issues,
		suggestions: issues.map((iss) => iss.suggestion),
	};
}

// ── Combined Quality Check ─────────────────────────────────────────────

export interface QualityCheckResult {
	/** Overall pass/fail */
	passed: boolean;
	/** Slideshow risk assessment */
	slideshowRisk: SlideshowRiskResult;
	/** Variation check */
	variation: VariationResult;
	/** Delivery promise validation */
	deliveryPromise: DeliveryPromise;
	deliveryHonored: { honored: boolean; violations: string[] };
	/** Choreography timing audit */
	choreography: ChoreographyResult;
	/** All suggestions combined */
	allSuggestions: string[];
}

/**
 * Run all quality gates on a scene plan.
 * Returns a combined result with overall pass/fail.
 */
export function checkQuality(plan: ScenePlan): QualityCheckResult {
	const slideshowRisk = scoreSlideshowRisk(plan);
	const variation = checkVariation(plan);
	const deliveryPromise = classifyPromise(plan);
	const deliveryHonored = validatePromise(plan, deliveryPromise);
	const choreography = auditChoreography(plan);

	const allSuggestions = [
		...slideshowRisk.suggestions,
		...variation.violations.map((v) => v.suggestion),
		...deliveryHonored.violations,
		...choreography.suggestions,
	];

	const passed = slideshowRisk.verdict === "pass" && variation.passed && deliveryHonored.honored;

	return {
		passed,
		slideshowRisk,
		variation,
		deliveryPromise,
		deliveryHonored,
		choreography,
		allSuggestions,
	};
}
