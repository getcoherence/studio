import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

export interface LucidSettings {
	// Capture
	captureBackend: "auto" | "native" | "browser";

	// AI (unified — used by aiService.ts)
	aiProvider: "ollama" | "openai" | "anthropic" | "groq" | "minimax";
	aiApiKey?: string;
	aiModel?: string;
	aiOllamaUrl?: string;
	whisperModel: "tiny" | "base" | "small";

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
	recentProjects: string[];

	// License
	licenseTier: "free" | "pro";
	licenseKey?: string;
}

const DEFAULT_SETTINGS: LucidSettings = {
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
	recentProjects: [],
	licenseTier: "free",
};

let cachedSettings: LucidSettings | null = null;

function getSettingsPath(): string {
	return path.join(app.getPath("userData"), "settings.json");
}

export async function loadSettings(): Promise<LucidSettings> {
	if (cachedSettings) return { ...cachedSettings };

	try {
		const data = await fs.readFile(getSettingsPath(), "utf-8");
		const parsed = JSON.parse(data) as Partial<LucidSettings>;
		cachedSettings = { ...DEFAULT_SETTINGS };
		for (const key of Object.keys(parsed) as (keyof LucidSettings)[]) {
			if (parsed[key] !== undefined) {
				(cachedSettings as unknown as Record<string, unknown>)[key] = parsed[key];
			}
		}
	} catch {
		cachedSettings = { ...DEFAULT_SETTINGS };
	}

	return { ...cachedSettings };
}

export async function saveSettings(settings: Partial<LucidSettings>): Promise<LucidSettings> {
	const current = await loadSettings();
	// Filter out undefined values before merging
	const cleaned = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined));
	const updated: LucidSettings = { ...current, ...cleaned };

	await fs.writeFile(getSettingsPath(), JSON.stringify(updated, null, 2), "utf-8");
	cachedSettings = updated;

	return { ...updated };
}

export async function getSetting<K extends keyof LucidSettings>(key: K): Promise<LucidSettings[K]> {
	const settings = await loadSettings();
	return settings[key];
}

export async function setSetting<K extends keyof LucidSettings>(
	key: K,
	value: LucidSettings[K],
): Promise<void> {
	await saveSettings({ [key]: value } as Partial<LucidSettings>);
}
