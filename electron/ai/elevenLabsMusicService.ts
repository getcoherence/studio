/**
 * ElevenLabs Music service — text-to-music via `POST /v1/music`.
 *
 * Alternative to MiniMax Music. Takes a natural-language prompt (genre,
 * BPM, instruments, mood) and an optional duration, returns an MP3 file
 * path. Mirrors the MiniMax service shape so the caller (aiCinematicEngine)
 * can pick a provider at runtime.
 *
 * Requires `aiApiKey_elevenlabs` in settings. `force_instrumental: true`
 * is set by default since this is background music for video — callers
 * can flip it off via options when vocals are wanted.
 *
 * Pricing (April 2026): credit-metered per tier. Generations are stored
 * on ElevenLabs' side so avoid re-generating for the same prompt.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";

const ENDPOINT = "https://api.elevenlabs.io/v1/music";
const OUTPUT_DIR = "music-output";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const MIN_DURATION_MS = 3_000;
const MAX_DURATION_MS = 600_000;
const MAX_PROMPT_CHARS = 4_100;

export interface ElevenLabsMusicOptions {
	/** Target length in seconds. Clamped to [3, 600]. Omit to let the model pick. */
	durationSec?: number;
	/** Default true — guaranteed instrumental. Set false when vocals wanted. */
	forceInstrumental?: boolean;
	/** mp3_44100_128 (default), mp3_44100_192 (Creator tier), pcm_44100 (Pro tier), etc. */
	outputFormat?: string;
	/** Deterministic seed for reproducibility. */
	seed?: number;
}

export interface ElevenLabsMusicResult {
	success: boolean;
	audioPath?: string;
	/** Reported by the `song-id` response header. */
	songId?: string;
	durationSec?: number;
	error?: string;
}

function getOutputDir(): string {
	return path.join(app.getPath("userData"), OUTPUT_DIR);
}

async function ensureOutputDir(): Promise<string> {
	const dir = getOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

export async function generateElevenLabsMusic(
	prompt: string,
	options?: ElevenLabsMusicOptions,
): Promise<ElevenLabsMusicResult> {
	const trimmed = (prompt || "").trim();
	if (!trimmed) return { success: false, error: "Empty music prompt" };
	if (trimmed.length > MAX_PROMPT_CHARS) {
		return {
			success: false,
			error: `Prompt too long (${trimmed.length} chars; limit ${MAX_PROMPT_CHARS})`,
		};
	}

	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_elevenlabs;
	if (!apiKey) {
		return {
			success: false,
			error: "ElevenLabs API key not set — add it in AI Settings to generate music",
		};
	}

	const outputFormat = options?.outputFormat || DEFAULT_OUTPUT_FORMAT;
	const body: Record<string, unknown> = {
		prompt: trimmed,
		force_instrumental: options?.forceInstrumental ?? true,
		model_id: "music_v1",
	};
	if (typeof options?.durationSec === "number" && options.durationSec > 0) {
		const ms = Math.round(options.durationSec * 1000);
		body.music_length_ms = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, ms));
	}
	if (typeof options?.seed === "number") {
		body.seed = options.seed;
	}

	const url = `${ENDPOINT}?output_format=${encodeURIComponent(outputFormat)}`;
	console.log(
		`[ElevenLabsMusic] Generating (${options?.durationSec ?? "auto"}s, format=${outputFormat}) — prompt: "${trimmed.slice(0, 80)}..."`,
	);

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "audio/mpeg",
				"xi-api-key": apiKey,
			},
			body: JSON.stringify(body),
			// Music generation takes 15-60s typically; give it 3 min.
			signal: AbortSignal.timeout(180_000),
		});

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			console.error(
				`[ElevenLabsMusic] HTTP ${response.status}:`,
				errText.slice(0, 300),
			);
			return {
				success: false,
				error: `HTTP ${response.status}: ${errText.slice(0, 160) || "unknown"}`,
			};
		}

		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("audio")) {
			const errText = await response.text().catch(() => "");
			return {
				success: false,
				error: `Non-audio response (${contentType}): ${errText.slice(0, 160)}`,
			};
		}

		const songId = response.headers.get("song-id") || undefined;
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		if (buffer.length === 0) {
			return { success: false, error: "Empty audio response" };
		}

		const dir = await ensureOutputDir();
		const filename = `music-el-${Date.now()}-${songId?.slice(0, 8) || "nosong"}.mp3`;
		const filePath = path.join(dir, filename);
		await fs.writeFile(filePath, buffer);

		console.log(
			`[ElevenLabsMusic] ✓ Saved ${buffer.length} B → ${filePath} (songId=${songId ?? "n/a"})`,
		);

		return {
			success: true,
			audioPath: filePath,
			songId,
			durationSec: options?.durationSec,
		};
	} catch (err: any) {
		const msg = err?.message || String(err);
		console.error("[ElevenLabsMusic] Request failed:", msg);
		return { success: false, error: msg };
	}
}
