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

// Remotion doesn't expose `Extrapolate` as a named export from the main
// package, but the AI Composer sometimes references it (e.g.
// `const { Extrapolate } = useUtils()` or `interpolate(..., { Extrapolate })`).
// We provide a local enum-like object so destructures and references resolve
// to the matching string literals that interpolate's options actually use.
const Extrapolate = {
	CLAMP: "clamp",
	EXTEND: "extend",
	IDENTITY: "identity",
} as const;

import { animate, createTimeline } from "animejs";
import { stagger } from "animejs/utils";
import * as flubber from "flubber";
import {
	Box,
	Float,
	OrbitControls,
	PerspectiveCamera,
	RoundedBox,
	Sphere,
	Stars as ThreeStars,
	Text as ThreeText,
	Text3D,
	Torus,
} from "@react-three/drei";
import { Canvas as ThreeCanvas, useFrame as useThreeFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { TextPlugin } from "gsap/TextPlugin";

// Register all plugins once at module load
gsap.registerPlugin(
	CustomEase,
	DrawSVGPlugin,
	Flip,
	MorphSVGPlugin,
	MotionPathPlugin,
	Physics2DPlugin,
	ScrambleTextPlugin,
	SplitText,
	TextPlugin,
);
import { transform } from "sucrase";
import { ANIME_PRESETS, useAnimeAnimation, useAnimeTimeline } from "./helpers/AnimeHelper";
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
	depthParallax,
	irisZoom,
	portal,
	shatter,
	warpDissolve,
	zoomThrough,
} from "./helpers/CinematicTransitions";
import {
	colorBurst,
	diagonalReveal,
	glitchSlam,
	stripedSlam,
	verticalShutter,
	zoomPunch,
} from "./helpers/CustomTransitions";
import { ImageCrossfade } from "./helpers/ImageCrossfade";
import { LottieBackground, LottieOverlay } from "./helpers/LottieHelper";
import {
	Bubbles,
	Confetti,
	Embers,
	Fireflies,
	FlowingGradient,
	LightRays,
	Mist,
	PerspectiveGrid,
	Sakura,
	Snow,
	Sparks,
	Stars,
} from "./helpers/ParticleEffects";
import { PIXI_PRESETS, PixiOverlay } from "./helpers/PixiOverlay";
// Scene library (adapted from remotion-scenes) — FULL exports from every file.
// We expose every component via MODULE_SCOPE so the AI Composer can reach for
// anything from the library. Bundle size impact: ~600KB for ~125 additional
// components — acceptable given the quality unlock.
import {
	BackgroundAurora,
	BackgroundBokeh,
	BackgroundFlowingGradient,
	BackgroundGeometric,
	BackgroundGrid,
	BackgroundMeshGradient,
	BackgroundNoiseTexture,
	BackgroundPerspectiveGrid,
	BackgroundRadial,
	BackgroundWaves,
} from "./helpers/scenes/BackgroundAnimations";
import {
	CinematicAction,
	CinematicAnime,
	CinematicDocumentary,
	CinematicEpic,
	CinematicHorror,
	CinematicMinimalEnd,
	CinematicNoir,
	CinematicRomance,
	CinematicSciFi,
	CinematicVintage,
} from "./helpers/scenes/CinematicAnimations";
import {
	DataBarChart,
	DataGauge,
	DataLineChart,
	DataPieChart,
	DataProgressBars,
	DataRanking,
	DataStatsCards,
	DataTimeline,
} from "./helpers/scenes/DataAnimations";
import {
	EffectChromaticAberration,
	EffectDepthOfField,
	EffectDuotone,
	EffectFilmGrain,
	EffectGlow,
	EffectKaleidoscope,
	EffectLightLeak,
	EffectMatrix,
	EffectNoise,
	EffectVHS,
} from "./helpers/scenes/EffectAnimations";
import {
	LayoutAsymmetric,
	LayoutDiagonal,
	LayoutFrameInFrame,
	LayoutFullscreenType,
	LayoutGiantNumber,
	LayoutGridBreak,
	LayoutLayered,
	LayoutMultiColumn,
	LayoutOffGrid,
	LayoutSplitContrast,
	LayoutVerticalMix,
	LayoutWhitespace,
} from "./helpers/scenes/LayoutAnimations";
import {
	LiquidBlob,
	LiquidCalligraphyInk,
	LiquidFluidWave,
	LiquidInkSplash,
	LiquidMorphBlob,
	LiquidOilSpill,
	LiquidPaintDrip,
	LiquidSplatter,
	LiquidSwirl,
	LiquidWaterDrop,
} from "./helpers/scenes/LiquidAnimations";
import {
	ListAsymmetric3,
	ListFullscreenSequence,
	ListHeroWithList,
	ListHorizontalPeek,
	ListMinimalLeft,
	ListNumberedVertical,
	ListSimpleText,
	ListStaggered,
	ListStatsFocused,
	ListTimeline,
	ListTwoColumnCompare,
	ListUnevenGrid,
} from "./helpers/scenes/ListAnimations";
import {
	Logo3DRotate,
	LogoGlitch,
	LogoLightTrail,
	LogoMaskReveal,
	LogoMorph,
	LogoNeonSign,
	LogoParticles,
	LogoSplitScreen,
	LogoStamp,
	LogoStroke,
} from "./helpers/scenes/LogoAnimations";
import {
	ParticleBubbles,
	ParticleConfetti,
	ParticleFireworks,
	ParticleLightning,
	ParticleMagneticField,
	ParticleSakura,
	ParticleShootingStars,
	ParticleSmoke,
	ParticleSnow,
	ParticleSparks,
} from "./helpers/scenes/ParticleAnimations";
import {
	Roller3DCarousel,
	RollerBlur,
	RollerCountdown,
	RollerDramaticStop,
	RollerDrum,
	RollerFadeSlide,
	RollerFlip,
	RollerGlitch,
	RollerGradientWave,
	RollerLiquid,
	RollerMaskSlide,
	RollerMultiSlot,
	RollerOutlineHighlight,
	RollerPerspectiveStripes,
	RollerScaleBounce,
	RollerShuffle,
	RollerSlotMachine,
	RollerSlotReveal,
	RollerSplitFlap,
	RollerTypewriter,
	RollerVerticalList,
	RollerWave,
} from "./helpers/scenes/RollerAnimations";
import {
	Shape3DCube,
	ShapeCircularProgress,
	ShapeExplosion,
	ShapeHelix,
	ShapeHexGrid,
	ShapeMandala,
	ShapeMorphing,
	ShapeParticleField,
	ShapeRipples,
	ShapeSpinningRings,
} from "./helpers/scenes/ShapeAnimations";
import {
	Text3DFlip,
	TextCounter,
	TextExplode,
	TextGlitch,
	TextGradient,
	TextKinetic,
	TextMaskReveal,
	TextNeon,
	TextScramble,
	TextSplit,
	TextTypewriter,
	TextWave,
} from "./helpers/scenes/TextAnimations";
import {
	Theme3DGlass,
	Theme3DGlassThreeJS,
	ThemeArtDeco,
	ThemeBauhaus,
	ThemeBoho,
	ThemeBrutalistWeb,
	ThemeCosmic,
	ThemeCyberpunk,
	ThemeDarkMode,
	ThemeDuotone,
	ThemeGeometricAbstract,
	ThemeGlassmorphism,
	ThemeGradient,
	ThemeHolographic,
	ThemeIndustrial,
	ThemeIsometric,
	ThemeJapanese,
	ThemeLuxury,
	ThemeMemphis,
	ThemeMinimalist,
	ThemeMonochrome,
	ThemeNatural,
	ThemeNeobrutalism,
	ThemeNeon,
	ThemeNeumorphism,
	ThemeOrganic,
	ThemePaperCut,
	ThemePop,
	ThemeRetro,
	ThemeSwiss,
	ThemeTech,
	ThemeWatercolor,
	ThemeY2K,
} from "./helpers/scenes/ThemeAnimations";
import {
	TransitionBlinds,
	TransitionBoxReveal,
	TransitionCircleWipe,
	TransitionDiagonalSlice,
	TransitionFlash,
	TransitionGlitch,
	TransitionLineSweep,
	TransitionLiquidMorph,
	TransitionShutter,
	TransitionZoomBlur,
} from "./helpers/scenes/TransitionAnimations";

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
 * safeInterpolate — wrapper around Remotion's `interpolate` that auto-fixes
 * mismatched inputRange/outputRange lengths.
 *
 * Remotion's `interpolate` throws when the two arrays don't match. The AI
 * frequently writes `interpolate(frame, [0, 60], [0, 50, 100])` — intending
 * a 3-stage animation but forgetting to add a middle input point. Strict
 * interpolate crashes the scene; this wrapper pads the shorter array by
 * evenly spacing between its endpoints, logs a warning, and returns a
 * working value. Only exposed via MODULE_SCOPE to AI-generated code —
 * lucid's native code continues to use the strict Remotion import.
 */
function safeInterpolate(
	input: number,
	inputRange: readonly number[],
	outputRange: readonly number[],
	options?: Parameters<typeof interpolate>[3],
): number {
	// ── Wrong-arity auto-fix ──────────────────────────────────────────
	// AI frequently writes `interpolate(x, [a, b], { extrapolateLeft: 'clamp' })`
	// — forgetting the outputRange and putting the options object where
	// outputRange should be. Detect this by checking if outputRange is an
	// object that ISN'T an array but has typical option keys, then assume
	// the AI meant `interpolate(x, [0, 1], inputRange, outputRange)` —
	// i.e., what looks like inputRange is actually the outputRange.
	if (
		outputRange != null &&
		!Array.isArray(outputRange) &&
		typeof outputRange === "object" &&
		("extrapolateLeft" in outputRange ||
			"extrapolateRight" in outputRange ||
			"easing" in outputRange)
	) {
		const recoveredOptions = outputRange as unknown as Parameters<typeof interpolate>[3];
		const recoveredOutput = inputRange;
		// Recurse with corrected args. The recursion is safe — only ONE
		// level deep, since the new outputRange is a real array.
		return safeInterpolate(input, [0, 1], recoveredOutput, recoveredOptions);
	}

	// Defensive: if outputRange is somehow not an array at this point
	// (undefined, null, primitive), bail with 0 instead of crashing.
	if (!Array.isArray(outputRange)) {
		console.warn(
			`[safeInterpolate] outputRange is not an array (got ${typeof outputRange}). Returning 0.`,
		);
		return 0;
	}
	if (!Array.isArray(inputRange)) {
		console.warn(
			`[safeInterpolate] inputRange is not an array (got ${typeof inputRange}). Returning 0.`,
		);
		return 0;
	}

	let fixedInput: readonly number[] = inputRange;
	let fixedOutput: readonly number[] = outputRange;
	if (inputRange.length !== outputRange.length) {
		console.warn(
			`[safeInterpolate] mismatched lengths — inputRange (${inputRange.length}) vs outputRange (${outputRange.length}). Auto-fixing by padding the shorter array.`,
		);
		if (inputRange.length < outputRange.length) {
			// Pad inputRange: evenly space between first and last endpoint
			const first = inputRange[0] ?? 0;
			const last = inputRange[inputRange.length - 1] ?? 1;
			const count = outputRange.length;
			const padded: number[] = [];
			for (let i = 0; i < count; i++) {
				padded.push(first + ((last - first) * i) / (count - 1));
			}
			fixedInput = padded;
		} else {
			// outputRange is shorter — pad it with its last value repeated
			const padded = [...outputRange];
			while (padded.length < inputRange.length) {
				padded.push(padded[padded.length - 1] ?? 0);
			}
			fixedOutput = padded;
		}
	}

	// Remotion requires inputRange to be STRICTLY MONOTONICALLY INCREASING.
	// AI sometimes generates duplicates like `[114, 138, 138, 162]` when
	// computing keyframes from frame numbers + offsets.
	//
	// Special case: a fully descending inputRange like `[1, 0]` means the
	// AI intended a reverse interpolation. Instead of bumping each entry
	// by 1 (which produces nonsensical `[1, 2]`), REVERSE both arrays
	// so `[1, 0]` with output `[0, 1]` becomes input `[0, 1]` output `[1, 0]`.
	//
	// Bump any remaining duplicate or out-of-order entry by 1 frame so
	// the array stays strictly increasing. Apply the same shift to the
	// matching outputRange index so the curve stays semantically equivalent.
	//
	// NOTE: this function is called on every render frame, so we log once
	// per unique fix pattern instead of spamming on every call.
	const inputArray = [...fixedInput];
	const outputArray = [...fixedOutput];

	// Check if array is fully descending — reverse both arrays instead of bumping
	let fullyDescending = inputArray.length >= 2;
	for (let i = 1; i < inputArray.length && fullyDescending; i++) {
		if (inputArray[i] >= inputArray[i - 1]) fullyDescending = false;
	}
	if (fullyDescending) {
		inputArray.reverse();
		outputArray.reverse();
	}

	let bumped = false;
	for (let i = 1; i < inputArray.length; i++) {
		if (inputArray[i] <= inputArray[i - 1]) {
			inputArray[i] = inputArray[i - 1] + 1;
			bumped = true;
		}
	}
	if (bumped || fullyDescending) {
		fixedInput = inputArray;
		fixedOutput = outputArray;
	}

	// Strip invalid easing option — AI sometimes passes a string like
	// "Easing.out(Easing.cubic)" or an undefined reference where Remotion
	// expects a function. Stripping it falls back to linear easing which
	// is better than crashing every render frame.
	let safeOptions = options;
	if (safeOptions && "easing" in safeOptions && typeof safeOptions.easing !== "function") {
		const { easing: _discarded, ...rest } = safeOptions;
		safeOptions = rest as typeof options;
	}

	try {
		return interpolate(input, fixedInput as number[], fixedOutput as number[], safeOptions);
	} catch {
		// Don't spam the console on every render frame — return 0 silently.
		// The scene will still render, just with a static value for this
		// particular interpolation.
		return 0;
	}
}

/**
 * interpolateColor — interpolate between two hex colors based on a value.
 *
 * AI-generated code frequently calls this function by name assuming it
 * exists alongside `interpolate` and `spring` in the Remotion scope. It
 * doesn't ship with Remotion, so we provide our own lightweight version
 * here so generated code doesn't crash with "interpolateColor is not defined".
 *
 * Usage:
 *   interpolateColor(progress, [0, 1], ['#ff0000', '#00ff00'])
 *   interpolateColor(frame, [0, 60], ['#ec4899', '#ff772d'])
 *
 * Supports #rgb, #rgba, #rrggbb, and #rrggbbaa hex formats. Clamps to the
 * output range endpoints when input is outside inputRange.
 */
function interpolateColor(
	input: number,
	inputRange: readonly [number, number],
	outputRange: readonly [string, string],
): string {
	const [inMin, inMax] = inputRange;
	const [from, to] = outputRange;
	const t = Math.max(0, Math.min(1, (input - inMin) / (inMax - inMin)));

	function parseHex(hex: string): [number, number, number, number] {
		let h = hex.trim();
		if (h.startsWith("#")) h = h.slice(1);
		// Expand #rgb → #rrggbb
		if (h.length === 3)
			h = h
				.split("")
				.map((c) => c + c)
				.join("");
		// Expand #rgba → #rrggbbaa
		if (h.length === 4)
			h = h
				.split("")
				.map((c) => c + c)
				.join("");
		const r = Number.parseInt(h.slice(0, 2), 16);
		const g = Number.parseInt(h.slice(2, 4), 16);
		const b = Number.parseInt(h.slice(4, 6), 16);
		const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
		return [r || 0, g || 0, b || 0, a];
	}
	const [fr, fg, fb, fa] = parseHex(from);
	const [tr, tg, tb, ta] = parseHex(to);
	const r = Math.round(fr + (tr - fr) * t);
	const g = Math.round(fg + (tg - fg) * t);
	const b = Math.round(fb + (tb - fb) * t);
	const a = fa + (ta - fa) * t;
	if (a < 1) return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Per-scene error boundary. Wraps each `<CustomScene_N />` reference so
 * that a single broken scene (a typo, an undefined ref, a runtime crash)
 * shows a graceful placeholder instead of taking down the entire video.
 *
 * The class component captures the error, logs it once, and renders a
 * dark fallback frame for the rest of the scene's duration. The other
 * scenes in the TransitionSeries continue to play.
 */
class SceneErrorBoundary extends React.Component<
	{ sceneName?: string; children: React.ReactNode },
	{ hasError: boolean; error: Error | null }
> {
	constructor(props: { sceneName?: string; children: React.ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		const name = this.props.sceneName ?? "scene";
		console.error(`[SceneErrorBoundary] ${name} crashed:`, error.message);
		console.error(info.componentStack);
	}

	render() {
		if (!this.state.hasError) return this.props.children;
		const name = this.props.sceneName ?? "scene";
		const message = this.state.error?.message ?? "Unknown error";
		return React.createElement(
			AbsoluteFill,
			{
				style: {
					background: "linear-gradient(135deg, #1a0a0a 0%, #0a0a1a 100%)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: 80,
				},
			},
			React.createElement(
				"div",
				{
					style: {
						maxWidth: 900,
						padding: 40,
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(239,68,68,0.4)",
						borderRadius: 16,
						color: "#f1f5f9",
						fontFamily: "'Inter', sans-serif",
						textAlign: "center",
					},
				},
				React.createElement(
					"div",
					{
						style: {
							fontSize: 14,
							fontWeight: 600,
							color: "#ef4444",
							marginBottom: 12,
							letterSpacing: "0.1em",
							textTransform: "uppercase",
						},
					},
					`Scene unavailable — ${name}`,
				),
				React.createElement("div", { style: { fontSize: 18, opacity: 0.7 } }, message),
			),
		);
	}
}

/**
 * The module scope provided to AI-generated code.
 * These are the imports available via destructuring.
 */
// Wrap effect hooks so cleanup errors are logged but don't crash the scene.
// AI-generated cleanup functions often do `ref.current?.kill()` where
// `ref.current` is set but missing the method — Sucrase's _optionalChain
// helper doesn't short-circuit on intermediate undefined access, so it hits
// `undefined.call(...)` during unmount and the whole scene boundary trips.
// The setup already succeeded — the scene rendered fine — so swallowing the
// cleanup error keeps playback from crashing mid-video.
const safeEffect = (hookName: "useEffect" | "useLayoutEffect") => {
	const hook = React[hookName];
	return (effect: React.EffectCallback, deps?: React.DependencyList) => {
		return hook(() => {
			const cleanup = effect();
			if (typeof cleanup !== "function") return cleanup;
			return () => {
				try {
					cleanup();
				} catch (err) {
					console.warn(
						`[${hookName} cleanup] swallowed error in AI scene:`,
						err instanceof Error ? err.message : err,
					);
				}
			};
		}, deps);
	};
};

export const MODULE_SCOPE = {
	React,
	useState: React.useState,
	useEffect: safeEffect("useEffect"),
	useLayoutEffect: safeEffect("useLayoutEffect"),
	useMemo: React.useMemo,
	useCallback: React.useCallback,
	useRef: React.useRef,
	// Remotion
	useCurrentFrame,
	useVideoConfig,
	FrameScope,
	// Wrap `interpolate` so AI-generated code with mismatched input/output
	// arrays gets auto-fixed instead of crashing the scene.
	interpolate: safeInterpolate,
	interpolateColor,
	spring,
	random,
	// Easing wrapped in a Proxy so unknown method names (Easing.steps,
	// Easing.smoothStep, Easing.easeInOut, etc.) return Easing.linear as a
	// sensible default instead of crashing the scene with "Easing.X is not
	// a function". Real Easing methods pass through untouched.
	//
	// wrapEasingFn: the AI sometimes calls Easing.out(Easing.cubic).fn(t) —
	// this is the old React-Native Easing API where the callable lived on
	// .fn. Remotion's Easing returns a plain function, so .fn is undefined
	// and crashes the scene. We wrap every function returned from an Easing
	// method so `.fn` resolves back to the function itself.
	Easing: (() => {
		const wrapEasingFn = (fn: unknown): unknown => {
			if (typeof fn !== "function") return fn;
			const wrapped = (...args: unknown[]) => {
				const result = (fn as any)(...args);
				return wrapEasingFn(result);
			};
			(wrapped as any).fn = wrapped;
			return wrapped;
		};
		return new Proxy(Easing, {
			get(target, prop) {
				if (prop in target) {
					const raw = (target as any)[prop];
					return wrapEasingFn(raw);
				}
				if (typeof prop === "string") {
					// Common AI confusions with React-Native / CSS naming
					if (prop === "easeIn") return wrapEasingFn(Easing.in(Easing.ease));
					if (prop === "easeOut") return wrapEasingFn(Easing.out(Easing.ease));
					if (prop === "easeInOut") return wrapEasingFn(Easing.inOut(Easing.ease));
					if (prop === "easeOutCubic") return wrapEasingFn(Easing.out(Easing.cubic));
					if (prop === "easeInCubic") return wrapEasingFn(Easing.in(Easing.cubic));
					if (prop === "easeInOutCubic") return wrapEasingFn(Easing.inOut(Easing.cubic));
					if (prop === "easeOutQuad") return wrapEasingFn(Easing.out(Easing.quad));
					if (prop === "easeInQuad") return wrapEasingFn(Easing.in(Easing.quad));
					if (prop === "smoothStep" || prop === "smoothstep")
						return wrapEasingFn((t: number) => t * t * (3 - 2 * t));
					// CSS-like steps(n) — the AI calls it expecting stair-step easing
					if (prop === "steps") return wrapEasingFn(() => Easing.linear);
					// `.fn` accessed directly on Easing itself — shouldn't happen but
					// return linear to be safe.
					if (prop === "fn") return wrapEasingFn(Easing.linear);
					console.warn(
						`[Easing Proxy] "${prop}" is not a real Easing method — returning Easing.linear`,
					);
				}
				return wrapEasingFn(Easing.linear);
			},
		});
	})(),
	Extrapolate,
	// Per-scene error boundary — wraps each <CustomScene_N /> reference
	// in the compiled VideoComposition so a single bad scene shows a
	// fallback instead of crashing the whole video. See the regex
	// transform in compileCode() that injects __SafeScene wrappers.
	__SafeScene: SceneErrorBoundary,
	// Compatibility shim — the AI sometimes hallucinates a `useUtils()` hook
	// and writes `const { interpolate, spring, Extrapolate } = useUtils()`.
	// Returning a fresh bag of helpers keeps those generations from crashing
	// the scene. The real path is to use the globals directly, but the shim
	// makes the wrong path harmless.
	useUtils: () => ({
		interpolate: safeInterpolate,
		spring,
		Easing,
		Extrapolate,
		random,
		interpolateColor,
		useCurrentFrame,
		useVideoConfig,
	}),
	// Compatibility shim — the AI sometimes reaches for React-Spring's
	// `useSpring(...)` hook when it should be using Remotion's `spring()`
	// helper. The React-Spring API returns an animated-value object; Remotion's
	// spring() returns a number. We adapt: accept either `({ from, to, config })`
	// or `({ frame, fps, ... })` style calls and return a number. This prevents
	// "useSpring is not defined" runtime crashes while still producing a usable
	// animated value. The AI's call sites usually consume the result as a
	// number anyway.
	useSpring: (config: any = {}) => {
		try {
			const frame = useCurrentFrame();
			const { fps } = useVideoConfig();
			const from = typeof config?.from === "number" ? config.from : 0;
			const to = typeof config?.to === "number" ? config.to : 1;
			const progress = spring({
				frame,
				fps,
				from,
				to,
				config: { stiffness: 100, damping: 15, mass: 1, ...(config?.config || {}) },
			});
			// Proxy trap — the AI might index into this like `animated.scale` or
			// `animated.value`. Return the number directly for any property
			// access that asks for a number, and keep the raw number usable too.
			return new Proxy(
				{ valueOf: () => progress, value: progress },
				{
					get(target, prop) {
						if (prop === Symbol.toPrimitive || prop === "valueOf") return () => progress;
						if (prop in target) return (target as any)[prop];
						return progress;
					},
				},
			);
		} catch {
			return 0;
		}
	},
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
	// SafeImg — wraps Remotion's Img to gracefully handle undefined src
	// (happens in research mode where there are no screenshots). Uses a
	// closure over the real Img via a helper to avoid name shadowing.
	Img: (function createSafeImg(RealImg: typeof Img) {
		return function SafeImg(props: any) {
			if (!props?.src) return null;
			return React.createElement(RealImg, props);
		};
	})(Img),
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
	// New particle types (animation engine)
	Mist,
	LightRays,
	Bubbles,
	Embers,
	Stars,
	// Multi-image crossfade
	ImageCrossfade,
	// Cinematic 3D transitions
	zoomThrough,
	portal,
	depthParallax,
	warpDissolve,
	irisZoom,
	shatter,
	// anime.js integration
	useAnimeTimeline,
	useAnimeAnimation,
	ANIME_PRESETS,
	createTimeline,
	animate: animate,
	stagger,
	// SVG path morphing (flubber)
	flubber,
	// GSAP — richer animation timelines, used by Motion.so for polished motion
	// All plugins pre-registered (free as of 2024)
	gsap,
	SplitText,        // split headlines into chars/words/lines for staggered reveals
	DrawSVGPlugin,    // animate SVG strokes drawing on
	MorphSVGPlugin,   // morph between SVG paths
	MotionPathPlugin, // animate elements along curved SVG paths
	ScrambleTextPlugin, // matrix-style text scramble
	Physics2DPlugin,  // gravity/physics-based motion
	Flip,             // smooth layout transitions
	CustomEase,       // bespoke easing curves
	TextPlugin,       // animate text content changes
	// Three.js — for 3D scenes (camera moves, 3D text, product reveals)
	THREE,
	ThreeCanvas,      // <ThreeCanvas> wrapper — root of any 3D scene
	useThreeFrame,    // useFrame() hook (renamed to avoid clash with Remotion)
	// drei — react-three helpers (preloaded primitives + utilities)
	PerspectiveCamera,
	OrbitControls,
	ThreeStars,       // drei <Stars> starfield (3D) — renamed to avoid clash with ParticleEffects.Stars
	Float,
	Box,
	Sphere,
	Torus,
	RoundedBox,
	ThreeText,        // 2D text in 3D space
	Text3D,           // extruded 3D text (requires font URL)
	// PixiJS effects overlay
	PixiOverlay,
	PIXI_PRESETS,
	// ── Scene library (full 220+ components from remotion-scenes) ──
	//
	// Effects (color grading + post-processing overlays)
	EffectFilmGrain,
	EffectVHS,
	EffectChromaticAberration,
	EffectGlow,
	EffectLightLeak,
	EffectDuotone,
	EffectKaleidoscope,
	EffectDepthOfField,
	EffectMatrix,
	EffectNoise,
	// Liquid / organic shape morphers
	LiquidBlob,
	LiquidInkSplash,
	LiquidFluidWave,
	LiquidSwirl,
	LiquidMorphBlob,
	LiquidCalligraphyInk,
	LiquidOilSpill,
	LiquidPaintDrip,
	LiquidSplatter,
	LiquidWaterDrop,
	// Shape animations (geometric / 3D)
	ShapeRipples,
	ShapeHexGrid,
	ShapeSpinningRings,
	ShapeMorphing,
	ShapeCircularProgress,
	ShapeExplosion,
	ShapeHelix,
	Shape3DCube,
	ShapeMandala,
	ShapeParticleField,
	// Text primitives
	TextNeon,
	TextKinetic,
	TextExplode,
	Text3DFlip,
	TextScramble,
	TextGradient,
	TextWave,
	TextCounter,
	TextGlitch,
	TextMaskReveal,
	TextSplit,
	TextTypewriter,
	// Logo reveals
	Logo3DRotate,
	LogoStroke,
	LogoNeonSign,
	LogoParticles,
	LogoGlitch,
	LogoMaskReveal,
	LogoLightTrail,
	LogoMorph,
	LogoSplitScreen,
	LogoStamp,
	// Cinematic full-scene backgrounds (genre presets)
	CinematicEpic,
	CinematicSciFi,
	CinematicNoir,
	CinematicAnime,
	CinematicDocumentary,
	CinematicAction,
	CinematicHorror,
	CinematicMinimalEnd,
	CinematicRomance,
	CinematicVintage,
	// Background layers (non-cinematic atmospherics)
	BackgroundAurora,
	BackgroundBokeh,
	BackgroundFlowingGradient,
	BackgroundGeometric,
	BackgroundGrid,
	BackgroundMeshGradient,
	BackgroundNoiseTexture,
	BackgroundPerspectiveGrid,
	BackgroundRadial,
	BackgroundWaves,
	// Layouts (full-scene compositional frameworks)
	LayoutAsymmetric,
	LayoutDiagonal,
	LayoutFrameInFrame,
	LayoutFullscreenType,
	LayoutGiantNumber,
	LayoutGridBreak,
	LayoutLayered,
	LayoutMultiColumn,
	LayoutOffGrid,
	LayoutSplitContrast,
	LayoutVerticalMix,
	LayoutWhitespace,
	// Particle systems (from scene-library — distinct from older ParticleEffects)
	ParticleBubbles,
	ParticleConfetti,
	ParticleFireworks,
	ParticleLightning,
	ParticleMagneticField,
	ParticleSakura,
	ParticleShootingStars,
	ParticleSmoke,
	ParticleSnow,
	ParticleSparks,
	// Themed full-scene visual systems (33 — aesthetic-level treatments)
	Theme3DGlass,
	Theme3DGlassThreeJS,
	ThemeArtDeco,
	ThemeBauhaus,
	ThemeBoho,
	ThemeBrutalistWeb,
	ThemeCosmic,
	ThemeCyberpunk,
	ThemeDarkMode,
	ThemeDuotone,
	ThemeGeometricAbstract,
	ThemeGlassmorphism,
	ThemeGradient,
	ThemeHolographic,
	ThemeIndustrial,
	ThemeIsometric,
	ThemeJapanese,
	ThemeLuxury,
	ThemeMemphis,
	ThemeMinimalist,
	ThemeMonochrome,
	ThemeNatural,
	ThemeNeobrutalism,
	ThemeNeon,
	ThemeNeumorphism,
	ThemeOrganic,
	ThemePaperCut,
	ThemePop,
	ThemeRetro,
	ThemeSwiss,
	ThemeTech,
	ThemeWatercolor,
	ThemeY2K,
	// Transition-style scenes (full-scene reveal/wipe visuals, NOT
	// TransitionSeries transitions — use these as scene content for reveal beats)
	TransitionBlinds,
	TransitionBoxReveal,
	TransitionCircleWipe,
	TransitionDiagonalSlice,
	TransitionFlash,
	TransitionGlitch,
	TransitionLineSweep,
	TransitionLiquidMorph,
	TransitionShutter,
	TransitionZoomBlur,
	// Data visualizations
	DataBarChart,
	DataPieChart,
	DataTimeline,
	DataProgressBars,
	DataGauge,
	DataLineChart,
	DataRanking,
	DataStatsCards,
	// List layouts
	ListHeroWithList,
	ListTimeline,
	ListStaggered,
	ListNumberedVertical,
	ListTwoColumnCompare,
	ListAsymmetric3,
	ListFullscreenSequence,
	ListHorizontalPeek,
	ListMinimalLeft,
	ListSimpleText,
	ListStatsFocused,
	ListUnevenGrid,
	// Roller/slot animations (22 — word-rotator / counter reveal patterns)
	RollerFlip,
	Roller3DCarousel,
	RollerSplitFlap,
	RollerTypewriter,
	RollerGlitch,
	RollerBlur,
	RollerCountdown,
	RollerDramaticStop,
	RollerDrum,
	RollerFadeSlide,
	RollerGradientWave,
	RollerLiquid,
	RollerMaskSlide,
	RollerMultiSlot,
	RollerOutlineHighlight,
	RollerPerspectiveStripes,
	RollerScaleBounce,
	RollerShuffle,
	RollerSlotMachine,
	RollerSlotReveal,
	RollerVerticalList,
	RollerWave,
};

/**
 * Compile AI-generated TSX code into a React component.
 *
 * Steps:
 * 1. Strip import statements (we provide everything via module scope)
 * 2. Transform TSX → JS using sucrase
 * 3. Create a function that receives the module scope and returns the component
 */
/**
 * Parse Sucrase's error message (format: "... (line:col)") and log the
 * surrounding code context so we can see exactly what token is failing.
 * Critical for debugging AI-generated code that trips the parser.
 */
function logSucraseErrorContext(code: string, err: unknown, label: string): void {
	try {
		const msg = err instanceof Error ? err.message : String(err);
		const match = msg.match(/\((\d+):(\d+)\)/);
		if (!match) {
			console.warn(`[compileCode] ${label} error (no location):`, msg);
			return;
		}
		const line = Number.parseInt(match[1], 10);
		const col = Number.parseInt(match[2], 10);
		const lines = code.split("\n");

		// When errors report at very early positions (line 1-10), the actual
		// cause is usually much later in the file — TSX parsers often fail
		// at an early "anchor" token because they're recovering from a
		// problem downstream. Show a MUCH larger window in that case so we
		// can see the real issue (type assertions, unclosed strings, JSX
		// ambiguities, etc.).
		const isEarlyError = line <= 10;
		const linesBefore = 5;
		const linesAfter = isEarlyError ? 50 : 10;

		const start = Math.max(0, line - 1 - linesBefore);
		const end = Math.min(lines.length, line + linesAfter);
		const contextLines: string[] = [];
		for (let i = start; i < end; i++) {
			const lineNum = i + 1;
			const marker = lineNum === line ? ">>> " : "    ";
			contextLines.push(`${marker}${lineNum.toString().padStart(4)}: ${lines[i]}`);
			if (lineNum === line) {
				// Add a caret pointing at the column
				contextLines.push(`         ${" ".repeat(Math.max(0, col + 6))}^`);
			}
		}
		console.warn(
			`[compileCode] ${label} error at ${line}:${col}\n${msg}\n` +
				`Total code: ${lines.length} lines, ${code.length} chars\n` +
				`Context (${linesBefore} before, ${linesAfter} after):\n${contextLines.join("\n")}`,
		);

		// For early errors, ALSO dump a string search for common patterns
		// that cause Sucrase failures in TSX mode, so we can spot them
		// without reading the whole file.
		if (isEarlyError) {
			const suspiciousPatterns: Array<{ pattern: RegExp; hint: string }> = [
				{
					pattern: /<[A-Z][a-zA-Z]*>[\w.\s]*(?:;|,|\))/g,
					hint: "TS type assertion (<Type>value) — invalid in TSX",
				},
				{ pattern: /=\s*<[A-Z]/g, hint: "TS type assertion as expression" },
				{ pattern: /`[^`]*$/m, hint: "Unterminated template literal" },
				{ pattern: /:\s*JSX\.Element/g, hint: "JSX.Element type annotation (may confuse Sucrase)" },
				{
					pattern: /interface\s+\w+/g,
					hint: "interface declaration (may confuse Sucrase in some configs)",
				},
			];
			const hits: string[] = [];
			for (const { pattern, hint } of suspiciousPatterns) {
				const matches = code.match(pattern);
				if (matches && matches.length > 0) {
					hits.push(
						`  • ${hint}: ${matches.length} match(es), first: ${JSON.stringify(matches[0]?.slice(0, 80))}`,
					);
				}
			}
			if (hits.length > 0) {
				console.warn(`[compileCode] ${label} — suspicious patterns found:\n${hits.join("\n")}`);
			}
		}
	} catch {
		// Never let diagnostic code crash the actual compile path
	}
}

/**
 * Walk a code string and remove every `: React.FC` (with optional generic
 * arguments). Uses balanced angle-bracket counting so nested generics work.
 *
 *   `const X: React.FC<{ a: string }> = ...` → `const X = ...`
 *   `const X: React.FC = ...`                → `const X = ...`
 *   `const X: React.FC<{ a: Array<string> }> = ...` → handled correctly
 */
function stripReactFCAnnotations(code: string): string {
	let result = "";
	let i = 0;
	while (i < code.length) {
		// Check if this position starts ": React.FC" (with optional whitespace)
		const slice = code.slice(i);
		const m = slice.match(/^:\s*React\.FC/);
		if (!m) {
			result += code[i];
			i++;
			continue;
		}
		// Skip past ": React.FC" — that's m[0].length characters
		i += m[0].length;
		// Skip whitespace
		while (i < code.length && /\s/.test(code[i])) i++;
		// If a generic <...> follows, skip it with balanced bracket counting
		if (code[i] === "<") {
			let depth = 1;
			i++;
			while (i < code.length && depth > 0) {
				if (code[i] === "<") depth++;
				else if (code[i] === ">") depth--;
				i++;
			}
		}
	}
	return result;
}

/**
 * Aggressively strip TypeScript syntax that Sucrase can't handle.
 * Used as a last-resort fallback when normal transform fails.
 *
 * Handles:
 *  - Variable type annotations: `const X: SomeType = ...` → `const X = ...`
 *  - Generic call type arguments: `useState<T>(...)` → `useState(...)`
 *
 * DELIBERATELY DOES NOT strip function parameter types. The old version
 * tried to with a `(name: type)` regex, but `[^()]*` inside the lookahead
 * matches object literal contents too — so it would treat `{ frame: frame }`
 * inside `spring(...)` as params and mangle valid object-literal shorthand
 * to `{ frame }` with a bare `frame - 6` expression next to it. Sucrase
 * handles TS param types natively anyway, so this step was redundant AND
 * destructive. Removed April 2026 after it broke a notebook-sketch scene.
 */
function aggressiveTypeStrip(code: string): string {
	let result = code;

	// Strip generic call type args: identifier<TypeArgs>(  →  identifier(
	// e.g. `useState<string>(...)` → `useState(...)`
	result = result.replace(/(\b[A-Za-z_][A-Za-z0-9_]*)<[^<>(){}\n;]+>\s*\(/g, "$1(");

	// Strip variable type annotations on const/let/var declarations.
	// `const X: TypeName = ...` or `const X: { ... } = ...` (single line)
	// Best-effort — won't handle deeply nested types but covers common cases.
	result = result.replace(
		/(\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*[^=;\n]+?(\s*=)/g,
		"$1$2",
	);

	return result;
}

export function compileCode(
	tsxCode: string,
	scopeOverride?: Partial<Record<keyof typeof MODULE_SCOPE, unknown>>,
): React.FC<{ screenshots: string[] }> {
	// Step 0: Normalize smart/curly quotes to ASCII quotes.
	// LLMs (especially when "thinking aloud") occasionally output Unicode
	// curly quotes in generated code — most commonly `\u2018` / `\u2019`
	// (single) and `\u201C` / `\u201D` (double). These are invisible to a
	// human reading the log but completely break the JS parser at the
	// exact position of the curly quote. Normalizing them back to straight
	// ASCII quotes is non-destructive for code (the quote chars themselves
	// aren't meaningful — only their matching role is) and fixes a whole
	// class of "Unexpected token, expected ';'" errors where the reported
	// column is at a space just before something that looks fine.
	let code = tsxCode
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"');

	// Step 1: Strip import statements — we inject everything via scope
	// Must handle multi-line destructured imports: import {\n  ...\n} from '...'
	code = code
		.replace(/import\s+[\s\S]*?from\s*['"][^'"]*['"];?/g, "")
		.replace(/import\s+['"][^'"]+['"];?/g, "")
		// Strip `const { ... } = window.RemotionXxx;` — AI sometimes emits this
		// outdated pattern. These names are already provided via MODULE_SCOPE.
		.replace(/(?:const|let|var)\s*\{[\s\S]*?\}\s*=\s*window\.\w+\s*;?/g, "")
		.replace(/(?:const|let|var)\s*\{[\s\S]*?\}\s*=\s*Remotion(?:Transitions)?\s*;?/g, "")
		.trim();

	// Step 1b: Strip TypeScript `: React.FC<...>` annotations.
	// Sucrase chokes on multi-line nested generics with object type literals
	// (e.g. `: React.FC<{ screenshots: string[]; }>` spanning multiple lines).
	// Walk the string and remove `: React.FC` plus any `<...>` that follows,
	// using a balanced bracket counter so we handle nested generics correctly.
	code = stripReactFCAnnotations(code);

	// Step 1c: Convert `const X = ({...}) => {` arrow-function-at-top-level to
	// `function X({...}) {` function declaration form. Sucrase has an edge case
	// where the `(destructuring) =>` pattern at a file's top level sometimes
	// fails with "Unexpected token, expected ';'" — the parser commits to
	// parenthesized-expression interpretation before it sees the `=>` and can't
	// backtrack. Function declaration form avoids the ambiguity entirely.
	// Matches: `const VideoComposition = ({ screenshots }) => {`
	//       or `const App = ({ props, ...rest }) => {`
	// and converts to the `function` equivalent (preserving multi-param destructures).
	code = code.replace(
		/^(\s*)const\s+([A-Z][A-Za-z0-9_$]*)\s*=\s*\(\s*(\{[^}]*\})\s*\)\s*=>\s*\{/m,
		"$1function $2($3) {",
	);

	// Step 1d: Wrap each <CustomScene_N ... /> reference inside the
	// VideoComposition with a per-scene error boundary. The AI occasionally
	// emits scenes with bugs (undefined refs, typos, broken hooks) that crash
	// the entire video — wrapping each one isolates the failure to that
	// scene only. Matches the self-closing form the compiler emits, e.g.
	//   <CustomScene_1 screenshots={screenshots} />
	// and rewrites it to:
	//   <__SafeScene sceneName="CustomScene_1"><CustomScene_1 screenshots={screenshots} /></__SafeScene>
	code = code.replace(
		/<(CustomScene_\d+)((?:\s+[^>]*?)?)\s*\/>/g,
		(_match, name, attrs) => `<__SafeScene sceneName="${name}"><${name}${attrs} /></__SafeScene>`,
	);

	// Step 2: Transform TSX → JS
	let result;
	try {
		result = transform(code, {
			transforms: ["jsx", "typescript"],
			jsxRuntime: "classic",
			production: false,
		});
	} catch (sucraseErr) {
		// Log context around the failure so we can see WHAT Sucrase is choking on
		logSucraseErrorContext(code, sucraseErr, "first pass");
		// Last-resort: strip ALL TypeScript type annotations we can detect with
		// regex (parameter types, generic call type args, simple var annotations)
		// and try Sucrase again. This handles AI-generated code that uses TS
		// patterns Sucrase can't parse cleanly.
		console.warn(
			"[compileCode] Sucrase failed first pass, retrying with aggressive type stripping:",
			sucraseErr instanceof Error ? sucraseErr.message : String(sucraseErr),
		);
		const stripped = aggressiveTypeStrip(code);
		try {
			result = transform(stripped, {
				transforms: ["jsx", "typescript"],
				jsxRuntime: "classic",
				production: false,
			});
		} catch (retryErr) {
			// Still failed — log context from the stripped version and re-throw.
			// DynamicComposition will catch and show the "Compilation Error" UI.
			logSucraseErrorContext(stripped, retryErr, "retry after aggressive strip");
			throw retryErr;
		}
	}
	code = result.code;

	// Step 3: Find the component name and ensure it's returned
	// Look for: export const VideoComposition, export function VideoComposition,
	// export default function, const VideoComposition, etc.
	code = code.replace(/export\s+default\s+/g, "").replace(/export\s+/g, "");

	// Wrap the AI code in an IIFE so its local declarations live in a nested scope
	// and naturally shadow any conflicting scope parameter (e.g. the AI redefining
	// Scene, Card, or even useCurrentFrame) without throwing "already declared" errors.
	// `scopeOverride` lets the validator pass stub hooks (useCurrentFrame, useVideoConfig)
	// so a scene can be invoked outside a Remotion render context for dry-run checks.
	const effectiveScope = scopeOverride ? { ...MODULE_SCOPE, ...scopeOverride } : MODULE_SCOPE;
	const scopeKeys = Object.keys(effectiveScope);
	const scopeValues = scopeKeys.map((k) => (effectiveScope as Record<string, unknown>)[k]);

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
	for (let cm = constRegex.exec(code); cm !== null; cm = constRegex.exec(code)) {
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
	for (let m = tagRegex.exec(code); m !== null; m = tagRegex.exec(code)) {
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
