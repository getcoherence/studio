import fs from "node:fs/promises";
import path from "node:path";
import { app, ipcMain } from "electron";

interface RecentProjectEntry {
	filePath: string;
	addedAt: number;
}

const RECENT_PROJECTS_FILE = path.join(app.getPath("userData"), "recent-projects.json");
const MAX_RECENT_PROJECTS = 20;

async function loadRecentProjectEntries(): Promise<RecentProjectEntry[]> {
	try {
		const data = await fs.readFile(RECENT_PROJECTS_FILE, "utf-8");
		const parsed = JSON.parse(data);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function saveRecentProjectEntries(entries: RecentProjectEntry[]): Promise<void> {
	await fs.writeFile(RECENT_PROJECTS_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export async function addRecentProject(filePath: string): Promise<void> {
	const entries = await loadRecentProjectEntries();
	const normalized = path.resolve(filePath);
	const filtered = entries.filter((e) => path.resolve(e.filePath) !== normalized);
	filtered.unshift({ filePath: normalized, addedAt: Date.now() });
	await saveRecentProjectEntries(filtered.slice(0, MAX_RECENT_PROJECTS));
}

export function registerProjectHandlers() {
	ipcMain.handle("get-recent-projects", async () => {
		const entries = await loadRecentProjectEntries();
		const results: Array<{
			filePath: string;
			fileName: string;
			lastModified: number;
			fileSize: number;
		}> = [];

		for (const entry of entries) {
			try {
				const stat = await fs.stat(entry.filePath);
				results.push({
					filePath: entry.filePath,
					fileName: path.basename(entry.filePath),
					lastModified: stat.mtimeMs,
					fileSize: stat.size,
				});
			} catch {
				// File no longer exists, skip it
			}
		}

		return results;
	});

	ipcMain.handle("remove-recent-project", async (_, filePath: string) => {
		const entries = await loadRecentProjectEntries();
		const normalized = path.resolve(filePath);
		const filtered = entries.filter((e) => path.resolve(e.filePath) !== normalized);
		await saveRecentProjectEntries(filtered);
		return { success: true };
	});
}
