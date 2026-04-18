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
	| "countdown" // animated number countdown with confetti burst
	| "contrast-pairs" // statement/counter pairs with staggered reveals
	// Phase 4: animation engine additions
	| "image-crossfade"; // multi-image crossfade with camera motion (2-4 images)

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
	/** For before-after: custom background color for left (Before) panel */
	beforeBgColor?: string;
	/** For before-after: custom background color for right (After) panel */
	afterBgColor?: string;
	/** For before-after: custom accent/header color for the After side */
	afterAccentColor?: string;
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
	/** For contrast-pairs: alternating statement/counter pairs with staggered reveals */
	contrastPairs?: Array<{ statement: string; counter: string }>;
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
		| "flowing-gradient"
		| "money-rain";
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
		// Cinematic 3D transitions
		| "zoom-through" // camera flies through current scene into next — portal feel
		| "portal" // circular reveal expanding from focal point with glow
		| "depth-parallax" // 3D perspective shift — scenes in spatial depth
		| "warp-dissolve" // reality warps and bends — dimension shift
		| "iris-zoom" // camera aperture closes, reveals new scene
		| "shatter" // scene breaks into shards flying outward
		| "cut"; // instant, no transition
	/** Transition duration in frames (default 10, or 15 for zoom-morph) */
	transitionDurationFrames?: number;
	/** Custom color for transitions that support it (vertical-shutter, striped-slam, diagonal-reveal, color-burst) */
	transitionColor?: string;

	/** When set, this raw Remotion TSX code replaces the template renderer for this scene.
	 *  The code has access to all MODULE_SCOPE components (useCurrentFrame, spring,
	 *  interpolate, AbsoluteFill, AnimatedText, GlassCard, MetricCounter, particles, etc.)
	 *  and receives `screenshots` as a prop. Must export VideoComposition or be a JSX
	 *  expression wrapped in <AbsoluteFill>. Falls back to the template if compilation fails. */
	customCode?: string;
	/** Director-supplied instruction for the Composer when regenerating customCode.
	 *  Guides the Composer to preserve specific elements or make targeted changes
	 *  (e.g. "keep the browser mockup but make the headline larger"). */
	composerDirective?: string;

	/** AI video generation prompt — when set, this scene uses an AI-generated video clip
	 *  instead of (or composited with) Remotion motion graphics. */
	videoPrompt?: string;
	/** Local file path to a generated/downloaded video clip (populated at generation time) */
	videoClipPath?: string;
	/** Whether to overlay Remotion text/layers on top of the video clip (default: true) */
	videoOverlayText?: boolean;

	// ── Narration (Story Writer + Narrator step) ──

	/** Voice-over text for this scene, written by the Story Writer agent.
	 *  When set, the Narrator step synthesizes this via MiniMax TTS and the
	 *  compiler emits an <Audio> element that plays alongside the visuals. */
	narration?: string;
	/** Absolute file path to the synthesized narration audio (mp3). Populated
	 *  by the Narrator step after TTS completes. */
	narrationPath?: string;
	/** Duration of the narration audio in milliseconds. Used by the duration
	 *  adjuster to ensure the scene runs at least as long as the voice-over. */
	narrationDurationMs?: number;

	// ── Sound effects (Sound Designer agent) ──

	/** SFX cues for this scene — each plays a single clip at a specific frame.
	 *  Picked by the Sound Designer agent based on motion and headline keywords. */
	sfxCues?: Array<{
		/** Clip name from the bundled SFX library (e.g. "whoosh", "pop", "thud") */
		sfx: string;
		/** Frame offset within this scene where the SFX should start */
		atFrame: number;
		/** Volume multiplier 0-1 (default 0.6 — SFX should not overpower narration) */
		volume?: number;
	}>;

	// ── Generated imagery (Image Generator agent) ──

	/** When set, an AI-generated reference/background image is available for
	 *  this scene. The compiler can use it as a backdrop (blurred, low opacity)
	 *  or the Composer can reference its subject for illustration. */
	imagePath?: string;
	/** Prompt used to generate imagePath — kept so users can regenerate later. */
	imagePrompt?: string;

	/** Gap between center-positioned layers in pixels (default 16) */
	layerGap?: number;
	/** Composable layers within this scene — enables multi-layer compositions */
	layers?: SceneLayer[];

	// ── Shot Language (cinematography intent) ──

	/** Structured cinematography intent — guides the AI code generator's
	 *  visual treatment decisions. Inspired by OpenMontage's shot language. */
	shotIntent?: {
		/** Shot size hint */
		shotSize?:
			| "extreme-wide"
			| "wide"
			| "medium-wide"
			| "medium"
			| "medium-close"
			| "close"
			| "extreme-close";
		/** Camera movement to simulate */
		cameraMovement?:
			| "static"
			| "pan-left"
			| "pan-right"
			| "tilt-up"
			| "tilt-down"
			| "zoom-in"
			| "zoom-out"
			| "dolly"
			| "drift";
		/** Lighting style */
		lightingKey?: "high" | "low" | "silhouette" | "rim" | "dramatic" | "natural";
		/** Depth effect */
		depthOfField?: "deep" | "shallow";
		/** Narrative purpose of this scene */
		narrativeRole?: "hook" | "problem" | "solution" | "evidence" | "transition" | "climax" | "cta";
		/** Information role */
		informationRole?:
			| "introduce"
			| "explain"
			| "demonstrate"
			| "compare"
			| "summarize"
			| "persuade";
	};

	// ── Image Crossfade (multi-image scene) ──

	/** For image-crossfade: 2-4 image URLs to crossfade between */
	crossfadeImages?: string[];
	/** For image-crossfade: camera animation type */
	crossfadeAnimation?:
		| "ken-burns"
		| "pan"
		| "drift-up"
		| "drift-down"
		| "parallax"
		| "zoom-in"
		| "zoom-out";
	/** For image-crossfade: particle overlay type */
	crossfadeParticles?: "fireflies" | "petals" | "sparkles" | "mist" | "light-rays" | "none";
}

/** A positioned, timed layer within a scene */
export interface SceneLayer {
	id: string;
	/** When true, this layer exists from a previous scene type and isn't rendered
	 *  by the current type's renderer. Shown as dimmed in the UI but not deleted,
	 *  so switching back to the original type restores them. */
	_incompatible?: boolean;
	type:
		| "text"
		| "button"
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
		/** Font weight override (e.g., "bold") */
		fontWeight?: string;
		/** Font style override (e.g., "italic") */
		fontStyle?: string;
		/** Text decoration (e.g., "underline", "line-through") */
		textDecoration?: string;
		/** Extra spacing below this layer in pixels (adds margin-bottom) */
		spacingAfter?: number;
		/** Border color for button layers */
		borderColor?: string;
	};
}

// ── Independent narration clip ────────────────────────────────────────

export interface NarrationClip {
	id: string;
	text: string;
	audioPath: string;
	durationMs: number;
	startFrame: number;
	durationInFrames: number;
	volume: number;
	sourceSceneIndex?: number;
	sourceSceneHeadline?: string;
	voiceId?: string;
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

	// ── Narration flags (Story Writer + Narrator step) ──

	/** True when every scene has a `narration` field populated by the Story
	 *  Writer agent. The Narrator step reads this to decide whether to run. */
	hasNarration?: boolean;
	/** MiniMax voice ID used for this video's narration (e.g. "English_expressive_narrator").
	 *  If omitted, the Narrator step picks a voice based on the active aesthetic. */
	narrationVoiceId?: string;
	/** When true, the Remotion export ducks music volume during narration. */
	duckMusicDuringNarration?: boolean;
	/** Independent narration clips — decoupled from scenes. Each clip has its
	 *  own position and duration in the global timeline and survives scene
	 *  deletion/reordering. Populated by the Narrator step; editable in the
	 *  Narration tab. Falls back to per-scene narrationPath if absent. */
	narrationClips?: NarrationClip[];

	// ── Animation Engine additions ──

	/** Theme configuration — drives all visual decisions (colors, motion, typography).
	 *  When set, overrides individual accent/background defaults. */
	theme?: import("./themeConfig").ThemeConfig;
	/** Theme preset name — shorthand for a full ThemeConfig */
	themePreset?: string;
	/** Quality assessment — populated after running quality gates */
	qualityScore?: import("./qualityGates").SlideshowRiskResult;
	/** What this video promises to deliver — classified from scene content */
	deliveryPromise?: import("./qualityGates").DeliveryPromiseType;
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
