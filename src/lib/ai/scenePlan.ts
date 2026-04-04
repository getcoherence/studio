// ── Scene Plan ──────────────────────────────────────────────────────────
//
// Structured JSON representation of a cinematic video composition.
// The AI generates this plan, which is editable in the UI and then
// compiled to Remotion code by the code generator.

export interface ScenePlanItem {
	/** Scene type determines the visual template */
	type:
		| "hero-text"
		| "full-bleed"
		| "split-layout"
		| "cards"
		| "screenshot"
		| "cta"
		| "glitch-intro"
		| "stacked-text";
	/** Main headline text */
	headline: string;
	/** Optional subtitle or supporting text */
	subtitle?: string;
	/** Background — CSS color, gradient, or preset name */
	background: string;
	/** Text animation style */
	animation:
		| "chars"
		| "words"
		| "scale"
		| "clip"
		| "gradient"
		| "glitch"
		| "blur-in"
		| "bounce"
		| "wave";
	/** Font family preset */
	font: "serif" | "sans-serif" | "mono" | "condensed" | "wide";
	/** Font size for the headline */
	fontSize: number;
	/** One word to accent with the brand color */
	accentWord?: string;
	/** Duration in frames */
	durationFrames: number;
	/** Effects to apply */
	effects: ("vignette" | "light-streak" | "clip-reveal")[];
	/** For cards type: list of feature cards */
	cards?: Array<{ title: string; description: string }>;
	/** For screenshot type: which screenshot index to use */
	screenshotIndex?: number;
	/** For split-layout: right-side content type */
	rightContent?: "cards" | "pills" | "screenshot";
	/** Lottie animation overlay — filename in public/lottie/ or URL */
	lottieOverlay?: string;
	/** Lottie background — filename in public/lottie/ or URL */
	lottieBackground?: string;
	/** Composable layers within this scene — enables multi-layer compositions */
	layers?: SceneLayer[];
}

/** A positioned, timed layer within a scene */
export interface SceneLayer {
	id: string;
	type: "text" | "lottie" | "image" | "shape";
	/** Content — text string, lottie filename, image URL, or shape type */
	content: string;
	/** Position preset or custom coordinates */
	position:
		| "center"
		| "top-left"
		| "top-right"
		| "bottom-left"
		| "bottom-right"
		| "top"
		| "bottom"
		| "left"
		| "right";
	/** Size as % of frame (default: 50) */
	size: number;
	/** Start frame within the scene (0 = scene start) */
	startFrame: number;
	/** End frame within the scene (-1 = scene end) */
	endFrame: number;
	/** Layer-specific settings */
	settings?: {
		fontSize?: number;
		color?: string;
		animation?: string;
		fontFamily?: string;
		accentWord?: string;
		accentColor?: string;
		opacity?: number;
		loop?: boolean;
	};
}

export interface ScenePlan {
	/** Product/video name */
	title: string;
	/** Brand accent color */
	accentColor: string;
	/** Scene sequence */
	scenes: ScenePlanItem[];
}

// ── Background presets ──────────────────────────────────────────────────

export const BACKGROUND_PRESETS: Record<string, string> = {
	white: "#fafafa",
	cream: "#f5f0e8",
	black: "#050505",
	charcoal: "#1a1a1a",
	navy: "linear-gradient(180deg, #0a0f1e 0%, #050810 100%)",
	"brand-dark": "linear-gradient(135deg, #0a0a1a 0%, #0d1a2e 100%)",
	"deep-purple": "linear-gradient(180deg, #0f0520 0%, #050210 100%)",
};

export const BACKGROUND_NAMES = Object.keys(BACKGROUND_PRESETS);
