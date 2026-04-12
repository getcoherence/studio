// ── Lottie Catalog ──────────────────────────────────────────────────────
//
// Indexed catalog of Lottie animations with metadata for AI selection
// and parameterization. Supports built-in assets, LottieFiles search,
// user-uploaded, and community-contributed animations.

import { LOTTIE_ASSETS } from "./assets";

// ── Types ──────────────────────────────────────────────────────────────

export type LottieCategory =
	| "transition"
	| "text-effect"
	| "overlay"
	| "icon"
	| "background"
	| "decoration"
	| "data-viz"
	| "celebration"
	| "loading";

export type LottieSource = "builtin" | "lottiefiles" | "user" | "contributor";

export interface LottieCatalogEntry {
	id: string;
	name: string;
	category: LottieCategory;
	/** Tags for AI search and filtering */
	tags: string[];
	/** Descriptors for when this animation fits best */
	bestFor: string[];
	source: LottieSource;
	/** Inline JSON data or URL to fetch */
	data: object | string;
	/** Duration in milliseconds */
	durationMs: number;
	/** Whether colors can be programmatically swapped */
	colorizable: boolean;
	/** Map of color layer paths to their default hex values */
	defaultColors?: Record<string, string>;
	/** Preview thumbnail URL (optional) */
	thumbnailUrl?: string;
}

// ── Built-in Catalog ───────────────────────────────────────────────────

const BUILTIN_CATALOG: LottieCatalogEntry[] = [
	{
		id: "lower-third-bar",
		name: "Lower Third Bar",
		category: "overlay",
		tags: ["lower-third", "bar", "title", "name-plate"],
		bestFor: ["speaker introductions", "title cards", "name labels"],
		source: "builtin",
		data: LOTTIE_ASSETS["lower-third-bar"]?.data ?? "lower-third-bar",
		durationMs: 1500,
		colorizable: true,
	},
	{
		id: "accent-line",
		name: "Accent Line",
		category: "decoration",
		tags: ["line", "divider", "accent", "reveal"],
		bestFor: ["scene transitions", "text dividers", "emphasis"],
		source: "builtin",
		data: LOTTIE_ASSETS["accent-line"]?.data ?? "accent-line",
		durationMs: 1000,
		colorizable: true,
	},
	{
		id: "corner-bracket-tl",
		name: "Corner Bracket (Top Left)",
		category: "decoration",
		tags: ["bracket", "corner", "frame", "cinematic"],
		bestFor: ["framing content", "cinematic feel", "focus attention"],
		source: "builtin",
		data: LOTTIE_ASSETS["corner-bracket-tl"]?.data ?? "corner-bracket-tl",
		durationMs: 800,
		colorizable: true,
	},
	{
		id: "corner-bracket-br",
		name: "Corner Bracket (Bottom Right)",
		category: "decoration",
		tags: ["bracket", "corner", "frame", "cinematic"],
		bestFor: ["framing content", "cinematic feel", "paired with top-left"],
		source: "builtin",
		data: LOTTIE_ASSETS["corner-bracket-br"]?.data ?? "corner-bracket-br",
		durationMs: 800,
		colorizable: true,
	},
	{
		id: "glow-pulse",
		name: "Glow Pulse",
		category: "overlay",
		tags: ["glow", "pulse", "highlight", "emphasis", "attention"],
		bestFor: ["drawing attention", "CTA emphasis", "metric highlights"],
		source: "builtin",
		data: LOTTIE_ASSETS["glow-pulse"]?.data ?? "glow-pulse",
		durationMs: 2000,
		colorizable: true,
	},
];

// ── Catalog Registry ───────────────────────────────────────────────────

/** In-memory catalog (built-in + user/contributor additions) */
let catalog: LottieCatalogEntry[] = [...BUILTIN_CATALOG];

/** Register a new Lottie animation in the catalog */
export function registerLottie(entry: LottieCatalogEntry): void {
	const existing = catalog.findIndex((e) => e.id === entry.id);
	if (existing >= 0) {
		catalog[existing] = entry;
	} else {
		catalog.push(entry);
	}
}

/** Remove a Lottie animation from the catalog */
export function unregisterLottie(id: string): void {
	catalog = catalog.filter((e) => e.id !== id);
}

/** Get the full catalog */
export function getCatalog(): LottieCatalogEntry[] {
	return [...catalog];
}

// ── Search & Discovery ─────────────────────────────────────────────────

/**
 * Search the catalog by tags, category, or free text.
 * Returns entries sorted by relevance.
 */
export function searchLottieCatalog(
	query: string,
	opts?: { category?: LottieCategory; source?: LottieSource; limit?: number },
): LottieCatalogEntry[] {
	const { category, source, limit = 20 } = opts ?? {};
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

	let results = catalog;

	// Filter by category
	if (category) {
		results = results.filter((e) => e.category === category);
	}

	// Filter by source
	if (source) {
		results = results.filter((e) => e.source === source);
	}

	// Score by text match relevance
	const scored = results.map((entry) => {
		let score = 0;
		const searchable = [entry.name, ...entry.tags, ...entry.bestFor, entry.category]
			.join(" ")
			.toLowerCase();

		for (const term of terms) {
			if (entry.name.toLowerCase().includes(term)) score += 10;
			if (entry.tags.some((t) => t.includes(term))) score += 5;
			if (entry.bestFor.some((b) => b.includes(term))) score += 3;
			if (searchable.includes(term)) score += 1;
		}

		return { entry, score };
	});

	return scored
		.filter((s) => terms.length === 0 || s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((s) => s.entry);
}

// ── Parameterization ───────────────────────────────────────────────────

/**
 * Parameterize a Lottie animation — swap colors, text, and timing.
 * Operates on a deep clone to avoid mutating the original.
 *
 * Color swapping traverses the Lottie JSON tree looking for color values
 * (arrays of [r, g, b, a] in 0-1 range) and replaces matches.
 */
export function parameterizeLottie(
	animationData: object,
	params: {
		/** Map of old hex colors → new hex colors */
		colorMap?: Record<string, string>;
		/** Map of text layer names → new text content */
		textMap?: Record<string, string>;
		/** Speed multiplier (2 = twice as fast) */
		speedMultiplier?: number;
	},
): object {
	const data = JSON.parse(JSON.stringify(animationData));

	// Apply speed multiplier
	if (params.speedMultiplier && params.speedMultiplier !== 1) {
		const anim = data as any;
		if (anim.op && anim.ip !== undefined) {
			anim.op = Math.round(anim.ip + (anim.op - anim.ip) / params.speedMultiplier);
		}
	}

	// Apply color swaps
	if (params.colorMap && Object.keys(params.colorMap).length > 0) {
		const colorEntries = Object.entries(params.colorMap).map(([from, to]) => ({
			from: hexToLottieColor(from),
			to: hexToLottieColor(to),
		}));
		traverseAndSwapColors(data, colorEntries);
	}

	// Apply text swaps
	if (params.textMap && Object.keys(params.textMap).length > 0) {
		traverseAndSwapText(data, params.textMap);
	}

	return data;
}

// ── Internal helpers ───────────────────────────────────────────────────

function hexToLottieColor(hex: string): [number, number, number, number] {
	const h = hex.replace("#", "");
	return [
		Number.parseInt(h.slice(0, 2), 16) / 255,
		Number.parseInt(h.slice(2, 4), 16) / 255,
		Number.parseInt(h.slice(4, 6), 16) / 255,
		1,
	];
}

function colorsMatch(a: number[], b: number[], tolerance = 0.02): boolean {
	if (a.length < 3 || b.length < 3) return false;
	return (
		Math.abs(a[0] - b[0]) < tolerance &&
		Math.abs(a[1] - b[1]) < tolerance &&
		Math.abs(a[2] - b[2]) < tolerance
	);
}

function traverseAndSwapColors(obj: any, swaps: Array<{ from: number[]; to: number[] }>): void {
	if (!obj || typeof obj !== "object") return;

	// Check if this is a color value (array of 3-4 numbers in 0-1 range)
	if (Array.isArray(obj) && obj.length >= 3 && obj.length <= 4) {
		const allNumbers = obj.every((v) => typeof v === "number");
		const inRange = obj.every((v) => typeof v === "number" && v >= 0 && v <= 1);
		if (allNumbers && inRange) {
			for (const swap of swaps) {
				if (colorsMatch(obj, swap.from)) {
					for (let i = 0; i < Math.min(obj.length, swap.to.length); i++) {
						obj[i] = swap.to[i];
					}
					return;
				}
			}
		}
	}

	// Recurse
	if (Array.isArray(obj)) {
		for (const item of obj) traverseAndSwapColors(item, swaps);
	} else {
		for (const key of Object.keys(obj)) traverseAndSwapColors(obj[key], swaps);
	}
}

function traverseAndSwapText(obj: any, textMap: Record<string, string>): void {
	if (!obj || typeof obj !== "object") return;

	// Lottie text layers have t.d.k[].s.t for text content
	if (obj.nm && textMap[obj.nm] && obj.t?.d?.k) {
		for (const keyframe of obj.t.d.k) {
			if (keyframe.s?.t) {
				keyframe.s.t = textMap[obj.nm];
			}
		}
	}

	// Recurse into layers and sub-objects
	if (Array.isArray(obj)) {
		for (const item of obj) traverseAndSwapText(item, textMap);
	} else {
		for (const key of Object.keys(obj)) traverseAndSwapText(obj[key], textMap);
	}
}
