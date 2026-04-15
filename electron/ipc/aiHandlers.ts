/**
 * IPC handlers for AI features.
 * Registered by main.ts alongside other IPC handlers.
 */
import { ipcMain } from "electron";
import type { AIServiceConfig } from "../../src/lib/ai/types";
import {
	analyze,
	analyzeImage,
	checkAvailability,
	generateJSON,
	getAllProviderKeys,
	loadAIConfig,
	saveAIConfig,
} from "../ai/aiService";
import { type ElevenLabsMusicOptions, generateElevenLabsMusic } from "../ai/elevenLabsMusicService";
import {
	type ElevenLabsSfxOptions,
	generateSfx,
	generateSfxBatch,
} from "../ai/elevenLabsSfxService";
import {
	downloadLottieAnimation,
	getPopularLotties,
	searchLottieAnimations,
} from "../ai/lottieSearch";
import { generateImage, type ImageGenOptions } from "../ai/minimaxImageService";
import {
	MINIMAX_VOICES,
	type MinimaxTTSOptions,
	synthesizeMinimax,
	synthesizeMinimaxBatch,
} from "../ai/minimaxTtsService";
import {
	deleteMusicLibraryEntry,
	generateLyrics,
	generateMusic,
	listMusicLibrary,
	type MusicMood,
	type VocalMode,
} from "../ai/musicService";
import { synthesize, type TTSVoice } from "../ai/ttsService";
import { generateVideo, generateVideoBatch } from "../ai/videoService";
import { authenticateCoherence } from "../pro/proAuth";

export function registerAIHandlers(): void {
	ipcMain.handle(
		"ai-analyze",
		async (
			_event,
			prompt: string,
			context?: string,
			modelOverride?: { provider: string; model: string },
		) => {
			return analyze(prompt, context, modelOverride);
		},
	);

	ipcMain.handle("ai-generate-json", async (_event, prompt: string, context?: string) => {
		return generateJSON(prompt, context);
	});

	ipcMain.handle("ai-check-availability", async () => {
		return checkAvailability();
	});

	ipcMain.handle("ai-get-config", async () => {
		return loadAIConfig();
	});

	ipcMain.handle("ai-get-all-keys", async () => {
		return getAllProviderKeys();
	});

	ipcMain.handle("ai-save-config", async (_event, config: Partial<AIServiceConfig>) => {
		await saveAIConfig(config);
		return { success: true };
	});

	// Save an API key for a side-service (not the main chat provider).
	// Today: "elevenlabs" for SFX. In future: whatever side-services we add.
	ipcMain.handle("ai-save-service-key", async (_event, service: "elevenlabs", apiKey: string) => {
		const { saveSettings } = await import("../settings");
		if (service === "elevenlabs") {
			await saveSettings({ aiApiKey_elevenlabs: apiKey });
			return { success: true };
		}
		return { success: false, error: `Unknown service: ${service}` };
	});

	ipcMain.handle("ai-get-service-key", async (_event, service: "elevenlabs") => {
		const { loadSettings } = await import("../settings");
		const settings = await loadSettings();
		if (service === "elevenlabs") {
			return { apiKey: settings.aiApiKey_elevenlabs ?? "" };
		}
		return { apiKey: "" };
	});

	ipcMain.handle(
		"ai-analyze-image",
		async (_event, prompt: string, imageBase64: string, systemPrompt?: string) => {
			const result = await analyzeImage(prompt, imageBase64, systemPrompt);
			console.log(
				`[IPC] ai-analyze-image returning: success=${result.success}, textLen=${result.text?.length ?? 0}`,
			);
			return { success: result.success, text: result.text, error: result.error };
		},
	);

	ipcMain.handle("ai-tts-synthesize", async (_event, text: string, voice?: TTSVoice) => {
		return synthesize(text, voice);
	});

	// ── MiniMax TTS (preferred for narrated scene plans) ──
	ipcMain.handle("ai-minimax-tts", async (_event, text: string, options?: MinimaxTTSOptions) => {
		return synthesizeMinimax(text, options);
	});

	ipcMain.handle(
		"ai-minimax-tts-batch",
		async (
			_event,
			items: Array<{ text: string; sceneIndex: number; options?: MinimaxTTSOptions }>,
		) => {
			return synthesizeMinimaxBatch(items);
		},
	);

	ipcMain.handle("ai-minimax-voices", async () => {
		return { voices: MINIMAX_VOICES };
	});

	// ── MiniMax Image Generation ──
	ipcMain.handle("ai-minimax-image", async (_event, prompt: string, options?: ImageGenOptions) => {
		return generateImage(prompt, options);
	});

	// ── ElevenLabs Sound Effects (text-to-SFX, cached) ──
	ipcMain.handle(
		"ai-elevenlabs-sfx",
		async (_event, prompt: string, options?: ElevenLabsSfxOptions) => {
			return generateSfx(prompt, options);
		},
	);

	ipcMain.handle(
		"ai-elevenlabs-sfx-batch",
		async (_event, items: Array<{ prompt: string; options?: ElevenLabsSfxOptions }>) => {
			return generateSfxBatch(items);
		},
	);

	ipcMain.handle(
		"ai-generate-music",
		async (
			_event,
			mood: MusicMood,
			customPrompt?: string,
			videoDurationSec?: number,
			vocalMode?: VocalMode,
			lyrics?: string,
		) => {
			return generateMusic(mood, customPrompt, videoDurationSec, vocalMode, lyrics);
		},
	);

	// ── ElevenLabs Music (text-to-music, prompt-based) ──
	// Alternative provider to MiniMax. Renderer picks which one via the
	// music provider toggle in the chat panel. Both return { success, audioPath }.
	ipcMain.handle(
		"ai-elevenlabs-music",
		async (_event, prompt: string, options?: ElevenLabsMusicOptions) => {
			return generateElevenLabsMusic(prompt, options);
		},
	);

	ipcMain.handle("ai-generate-lyrics", async (_event, themePrompt: string, title?: string) => {
		return generateLyrics(themePrompt, title);
	});

	ipcMain.handle("music-library-list", async () => {
		return listMusicLibrary();
	});

	ipcMain.handle("music-library-delete", async (_event, filePath: string) => {
		return deleteMusicLibraryEntry(filePath);
	});

	// Lottie search
	ipcMain.handle("lottie-search", async (_event, query: string, page?: number) => {
		return searchLottieAnimations(query, page);
	});

	ipcMain.handle("lottie-popular", async (_event, page?: number) => {
		return getPopularLotties(page);
	});

	ipcMain.handle("lottie-download", async (_event, lottieUrl: string, name: string) => {
		return downloadLottieAnimation(lottieUrl, name);
	});

	// Video generation
	ipcMain.handle(
		"ai-generate-video",
		async (
			_event,
			prompt: string,
			options?: {
				model?: string;
				durationSec?: number;
				resolution?: "720P" | "768P" | "1080P";
			},
		) => {
			return generateVideo(prompt, options);
		},
	);

	// Pro authentication via Coherence OAuth
	ipcMain.handle("pro-authenticate", async () => {
		return authenticateCoherence();
	});

	ipcMain.handle(
		"ai-generate-video-batch",
		async (
			_event,
			clips: Array<{
				prompt: string;
				sceneIndex: number;
				model?: string;
				durationSec?: number;
				resolution?: "720P" | "768P" | "1080P";
			}>,
		) => {
			return generateVideoBatch(clips);
		},
	);
}
