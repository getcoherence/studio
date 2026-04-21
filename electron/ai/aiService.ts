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
import { recordUsage } from "./tokenUsage";

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
	// Read per-provider model, falling back to legacy single model
	const providerModelField = `aiModel_${provider}` as keyof typeof settings;
	const savedModel = (settings[providerModelField] as string | undefined) ?? settings.aiModel;
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
	if (config.ollamaUrl !== undefined) updates.aiOllamaUrl = config.ollamaUrl;

	if (config.model !== undefined) {
		// Save to per-provider model field AND legacy field
		updates[`aiModel_${provider}`] = config.model;
		updates.aiModel = config.model;
	}

	if (config.apiKey !== undefined) {
		// Save to per-provider key field AND legacy field
		updates[`aiApiKey_${provider}`] = config.apiKey;
		updates.aiApiKey = config.apiKey;
	}

	await saveSettings(updates as Partial<import("../settings").StudioSettings>);
}

/** Return all per-provider API keys and models (for settings dialog) */
export async function getAllProviderKeys(): Promise<{
	keys: Record<string, string>;
	models: Record<string, string>;
}> {
	const settings = await loadSettings();
	const keys: Record<string, string> = {};
	const models: Record<string, string> = {};
	for (const provider of ["openai", "anthropic", "groq", "minimax", "kimi", "ollama"]) {
		const keyField = `aiApiKey_${provider}` as keyof typeof settings;
		const keyVal = settings[keyField] as string | undefined;
		if (keyVal) keys[provider] = keyVal;
		const modelField = `aiModel_${provider}` as keyof typeof settings;
		const modelVal = settings[modelField] as string | undefined;
		if (modelVal) models[provider] = modelVal;
	}
	return { keys, models };
}

// ── Provider endpoints ──

const PROVIDER_ENDPOINTS: Record<string, string> = {
	openai: "https://api.openai.com/v1/chat/completions",
	anthropic: "https://api.anthropic.com/v1/messages",
	groq: "https://api.groq.com/openai/v1/chat/completions",
	minimax: "https://api.minimaxi.chat/v1/text/chatcompletion_v2",
	// Moonshot's Kimi API is fully OpenAI-compatible — same /chat/completions
	// shape, Bearer token auth, supports kimi-k2.6 + the moonshot-v1 family.
	kimi: "https://api.moonshot.ai/v1/chat/completions",
};

/**
 * Parse the hostname from an endpoint URL. Returns "" if the URL is
 * malformed. Used for exact-match host comparisons instead of
 * `endpoint.includes("api.openai.com")`, which CodeQL flags because a
 * crafted URL like `evil.com/api.openai.com/x` would pass a substring
 * check. Hostname matching closes that whole class of issues.
 */
function endpointHost(endpoint: string): string {
	try {
		return new URL(endpoint).hostname.toLowerCase();
	} catch {
		return "";
	}
}

/**
 * Per-provider maximum output token limits.
 *
 * The Composer agent in studio-pro produces long customCode responses
 * (10-15k chars typical, sometimes more). With a 16k token cap most
 * scenes were getting truncated mid-expression and stripped by the
 * Reviewer Agent. These limits should match what each provider/model
 * actually supports — too high and the API rejects, too low and we lose
 * scenes to truncation.
 *
 * Last verified 2026-04-10.
 */
function getMaxOutputTokens(endpoint: string, model: string): number {
	const m = (model || "").toLowerCase();
	const host = endpointHost(endpoint);

	// Anthropic Claude 4.x supports 32k output tokens natively (Opus,
	// Sonnet, Haiku — all 32k). 64k is available with the extended-output
	// beta header but we don't enable that.
	if (host === "api.anthropic.com") {
		return 32_768;
	}

	// MiniMax M2.7 supports very long outputs — generous limit.
	if (host === "api.minimaxi.chat") {
		return 65_536;
	}

	// Kimi K2.6 defaults max_tokens to 32k. Moonshot-v1 8k variant caps
	// at ~8k output. Use the model name to pick the right ceiling so we
	// don't ask moonshot-v1-8k for 32k and get a 400.
	if (host === "api.moonshot.ai") {
		if (m.includes("8k")) return 8_192;
		if (m.includes("32k")) return 32_768;
		// k2.6, k2.5, k2-thinking, moonshot-v1-128k all support 32k+ output
		return 32_768;
	}

	// OpenAI: GPT-5 and GPT-4.1 support 32k output. Mini variants typically
	// support 16k. The API will return an error (not clamp) if we exceed,
	// so we set per-model where it matters.
	if (host === "api.openai.com") {
		if (m.includes("mini") || m.includes("nano")) return 16_384;
		return 32_768;
	}

	// Groq fast-inference models support 8-32k depending on the model.
	if (host === "api.groq.com") {
		return 32_768;
	}

	// Safe default
	return 32_768;
}

const DEFAULT_MODELS: Record<string, string> = {
	ollama: "llama3.2",
	openai: "gpt-5.4-mini",
	anthropic: "claude-sonnet-4-6",
	groq: "llama-3.3-70b-versatile",
	minimax: "MiniMax-M2.7",
	kimi: "kimi-k2.6",
};

/** Check if a model name belongs to a given provider */
function isModelValidForProvider(model: string, provider: string): boolean {
	const prefixes: Record<string, string[]> = {
		openai: ["gpt-", "o1", "o3", "o4"],
		anthropic: ["claude-"],
		groq: ["llama", "mixtral", "gemma"],
		minimax: ["MiniMax", "minimax"],
		// Kimi covers two families: kimi-* (K2 series) and moonshot-v1-*
		// (legacy generation, kept for users who want shorter context).
		kimi: ["kimi-", "moonshot-"],
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
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) {
		throw new Error(`Ollama responded with ${response.status}: ${response.statusText}`);
	}
	const data = (await response.json()) as { response?: string };
	return data.response ?? "";
}

/**
 * Detect OpenAI reasoning models that require the Responses API
 * (instead of Chat Completions). These include o1-pro, o3-pro,
 * gpt-5-pro, gpt-5.4-pro, etc.
 */
function requiresResponsesAPI(model: string): boolean {
	const m = model.toLowerCase();
	// Pro reasoning variants
	if (m.endsWith("-pro")) return true;
	// o1, o3 reasoning models also use Responses API
	if (/^o\d+(-|$)/.test(m)) return true;
	return false;
}

/**
 * OpenAI Responses API call — for reasoning/Pro models that don't work
 * with the Chat Completions endpoint.
 */
async function openaiResponsesAPI(
	prompt: string,
	apiKey: string,
	model: string,
	systemPrompt?: string,
): Promise<string> {
	// Build input — Responses API accepts either a string or an array of messages
	const input: Array<{ role: string; content: string }> = [];
	if (systemPrompt) {
		input.push({ role: "system", content: systemPrompt });
	}
	input.push({ role: "user", content: prompt });

	// Reasoning models can produce very long outputs (chain of thought + answer).
	// Pro models support up to 65k+ output tokens.
	const maxOutputTokens = getMaxOutputTokens("https://api.openai.com/v1/responses", model);
	const response = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			input,
			max_output_tokens: Math.max(maxOutputTokens, 65_536),
		}),
		signal: AbortSignal.timeout(180_000), // longer timeout — reasoning models are slower
	});

	const data = (await response.json()) as {
		output_text?: string;
		output?: Array<{
			type?: string;
			content?: Array<{ type?: string; text?: string }>;
		}>;
		usage?: { input_tokens?: number; output_tokens?: number };
		error?: { message?: string };
	};

	if (!response.ok) {
		throw new Error(
			`OpenAI Responses API ${response.status}: ${data.error?.message || response.statusText}`,
		);
	}

	// Record token usage (Responses API uses input_tokens/output_tokens like Anthropic)
	if (data.usage) {
		recordUsage("openai", model, data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0);
	}

	// Try the convenience field first
	if (data.output_text) return data.output_text.trim();

	// Otherwise extract from the output array
	const outputItems = data.output ?? [];
	for (const item of outputItems) {
		if (item.type === "message" && item.content) {
			for (const c of item.content) {
				if (c.type === "output_text" && c.text) return c.text.trim();
			}
		}
	}

	throw new Error("OpenAI Responses API returned empty response");
}

async function openaiCompatibleChat(
	prompt: string,
	apiKey: string,
	model: string,
	endpoint: string,
	systemPrompt?: string,
): Promise<string> {
	// OpenAI reasoning/Pro models require the Responses API instead of Chat
	// Completions. Use exact host / dot-prefixed suffix rather than a bare
	// `endsWith("openai.com")`, which would also match lookalike domains
	// like `evilopenai.com` (CodeQL rule js/incomplete-url-substring-sanitization).
	const host = endpointHost(endpoint);
	const isOpenAiHost = host === "openai.com" || host.endsWith(".openai.com");
	if (isOpenAiHost && requiresResponsesAPI(model)) {
		return openaiResponsesAPI(prompt, apiKey, model, systemPrompt);
	}

	const messages: Array<{ role: string; content: string }> = [];
	if (systemPrompt) {
		messages.push({ role: "system", content: systemPrompt });
	}
	messages.push({ role: "user", content: prompt });

	const maxOutputTokens = getMaxOutputTokens(endpoint, model);
	// Timeout: 4 minutes — matches the Anthropic Sonnet ceiling. Plan
	// generation and Composer prompts run 8-12k tokens of input + 4-6k of
	// output and routinely take 60-150s on MiniMax M2.7 / GPT-5-mini.
	// The previous 120s ceiling was hitting timeouts on the Director +
	// Composer steps for larger plans.
	//
	// Output-token field naming is split across providers:
	//   - OpenAI's newer chat models (gpt-4o+, gpt-5.x) REQUIRE
	//     `max_completion_tokens` and reject `max_tokens`.
	//   - Most OpenAI-compat providers (Moonshot/Kimi, Groq legacy, etc.)
	//     only recognize the classic `max_tokens` and return a 400 on
	//     `max_completion_tokens`.
	// So: route by host. OpenAI gets the new name; everyone else gets
	// the classic one. Sending both was tempting but Moonshot 400s on the
	// unknown field rather than ignoring it.
	const body: Record<string, unknown> = {
		model,
		messages,
	};
	// Temperature: we prefer 0.3 for determinism on planning/code-gen
	// tasks, but some providers constrain it.
	//   - Kimi K2.x returns 400 "only 1 is allowed for this model" on any
	//     value other than 1 (same pattern as OpenAI's reasoning / Pro
	//     models). Easiest fix: omit the field entirely for Moonshot so
	//     the model uses its default; we lose a tiny bit of determinism
	//     but gain a working connection.
	const isMoonshotHost = host === "api.moonshot.ai" || host.endsWith(".moonshot.ai");
	if (!isMoonshotHost) {
		body.temperature = 0.3;
	}
	if (isOpenAiHost) {
		body.max_completion_tokens = maxOutputTokens;
	} else {
		body.max_tokens = maxOutputTokens;
	}
	// Per-provider timeout. Moonshot K2-thinking models legitimately take
	// 3-5 minutes on heavy research / planning prompts (long reasoning
	// chains at 256k context). Give them the same 6-min ceiling we use
	// for Anthropic Opus to stop "aborted due to timeout" on ResearchMode.
	const providerTimeoutMs = isMoonshotHost ? 360_000 : 240_000;
	const bodyBytes = JSON.stringify(body).length;

	// Retry wrapper — node undici throws a bare "fetch failed" TypeError
	// on socket-level issues (keep-alive reuse gone bad, server closed
	// mid-stream, transient DNS). Those are almost always one-shot
	// failures that succeed on a second attempt. Moonshot specifically
	// has been dropping our large Planner posts with "fetch failed"
	// even though test-connection and smaller calls go through cleanly.
	// Other providers get retried too — the pattern is universal.
	const MAX_ATTEMPTS = 2;
	let response: Response | null = null;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const startedAt = Date.now();
		try {
			response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(providerTimeoutMs),
			});
			const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
			console.log(
				`[aiService] ${host} ${model} → ${response.status} in ${elapsedSec}s (body ${Math.round(bodyBytes / 1024)}KB, attempt ${attempt}/${MAX_ATTEMPTS})`,
			);
			break;
		} catch (err) {
			const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
			const name = (err as { name?: string })?.name;
			const isAbort = name === "AbortError" || name === "TimeoutError";
			if (isAbort) {
				// Timeouts are not retried — if a 6-min call times out,
				// retrying is just going to waste another 6 minutes.
				throw new Error(
					`${host} timed out after ${elapsedSec}s (limit ${Math.round(providerTimeoutMs / 1000)}s) — model: ${model}, body ${Math.round(bodyBytes / 1024)}KB`,
				);
			}
			const message = (err as { message?: string })?.message ?? String(err);
			console.warn(
				`[aiService] ${host} ${model} → ${message} after ${elapsedSec}s (body ${Math.round(bodyBytes / 1024)}KB, attempt ${attempt}/${MAX_ATTEMPTS})`,
			);
			if (attempt >= MAX_ATTEMPTS) {
				throw new Error(
					`${host} network error: ${message} after ${elapsedSec}s — model: ${model}, body ${Math.round(bodyBytes / 1024)}KB`,
				);
			}
			// Short backoff before retrying — gives any connection-pool
			// issue a moment to clear and the server a moment to accept.
			await new Promise((r) => setTimeout(r, 1500));
		}
	}
	if (!response) {
		throw new Error(`${host} unreachable after ${MAX_ATTEMPTS} attempts — model: ${model}`);
	}
	const data = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
		usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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
	// Record token usage (OpenAI/MiniMax/Groq all return usage in this shape)
	if (data.usage) {
		const provider = endpointHost(endpoint)
			.replace(/^api\./, "")
			.split(".")[0];
		recordUsage(provider, model, data.usage.prompt_tokens ?? 0, data.usage.completion_tokens ?? 0);
	}
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
		max_tokens: getMaxOutputTokens(PROVIDER_ENDPOINTS.anthropic, model),
		messages: [{ role: "user", content: prompt }],
	};
	if (systemPrompt) {
		body.system = systemPrompt;
	}
	// Anthropic timeouts scale with model weight.
	// - Opus: slowest — 5 min (large prompts routinely take 90-180s)
	// - Sonnet: fast but can hit 120s on Director prompts with 10+ hero scenes
	//   or Composer scenes with heavy context. Bumped to 4 min.
	// - Haiku: usually <30s but keeps the same 4 min ceiling for safety.
	const modelLower = model.toLowerCase();
	const isOpus = modelLower.includes("opus");
	const timeoutMs = isOpus ? 300_000 : 240_000; // 5 min Opus, 4 min Sonnet/Haiku
	const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Anthropic ${response.status}: ${response.statusText} — ${errorBody.slice(0, 200)}`,
		);
	}
	const data = (await response.json()) as {
		content?: Array<{ text?: string }>;
		usage?: { input_tokens?: number; output_tokens?: number };
	};
	if (data.usage) {
		recordUsage("anthropic", model, data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0);
	}
	return data.content?.[0]?.text ?? "";
}

// ── Per-provider concurrency cap ────────────────────────────────────
//
// When two editor windows generate at the same time they hit the same
// provider in parallel, doubling the rate-limit pressure and tripping
// 429s on MiniMax / OpenAI / Anthropic. The cap below is a simple
// semaphore that limits how many in-flight requests can target a single
// provider at once. Excess calls queue and resume FIFO.
//
// Default: 3 concurrent calls per provider — high enough that a single
// window's parallel scene composer runs at full speed (Composer fans out
// 8 hero scenes), and low enough that two windows together don't burst
// past the rate-limit ceiling. Ollama is local so it has no cap.
const PROVIDER_CONCURRENCY: Record<AIProvider, number> = {
	openai: 3,
	anthropic: 3,
	groq: 3,
	minimax: 3,
	kimi: 3,
	ollama: Infinity, // local — no rate limits
};

interface ProviderSemaphore {
	running: number;
	queue: Array<() => void>;
}

const providerSemaphores: Map<AIProvider, ProviderSemaphore> = new Map();

function getSemaphore(provider: AIProvider): ProviderSemaphore {
	let sem = providerSemaphores.get(provider);
	if (!sem) {
		sem = { running: 0, queue: [] };
		providerSemaphores.set(provider, sem);
	}
	return sem;
}

async function withConcurrencyLimit<T>(provider: AIProvider, work: () => Promise<T>): Promise<T> {
	const limit = PROVIDER_CONCURRENCY[provider] ?? 3;
	if (limit === Infinity) return work();

	const sem = getSemaphore(provider);
	if (sem.running >= limit) {
		// Wait for a slot to open up
		await new Promise<void>((resolve) => sem.queue.push(resolve));
	}
	sem.running++;
	try {
		return await work();
	} finally {
		sem.running--;
		const next = sem.queue.shift();
		if (next) next();
	}
}

async function callProvider(
	provider: AIProvider,
	prompt: string,
	config: AIServiceConfig,
	systemPrompt?: string,
): Promise<string> {
	const model = config.model ?? DEFAULT_MODELS[provider] ?? "gpt-5.4-mini";

	return withConcurrencyLimit(provider, async () => {
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
	});
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

/**
 * Detect the image MIME type from raw base64 by inspecting magic bytes.
 * We previously hardcoded `image/png`, which makes strict validators reject
 * JPG/WebP/GIF uploads even though the base64 data is valid for those formats.
 */
function detectImageMime(base64: string): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
	if (base64.startsWith("iVBORw0KGgo")) return "image/png";
	if (base64.startsWith("/9j/")) return "image/jpeg";
	if (base64.startsWith("UklGR")) return "image/webp";
	if (base64.startsWith("R0lGOD")) return "image/gif";
	return "image/png"; // best-effort fallback
}

async function openaiVisionChat(
	prompt: string,
	imageBase64: string,
	apiKey: string,
	model: string,
	systemPrompt?: string,
): Promise<string> {
	const mime = detectImageMime(imageBase64);
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
				// `detail: high` gives the model enough pixels to read screenshots
				// with small text. `low` downscales too aggressively for product
				// page captures where the model needs to read headlines/copy.
				image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "high" },
			},
		],
	});

	console.log(
		`[AI vision] OpenAI call: model=${model}, mime=${mime}, base64Len=${imageBase64.length}, promptLen=${prompt.length}`,
	);
	const response = await fetch(PROVIDER_ENDPOINTS.openai, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		// `max_completion_tokens` replaces `max_tokens` on gpt-5 / reasoning
		// models — older models accept either. Using the newer name is
		// forward-compatible and avoids a 400 from gpt-5.4-mini.
		body: JSON.stringify({ model, messages, max_completion_tokens: 4096, temperature: 0.3 }),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) {
		// Surface the response body so we can see model-not-found, image-too-large,
		// or other API errors. Without this the caller only sees a generic status code.
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`OpenAI vision ${response.status} ${response.statusText}: ${errorBody.slice(0, 400)}`,
		);
	}
	const data = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
		usage?: { prompt_tokens?: number; completion_tokens?: number };
	};
	if (data.usage) {
		recordUsage("openai", model, data.usage.prompt_tokens ?? 0, data.usage.completion_tokens ?? 0);
	}
	return data.choices?.[0]?.message?.content ?? "";
}

async function anthropicVisionChat(
	prompt: string,
	imageBase64: string,
	apiKey: string,
	model: string,
	systemPrompt?: string,
): Promise<string> {
	const mime = detectImageMime(imageBase64);
	const body: Record<string, unknown> = {
		model,
		max_tokens: 4096,
		messages: [
			{
				role: "user",
				content: [
					{
						type: "image",
						source: { type: "base64", media_type: mime, data: imageBase64 },
					},
					{ type: "text", text: prompt },
				],
			},
		],
	};
	if (systemPrompt) {
		body.system = systemPrompt;
	}

	console.log(
		`[AI vision] Anthropic call: model=${model}, mime=${mime}, base64Len=${imageBase64.length}, promptLen=${prompt.length}`,
	);
	const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Anthropic vision ${response.status} ${response.statusText}: ${errorBody.slice(0, 400)}`,
		);
	}
	const data = (await response.json()) as {
		content?: Array<{ text?: string }>;
		usage?: { input_tokens?: number; output_tokens?: number };
	};
	if (data.usage) {
		recordUsage("anthropic", model, data.usage.input_tokens ?? 0, data.usage.output_tokens ?? 0);
	}
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

export async function analyze(
	prompt: string,
	context?: string,
	modelOverride?: { provider: string; model: string },
): Promise<AIServiceResult> {
	const config = await loadAIConfig();

	// Apply model override if provided (used by Director chat to test different models).
	// CRITICAL: when overriding the provider, we must also load the correct API key
	// for that provider — not reuse the current provider's key.
	let effectiveConfig = config;
	if (modelOverride) {
		const overrideProvider = modelOverride.provider as typeof config.provider;
		if (overrideProvider !== config.provider) {
			// Load the per-provider key from settings
			const settings = await (await import("../settings")).loadSettings();
			const providerKeyField = `aiApiKey_${overrideProvider}` as keyof typeof settings;
			const providerKey = (settings[providerKeyField] as string | undefined) ?? settings.aiApiKey;
			effectiveConfig = {
				...config,
				provider: overrideProvider,
				model: modelOverride.model,
				apiKey: providerKey,
			};
		} else {
			effectiveConfig = { ...config, model: modelOverride.model };
		}
	}

	try {
		// Pass context as a proper system prompt for all providers
		const text = await callProvider(effectiveConfig.provider, prompt, effectiveConfig, context);
		return { success: true, text };
	} catch (err) {
		console.warn(`AI provider "${effectiveConfig.provider}" failed:`, err);
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
