import { useCallback, useEffect, useRef } from "react";
import type { Scene } from "@/lib/scene-renderer";
import { hitTestLayers, renderScene } from "@/lib/scene-renderer";

interface SceneCanvasProps {
	scene: Scene;
	currentTimeMs: number;
	isPlaying: boolean;
	selectedLayerId: string | null;
	onSelectLayer: (layerId: string | null) => void;
	onTimeUpdate?: (timeMs: number) => void;
}

const INTERNAL_WIDTH = 1920;
const INTERNAL_HEIGHT = 1080;

export function SceneCanvas({
	scene,
	currentTimeMs,
	isPlaying,
	selectedLayerId,
	onSelectLayer,
	onTimeUpdate,
}: SceneCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number>(0);
	const startTimeRef = useRef<number>(0);
	const startOffsetRef = useRef<number>(0);

	// Render a single frame
	const drawFrame = useCallback(
		(timeMs: number) => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			renderScene(ctx, scene, timeMs, INTERNAL_WIDTH, INTERNAL_HEIGHT);

			// Draw selection outline for selected layer
			if (selectedLayerId) {
				const layer = scene.layers.find((l) => l.id === selectedLayerId);
				if (layer && timeMs >= layer.startMs && timeMs <= layer.endMs) {
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
					const handleSize = 10;
					ctx.fillStyle = "#2563eb";
					ctx.setLineDash([]);
					for (const [hx, hy] of [
						[lx, ly],
						[lx + lw, ly],
						[lx, ly + lh],
						[lx + lw, ly + lh],
					]) {
						ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
					}
					ctx.restore();
				}
			}
		},
		[scene, selectedLayerId],
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
				onTimeUpdate?.(scene.durationMs);
				drawFrame(scene.durationMs);
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
	}, [isPlaying, currentTimeMs, scene, drawFrame, onTimeUpdate]);

	// Redraw when scene changes while paused
	useEffect(() => {
		if (!isPlaying) {
			drawFrame(currentTimeMs);
		}
	}, [scene, currentTimeMs, isPlaying, drawFrame]);

	// Handle click to select layers
	const handleCanvasClick = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
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
				currentTimeMs,
			);
			onSelectLayer(hit?.id ?? null);
		},
		[scene, currentTimeMs, onSelectLayer],
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
				onClick={handleCanvasClick}
				className="max-w-full max-h-full cursor-crosshair"
				style={{ aspectRatio: "16/9" }}
			/>
		</div>
	);
}
