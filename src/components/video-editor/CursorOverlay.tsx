/**
 * CursorOverlay renders a cursor sprite over the video playback area,
 * applying motion smoothing, sway, click ring animations, and the
 * selected cursor style.
 *
 * It reads cursor telemetry and the current playback time to position
 * the cursor. This component is designed to be absolutely positioned
 * on top of the VideoPlayback container.
 */

import { useEffect, useMemo, useRef } from "react";
import { ClickRingPool } from "@/lib/cursor/clickRing";
import { getCursorStyle } from "@/lib/cursor/cursorStyles";
import { CursorSwayInterpolator, computeCursorSway } from "@/lib/cursor/cursorSway";
import { CursorSmoother } from "@/lib/cursor/motionSmoothing";
import type { CursorTelemetryPoint } from "./types";

export interface CursorOverlayProps {
	/** Raw cursor telemetry samples (may include click events). */
	cursorTelemetry: CursorTelemetryPoint[];
	/** Current playback time in seconds. */
	currentTimeS: number;
	/** Whether the video is currently playing. */
	isPlaying: boolean;
	/** Container width in CSS pixels. */
	containerWidth: number;
	/** Container height in CSS pixels. */
	containerHeight: number;
	/** Smoothing intensity (0 = raw, 1 = max). */
	cursorSmoothing?: number;
	/** Sway intensity (0 = off, 1 = full). */
	cursorSway?: number;
	/** Cursor style name (e.g. 'default', 'dot', 'crosshair', 'ring'). */
	cursorStyle?: string;
	/** Whether to show click ring animations. */
	showClickRings?: boolean;
	/** Whether to show the cursor at all. */
	showCursor?: boolean;
}

/**
 * Find the telemetry sample nearest to a given time in ms using binary search.
 */
function findNearestSampleIndex(samples: CursorTelemetryPoint[], timeMs: number): number {
	if (samples.length === 0) return -1;
	let lo = 0;
	let hi = samples.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (samples[mid].timeMs < timeMs) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	// lo is the first sample >= timeMs. Compare with lo-1.
	if (lo > 0 && Math.abs(samples[lo - 1].timeMs - timeMs) < Math.abs(samples[lo].timeMs - timeMs)) {
		return lo - 1;
	}
	return lo;
}

/**
 * Interpolate cursor position between two bracketing samples.
 */
function lerpPosition(
	samples: CursorTelemetryPoint[],
	timeMs: number,
): { cx: number; cy: number } | null {
	if (samples.length === 0) return null;
	if (samples.length === 1) return { cx: samples[0].cx, cy: samples[0].cy };

	const idx = findNearestSampleIndex(samples, timeMs);

	// Before first sample
	if (idx === 0 && timeMs <= samples[0].timeMs) {
		return { cx: samples[0].cx, cy: samples[0].cy };
	}

	// After last sample
	if (idx >= samples.length - 1) {
		return { cx: samples[samples.length - 1].cx, cy: samples[samples.length - 1].cy };
	}

	const a = samples[idx].timeMs <= timeMs ? samples[idx] : samples[idx - 1];
	const b = samples[idx].timeMs <= timeMs ? samples[idx + 1] : samples[idx];
	const span = b.timeMs - a.timeMs;
	if (span <= 0) return { cx: b.cx, cy: b.cy };
	const t = Math.max(0, Math.min(1, (timeMs - a.timeMs) / span));
	return {
		cx: a.cx + (b.cx - a.cx) * t,
		cy: a.cy + (b.cy - a.cy) * t,
	};
}

export function CursorOverlay({
	cursorTelemetry,
	currentTimeS,
	isPlaying,
	containerWidth,
	containerHeight,
	cursorSmoothing = 0.5,
	cursorSway: swayIntensity = 0.3,
	cursorStyle = "default",
	showClickRings = true,
	showCursor = true,
}: CursorOverlayProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const smootherRef = useRef<CursorSmoother | null>(null);
	const swayRef = useRef<CursorSwayInterpolator | null>(null);
	const clickPoolRef = useRef<ClickRingPool | null>(null);
	const prevPosRef = useRef<{ x: number; y: number } | null>(null);
	const lastProcessedClickRef = useRef<number>(-1);
	const rafRef = useRef<number>(0);
	const prevTimeRef = useRef<number>(0);

	const style = useMemo(() => getCursorStyle(cursorStyle), [cursorStyle]);

	// SVG image for arrow-like cursors
	const cursorImageRef = useRef<HTMLImageElement | null>(null);
	useEffect(() => {
		if (style.svg) {
			const img = new Image();
			const blob = new Blob([style.svg], { type: "image/svg+xml" });
			const url = URL.createObjectURL(blob);
			img.onload = () => {
				cursorImageRef.current = img;
			};
			img.src = url;
			return () => URL.revokeObjectURL(url);
		}
		cursorImageRef.current = null;
	}, [style]);

	// Initialise / reset helpers
	useEffect(() => {
		smootherRef.current = new CursorSmoother(
			0.5,
			0.5,
			1 - cursorSmoothing * 0.8,
			0.6 + cursorSmoothing * 0.3,
		);
		swayRef.current = new CursorSwayInterpolator();
		clickPoolRef.current = new ClickRingPool();
		prevPosRef.current = null;
		lastProcessedClickRef.current = -1;
	}, [cursorSmoothing]);

	// Main render loop
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let running = true;

		function draw() {
			if (!running || !ctx || !canvas) return;
			const now = performance.now();
			const dt = Math.min((now - (prevTimeRef.current || now)) / 1000, 0.05);
			prevTimeRef.current = now;

			const w = containerWidth;
			const h = containerHeight;
			canvas.width = w * window.devicePixelRatio;
			canvas.height = h * window.devicePixelRatio;
			ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
			ctx.clearRect(0, 0, w, h);

			if (!showCursor || cursorTelemetry.length === 0) {
				rafRef.current = requestAnimationFrame(draw);
				return;
			}

			const timeMs = currentTimeS * 1000;
			const rawPos = lerpPosition(cursorTelemetry, timeMs);
			if (!rawPos) {
				rafRef.current = requestAnimationFrame(draw);
				return;
			}

			// Smooth
			let posX = rawPos.cx;
			let posY = rawPos.cy;
			if (cursorSmoothing > 0 && smootherRef.current) {
				const smoothed = smootherRef.current.update(rawPos.cx, rawPos.cy, dt || 1 / 60);
				posX = smoothed.x;
				posY = smoothed.y;
			}

			// Compute velocity for sway
			const prev = prevPosRef.current ?? { x: posX, y: posY };
			const dx = posX - prev.x;
			const dy = posY - prev.y;
			prevPosRef.current = { x: posX, y: posY };

			// Sway
			let rotation = 0;
			if (swayIntensity > 0 && swayRef.current) {
				const targetAngle = computeCursorSway(dx, dy, swayIntensity);
				rotation = swayRef.current.update(targetAngle, dt || 1 / 60);
			}

			// Click rings - detect new clicks
			if (showClickRings && clickPoolRef.current) {
				const idx = findNearestSampleIndex(cursorTelemetry, timeMs);
				if (idx >= 0 && idx !== lastProcessedClickRef.current) {
					const sample = cursorTelemetry[idx];
					if (sample.clickType && Math.abs(sample.timeMs - timeMs) < 200) {
						clickPoolRef.current.trigger(sample.cx, sample.cy, sample.clickType, style.size);
						lastProcessedClickRef.current = idx;
					}
				}
				clickPoolRef.current.update(dt);
			}

			// Pixel positions
			const px = posX * w;
			const py = posY * h;

			// Draw click rings
			if (showClickRings && clickPoolRef.current) {
				for (const ring of clickPoolRef.current.getActiveStates()) {
					const rx = ring.x * w;
					const ry = ring.y * h;
					ctx.beginPath();
					ctx.arc(rx, ry, ring.radius, 0, Math.PI * 2);
					ctx.strokeStyle = ring.color;
					ctx.globalAlpha = ring.opacity;
					ctx.lineWidth = 2;
					ctx.stroke();
					ctx.globalAlpha = 1;
				}
			}

			// Draw cursor
			ctx.save();
			ctx.translate(px, py);
			ctx.rotate(rotation);

			if (style.svg && cursorImageRef.current) {
				ctx.drawImage(
					cursorImageRef.current,
					-style.hotspot.x,
					-style.hotspot.y,
					style.size,
					style.size,
				);
			} else if (style.name === "dot") {
				ctx.beginPath();
				ctx.arc(0, 0, style.size / 2, 0, Math.PI * 2);
				ctx.fillStyle = style.color;
				ctx.globalAlpha = 0.85;
				ctx.fill();
				ctx.globalAlpha = 1;
			} else if (style.name === "ring") {
				ctx.beginPath();
				ctx.arc(0, 0, style.size / 2, 0, Math.PI * 2);
				ctx.strokeStyle = style.color;
				ctx.lineWidth = 2;
				ctx.globalAlpha = 0.85;
				ctx.stroke();
				ctx.globalAlpha = 1;
				// Center dot
				ctx.beginPath();
				ctx.arc(0, 0, 2, 0, Math.PI * 2);
				ctx.fillStyle = style.color;
				ctx.fill();
			} else {
				// Fallback: small circle
				ctx.beginPath();
				ctx.arc(0, 0, 4, 0, Math.PI * 2);
				ctx.fillStyle = style.color;
				ctx.fill();
			}

			ctx.restore();

			if (isPlaying) {
				rafRef.current = requestAnimationFrame(draw);
			}
		}

		draw();

		return () => {
			running = false;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [
		cursorTelemetry,
		currentTimeS,
		isPlaying,
		containerWidth,
		containerHeight,
		cursorSmoothing,
		swayIntensity,
		cursorStyle,
		showClickRings,
		showCursor,
		style,
	]);

	// When not playing, do a single draw on time change
	useEffect(() => {
		if (isPlaying) return;
		// Trigger a single frame render
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const w = containerWidth;
		const h = containerHeight;
		canvas.width = w * window.devicePixelRatio;
		canvas.height = h * window.devicePixelRatio;
		ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
		ctx.clearRect(0, 0, w, h);

		if (!showCursor || cursorTelemetry.length === 0) return;

		const timeMs = currentTimeS * 1000;
		const rawPos = lerpPosition(cursorTelemetry, timeMs);
		if (!rawPos) return;

		const px = rawPos.cx * w;
		const py = rawPos.cy * h;

		ctx.save();
		ctx.translate(px, py);

		if (style.svg && cursorImageRef.current) {
			ctx.drawImage(
				cursorImageRef.current,
				-style.hotspot.x,
				-style.hotspot.y,
				style.size,
				style.size,
			);
		} else if (style.name === "dot") {
			ctx.beginPath();
			ctx.arc(0, 0, style.size / 2, 0, Math.PI * 2);
			ctx.fillStyle = style.color;
			ctx.globalAlpha = 0.85;
			ctx.fill();
		} else if (style.name === "ring") {
			ctx.beginPath();
			ctx.arc(0, 0, style.size / 2, 0, Math.PI * 2);
			ctx.strokeStyle = style.color;
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.85;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, 2, 0, Math.PI * 2);
			ctx.fillStyle = style.color;
			ctx.fill();
		} else {
			ctx.beginPath();
			ctx.arc(0, 0, 4, 0, Math.PI * 2);
			ctx.fillStyle = style.color;
			ctx.fill();
		}

		ctx.restore();
	}, [
		currentTimeS,
		isPlaying,
		cursorTelemetry,
		containerWidth,
		containerHeight,
		showCursor,
		style,
	]);

	if (!showCursor) return null;

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "absolute",
				inset: 0,
				width: containerWidth,
				height: containerHeight,
				pointerEvents: "none",
				zIndex: 10,
			}}
		/>
	);
}
