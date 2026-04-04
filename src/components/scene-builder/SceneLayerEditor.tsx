// ── Scene Layer Editor ──────────────────────────────────────────────────
//
// Inline layer editor for a single scene's layers.
// Renders inside each scene card in the Scenes tab.

import React from "react";
import type { SceneLayer, ScenePlanItem } from "@/lib/ai/scenePlan";

interface SceneLayerEditorProps {
	scene: ScenePlanItem;
	sceneIndex: number;
	onUpdate: (sceneIndex: number, updates: Partial<ScenePlanItem>) => void;
}

const POSITIONS = [
	{ value: "center", label: "Center" },
	{ value: "top-left", label: "Top-L" },
	{ value: "top-right", label: "Top-R" },
	{ value: "bottom-left", label: "Bot-L" },
	{ value: "bottom-right", label: "Bot-R" },
	{ value: "top", label: "Top" },
	{ value: "bottom", label: "Bottom" },
];

export function SceneLayerEditor({ scene, sceneIndex, onUpdate }: SceneLayerEditorProps) {
	const layers = scene.layers || [];

	const addLayer = () => {
		const newLayer: SceneLayer = {
			id: `l-${Date.now()}`,
			type: "text",
			content: "New Layer",
			position: "center",
			size: 40,
			startFrame: 0,
			endFrame: -1,
		};
		onUpdate(sceneIndex, { layers: [...layers, newLayer] });
	};

	const updateLayer = (layerIndex: number, updates: Partial<SceneLayer>) => {
		const newLayers = layers.map((l, i) => (i === layerIndex ? { ...l, ...updates } : l));
		onUpdate(sceneIndex, { layers: newLayers });
	};

	const deleteLayer = (layerIndex: number) => {
		onUpdate(sceneIndex, { layers: layers.filter((_, i) => i !== layerIndex) });
	};

	return (
		<div className="space-y-1 pt-2 border-t border-white/5 mt-2">
			<div className="flex items-center justify-between">
				<span className="text-[9px] text-white/30">Layers ({layers.length})</span>
				<button onClick={addLayer} className="text-[9px] text-[#2563eb] hover:text-[#60a5fa]">
					+ Add
				</button>
			</div>

			{layers.map((layer, li) => (
				<div key={layer.id} className="flex gap-1 items-center">
					<select
						value={layer.type}
						onChange={(e) => updateLayer(li, { type: e.target.value as SceneLayer["type"] })}
						className="w-12 text-[8px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/50 [&>option]:bg-[#141417] [&>option]:text-white"
					>
						<option value="text">Text</option>
						<option value="lottie">Lottie</option>
						<option value="image">Image</option>
						<option value="shape">Shape</option>
					</select>

					<input
						type="text"
						value={layer.content}
						onChange={(e) => updateLayer(li, { content: e.target.value })}
						onKeyDown={(e) => e.stopPropagation()}
						className="flex-1 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] text-white/50 focus:outline-none focus:border-[#2563eb]/50"
					/>

					<select
						value={layer.position}
						onChange={(e) =>
							updateLayer(li, { position: e.target.value as SceneLayer["position"] })
						}
						className="w-14 text-[8px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/50 [&>option]:bg-[#141417] [&>option]:text-white"
					>
						{POSITIONS.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
					</select>

					<input
						type="number"
						value={layer.size}
						onChange={(e) => updateLayer(li, { size: Number(e.target.value) })}
						className="w-8 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] text-white/40 focus:outline-none"
						title="Size %"
					/>

					<button
						onClick={() => deleteLayer(li)}
						className="text-[9px] text-red-400/30 hover:text-red-400 px-0.5"
					>
						✕
					</button>
				</div>
			))}
		</div>
	);
}
