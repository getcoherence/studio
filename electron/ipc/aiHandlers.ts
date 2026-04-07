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
import {
	downloadLottieAnimation,
	getPopularLotties,
	searchLottieAnimations,
} from "../ai/lottieSearch";
import {
	deleteMusicLibraryEntry,
	generateLyrics,
	generateMusic,
	listMusicLibrary,
	type MusicMood,
	type VocalMode,
} from "../ai/musicService";
import { synthesize, type TTSVoice } from "../ai/ttsService";

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
}
