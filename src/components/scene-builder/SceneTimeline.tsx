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

const DEFAULT_THUMB_HEIGHT = 90;
const MIN_THUMB_HEIGHT = 64;
const MAX_THUMB_HEIGHT = 240;

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
	const buttonRef = useRef<HTMLButtonElement>(null);
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

	// Calculate position when rendering
	const getDropdownStyle = (): React.CSSProperties => {
		if (!buttonRef.current) return { display: "none" };
		const rect = buttonRef.current.getBoundingClientRect();
		return {
			position: "fixed",
			bottom: window.innerHeight - rect.top + 8,
			left: rect.left + rect.width / 2,
			transform: "translateX(-50%)",
		};
	};

	return (
		<div ref={ref} className="relative flex-shrink-0 flex items-center justify-center w-8">
			<button
				ref={buttonRef}
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

			{/* Dropdown — uses fixed positioning to escape overflow clipping */}
			{open && (
				<div
					className="bg-[#141417] border border-white/10 rounded-lg shadow-xl p-2 z-[100] w-44"
					style={getDropdownStyle()}
				>
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
	thumbWidth,
	thumbHeight,
}: {
	scene: Scene;
	index: number;
	isSelected: boolean;
	onSelect: () => void;
	onDelete: () => void;
	canDelete: boolean;
	thumbWidth: number;
	thumbHeight: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderWidth = Math.round(thumbWidth * 2);
	const renderHeight = Math.round(thumbHeight * 2);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const renderTime = Math.min(1000, scene.durationMs / 2);
		renderScene(ctx, scene, renderTime, renderWidth, renderHeight);
	}, [scene, renderWidth, renderHeight]);

	return (
		<div
			className={cn(
				"group relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
				"border-2",
				isSelected
					? "border-[#2563eb] ring-1 ring-[#2563eb]/30"
					: "border-white/10 hover:border-white/20",
			)}
			style={{ width: thumbWidth, height: thumbHeight }}
			onClick={onSelect}
		>
			<canvas ref={canvasRef} width={renderWidth} height={renderHeight} className="w-full h-full" />

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
	const [thumbHeight, setThumbHeight] = useState(DEFAULT_THUMB_HEIGHT);
	const isDraggingRef = useRef(false);
	const startYRef = useRef(0);
	const startHeightRef = useRef(DEFAULT_THUMB_HEIGHT);

	const thumbWidth = Math.round(thumbHeight * (16 / 9));

	// ── Resize drag handling ──
	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDraggingRef.current = true;
			startYRef.current = e.clientY;
			startHeightRef.current = thumbHeight;

			const handleMove = (me: MouseEvent) => {
				if (!isDraggingRef.current) return;
				const delta = startYRef.current - me.clientY; // dragging up = bigger
				const newHeight = Math.max(
					MIN_THUMB_HEIGHT,
					Math.min(MAX_THUMB_HEIGHT, startHeightRef.current + delta),
				);
				setThumbHeight(newHeight);
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
		[thumbHeight],
	);

	// Auto-scroll to keep selected scene visible
	const scrollToSelected = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const thumbnails = container.querySelectorAll("[data-scene-thumb]");
		const child = thumbnails[selectedIndex] as HTMLElement | undefined;
		child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
	}, [selectedIndex]);

	useEffect(() => {
		scrollToSelected();
	}, [scrollToSelected]);

	return (
		<div className="flex-shrink-0 bg-[#09090b]/80 backdrop-blur-sm relative z-20">
			{/* Resize handle */}
			<div
				onMouseDown={handleResizeStart}
				className="h-1.5 border-t border-white/5 cursor-ns-resize hover:bg-[#2563eb]/30 active:bg-[#2563eb]/50 transition-colors"
				title="Drag to resize thumbnails"
			/>
			<div className="px-4 py-3">
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
								thumbWidth={thumbWidth}
								thumbHeight={thumbHeight}
							/>
						</div>
					))}

					{/* Add scene button */}
					<div className="ml-3">
						<button
							onClick={onAddScene}
							className="flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-white/10 hover:border-[#2563eb]/50 hover:bg-white/5 transition-colors"
							style={{ width: thumbWidth, height: thumbHeight }}
						>
							<Plus size={24} className="text-white/30" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
