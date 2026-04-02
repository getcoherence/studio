// ── Demo prompt history (localStorage) ────────────────────────────────

const STORAGE_KEY = "lucid-demo-prompt-history";
const MAX_HISTORY = 20;

export interface PromptHistoryEntry {
	url: string;
	prompt: string;
	timestamp: number;
}

export function getPromptHistory(): PromptHistoryEntry[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as PromptHistoryEntry[];
	} catch {
		return [];
	}
}

export function addToPromptHistory(entry: { url: string; prompt: string }): void {
	const history = getPromptHistory();

	// Deduplicate — remove if same URL+prompt already exists
	const filtered = history.filter((h) => !(h.url === entry.url && h.prompt === entry.prompt));

	filtered.unshift({ ...entry, timestamp: Date.now() });

	// Trim to max
	if (filtered.length > MAX_HISTORY) {
		filtered.length = MAX_HISTORY;
	}

	localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearPromptHistory(): void {
	localStorage.removeItem(STORAGE_KEY);
}
