/**
 * Recording analysis pipeline — all heuristic-based, no AI needed.
 * Analyzes cursor telemetry to build a RecordingProfile.
 */
import type { CursorTelemetryPoint } from "@/components/video-editor/types";
import type { ClickCluster, RecordingProfile, TimeSegment } from "./types";

/** Cursor must move less than this fraction of screen to count as idle */
const IDLE_MOVE_THRESHOLD = 0.02;
/** Minimum idle duration to register as idle segment (ms) */
const IDLE_MIN_DURATION_MS = 3_000;
/** Window size for computing activity density (ms) */
const ACTIVITY_WINDOW_MS = 1_000;
/** High activity threshold — fraction of window with above-average movement */
const ACTIVE_DENSITY_THRESHOLD = 0.6;
/** Click cluster: max time between clicks (ms) */
const CLICK_CLUSTER_MAX_GAP_MS = 2_000;
/** Click cluster: max spatial distance (normalized) */
const CLICK_CLUSTER_MAX_DISTANCE = 0.05;
/** Minimum movement speed to count as a "click-like" stop-and-go (per 100ms) */
const CLICK_STOP_THRESHOLD = 0.005;

interface InternalSample extends CursorTelemetryPoint {
	speed: number; // movement per ms
}

function computeSpeeds(telemetry: CursorTelemetryPoint[]): InternalSample[] {
	if (telemetry.length === 0) return [];

	const result: InternalSample[] = [{ ...telemetry[0], speed: 0 }];

	for (let i = 1; i < telemetry.length; i++) {
		const prev = telemetry[i - 1];
		const curr = telemetry[i];
		const dt = Math.max(1, curr.timeMs - prev.timeMs);
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);
		result.push({ ...curr, speed: distance / dt });
	}

	return result;
}

function detectIdleSegments(samples: InternalSample[], _durationMs: number): TimeSegment[] {
	if (samples.length < 2) return [];

	const segments: TimeSegment[] = [];
	let runStart = 0;

	for (let i = 1; i < samples.length; i++) {
		const prev = samples[i - 1];
		const curr = samples[i];
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);

		if (distance > IDLE_MOVE_THRESHOLD) {
			const runDuration = samples[i - 1].timeMs - samples[runStart].timeMs;
			if (runDuration >= IDLE_MIN_DURATION_MS) {
				segments.push({
					startMs: samples[runStart].timeMs,
					endMs: samples[i - 1].timeMs,
					reason: "idle-cursor",
				});
			}
			runStart = i;
		}
	}

	// Check final run
	const finalDuration = samples[samples.length - 1].timeMs - samples[runStart].timeMs;
	if (finalDuration >= IDLE_MIN_DURATION_MS) {
		segments.push({
			startMs: samples[runStart].timeMs,
			endMs: samples[samples.length - 1].timeMs,
			reason: "idle-cursor",
		});
	}

	return segments;
}

function detectActiveSegments(samples: InternalSample[], durationMs: number): TimeSegment[] {
	if (samples.length < 2 || durationMs <= 0) return [];

	// Compute average speed
	const avgSpeed = samples.reduce((sum, s) => sum + s.speed, 0) / samples.length;

	const segments: TimeSegment[] = [];
	const windowMs = ACTIVITY_WINDOW_MS;
	const stepMs = windowMs / 2;

	for (let windowStart = 0; windowStart < durationMs; windowStart += stepMs) {
		const windowEnd = windowStart + windowMs;
		const windowSamples = samples.filter((s) => s.timeMs >= windowStart && s.timeMs < windowEnd);

		if (windowSamples.length < 2) continue;

		const activeFraction =
			windowSamples.filter((s) => s.speed > avgSpeed).length / windowSamples.length;

		if (activeFraction >= ACTIVE_DENSITY_THRESHOLD) {
			// Merge with previous segment if overlapping
			const last = segments[segments.length - 1];
			if (last && windowStart <= last.endMs) {
				last.endMs = Math.max(last.endMs, windowEnd);
			} else {
				segments.push({ startMs: windowStart, endMs: Math.min(windowEnd, durationMs) });
			}
		}
	}

	return segments;
}

function detectClickClusters(samples: InternalSample[]): ClickCluster[] {
	if (samples.length < 3) return [];

	// Detect "stop points" — brief pauses in cursor movement
	const stops: Array<{ timeMs: number; cx: number; cy: number }> = [];

	for (let i = 1; i < samples.length - 1; i++) {
		const prev = samples[i - 1];
		const curr = samples[i];
		const next = samples[i + 1];

		// A stop: speed drops below threshold then rises again
		if (
			curr.speed < CLICK_STOP_THRESHOLD &&
			(prev.speed >= CLICK_STOP_THRESHOLD || next.speed >= CLICK_STOP_THRESHOLD)
		) {
			stops.push({ timeMs: curr.timeMs, cx: curr.cx, cy: curr.cy });
		}
	}

	if (stops.length < 2) return [];

	// Cluster nearby stops
	const clusters: ClickCluster[] = [];
	let clusterStart = 0;

	for (let i = 1; i <= stops.length; i++) {
		const shouldClose =
			i === stops.length ||
			stops[i].timeMs - stops[i - 1].timeMs > CLICK_CLUSTER_MAX_GAP_MS ||
			Math.hypot(stops[i]?.cx - stops[clusterStart].cx, stops[i]?.cy - stops[clusterStart].cy) >
				CLICK_CLUSTER_MAX_DISTANCE;

		if (shouldClose) {
			const clusterStops = stops.slice(clusterStart, i);
			if (clusterStops.length >= 2) {
				const avgCx = clusterStops.reduce((s, p) => s + p.cx, 0) / clusterStops.length;
				const avgCy = clusterStops.reduce((s, p) => s + p.cy, 0) / clusterStops.length;
				clusters.push({
					startMs: clusterStops[0].timeMs,
					endMs: clusterStops[clusterStops.length - 1].timeMs,
					cx: avgCx,
					cy: avgCy,
					clickCount: clusterStops.length,
				});
			}
			clusterStart = i;
		}
	}

	return clusters;
}

/**
 * Analyze a recording based on cursor telemetry data.
 * Entirely heuristic-based — works offline without any AI provider.
 */
export function analyzeRecording(
	cursorTelemetry: CursorTelemetryPoint[],
	videoDurationMs: number,
): RecordingProfile {
	const sorted = [...cursorTelemetry].sort((a, b) => a.timeMs - b.timeMs);
	const samples = computeSpeeds(sorted);

	const idleSegments = detectIdleSegments(samples, videoDurationMs);
	const activeSegments = detectActiveSegments(samples, videoDurationMs);
	const clickClusters = detectClickClusters(samples);

	// Silent segments = gaps between active segments (simplified — no audio analysis yet)
	const silentSegments: TimeSegment[] = [];
	const sortedActive = [...activeSegments].sort((a, b) => a.startMs - b.startMs);

	let cursor = 0;
	for (const segment of sortedActive) {
		if (segment.startMs - cursor > IDLE_MIN_DURATION_MS) {
			silentSegments.push({
				startMs: cursor,
				endMs: segment.startMs,
				reason: "dead-air",
			});
		}
		cursor = Math.max(cursor, segment.endMs);
	}

	if (videoDurationMs - cursor > IDLE_MIN_DURATION_MS) {
		silentSegments.push({
			startMs: cursor,
			endMs: videoDurationMs,
			reason: "dead-air",
		});
	}

	return { silentSegments, idleSegments, activeSegments, clickClusters };
}
