/**
 * ElevenLabs Sound Effects service — text-to-SFX generation with disk cache.
 *
 * Hits `POST /v1/sound-generation` with a natural-language prompt ("short
 * whoosh transition", "glitchy strobe stab", etc.) and returns an MP3 file
 * path. Results cache to disk by sha1(prompt + options) so identical prompts
 * across renders never re-bill.
 *
 * Pricing (April 2026): ~$0.08 per generation at cost; cheaper on bulk plans.
 *
 * Requires `aiApiKey_elevenlabs` in settings. Returns `{ success: false }`
 * with a clear error when the key isn't set — callers (Sound Designer) fall
 * through to silent scenes gracefully.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";

const SFX_CACHE_DIR = "sfx-cache";
const ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation";

export interface ElevenLabsSfxOptions {
	/** Target duration (0.5 – 22 seconds). Omit to let the model decide. */
	durationSec?: number;
	/** Strength of text prompt adherence (0 – 1, default 0.3). Higher = more literal. */
	promptInfluence?: number;
}

export interface ElevenLabsSfxResult {
	success: boolean;
	filePath?: string;
	durationMs?: number;
	cached?: boolean;
	error?: string;
}

function getCacheDir(): string {
	return path.join(app.getPath("userData"), SFX_CACHE_DIR);
}

async function ensureCacheDir(): Promise<string> {
	const dir = getCacheDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

function cacheKey(prompt: string, options: ElevenLabsSfxOptions | undefined): string {
	const payload = JSON.stringify({
		p: prompt.trim().toLowerCase(),
		d: options?.durationSec ?? null,
		i: options?.promptInfluence ?? null,
	});
	return crypto.createHash("sha1").update(payload).digest("hex");
}

export async function generateSfx(
	prompt: string,
	options?: ElevenLabsSfxOptions,
): Promise<ElevenLabsSfxResult> {
	if (!prompt || !prompt.trim()) {
		return { success: false, error: "Empty SFX prompt" };
	}

	const trimmed = prompt.trim();
	const dir = await ensureCacheDir();
	const key = cacheKey(trimmed, options);
	const filePath = path.join(dir, `${key}.mp3`);

	// Cache hit — return immediately, no API call.
	try {
		const stat = await fs.stat(filePath);
		if (stat.size > 0) {
			console.log(`[ElevenLabsSfx] ✓ Cache hit for "${trimmed.slice(0, 48)}" (${stat.size} B)`);
			return { success: true, filePath, cached: true };
		}
	} catch {
		// File doesn't exist — fall through and generate.
	}

	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_elevenlabs;
	if (!apiKey) {
		return {
			success: false,
			error: "ElevenLabs API key not set — add aiApiKey_elevenlabs in settings",
		};
	}

	const body: Record<string, unknown> = { text: trimmed };
	if (typeof options?.durationSec === "number") {
		body.duration_seconds = Math.max(0.5, Math.min(22, options.durationSec));
	}
	if (typeof options?.promptInfluence === "number") {
		body.prompt_influence = Math.max(0, Math.min(1, options.promptInfluence));
	}

	console.log(
		`[ElevenLabsSfx] Generating "${trimmed.slice(0, 48)}" (${options?.durationSec ?? "auto"}s)`,
	);

	try {
		const response = await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "audio/mpeg",
				"xi-api-key": apiKey,
			},
			body: JSON.stringify(body),
			// 30s covers the upper end; most requests finish in 3-8s.
			signal: AbortSignal.timeout(30_000),
		});

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			console.error(
				`[ElevenLabsSfx] HTTP ${response.status}:`,
				errText.slice(0, 300),
			);
			return {
				success: false,
				error: `HTTP ${response.status}: ${errText.slice(0, 120) || "unknown"}`,
			};
		}

		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("audio")) {
			// Error body was returned as JSON instead of audio.
			const errText = await response.text().catch(() => "");
			return {
				success: false,
				error: `Non-audio response: ${errText.slice(0, 120)}`,
			};
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		if (buffer.length === 0) {
			return { success: false, error: "Empty audio response" };
		}

		await fs.writeFile(filePath, buffer);
		console.log(
			`[ElevenLabsSfx] ✓ Generated + cached "${trimmed.slice(0, 48)}" (${buffer.length} B)`,
		);

		return { success: true, filePath, cached: false };
	} catch (err: any) {
		const msg = err?.message || String(err);
		console.error(`[ElevenLabsSfx] Request failed:`, msg);
		return { success: false, error: msg };
	}
}

/**
 * Batch generate SFX in parallel. Returns results in the same order as input.
 * Individual failures don't fail the batch — each result carries its own
 * success flag.
 */
export async function generateSfxBatch(
	items: Array<{ prompt: string; options?: ElevenLabsSfxOptions }>,
): Promise<ElevenLabsSfxResult[]> {
	return Promise.all(items.map((item) => generateSfx(item.prompt, item.options)));
}
