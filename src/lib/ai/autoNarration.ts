/**
 * Auto-Narration — generates a voiceover script based on recording analysis.
 * Uses AI service when available, falls back to template-based script.
 */
import type { NarrationSegment, RecordingProfile } from "./types";

let nextNarrationId = 1;

function makeNarrationId(): string {
	return `narration-${nextNarrationId++}`;
}

function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
}

/**
 * Generate a narration script from the recording profile.
 * If captionText is provided, uses it to enrich the script.
 *
 * When AI is available, call the AI service from the UI layer and pass
 * the result as captionText to get an enhanced script.
 *
 * For now, generates a template-based script from cursor activity.
 */
export function generateNarrationScript(
	recordingProfile: RecordingProfile,
	captionText?: string,
): NarrationSegment[] {
	const segments: NarrationSegment[] = [];

	// Build timeline events sorted by time
	const events: Array<{
		timeMs: number;
		endMs: number;
		type: "active" | "click-cluster" | "idle";
		description: string;
	}> = [];

	for (const active of recordingProfile.activeSegments) {
		events.push({
			timeMs: active.startMs,
			endMs: active.endMs,
			type: "active",
			description: `Active region from ${formatTime(active.startMs)} to ${formatTime(active.endMs)}`,
		});
	}

	for (const cluster of recordingProfile.clickClusters) {
		events.push({
			timeMs: cluster.startMs,
			endMs: cluster.endMs,
			type: "click-cluster",
			description: `${cluster.clickCount} interactions near (${Math.round(cluster.cx * 100)}%, ${Math.round(cluster.cy * 100)}%)`,
		});
	}

	events.sort((a, b) => a.timeMs - b.timeMs);

	if (events.length === 0) {
		// No events detected — single narration segment
		segments.push({
			id: makeNarrationId(),
			startMs: 0,
			endMs: 5_000,
			text: captionText || "This recording shows a screen demonstration.",
		});
		return segments;
	}

	// Generate intro
	segments.push({
		id: makeNarrationId(),
		startMs: 0,
		endMs: Math.min(events[0].timeMs, 3_000),
		text: captionText
			? `Let me walk you through what's happening here.`
			: "Here's a walkthrough of the key actions in this recording.",
	});

	// Generate narration for each event
	for (const event of events) {
		let text: string;

		if (event.type === "click-cluster") {
			text = `At ${formatTime(event.timeMs)}, notice the series of interactions — ${event.description.toLowerCase()}.`;
		} else if (event.type === "active") {
			const duration = event.endMs - event.timeMs;
			if (duration > 5_000) {
				text = `Starting at ${formatTime(event.timeMs)}, there's an extended period of activity lasting ${formatTime(duration)}.`;
			} else {
				text = `At ${formatTime(event.timeMs)}, a quick burst of activity occurs.`;
			}
		} else {
			text = `At ${formatTime(event.timeMs)}: ${event.description}.`;
		}

		// Space narration segments with gaps
		const prevEnd = segments.length > 0 ? segments[segments.length - 1].endMs : 0;
		const gapMs = Math.max(0, event.timeMs - prevEnd);
		const segmentStart = gapMs > 500 ? event.timeMs : prevEnd;
		const segmentDuration = Math.max(2_000, Math.min(text.length * 60, 5_000)); // ~60ms per char

		segments.push({
			id: makeNarrationId(),
			startMs: segmentStart,
			endMs: segmentStart + segmentDuration,
			text,
		});
	}

	// If captions are provided, append enhanced context at the end
	if (captionText && captionText.length > 50) {
		const lastEnd = segments[segments.length - 1].endMs;
		segments.push({
			id: makeNarrationId(),
			startMs: lastEnd + 500,
			endMs: lastEnd + 5_000,
			text: "And that covers the key moments of this demonstration.",
		});
	}

	return segments;
}

/**
 * Build a prompt for the AI service to enhance the narration script.
 * The caller should send this to `window.electronAPI.aiAnalyze()`.
 */
export function buildNarrationPrompt(profile: RecordingProfile, captionText?: string): string {
	const parts: string[] = [
		"Generate a natural-sounding voiceover script for a screen recording.",
		`The recording has ${profile.activeSegments.length} active segments and ${profile.clickClusters.length} click clusters.`,
	];

	if (profile.activeSegments.length > 0) {
		parts.push(
			`Active regions: ${profile.activeSegments.map((s) => `${formatTime(s.startMs)}-${formatTime(s.endMs)}`).join(", ")}.`,
		);
	}

	if (profile.clickClusters.length > 0) {
		parts.push(
			`Click clusters: ${profile.clickClusters.map((c) => `${c.clickCount} clicks at ${formatTime(c.startMs)}`).join(", ")}.`,
		);
	}

	if (captionText) {
		parts.push(`Caption/transcript context: ${captionText}`);
	}

	parts.push(
		"Write a professional, concise narration. Keep each sentence short enough to speak in 3-5 seconds.",
		"Return plain text, one paragraph per section.",
	);

	return parts.join("\n");
}
