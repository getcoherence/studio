import fs from "node:fs/promises";
import path from "node:path";
import { app, ipcMain } from "electron";
import type { GenerationMetadata } from "../../src/lib/scene-renderer/types";

interface RecentProjectEntry {
	filePath: string;
	addedAt: number;
	/** Snapshot of generation metadata, captured at save time. Allows the
	 *  recent projects browser to show model/aesthetic without reading each file. */
	metadata?: GenerationMetadata;
}

const RECENT_PROJECTS_FILE = path.join(app.getPath("userData"), "recent-projects.json");
const RECENT_PROJECTS_TMP = `${RECENT_PROJECTS_FILE}.tmp`;
const MAX_RECENT_PROJECTS = 20;

async function loadRecentProjectEntries(): Promise<RecentProjectEntry[]> {
	try {
		const data = await fs.readFile(RECENT_PROJECTS_FILE, "utf-8");
		// Empty file = brand-new install. Don't log a parse error on the
		// initial run.
		if (!data.trim()) return [];
		const parsed = JSON.parse(data);
		return Array.isArray(parsed) ? parsed : [];
	} catch (err) {
		const code = (err as NodeJS.ErrnoException)?.code;
		if (code === "ENOENT") return []; // first run, no file yet
		// Surface real parse errors instead of silently returning [] — a
		// silent return is what caused the recent-projects clobber bug
		// (concurrent saves read a partially-written file, parse failed,
		// and the next write only had the current entry).
		console.error("[recentProjects] failed to load entries:", err);
		return [];
	}
}

/** Atomic write: temp file + rename. Rename is atomic on the same FS so a
 *  concurrent reader either sees the old file or the new file, never a
 *  half-written one. */
async function saveRecentProjectEntries(entries: RecentProjectEntry[]): Promise<void> {
	await fs.writeFile(RECENT_PROJECTS_TMP, JSON.stringify(entries, null, 2), "utf-8");
	await fs.rename(RECENT_PROJECTS_TMP, RECENT_PROJECTS_FILE);
}

// Serialize all updates so concurrent saves can't read-then-clobber each
// other. The chain is `.catch`-protected so a single failure doesn't break
// subsequent updates.
let updateChain: Promise<void> = Promise.resolve();

function enqueueUpdate(work: () => Promise<void>): Promise<void> {
	const next = updateChain.then(work).catch((err) => {
		console.error("[recentProjects] update failed:", err);
	});
	updateChain = next;
	return next;
}

export async function addRecentProject(
	filePath: string,
	metadata?: GenerationMetadata,
): Promise<void> {
	return enqueueUpdate(async () => {
		const entries = await loadRecentProjectEntries();
		const normalized = path.resolve(filePath);
		// Preserve any existing metadata if no new metadata provided
		const existing = entries.find((e) => path.resolve(e.filePath) === normalized);
		const filtered = entries.filter((e) => path.resolve(e.filePath) !== normalized);
		filtered.unshift({
			filePath: normalized,
			addedAt: Date.now(),
			metadata: metadata ?? existing?.metadata,
		});
		await saveRecentProjectEntries(filtered.slice(0, MAX_RECENT_PROJECTS));
	});
}

export function registerProjectHandlers() {
	ipcMain.handle("get-recent-projects", async () => {
		const entries = await loadRecentProjectEntries();
		const results: Array<{
			filePath: string;
			fileName: string;
			lastModified: number;
			fileSize: number;
			metadata?: GenerationMetadata;
		}> = [];

		for (const entry of entries) {
			try {
				const stat = await fs.stat(entry.filePath);
				results.push({
					filePath: entry.filePath,
					fileName: path.basename(entry.filePath),
					lastModified: stat.mtimeMs,
					fileSize: stat.size,
					metadata: entry.metadata,
				});
			} catch {
				// File no longer exists, skip it
			}
		}

		return results;
	});

	ipcMain.handle("remove-recent-project", async (_, filePath: string) => {
		await enqueueUpdate(async () => {
			const entries = await loadRecentProjectEntries();
			const normalized = path.resolve(filePath);
			const filtered = entries.filter((e) => path.resolve(e.filePath) !== normalized);
			await saveRecentProjectEntries(filtered);
		});
		return { success: true };
	});
}
