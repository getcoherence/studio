/**
 * One-Click Polish — combines multiple heuristics to auto-enhance a recording.
 * Generates a partial EditorState update for user review before applying.
 */

import {
	detectZoomDwellCandidates,
	normalizeCursorTelemetry,
} from "@/components/video-editor/timeline/zoomSuggestionUtils";
import type {
	CursorTelemetryPoint,
	SpeedRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { EditorState } from "@/hooks/useEditorHistory";
import { analyzeRecording } from "./recordingAnalyzer";
import { generateTrimSuggestions } from "./smartTrim";
import type { PolishPreview, TrimSuggestion } from "./types";

/** Default wallpaper to apply if none selected */
const DEFAULT_WALLPAPER = "/wallpapers/wallpaper1.jpg";
/** Default border radius for polish */
const DEFAULT_BORDER_RADIUS = 12;
/** Default padding for polish */
const DEFAULT_PADDING = 8;
/** Speed multiplier for idle-to-active transitions */
const SPEED_RAMP_MULTIPLIER = 1.5;
/** Minimum idle segment length for speed ramp (ms) */
const SPEED_RAMP_MIN_MS = 3_000;
/** Maximum idle segment length for speed ramp (ms) */
const SPEED_RAMP_MAX_MS = 10_000;
/** Smart trim confidence threshold for auto-inclusion */
const TRIM_CONFIDENCE_THRESHOLD = 0.7;

let nextPolishZoomId = 1000;
let nextPolishSpeedId = 1000;

interface PolishInput {
	cursorTelemetry: CursorTelemetryPoint[];
	videoDurationMs: number;
	currentState: EditorState;
}

interface PolishResult {
	edits: Partial<EditorState>;
	preview: PolishPreview;
	trimSuggestions: TrimSuggestion[];
}

/**
 * Generate a full set of polish edits based on cursor telemetry and current state.
 * Returns a partial EditorState that can be reviewed and then applied.
 */
export function generatePolishEdits(input: PolishInput): PolishResult {
	const { cursorTelemetry, videoDurationMs, currentState } = input;

	const edits: Partial<EditorState> = {};
	const preview: PolishPreview = {
		zoomCount: 0,
		trimCount: 0,
		speedRampCount: 0,
		wallpaperChanged: false,
		borderRadiusChanged: false,
		paddingChanged: false,
	};

	// 1. Auto-zoom from existing dwell candidates
	if (currentState.zoomRegions.length === 0 && cursorTelemetry.length > 0) {
		const normalized = normalizeCursorTelemetry(cursorTelemetry, videoDurationMs);
		const candidates = detectZoomDwellCandidates(normalized);

		const newZoomRegions: ZoomRegion[] = candidates
			.slice(0, 8) // Limit to 8 zoom regions
			.map((candidate) => {
				const id = `zoom-polish-${nextPolishZoomId++}`;
				const halfDuration = Math.min(candidate.strength / 2, 1500);
				return {
					id,
					startMs: Math.max(0, Math.round(candidate.centerTimeMs - halfDuration)),
					endMs: Math.min(videoDurationMs, Math.round(candidate.centerTimeMs + halfDuration)),
					depth: 3 as const,
					focus: candidate.focus,
				};
			});

		if (newZoomRegions.length > 0) {
			edits.zoomRegions = newZoomRegions;
			preview.zoomCount = newZoomRegions.length;
		}
	}

	// 2. Recording analysis and smart trim
	const profile = analyzeRecording(cursorTelemetry, videoDurationMs);
	const allTrimSuggestions = generateTrimSuggestions(profile, videoDurationMs);

	// Auto-accept only high-confidence trims
	const highConfidenceTrims = allTrimSuggestions.filter(
		(s) => s.confidence >= TRIM_CONFIDENCE_THRESHOLD,
	);

	if (highConfidenceTrims.length > 0 && currentState.trimRegions.length === 0) {
		edits.trimRegions = highConfidenceTrims.map((s) => ({
			id: s.id,
			startMs: s.startMs,
			endMs: s.endMs,
		}));
		preview.trimCount = highConfidenceTrims.length;
	}

	// 3. Speed ramps for idle segments between 3-10 seconds
	if (currentState.speedRegions.length === 0) {
		const speedRegions: SpeedRegion[] = [];

		for (const idle of profile.idleSegments) {
			const idleDuration = idle.endMs - idle.startMs;
			if (idleDuration >= SPEED_RAMP_MIN_MS && idleDuration <= SPEED_RAMP_MAX_MS) {
				// Don't overlap with trims
				const isTrimmed = highConfidenceTrims.some(
					(t) => t.startMs <= idle.startMs && t.endMs >= idle.endMs,
				);
				if (isTrimmed) continue;

				speedRegions.push({
					id: `speed-polish-${nextPolishSpeedId++}`,
					startMs: idle.startMs,
					endMs: idle.endMs,
					speed: SPEED_RAMP_MULTIPLIER as SpeedRegion["speed"],
				});
			}
		}

		if (speedRegions.length > 0) {
			edits.speedRegions = speedRegions;
			preview.speedRampCount = speedRegions.length;
		}
	}

	// 4. Background wallpaper — set default if the current one is empty/default
	if (!currentState.wallpaper || currentState.wallpaper === "") {
		edits.wallpaper = DEFAULT_WALLPAPER;
		preview.wallpaperChanged = true;
	}

	// 5. Border radius
	if (currentState.borderRadius === 0) {
		edits.borderRadius = DEFAULT_BORDER_RADIUS;
		preview.borderRadiusChanged = true;
	}

	// 6. Padding
	if (currentState.padding === 0) {
		edits.padding = DEFAULT_PADDING;
		preview.paddingChanged = true;
	}

	return { edits, preview, trimSuggestions: allTrimSuggestions };
}
