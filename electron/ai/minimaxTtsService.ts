/**
 * MiniMax TTS Service — high-quality multi-voice text-to-speech.
 *
 * Uses the MiniMax Speech-2.8-HD model via the `t2a_v2` sync HTTP API.
 * Each request takes 1-2 sentences of text and returns an MP3 file on disk.
 * Parallel calls are safe — callers that need multi-scene narration should
 * `Promise.all()` them.
 *
 * Requires `aiApiKey_minimax` in settings (same key used by music generation).
 * Falls through to OpenAI TTS if no MiniMax key is configured.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";
import { type TTSVoice as OpenAIVoice, synthesize as openaiSynthesize } from "./ttsService";

const TTS_OUTPUT_DIR = "tts-output";

function getTTSOutputDir(): string {
	return path.join(app.getPath("userData"), TTS_OUTPUT_DIR);
}

async function ensureTTSDir(): Promise<string> {
	const dir = getTTSOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

// ── Voice catalog ──────────────────────────────────────────────────────
//
// MiniMax has 332 voice IDs across 40+ languages. We curate a small set
// that covers the common video narration personas. The `aesthetic`
// mapping below auto-picks a matching voice based on the active aesthetic
// so users don't need to think about it.

export interface MinimaxVoice {
	id: string;
	name: string;
	description: string;
	gender: "male" | "female" | "neutral";
	tone: "warm" | "authoritative" | "energetic" | "calm" | "dramatic" | "playful";
}

// Voice IDs verified against the canonical list returned by MiniMax's
// `/v1/get_voice` endpoint (April 2026). All 8 voices below are present
// in the API's system_voice array and confirmed working with speech-2.8-hd.
export const MINIMAX_VOICES: MinimaxVoice[] = [
	{
		id: "English_expressive_narrator",
		name: "Expressive Narrator",
		description: "British male, expressive — audiobook narration, documentary",
		gender: "male",
		tone: "authoritative",
	},
	{
		id: "English_Trustworth_Man",
		name: "Trustworthy Man",
		description: "American male, sincere and resonant — founder pitch, warm explainer",
		gender: "male",
		tone: "warm",
	},
	{
		id: "English_CalmWoman",
		name: "Calm Woman",
		description: "American female, soothing — wellness, meditation, audiobooks",
		gender: "female",
		tone: "calm",
	},
	{
		id: "English_Upbeat_Woman",
		name: "Upbeat Woman",
		description: "American female, energetic — SaaS hype, positive messaging",
		gender: "female",
		tone: "energetic",
	},
	{
		id: "English_WiseScholar",
		name: "Wise Scholar",
		description: "British male, conversational scholar — TED talk, biographical",
		gender: "male",
		tone: "authoritative",
	},
	{
		id: "English_PassionateWarrior",
		name: "Passionate Warrior",
		description: "American male, energetic and intense — launch hype, rallying cry",
		gender: "male",
		tone: "dramatic",
	},
	{
		id: "English_CaptivatingStoryteller",
		name: "Captivating Storyteller",
		description: "American senior male, cold detached storyteller — noir, mystery, reveal",
		gender: "male",
		tone: "dramatic",
	},
	{
		id: "English_Graceful_Lady",
		name: "Graceful Lady",
		description: "British female, refined and sophisticated — editorial, premium",
		gender: "female",
		tone: "calm",
	},
];

/** Map aesthetic ID → recommended voice ID. Only uses voice IDs verified
 *  against MiniMax's `/v1/get_voice` API response (system_voice array).
 *  If a voice fails at runtime, the synth function falls back to OpenAI
 *  TTS automatically. */
export const AESTHETIC_VOICE_MAP: Record<string, string> = {
	"vox-documentary": "English_expressive_narrator",
	"premium-saas-dark": "English_Trustworth_Man",
	"cinematic-noir": "English_CaptivatingStoryteller",
	"editorial-magazine": "English_expressive_narrator",
	"newspaper-print": "English_WiseScholar",
	"hand-drawn-explainer": "English_Upbeat_Woman",
	"whiteboard-explainer": "English_Trustworth_Man",
	"notebook-sketch": "English_Trustworth_Man",
	"pop-art": "English_Upbeat_Woman",
	"80s-synthwave": "English_PassionateWarrior",
	"neon-cyberpunk": "English_PassionateWarrior",
	anime: "English_Upbeat_Woman",
	"y2k-techno": "English_Upbeat_Woman",
	"minimalist-swiss": "English_Graceful_Lady",
	vaporwave: "English_CalmWoman",
	"retro-crt-terminal": "English_CaptivatingStoryteller",
	"crayola-kids": "English_Upbeat_Woman",
};

// ── Types ──────────────────────────────────────────────────────────────

export interface MinimaxTTSResult {
	success: boolean;
	audioPath?: string;
	durationMs?: number;
	error?: string;
}

export interface MinimaxTTSOptions {
	/** Voice ID from MINIMAX_VOICES (or any valid MiniMax system voice). */
	voiceId?: string;
	/** Speed multiplier. 1.0 = normal. Range 0.5-2.0. */
	speed?: number;
	/** Volume. Range 0-10. Default 1 (natural). */
	volume?: number;
	/** Pitch shift in semitones. Range -12 to 12. Default 0. */
	pitch?: number;
	/** Model — high-quality vs fast. */
	model?: "speech-2.8-hd" | "speech-2.8-turbo" | "speech-02-hd" | "speech-02-turbo";
}

// ── Core synthesis ──────────────────────────────────────────────────────

/**
 * Synthesize text to speech via MiniMax.
 *
 * On success: returns an absolute path to an MP3 file in the user's
 * TTS output directory. The caller is responsible for cleanup via the
 * studio:// protocol that serves files for Remotion playback.
 */
export async function synthesizeMinimax(
	text: string,
	options?: MinimaxTTSOptions,
): Promise<MinimaxTTSResult> {
	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_minimax;
	console.log(
		`[MinimaxTTS] Called with text="${text.slice(0, 40)}..." key=${apiKey ? "✓" : "✗"} voice=${options?.voiceId ?? "(default)"}`,
	);
	if (!apiKey) {
		// Fall through to OpenAI TTS if no MiniMax key — we still want SOMETHING
		// rather than failing. The OpenAI voice param is a small fixed set and
		// won't honor MiniMax voice IDs, so we map the tone instead.
		console.log(
			"[MinimaxTTS] ✗ No MiniMax key in settings.aiApiKey_minimax — falling back to OpenAI TTS",
		);
		const fallbackVoice = mapToOpenAIVoice(options?.voiceId);
		const fallback = await openaiSynthesize(text, fallbackVoice);
		if (!fallback.success) {
			console.error("[MinimaxTTS] ✗ OpenAI TTS fallback also failed:", fallback.error);
		}
		return fallback;
	}

	const voiceId = options?.voiceId || "English_expressive_narrator";
	const model = options?.model || "speech-2.8-hd";

	console.log(
		`[MinimaxTTS] Synthesizing "${text.slice(0, 60)}..." voice=${voiceId} model=${model}`,
	);

	// Helper: fall back to OpenAI TTS on any MiniMax failure. The narration
	// HAS to work — silent video isn't acceptable just because MiniMax has
	// voice ID drift or transient errors.
	const fallbackToOpenAI = async (reason: string): Promise<MinimaxTTSResult> => {
		console.warn(`[MinimaxTTS] Fallback to OpenAI TTS — ${reason}`);
		const fallbackVoice = mapToOpenAIVoice(options?.voiceId);
		const result = await openaiSynthesize(text, fallbackVoice);
		return result;
	};

	const body = {
		model,
		text,
		stream: false,
		language_boost: "auto",
		voice_setting: {
			voice_id: voiceId,
			speed: options?.speed ?? 1.0,
			vol: options?.volume ?? 1.0,
			pitch: options?.pitch ?? 0,
		},
		audio_setting: {
			sample_rate: 32000,
			bitrate: 128000,
			format: "mp3",
			channel: 1,
		},
	};

	try {
		const response = await fetch("https://api.minimax.io/v1/t2a_v2", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
			// 60s is plenty for 1-3 sentence narration. Longer text should use
			// the async endpoint (not wired yet — we keep scenes short anyway).
			signal: AbortSignal.timeout(60_000),
		});

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			console.error(`[MinimaxTTS] HTTP ${response.status}:`, errText.slice(0, 300));
			return fallbackToOpenAI(`HTTP ${response.status}: ${errText.slice(0, 80)}`);
		}

		const data = (await response.json()) as {
			data?: { audio?: string; status?: number };
			extra_info?: { audio_length?: number; audio_size?: number };
			base_resp?: { status_code?: number; status_msg?: string };
		};

		if (data.base_resp?.status_code !== 0) {
			return fallbackToOpenAI(`MiniMax error: ${data.base_resp?.status_msg || "unknown error"}`);
		}

		const hexAudio = data.data?.audio;
		if (!hexAudio || typeof hexAudio !== "string") {
			return fallbackToOpenAI("MiniMax returned no audio data");
		}

		// MiniMax returns the mp3 as a hex-encoded string. Decode to bytes.
		const audioBuffer = Buffer.from(hexAudio, "hex");
		if (audioBuffer.length === 0) {
			return fallbackToOpenAI("MiniMax returned empty audio buffer");
		}

		const outputDir = await ensureTTSDir();
		const fileName = `minimax-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
		const audioPath = path.join(outputDir, fileName);
		await fs.writeFile(audioPath, audioBuffer);

		console.log(
			`[MinimaxTTS] ✓ Saved ${audioBuffer.length} bytes to ${fileName} (${data.extra_info?.audio_length ?? "?"} ms)`,
		);

		return {
			success: true,
			audioPath,
			durationMs: data.extra_info?.audio_length,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[MinimaxTTS] Failed:", msg);
		return fallbackToOpenAI(`network error: ${msg}`);
	}
}

/**
 * Batch synthesis helper — runs multiple TTS calls in parallel and returns
 * results keyed by the original indices. Used by the Narrator step to
 * generate one audio file per scene concurrently.
 */
export async function synthesizeMinimaxBatch(
	items: Array<{ text: string; sceneIndex: number; options?: MinimaxTTSOptions }>,
): Promise<Array<{ sceneIndex: number; result: MinimaxTTSResult }>> {
	const results = await Promise.all(
		items.map(async ({ text, sceneIndex, options }) => ({
			sceneIndex,
			result: await synthesizeMinimax(text, options),
		})),
	);
	return results;
}

// ── Fallback mapping ───────────────────────────────────────────────────

function mapToOpenAIVoice(minimaxVoiceId?: string): OpenAIVoice {
	if (!minimaxVoiceId) return "nova";
	// Rough tone-based mapping to the 6 OpenAI voices
	const voice = MINIMAX_VOICES.find((v) => v.id === minimaxVoiceId);
	if (!voice) return "nova";
	switch (voice.tone) {
		case "authoritative":
			return "onyx";
		case "dramatic":
			return "echo";
		case "warm":
			return "fable";
		case "calm":
			return "shimmer";
		case "playful":
			return "alloy";
		case "energetic":
			return "nova";
		default:
			return "nova";
	}
}
