/**
 * Smart Trim — suggest trims based on recording analysis.
 * Heuristic-based, no AI needed.
 */
import type { RecordingProfile, TrimSuggestion } from "./types";

/** Don't suggest trimming more than this fraction of total duration */
const MAX_TRIM_FRACTION = 0.4;
/** Minimum idle duration to suggest trimming (ms) */
const IDLE_TRIM_THRESHOLD_MS = 5_000;
/** Leading/trailing dead time threshold (ms) */
const DEAD_TIME_THRESHOLD_MS = 2_000;

let nextSuggestionId = 1;

function makeSuggestionId(): string {
	return `trim-suggestion-${nextSuggestionId++}`;
}

/**
 * Generate trim suggestions from a RecordingProfile.
 * Returns suggestions sorted by start time, capped at 40% of total duration.
 */
export function generateTrimSuggestions(
	profile: RecordingProfile,
	durationMs: number,
): TrimSuggestion[] {
	if (durationMs <= 0) return [];

	const suggestions: TrimSuggestion[] = [];

	// 1. Leading dead time
	if (profile.idleSegments.length > 0) {
		const firstIdle = profile.idleSegments[0];
		if (firstIdle.startMs < 500 && firstIdle.endMs - firstIdle.startMs > DEAD_TIME_THRESHOLD_MS) {
			suggestions.push({
				id: makeSuggestionId(),
				startMs: 0,
				endMs: firstIdle.endMs,
				reason: "dead-air",
				confidence: 0.9,
				description: "Leading dead time before any activity",
			});
		}
	}

	// 2. Trailing dead time
	if (profile.idleSegments.length > 0) {
		const lastIdle = profile.idleSegments[profile.idleSegments.length - 1];
		if (
			durationMs - lastIdle.endMs < 500 &&
			lastIdle.endMs - lastIdle.startMs > DEAD_TIME_THRESHOLD_MS
		) {
			// Avoid duplicating if leading and trailing are the same segment
			const alreadySuggested = suggestions.some(
				(s) => s.startMs === lastIdle.startMs && s.endMs === lastIdle.endMs,
			);
			if (!alreadySuggested) {
				suggestions.push({
					id: makeSuggestionId(),
					startMs: lastIdle.startMs,
					endMs: durationMs,
					reason: "dead-air",
					confidence: 0.85,
					description: "Trailing dead time after last activity",
				});
			}
		}
	}

	// 3. Idle segments > threshold
	for (const idle of profile.idleSegments) {
		const idleDuration = idle.endMs - idle.startMs;
		if (idleDuration < IDLE_TRIM_THRESHOLD_MS) continue;

		// Don't duplicate leading/trailing already handled above
		const alreadySuggested = suggestions.some(
			(s) =>
				(s.startMs <= idle.startMs && s.endMs >= idle.endMs) ||
				(idle.startMs <= s.startMs && idle.endMs >= s.endMs),
		);
		if (alreadySuggested) continue;

		// Confidence: longer idle = higher confidence, max 0.95
		const confidence = Math.min(0.95, 0.5 + (idleDuration / 30_000) * 0.45);

		suggestions.push({
			id: makeSuggestionId(),
			startMs: idle.startMs,
			endMs: idle.endMs,
			reason: "idle-cursor",
			confidence,
			description: `${(idleDuration / 1000).toFixed(1)}s of cursor inactivity`,
		});
	}

	// 4. Low-activity gaps from silent segments
	for (const silent of profile.silentSegments) {
		const silentDuration = silent.endMs - silent.startMs;
		if (silentDuration < IDLE_TRIM_THRESHOLD_MS) continue;

		const alreadyCovered = suggestions.some(
			(s) => s.startMs <= silent.startMs && s.endMs >= silent.endMs,
		);
		if (alreadyCovered) continue;

		const confidence = Math.min(0.8, 0.4 + (silentDuration / 30_000) * 0.4);

		suggestions.push({
			id: makeSuggestionId(),
			startMs: silent.startMs,
			endMs: silent.endMs,
			reason: "low-activity",
			confidence,
			description: `${(silentDuration / 1000).toFixed(1)}s low-activity gap`,
		});
	}

	// Sort by start time
	suggestions.sort((a, b) => a.startMs - b.startMs);

	// Cap total trim at MAX_TRIM_FRACTION of duration
	const maxTrimMs = durationMs * MAX_TRIM_FRACTION;
	const capped: TrimSuggestion[] = [];
	let totalTrimMs = 0;

	// Prioritize by confidence (highest first), then re-sort by time
	const byConfidence = [...suggestions].sort((a, b) => b.confidence - a.confidence);

	for (const suggestion of byConfidence) {
		const sugDuration = suggestion.endMs - suggestion.startMs;
		if (totalTrimMs + sugDuration <= maxTrimMs) {
			capped.push(suggestion);
			totalTrimMs += sugDuration;
		}
	}

	return capped.sort((a, b) => a.startMs - b.startMs);
}
