// ── Scene Plan ──────────────────────────────────────────────────────────
//
// Structured JSON representation of a cinematic video composition.
// The AI generates this plan, which is editable in the UI and then
// compiled to Remotion code by the code generator.

export interface ScenePlanItem {
	/** Scene type determines the visual template */
	type: "hero-text" | "split-layout" | "cards" | "screenshot" | "cta" | "glitch-intro";
	/** Main headline text */
	headline: string;
	/** Optional subtitle or supporting text */
	subtitle?: string;
	/** Background — CSS color, gradient, or preset name */
	background: string;
	/** Text animation style */
	animation: "chars" | "words" | "scale" | "clip" | "gradient" | "glitch";
	/** Font family preset */
	font: "serif" | "sans-serif";
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
