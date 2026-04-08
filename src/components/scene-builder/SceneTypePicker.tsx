// ── Scene Type Picker ────────────────────────────────────────────────────
//
// Rich popover for choosing a scene type with category grouping,
// descriptions, and compatibility hints so users know what they're getting.

import { useCallback, useMemo, useRef, useState } from "react";
import { pluginRegistry } from "@/lib/plugins";
import type { SceneTypePlugin } from "@/lib/plugins/types";
import type { ScenePlanItem } from "@/lib/ai/scenePlan";
import { expandSceneToLayers } from "@/lib/ai/scenePlanCompiler";
import { seedFieldsForType } from "@/lib/ai/sceneLayerSync";

const CATEGORY_LABELS: Record<string, string> = {
	text: "Text & Typography",
	cinematic: "Cinematic",
	data: "Data & Stats",
	social: "Social & Comparison",
	cta: "CTA & Branding",
	legacy: "Legacy",
};

const CATEGORY_ORDER = ["text", "cinematic", "data", "social", "cta", "legacy"];

interface SceneTypePickerProps {
	currentType: string;
	scene: ScenePlanItem;
	accent: string;
	onSelect: (typeId: string) => void;
}

export function SceneTypePicker({ currentType, scene, accent, onSelect }: SceneTypePickerProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);

	const currentPlugin = pluginRegistry.getSceneType(currentType);
	const currentLayerCount = (scene.layers || []).filter((l) => !l._incompatible).length;

	// Legacy types render ALL layers via compileLayer() — they accept any count
	const LEGACY_TYPES = new Set(["hero-text", "full-bleed", "split-layout", "cards", "screenshot", "glitch-intro", "stacked-text"]);

	// Compute layer counts for all types once (used for best-fit and display)
	const layerCounts = useMemo(() => {
		const counts: Record<string, number | string> = {};
		const allTypes = pluginRegistry.getSceneTypeIds();
		for (const id of allTypes) {
			// Legacy types render whatever layers exist — always compatible
			if (LEGACY_TYPES.has(id)) {
				counts[id] = currentLayerCount || 1;
				continue;
			}
			try {
				const seeded = seedFieldsForType(id as any, scene);
				const testScene = { ...scene, ...seeded, type: id } as ScenePlanItem;
				counts[id] = expandSceneToLayers(testScene, accent).length;
			} catch {
				counts[id] = "?";
			}
		}
		return counts;
	}, [scene, accent, currentLayerCount]);

	// Types that are genuinely compatible — same content category AND enough layers.
	// "Multi-line text" types are compatible with each other. Types with specialized
	// data (metrics, notifications, slot-machine) are only "best fit" for themselves.
	const MULTI_LINE_FAMILIES = new Set([
		"scrolling-list", "stacked-hierarchy", "ghost-hook",
		"contrast-pairs", "before-after", "stacked-text", "hero-text",
	]);
	const bestFitTypes = useMemo(() => {
		if (currentLayerCount === 0) return [];
		const currentIsMultiLine = MULTI_LINE_FAMILIES.has(currentType);
		const currentPlugin = pluginRegistry.getSceneType(currentType);
		const allTypes = pluginRegistry.getSceneTypeIds();
		return allTypes
			.filter((id) => {
				if (id === currentType) return false;
				const count = layerCounts[id];
				if (typeof count !== "number" || count < currentLayerCount) return false;
				// Legacy types accept all layers — always best fit
				if (LEGACY_TYPES.has(id)) return true;
				// Only show as best fit if content shapes are compatible
				if (currentIsMultiLine) return MULTI_LINE_FAMILIES.has(id);
				// For non-multi-line, only same category is best fit
				const plugin = pluginRegistry.getSceneType(id);
				return plugin?.category === currentPlugin?.category;
			})
			.map((id) => pluginRegistry.getSceneType(id)!)
			.filter(Boolean);
	}, [currentLayerCount, currentType, layerCounts]);

	const grouped = useMemo(() => {
		const byCategory = pluginRegistry.getSceneTypesByCategory();
		const result: Array<{ category: string; label: string; types: SceneTypePlugin[] }> = [];
		for (const cat of CATEGORY_ORDER) {
			const types = byCategory[cat];
			if (!types?.length) continue;
			const filtered = search
				? types.filter(
						(t) => {
							const q = search.toLowerCase();
							return t.id.includes(q) ||
								t.name.toLowerCase().includes(q) ||
								t.description.toLowerCase().includes(q) ||
								(t.tags || []).some((tag) => tag.includes(q));
						},
					)
				: types;
			if (filtered.length > 0) {
				result.push({ category: cat, label: CATEGORY_LABELS[cat] || cat, types: filtered });
			}
		}
		return result;
	}, [search]);

	const getLayerCount = useCallback(
		(typeId: string) => layerCounts[typeId] ?? "?",
		[layerCounts],
	);

	const handleSelect = useCallback(
		(typeId: string) => {
			onSelect(typeId);
			setOpen(false);
			setSearch("");
		},
		[onSelect],
	);

	// Close on outside click
	const handleBlur = useCallback((e: React.FocusEvent) => {
		if (!containerRef.current?.contains(e.relatedTarget as Node)) {
			setTimeout(() => setOpen(false), 150);
		}
	}, []);

	return (
		<div ref={containerRef} className="relative" onBlur={handleBlur}>
			{/* Trigger button */}
			<button
				type="button"
				onClick={() => {
					setOpen((v) => !v);
					setTimeout(() => searchRef.current?.focus(), 50);
				}}
				className="flex items-center gap-1 text-[10px] bg-[#141417] border border-white/10 rounded px-1.5 py-0.5 text-purple-400/70 hover:text-purple-400 hover:border-white/20 transition-colors max-w-[140px] truncate cursor-pointer"
				title={currentPlugin ? `${currentPlugin.name} — ${currentPlugin.description}` : currentType}
			>
				{currentPlugin?.icon && <span className="text-[11px]">{currentPlugin.icon}</span>}
				<span className="truncate">{currentType}</span>
				<span className="text-[8px] text-white/20 ml-auto">▼</span>
			</button>

			{/* Popover */}
			{open && (
				<div className="absolute top-full left-0 mt-1 z-50 w-[320px] max-h-[420px] bg-[#141417] border border-white/15 rounded-lg shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
					{/* Search */}
					<div className="p-2 border-b border-white/5">
						<input
							ref={searchRef}
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search scene types..."
							className="w-full text-[11px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 placeholder:text-white/20 outline-none focus:border-white/25"
						/>
					</div>

					{/* List */}
					<div className="flex-1 overflow-y-auto p-1">
						{/* Best fit section — types that can accommodate all current layers */}
						{!search && bestFitTypes.length > 0 && currentLayerCount > 0 && (
							<div className="mb-2 pb-1 border-b border-white/5">
								<div className="text-[9px] text-emerald-400/50 font-bold uppercase tracking-wider px-2 py-1">
									Best Fit ({currentLayerCount} layers)
								</div>
								{bestFitTypes.map((t) => (
									<TypeRow key={t.id} type={t} isActive={false} layerCount={getLayerCount(t.id)} currentLayerCount={currentLayerCount} onSelect={handleSelect} />
								))}
							</div>
						)}
						{grouped.map(({ category, label, types }) => (
							<div key={category} className="mb-1">
								<div className="text-[9px] text-white/25 font-bold uppercase tracking-wider px-2 py-1">
									{label}
								</div>
								{types.map((t) => {
									const isActive = t.id === currentType;
									const layerCount = getLayerCount(t.id);
									return (
										<TypeRow key={t.id} type={t} isActive={isActive} layerCount={layerCount} currentLayerCount={currentLayerCount} onSelect={handleSelect} />
									);
								})}
							</div>
						))}
						{grouped.length === 0 && (
							<div className="text-[10px] text-white/20 text-center py-4">No matches</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function TypeRow({ type: t, isActive, layerCount, currentLayerCount, onSelect }: {
	type: SceneTypePlugin;
	isActive: boolean;
	layerCount: number | string;
	currentLayerCount: number;
	onSelect: (id: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(t.id)}
			className={`w-full flex items-start gap-2 px-2 py-1.5 rounded text-left transition-colors ${
				isActive
					? "bg-purple-500/15 border border-purple-500/30"
					: "hover:bg-white/5 border border-transparent"
			}`}
		>
			<span className="text-[13px] mt-0.5 shrink-0">{t.icon}</span>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<span className={`text-[11px] font-medium ${isActive ? "text-purple-300" : "text-white/70"}`}>
						{t.name}
					</span>
					{t.variants && (
						<span className="text-[8px] text-white/20 bg-white/5 px-1 rounded">
							{t.variants.length} variants
						</span>
					)}
				</div>
				<div className="text-[9px] text-white/30 leading-snug mt-0.5">
					{t.description}
				</div>
				{t.layout && (
					<pre className="text-[7px] text-white/15 leading-tight mt-0.5 font-mono">{t.layout}</pre>
				)}
				<div className="flex items-center gap-2 mt-0.5">
					<span className="text-[8px] text-white/15">
						{layerCount} layer{layerCount !== 1 ? "s" : ""}
					</span>
					{t.readsHeadline && <span className="text-[8px] text-white/15">headline</span>}
					{t.readsSubtitle && <span className="text-[8px] text-white/15">+ subtitle</span>}
					{isActive && currentLayerCount > 0 && (
						<span className="text-[8px] text-emerald-400/40">current</span>
					)}
					{!isActive && typeof layerCount === "number" && layerCount >= currentLayerCount && (
						<span className="text-[8px] text-emerald-400/40">fits all layers</span>
					)}
					{!isActive && typeof layerCount === "number" && currentLayerCount > layerCount && (
						<span className="text-[8px] text-amber-400/40">
							{currentLayerCount - layerCount} kept but hidden
						</span>
					)}
				</div>
			</div>
		</button>
	);
}
