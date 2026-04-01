/**
 * Input monitoring for cursor click detection.
 *
 * Since `uiohook-napi` requires native compilation that may not be available,
 * this module uses a post-processing heuristic to detect clicks from cursor
 * telemetry data. A cursor that stays in roughly the same position for 1-2
 * consecutive samples and then moves likely indicates a click.
 */

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	clickType?: "left" | "right" | "double" | "middle";
	cursorType?: "arrow" | "text" | "pointer" | "crosshair" | "hand" | "resize";
}

/** Euclidean distance in normalised coordinate space. */
function dist(a: CursorTelemetryPoint, b: CursorTelemetryPoint): number {
	return Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
}

/**
 * Threshold for "stationary" in normalised (0-1) coordinate space.
 * ~0.5 % of the screen means the cursor barely moved.
 */
const STILL_THRESHOLD = 0.005;

/**
 * After a dwell the cursor must move at least this far to count as a
 * post-click jump.
 */
const JUMP_THRESHOLD = 0.01;

/**
 * Maximum dwell duration in ms. Anything longer than ~300 ms at 10 Hz
 * (3 samples) is more likely an idle pause than a click.
 */
const MAX_DWELL_MS = 300;

/**
 * Post-processes a raw telemetry array and annotates samples where a
 * click likely occurred. The original array is mutated in place for
 * efficiency and then returned.
 *
 * Detection heuristic:
 *   1. Find a sample `i` that is close to `i-1` (the cursor dwelled).
 *   2. Verify `i+1` exists and the cursor jumped away (post-click motion).
 *   3. The dwell duration must be short enough to look intentional.
 *   4. Mark the *first* dwell sample as a left-click.
 *
 * Double-clicks are detected when two click events happen within 500 ms.
 */
export function detectClicks(samples: CursorTelemetryPoint[]): CursorTelemetryPoint[] {
	if (samples.length < 3) return samples;

	const clickIndices: number[] = [];

	for (let i = 1; i < samples.length - 1; i++) {
		const prev = samples[i - 1];
		const curr = samples[i];
		const next = samples[i + 1];

		const dwellDist = dist(prev, curr);
		const jumpDist = dist(curr, next);
		const dwellMs = curr.timeMs - prev.timeMs;

		if (dwellDist < STILL_THRESHOLD && jumpDist >= JUMP_THRESHOLD && dwellMs <= MAX_DWELL_MS) {
			// Avoid marking consecutive samples in the same dwell run
			if (clickIndices.length === 0 || i - clickIndices[clickIndices.length - 1] > 2) {
				clickIndices.push(i);
			}
		}
	}

	// Annotate clicks and detect double-clicks
	for (let c = 0; c < clickIndices.length; c++) {
		const idx = clickIndices[c];
		const prevIdx = c > 0 ? clickIndices[c - 1] : -1;

		if (prevIdx >= 0 && samples[idx].timeMs - samples[prevIdx].timeMs < 500) {
			// Upgrade the previous click to double and skip this one
			samples[prevIdx].clickType = "double";
		} else {
			samples[idx].clickType = "left";
		}
	}

	return samples;
}

/**
 * Lightweight InputMonitor that wraps start/stop semantics.
 * Currently a no-op during recording (detection is post-hoc), but provides
 * the extensibility hook for future native input listeners.
 */
export class InputMonitor {
	private _running = false;

	/** Begin monitoring (currently a no-op; reserved for native hooks). */
	start(): void {
		this._running = true;
	}

	/** Stop monitoring. */
	stop(): void {
		this._running = false;
	}

	get running(): boolean {
		return this._running;
	}

	/**
	 * Runs click detection on the provided samples (call after recording
	 * stops). This mutates the array in place.
	 */
	processSamples(samples: CursorTelemetryPoint[]): CursorTelemetryPoint[] {
		return detectClicks(samples);
	}
}
