import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Scene, SceneTransition } from "@/lib/scene-renderer";
import { hitTestLayers, renderScene } from "@/lib/scene-renderer";
import { renderTransition } from "@/lib/scene-renderer/transitionRenderer";

interface SceneCanvasProps {
	scene: Scene;
	currentTimeMs: number;
	isPlaying: boolean;
	selectedLayerId: string | null;
	aspectRatio?: string;
	/** When provided, enables transition rendering between scenes during playback */
	transition?: SceneTransition;
	/** Captured last frame of the outgoing scene (set by SceneEditor before advancing) */
	transitionFromCanvas?: HTMLCanvasElement | null;
	onSelectLayer: (layerId: string | null) => void;
	onTimeUpdate?: (timeMs: number) => void;
	onSceneComplete?: () => void;
	onLayerMove?: (layerId: string, x: number, y: number) => void;
	onLayerResize?: (layerId: string, width: number, height: number) => void;
	/** Expose canvas ref to parent for frame capture */
	canvasRefOut?: React.MutableRefObject<HTMLCanvasElement | null>;
}

const BASE_SIZE = 1920;
const HANDLE_SIZE = 12;

function getResolution(ratio: string): { width: number; height: number } {
	const [w, h] = ratio.split("/").map(Number);
	if (!w || !h) return { width: 1920, height: 1080 };
	if (w >= h) return { width: BASE_SIZE, height: Math.round(BASE_SIZE * (h / w)) };
	return { width: Math.round(BASE_SIZE * (w / h)), height: BASE_SIZE };
}

type DragMode = "move" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br" | null;

export function SceneCanvas({
	scene,
	currentTimeMs,
	isPlaying,
	selectedLayerId,
	transition,
	transitionFromCanvas,
	onSelectLayer,
	onTimeUpdate,
	onSceneComplete,
	onLayerMove,
	onLayerResize,
	canvasRefOut,
	aspectRatio = "16/9",
}: SceneCanvasProps) {
	const resolution = useMemo(() => getResolution(aspectRatio), [aspectRatio]);
	const INTERNAL_WIDTH = resolution.width;
	const INTERNAL_HEIGHT = resolution.height;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number>(0);
	const startTimeRef = useRef<number>(0);
	const startOffsetRef = useRef<number>(0);

	// Sync canvas ref to parent
	useEffect(() => {
		if (canvasRefOut) {
			canvasRefOut.current = canvasRef.current;
		}
	});

	const [dragMode, setDragMode] = useState<DragMode>(null);
	const dragStartRef = useRef<{
		x: number;
		y: number;
		layerX: number;
		layerY: number;
		layerW: number;
		layerH: number;
	}>({
		x: 0,
		y: 0,
		layerX: 0,
		layerY: 0,
		layerW: 0,
		layerH: 0,
	});

	// Convert mouse event to internal canvas coordinates (percentage)
	const toCanvasCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
		const canvas = canvasRef.current;
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;
		return { x, y };
	}, []);

	// Check if a point hits a corner handle of the selected layer
	const hitHandle = useCallback(
		(cx: number, cy: number): DragMode => {
			if (!selectedLayerId) return null;
			const layer = scene.layers.find((l) => l.id === selectedLayerId);
			if (!layer) return null;

			const handlePct = (HANDLE_SIZE / INTERNAL_WIDTH) * 100 * 2; // generous hit area
			const lx = layer.position.x;
			const ly = layer.position.y;
			const lw = layer.size.width;
			const lh = layer.size.height;

			if (Math.abs(cx - lx) < handlePct && Math.abs(cy - ly) < handlePct) return "resize-tl";
			if (Math.abs(cx - (lx + lw)) < handlePct && Math.abs(cy - ly) < handlePct) return "resize-tr";
			if (Math.abs(cx - lx) < handlePct && Math.abs(cy - (ly + lh)) < handlePct) return "resize-bl";
			if (Math.abs(cx - (lx + lw)) < handlePct && Math.abs(cy - (ly + lh)) < handlePct)
				return "resize-br";
			return null;
		},
		[selectedLayerId, scene.layers],
	);

	// Render a single frame
	const drawFrame = useCallback(
		(timeMs: number) => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			// Check if we're in a transition phase
			const inTransition =
				transition &&
				transition.type !== "none" &&
				transition.durationMs > 0 &&
				transitionFromCanvas &&
				timeMs < transition.durationMs;

			if (inTransition) {
				// During transition: blend the outgoing captured frame with incoming scene's current frame
				const progress = timeMs / transition.durationMs;

				// Render the incoming scene at time=0+elapsed into an offscreen canvas
				const toCanvas = document.createElement("canvas");
				toCanvas.width = INTERNAL_WIDTH;
				toCanvas.height = INTERNAL_HEIGHT;
				const toCtx = toCanvas.getContext("2d")!;
				renderScene(toCtx, scene, timeMs, INTERNAL_WIDTH, INTERNAL_HEIGHT);

				renderTransition(
					ctx,
					transitionFromCanvas,
					toCanvas,
					progress,
					transition.type,
					INTERNAL_WIDTH,
					INTERNAL_HEIGHT,
				);
				return; // Skip selection overlay during transitions
			}

			// When paused, clamp render time so all layers are visible:
			// - Past entrance animations (so content appears)
			// - Before exit animations (so content doesn't fade out)
			let renderTime = timeMs;
			if (!isPlaying && scene.layers.length > 0) {
				const maxEntrance = Math.max(
					...scene.layers.map((l) => l.startMs + l.entrance.delay + l.entrance.durationMs),
				);
				if (renderTime < maxEntrance) {
					renderTime = maxEntrance + 1;
				}
				// Clamp before exit animations start
				const earliestExit = Math.min(
					...scene.layers.map((l) =>
						l.exit.type !== "none" && l.exit.durationMs > 0
							? l.endMs - l.startMs - l.exit.durationMs - 1
							: Number.MAX_SAFE_INTEGER,
					),
				);
				if (earliestExit < Number.MAX_SAFE_INTEGER && renderTime > earliestExit) {
					renderTime = earliestExit;
				}
			}

			renderScene(ctx, scene, renderTime, INTERNAL_WIDTH, INTERNAL_HEIGHT);

			// Draw selection outline for selected layer
			if (selectedLayerId) {
				const layer = scene.layers.find((l) => l.id === selectedLayerId);
				if (layer) {
					const lx = (layer.position.x / 100) * INTERNAL_WIDTH;
					const ly = (layer.position.y / 100) * INTERNAL_HEIGHT;
					const lw = (layer.size.width / 100) * INTERNAL_WIDTH;
					const lh = (layer.size.height / 100) * INTERNAL_HEIGHT;

					ctx.save();
					ctx.strokeStyle = "#2563eb";
					ctx.lineWidth = 3;
					ctx.setLineDash([8, 4]);
					ctx.strokeRect(lx, ly, lw, lh);

					// Corner handles
					ctx.fillStyle = "#2563eb";
					ctx.setLineDash([]);
					for (const [hx, hy] of [
						[lx, ly],
						[lx + lw, ly],
						[lx, ly + lh],
						[lx + lw, ly + lh],
					]) {
						ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
					}
					ctx.restore();
				}
			}
		},
		[
			scene,
			selectedLayerId,
			isPlaying,
			transition,
			transitionFromCanvas,
			INTERNAL_WIDTH,
			INTERNAL_HEIGHT,
		],
	);

	// Total playback duration includes transition time at the start
	const transitionDuration =
		transition && transition.type !== "none" && transitionFromCanvas ? transition.durationMs : 0;
	const totalPlayDuration = scene.durationMs + transitionDuration;

	// Refs for the playback loop — avoids restarting the effect on every frame
	const drawFrameRef = useRef(drawFrame);
	drawFrameRef.current = drawFrame;
	const onTimeUpdateRef = useRef(onTimeUpdate);
	onTimeUpdateRef.current = onTimeUpdate;
	const onSceneCompleteRef = useRef(onSceneComplete);
	onSceneCompleteRef.current = onSceneComplete;
	const totalPlayDurationRef = useRef(totalPlayDuration);
	totalPlayDurationRef.current = totalPlayDuration;

	// Playback animation loop — only restarts when isPlaying or scene changes
	useEffect(() => {
		if (!isPlaying) {
			drawFrameRef.current(currentTimeMs);
			return;
		}

		startTimeRef.current = performance.now();
		startOffsetRef.current = currentTimeMs;

		const animate = () => {
			const elapsed = performance.now() - startTimeRef.current;
			const timeMs = startOffsetRef.current + elapsed;

			if (timeMs >= totalPlayDurationRef.current) {
				drawFrameRef.current(totalPlayDurationRef.current);
				onTimeUpdateRef.current?.(totalPlayDurationRef.current);
				onSceneCompleteRef.current?.();
				return;
			}

			drawFrameRef.current(timeMs);
			onTimeUpdateRef.current?.(timeMs);
			rafRef.current = requestAnimationFrame(animate);
		};

		rafRef.current = requestAnimationFrame(animate);

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
		// Only restart when play state or scene identity changes — NOT on every time update
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPlaying, scene.id]);

	// Redraw when scene changes while paused.
	// Also schedule a delayed redraw for images that haven't loaded yet.
	useEffect(() => {
		if (!isPlaying) {
			drawFrame(currentTimeMs);
			// Images load async — redraw after a short delay to pick them up
			const t1 = setTimeout(() => drawFrame(currentTimeMs), 100);
			const t2 = setTimeout(() => drawFrame(currentTimeMs), 500);
			const t3 = setTimeout(() => drawFrame(currentTimeMs), 1500);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}
	}, [scene, currentTimeMs, isPlaying, drawFrame]);

	// Mouse down — start drag or select
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const coords = toCanvasCoords(e);

			// Check if hitting a resize handle first
			const handle = hitHandle(coords.x, coords.y);
			if (handle && selectedLayerId) {
				const layer = scene.layers.find((l) => l.id === selectedLayerId);
				if (layer) {
					setDragMode(handle);
					dragStartRef.current = {
						x: coords.x,
						y: coords.y,
						layerX: layer.position.x,
						layerY: layer.position.y,
						layerW: layer.size.width,
						layerH: layer.size.height,
					};
					return;
				}
			}

			// Hit test for layer selection
			const canvas = canvasRef.current;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const scaleX = INTERNAL_WIDTH / rect.width;
			const scaleY = INTERNAL_HEIGHT / rect.height;
			const clickX = (e.clientX - rect.left) * scaleX;
			const clickY = (e.clientY - rect.top) * scaleY;

			const hit = hitTestLayers(
				scene,
				clickX,
				clickY,
				INTERNAL_WIDTH,
				INTERNAL_HEIGHT,
				currentTimeMs === 0 && scene.layers.length > 0
					? Math.max(...scene.layers.map((l) => l.entrance.delay + l.entrance.durationMs)) + 1
					: currentTimeMs,
			);

			if (hit) {
				onSelectLayer(hit.id);
				// Start move drag
				const layer = scene.layers.find((l) => l.id === hit.id);
				if (layer) {
					setDragMode("move");
					dragStartRef.current = {
						x: coords.x,
						y: coords.y,
						layerX: layer.position.x,
						layerY: layer.position.y,
						layerW: layer.size.width,
						layerH: layer.size.height,
					};
				}
			} else {
				onSelectLayer(null);
			}
		},
		[scene, currentTimeMs, selectedLayerId, onSelectLayer, toCanvasCoords, hitHandle],
	);

	// Mouse move — drag in progress
	useEffect(() => {
		if (!dragMode || !selectedLayerId) return;

		const handleMouseMove = (e: MouseEvent) => {
			const coords = toCanvasCoords(e);
			const dx = coords.x - dragStartRef.current.x;
			const dy = coords.y - dragStartRef.current.y;
			const { layerX, layerY, layerW, layerH } = dragStartRef.current;

			if (dragMode === "move") {
				const newX = Math.max(0, Math.min(100 - layerW, layerX + dx));
				const newY = Math.max(0, Math.min(100 - layerH, layerY + dy));
				onLayerMove?.(selectedLayerId, newX, newY);
			} else {
				// Resize from corners
				let newX = layerX;
				let newY = layerY;
				let newW = layerW;
				let newH = layerH;

				if (dragMode === "resize-br") {
					newW = Math.max(5, layerW + dx);
					newH = Math.max(3, layerH + dy);
				} else if (dragMode === "resize-bl") {
					newX = Math.max(0, layerX + dx);
					newW = Math.max(5, layerW - dx);
					newH = Math.max(3, layerH + dy);
				} else if (dragMode === "resize-tr") {
					newW = Math.max(5, layerW + dx);
					newY = Math.max(0, layerY + dy);
					newH = Math.max(3, layerH - dy);
				} else if (dragMode === "resize-tl") {
					newX = Math.max(0, layerX + dx);
					newY = Math.max(0, layerY + dy);
					newW = Math.max(5, layerW - dx);
					newH = Math.max(3, layerH - dy);
				}

				onLayerMove?.(selectedLayerId, newX, newY);
				onLayerResize?.(selectedLayerId, newW, newH);
			}
		};

		const handleMouseUp = () => {
			setDragMode(null);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [dragMode, selectedLayerId, onLayerMove, onLayerResize, toCanvasCoords]);

	// Cursor style based on hover
	const handleMouseMoveCanvas = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas || dragMode) return;
			const coords = toCanvasCoords(e);
			const handle = hitHandle(coords.x, coords.y);
			if (handle === "resize-tl" || handle === "resize-br") {
				canvas.style.cursor = "nwse-resize";
			} else if (handle === "resize-tr" || handle === "resize-bl") {
				canvas.style.cursor = "nesw-resize";
			} else {
				canvas.style.cursor = selectedLayerId ? "move" : "crosshair";
			}
		},
		[selectedLayerId, dragMode, toCanvasCoords, hitHandle],
	);

	return (
		<div
			ref={containerRef}
			className="flex-1 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden"
		>
			<canvas
				ref={canvasRef}
				width={INTERNAL_WIDTH}
				height={INTERNAL_HEIGHT}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMoveCanvas}
				className="max-w-full max-h-full"
				style={{ aspectRatio }}
			/>
		</div>
	);
}
