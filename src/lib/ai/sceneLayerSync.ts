// ── Scene Layer Sync ────────────────────────────────────────────────────
//
// Declarative registry that maps scene types → data fields → layer IDs.
// Replaces the 500+ lines of hand-written per-type sync, trim, prune, and
// seed logic that lived in SceneEditor.tsx. Adding a new scene type now
// requires ONE entry here instead of touching 5+ parallel data structures.

import type { SceneLayer, ScenePlanItem, SceneType } from "./scenePlan";
import { expandSceneToLayers } from "./scenePlanCompiler";

// ── Registry types ──────────────────────────────────────────────────────

interface ArrayFieldMapping {
	kind: "array";
	/** Data field on ScenePlanItem (e.g., "ghostWords") */
	field: keyof ScenePlanItem;
	/** Layer ID prefix (e.g., "ghost-word-") — layers are prefix + index */
	prefix: string;
	/** How to read a single layer back into one array entry */
	fromLayer: (layer: SceneLayer, existing: any) => any;
	/** Default entry when padding the array for a new index */
	defaultEntry: () => any;
	/** Extra scalar fields to sync from the first layer (e.g., fontSize) */
	syncScalarsFromFirst?: (layer: SceneLayer, out: Partial<ScenePlanItem>) => void;
}

interface PairedArrayFieldMapping {
	kind: "paired-array";
	field: keyof ScenePlanItem;
	/** Two prefixes: [valuePrefix, labelPrefix] */
	prefixes: [string, string];
	fromLayers: (
		valueLyr: SceneLayer | undefined,
		labelLyr: SceneLayer | undefined,
		existing: any,
	) => any;
	defaultEntry: () => any;
}

interface ScalarFieldMapping {
	kind: "scalar";
	field: keyof ScenePlanItem;
	/** Exact layer ID (e.g., "slot-prefix") */
	layerId: string;
	fromLayer: (layer: SceneLayer) => any;
}

interface CardFieldMapping {
	kind: "cards";
	field: "cards";
	prefix: string;
	fromLayer: (layer: SceneLayer, existing: any) => any;
	defaultEntry: () => any;
}

type FieldMapping =
	| ArrayFieldMapping
	| PairedArrayFieldMapping
	| ScalarFieldMapping
	| CardFieldMapping;

interface SceneTypeConfig {
	/** Whether this type uses scene.headline (most do) */
	readsHeadline: boolean;
	/** Whether this type uses scene.subtitle */
	readsSubtitle: boolean;
	/** Layer-to-field mappings specific to this type */
	mappings: FieldMapping[];
	/** Default data to seed when switching TO this type (only if field is empty) */
	seedDefaults?: (current: ScenePlanItem, seedText: string) => Partial<ScenePlanItem>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Parse "emoji label" format → { icon, label } */
function parseIconContent(raw: string): { icon: string; label: string } {
	const trimmed = (raw || "✨").trim();
	const sp = trimmed.indexOf(" ");
	return sp > 0
		? { icon: trimmed.slice(0, sp), label: trimmed.slice(sp + 1) }
		: { icon: trimmed, label: "" };
}

/** Parse "$100k" → { prefix, value, suffix } */
function parseMetricValue(raw: string): { prefix?: string; value: number; suffix?: string } {
	const trimmed = (raw || "0").trim();
	const m = trimmed.match(/^([^\d\-.]*)([-+]?\d*\.?\d+)(.*)$/);
	if (m) return { prefix: m[1] || "", value: Number(m[2]) || 0, suffix: m[3] || "" };
	return { value: 0, suffix: trimmed };
}

// ── Registry ────────────────────────────────────────────────────────────

const REGISTRY: Partial<Record<SceneType, SceneTypeConfig>> = {
	"ghost-hook": {
		readsHeadline: false,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "ghostWords",
				prefix: "ghost-word-",
				fromLayer: (l) => l.content || "",
				defaultEntry: () => "",
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
		],
		seedDefaults: (cur, seed) => (!cur.ghostWords?.length ? { ghostWords: [seed] } : {}),
	},
	"camera-text": {
		readsHeadline: false,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "cameraTextWords",
				prefix: "camera-word-",
				fromLayer: (l, existing) => ({
					...existing,
					text: l.content || "",
					appearsAt: l.startFrame || 0,
					...(l.settings?.color ? { color: l.settings.color } : {}),
				}),
				defaultEntry: () => ({ text: "", appearsAt: 0 }),
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
		],
		seedDefaults: (cur, seed) =>
			!cur.cameraTextWords?.length
				? {
						cameraTextWords: seed
							.split(/\s+/)
							.slice(0, 6)
							.map((t, i) => ({ text: t, appearsAt: i * 10 })),
					}
				: {},
	},
	"stacked-hierarchy": {
		readsHeadline: false,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "stackedLines",
				prefix: "stacked-line-",
				fromLayer: (l, existing) => ({
					...existing,
					text: l.content || "",
					...(l.settings?.fontSize ? { size: l.settings.fontSize } : {}),
				}),
				defaultEntry: () => ({ text: "", size: 120 }),
			},
		],
		seedDefaults: (cur, seed) =>
			!cur.stackedLines?.length
				? {
						stackedLines: seed
							.split(/\s+/)
							.slice(0, 3)
							.map((t) => ({ text: t, size: 120 })),
					}
				: {},
	},
	"contrast-pairs": {
		readsHeadline: false,
		readsSubtitle: false,
		mappings: [
			{
				kind: "paired-array",
				field: "contrastPairs",
				prefixes: ["contrast-stmt-", "contrast-ctr-"],
				fromLayers: (stmt: any, ctr: any, existing: any) => ({
					...existing,
					statement: stmt?.content || "",
					counter: ctr?.content || "",
				}),
				defaultEntry: () => ({ statement: "", counter: "" }),
			},
		],
		seedDefaults: (cur, seed) =>
			!cur.contrastPairs?.length
				? {
						contrastPairs: [
							{ statement: seed, counter: "but not quite." },
							{ statement: "You might think so…", counter: "but there's more." },
						],
					}
				: {},
	},
	"before-after": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "beforeLines",
				prefix: "before-",
				fromLayer: (l) => l.content || "",
				defaultEntry: () => "",
			},
			{
				kind: "array",
				field: "afterLines",
				prefix: "after-",
				fromLayer: (l) => l.content || "",
				defaultEntry: () => "",
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.beforeLines ? { beforeLines: ["Before line 1"] } : {}),
			...(!cur.afterLines ? { afterLines: ["After line 1"] } : {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"data-flow-network": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "networkNodes",
				prefix: "network-node-",
				fromLayer: (l) => l.content || "",
				defaultEntry: () => "",
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.networkNodes?.length
				? { networkNodes: ["Input", "Process", "Analyze", "Output"] }
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"metrics-dashboard": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "paired-array",
				field: "metrics",
				prefixes: ["metric-value-", "metric-label-"],
				fromLayers: (valLyr, lblLyr, existing) => ({
					...existing,
					...(valLyr ? parseMetricValue(valLyr.content || "0") : {}),
					...(lblLyr ? { label: lblLyr.content || "" } : {}),
				}),
				defaultEntry: () => ({ value: 0, label: "" }),
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.metrics?.length
				? {
						metrics: [
							{ value: 10, label: "Times faster", suffix: "x" },
							{ value: 99, label: "Uptime", suffix: "%" },
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	// glass-stats uses the same metrics fields as metrics-dashboard
	"glass-stats": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "paired-array",
				field: "metrics",
				prefixes: ["metric-value-", "metric-label-"],
				fromLayers: (valLyr, lblLyr, existing) => ({
					...existing,
					...(valLyr ? parseMetricValue(valLyr.content || "0") : {}),
					...(lblLyr ? { label: lblLyr.content || "" } : {}),
				}),
				defaultEntry: () => ({ value: 0, label: "" }),
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.metrics?.length
				? {
						metrics: [
							{ value: 500, label: "Users", suffix: "+" },
							{ value: 99, label: "Uptime", suffix: "%" },
							{ value: 10, label: "Times faster", suffix: "x" },
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"icon-showcase": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "iconItems",
				prefix: "icon-item-",
				fromLayer: (l, existing) => {
					const parsed = parseIconContent(l.content || "");
					return { ...existing, ...parsed };
				},
				defaultEntry: () => ({ icon: "✨", label: "" }),
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.iconItems?.length
				? {
						iconItems: [
							{ icon: "⚡", label: "Fast" },
							{ icon: "🔒", label: "Secure" },
							{ icon: "✨", label: "Smart" },
							{ icon: "🎯", label: "Precise" },
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"app-icon-cloud": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "appIcons",
				prefix: "app-icon-",
				fromLayer: (l, existing) => {
					const parsed = parseIconContent(l.content || "");
					return {
						...existing,
						...parsed,
						...(l.settings?.color ? { color: l.settings.color } : {}),
					};
				},
				defaultEntry: () => ({ icon: "✨" }),
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.appIcons?.length
				? {
						appIcons: [
							{ icon: "💬", color: "#4a154b", label: "Chat" },
							{ icon: "📧", color: "#ea4335", label: "Mail" },
							{ icon: "📊", color: "#0077b5", label: "Analytics" },
							{ icon: "📝", color: "#000000", label: "Docs" },
							{ icon: "🎯", color: "#ff6900", label: "Goals" },
							{ icon: "📅", color: "#4285f4", label: "Calendar" },
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"word-slot-machine": {
		readsHeadline: false,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "slotMachineWords",
				prefix: "slot-word-",
				fromLayer: (l) => l.content || "",
				defaultEntry: () => "",
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
			{
				kind: "scalar",
				field: "slotMachinePrefix",
				layerId: "slot-prefix",
				fromLayer: (l) => l.content || "",
			},
		],
		seedDefaults: (cur) =>
			!cur.slotMachineWords?.length
				? {
						slotMachinePrefix: "Your",
						slotMachineWords: ["Product", "App", "Agency", "Story"],
						slotMachineSelectedIndex: 1,
					}
				: {},
	},
	"scrolling-list": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "scrollingListLines",
				prefix: "scroll-line-",
				fromLayer: (l, existing) => ({
					...existing,
					text: l.content || "",
					...(l.settings?.color ? { color: l.settings.color } : {}),
				}),
				defaultEntry: () => ({ text: "" }),
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.scrollingListLines?.length
				? {
						scrollingListLines: [
							{ text: "Step one." },
							{ text: "Step two." },
							{ text: "Step three." },
							{ text: "Done." },
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"notification-chaos": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "notifications",
				prefix: "notif-",
				fromLayer: (l, existing) => ({ ...existing, title: l.content || "" }),
				defaultEntry: () => ({ platform: "generic" as const, title: "" }),
				syncScalarsFromFirst: (l, out) => {
					if (l.settings?.fontSize) out.fontSize = l.settings.fontSize;
				},
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.notifications?.length
				? {
						notifications: [
							{
								platform: "email" as const,
								title: "New message",
								subtitle: "Can you check...",
								time: "2m",
							},
							{
								platform: "slack" as const,
								title: "#general",
								subtitle: "@here urgent",
								time: "1m",
							},
							{
								platform: "twitter" as const,
								title: "New reply",
								subtitle: "Great post!",
								time: "5m",
							},
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"chat-narrative": {
		readsHeadline: false,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "chatMessages",
				prefix: "chat-msg-",
				fromLayer: (l, existing) => ({ ...existing, text: l.content || "" }),
				defaultEntry: () => ({ user: "User", text: "" }),
			},
			{
				kind: "scalar",
				field: "chatChannel",
				layerId: "chat-channel",
				fromLayer: (l) => l.content || "",
			},
		],
		seedDefaults: (cur) =>
			!cur.chatMessages?.length
				? {
						chatMessages: [
							{ user: "Sarah", text: "Anyone got the report?", time: "9:42 AM" },
							{ user: "Mike", text: "Working on it...", time: "9:43 AM" },
						],
						chatChannel: "general",
					}
				: {},
	},
	"browser-tabs-chaos": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "array",
				field: "browserTabs",
				prefix: "browser-tab-",
				fromLayer: (l) => l.content || "",
				defaultEntry: () => "",
			},
		],
		seedDefaults: (cur, seed) => ({
			...(!cur.browserTabs?.length
				? {
						browserTabs: [
							"gmail.com",
							"slack.com",
							"notion.so",
							"figma.com",
							"github.com",
							"jira.com",
						],
					}
				: {}),
			...(!cur.headline ? { headline: seed } : {}),
		}),
	},
	"typewriter-prompt": {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "scalar",
				field: "typewriterText",
				layerId: "typewriter-text",
				fromLayer: (l) => l.content || "",
			},
		],
	},
	cards: {
		readsHeadline: true,
		readsSubtitle: false,
		mappings: [
			{
				kind: "cards",
				field: "cards",
				prefix: "card-",
				fromLayer: (l, existing) => {
					try {
						const parsed = JSON.parse(l.content || "{}");
						return {
							title: parsed.title ?? existing?.title ?? "",
							description: parsed.description ?? existing?.description ?? "",
						};
					} catch {
						return existing || { title: "", description: "" };
					}
				},
				defaultEntry: () => ({ title: "", description: "" }),
			},
		],
	},
};

// Default config for types not explicitly in the registry (hero-text, impact-word, etc.)
const DEFAULT_CONFIG: SceneTypeConfig = {
	readsHeadline: true,
	readsSubtitle: false,
	mappings: [],
};

function getConfig(type: SceneType): SceneTypeConfig {
	return REGISTRY[type] || DEFAULT_CONFIG;
}

// ── Exported functions ──────────────────────────────────────────────────

/** All layer ID prefixes that are "primary" (system-generated, not user-added) */
const ALL_PRIMARY_PREFIXES = new Set<string>();
const ALL_PRIMARY_IDS = new Set(["cta-pill", "slot-prefix", "typewriter-text", "chat-channel"]);
for (const config of Object.values(REGISTRY)) {
	if (!config) continue;
	for (const m of config.mappings) {
		if (m.kind === "array" || m.kind === "cards") ALL_PRIMARY_PREFIXES.add(m.prefix);
		else if (m.kind === "paired-array") m.prefixes.forEach((p) => ALL_PRIMARY_PREFIXES.add(p));
		else if (m.kind === "scalar") ALL_PRIMARY_IDS.add(m.layerId);
	}
}
// Also add headline/subtitle/screenshot/fx prefixes
["headline-", "subtitle-", "card-", "screenshot-", "fx-"].forEach((p) =>
	ALL_PRIMARY_PREFIXES.add(p),
);

export function isPrimaryLayer(id: string): boolean {
	if (ALL_PRIMARY_IDS.has(id)) return true;
	for (const prefix of ALL_PRIMARY_PREFIXES) {
		if (id.startsWith(prefix)) return true;
	}
	return false;
}

/**
 * Sync layer edits back to scene data fields.
 * Returns the field updates + re-indexed layers.
 */
export function syncLayersToData(
	scene: ScenePlanItem,
	layers: SceneLayer[],
	originalScene: ScenePlanItem,
): { fieldUpdates: Partial<ScenePlanItem>; layers: SceneLayer[] } {
	const config = getConfig(scene.type);
	const fieldUpdates: Partial<ScenePlanItem> = {};
	const layersCopy = layers.map((l) => ({ ...l }));

	// Sync headline/subtitle (shared across most types)
	const hasHeadlineLayer = layersCopy.some((l) => l.id.startsWith("headline-"));
	const hasSubtitleLayer = layersCopy.some((l) => l.id.startsWith("subtitle-"));

	for (const layer of layersCopy) {
		if (layer.id.startsWith("headline-")) {
			if (layer.content) fieldUpdates.headline = layer.content;
			if (layer.settings?.animation) fieldUpdates.animation = layer.settings.animation as any;
			if (layer.settings?.fontSize) fieldUpdates.fontSize = layer.settings.fontSize;
			if (layer.settings?.accentWord !== undefined)
				fieldUpdates.accentWord = layer.settings.accentWord || undefined;
		} else if (layer.id.startsWith("subtitle-")) {
			if (layer.content) fieldUpdates.subtitle = layer.content;
		}
	}

	// Clear headline/subtitle when their layers are deleted
	if (!hasHeadlineLayer && config.readsHeadline && originalScene.headline) {
		fieldUpdates.headline = undefined as any;
	}
	if (!hasSubtitleLayer && config.readsSubtitle && originalScene.subtitle) {
		fieldUpdates.subtitle = undefined as any;
	}

	const layerIds = new Set(layersCopy.map((l) => l.id));

	for (const mapping of config.mappings) {
		if (mapping.kind === "array") {
			const origArr: any[] = (originalScene as any)[mapping.field] || [];
			let arr = origArr.map((x: any) => (typeof x === "object" ? { ...x } : x));

			// Sync from layers
			for (const layer of layersCopy) {
				const m = layer.id.match(new RegExp(`^${escapeRegex(mapping.prefix)}(\\d+)$`));
				if (!m) continue;
				const idx = Number(m[1]);
				while (arr.length <= idx) arr.push(mapping.defaultEntry());
				arr[idx] = mapping.fromLayer(layer, arr[idx]);
				if (idx === 0 && mapping.syncScalarsFromFirst) {
					mapping.syncScalarsFromFirst(layer, fieldUpdates);
				}
			}

			// Trim deleted entries + re-index
			const kept = arr.filter((_, i) => layerIds.has(`${mapping.prefix}${i}`));
			if (kept.length < arr.length) {
				reindexLayers(layersCopy, mapping.prefix);
			}
			if (kept.length > 0) (fieldUpdates as any)[mapping.field] = kept;
		} else if (mapping.kind === "paired-array") {
			const [valPfx, lblPfx] = mapping.prefixes;
			const origArr: any[] = (originalScene as any)[mapping.field] || [];
			let arr = origArr.map((x: any) => ({ ...x }));

			// Find max index across both prefixes
			let maxIdx = -1;
			for (const layer of layersCopy) {
				for (const pfx of [valPfx, lblPfx]) {
					const m = layer.id.match(new RegExp(`^${escapeRegex(pfx)}(\\d+)$`));
					if (m) maxIdx = Math.max(maxIdx, Number(m[1]));
				}
			}
			while (arr.length <= maxIdx) arr.push(mapping.defaultEntry());

			// Sync from layers
			for (let i = 0; i <= maxIdx; i++) {
				const valLyr = layersCopy.find((l) => l.id === `${valPfx}${i}`);
				const lblLyr = layersCopy.find((l) => l.id === `${lblPfx}${i}`);
				if (valLyr || lblLyr) {
					arr[i] = mapping.fromLayers(valLyr, lblLyr, arr[i]);
				}
			}

			// Trim + re-index
			const kept = arr.filter(
				(_, i) => layerIds.has(`${valPfx}${i}`) || layerIds.has(`${lblPfx}${i}`),
			);
			if (kept.length < arr.length) {
				reindexPairedLayers(layersCopy, valPfx, lblPfx);
			}
			if (kept.length > 0) (fieldUpdates as any)[mapping.field] = kept;
		} else if (mapping.kind === "scalar") {
			const layer = layersCopy.find((l) => l.id === mapping.layerId);
			if (layer) (fieldUpdates as any)[mapping.field] = mapping.fromLayer(layer);
		} else if (mapping.kind === "cards") {
			const origArr: any[] = (originalScene as any)[mapping.field] || [];
			let arr = origArr.map((x: any) => ({ ...x }));

			for (const layer of layersCopy) {
				const m = layer.id.match(/^card-(\d+)-/);
				if (!m) continue;
				const idx = Number(m[1]);
				while (arr.length <= idx) arr.push(mapping.defaultEntry());
				arr[idx] = mapping.fromLayer(layer, arr[idx]);
			}

			// Trim + re-index cards (multi-layer per entry)
			const kept = arr.filter((_, i) => layersCopy.some((l) => l.id.startsWith(`card-${i}-`)));
			if (kept.length < arr.length) {
				reindexCardLayers(layersCopy);
			}
			if (kept.length > 0) (fieldUpdates as any)[mapping.field] = kept;
		}
	}

	return { fieldUpdates, layers: layersCopy };
}

/**
 * Prune layers that belong to a different scene type.
 * Returns pruned layers + field-clear updates.
 */
export function pruneLayersForType(
	layers: SceneLayer[],
	sceneType: SceneType,
	scene: ScenePlanItem,
	accent: string,
): { layers: SceneLayer[]; clearedFields: Partial<ScenePlanItem> } {
	const USER_PREFIXES = ["layer-", "l-"];

	// Re-expand to get valid IDs for this type
	const freshForType = expandSceneToLayers(scene, accent);
	const validIds = new Set(freshForType.map((l) => l.id));

	// Mark incompatible layers instead of removing them — this lets users
	// switch back to the original type without losing layers.
	const prunedLayers = layers.map((l) => {
		const isUser = USER_PREFIXES.some((p) => l.id.startsWith(p));
		const isValid = validIds.has(l.id);
		const isNonPrimary = !isPrimaryLayer(l.id);
		const compatible = isUser || isValid || isNonPrimary;
		return compatible ? { ...l, _incompatible: undefined } : { ...l, _incompatible: true };
	});

	// Clear data fields for types we don't own
	const clearedFields: Partial<ScenePlanItem> = {};
	const config = getConfig(sceneType);
	const ownedFields = new Set(config.mappings.map((m) => m.field));
	if (config.readsHeadline) ownedFields.add("headline");
	if (config.readsSubtitle) ownedFields.add("subtitle");

	// All fields that ANY type can own
	const ALL_CLEARABLE_FIELDS: (keyof ScenePlanItem)[] = [
		"headline",
		"subtitle",
		"ghostWords",
		"cameraTextWords",
		"stackedLines",
		"contrastPairs",
		"networkNodes",
		"metrics",
		"iconItems",
		"slotMachineWords",
		"slotMachinePrefix",
		"scrollingListLines",
		"notifications",
		"chatMessages",
		"browserTabs",
		"appIcons",
		"beforeLines",
		"afterLines",
		"typewriterText",
		"chatChannel",
	];

	for (const field of ALL_CLEARABLE_FIELDS) {
		if (!ownedFields.has(field) && (scene as any)[field] != null) {
			(clearedFields as any)[field] = undefined;
		}
	}

	return { layers: prunedLayers, clearedFields };
}

/**
 * Seed default data fields when switching to a new scene type.
 */
export function seedFieldsForType(
	newType: SceneType,
	currentScene: ScenePlanItem,
): Partial<ScenePlanItem> {
	const seedText =
		currentScene.headline ||
		currentScene.ghostWords?.[0] ||
		currentScene.stackedLines?.[0]?.text ||
		currentScene.cameraTextWords?.[0]?.text ||
		currentScene.beforeLines?.[0] ||
		"Your headline here";

	const config = getConfig(newType);
	return (
		config.seedDefaults?.(currentScene, seedText) ??
		// Default: seed headline if the new type reads it
		(config.readsHeadline && !currentScene.headline ? { headline: seedText } : {})
	);
}

// ── Internal helpers ────────────────────────────────────────────────────

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Re-index layers matching prefix+digits to be consecutive (0, 1, 2...) */
function reindexLayers(layers: SceneLayer[], prefix: string) {
	const pattern = new RegExp(`^${escapeRegex(prefix)}\\d+$`);
	let idx = 0;
	for (const layer of layers) {
		if (pattern.test(layer.id)) {
			layer.id = `${prefix}${idx}`;
			idx++;
		}
	}
}

/** Re-index paired layers (value-N, label-N) */
function reindexPairedLayers(layers: SceneLayer[], valPfx: string, lblPfx: string) {
	let newIdx = 0;
	let lastOldIdx = -1;
	for (const layer of layers) {
		const vm = layer.id.match(new RegExp(`^${escapeRegex(valPfx)}(\\d+)$`));
		const lm = layer.id.match(new RegExp(`^${escapeRegex(lblPfx)}(\\d+)$`));
		const m = vm || lm;
		if (m) {
			const oldIdx = Number(m[1]);
			if (oldIdx !== lastOldIdx) {
				if (lastOldIdx >= 0) newIdx++;
				lastOldIdx = oldIdx;
			}
			layer.id = `${vm ? valPfx : lblPfx}${newIdx}`;
		}
	}
}

/** Re-index card layers (card-N-title, card-N-desc, etc.) */
function reindexCardLayers(layers: SceneLayer[]) {
	let newIdx = 0;
	let lastOldIdx = -1;
	for (const layer of layers) {
		const m = layer.id.match(/^card-(\d+)-(.+)$/);
		if (m) {
			const oldIdx = Number(m[1]);
			if (oldIdx !== lastOldIdx) {
				if (lastOldIdx >= 0) newIdx++;
				lastOldIdx = oldIdx;
			}
			layer.id = `card-${newIdx}-${m[2]}`;
		}
	}
}
