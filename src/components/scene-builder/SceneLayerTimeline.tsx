// ── Scene Layer Timeline ────────────────────────────────────────────────
//
// Horizontal multi-track timeline for the Scene/Motion editor.
// Resizable height, scrollable + zoomable with Ctrl+Scroll.

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ScenePlan } from "@/lib/ai/scenePlan";
import { expandSceneToLayers } from "@/lib/ai/scenePlanCompiler";

function getLayerLabel(layer: { type: string; content: string }) {
	if (layer.type === "card") { try { return JSON.parse(layer.content).title; } catch { return layer.content; } }
	return layer.content;
}

interface SceneLayerTimelineProps {
	plan: ScenePlan;
	currentFrame: number;
	onSeekToFrame: (frame: number) => void;
	onAddLayer: (sceneIndex: number) => void;
	onSelectLayer: (sceneIndex: number, layerIndex: number) => void;
}

const TRACK_HEIGHT = 32;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 160;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

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
	card: "rgba(236,72,153,0.5)",
};

export function SceneLayerTimeline({
	plan,
	currentFrame,
	onSeekToFrame,
	onSelectLayer,
}: SceneLayerTimelineProps) {
	const [height, setHeight] = useState(DEFAULT_HEIGHT);
	const [zoom, setZoom] = useState(1);
	const scrollRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef(false);
	const startYRef = useRef(0);
	const startHeightRef = useRef(DEFAULT_HEIGHT);

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

	// ── Resize ──
	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDraggingRef.current = true;
			startYRef.current = e.clientY;
			startHeightRef.current = height;

			const handleMove = (me: MouseEvent) => {
				if (!isDraggingRef.current) return;
				const delta = startYRef.current - me.clientY;
				setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeightRef.current + delta)));
			};
			const handleUp = () => {
				isDraggingRef.current = false;
				document.removeEventListener("mousemove", handleMove);
				document.removeEventListener("mouseup", handleUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};
			document.addEventListener("mousemove", handleMove);
			document.addEventListener("mouseup", handleUp);
			document.body.style.cursor = "ns-resize";
			document.body.style.userSelect = "none";
		},
		[height],
	);

	// ── Zoom (Ctrl+Scroll) ──
	const handleWheel = useCallback((e: React.WheelEvent) => {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -0.3 : 0.3;
			setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
		}
	}, []);

	// ── Grab to pan (middle-click or long-hold) ──
	const isGrabbingRef = useRef(false);
	const grabStartXRef = useRef(0);
	const grabScrollRef = useRef(0);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		// Middle-click or hold for grab-to-pan
		if (e.button === 1 || e.altKey) {
			e.preventDefault();
			isGrabbingRef.current = true;
			grabStartXRef.current = e.clientX;
			grabScrollRef.current = scrollRef.current?.scrollLeft || 0;
			document.body.style.cursor = "grabbing";

			const handleMove = (me: MouseEvent) => {
				if (!isGrabbingRef.current || !scrollRef.current) return;
				const delta = grabStartXRef.current - me.clientX;
				scrollRef.current.scrollLeft = grabScrollRef.current + delta;
			};
			const handleUp = () => {
				isGrabbingRef.current = false;
				document.body.style.cursor = "";
				document.removeEventListener("mousemove", handleMove);
				document.removeEventListener("mouseup", handleUp);
			};
			document.addEventListener("mousemove", handleMove);
			document.addEventListener("mouseup", handleUp);
		}
	}, []);

	// ── Click to seek ──
	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const scrollEl = scrollRef.current;
			if (!scrollEl) return;
			const rect = scrollEl.getBoundingClientRect();
			const x = e.clientX - rect.left + scrollEl.scrollLeft;
			const totalWidth = scrollEl.scrollWidth;
			const frame = Math.round((x / totalWidth) * totalFrames);
			onSeekToFrame(Math.max(0, Math.min(totalFrames - 1, frame)));
		},
		[totalFrames, onSeekToFrame],
	);

	const playheadPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;
	const maxLayers = Math.max(
		1,
		...plan.scenes.map(
			(s) =>
				(s.layers && s.layers.length > 0
					? s.layers
					: expandSceneToLayers(s, plan.accentColor || "#2563eb")
				).length,
		),
	);
	const timelineWidth = `${zoom * 100}%`;

	return (
		<div className="flex flex-col bg-[#09090b]/90">
			{/* Resize handle */}
			<div
				onMouseDown={handleResizeStart}
				className="h-1.5 border-t border-white/5 cursor-ns-resize hover:bg-[#2563eb]/30 active:bg-[#2563eb]/50 transition-colors"
			/>

			{/* Scrollable timeline */}
			<div
				ref={scrollRef}
				className="overflow-x-auto overflow-y-auto"
				style={{ height }}
				onWheel={handleWheel}
				onMouseDown={handleMouseDown}
			>
				<div style={{ width: timelineWidth, minWidth: "100%" }}>
					{/* Time ruler */}
					<div
						className="relative h-5 bg-[#0c0c0f] border-b border-white/5 cursor-pointer sticky top-0 z-20"
						onClick={handleClick}
					>
						{Array.from({ length: Math.ceil(totalFrames / 30) + 1 }, (_, i) => {
							const pct = totalFrames > 0 ? ((i * 30) / totalFrames) * 100 : 0;
							return (
								<span
									key={i}
									className="absolute top-0.5 text-[9px] text-white/25 select-none"
									style={{ left: `${pct}%` }}
								>
									{i}s
								</span>
							);
						})}
						<div
							className="absolute top-0 bottom-0 w-0.5 bg-[#2563eb] z-10"
							style={{ left: `${playheadPercent}%` }}
						/>
					</div>

					{/* Scene track — sticky */}
					<div
						className="relative cursor-pointer sticky z-10 bg-[#0c0c0f] border-b border-white/10"
						style={{ height: TRACK_HEIGHT, top: 20 }}
						onClick={handleClick}
					>
						{plan.scenes.map((scene, i) => {
							const startPct = totalFrames > 0 ? (sceneOffsets[i] / totalFrames) * 100 : 0;
							const widthPct =
								totalFrames > 0 ? ((scene.durationFrames || 90) / totalFrames) * 100 : 0;
							return (
								<div
									key={i}
									className="absolute top-0 bottom-0 border-r border-white/10 flex items-center px-2 overflow-hidden"
									style={{
										left: `${startPct}%`,
										width: `${widthPct}%`,
										backgroundColor: SCENE_COLORS[i % SCENE_COLORS.length],
									}}
									title={`Scene ${i + 1}: ${scene.headline || "Untitled"}`}
								>
									<span className="text-[10px] text-white/60 truncate font-medium">
										S{i + 1}: {scene.headline || "Scene"}
									</span>
								</div>
							);
						})}
						<div
							className="absolute top-0 bottom-0 w-0.5 bg-[#2563eb] z-10"
							style={{ left: `${playheadPercent}%` }}
						/>
					</div>

					{/* Layer tracks */}
					{Array.from({ length: Math.min(maxLayers, 10) }, (_, trackIndex) => (
						<div
							key={trackIndex}
							className="relative border-t border-white/[0.03] cursor-pointer"
							style={{ height: TRACK_HEIGHT }}
							onClick={handleClick}
						>
							{plan.scenes.map((scene, si) => {
								const layers =
									scene.layers && scene.layers.length > 0
										? scene.layers
										: expandSceneToLayers(scene, plan.accentColor || "#2563eb");
								const layer = layers[trackIndex];
								if (!layer) return null;

								const sceneStart = sceneOffsets[si];
								const sceneDur = scene.durationFrames || 90;
								const layerStart = sceneStart + layer.startFrame;
								const layerEnd =
									layer.endFrame === -1 ? sceneStart + sceneDur : sceneStart + layer.endFrame;
								const startPct = totalFrames > 0 ? (layerStart / totalFrames) * 100 : 0;
								const widthPct =
									totalFrames > 0 ? ((layerEnd - layerStart) / totalFrames) * 100 : 0;

								return (
									<div
										key={`${si}-${trackIndex}`}
										className="absolute top-0.5 rounded-sm cursor-pointer hover:brightness-125 transition-all flex items-center px-1 overflow-hidden"
										style={{
											left: `${startPct}%`,
											width: `${widthPct}%`,
											height: TRACK_HEIGHT - 4,
											backgroundColor: LAYER_COLORS[layer.type] || "rgba(255,255,255,0.15)",
										}}
										onClick={(e) => {
											e.stopPropagation();
											onSelectLayer(si, trackIndex);
											onSeekToFrame(layerStart);
										}}
										title={`${layer.type}: ${getLayerLabel(layer).slice(0, 40)}`}
									>
										<span className="text-[11px] text-white/70 truncate select-none">
											{getLayerLabel(layer).slice(0, 25)}
										</span>
									</div>
								);
							})}

							<div
								className="absolute top-0 bottom-0 w-0.5 bg-[#2563eb] z-10"
								style={{ left: `${playheadPercent}%` }}
							/>
						</div>
					))}
				</div>
			</div>

			{/* Zoom indicator */}
			<div className="flex items-center justify-between px-3 py-1 border-t border-white/5 text-[9px] text-white/20">
				<span>Ctrl+Scroll to zoom • Scroll to pan</span>
				<span>{zoom.toFixed(1)}x</span>
			</div>
		</div>
	);
}
