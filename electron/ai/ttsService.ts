/**
 * TTS Service — text-to-speech stub with OpenAI TTS support.
 * Local (Piper TTS) integration is a placeholder for future work.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadAIConfig } from "./aiService";

const TTS_OUTPUT_DIR = "tts-output";

function getTTSOutputDir(): string {
	return path.join(app.getPath("userData"), TTS_OUTPUT_DIR);
}

async function ensureTTSDir(): Promise<string> {
	const dir = getTTSOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface TTSResult {
	success: boolean;
	audioPath?: string;
	error?: string;
}

/**
 * Synthesize text to speech.
 *
 * Cloud: uses OpenAI TTS API (requires API key).
 * Local: placeholder — returns null (Piper TTS integration later).
 */
export async function synthesize(text: string, voice: TTSVoice = "nova"): Promise<TTSResult> {
	const config = await loadAIConfig();

	// Try cloud TTS (OpenAI)
	if (config.apiKey) {
		try {
			return await synthesizeOpenAI(text, voice, config.apiKey);
		} catch (err) {
			console.warn("OpenAI TTS failed:", err);
		}
	}

	// Local placeholder — Piper TTS not yet integrated
	return {
		success: false,
		error:
			"TTS not available. Configure an OpenAI API key for cloud TTS, or install Piper for local TTS (coming soon).",
	};
}

async function synthesizeOpenAI(text: string, voice: TTSVoice, apiKey: string): Promise<TTSResult> {
	const response = await fetch("https://api.openai.com/v1/audio/speech", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "tts-1",
			input: text,
			voice,
			response_format: "mp3",
		}),
		signal: AbortSignal.timeout(120_000),
	});

	if (!response.ok) {
		throw new Error(`OpenAI TTS responded with ${response.status}: ${response.statusText}`);
	}

	const outputDir = await ensureTTSDir();
	const fileName = `tts-${Date.now()}.mp3`;
	const audioPath = path.join(outputDir, fileName);

	const arrayBuffer = await response.arrayBuffer();
	await fs.writeFile(audioPath, Buffer.from(arrayBuffer));

	return { success: true, audioPath };
}
