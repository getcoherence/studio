// ── Shared Compile Code ─────────────────────────────────────────────────
//
// Extracts the JIT compilation logic so both the interactive Player
// (DynamicComposition) and the headless SSR pipeline (Remotion renderer)
// use the exact same MODULE_SCOPE and compileCode() function.

import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import {
	AbsoluteFill,
	Audio,
	Easing,
	Img,
	interpolate,
	Loop,
	OffthreadVideo,
	random,
	Sequence,
	Series,
	spring,
	useCurrentFrame,
	useVideoConfig,
	Video,
} from "remotion";
import { transform } from "sucrase";
import { AudioPulse, BeatDot, useAudioPulse } from "./helpers/AudioReactive";
import {
	AnimatedBackground,
	AnimatedText,
	AvatarConstellation,
	BackgroundVideo,
	BlurredUI,
	ButtonPill,
	CameraText,
	Card,
	CharacterCardRow,
	ChatMessageFlow,
	ClipReveal,
	CornerTriangleFrame,
	CredibilityLogos,
	DashboardGrid,
	DeviceMockup,
	Divider,
	EchoText,
	FloatingAppIcon,
	FloatingOrbs,
	GhostSentence,
	GlassCard,
	GlitchText,
	GlowFrame,
	GradientMesh,
	GradientText,
	IconGrid,
	LightStreak,
	MetricCounter,
	NotificationCloud,
	OutlineText,
	Pill,
	ProgressBar,
	RadialTextVortex,
	Scene,
	StackedText,
	TypewriterInput,
	Underline,
	ViewfinderFrame,
	Vignette,
	WordCarousel,
	WordSlotMachine,
	zoomMorph,
} from "./helpers/CinematicHelpers";
import {
	colorBurst,
	diagonalReveal,
	glitchSlam,
	stripedSlam,
	verticalShutter,
	zoomPunch,
} from "./helpers/CustomTransitions";
import { LottieBackground, LottieOverlay } from "./helpers/LottieHelper";
import {
	Confetti,
	Fireflies,
	FlowingGradient,
	PerspectiveGrid,
	Sakura,
	Snow,
	Sparks,
} from "./helpers/ParticleEffects";
import {
	CinematicAnime,
	CinematicDocumentary,
	CinematicEpic,
	CinematicNoir,
	CinematicSciFi,
} from "./helpers/scenes/CinematicAnimations";
import {
	DataBarChart,
	DataGauge,
	DataPieChart,
	DataProgressBars,
	DataTimeline,
} from "./helpers/scenes/DataAnimations";
// Scene library (adapted from remotion-scenes)
import {
	EffectChromaticAberration,
	EffectDuotone,
	EffectFilmGrain,
	EffectGlow,
	EffectKaleidoscope,
	EffectLightLeak,
	EffectVHS,
} from "./helpers/scenes/EffectAnimations";
import {
	LiquidBlob,
	LiquidCalligraphyInk,
	LiquidFluidWave,
	LiquidInkSplash,
	LiquidMorphBlob,
	LiquidSwirl,
} from "./helpers/scenes/LiquidAnimations";
import {
	ListHeroWithList,
	ListNumberedVertical,
	ListStaggered,
	ListTimeline,
	ListTwoColumnCompare,
} from "./helpers/scenes/ListAnimations";
import {
	Logo3DRotate,
	LogoGlitch,
	LogoLightTrail,
	LogoMaskReveal,
	LogoNeonSign,
	LogoParticles,
	LogoStroke,
} from "./helpers/scenes/LogoAnimations";
import {
	Roller3DCarousel,
	RollerFlip,
	RollerGlitch,
	RollerSplitFlap,
	RollerTypewriter,
} from "./helpers/scenes/RollerAnimations";
import {
	ShapeCircularProgress,
	ShapeExplosion,
	ShapeHelix,
	ShapeHexGrid,
	ShapeMorphing,
	ShapeRipples,
	ShapeSpinningRings,
} from "./helpers/scenes/ShapeAnimations";
import {
	Text3DFlip,
	TextCounter,
	TextExplode,
	TextGradient,
	TextKinetic,
	TextNeon,
	TextScramble,
	TextWave,
} from "./helpers/scenes/TextAnimations";

/**
 * Render-prop component that provides the Sequence-local frame.
 * Use this instead of calling useCurrentFrame() in an IIFE — IIFEs
 * execute in the parent component's context and get the GLOBAL frame,
 * not the TransitionSeries.Sequence-local frame.
 *
 * Usage in compiled code:
 *   <FrameScope>{(frame, fps) => <div>Frame: {frame}</div>}</FrameScope>
 */
const FrameScope: React.FC<{
	children: (
		frame: number,
		fps: number,
		videoConfig: ReturnType<typeof useVideoConfig>,
	) => React.ReactNode;
}> = ({ children }) => {
	const frame = useCurrentFrame();
	const config = useVideoConfig();
	return React.createElement(React.Fragment, null, children(frame, config.fps, config));
};

/**
 * The module scope provided to AI-generated code.
 * These are the imports available via destructuring.
 */
export const MODULE_SCOPE = {
	React,
	useState: React.useState,
	useEffect: React.useEffect,
	useMemo: React.useMemo,
	useCallback: React.useCallback,
	useRef: React.useRef,
	// Remotion
	useCurrentFrame,
	useVideoConfig,
	FrameScope,
	interpolate,
	spring,
	random,
	Easing,
	Loop,
	Audio,
	Video,
	// Wrap Sequence to guard against durationInFrames <= 0 (AI sometimes generates 0)
	Sequence: (props: any) => {
		const dur = props.durationInFrames;
		if (typeof dur === "number" && dur <= 0) return null;
		return React.createElement(Sequence, props);
	},
	Series,
	AbsoluteFill,
	Img,
	OffthreadVideo,
	// Transitions
	TransitionSeries,
	linearTiming,
	springTiming,
	fade,
	slide,
	wipe,
	// Pre-built cinematic helpers — safe, responsive, animated
	Scene,
	AnimatedText,
	Card,
	Pill,
	Underline,
	GradientText,
	ClipReveal,
	LightStreak,
	GlitchText,
	Vignette,
	// Lottie
	LottieOverlay,
	LottieBackground,
	WordCarousel,
	ProgressBar,
	MetricCounter,
	FloatingOrbs,
	IconGrid,
	Divider,
	GlowFrame,
	TypewriterInput,
	GhostSentence,
	WordSlotMachine,
	AvatarConstellation,
	ViewfinderFrame,
	NotificationCloud,
	ChatMessageFlow,
	StackedText,
	GradientMesh,
	FloatingAppIcon,
	BlurredUI,
	DashboardGrid,
	CredibilityLogos,
	CharacterCardRow,
	CornerTriangleFrame,
	OutlineText,
	RadialTextVortex,
	EchoText,
	zoomMorph,
	CameraText,
	AnimatedBackground,
	GlassCard,
	DeviceMockup,
	ButtonPill,
	BackgroundVideo,
	// Custom transitions
	stripedSlam,
	zoomPunch,
	diagonalReveal,
	colorBurst,
	verticalShutter,
	glitchSlam,
	// Audio-reactive
	useAudioPulse,
	AudioPulse,
	BeatDot,
	// Particle effects
	Confetti,
	Snow,
	Fireflies,
	Sakura,
	Sparks,
	PerspectiveGrid,
	FlowingGradient,
	// Scene library (from remotion-scenes)
	EffectFilmGrain,
	EffectVHS,
	EffectChromaticAberration,
	EffectGlow,
	EffectLightLeak,
	EffectDuotone,
	EffectKaleidoscope,
	LiquidBlob,
	LiquidInkSplash,
	LiquidFluidWave,
	LiquidSwirl,
	LiquidMorphBlob,
	LiquidCalligraphyInk,
	ShapeRipples,
	ShapeHexGrid,
	ShapeSpinningRings,
	ShapeMorphing,
	ShapeCircularProgress,
	ShapeExplosion,
	ShapeHelix,
	TextNeon,
	TextKinetic,
	TextExplode,
	Text3DFlip,
	TextScramble,
	TextGradient,
	TextWave,
	TextCounter,
	Logo3DRotate,
	LogoStroke,
	LogoNeonSign,
	LogoParticles,
	LogoGlitch,
	LogoMaskReveal,
	LogoLightTrail,
	CinematicEpic,
	CinematicSciFi,
	CinematicNoir,
	CinematicAnime,
	CinematicDocumentary,
	// Data visualizations
	DataBarChart,
	DataPieChart,
	DataTimeline,
	DataProgressBars,
	DataGauge,
	// List layouts
	ListHeroWithList,
	ListTimeline,
	ListStaggered,
	ListNumberedVertical,
	ListTwoColumnCompare,
	// Roller/slot animations
	RollerFlip,
	Roller3DCarousel,
	RollerSplitFlap,
	RollerTypewriter,
	RollerGlitch,
};

/**
 * Compile AI-generated TSX code into a React component.
 *
 * Steps:
 * 1. Strip import statements (we provide everything via module scope)
 * 2. Transform TSX → JS using sucrase
 * 3. Create a function that receives the module scope and returns the component
 */
export function compileCode(tsxCode: string): React.FC<{ screenshots: string[] }> {
	// Step 1: Strip import statements — we inject everything via scope
	// Must handle multi-line destructured imports: import {\n  ...\n} from '...'
	let code = tsxCode
		.replace(/import\s+[\s\S]*?from\s*['"][^'"]*['"];?/g, "")
		.replace(/import\s+['"][^'"]+['"];?/g, "")
		// Strip `const { ... } = window.RemotionXxx;` — AI sometimes emits this
		// outdated pattern. These names are already provided via MODULE_SCOPE.
		.replace(/(?:const|let|var)\s*\{[\s\S]*?\}\s*=\s*window\.\w+\s*;?/g, "")
		.replace(/(?:const|let|var)\s*\{[\s\S]*?\}\s*=\s*Remotion(?:Transitions)?\s*;?/g, "")
		.trim();

	// Step 2: Transform TSX → JS
	const result = transform(code, {
		transforms: ["jsx", "typescript"],
		jsxRuntime: "classic",
		production: false,
	});
	code = result.code;

	// Step 3: Find the component name and ensure it's returned
	// Look for: export const VideoComposition, export function VideoComposition,
	// export default function, const VideoComposition, etc.
	code = code.replace(/export\s+default\s+/g, "").replace(/export\s+/g, "");

	// Wrap the AI code in an IIFE so its local declarations live in a nested scope
	// and naturally shadow any conflicting scope parameter (e.g. the AI redefining
	// Scene, Card, or even useCurrentFrame) without throwing "already declared" errors.
	const scopeKeys = Object.keys(MODULE_SCOPE);
	const scopeValues = scopeKeys.map((k) => MODULE_SCOPE[k as keyof typeof MODULE_SCOPE]);

	const wrappedCode = `
		"use strict";
		return (function() {
			${code}
			if (typeof VideoComposition !== 'undefined') return VideoComposition;
			if (typeof Composition !== 'undefined') return Composition;
			if (typeof App !== 'undefined') return App;
			throw new Error('No VideoComposition component found in generated code');
		})();
	`;

	// biome-ignore lint: new Function is intentional for JIT compilation
	const factory = new Function(...scopeKeys, wrappedCode);
	const component = factory(...scopeValues);

	if (typeof component !== "function") {
		throw new Error(
			`Generated code did not produce a valid React component (got ${typeof component})`,
		);
	}

	return component;
}

// ── Duration calculator ─────────────────────────────────────────────────

/**
 * Estimate duration in frames for an AI-generated composition.
 *
 * Strategy (in order):
 *   1. Parse all `durationInFrames={...}` expressions and sum them up,
 *      resolving constant references (S1, S2, etc.) via the local const map.
 *   2. Look for a literal `const totalDuration = NNN` declaration.
 *   3. Look for `const totalDuration = S1 + S2 + ...` and sum the referenced constants.
 *   4. Count `<Sequence` tags × 60 frames as a heuristic fallback.
 *   5. Default to fps × 20 (20 seconds).
 */
export function estimateAiDuration(code: string, fps = 30): number {
	// Build constant map: `const NAME = 123;` → Map<NAME, 123>
	const constMap = new Map<string, number>();
	const constRegex = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;/g;
	let cm: RegExpExecArray | null;
	while ((cm = constRegex.exec(code)) !== null) {
		constMap.set(cm[1], Number.parseInt(cm[2], 10));
	}

	const resolveExpr = (expr: string): number => {
		const trimmed = expr.trim();
		// Plain number
		if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
		// Constant reference
		if (constMap.has(trimmed)) return constMap.get(trimmed)!;
		// Sum of constants: S1 + S2 + S3
		if (trimmed.includes("+")) {
			const parts = trimmed.split("+").map((p) => p.trim());
			let sum = 0;
			let allResolved = true;
			for (const p of parts) {
				if (/^\d+$/.test(p)) sum += Number.parseInt(p, 10);
				else if (constMap.has(p)) sum += constMap.get(p)!;
				else {
					allResolved = false;
					break;
				}
			}
			if (allResolved && sum > 0) return sum;
		}
		return 0;
	};

	// ── Strategy 1: `const totalDuration = 870;` (literal) ──
	const literalMatch = code.match(/(?:const|let|var)\s+totalDuration\s*=\s*(\d+)\s*;/);
	if (literalMatch) {
		const val = Number.parseInt(literalMatch[1], 10);
		if (val > 0) return val;
	}

	// ── Strategy 2: `const totalDuration = S1 + S2 + ...;` ──
	const sumMatch = code.match(/(?:const|let|var)\s+totalDuration\s*=\s*([^;]+);/);
	if (sumMatch) {
		const val = resolveExpr(sumMatch[1]);
		if (val > 0) return val;
	}

	// ── Strategy 3: Sum only TOP-LEVEL TransitionSeries.Sequence / <Sequence> ──
	const seqSum = sumTopLevelSequenceDurations(code, resolveExpr);
	if (seqSum > 0) return seqSum;

	// ── Strategy 4: Count <Sequence tags × 60 frames ──
	const sequenceCount = (code.match(/<Sequence|<TransitionSeries\.Sequence/g) || []).length;
	if (sequenceCount > 0) return sequenceCount * 60;

	// ── Default: 20 seconds ──
	return fps * 20;
}

/** Sum only the durationInFrames of top-level Sequence / TransitionSeries.Sequence
 * tags. Tracks a nesting counter so inner <Sequence> wraps (from per-layer timing
 * in the scene-plan compiler) aren't double-counted. */
function sumTopLevelSequenceDurations(code: string, resolveExpr: (expr: string) => number): number {
	const tagRegex = /<(\/?)(?:TransitionSeries\.)?Sequence\b([^>]*)>/g;
	let total = 0;
	let depth = 0;
	let m: RegExpExecArray | null;
	while ((m = tagRegex.exec(code)) !== null) {
		const isClose = m[1] === "/";
		const attrs = m[2];
		if (isClose) {
			depth = Math.max(0, depth - 1);
			continue;
		}
		const selfClosing = attrs.trim().endsWith("/");
		if (depth === 0) {
			const durMatch = attrs.match(/durationInFrames=\{([^}]+)\}/);
			if (durMatch) {
				const val = resolveExpr(durMatch[1]);
				if (val > 0) total += val;
			}
		}
		if (!selfClosing) depth++;
	}
	return total;
}
