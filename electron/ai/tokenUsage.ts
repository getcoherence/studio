// ── Token Usage Tracker ─────────────────────────────────────────────────
//
// Per-run accumulator for AI token spend. The renderer resets it at the
// start of a generation run (via `ai-token-usage-reset` IPC) and queries
// the totals at the end (via `ai-token-usage-get`). Keeps the instrumentation
// in one place — provider functions call `recordUsage()` after every
// successful API response.

export interface CallUsage {
	provider: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	/** Approximate USD cost, computed from MODEL_COSTS. 0 for flat-subscription
	 *  providers like MiniMax where per-call cost doesn't apply. */
	estimatedCostUsd: number;
}

export interface UsageSummary {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCalls: number;
	estimatedCostUsd: number;
	byModel: Record<
		string,
		{
			calls: number;
			inputTokens: number;
			outputTokens: number;
			estimatedCostUsd: number;
		}
	>;
}

// USD per million tokens. Rates are approximate and intentionally slightly
// high to avoid under-reporting. Flat-subscription providers (MiniMax on a
// monthly plan) get 0 so we don't mis-count.
const MODEL_COSTS: Record<
	string,
	{ inputPerM: number; outputPerM: number } | undefined
> = {
	// OpenAI
	"gpt-5.4": { inputPerM: 5.0, outputPerM: 15.0 },
	"gpt-5-mini": { inputPerM: 0.6, outputPerM: 2.4 },
	"gpt-5-nano": { inputPerM: 0.15, outputPerM: 0.6 },
	"gpt-4.1": { inputPerM: 3.0, outputPerM: 12.0 },
	"gpt-4o": { inputPerM: 2.5, outputPerM: 10.0 },
	"gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
	// Anthropic
	"claude-opus-4-6": { inputPerM: 15.0, outputPerM: 75.0 },
	"claude-sonnet-4-6": { inputPerM: 3.0, outputPerM: 15.0 },
	"claude-haiku-4-5-20251001": { inputPerM: 1.0, outputPerM: 5.0 },
	// Groq — flat per-token, rough averages
	"llama-3.3-70b-versatile": { inputPerM: 0.6, outputPerM: 0.8 },
	// MiniMax — treated as $0 when on the flat-subscription plan. Set a
	// non-zero value here if you switch to pay-per-token.
	"MiniMax-M2.7-highspeed": { inputPerM: 0, outputPerM: 0 },
	"MiniMax-M2.7": { inputPerM: 0, outputPerM: 0 },
};

function costFor(model: string, inputTokens: number, outputTokens: number): number {
	const rate = MODEL_COSTS[model];
	if (!rate) return 0;
	return (inputTokens / 1_000_000) * rate.inputPerM + (outputTokens / 1_000_000) * rate.outputPerM;
}

let summary: UsageSummary = emptySummary();

function emptySummary(): UsageSummary {
	return {
		totalInputTokens: 0,
		totalOutputTokens: 0,
		totalCalls: 0,
		estimatedCostUsd: 0,
		byModel: {},
	};
}

export function recordUsage(provider: string, model: string, inputTokens: number, outputTokens: number): void {
	if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return;
	if (inputTokens <= 0 && outputTokens <= 0) return;
	const cost = costFor(model, inputTokens, outputTokens);
	summary.totalCalls += 1;
	summary.totalInputTokens += inputTokens;
	summary.totalOutputTokens += outputTokens;
	summary.estimatedCostUsd += cost;
	const key = `${provider}:${model}`;
	const prev = summary.byModel[key] ?? {
		calls: 0,
		inputTokens: 0,
		outputTokens: 0,
		estimatedCostUsd: 0,
	};
	summary.byModel[key] = {
		calls: prev.calls + 1,
		inputTokens: prev.inputTokens + inputTokens,
		outputTokens: prev.outputTokens + outputTokens,
		estimatedCostUsd: prev.estimatedCostUsd + cost,
	};
}

export function getUsageSummary(): UsageSummary {
	return {
		...summary,
		byModel: { ...summary.byModel },
	};
}

export function resetUsage(): void {
	summary = emptySummary();
}
