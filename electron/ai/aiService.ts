/**
 * AI Service — supports multiple LLM providers.
 * Ollama (local), OpenAI, Anthropic, Groq, MiniMax.
 */

import dns from "node:dns";
import type {
	AIAvailability,
	AIProvider,
	AIServiceConfig,
	AIServiceResult,
} from "../../src/lib/ai/types";
import { loadSettings, saveSettings } from "../settings";

// Force IPv4 for all DNS lookups — prevents IPv6 socket errors with some API endpoints
dns.setDefaultResultOrder("ipv4first");

const DEFAULT_CONFIG: AIServiceConfig = {
	provider: "openai",
	ollamaUrl: "http://localhost:11434",
};

/**
 * Load AI config from the unified settings store.
 * Maps settings.ts fields → AIServiceConfig.
 */
export async function loadAIConfig(): Promise<AIServiceConfig> {
	const settings = await loadSettings();
	const provider = settings.aiProvider ?? DEFAULT_CONFIG.provider;
	// Read per-provider key, falling back to legacy single key
	const providerKeyField = `aiApiKey_${provider}` as keyof typeof settings;
	const apiKey = (settings[providerKeyField] as string | undefined) ?? settings.aiApiKey;
	// Only use saved model if it belongs to the current provider
	// (prevents sending "gpt-5.4" to Anthropic after switching)
	const savedModel = settings.aiModel;
	const validModel =
		savedModel && isModelValidForProvider(savedModel, provider) ? savedModel : undefined;

	return {
		provider,
		apiKey,
		model: validModel,
		ollamaUrl: settings.aiOllamaUrl ?? DEFAULT_CONFIG.ollamaUrl,
	};
}

/**
 * Save AI config to the unified settings store.
 * Saves the API key to a per-provider field so switching providers doesn't wipe keys.
 */
export async function saveAIConfig(config: Partial<AIServiceConfig>): Promise<void> {
	const current = await loadSettings();
	const provider = config.provider ?? current.aiProvider ?? "openai";
	const updates: Record<string, unknown> = {};

	if (config.provider) updates.aiProvider = config.provider;
	if (config.model !== undefined) updates.aiModel = config.model;
	if (config.ollamaUrl !== undefined) updates.aiOllamaUrl = config.ollamaUrl;

	if (config.apiKey !== undefined) {
		// Save to per-provider key field AND legacy field
		updates[`aiApiKey_${provider}`] = config.apiKey;
		updates.aiApiKey = config.apiKey;
	}

	await saveSettings(updates as Partial<import("../settings").LucidSettings>);
}

// ── Provider endpoints ──

const PROVIDER_ENDPOINTS: Record<string, string> = {
	openai: "https://api.openai.com/v1/chat/completions",
	anthropic: "https://api.anthropic.com/v1/messages",
	groq: "https://api.groq.com/openai/v1/chat/completions",
	minimax: "https://api.minimaxi.chat/v1/text/chatcompletion_v2",
};

const DEFAULT_MODELS: Record<string, string> = {
	ollama: "llama3.2",
	openai: "gpt-5.4-mini",
	anthropic: "claude-sonnet-4-6",
	groq: "llama-3.3-70b-versatile",
	minimax: "MiniMax-M2.7",
};

/** Check if a model name belongs to a given provider */
function isModelValidForProvider(model: string, provider: string): boolean {
	const prefixes: Record<string, string[]> = {
		openai: ["gpt-", "o1", "o3", "o4"],
		anthropic: ["claude-"],
		groq: ["llama", "mixtral", "gemma"],
		minimax: ["MiniMax", "minimax"],
		ollama: ["llama", "mistral", "phi", "gemma", "qwen", "deepseek"],
	};
	const providerPrefixes = prefixes[provider] ?? [];
	return providerPrefixes.some((p) => model.toLowerCase().startsWith(p.toLowerCase()));
}

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
	systemPrompt?: string,
): Promise<string> {
	const messages: Array<{ role: string; content: string }> = [];
	if (systemPrompt) {
		messages.push({ role: "system", content: systemPrompt });
	}
	messages.push({ role: "user", content: prompt });

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages,
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

	let text = data.choices?.[0]?.message?.content ?? "";
	if (!text) {
		throw new Error("API returned empty response");
	}
	// Strip MiniMax thinking tags (<think>...</think>)
	text = text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
	return text;
}

async function anthropicChat(
	prompt: string,
	apiKey: string,
	model: string,
	systemPrompt?: string,
): Promise<string> {
	const body: Record<string, unknown> = {
		model,
		max_tokens: 4096,
		messages: [{ role: "user", content: prompt }],
	};
	if (systemPrompt) {
		body.system = systemPrompt;
	}
	const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Anthropic ${response.status}: ${response.statusText} — ${errorBody.slice(0, 200)}`,
		);
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
	systemPrompt?: string,
): Promise<string> {
	const model = config.model ?? DEFAULT_MODELS[provider] ?? "gpt-5.4-mini";

	if (provider === "ollama") {
		const ollamaUrl = config.ollamaUrl ?? "http://localhost:11434";
		// For Ollama, concatenate system prompt into the prompt
		const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
		return ollamaGenerate(fullPrompt, model, ollamaUrl);
	}

	if (provider === "anthropic") {
		if (!config.apiKey) throw new Error("Anthropic API key not configured");
		return anthropicChat(prompt, config.apiKey, model, systemPrompt);
	}

	// OpenAI, Groq, MiniMax all use OpenAI-compatible chat completions API
	const endpoint = PROVIDER_ENDPOINTS[provider];
	if (!endpoint) throw new Error(`Unknown provider: ${provider}`);
	if (!config.apiKey) throw new Error(`${provider} API key not configured`);
	return openaiCompatibleChat(prompt, config.apiKey, model, endpoint, systemPrompt);
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

// ── Vision support ──

const VISION_MODELS: Record<string, string> = {
	openai: "gpt-5.4-mini",
	anthropic: "claude-sonnet-4-6",
};

/**
 * Check if the current provider supports vision (image input).
 * Only OpenAI and Anthropic support multimodal vision.
 */
export function supportsVision(provider: AIProvider): boolean {
	return provider in VISION_MODELS;
}

async function openaiVisionChat(
	prompt: string,
	imageBase64: string,
	apiKey: string,
	model: string,
	systemPrompt?: string,
): Promise<string> {
	const messages: Array<Record<string, unknown>> = [];
	if (systemPrompt) {
		messages.push({ role: "system", content: systemPrompt });
	}
	messages.push({
		role: "user",
		content: [
			{ type: "text", text: prompt },
			{
				type: "image_url",
				image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "low" },
			},
		],
	});

	const response = await fetch(PROVIDER_ENDPOINTS.openai, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({ model, messages, max_tokens: 4096, temperature: 0.3 }),
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) {
		throw new Error(`OpenAI vision responded with ${response.status}: ${response.statusText}`);
	}
	const data = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	return data.choices?.[0]?.message?.content ?? "";
}

async function anthropicVisionChat(
	prompt: string,
	imageBase64: string,
	apiKey: string,
	model: string,
	systemPrompt?: string,
): Promise<string> {
	const body: Record<string, unknown> = {
		model,
		max_tokens: 4096,
		messages: [
			{
				role: "user",
				content: [
					{
						type: "image",
						source: { type: "base64", media_type: "image/png", data: imageBase64 },
					},
					{ type: "text", text: prompt },
				],
			},
		],
	};
	if (systemPrompt) {
		body.system = systemPrompt;
	}

	const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) {
		throw new Error(`Anthropic vision responded with ${response.status}: ${response.statusText}`);
	}
	const data = (await response.json()) as {
		content?: Array<{ text?: string }>;
	};
	return data.content?.[0]?.text ?? "";
}

/**
 * Analyze an image with a vision-capable model.
 * Falls back to text-only analysis if the provider doesn't support vision.
 */
export async function analyzeImage(
	prompt: string,
	imageBase64: string,
	systemPrompt?: string,
): Promise<AIServiceResult> {
	const config = await loadAIConfig();
	const provider = config.provider;

	try {
		console.log(
			`[AI] analyzeImage: provider=${provider}, hasKey=${!!config.apiKey}, imageLen=${imageBase64.length}`,
		);

		if (provider === "openai" && config.apiKey) {
			const model = VISION_MODELS.openai;
			const text = await openaiVisionChat(prompt, imageBase64, config.apiKey, model, systemPrompt);
			console.log(`[AI] OpenAI vision response length: ${text?.length ?? 0}`);
			return { success: !!text, text: text || undefined };
		}

		if (provider === "anthropic" && config.apiKey) {
			const model = VISION_MODELS.anthropic;
			const text = await anthropicVisionChat(
				prompt,
				imageBase64,
				config.apiKey,
				model,
				systemPrompt,
			);
			console.log(`[AI] Anthropic vision response length: ${text?.length ?? 0}`);
			return { success: !!text, text: text || undefined };
		}

		// Provider doesn't support vision — fall back to text-only
		console.log(`[AI] Provider ${provider} has no vision — using text-only`);
		const text = await callProvider(provider, prompt, config, systemPrompt);
		return { success: !!text, text: text || undefined };
	} catch (err) {
		console.error(
			`[AI] Vision analysis failed for "${provider}" (key present: ${!!config.apiKey}):`,
			err,
		);
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ── Public API ──

export async function analyze(prompt: string, context?: string): Promise<AIServiceResult> {
	const config = await loadAIConfig();

	try {
		// Pass context as a proper system prompt for all providers
		const text = await callProvider(config.provider, prompt, config, context);
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
