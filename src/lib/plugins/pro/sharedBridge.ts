// ── Shared Module Bridge ────────────────────────────────────────────────
//
// Exposes host-app dependencies on window.__STUDIO_SHARED__ so the pro
// bundle (studio-pro) can consume them without duplicating React, Remotion,
// 70+ cinematic components, etc.
//
// Call initSharedBridge() at app startup BEFORE the pro bundle loads.

// ── Monaco Editor (lazy-loaded, used by SceneEditor code view) ──
import MonacoEditorImport from "@monaco-editor/react";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
// ── html2canvas (used by visionReview) ──
import html2canvas from "html2canvas";
// ── lucide-react (icons used by scene-builder + demo-studio) ──
import {
	AlertTriangle,
	AlignCenter,
	AlignLeft,
	AlignRight,
	ArrowDown,
	ArrowLeft,
	ArrowRightLeft,
	Bot,
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	Diamond,
	Download,
	Eye,
	Film,
	Globe,
	History,
	Image,
	ImagePlus,
	Layers,
	Loader2,
	Mic,
	MousePointerClick,
	Music,
	Navigation,
	Palette,
	Pause,
	Play,
	Plus,
	Redo2,
	RefreshCw,
	RotateCcw,
	Search,
	Send,
	Sparkles,
	Square,
	Trash2,
	Type,
	Undo2,
	Volume2,
	Wand2,
	X,
} from "lucide-react";
import React, {
	Fragment,
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
// ── react-resizable-panels ──
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
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
// ── sonner ──
import { toast } from "sonner";
// ── UI components ──
import { AISettingsButton } from "@/components/ui/AISettingsDialog";
import { Slider } from "@/components/ui/slider";
import { AnimatedBackgroundPicker } from "@/components/video-editor/AnimatedBackgroundPicker";
// ── Quality gates ──
import {
	auditChoreography,
	checkQuality,
	checkVariation,
	classifyPromise,
	scoreSlideshowRisk,
	validatePromise,
} from "@/lib/ai/qualityGates";
// ── Scene plan types + presets ──
import { BACKGROUND_NAMES, BACKGROUND_PRESETS } from "@/lib/ai/scenePlan";
// ── Production knowledge skills ──
import { SKILL_CONTENT } from "@/lib/ai/skills/content";
// ── Theme system ──
import { buildTheme, resolveTheme, THEME_PRESETS } from "@/lib/ai/themeConfig";
// ── AI types ──
import { AI_PROVIDERS } from "@/lib/ai/types";
// ── Music catalog ──
import {
	buildMusicPrompt,
	generateCustomMusic,
	generateLyrics,
	MUSIC_MOOD_PRESETS,
} from "@/lib/audio/musicCatalog";
// ── CV modules ──
import { analyzeScreenshot } from "@/lib/cv/screenshotAnalyzer";
// ── Demo project store ──
import {
	consumePendingAiComposition,
	consumePendingDemoProject,
	setPendingAiComposition,
	setPendingDemoProject,
} from "@/lib/demoProjectStore";
// ── Plugin registry ──
import { pluginRegistry } from "@/lib/plugins/registry";
// ── compileCode + MODULE_SCOPE ──
import { compileCode, estimateAiDuration, MODULE_SCOPE } from "@/lib/remotion/compileCode";
// ── DynamicPreview + RemotionPreview ──
import { DynamicPreview } from "@/lib/remotion/DynamicPreview";
// ── Audio reactive ──
import { AudioPulse, BeatDot, useAudioPulse } from "@/lib/remotion/helpers/AudioReactive";
// ── Remotion helpers (CinematicHelpers — 70+ components) ──
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
} from "@/lib/remotion/helpers/CinematicHelpers";
// ── Custom transitions ──
import {
	colorBurst,
	diagonalReveal,
	glitchSlam,
	stripedSlam,
	verticalShutter,
	zoomPunch,
} from "@/lib/remotion/helpers/CustomTransitions";
// ── Particle effects ──
import { ImageCrossfade } from "@/lib/remotion/helpers/ImageCrossfade";
// ── Lottie helpers ──
import { LottieBackground, LottieOverlay } from "@/lib/remotion/helpers/LottieHelper";
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
} from "@/lib/remotion/helpers/ParticleEffects";
import { PIXI_PRESETS, PixiOverlay } from "@/lib/remotion/helpers/PixiOverlay";
import {
	CinematicAnime,
	CinematicDocumentary,
	CinematicEpic,
	CinematicNoir,
	CinematicSciFi,
} from "@/lib/remotion/helpers/scenes/CinematicAnimations";
import {
	DataBarChart,
	DataGauge,
	DataPieChart,
	DataProgressBars,
	DataTimeline,
} from "@/lib/remotion/helpers/scenes/DataAnimations";
// ── Scene library (from remotion-scenes) ──
import {
	EffectChromaticAberration,
	EffectDuotone,
	EffectFilmGrain,
	EffectGlow,
	EffectKaleidoscope,
	EffectLightLeak,
	EffectVHS,
} from "@/lib/remotion/helpers/scenes/EffectAnimations";
import {
	LiquidBlob,
	LiquidCalligraphyInk,
	LiquidFluidWave,
	LiquidInkSplash,
	LiquidMorphBlob,
	LiquidSwirl,
} from "@/lib/remotion/helpers/scenes/LiquidAnimations";
import {
	ListHeroWithList,
	ListNumberedVertical,
	ListStaggered,
	ListTimeline,
	ListTwoColumnCompare,
} from "@/lib/remotion/helpers/scenes/ListAnimations";
import {
	Logo3DRotate,
	LogoGlitch,
	LogoLightTrail,
	LogoMaskReveal,
	LogoNeonSign,
	LogoParticles,
	LogoStroke,
} from "@/lib/remotion/helpers/scenes/LogoAnimations";
import {
	Roller3DCarousel,
	RollerFlip,
	RollerGlitch,
	RollerSplitFlap,
	RollerTypewriter,
} from "@/lib/remotion/helpers/scenes/RollerAnimations";
import {
	ShapeCircularProgress,
	ShapeExplosion,
	ShapeHelix,
	ShapeHexGrid,
	ShapeMorphing,
	ShapeRipples,
	ShapeSpinningRings,
} from "@/lib/remotion/helpers/scenes/ShapeAnimations";
import {
	Text3DFlip,
	TextCounter,
	TextExplode,
	TextGradient,
	TextKinetic,
	TextNeon,
	TextScramble,
	TextWave,
} from "@/lib/remotion/helpers/scenes/TextAnimations";
import { RemotionPreview } from "@/lib/remotion/RemotionPreview";
// ── Scene renderer ──
import {
	ALL_ANIMATION_TYPES,
	ANIMATION_TYPE_LABELS,
	captureCanvas,
	DEFAULT_IMAGE_LAYER,
	DEFAULT_VIDEO_LAYER,
	DEFAULT_PROJECT,
	DEFAULT_SCENE,
	DEFAULT_SHAPE_LAYER,
	DEFAULT_TEXT_LAYER,
	exportSceneProject,
	hitTestLayers,
	renderScene,
} from "@/lib/scene-renderer";
// ── Utils ──
import { cn } from "@/lib/utils";

// ── Bridge version — bump when adding/removing exports ──────────────────
export const BRIDGE_VERSION = 1;

/**
 * The shape of window.__STUDIO_SHARED__.
 * Pro bundle's shared.ts accesses this at runtime.
 */
export interface SharedBridge {
	__version: number;

	// React
	React: typeof React;
	useState: typeof useState;
	useEffect: typeof useEffect;
	useMemo: typeof useMemo;
	useCallback: typeof useCallback;
	useRef: typeof useRef;
	Fragment: typeof Fragment;
	lazy: typeof lazy;
	Suspense: typeof Suspense;
	// react-dom/server (used by pro bundle's sceneChecker dry-render harness)
	renderToStaticMarkup: typeof renderToStaticMarkup;

	// Remotion core
	useCurrentFrame: typeof useCurrentFrame;
	useVideoConfig: typeof useVideoConfig;
	spring: typeof spring;
	interpolate: typeof interpolate;
	AbsoluteFill: typeof AbsoluteFill;
	Sequence: typeof Sequence;
	Series: typeof Series;
	Audio: typeof Audio;
	Video: typeof Video;
	Img: typeof Img;
	OffthreadVideo: typeof OffthreadVideo;
	Loop: typeof Loop;
	random: typeof random;
	Easing: typeof Easing;

	// Remotion transitions
	TransitionSeries: typeof TransitionSeries;
	linearTiming: typeof linearTiming;
	springTiming: typeof springTiming;
	fade: typeof fade;
	slide: typeof slide;
	wipe: typeof wipe;

	// react-resizable-panels
	Panel: typeof Panel;
	PanelGroup: typeof PanelGroup;
	PanelResizeHandle: typeof PanelResizeHandle;

	// sonner
	toast: typeof toast;

	// lucide-react
	lucide: Record<string, React.FC<any>>;

	// CinematicHelpers
	Scene: typeof Scene;
	AnimatedText: typeof AnimatedText;
	Card: typeof Card;
	Pill: typeof Pill;
	Underline: typeof Underline;
	GradientText: typeof GradientText;
	ClipReveal: typeof ClipReveal;
	LightStreak: typeof LightStreak;
	GlitchText: typeof GlitchText;
	Vignette: typeof Vignette;
	WordCarousel: typeof WordCarousel;
	ProgressBar: typeof ProgressBar;
	MetricCounter: typeof MetricCounter;
	FloatingOrbs: typeof FloatingOrbs;
	IconGrid: typeof IconGrid;
	Divider: typeof Divider;
	GlowFrame: typeof GlowFrame;
	TypewriterInput: typeof TypewriterInput;
	GhostSentence: typeof GhostSentence;
	WordSlotMachine: typeof WordSlotMachine;
	AvatarConstellation: typeof AvatarConstellation;
	ViewfinderFrame: typeof ViewfinderFrame;
	NotificationCloud: typeof NotificationCloud;
	ChatMessageFlow: typeof ChatMessageFlow;
	StackedText: typeof StackedText;
	GradientMesh: typeof GradientMesh;
	FloatingAppIcon: typeof FloatingAppIcon;
	BlurredUI: typeof BlurredUI;
	DashboardGrid: typeof DashboardGrid;
	CredibilityLogos: typeof CredibilityLogos;
	CharacterCardRow: typeof CharacterCardRow;
	CornerTriangleFrame: typeof CornerTriangleFrame;
	OutlineText: typeof OutlineText;
	RadialTextVortex: typeof RadialTextVortex;
	EchoText: typeof EchoText;
	zoomMorph: typeof zoomMorph;
	CameraText: typeof CameraText;
	AnimatedBackground: typeof AnimatedBackground;
	GlassCard: typeof GlassCard;
	DeviceMockup: typeof DeviceMockup;
	ButtonPill: typeof ButtonPill;
	BackgroundVideo: typeof BackgroundVideo;

	// Custom transitions
	stripedSlam: typeof stripedSlam;
	zoomPunch: typeof zoomPunch;
	diagonalReveal: typeof diagonalReveal;
	colorBurst: typeof colorBurst;
	verticalShutter: typeof verticalShutter;
	glitchSlam: typeof glitchSlam;

	// Particle effects
	Confetti: typeof Confetti;
	Snow: typeof Snow;
	Fireflies: typeof Fireflies;
	Sakura: typeof Sakura;
	Sparks: typeof Sparks;
	PerspectiveGrid: typeof PerspectiveGrid;
	FlowingGradient: typeof FlowingGradient;
	Mist: typeof Mist;
	LightRays: typeof LightRays;
	Bubbles: typeof Bubbles;
	Embers: typeof Embers;
	Stars: typeof Stars;

	// Image crossfade
	ImageCrossfade: typeof ImageCrossfade;

	// PixiJS overlay
	PixiOverlay: typeof PixiOverlay;
	PIXI_PRESETS: typeof PIXI_PRESETS;

	// Lottie
	LottieOverlay: typeof LottieOverlay;
	LottieBackground: typeof LottieBackground;

	// Audio reactive
	useAudioPulse: typeof useAudioPulse;
	AudioPulse: typeof AudioPulse;
	BeatDot: typeof BeatDot;

	// Scene library
	sceneLibrary: Record<string, React.FC<any>>;

	// compileCode
	compileCode: typeof compileCode;
	estimateAiDuration: typeof estimateAiDuration;
	MODULE_SCOPE: typeof MODULE_SCOPE;

	// Previews
	DynamicPreview: typeof DynamicPreview;
	RemotionPreview: typeof RemotionPreview;

	// Plugin registry
	pluginRegistry: typeof pluginRegistry;

	// Scene plan
	BACKGROUND_PRESETS: typeof BACKGROUND_PRESETS;
	BACKGROUND_NAMES: typeof BACKGROUND_NAMES;

	// AI types
	AI_PROVIDERS: typeof AI_PROVIDERS;

	// Music catalog
	MUSIC_MOOD_PRESETS: typeof MUSIC_MOOD_PRESETS;
	buildMusicPrompt: typeof buildMusicPrompt;
	generateCustomMusic: typeof generateCustomMusic;
	generateLyrics: typeof generateLyrics;

	// Scene renderer
	renderScene: typeof renderScene;
	hitTestLayers: typeof hitTestLayers;
	captureCanvas: typeof captureCanvas;
	exportSceneProject: typeof exportSceneProject;
	ALL_ANIMATION_TYPES: typeof ALL_ANIMATION_TYPES;
	ANIMATION_TYPE_LABELS: typeof ANIMATION_TYPE_LABELS;
	DEFAULT_PROJECT: typeof DEFAULT_PROJECT;
	DEFAULT_SCENE: typeof DEFAULT_SCENE;
	DEFAULT_TEXT_LAYER: typeof DEFAULT_TEXT_LAYER;
	DEFAULT_IMAGE_LAYER: typeof DEFAULT_IMAGE_LAYER;
	DEFAULT_VIDEO_LAYER: typeof DEFAULT_VIDEO_LAYER;
	DEFAULT_SHAPE_LAYER: typeof DEFAULT_SHAPE_LAYER;

	// Demo project store
	consumePendingDemoProject: typeof consumePendingDemoProject;
	setPendingDemoProject: typeof setPendingDemoProject;
	consumePendingAiComposition: typeof consumePendingAiComposition;
	setPendingAiComposition: typeof setPendingAiComposition;

	// UI components
	AISettingsButton: typeof AISettingsButton;
	Slider: typeof Slider;
	AnimatedBackgroundPicker: typeof AnimatedBackgroundPicker;

	// CV
	analyzeScreenshot: typeof analyzeScreenshot;

	// Utils
	cn: typeof cn;

	// html2canvas
	html2canvas: typeof html2canvas;

	// Monaco Editor
	MonacoEditor: typeof MonacoEditorImport;

	// Quality gates
	auditChoreography: typeof auditChoreography;
	checkQuality: typeof checkQuality;
	scoreSlideshowRisk: typeof scoreSlideshowRisk;
	checkVariation: typeof checkVariation;
	classifyPromise: typeof classifyPromise;
	validatePromise: typeof validatePromise;

	// Theme system
	buildTheme: typeof buildTheme;
	resolveTheme: typeof resolveTheme;
	THEME_PRESETS: typeof THEME_PRESETS;

	// Production knowledge
	SKILL_CONTENT: typeof SKILL_CONTENT;
}

declare global {
	interface Window {
		__STUDIO_SHARED__?: SharedBridge;
	}
}

// ── Lucide icons map ────────────────────────────────────────────────────
const lucide = {
	AlignCenter,
	AlignLeft,
	AlignRight,
	AlertTriangle,
	ArrowDown,
	ArrowLeft,
	ArrowRightLeft,
	Bot,
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	Film,
	Diamond,
	Download,
	Eye,
	Globe,
	History,
	Image,
	ImagePlus,
	Layers,
	Loader2,
	Mic,
	MousePointerClick,
	Music,
	Navigation,
	Palette,
	Pause,
	Play,
	Plus,
	Redo2,
	RefreshCw,
	RotateCcw,
	Search,
	Send,
	Sparkles,
	Square,
	Trash2,
	Type,
	Undo2,
	Volume2,
	Wand2,
	X,
};

// ── Scene library components map ────────────────────────────────────────
const sceneLibrary = {
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
	DataBarChart,
	DataPieChart,
	DataTimeline,
	DataProgressBars,
	DataGauge,
	ListHeroWithList,
	ListTimeline,
	ListStaggered,
	ListNumberedVertical,
	ListTwoColumnCompare,
	RollerFlip,
	Roller3DCarousel,
	RollerSplitFlap,
	RollerTypewriter,
	RollerGlitch,
};

/**
 * Initialize the shared module bridge. Call once at app startup,
 * before the pro bundle loads.
 */
export function initSharedBridge(): void {
	if (typeof window === "undefined") return;
	if (window.__STUDIO_SHARED__) return; // already initialized

	window.__STUDIO_SHARED__ = {
		__version: BRIDGE_VERSION,

		// React
		React,
		useState,
		useEffect,
		useMemo,
		useCallback,
		useRef,
		Fragment,
		lazy,
		Suspense,
		renderToStaticMarkup,

		// Remotion core
		useCurrentFrame,
		useVideoConfig,
		spring,
		interpolate,
		AbsoluteFill,
		Sequence,
		Series,
		Audio,
		Video,
		Img,
		OffthreadVideo,
		Loop,
		random,
		Easing,

		// Remotion transitions
		TransitionSeries,
		linearTiming,
		springTiming,
		fade,
		slide,
		wipe,

		// react-resizable-panels
		Panel,
		PanelGroup,
		PanelResizeHandle,

		// sonner
		toast,

		// lucide-react
		lucide,

		// CinematicHelpers
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

		// Particle effects
		Confetti,
		Snow,
		Fireflies,
		Sakura,
		Sparks,
		PerspectiveGrid,
		FlowingGradient,
		Mist,
		LightRays,
		Bubbles,
		Embers,
		Stars,

		// Image crossfade
		ImageCrossfade,

		// PixiJS overlay
		PixiOverlay,
		PIXI_PRESETS,

		// Lottie
		LottieOverlay,
		LottieBackground,

		// Audio reactive
		useAudioPulse,
		AudioPulse,
		BeatDot,

		// Scene library
		sceneLibrary,

		// compileCode
		compileCode,
		estimateAiDuration,
		MODULE_SCOPE,

		// Previews
		DynamicPreview,
		RemotionPreview,

		// Plugin registry
		pluginRegistry,

		// Scene plan
		BACKGROUND_PRESETS,
		BACKGROUND_NAMES,

		// AI types
		AI_PROVIDERS,

		// Music catalog
		MUSIC_MOOD_PRESETS,
		buildMusicPrompt,
		generateCustomMusic,
		generateLyrics,

		// Scene renderer
		renderScene,
		hitTestLayers,
		captureCanvas,
		exportSceneProject,
		ALL_ANIMATION_TYPES,
		ANIMATION_TYPE_LABELS,
		DEFAULT_PROJECT,
		DEFAULT_SCENE,
		DEFAULT_TEXT_LAYER,
		DEFAULT_IMAGE_LAYER,
		DEFAULT_VIDEO_LAYER,
		DEFAULT_SHAPE_LAYER,

		// Demo project store
		consumePendingDemoProject,
		setPendingDemoProject,
		consumePendingAiComposition,
		setPendingAiComposition,

		// UI components
		AISettingsButton,
		Slider,
		AnimatedBackgroundPicker,

		// CV
		analyzeScreenshot,

		// Utils
		cn,

		// html2canvas
		html2canvas,

		// Monaco Editor
		MonacoEditor: MonacoEditorImport,

		// Quality gates
		auditChoreography,
		checkQuality,
		scoreSlideshowRisk,
		checkVariation,
		classifyPromise,
		validatePromise,

		// Theme system
		buildTheme,
		resolveTheme,
		THEME_PRESETS,

		// Production knowledge
		SKILL_CONTENT,
	};

	// Make React globally available for pro bundle JSX (esbuild compiles JSX
	// to React.createElement, which needs React in the global scope)
	(window as any).React = React;

	console.log(`[SharedBridge] Initialized v${BRIDGE_VERSION}`);
}
