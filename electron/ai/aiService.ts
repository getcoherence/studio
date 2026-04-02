/**
 * AI Service — supports multiple LLM providers.
 * Ollama (local), OpenAI, Anthropic, Groq, MiniMax.
 */

import type {
	AIAvailability,
	AIProvider,
	AIServiceConfig,
	AIServiceResult,
} from "../../src/lib/ai/types";
import { loadSettings, saveSettings } from "../settings";

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
	return {
		provider: settings.aiProvider ?? DEFAULT_CONFIG.provider,
		apiKey: settings.aiApiKey,
		model: settings.aiModel,
		ollamaUrl: settings.aiOllamaUrl ?? DEFAULT_CONFIG.ollamaUrl,
	};
}

/**
 * Save AI config to the unified settings store.
 */
export async function saveAIConfig(config: Partial<AIServiceConfig>): Promise<void> {
	await saveSettings({
		...(config.provider && { aiProvider: config.provider }),
		...(config.apiKey !== undefined && { aiApiKey: config.apiKey }),
		...(config.model !== undefined && { aiModel: config.model }),
		...(config.ollamaUrl !== undefined && { aiOllamaUrl: config.ollamaUrl }),
	});
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
	openai: "gpt-5.4-mini",
	anthropic: "claude-sonnet-4-6",
	groq: "llama-3.3-70b-versatile",
	minimax: "MiniMax-M2.7",
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

	let text = data.choices?.[0]?.message?.content ?? "";
	if (!text) {
		throw new Error("API returned empty response");
	}
	// Strip MiniMax thinking tags (<think>...</think>)
	text = text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
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
	const model = config.model ?? DEFAULT_MODELS[provider] ?? "gpt-5.4-mini";

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
		body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.3 }),
		signal: AbortSignal.timeout(30_000),
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
		max_tokens: 300,
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
		signal: AbortSignal.timeout(30_000),
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
		if (provider === "openai" && config.apiKey) {
			const model = VISION_MODELS.openai;
			const text = await openaiVisionChat(prompt, imageBase64, config.apiKey, model, systemPrompt);
			return { success: true, text };
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
			return { success: true, text };
		}

		// Provider doesn't support vision — fall back to text-only
		const fullPrompt = systemPrompt
			? `${systemPrompt}\n\n${prompt}\n\n(Note: A screenshot was taken but your provider does not support image analysis. Describe what you expect based on context.)`
			: prompt;
		const text = await callProvider(provider, fullPrompt, config);
		return { success: true, text };
	} catch (err) {
		console.warn(`Vision analysis failed for "${provider}":`, err);
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
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
