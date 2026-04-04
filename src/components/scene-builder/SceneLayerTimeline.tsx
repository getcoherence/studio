// ── Scene Layer Timeline ────────────────────────────────────────────────
//
// Horizontal multi-track timeline for the Scene/Motion editor.
// Shows scenes as proportional blocks with layers as sub-tracks.
// Clicking a scene/layer seeks the player to that position.

import { Plus } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import type { SceneLayer, ScenePlan } from "@/lib/ai/scenePlan";

interface SceneLayerTimelineProps {
	plan: ScenePlan;
	currentFrame: number;
	onSeekToFrame: (frame: number) => void;
	onAddLayer: (sceneIndex: number) => void;
	onSelectLayer: (sceneIndex: number, layerIndex: number) => void;
}

const TRACK_HEIGHT = 28;
const SCENE_COLORS = [
	"rgba(37,99,235,0.3)",
	"rgba(139,92,246,0.3)",
	"rgba(236,72,153,0.3)",
	"rgba(34,197,94,0.3)",
	"rgba(245,158,11,0.3)",
	"rgba(14,165,233,0.3)",
	"rgba(168,85,247,0.3)",
	"rgba(249,115,22,0.3)",
];

const LAYER_COLORS: Record<string, string> = {
	text: "rgba(59,130,246,0.6)",
	lottie: "rgba(168,85,247,0.6)",
	image: "rgba(34,197,94,0.6)",
	shape: "rgba(245,158,11,0.6)",
};

export function SceneLayerTimeline({
	plan,
	currentFrame,
	onSeekToFrame,
	onAddLayer,
	onSelectLayer,
}: SceneLayerTimelineProps) {
	const totalFrames = useMemo(
		() => plan.scenes.reduce((sum, s) => sum + (s.durationFrames || 90), 0),
		[plan.scenes],
	);

	const sceneOffsets = useMemo(() => {
		const offsets: number[] = [];
		let offset = 0;
		for (const scene of plan.scenes) {
			offsets.push(offset);
			offset += scene.durationFrames || 90;
		}
		return offsets;
	}, [plan.scenes]);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const frame = Math.round((x / rect.width) * totalFrames);
			onSeekToFrame(Math.max(0, Math.min(totalFrames - 1, frame)));
		},
		[totalFrames, onSeekToFrame],
	);

	// Playhead position
	const playheadPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

	// Max layers across all scenes (for track count)
	const maxLayers = Math.max(1, ...plan.scenes.map((s) => (s.layers?.length || 0) + 1));

	return (
		<div className="flex flex-col border-t border-white/5 bg-[#09090b]/90">
			{/* Time ruler */}
			<div
				className="relative h-5 bg-[#0c0c0f] border-b border-white/5 cursor-pointer"
				onClick={handleClick}
			>
				{/* Time markers */}
				{Array.from({ length: Math.ceil(totalFrames / 30) + 1 }, (_, i) => {
					const pct = totalFrames > 0 ? ((i * 30) / totalFrames) * 100 : 0;
					return (
						<span
							key={i}
							className="absolute top-0 text-[8px] text-white/20"
							style={{ left: `${pct}%` }}
						>
							{i}s
						</span>
					);
				})}
				{/* Playhead */}
				<div
					className="absolute top-0 bottom-0 w-0.5 bg-[#2563eb] z-10"
					style={{ left: `${playheadPercent}%` }}
				/>
			</div>

			{/* Scene track */}
			<div
				className="relative cursor-pointer"
				style={{ height: TRACK_HEIGHT }}
				onClick={handleClick}
			>
				{plan.scenes.map((scene, i) => {
					const startPct = totalFrames > 0 ? (sceneOffsets[i] / totalFrames) * 100 : 0;
					const widthPct = totalFrames > 0 ? ((scene.durationFrames || 90) / totalFrames) * 100 : 0;

					return (
						<div
							key={i}
							className="absolute top-0 bottom-0 border-r border-white/10 flex items-center px-1.5 overflow-hidden"
							style={{
								left: `${startPct}%`,
								width: `${widthPct}%`,
								backgroundColor: SCENE_COLORS[i % SCENE_COLORS.length],
							}}
							title={`Scene ${i + 1}: ${scene.headline}`}
						>
							<span className="text-[9px] text-white/60 truncate font-medium">
								{scene.headline}
							</span>
						</div>
					);
				})}
				{/* Playhead */}
				<div
					className="absolute top-0 bottom-0 w-0.5 bg-[#2563eb] z-10"
					style={{ left: `${playheadPercent}%` }}
				/>
			</div>

			{/* Layer tracks */}
			{Array.from({ length: Math.min(maxLayers, 4) }, (_, trackIndex) => (
				<div
					key={trackIndex}
					className="relative border-t border-white/5 cursor-pointer"
					style={{ height: TRACK_HEIGHT }}
					onClick={handleClick}
				>
					{/* Layer label */}
					{trackIndex === 0 && (
						<span className="absolute left-1 top-1 text-[8px] text-white/15 z-5">Layers</span>
					)}

					{plan.scenes.map((scene, si) => {
						const layers = scene.layers || [];
						const layer = layers[trackIndex];
						if (!layer) return null;

						const sceneStart = sceneOffsets[si];
						const sceneDur = scene.durationFrames || 90;
						const layerStart = sceneStart + layer.startFrame;
						const layerEnd =
							layer.endFrame === -1 ? sceneStart + sceneDur : sceneStart + layer.endFrame;
						const startPct = totalFrames > 0 ? (layerStart / totalFrames) * 100 : 0;
						const widthPct = totalFrames > 0 ? ((layerEnd - layerStart) / totalFrames) * 100 : 0;

						return (
							<div
								key={`${si}-${trackIndex}`}
								className="absolute top-1 rounded cursor-pointer hover:brightness-125 transition-all"
								style={{
									left: `${startPct}%`,
									width: `${widthPct}%`,
									height: TRACK_HEIGHT - 8,
									backgroundColor: LAYER_COLORS[layer.type] || "rgba(255,255,255,0.2)",
								}}
								onClick={(e) => {
									e.stopPropagation();
									onSelectLayer(si, trackIndex);
									onSeekToFrame(layerStart);
								}}
								title={`${layer.type}: ${layer.content.slice(0, 30)}`}
							>
								<span className="text-[8px] text-white/70 px-1 truncate block leading-5">
									{layer.content.slice(0, 20)}
								</span>
							</div>
						);
					})}

					{/* Playhead */}
					<div
						className="absolute top-0 bottom-0 w-0.5 bg-[#2563eb] z-10"
						style={{ left: `${playheadPercent}%` }}
					/>
				</div>
			))}

			{/* Add layer hint */}
			<div className="flex items-center justify-center py-1 border-t border-white/5">
				<span className="text-[9px] text-white/20">
					Add layers in the Scenes tab to see them here
				</span>
			</div>
		</div>
	);
}
