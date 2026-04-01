import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Scene } from "@/lib/scene-renderer";
import { hitTestLayers, renderScene } from "@/lib/scene-renderer";

interface SceneCanvasProps {
	scene: Scene;
	currentTimeMs: number;
	isPlaying: boolean;
	selectedLayerId: string | null;
	aspectRatio?: string;
	onSelectLayer: (layerId: string | null) => void;
	onTimeUpdate?: (timeMs: number) => void;
	onSceneComplete?: () => void;
	onLayerMove?: (layerId: string, x: number, y: number) => void;
	onLayerResize?: (layerId: string, width: number, height: number) => void;
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
	onSelectLayer,
	onTimeUpdate,
	onSceneComplete,
	onLayerMove,
	onLayerResize,
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

			// When paused, ensure all layers are past their entrance animations
			// so content is always visible while editing
			let renderTime = timeMs;
			if (!isPlaying && scene.layers.length > 0) {
				const maxEntrance = Math.max(
					...scene.layers.map((l) => l.startMs + l.entrance.delay + l.entrance.durationMs),
				);
				if (renderTime < maxEntrance) {
					renderTime = maxEntrance + 1;
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
		[scene, selectedLayerId, isPlaying],
	);

	// Playback animation loop
	useEffect(() => {
		if (!isPlaying) {
			drawFrame(currentTimeMs);
			return;
		}

		startTimeRef.current = performance.now();
		startOffsetRef.current = currentTimeMs;

		const animate = () => {
			const elapsed = performance.now() - startTimeRef.current;
			const timeMs = startOffsetRef.current + elapsed;

			if (timeMs >= scene.durationMs) {
				drawFrame(scene.durationMs);
				onTimeUpdate?.(scene.durationMs);
				onSceneComplete?.();
				return;
			}

			drawFrame(timeMs);
			onTimeUpdate?.(timeMs);
			rafRef.current = requestAnimationFrame(animate);
		};

		rafRef.current = requestAnimationFrame(animate);

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [isPlaying, currentTimeMs, scene, drawFrame, onTimeUpdate, onSceneComplete]);

	// Redraw when scene changes while paused
	useEffect(() => {
		if (!isPlaying) {
			drawFrame(currentTimeMs);
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
