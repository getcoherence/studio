// ── Contributor Format ──────────────────────────────────────────────────
//
// Standardized format for community-contributed animation presets.
// Contributors submit JSON files that describe animations, effects, or
// theme configs. These are loaded via the plugin system.

import type { ThemeConfig } from "../ai/themeConfig";
import type { LottieCatalogEntry, LottieCategory } from "../lottie/lottieCatalog";

// ── Core Types ─────────────────────────────────────────────────────────

export type ContributionType =
	| "anime-timeline"
	| "lottie"
	| "particle-config"
	| "theme"
	| "scene-variant";

export type ContributionLicense = "MIT" | "CC-BY-4.0" | "CC0-1.0";

/**
 * A community-contributed animation preset.
 * Submitted as a JSON file, validated on load.
 */
export interface AnimationPreset {
	/** Unique preset ID (namespace/name format recommended) */
	id: string;
	/** Display name */
	name: string;
	/** Author name or handle */
	author: string;
	/** Semver version */
	version: string;
	/** What type of contribution this is */
	type: ContributionType;
	/** Discovery tags */
	tags: string[];
	/** License under which this is shared */
	license: ContributionLicense;
	/** Optional description */
	description?: string;
	/** Optional preview image URL */
	previewUrl?: string;
	/** The actual preset payload */
	payload: AnimeTimelinePreset | LottiePreset | ParticlePreset | ThemePreset | SceneVariantPreset;
}

// ── Payload Types ──────────────────────────────────────────────────────

/** anime.js timeline preset — fully JSON-serializable */
export interface AnimeTimelinePreset {
	type: "anime-timeline";
	/** Total duration in milliseconds */
	durationMs: number;
	/** Whether the timeline should loop */
	loop?: boolean;
	/** Timeline steps */
	steps: Array<{
		/** CSS selector relative to the container (e.g., "[data-stagger-item]") */
		targets: string;
		/** Properties to animate: prop → [from, to] or prop → value */
		properties: Record<string, [any, any] | any>;
		/** Duration of this step in ms */
		duration: number;
		/** Easing function name */
		easing: string;
		/** Timeline offset (e.g., "-=200", "+=100") */
		offset?: string;
		/** Stagger delay between matched elements in ms */
		stagger?: number;
	}>;
}

/** Lottie animation contribution */
export interface LottiePreset {
	type: "lottie";
	/** Lottie JSON data (inline) */
	animationData: object;
	/** Catalog metadata */
	category: LottieCategory;
	/** When this animation fits best */
	bestFor: string[];
	/** Duration in ms */
	durationMs: number;
	/** Whether colors can be swapped */
	colorizable: boolean;
	/** Default color map for parameterization */
	defaultColors?: Record<string, string>;
}

/** Particle effect contribution */
export interface ParticlePreset {
	type: "particle-config";
	/** Base particle type to extend */
	baseType:
		| "confetti"
		| "snow"
		| "fireflies"
		| "sakura"
		| "sparks"
		| "mist"
		| "light-rays"
		| "bubbles"
		| "embers"
		| "stars";
	/** Override props for the base component */
	overrides: Record<string, any>;
	/** Display category in the effect picker */
	category: "ambient" | "particles" | "celebration" | "weather" | "cinematic";
}

/** Theme/visual style contribution */
export interface ThemePreset {
	type: "theme";
	/** Full ThemeConfig */
	config: ThemeConfig;
	/** What mood/genre this theme suits */
	suitableFor: string[];
}

/** Scene type variant contribution */
export interface SceneVariantPreset {
	type: "scene-variant";
	/** Which scene type this variant belongs to */
	sceneType: string;
	/** Variant ID */
	variantId: string;
	/** JSX render code (executed in MODULE_SCOPE sandbox) */
	renderCode: string;
}

// ── Validation ─────────────────────────────────────────────────────────

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Validate a contributor preset before loading it.
 */
export function validatePreset(preset: unknown): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!preset || typeof preset !== "object") {
		return { valid: false, errors: ["Preset must be a JSON object"], warnings: [] };
	}

	const p = preset as Record<string, unknown>;

	// Required fields
	if (!p.id || typeof p.id !== "string") errors.push("Missing or invalid 'id'");
	if (!p.name || typeof p.name !== "string") errors.push("Missing or invalid 'name'");
	if (!p.author || typeof p.author !== "string") errors.push("Missing or invalid 'author'");
	if (!p.version || typeof p.version !== "string") errors.push("Missing or invalid 'version'");
	if (
		!p.type ||
		!["anime-timeline", "lottie", "particle-config", "theme", "scene-variant"].includes(
			p.type as string,
		)
	) {
		errors.push(
			"Invalid 'type'. Must be one of: anime-timeline, lottie, particle-config, theme, scene-variant",
		);
	}
	if (!p.license || !["MIT", "CC-BY-4.0", "CC0-1.0"].includes(p.license as string)) {
		errors.push("Invalid 'license'. Must be one of: MIT, CC-BY-4.0, CC0-1.0");
	}
	if (!p.payload || typeof p.payload !== "object") {
		errors.push("Missing or invalid 'payload'");
	}

	// Type-specific validation
	if (p.type === "anime-timeline" && p.payload) {
		const payload = p.payload as Record<string, unknown>;
		if (!Array.isArray(payload.steps))
			errors.push("anime-timeline payload must have 'steps' array");
		if (!payload.durationMs || typeof payload.durationMs !== "number")
			errors.push("anime-timeline payload must have 'durationMs'");
	}

	if (p.type === "scene-variant" && p.payload) {
		const payload = p.payload as Record<string, unknown>;
		if (!payload.sceneType) errors.push("scene-variant payload must have 'sceneType'");
		if (!payload.renderCode) errors.push("scene-variant payload must have 'renderCode'");
		if (typeof payload.renderCode === "string" && payload.renderCode.includes("eval(")) {
			errors.push("scene-variant renderCode must not contain eval()");
		}
	}

	// Warnings
	if (!p.tags || !Array.isArray(p.tags) || (p.tags as any[]).length === 0) {
		warnings.push("No tags provided — preset will be harder to discover");
	}
	if (!p.description) {
		warnings.push("No description — consider adding one for the catalog");
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Convert a validated contributor LottiePreset to a LottieCatalogEntry.
 */
export function lottiePresetToCatalogEntry(preset: AnimationPreset): LottieCatalogEntry | null {
	if (preset.type !== "lottie") return null;
	const payload = preset.payload as LottiePreset;
	return {
		id: preset.id,
		name: preset.name,
		category: payload.category,
		tags: preset.tags,
		bestFor: payload.bestFor,
		source: "contributor",
		data: payload.animationData,
		durationMs: payload.durationMs,
		colorizable: payload.colorizable,
		defaultColors: payload.defaultColors,
	};
}
