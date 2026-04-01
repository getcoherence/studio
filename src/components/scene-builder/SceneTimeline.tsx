import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { Scene } from "@/lib/scene-renderer";
import { renderScene } from "@/lib/scene-renderer";
import { cn } from "@/lib/utils";

interface SceneTimelineProps {
	scenes: Scene[];
	selectedIndex: number;
	onSelectScene: (index: number) => void;
	onAddScene: () => void;
	onDeleteScene: (index: number) => void;
}

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;

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

export function SceneTimeline({
	scenes,
	selectedIndex,
	onSelectScene,
	onAddScene,
	onDeleteScene,
}: SceneTimelineProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to keep selected scene visible
	const scrollToSelected = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const child = container.children[selectedIndex] as HTMLElement | undefined;
		child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
	}, [selectedIndex]);

	useEffect(() => {
		scrollToSelected();
	}, [scrollToSelected]);

	return (
		<div className="flex-shrink-0 border-t border-white/5 bg-[#09090b]/80 backdrop-blur-sm px-4 py-3">
			<div
				ref={scrollContainerRef}
				className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin"
			>
				{scenes.map((scene, i) => (
					<SceneThumbnail
						key={scene.id}
						scene={scene}
						index={i}
						isSelected={i === selectedIndex}
						onSelect={() => onSelectScene(i)}
						onDelete={() => onDeleteScene(i)}
						canDelete={scenes.length > 1}
					/>
				))}

				{/* Add scene button */}
				<button
					onClick={onAddScene}
					className="flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-white/10 hover:border-[#2563eb]/50 hover:bg-white/5 transition-colors"
					style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
				>
					<Plus size={24} className="text-white/30" />
				</button>
			</div>
		</div>
	);
}
