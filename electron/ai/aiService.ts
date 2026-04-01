/**
 * AI Service — supports multiple LLM providers.
 * Ollama (local), OpenAI, Anthropic, Groq, MiniMax.
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
	provider: "openai",
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

// ── Provider endpoints ──

const PROVIDER_ENDPOINTS: Record<string, string> = {
	openai: "https://api.openai.com/v1/chat/completions",
	anthropic: "https://api.anthropic.com/v1/messages",
	groq: "https://api.groq.com/openai/v1/chat/completions",
	minimax: "https://api.minimax.io/v1/text/chatcompletion_v2",
};

const DEFAULT_MODELS: Record<string, string> = {
	ollama: "llama3.2",
	openai: "gpt-4o-mini",
	anthropic: "claude-sonnet-4-6",
	groq: "llama-3.3-70b-versatile",
	minimax: "MiniMax-M1-80k",
};

// ── Provider communication ──

async function ollamaGenerate(prompt: string, model: string, ollamaUrl: string): Promise<string> {
	const response = await fetch(`${ollamaUrl}/api/generate`, {
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

async function openaiCompatibleChat(
	prompt: string,
	apiKey: string,
	model: string,
	endpoint: string,
): Promise<string> {
	const response = await fetch(endpoint, {
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
	const data = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
		base_resp?: { status_code?: number; status_msg?: string };
		error?: { message?: string };
	};

	// Handle MiniMax-style errors (returns 200 with base_resp.status_code)
	if (data.base_resp && data.base_resp.status_code !== 0) {
		throw new Error(`API error: ${data.base_resp.status_msg || "Unknown error"}`);
	}
	// Handle OpenAI-style errors
	if (!response.ok) {
		throw new Error(
			`API responded with ${response.status}: ${data.error?.message || response.statusText}`,
		);
	}

	const text = data.choices?.[0]?.message?.content ?? "";
	if (!text) {
		throw new Error("API returned empty response");
	}
	return text;
}

async function anthropicChat(prompt: string, apiKey: string, model: string): Promise<string> {
	const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model,
			max_tokens: 4096,
			messages: [{ role: "user", content: prompt }],
		}),
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) {
		throw new Error(`Anthropic responded with ${response.status}: ${response.statusText}`);
	}
	const data = (await response.json()) as {
		content?: Array<{ text?: string }>;
	};
	return data.content?.[0]?.text ?? "";
}

async function callProvider(
	provider: AIProvider,
	prompt: string,
	config: AIServiceConfig,
): Promise<string> {
	const model = config.model ?? DEFAULT_MODELS[provider] ?? "gpt-4o-mini";

	if (provider === "ollama") {
		const ollamaUrl = config.ollamaUrl ?? "http://localhost:11434";
		return ollamaGenerate(prompt, model, ollamaUrl);
	}

	if (provider === "anthropic") {
		if (!config.apiKey) throw new Error("Anthropic API key not configured");
		return anthropicChat(prompt, config.apiKey, model);
	}

	// OpenAI, Groq, MiniMax all use OpenAI-compatible chat completions API
	const endpoint = PROVIDER_ENDPOINTS[provider];
	if (!endpoint) throw new Error(`Unknown provider: ${provider}`);
	if (!config.apiKey) throw new Error(`${provider} API key not configured`);
	return openaiCompatibleChat(prompt, config.apiKey, model, endpoint);
}

// ── Availability check ──

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
	const ollamaUrl = config.ollamaUrl ?? "http://localhost:11434";
	const ollamaUp = await isOllamaAvailable(ollamaUrl);

	const providers: AIAvailability["providers"] = [
		{ id: "openai", available: Boolean(config.apiKey && config.provider === "openai") },
		{ id: "anthropic", available: Boolean(config.apiKey && config.provider === "anthropic") },
		{ id: "groq", available: Boolean(config.apiKey && config.provider === "groq") },
		{ id: "minimax", available: Boolean(config.apiKey && config.provider === "minimax") },
		{
			id: "ollama",
			available: ollamaUp,
			reason: ollamaUp ? undefined : "Ollama not detected at localhost:11434",
		},
	];

	// Active provider is whatever is configured + available
	let activeProvider: AIProvider | null = null;
	if (config.provider === "ollama" && ollamaUp) {
		activeProvider = "ollama";
	} else if (config.provider !== "ollama" && config.apiKey) {
		activeProvider = config.provider;
	}

	return { providers, activeProvider };
}

// ── Public API ──

export async function analyze(prompt: string, context?: string): Promise<AIServiceResult> {
	const config = await loadAIConfig();
	const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

	try {
		const text = await callProvider(config.provider, fullPrompt, config);
		return { success: true, text };
	} catch (err) {
		console.warn(`AI provider "${config.provider}" failed:`, err);
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function generateJSON<T>(
	prompt: string,
	context?: string,
): Promise<{ success: boolean; data?: T; error?: string }> {
	const jsonPrompt = `${prompt}\n\nRespond with ONLY valid JSON. No markdown, no explanation.`;
	const result = await analyze(jsonPrompt, context);

	if (!result.success || !result.text) {
		return { success: false, error: result.error ?? "No response from AI" };
	}

	try {
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
