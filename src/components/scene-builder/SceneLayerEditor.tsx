// ── Scene Layer Editor ──────────────────────────────────────────────────

import { useCallback, useState } from "react";
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
			size: 80,
			startFrame: 0,
			endFrame: -1,
			settings: { fontSize: 100, animation: "words" },
		};
		onUpdate(sceneIndex, { layers: [...layers, newLayer] });
	};

	const updateLayer = (li: number, updates: Partial<SceneLayer>) => {
		const newLayers = layers.map((l, i) => (i === li ? { ...l, ...updates } : l));
		onUpdate(sceneIndex, { layers: newLayers });
	};

	const deleteLayer = (li: number) => {
		onUpdate(sceneIndex, { layers: layers.filter((_, i) => i !== li) });
	};

	const moveLayer = useCallback(
		(from: number, to: number) => {
			if (from === to) return;
			const n = [...layers];
			const [moved] = n.splice(from, 1);
			n.splice(to, 0, moved);
			onUpdate(sceneIndex, { layers: n });
		},
		[layers, sceneIndex, onUpdate],
	);

	const handleDragStart = (e: React.DragEvent, i: number) => { setDragIndex(i); (e.currentTarget as HTMLElement).style.opacity = "0.5"; };
	const handleDragEnd = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setDragIndex(null); setDropIndex(null); };
	const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDropIndex(i); };
	const handleDrop = (e: React.DragEvent, to: number) => { e.preventDefault(); if (dragIndex !== null) moveLayer(dragIndex, to); setDragIndex(null); setDropIndex(null); };

	// Parse card content
	const getCard = (layer: SceneLayer) => {
		try { return JSON.parse(layer.content); } catch { return { title: "", description: "" }; }
	};

	return (
		<div className="space-y-2 pt-2 border-t border-white/5 mt-2">
			<div className="flex items-center justify-between">
				<span className="text-[11px] text-white/30">Layers ({layers.length})</span>
				<button onClick={addLayer} className="text-[11px] text-[#2563eb] hover:text-[#60a5fa]">+ Add</button>
			</div>

			{layers.map((layer, li) => {
				const card = layer.type === "card" ? getCard(layer) : null;

				return (
					<div
						key={layer.id}
						draggable
						onDragStart={(e) => handleDragStart(e, li)}
						onDragEnd={handleDragEnd}
						onDragOver={(e) => handleDragOver(e, li)}
						onDrop={(e) => handleDrop(e, li)}
						className={`rounded border p-1.5 space-y-1 transition-colors cursor-grab active:cursor-grabbing ${
							dropIndex === li && dragIndex !== null && dragIndex !== li
								? "border-[#2563eb]/30 bg-[#2563eb]/10"
								: "border-white/5 bg-white/[0.02]"
						}`}
					>
						{/* Row 1: Type + Content/Title + Delete */}
						<div className="flex gap-1 items-center">
							<span className="text-white/15 cursor-grab text-[11px] select-none" title="Drag to reorder">⠿</span>
							<select
								value={layer.type}
								onChange={(e) => updateLayer(li, { type: e.target.value as SceneLayer["type"] })}
								className="w-12 text-[10px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/50 [&>option]:bg-[#141417] [&>option]:text-white"
							>
								<option value="text">Text</option>
								<option value="card">Card</option>
								<option value="lottie">Lottie</option>
								<option value="image">Image</option>
								<option value="shape">Shape</option>
							</select>

							{layer.type === "card" ? (
								<input type="text" value={card?.title || ""} onChange={(e) => updateLayer(li, { content: JSON.stringify({ ...card, title: e.target.value }) })} onKeyDown={(e) => e.stopPropagation()} className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/60 focus:outline-none" placeholder="Card title" />
							) : (
								<input type="text" value={layer.content} onChange={(e) => updateLayer(li, { content: e.target.value })} onKeyDown={(e) => e.stopPropagation()} className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/50 focus:outline-none" />
							)}

							<button onClick={() => deleteLayer(li)} className="text-[11px] text-red-400/30 hover:text-red-400 px-0.5">✕</button>
						</div>

						{/* Row 2: Card description */}
						{layer.type === "card" && (
							<div className="flex gap-1 items-center"><input type="text" value={card?.description || ""} onChange={(e) => updateLayer(li, { content: JSON.stringify({ ...card, description: e.target.value }) })} onKeyDown={(e) => e.stopPropagation()} className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/40 focus:outline-none" placeholder="Card description" /><input type="color" value={layer.settings?.color || "#16181f"} onChange={(e) => updateLayer(li, { settings: { ...layer.settings, color: e.target.value } })} className="w-8 h-7 rounded border border-white/10 cursor-pointer bg-transparent p-0" title="Card background color" /></div>
						
						)}

						{/* Row 2/3: Layout + Timing */}
						<div className="flex gap-1 items-center text-[10px]">
							<select value={layer.position} onChange={(e) => updateLayer(li, { position: e.target.value as SceneLayer["position"] })} className="text-[10px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/40 [&>option]:bg-[#141417] [&>option]:text-white">
								{POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
							</select>

							<span className="text-white/20">Size</span>
							<input type="number" value={layer.size} onChange={(e) => updateLayer(li, { size: Number(e.target.value) })} className="w-8 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 focus:outline-none" />

							<span className="text-white/20 ml-1">In</span>
							<input type="number" value={layer.startFrame} onChange={(e) => updateLayer(li, { startFrame: Number(e.target.value) })} className="w-8 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-400/50 focus:outline-none" title="Start frame" />

							<span className="text-white/20">Out</span>
							<input type="number" value={layer.endFrame} onChange={(e) => updateLayer(li, { endFrame: Number(e.target.value) })} className="w-8 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-amber-400/50 focus:outline-none" title="End frame (-1 = scene end)" />
						</div>

						{/* Row 3: Text animation settings */}
						{layer.type === "text" && (
							<div className="flex gap-1 items-center text-[10px]">
								<select value={layer.settings?.animation || "chars"} onChange={(e) => updateLayer(li, { settings: { ...layer.settings, animation: e.target.value } })} className="text-[10px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-purple-400/60 [&>option]:bg-[#141417] [&>option]:text-white">
									<option value="chars">Per-Char</option>
									<option value="words">Words</option>
									<option value="scale">Scale</option>
									<option value="clip">Clip</option>
									<option value="gradient">Gradient</option>
									<option value="glitch">Glitch</option>
									<option value="blur-in">Blur</option>
									<option value="bounce">Bounce</option>
									<option value="wave">Wave</option>
									<option value="none">None</option>
								</select>
								<span className="text-white/20">Sz</span>
								<input type="number" value={layer.settings?.fontSize || 100} onChange={(e) => updateLayer(li, { settings: { ...layer.settings, fontSize: Number(e.target.value) } })} className="w-10 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 focus:outline-none" step={4} />
								<input type="color" value={layer.settings?.color || "#ffffff"} onChange={(e) => updateLayer(li, { settings: { ...layer.settings, color: e.target.value } })} className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent" />
								<input type="text" value={layer.settings?.accentWord || ""} onChange={(e) => updateLayer(li, { settings: { ...layer.settings, accentWord: e.target.value || undefined } })} onKeyDown={(e) => e.stopPropagation()} className="w-16 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[#60a5fa]/50 focus:outline-none" placeholder="Highlight" />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
