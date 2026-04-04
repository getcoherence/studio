// ── Scene Layer Editor ──────────────────────────────────────────────────
//
// Inline layer editor for a single scene's layers.
// Supports drag-to-reorder via HTML5 drag and drop.

import { useCallback, useRef, useState } from "react";
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
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);

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

	const moveLayer = useCallback(
		(fromIndex: number, toIndex: number) => {
			if (fromIndex === toIndex) return;
			const newLayers = [...layers];
			const [moved] = newLayers.splice(fromIndex, 1);
			newLayers.splice(toIndex, 0, moved);
			onUpdate(sceneIndex, { layers: newLayers });
		},
		[layers, sceneIndex, onUpdate],
	);

	// ── Drag handlers ──
	const handleDragStart = (e: React.DragEvent, index: number) => {
		setDragIndex(index);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", String(index));
		// Make the drag image subtle
		const el = e.currentTarget as HTMLElement;
		el.style.opacity = "0.5";
	};

	const handleDragEnd = (e: React.DragEvent) => {
		(e.currentTarget as HTMLElement).style.opacity = "1";
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDropIndex(index);
	};

	const handleDrop = (e: React.DragEvent, toIndex: number) => {
		e.preventDefault();
		const fromIndex = dragIndex;
		if (fromIndex !== null) {
			moveLayer(fromIndex, toIndex);
		}
		setDragIndex(null);
		setDropIndex(null);
	};

	return (
		<div className="space-y-1 pt-2 border-t border-white/5 mt-2">
			<div className="flex items-center justify-between">
				<span className="text-[11px] text-white/30">Layers ({layers.length})</span>
				<button onClick={addLayer} className="text-[11px] text-[#2563eb] hover:text-[#60a5fa]">
					+ Add
				</button>
			</div>

			{layers.map((layer, li) => (
				<div
					key={layer.id}
					draggable
					onDragStart={(e) => handleDragStart(e, li)}
					onDragEnd={handleDragEnd}
					onDragOver={(e) => handleDragOver(e, li)}
					onDrop={(e) => handleDrop(e, li)}
					className={`flex gap-1 items-center rounded px-1 py-0.5 transition-colors cursor-grab active:cursor-grabbing ${
						dropIndex === li && dragIndex !== null && dragIndex !== li
							? "bg-[#2563eb]/20 border border-[#2563eb]/30"
							: dragIndex === li
								? "opacity-50"
								: "hover:bg-white/[0.02]"
					}`}
				>
					{/* Drag handle */}
					<span
						className="text-white/15 cursor-grab text-[11px] select-none"
						title="Drag to reorder"
					>
						⠿
					</span>

					<select
						value={layer.type}
						onChange={(e) => updateLayer(li, { type: e.target.value as SceneLayer["type"] })}
						className="w-12 text-[11px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/50 [&>option]:bg-[#141417] [&>option]:text-white"
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
						className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/50 focus:outline-none focus:border-[#2563eb]/50"
					/>

					<select
						value={layer.position}
						onChange={(e) =>
							updateLayer(li, { position: e.target.value as SceneLayer["position"] })
						}
						className="w-14 text-[11px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/50 [&>option]:bg-[#141417] [&>option]:text-white"
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
						className="w-8 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/40 focus:outline-none"
						title="Size %"
					/>

					<button
						onClick={() => deleteLayer(li)}
						className="text-[11px] text-red-400/30 hover:text-red-400 px-0.5"
					>
						✕
					</button>
				</div>
			))}
		</div>
	);
}
