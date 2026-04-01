/**
 * Spring-based cursor motion smoothing.
 *
 * Takes raw 10 Hz telemetry and produces smooth 60 fps positions using a
 * critically-damped spring model.
 */

import type { CursorTelemetryPoint } from "@/components/video-editor/types";

export interface SmoothedPosition {
	x: number;
	y: number;
}

/**
 * A simple spring-based smoother that interpolates toward a target position.
 */
export class CursorSmoother {
	private x: number;
	private y: number;
	private vx = 0;
	private vy = 0;
	private stiffness: number;
	private damping: number;

	constructor(initialX = 0.5, initialY = 0.5, stiffness = 0.5, damping = 0.5) {
		this.x = initialX;
		this.y = initialY;
		// Map 0-1 user params to useful spring constants
		this.stiffness = stiffness;
		this.damping = damping;
	}

	/**
	 * Advance the spring toward `(targetX, targetY)`.
	 * @param targetX  Target normalised X (0-1)
	 * @param targetY  Target normalised Y (0-1)
	 * @param dt       Time step in seconds
	 * @returns Smoothed position
	 */
	update(targetX: number, targetY: number, dt: number): SmoothedPosition {
		// Spring constant range: stiffness 0 -> very loose, 1 -> very stiff (snappy)
		const k = 10 + this.stiffness * 90; // 10..100
		// Damping ratio range: damping 0 -> bouncy, 1 -> critically damped
		const d = 2 * Math.sqrt(k) * (0.5 + this.damping * 0.5);

		const ax = k * (targetX - this.x) - d * this.vx;
		const ay = k * (targetY - this.y) - d * this.vy;

		this.vx += ax * dt;
		this.vy += ay * dt;
		this.x += this.vx * dt;
		this.y += this.vy * dt;

		return { x: this.x, y: this.y };
	}

	/** Reset to an exact position (no velocity). */
	reset(x: number, y: number): void {
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
	}

	get position(): SmoothedPosition {
		return { x: this.x, y: this.y };
	}
}

/**
 * Linearly interpolate between two telemetry samples at a given timestamp.
 */
function lerpSample(
	a: CursorTelemetryPoint,
	b: CursorTelemetryPoint,
	timeMs: number,
): { cx: number; cy: number } {
	const span = b.timeMs - a.timeMs;
	if (span <= 0) return { cx: b.cx, cy: b.cy };
	const t = Math.max(0, Math.min(1, (timeMs - a.timeMs) / span));
	return {
		cx: a.cx + (b.cx - a.cx) * t,
		cy: a.cy + (b.cy - a.cy) * t,
	};
}

export interface SmoothedCursorFrame {
	timeMs: number;
	x: number;
	y: number;
	/** Passthrough of any click event at or near this frame. */
	clickType?: CursorTelemetryPoint["clickType"];
}

/**
 * Produce a smooth cursor path from raw telemetry samples.
 *
 * @param samples    Raw 10 Hz cursor telemetry
 * @param fps        Output frame rate (e.g. 60)
 * @param smoothing  Smoothing intensity 0-1 (0 = raw, 1 = max smoothing)
 * @returns Array of smoothed frames at the requested fps
 */
export function smoothCursorPath(
	samples: CursorTelemetryPoint[],
	fps: number,
	smoothing: number,
): SmoothedCursorFrame[] {
	if (samples.length === 0) return [];
	if (samples.length === 1) {
		return [
			{
				timeMs: samples[0].timeMs,
				x: samples[0].cx,
				y: samples[0].cy,
				clickType: samples[0].clickType,
			},
		];
	}

	const startMs = samples[0].timeMs;
	const endMs = samples[samples.length - 1].timeMs;
	const frameDurationMs = 1000 / fps;
	const frameCount = Math.max(1, Math.ceil((endMs - startMs) / frameDurationMs));

	// Stiffness goes down as smoothing goes up (looser spring = more smoothing)
	const stiffness = 1 - smoothing * 0.8; // 1.0 .. 0.2
	const damping = 0.6 + smoothing * 0.3; // 0.6 .. 0.9

	const smoother = new CursorSmoother(samples[0].cx, samples[0].cy, stiffness, damping);
	const result: SmoothedCursorFrame[] = [];

	let sampleIdx = 0;

	for (let f = 0; f <= frameCount; f++) {
		const frameTimeMs = startMs + f * frameDurationMs;

		// Advance sample index to bracket this frame time
		while (sampleIdx < samples.length - 1 && samples[sampleIdx + 1].timeMs <= frameTimeMs) {
			sampleIdx++;
		}

		// Find the raw target position via lerp between bracketing samples
		const target =
			sampleIdx >= samples.length - 1
				? { cx: samples[samples.length - 1].cx, cy: samples[samples.length - 1].cy }
				: lerpSample(samples[sampleIdx], samples[sampleIdx + 1], frameTimeMs);

		const dt = frameDurationMs / 1000;
		const pos =
			smoothing > 0 ? smoother.update(target.cx, target.cy, dt) : { x: target.cx, y: target.cy };

		// Find any click event near this frame (within half a frame duration)
		let clickType: CursorTelemetryPoint["clickType"] | undefined;
		for (let s = Math.max(0, sampleIdx - 1); s < Math.min(samples.length, sampleIdx + 2); s++) {
			if (samples[s].clickType && Math.abs(samples[s].timeMs - frameTimeMs) < frameDurationMs / 2) {
				clickType = samples[s].clickType;
				break;
			}
		}

		result.push({ timeMs: frameTimeMs, x: pos.x, y: pos.y, clickType });
	}

	return result;
}
