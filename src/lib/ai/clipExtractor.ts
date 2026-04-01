/**
 * AI Clip Extraction — identifies the most interesting moments in a recording.
 * Ranks by cursor activity density, click clusters, and zoom-worthy areas.
 */
import type { ExtractedClip, RecordingProfile } from "./types";

/** Minimum clip duration (ms) */
const MIN_CLIP_MS = 5_000;
/** Maximum clip duration (ms) */
const MAX_CLIP_MS = 15_000;
/** Preferred clip duration (ms) */
const PREFERRED_CLIP_MS = 10_000;

let nextClipId = 1;

function makeClipId(): string {
	return `clip-${nextClipId++}`;
}

function formatTimestamp(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface ScoredRegion {
	startMs: number;
	endMs: number;
	score: number;
	label: string;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Extract the most interesting clips from a recording.
 *
 * @param profile - The recording analysis profile
 * @param durationMs - Total video duration in milliseconds
 * @param count - Number of clips to extract (default 3)
 */
export function extractClips(
	profile: RecordingProfile,
	durationMs: number,
	count = 3,
): ExtractedClip[] {
	if (durationMs <= MIN_CLIP_MS) return [];

	const regions: ScoredRegion[] = [];

	// Score active segments by duration and density
	for (const active of profile.activeSegments) {
		const duration = active.endMs - active.startMs;
		// Longer active segments score higher, normalized to 0-1
		const durationScore = clamp(duration / 10_000, 0, 1);
		regions.push({
			startMs: active.startMs,
			endMs: active.endMs,
			score: 0.3 + durationScore * 0.4,
			label: "active",
		});
	}

	// Score click clusters — more clicks = more interesting
	for (const cluster of profile.clickClusters) {
		const clickScore = clamp(cluster.clickCount / 10, 0.2, 1);
		// Expand cluster to minimum clip window
		const center = (cluster.startMs + cluster.endMs) / 2;
		const halfWindow = Math.max((cluster.endMs - cluster.startMs) / 2, MIN_CLIP_MS / 2);
		regions.push({
			startMs: Math.max(0, center - halfWindow),
			endMs: Math.min(durationMs, center + halfWindow),
			score: 0.5 + clickScore * 0.5,
			label: "click-cluster",
		});
	}

	if (regions.length === 0) {
		// No interesting regions found — return evenly spaced clips
		return generateEvenClips(durationMs, count);
	}

	// Sort by score descending
	regions.sort((a, b) => b.score - a.score);

	// Select non-overlapping top regions
	const selected: ScoredRegion[] = [];

	for (const region of regions) {
		if (selected.length >= count) break;

		const overlaps = selected.some((s) => region.startMs < s.endMs && region.endMs > s.startMs);
		if (overlaps) continue;

		selected.push(region);
	}

	// Convert to clips with proper duration
	const clips: ExtractedClip[] = selected.map((region, index) => {
		const center = (region.startMs + region.endMs) / 2;
		const regionDuration = region.endMs - region.startMs;
		const clipDuration = clamp(regionDuration, MIN_CLIP_MS, MAX_CLIP_MS);

		const startMs = clamp(
			Math.round(center - clipDuration / 2),
			0,
			Math.max(0, durationMs - MIN_CLIP_MS),
		);
		const endMs = Math.min(startMs + clipDuration, durationMs);

		const title = generateTitle(startMs, durationMs, index, region.label);

		return {
			id: makeClipId(),
			startMs,
			endMs,
			score: Math.round(region.score * 100) / 100,
			title,
		};
	});

	// Sort clips by time
	clips.sort((a, b) => a.startMs - b.startMs);

	return clips;
}

function generateTitle(startMs: number, durationMs: number, index: number, label: string): string {
	const isNearStart = startMs < durationMs * 0.1;
	const isNearEnd = startMs > durationMs * 0.8;

	if (isNearStart && index === 0) return "Intro";
	if (isNearEnd) return "Conclusion";

	const descriptor = label === "click-cluster" ? "Key Interaction" : "Key Action";
	return `${descriptor} at ${formatTimestamp(startMs)}`;
}

function generateEvenClips(durationMs: number, count: number): ExtractedClip[] {
	const clipDuration = Math.min(PREFERRED_CLIP_MS, durationMs / count);
	if (clipDuration < MIN_CLIP_MS) {
		// Video too short for requested count
		return [
			{
				id: makeClipId(),
				startMs: 0,
				endMs: Math.min(durationMs, MAX_CLIP_MS),
				score: 0.3,
				title: "Full Recording",
			},
		];
	}

	const clips: ExtractedClip[] = [];
	const step = durationMs / count;

	for (let i = 0; i < count; i++) {
		const center = step * i + step / 2;
		const startMs = Math.max(0, Math.round(center - clipDuration / 2));
		const endMs = Math.min(durationMs, startMs + clipDuration);

		clips.push({
			id: makeClipId(),
			startMs,
			endMs,
			score: 0.3,
			title: i === 0 ? "Intro" : i === count - 1 ? "Conclusion" : `Segment ${i + 1}`,
		});
	}

	return clips;
}
