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
	loadAIConfig,
	saveAIConfig,
} from "../ai/aiService";
import { synthesize, type TTSVoice } from "../ai/ttsService";

export function registerAIHandlers(): void {
	ipcMain.handle("ai-analyze", async (_event, prompt: string, context?: string) => {
		return analyze(prompt, context);
	});

	ipcMain.handle("ai-generate-json", async (_event, prompt: string, context?: string) => {
		return generateJSON(prompt, context);
	});

	ipcMain.handle("ai-check-availability", async () => {
		return checkAvailability();
	});

	ipcMain.handle("ai-get-config", async () => {
		return loadAIConfig();
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
}
