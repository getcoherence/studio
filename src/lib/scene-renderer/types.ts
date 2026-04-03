// ── Scene Builder Data Model ──────────────────────────────────────────────

export interface SceneProject {
	id: string;
	name: string;
	styleId?: string;
	scenes: Scene[];
	resolution: { width: number; height: number };
	fps: number;
}

export interface Scene {
	id: string;
	durationMs: number;
	background: string; // wallpaper ID (static color or animated background)
	animatedBgSpeed: number;
	transition: SceneTransition;
	layers: SceneLayer[];
}

export interface SceneTransition {
	type: "none" | "fade" | "wipe-left" | "wipe-right" | "wipe-up" | "dissolve" | "zoom";
	durationMs: number;
}

export interface SceneLayer {
	id: string;
	type: "text" | "image" | "shape" | "lottie";
	startMs: number; // relative to scene start
	endMs: number;
	position: { x: number; y: number }; // percentage (0-100)
	size: { width: number; height: number }; // percentage (0-100)
	zIndex: number;
	entrance: LayerAnimation;
	exit: LayerAnimation;
	content: TextContent | ImageContent | ShapeContent | LottieContent;
}

// ── Content types ─────────────────────────────────────────────────────────

export interface TextContent {
	text: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: string;
	color: string;
	backgroundColor?: string;
	textAlign: "left" | "center" | "right";
	lineHeight: number;
}

export interface ImageContent {
	src: string; // data URL or file path
	fit: "cover" | "contain" | "fill";
	borderRadius: number;
	shadow: boolean;
	/** Crop region (0-1 normalized). Only this region of the source image is shown. */
	cropRegion?: { x: number; y: number; width: number; height: number };
}

export interface ShapeContent {
	shape: "rectangle" | "circle" | "rounded-rect";
	fill: string;
	stroke?: string;
	strokeWidth?: number;
}

export interface LottieContent {
	/** ID referencing a Lottie asset from the catalog */
	animationId: string;
	/** Whether the animation should loop */
	loop: boolean;
	/** Playback speed multiplier (1 = normal) */
	speed: number;
	/** Optional tint color override */
	tintColor?: string;
}

// ── Animations ────────────────────────────────────────────────────────────

export type AnimationType =
	| "none"
	| "fade"
	| "slide-left"
	| "slide-right"
	| "slide-up"
	| "slide-down"
	| "typewriter"
	| "bounce"
	| "zoom-in"
	| "zoom-out"
	| "blur-in"
	| "wipe"
	| "ken-burns"
	| "rotate-in";

export interface LayerAnimation {
	type: AnimationType;
	durationMs: number;
	easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
	delay: number;
	/** Focus point for ken-burns (0-1 normalized). Default: center {x:0.5, y:0.5} */
	focusPoint?: { x: number; y: number };
}

export interface LayerTransform {
	opacity: number;
	x: number; // pixel offset
	y: number;
	scaleX: number;
	scaleY: number;
	rotation: number; // degrees
	clipProgress: number; // 0-1 for wipe (1 = fully revealed)
	blur: number; // px
	visibleChars: number; // -1 = all visible
}

export const ANIMATION_TYPE_LABELS: Record<AnimationType, string> = {
	none: "None",
	fade: "Fade",
	"slide-left": "Slide Left",
	"slide-right": "Slide Right",
	"slide-up": "Slide Up",
	"slide-down": "Slide Down",
	typewriter: "Typewriter",
	bounce: "Bounce",
	"zoom-in": "Zoom In",
	"zoom-out": "Zoom Out",
	"blur-in": "Blur In",
	wipe: "Wipe",
	"ken-burns": "Ken Burns",
	"rotate-in": "Rotate In",
};

export const ALL_ANIMATION_TYPES: AnimationType[] = [
	"none",
	"fade",
	"slide-left",
	"slide-right",
	"slide-up",
	"slide-down",
	"typewriter",
	"bounce",
	"zoom-in",
	"zoom-out",
	"blur-in",
	"wipe",
	"ken-burns",
	"rotate-in",
];

// ── Factory functions ─────────────────────────────────────────────────────

let _nextId = 1;
function uid(): string {
	return `scene-${Date.now()}-${_nextId++}`;
}

export function DEFAULT_ANIMATION(): LayerAnimation {
	return { type: "none", durationMs: 500, easing: "ease-out", delay: 0 };
}

export function DEFAULT_SCENE(): Scene {
	return {
		id: uid(),
		durationMs: 5000,
		background: "#09090b",
		animatedBgSpeed: 1,
		transition: { type: "none", durationMs: 500 },
		layers: [],
	};
}

export function DEFAULT_TEXT_LAYER(overrides?: Partial<SceneLayer>): SceneLayer {
	return {
		id: uid(),
		type: "text",
		startMs: 0,
		endMs: 5000,
		position: { x: 10, y: 30 },
		size: { width: 80, height: 20 },
		zIndex: 1,
		entrance: { type: "fade", durationMs: 500, easing: "ease-out", delay: 0 },
		exit: DEFAULT_ANIMATION(),
		content: {
			text: "Your text here",
			fontSize: 48,
			fontFamily: "Inter, system-ui, sans-serif",
			fontWeight: "600",
			color: "#ffffff",
			textAlign: "center",
			lineHeight: 1.4,
		} satisfies TextContent,
		...overrides,
	};
}

export function DEFAULT_IMAGE_LAYER(overrides?: Partial<SceneLayer>): SceneLayer {
	return {
		id: uid(),
		type: "image",
		startMs: 0,
		endMs: 5000,
		position: { x: 20, y: 15 },
		size: { width: 60, height: 60 },
		zIndex: 0,
		entrance: { type: "zoom-in", durationMs: 600, easing: "ease-out", delay: 0 },
		exit: DEFAULT_ANIMATION(),
		content: {
			src: "",
			fit: "contain",
			borderRadius: 8,
			shadow: true,
		} satisfies ImageContent,
		...overrides,
	};
}

export function DEFAULT_SHAPE_LAYER(overrides?: Partial<SceneLayer>): SceneLayer {
	return {
		id: uid(),
		type: "shape",
		startMs: 0,
		endMs: 5000,
		position: { x: 35, y: 35 },
		size: { width: 30, height: 30 },
		zIndex: 0,
		entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 0 },
		exit: DEFAULT_ANIMATION(),
		content: {
			shape: "rounded-rect",
			fill: "#2563eb",
			stroke: undefined,
			strokeWidth: 0,
		} satisfies ShapeContent,
		...overrides,
	};
}

export function DEFAULT_PROJECT(): SceneProject {
	const introScene: Scene = {
		...DEFAULT_SCENE(),
		background: "animated-aurora",
		layers: [
			DEFAULT_TEXT_LAYER({
				position: { x: 10, y: 35 },
				size: { width: 80, height: 15 },
				content: {
					text: "Welcome to Scene Builder",
					fontSize: 64,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "700",
					color: "#ffffff",
					textAlign: "center",
					lineHeight: 1.2,
				},
				entrance: { type: "fade", durationMs: 800, easing: "ease-out", delay: 0 },
			}),
			DEFAULT_TEXT_LAYER({
				position: { x: 20, y: 55 },
				size: { width: 60, height: 10 },
				zIndex: 2,
				content: {
					text: "Create polished videos with animated text and images",
					fontSize: 24,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "400",
					color: "#ffffff99",
					textAlign: "center",
					lineHeight: 1.4,
				},
				entrance: { type: "typewriter", durationMs: 2000, easing: "linear", delay: 800 },
			}),
		],
	};

	return {
		id: uid(),
		name: "Untitled Project",
		scenes: [introScene],
		resolution: { width: 1920, height: 1080 },
		fps: 30,
	};
}
