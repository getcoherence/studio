// ── Music Catalog ───────────────────────────────────────────────────────
//
// Bundled royalty-free background music tracks and AI music generation.
// Provides mood-based auto-selection for cinematic videos.

export type MusicMood = "energetic" | "ambient" | "dramatic" | "minimal" | "upbeat";

export interface MusicTrack {
	id: string;
	name: string;
	mood: MusicMood;
	/** File name in public/music/ (bundled) or absolute path (generated) */
	file: string;
	durationSec: number;
	/** true = bundled in app, false = AI-generated */
	bundled: boolean;
}

// ── Bundled tracks ──────────────────────────────────────────────────────
// These are placeholder entries. Replace 'file' with actual royalty-free
// audio files placed in public/music/.

export const BUNDLED_TRACKS: MusicTrack[] = [
	{
		id: "energetic-1",
		name: "Drive Forward",
		mood: "energetic",
		file: "music/drive-forward.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "ambient-1",
		name: "Soft Focus",
		mood: "ambient",
		file: "music/soft-focus.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "dramatic-1",
		name: "Launch Day",
		mood: "dramatic",
		file: "music/launch-day.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "minimal-1",
		name: "Clean Slate",
		mood: "minimal",
		file: "music/clean-slate.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "upbeat-1",
		name: "Good Vibes",
		mood: "upbeat",
		file: "music/good-vibes.mp3",
		durationSec: 30,
		bundled: true,
	},
];

// ── Mood auto-selection based on demo mode ──────────────────────────────

const MODE_TO_MOOD: Record<string, MusicMood> = {
	evangelist: "energetic",
	"product-tour": "upbeat",
	tutorial: "ambient",
	teardown: "dramatic",
};

export function getMoodForMode(demoMode: string): MusicMood {
	return MODE_TO_MOOD[demoMode] || "energetic";
}

export function getTrackForMood(mood: MusicMood): MusicTrack | undefined {
	return BUNDLED_TRACKS.find((t) => t.mood === mood);
}

// ── AI music generation via MiniMax ─────────────────────────────────────

export async function generateCustomMusic(
	mood: MusicMood | "custom",
	customPrompt?: string,
	videoDurationSec?: number,
): Promise<{ success: boolean; audioPath?: string; error?: string }> {
	try {
		const result = await window.electronAPI.aiGenerateMusic(mood, customPrompt, videoDurationSec);
		return result;
	} catch (err) {
		return {
			success: false,
			error: `Music generation failed: ${err}`,
		};
	}
}
