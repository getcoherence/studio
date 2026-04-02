import { Diamond, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene, SceneTransition } from "@/lib/scene-renderer";
import { renderScene } from "@/lib/scene-renderer";
import { cn } from "@/lib/utils";

interface SceneTimelineProps {
	scenes: Scene[];
	selectedIndex: number;
	onSelectScene: (index: number) => void;
	onAddScene: () => void;
	onDeleteScene: (index: number) => void;
	onUpdateTransition?: (sceneIndex: number, transition: SceneTransition) => void;
}

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;

const TRANSITION_TYPES: Array<{ value: SceneTransition["type"]; label: string }> = [
	{ value: "none", label: "None" },
	{ value: "fade", label: "Fade" },
	{ value: "wipe-left", label: "Wipe Left" },
	{ value: "wipe-right", label: "Wipe Right" },
	{ value: "wipe-up", label: "Wipe Up" },
	{ value: "dissolve", label: "Dissolve" },
	{ value: "zoom", label: "Zoom" },
];

// ── Transition Indicator ─────────────────────────────────────────────────

function TransitionIndicator({
	scene,
	sceneIndex,
	onUpdate,
}: {
	scene: Scene;
	sceneIndex: number;
	onUpdate?: (sceneIndex: number, transition: SceneTransition) => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const transition = scene.transition;

	// Close dropdown on outside click
	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	const hasTransition = transition.type !== "none";

	return (
		<div ref={ref} className="relative flex-shrink-0 flex items-center justify-center w-8">
			<button
				onClick={() => setOpen(!open)}
				className={cn(
					"flex items-center justify-center w-6 h-6 rounded transition-colors",
					hasTransition
						? "text-[#2563eb] bg-[#2563eb]/10 hover:bg-[#2563eb]/20"
						: "text-white/20 hover:text-white/40 hover:bg-white/5",
				)}
				title={hasTransition ? `${transition.type} (${transition.durationMs}ms)` : "No transition"}
			>
				<Diamond size={12} className={hasTransition ? "fill-current" : ""} />
			</button>

			{/* Dropdown */}
			{open && (
				<div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#141417] border border-white/10 rounded-lg shadow-xl p-2 z-[100] w-44">
					<div className="text-[10px] text-white/40 font-medium px-2 py-1 mb-1">Transition</div>
					{TRANSITION_TYPES.map((t) => (
						<button
							key={t.value}
							onClick={() => {
								onUpdate?.(sceneIndex, {
									...transition,
									type: t.value,
									durationMs: t.value === "none" ? 0 : transition.durationMs || 500,
								});
								if (t.value === "none") setOpen(false);
							}}
							className={cn(
								"w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
								transition.type === t.value
									? "text-[#2563eb] bg-[#2563eb]/10"
									: "text-white/60 hover:text-white hover:bg-white/5",
							)}
						>
							{t.label}
						</button>
					))}

					{/* Duration slider (only if a transition is set) */}
					{hasTransition && (
						<div className="mt-2 px-2 pt-2 border-t border-white/5">
							<div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
								<span>Duration</span>
								<span>{transition.durationMs}ms</span>
							</div>
							<input
								type="range"
								min={200}
								max={2000}
								step={100}
								value={transition.durationMs}
								onChange={(e) =>
									onUpdate?.(sceneIndex, {
										...transition,
										durationMs: Number(e.target.value),
									})
								}
								className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-[#2563eb]"
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ── Scene Thumbnail ──────────────────────────────────────────────────────

function SceneThumbnail({
	scene,
	index,
	isSelected,
	onSelect,
	onDelete,
	canDelete,
}: {
	scene: Scene;
	index: number;
	isSelected: boolean;
	onSelect: () => void;
	onDelete: () => void;
	canDelete: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hasRendered = useRef(false);

	useEffect(() => {
		// Render thumbnail once (at t=1000ms to show entrance animations partway)
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const renderTime = Math.min(1000, scene.durationMs / 2);
		renderScene(ctx, scene, renderTime, THUMB_WIDTH * 2, THUMB_HEIGHT * 2);
		hasRendered.current = true;
	}, [scene]);

	return (
		<div
			className={cn(
				"group relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
				"border-2",
				isSelected
					? "border-[#2563eb] ring-1 ring-[#2563eb]/30"
					: "border-white/10 hover:border-white/20",
			)}
			style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
			onClick={onSelect}
		>
			<canvas
				ref={canvasRef}
				width={THUMB_WIDTH * 2}
				height={THUMB_HEIGHT * 2}
				className="w-full h-full"
			/>

			{/* Scene number + duration overlay */}
			<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 flex items-end justify-between">
				<span className="text-[10px] text-white/70 font-medium">Scene {index + 1}</span>
				<span className="text-[10px] text-white/50">{(scene.durationMs / 1000).toFixed(1)}s</span>
			</div>

			{/* Delete button on hover */}
			{canDelete && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className="absolute top-1 right-1 p-1 rounded bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<Trash2 size={12} />
				</button>
			)}
		</div>
	);
}

// ── Scene Timeline ───────────────────────────────────────────────────────

export function SceneTimeline({
	scenes,
	selectedIndex,
	onSelectScene,
	onAddScene,
	onDeleteScene,
	onUpdateTransition,
}: SceneTimelineProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to keep selected scene visible
	const scrollToSelected = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		// Find the actual scene thumbnail (skip transition indicators)
		const thumbnails = container.querySelectorAll("[data-scene-thumb]");
		const child = thumbnails[selectedIndex] as HTMLElement | undefined;
		child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
	}, [selectedIndex]);

	useEffect(() => {
		scrollToSelected();
	}, [scrollToSelected]);

	return (
		<div className="flex-shrink-0 border-t border-white/5 bg-[#09090b]/80 backdrop-blur-sm px-4 py-3">
			<div
				ref={scrollContainerRef}
				className="flex items-center gap-0 overflow-x-auto overflow-y-visible pb-1 scrollbar-thin"
			>
				{scenes.map((scene, i) => (
					<div key={scene.id} className="flex items-center gap-0">
						{/* Transition indicator between scenes */}
						{i > 0 && (
							<TransitionIndicator scene={scene} sceneIndex={i} onUpdate={onUpdateTransition} />
						)}

						<SceneThumbnail
							scene={scene}
							index={i}
							isSelected={i === selectedIndex}
							onSelect={() => onSelectScene(i)}
							onDelete={() => onDeleteScene(i)}
							canDelete={scenes.length > 1}
						/>
					</div>
				))}

				{/* Add scene button */}
				<div className="ml-3">
					<button
						onClick={onAddScene}
						className="flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-white/10 hover:border-[#2563eb]/50 hover:bg-white/5 transition-colors"
						style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
					>
						<Plus size={24} className="text-white/30" />
					</button>
				</div>
			</div>
		</div>
	);
}
