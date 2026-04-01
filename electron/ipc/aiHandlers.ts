/**
 * IPC handlers for AI features.
 * Registered by main.ts alongside other IPC handlers.
 */
import { ipcMain } from "electron";
import type { AIServiceConfig } from "../../src/lib/ai/types";
import {
	analyze,
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

	ipcMain.handle(
		"ai-generate-json",
		async (_event, prompt: string, context?: string, schema?: Record<string, unknown>) => {
			return generateJSON(prompt, context, schema);
		},
	);

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

	ipcMain.handle("ai-tts-synthesize", async (_event, text: string, voice?: TTSVoice) => {
		return synthesize(text, voice);
	});
}
