/**
 * Music Generation Service — generates instrumental background music.
 *
 * Uses MiniMax Music Generation API (requires MiniMax API key, independent of
 * active chat provider). Falls back to bundled tracks if no key is configured.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";

const MUSIC_OUTPUT_DIR = "music-output";

function getMusicOutputDir(): string {
	return path.join(app.getPath("userData"), MUSIC_OUTPUT_DIR);
}

async function ensureMusicDir(): Promise<string> {
	const dir = getMusicOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

// ── Mood presets ────────────────────────────────────────────────────────

export type MusicMood = "energetic" | "ambient" | "dramatic" | "minimal" | "upbeat" | "custom";

const MOOD_PROMPTS: Record<Exclude<MusicMood, "custom">, string> = {
	energetic:
		"Modern upbeat electronic background music for a tech product video. Energetic, confident, driving beat. Clean synths, subtle bass. Professional corporate energy without being cheesy. 20 seconds.",
	ambient:
		"Calm, atmospheric ambient background music for a software tutorial. Gentle pads, soft piano, minimal percussion. Warm and inviting. Professional and clean. 20 seconds.",
	dramatic:
		"Cinematic dramatic background music for a product launch video. Building tension, epic strings, powerful drums. Inspiring and bold. Modern film score feel. 20 seconds.",
	minimal:
		"Minimal, subtle background music for a clean product demo. Soft clicks, gentle tones, barely-there rhythm. Should enhance without distracting. Lo-fi meets corporate. 20 seconds.",
	upbeat:
		"Happy, upbeat acoustic background music for a friendly product walkthrough. Light guitar, gentle claps, positive vibes. Warm, approachable, not too fast. 20 seconds.",
};

// ── Types ───────────────────────────────────────────────────────────────

export interface MusicResult {
	success: boolean;
	audioPath?: string;
	error?: string;
	/** Duration in seconds */
	durationSec?: number;
}

// ── Main entry point ────────────────────────────────────────────────────

/**
 * Generate instrumental background music.
 * Uses MiniMax music generation API with the MiniMax API key
 * (independent of which chat provider is active).
 */
export async function generateMusic(
	mood: MusicMood,
	customPrompt?: string,
	/** Video duration in seconds — music will match this length */
	videoDurationSec?: number,
): Promise<MusicResult> {
	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_minimax;

	if (!apiKey) {
		console.log("[Music] No MiniMax API key found. Checked aiApiKey_minimax in settings.");
		return {
			success: false,
			error: "MiniMax API key not configured. Add it in AI Settings to generate custom music.",
		};
	}

	console.log(
		`[Music] Generating ${mood} music, key present: ${apiKey.slice(0, 8)}..., duration: ${videoDurationSec ?? "default"}s`,
	);
	const duration = videoDurationSec ? Math.round(videoDurationSec) : 20;
	let prompt =
		mood === "custom" && customPrompt
			? customPrompt
			: MOOD_PROMPTS[mood as keyof typeof MOOD_PROMPTS] || MOOD_PROMPTS.energetic;

	// Replace duration placeholder and add structure guidance
	prompt = prompt.replace(/\d+ seconds\./, `${duration} seconds.`);
	prompt += ` The track should be exactly ${duration} seconds long. Build energy in the first third, sustain in the middle, and resolve cleanly in the final 3-4 seconds with a natural ending — not an abrupt cutoff.`;

	try {
		return await generateMiniMaxMusic(prompt, apiKey);
	} catch (err) {
		console.error("Music generation failed:", err);
		return {
			success: false,
			error: `Music generation failed: ${err instanceof Error ? err.message : err}`,
		};
	}
}

// ── MiniMax API ─────────────────────────────────────────────────────────

async function generateMiniMaxMusic(prompt: string, apiKey: string): Promise<MusicResult> {
	console.log("[Music] Calling MiniMax API...");
	console.log("[Music] Prompt:", prompt.slice(0, 150));
	const response = await fetch("https://api.minimax.io/v1/music_generation", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "music-2.5+",
			prompt,
			is_instrumental: true,
			output_format: "url",
			audio_setting: {
				sample_rate: 44100,
				bitrate: 128000,
				format: "mp3",
			},
		}),
		signal: AbortSignal.timeout(180_000), // Music generation can take a while
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		console.error("[Music] API error:", response.status, body.slice(0, 300));
		throw new Error(`MiniMax Music API ${response.status}: ${body.slice(0, 200)}`);
	}

	const data = (await response.json()) as {
		data?: { audio?: string; status?: number };
		extra_info?: { music_duration?: number };
		base_resp?: { status_code?: number; status_msg?: string };
	};

	console.log("[Music] Response status:", data.base_resp?.status_code, data.base_resp?.status_msg);
	console.log("[Music] Audio URL present:", !!data.data?.audio);
	console.log("[Music] Duration:", data.extra_info?.music_duration);

	if (data.base_resp?.status_code !== 0) {
		throw new Error(`MiniMax error: ${data.base_resp?.status_msg || "Unknown error"}`);
	}

	if (!data.data?.audio) {
		throw new Error("MiniMax returned empty audio data");
	}

	// Download audio from URL and save as mp3
	const audioUrl = data.data.audio;
	console.log("[Music] Downloading from:", audioUrl.slice(0, 80));
	const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
	if (!audioResponse.ok) {
		throw new Error(`Failed to download audio: ${audioResponse.status}`);
	}
	const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
	const outputDir = await ensureMusicDir();
	const fileName = `music-${Date.now()}.mp3`;
	const audioPath = path.join(outputDir, fileName);
	await fs.writeFile(audioPath, audioBuffer);

	return {
		success: true,
		audioPath,
		durationSec: data.extra_info?.music_duration,
	};
}
