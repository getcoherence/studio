// ── Plugin System Types ─────────────────────────────────────────────────
//
// Core interfaces for Lucid's plugin architecture. All extensible features
// (scene types, transitions, effects, animations, export targets) register
// through this system.

import type React from "react";
import type { TransitionPresentation } from "@remotion/transitions";

// ── Scene Type Plugin ───────────────────────────────────────────────────

export interface SceneTypePlugin {
	/** Unique scene type ID (e.g., "ghost-hook", "device-showcase") */
	id: string;
	/** Display name for the UI */
	name: string;
	/** Short description shown in the template browser */
	description: string;
	/** Category for grouping in the template browser */
	category: "text" | "data" | "visual" | "social" | "cinematic" | "cta" | "legacy";
	/** Emoji icon for the template browser */
	icon: string;
	/** Default headline when adding this scene type */
	defaultHeadline?: string;
	/** Minimum duration in frames */
	minDuration?: number;
	/** Whether this type reads scene.headline */
	readsHeadline?: boolean;
	/** Whether this type reads scene.subtitle */
	readsSubtitle?: boolean;
	/** Available visual variants */
	variants?: string[];
	/**
	 * Render the scene to a Remotion JSX string.
	 * Receives the scene data, accent color, resolved background CSS.
	 */
	render: (scene: any, accent: string, bg: string) => string;
	/**
	 * Expand scene data into editable layers for the UI.
	 * Returns an array of layer objects.
	 */
	expandToLayers?: (scene: any, accent: string) => any[];
	/**
	 * Seed default data when switching to this scene type.
	 */
	seedDefaults?: (currentScene: any, seedText: string) => Record<string, any>;
	/**
	 * Layer-to-field sync mappings (used by the sync registry).
	 */
	syncMappings?: any[];
	/**
	 * What layer type the + Add button should create for this scene.
	 * If not provided, creates a generic text overlay.
	 */
	addLayerFactory?: (existingLayers: any[]) => any;
}

// ── Transition Plugin ───────────────────────────────────────────────────

export interface TransitionPlugin {
	/** Unique transition ID (e.g., "striped-slam", "zoom-punch") */
	id: string;
	/** Display name */
	name: string;
	/** Description */
	description: string;
	/** Energy level for smart selection */
	energy: "low" | "medium" | "high" | "maximum";
	/** Default duration in frames */
	defaultDuration: number;
	/** Whether to use spring timing (vs linear) */
	useSpringTiming?: boolean;
	/**
	 * Create the TransitionPresentation.
	 * Can accept accent color for brand-colored transitions.
	 */
	// biome-ignore lint: TransitionPresentation generic varies per transition type
	create: (accentColor?: string) => TransitionPresentation<any>;
	/**
	 * The JSX expression string for the compiled code.
	 * e.g., "stripedSlam()" or "fade()"
	 */
	codeExpression: string;
}

// ── Background Effect Plugin ────────────────────────────────────────────

export interface EffectPlugin {
	/** Unique effect ID (e.g., "confetti", "snow", "flowing-lines") */
	id: string;
	/** Display name */
	name: string;
	/** Description */
	description: string;
	/** Category for grouping in the effect picker */
	category: "ambient" | "particles" | "geometric" | "texture" | "gradient";
	/** The React component that renders the effect overlay */
	// biome-ignore lint: Effect components have varying prop shapes
	component: React.FC<any>;
}

// ── Text Animation Plugin ───────────────────────────────────────────────

export interface AnimationPlugin {
	/** Unique animation ID (e.g., "gradient", "matrix", "rotate-3d") */
	id: string;
	/** Display name for the dropdown */
	name: string;
	/** Description */
	description: string;
}

// ── Export Target Plugin ────────────────────────────────────────────────

export interface ExportTargetPlugin {
	/** Unique export target ID (e.g., "youtube", "tiktok", "mp4") */
	id: string;
	/** Display name */
	name: string;
	/** Icon (emoji or component) */
	icon: string;
	/** Whether authentication is required */
	requiresAuth: boolean;
	/** Check if connected/authenticated */
	isConnected: () => Promise<boolean>;
	/** Start authentication flow */
	authenticate?: () => Promise<{ success: boolean; error?: string }>;
	/** Disconnect */
	disconnect?: () => Promise<void>;
	/** Upload/export the video */
	export: (opts: {
		filePath: string;
		title: string;
		description?: string;
		privacy?: string;
		onProgress?: (percent: number) => void;
	}) => Promise<{ success: boolean; url?: string; error?: string }>;
}

// ── Plugin Package ──────────────────────────────────────────────────────

export interface LucidPlugin {
	/** Unique plugin ID */
	id: string;
	/** Display name */
	name: string;
	/** Version string */
	version: string;
	/** Author */
	author?: string;
	/** Register all features this plugin provides */
	register: (registry: PluginRegistry) => void;
}

// ── Plugin Registry ─────────────────────────────────────────────────────

export interface PluginRegistry {
	registerSceneType(plugin: SceneTypePlugin): void;
	registerTransition(plugin: TransitionPlugin): void;
	registerEffect(plugin: EffectPlugin): void;
	registerAnimation(plugin: AnimationPlugin): void;
	registerExportTarget(plugin: ExportTargetPlugin): void;

	// Getters
	getSceneTypes(): SceneTypePlugin[];
	getSceneType(id: string): SceneTypePlugin | undefined;
	getTransitions(): TransitionPlugin[];
	getTransition(id: string): TransitionPlugin | undefined;
	getEffects(): EffectPlugin[];
	getEffect(id: string): EffectPlugin | undefined;
	getAnimations(): AnimationPlugin[];
	getExportTargets(): ExportTargetPlugin[];
}
