// ── Scene Plan ──────────────────────────────────────────────────────────
//
// Structured JSON representation of a cinematic video composition.
// The AI generates this plan, which is editable in the UI and then
// compiled to Remotion code by the code generator.

export type SceneType =
	// Original types
	| "hero-text"
	| "full-bleed"
	| "split-layout"
	| "cards"
	| "screenshot"
	| "cta"
	| "glitch-intro"
	| "stacked-text"
	// Rich scene types extracted from motion design patterns
	| "impact-word" // single massive word, 240-320px
	| "ghost-hook" // sentence fragmentation with ghost future words
	| "notification-chaos" // platform notification cards scattered around a claim
	| "chat-narrative" // progressive chat UI with urgent messages
	| "before-after" // animated split-screen problem vs solution
	| "metrics-dashboard" // 2-3 MetricCounters with dividers
	| "icon-showcase" // IconGrid with labeled feature icons
	| "logo-reveal" // GradientText + FloatingOrbs + LightStreak brand moment
	| "typewriter-prompt" // TypewriterInput hero component on dark
	| "timeline-chaos" // recreated messy video editor
	| "process-ladder" // 3-card RAW → AI → FINISHED progression
	| "product-glow" // tilted screenshot with perspective glow frame
	| "collapse" // shrinking bars animating into a final output card
	| "stacked-hierarchy" // StackedText with dramatic size hierarchy
	// Round 2: additional rich patterns
	| "radial-vortex" // concentric text rings spiraling outward
	| "outline-hero" // hollow stroke-only typography
	| "echo-hero" // text with motion-blur zoom trail
	| "word-slot-machine" // vertical word list with one bolded
	| "avatar-constellation" // social proof avatars orbiting a claim
	| "gradient-mesh-hero" // soft pastel mesh bg with centered text
	| "dashboard-deconstructed" // floating metric cards with chart line
	| "browser-tabs-chaos" // recreated browser chrome with too many tabs
	| "app-icon-cloud" // 3D app icons scattered in space
	| "data-flow-network" // nodes connected by animated lines
	| "camera-text" // cinematic camera-in-text animation with scale + typewriter + logo inject
	| "scrolling-list" // 4-6 lines scrolling up sequentially, all visible at end (alternative to slot wheel)
	// Phase 3: cinematic scene types
	| "device-showcase" // screenshot in laptop/phone mockup with floating animation
	| "glass-stats" // glassmorphism cards with animated metric counters
	| "cinematic-title" // gradient text with particle effects
	| "countdown"; // animated number countdown with confetti burst

export interface ScenePlanItem {
	/** Stable unique ID for React keys — survives reordering/insertion */
	_id?: string;
	/** Scene type determines the visual template */
	type: SceneType;
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
		| "wave"
		| "typewriter"
		| "staccato"
		| "split"
		| "drop"
		| "scramble"
		| "matrix"
		| "rotate-3d"
		| "glitch-in";
	/** Font family preset */
	font: "serif" | "sans-serif" | "mono" | "condensed" | "wide";
	/** Font size for the headline */
	fontSize: number;
	/** One word to accent with the brand color */
	accentWord?: string;
	/** Visual variant within this scene type — different layout/animation treatment.
	 * Each scene type has 3-5 variants so no two videos look identical. If omitted,
	 * the compiler picks the default (usually the original visual). */
	variant?: string;
	/** Duration in frames */
	durationFrames: number;
	/** Effects to apply */
	effects: ("vignette" | "light-streak" | "clip-reveal")[];
	/** For cards type: list of feature cards */
	cards?: Array<{ title: string; description: string }>;
	/** For screenshot/product-glow/device-showcase: which screenshot index to use */
	screenshotIndex?: number;
	/** For countdown: target number to count up to */
	countdownTarget?: number;
	/** For split-layout: right-side content type */
	rightContent?: "cards" | "pills" | "screenshot";
	/** Lottie animation overlay — filename in public/lottie/ or URL */
	lottieOverlay?: string;
	/** Lottie background — filename in public/lottie/ or URL */
	lottieBackground?: string;

	// ── Rich scene type data fields ──

	/** For ghost-hook: all words in the full sentence */
	ghostWords?: string[];
	/** For ghost-hook: which word index is currently "revealed" (0 = first only) */
	ghostActiveIndex?: number;
	/** For notification-chaos: the platform notifications to display */
	notifications?: Array<{
		platform: "instagram" | "linkedin" | "twitter" | "youtube" | "email" | "slack" | "generic";
		title: string;
		subtitle?: string;
		time?: string;
	}>;
	/** For chat-narrative: the chat messages to display progressively */
	chatMessages?: Array<{ user: string; text: string; time?: string }>;
	/** For chat-narrative: channel name (e.g. "dev-squad") */
	chatChannel?: string;
	/** For before-after: the problem state text lines */
	beforeLines?: string[];
	/** For before-after: the solution state text lines */
	afterLines?: string[];
	/** For metrics-dashboard: the metrics to display (2-3 recommended) */
	metrics?: Array<{ value: number; label: string; suffix?: string; prefix?: string }>;
	/** For icon-showcase: the feature items with icon + label */
	iconItems?: Array<{ icon: string; label: string }>;
	/** For process-ladder: the 3 step cards (RAW, AI, FINISHED) */
	processSteps?: Array<{ eyebrow: string; title: string; items?: string[]; color?: string }>;
	/** For typewriter-prompt: the placeholder text being typed */
	typewriterText?: string;
	/** For product-glow: 3D perspective tilt (default 12deg X, -4deg Y) */
	perspectiveX?: number;
	perspectiveY?: number;
	/** For stacked-hierarchy: multiple text lines with varying sizes */
	stackedLines?: Array<{ text: string; size: number }>;
	/** For word-slot-machine: prefix + list of options + which is selected */
	slotMachinePrefix?: string;
	slotMachineWords?: string[];
	slotMachineSelectedIndex?: number;
	/** For avatar-constellation: center claim (uses headline) + avatar count */
	avatarCount?: number;
	/** For dashboard-deconstructed: metric cards to display */
	dashboardMetrics?: Array<{ label: string; value: string; delta?: string; color?: string }>;
	/** For browser-tabs-chaos: tab labels (e.g. ['linkedin.com', 'twitter.com', ...]) */
	browserTabs?: string[];
	/** For app-icon-cloud: 3D floating app icons */
	appIcons?: Array<{ icon: string; color?: string; label?: string }>;
	/** For data-flow-network: node labels (nodes will auto-connect with animated lines) */
	networkNodes?: string[];
	/** For gradient-mesh-hero: background color palette */
	meshColors?: string[];
	/** For camera-text: words with appearsAt timing and optional colors/logo */
	cameraTextWords?: Array<{
		text: string;
		appearsAt: number;
		color?: string;
		isLogo?: boolean;
		logoContent?: string;
		logoColor?: string;
	}>;
	/** For camera-text: camera keyframes (scale/translate over time) */
	cameraTextCamera?: Array<{
		frame: number;
		scale?: number;
		translateX?: number;
		translateY?: number;
	}>;
	/** For scrolling-list: the lines that scroll up sequentially. All stay visible at end. */
	scrollingListLines?: Array<{ text: string; color?: string }>;
	/** Animated background layer — adds motion/color variety behind any scene.
	 * Variants: flowing-lines, drifting-orbs, mesh-shift, particle-field, grain, pulse-grid, aurora, none */
	backgroundEffect?:
		| "none"
		| "flowing-lines"
		| "drifting-orbs"
		| "mesh-shift"
		| "particle-field"
		| "grain"
		| "pulse-grid"
		| "aurora"
		| "spotlight"
		| "wave-grid"
		| "gradient-wipe"
		| "bokeh"
		| "liquid-glass"
		| "confetti"
		| "snow"
		| "fireflies"
		| "sakura"
		| "sparks"
		| "perspective-grid"
		| "flowing-gradient";
	/** Colors for the animated background effect (defaults to brand accent + complementary) */
	backgroundEffectColors?: string[];
	/** Intensity/opacity of the background effect (0-1, default 0.7) */
	backgroundEffectIntensity?: number;
	/** Transition TO the next scene. The compiler injects real TransitionSeries.Transition
	 * elements between scenes using the type specified here. If omitted, a smart default
	 * is picked based on the scene type. */
	transitionOut?:
		| "fade"
		| "slide-left" // new scene slides in from the right, old pushes out to left
		| "slide-right" // new scene slides in from the left
		| "slide-up" // new scene comes in from the bottom, old pushes up
		| "slide-down" // new scene comes in from the top, old pushes down
		| "wipe-left"
		| "wipe-right"
		| "wipe-up"
		| "wipe-down"
		| "zoom-morph" // fly THROUGH the current scene into the next
		| "striped-slam" // horizontal bars slam in from both sides
		| "zoom-punch" // old retreats, new punches in with cubic ease
		| "diagonal-reveal" // dark panel sweeps with accent line
		| "color-burst" // sharp radial flash at the cut
		| "vertical-shutter" // venetian blind panels snap shut/open
		| "glitch-slam" // horizontal shake + RGB strip tears
		| "cut"; // instant, no transition
	/** Transition duration in frames (default 10, or 15 for zoom-morph) */
	transitionDurationFrames?: number;

	/** Composable layers within this scene — enables multi-layer compositions */
	layers?: SceneLayer[];
}

/** A positioned, timed layer within a scene */
export interface SceneLayer {
	id: string;
	type:
		| "text"
		| "card"
		| "lottie"
		| "image"
		| "shape"
		| "word-carousel"
		| "progress-bar"
		| "metric-counter"
		| "icon-grid"
		| "divider";
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
		/** Spring damping — lower = bouncier (default 14) */
		damping?: number;
		/** Spring stiffness — higher = faster (default 180) */
		stiffness?: number;
		/** Stagger delay between elements in frames (default 2) */
		stagger?: number;
		/** Text glow CSS (e.g., "0 0 40px currentColor") */
		glow?: string;
		/** Text drop shadow CSS (e.g., "4px 4px 0px rgba(0,0,0,0.5)") */
		shadow?: string;
		/** Text outline/stroke width (e.g., "2px") */
		outline?: string;
	};
}

export interface ScenePlan {
	/** Product/video name */
	title: string;
	/** Brand accent color */
	accentColor: string;
	/** Brand logo URL (data URL or remote) — used in CTA and logo-reveal scenes */
	logoUrl?: string;
	/** Website URL — displayed in the CTA/outro scene */
	websiteUrl?: string;
	/** Scene sequence */
	scenes: ScenePlanItem[];
	/** If true, this plan was synthesized from generated code and edits should NOT
	 * trigger a recompile (which would overwrite the AI code with the boring template). */
	readonly?: boolean;
	/** AI-suggested music mood preset for automatic music generation. Set by the
	 * plan generator based on the video's narrative arc and brand feel. */
	musicMood?: string;
	/** Creative Director conversation history — persisted so the user can
	 * continue refining across sessions. */
	directorHistory?: Array<{ role: "user" | "director"; content: string }>;
}

// ── Background presets ──────────────────────────────────────────────────

export const BACKGROUND_PRESETS: Record<string, string> = {
	// ── Light solids ──
	white: "#fafafa",
	cream: "#f5f0e8",
	"warm-gray": "#e8e4e0",
	"cool-gray": "#e2e6ea",
	"soft-blue": "#e8f0f8",
	"soft-green": "#e8f5e8",
	"soft-rose": "#f8e8ee",
	"soft-peach": "#fdf0e6",
	"soft-lavender": "#f0e8f8",
	"soft-mint": "#e6f8f0",
	"soft-amber": "#f8f0e0",
	// ── Light gradients ──
	"warm-light": "linear-gradient(135deg, #fdf8f0 0%, #f5ebe0 100%)",
	"sky-light": "linear-gradient(180deg, #e8f4fd 0%, #f5f9fc 100%)",
	"rose-light": "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
	"mint-light": "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
	// ── Dark solids ──
	black: "#050505",
	charcoal: "#1a1a1a",
	"dark-slate": "#0f1419",
	"dark-teal": "#0a1a1a",
	"dark-wine": "#1a0a10",
	"dark-forest": "#0a150a",
	"dark-indigo": "#0a0a20",
	// ── Dark gradients ──
	navy: "linear-gradient(180deg, #0a0f1e 0%, #050810 100%)",
	"brand-dark": "linear-gradient(135deg, #0a0a1a 0%, #0d1a2e 100%)",
	"deep-purple": "linear-gradient(180deg, #0f0520 0%, #050210 100%)",
	"midnight-teal": "linear-gradient(135deg, #041418 0%, #0a1a1e 100%)",
	"warm-night": "linear-gradient(135deg, #1a0f0a 0%, #0f0805 100%)",
	"steel-gradient": "linear-gradient(180deg, #1c1f26 0%, #0d0f14 100%)",
	"aurora-dark": "linear-gradient(135deg, #0a0f1e 0%, #0f1a0f 50%, #1a0f15 100%)",
	"ember-dark": "linear-gradient(135deg, #1a0a05 0%, #0f0502 100%)",
	"ocean-dark": "linear-gradient(180deg, #020a1a 0%, #041428 100%)",
	"neon-dark": "linear-gradient(135deg, #0a001a 0%, #1a0030 100%)",
};

export const BACKGROUND_NAMES = Object.keys(BACKGROUND_PRESETS);
