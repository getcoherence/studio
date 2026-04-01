/**
 * AI Service — supports multiple LLM providers (Ollama local, OpenAI cloud).
 * Used by the main process only; renderer calls via IPC.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

import type {
	AIAvailability,
	AIProvider,
	AIServiceConfig,
	AIServiceResult,
} from "../../src/lib/ai/types";

const SETTINGS_FILE_NAME = "ai-settings.json";

const DEFAULT_CONFIG: AIServiceConfig = {
	provider: "local",
	ollamaUrl: "http://localhost:11434",
};

function getSettingsPath(): string {
	return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

let cachedConfig: AIServiceConfig | null = null;

export async function loadAIConfig(): Promise<AIServiceConfig> {
	if (cachedConfig) return cachedConfig;
	try {
		const raw = await fs.readFile(getSettingsPath(), "utf-8");
		const parsed = JSON.parse(raw) as Partial<AIServiceConfig>;
		cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
		return cachedConfig;
	} catch {
		cachedConfig = { ...DEFAULT_CONFIG };
		return cachedConfig;
	}
}

export async function saveAIConfig(config: Partial<AIServiceConfig>): Promise<void> {
	const current = await loadAIConfig();
	const merged: AIServiceConfig = { ...current, ...config };
	cachedConfig = merged;
	await fs.writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), "utf-8");
}

// ── Provider communication ──

async function ollamaGenerate(prompt: string, model: string, ollamaUrl: string): Promise<string> {
	const url = `${ollamaUrl}/api/generate`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model, prompt, stream: false }),
		signal: AbortSignal.timeout(60_000),
	});

	if (!response.ok) {
		throw new Error(`Ollama responded with ${response.status}: ${response.statusText}`);
	}

	const data = (await response.json()) as { response?: string };
	return data.response ?? "";
}

async function openaiChatCompletion(
	prompt: string,
	apiKey: string,
	model: string,
): Promise<string> {
	const url = "https://api.openai.com/v1/chat/completions";
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: prompt }],
			temperature: 0.3,
		}),
		signal: AbortSignal.timeout(60_000),
	});

	if (!response.ok) {
		throw new Error(`OpenAI responded with ${response.status}: ${response.statusText}`);
	}

	const data = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	return data.choices?.[0]?.message?.content ?? "";
}

// ── Public API ──

async function isOllamaAvailable(ollamaUrl: string): Promise<boolean> {
	try {
		const response = await fetch(`${ollamaUrl}/api/tags`, {
			signal: AbortSignal.timeout(3_000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

export async function checkAvailability(): Promise<AIAvailability> {
	const config = await loadAIConfig();
	const ollamaUrl = config.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl!;
	const localAvailable = await isOllamaAvailable(ollamaUrl);
	const cloudAvailable = Boolean(config.apiKey && config.apiKey.length > 0);

	let activeProvider: AIProvider | null = null;
	if (config.provider === "local" && localAvailable) {
		activeProvider = "local";
	} else if (config.provider === "cloud" && cloudAvailable) {
		activeProvider = "cloud";
	} else if (localAvailable) {
		activeProvider = "local";
	} else if (cloudAvailable) {
		activeProvider = "cloud";
	}

	return { localAvailable, cloudAvailable, activeProvider };
}

export async function analyze(prompt: string, context?: string): Promise<AIServiceResult> {
	const config = await loadAIConfig();
	const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

	// Try preferred provider first, then fallback
	const providers: AIProvider[] =
		config.provider === "local" ? ["local", "cloud"] : ["cloud", "local"];

	for (const provider of providers) {
		try {
			if (provider === "local") {
				const ollamaUrl = config.ollamaUrl ?? DEFAULT_CONFIG.ollamaUrl!;
				if (!(await isOllamaAvailable(ollamaUrl))) continue;
				const model = config.model ?? "llama3.2";
				const text = await ollamaGenerate(fullPrompt, model, ollamaUrl);
				return { success: true, text };
			}

			if (provider === "cloud") {
				if (!config.apiKey) continue;
				const model = config.model ?? "gpt-4o-mini";
				const text = await openaiChatCompletion(fullPrompt, config.apiKey, model);
				return { success: true, text };
			}
		} catch (err) {
			console.warn(`AI provider "${provider}" failed:`, err);
			continue;
		}
	}

	return {
		success: false,
		error: "No AI provider available. Install Ollama locally or configure an OpenAI API key.",
	};
}

export async function generateJSON<T>(
	prompt: string,
	context?: string,
	_schema?: Record<string, unknown>,
): Promise<{ success: boolean; data?: T; error?: string }> {
	const jsonPrompt = `${prompt}\n\nRespond with ONLY valid JSON. No markdown, no explanation.`;
	const result = await analyze(jsonPrompt, context);

	if (!result.success || !result.text) {
		return { success: false, error: result.error ?? "No response from AI" };
	}

	try {
		// Try to extract JSON from the response (handle markdown code blocks)
		let jsonText = result.text.trim();
		const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			jsonText = jsonMatch[1].trim();
		}
		const data = JSON.parse(jsonText) as T;
		return { success: true, data };
	} catch {
		return { success: false, error: "Failed to parse AI response as JSON" };
	}
}
