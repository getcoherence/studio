import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

export interface StudioSettings {
	// Capture
	captureBackend: "auto" | "native" | "browser";

	// AI (unified — used by aiService.ts)
	aiProvider: "ollama" | "openai" | "anthropic" | "groq" | "minimax" | "kimi";
	aiApiKey?: string; // Legacy single key (still read as fallback)
	aiModel?: string;
	aiOllamaUrl?: string;
	whisperModel: "tiny" | "base" | "small";

	// Per-provider API keys (so switching providers doesn't wipe keys)
	aiApiKey_openai?: string;
	aiApiKey_anthropic?: string;
	aiApiKey_groq?: string;
	aiApiKey_minimax?: string;
	aiApiKey_kimi?: string;
	aiApiKey_elevenlabs?: string;

	// Per-provider model selection (so switching providers doesn't lose model choice)
	aiModel_openai?: string;
	aiModel_anthropic?: string;
	aiModel_groq?: string;
	aiModel_minimax?: string;
	aiModel_kimi?: string;
	aiModel_ollama?: string;

	// Cursor
	cursorSmoothing: number;
	cursorSway: number;
	cursorStyle: string;
	showClickRings: boolean;

	// Export
	defaultExportFormat: "mp4" | "gif";

	// App
	locale: string;
	checkForUpdates: boolean;
	updateChannel: "latest" | "beta";
	recentProjects: string[];

	// License
	licenseTier: "free" | "pro";
	licenseKey?: string;
}

const DEFAULT_SETTINGS: StudioSettings = {
	captureBackend: "auto",
	aiProvider: "openai",
	whisperModel: "small",
	cursorSmoothing: 0.5,
	cursorSway: 0.3,
	cursorStyle: "default",
	showClickRings: true,
	defaultExportFormat: "mp4",
	locale: "en",
	checkForUpdates: true,
	updateChannel: "latest",
	recentProjects: [],
	licenseTier: "free",
};

let cachedSettings: StudioSettings | null = null;

function getSettingsPath(): string {
	return path.join(app.getPath("userData"), "settings.json");
}

export async function loadSettings(): Promise<StudioSettings> {
	if (cachedSettings) return { ...cachedSettings };

	try {
		const data = await fs.readFile(getSettingsPath(), "utf-8");
		const parsed = JSON.parse(data) as Partial<StudioSettings>;
		cachedSettings = { ...DEFAULT_SETTINGS };
		for (const key of Object.keys(parsed) as (keyof StudioSettings)[]) {
			if (parsed[key] !== undefined) {
				(cachedSettings as unknown as Record<string, unknown>)[key] = parsed[key];
			}
		}
	} catch {
		cachedSettings = { ...DEFAULT_SETTINGS };
	}

	return { ...cachedSettings };
}

export async function saveSettings(settings: Partial<StudioSettings>): Promise<StudioSettings> {
	const current = await loadSettings();
	// Filter out undefined values before merging
	const cleaned = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined));
	const updated: StudioSettings = { ...current, ...cleaned };

	await fs.writeFile(getSettingsPath(), JSON.stringify(updated, null, 2), "utf-8");
	cachedSettings = updated;

	return { ...updated };
}

export async function getSetting<K extends keyof StudioSettings>(
	key: K,
): Promise<StudioSettings[K]> {
	const settings = await loadSettings();
	return settings[key];
}

export async function setSetting<K extends keyof StudioSettings>(
	key: K,
	value: StudioSettings[K],
): Promise<void> {
	await saveSettings({ [key]: value } as Partial<StudioSettings>);
}

// Synchronous accessor — returns the cached value, or the default if
// settings haven't been loaded yet. Safe to call from menu-building code
// that needs a best-effort view of settings (e.g. which update channel is
// currently selected so the Release Channel submenu renders the right
// ✓ on app startup).
export function getCachedSetting<K extends keyof StudioSettings>(key: K): StudioSettings[K] {
	return (cachedSettings ?? DEFAULT_SETTINGS)[key];
}
