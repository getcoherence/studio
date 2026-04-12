// ── Studio Site Cache ───────────────────────────────────────────────────
//
// Disk cache for URL-deterministic Phase 1 outputs (Demo Agent results +
// Brand Voice Extractor + Visual Design Scout). Lets subsequent runs on
// the same website skip ~40-100s of re-analysis.
//
// Cache key: SHA1 hash of normalized URL.
// Cache location: app.getPath('userData')/studio-cache/sites/[hash].json
// TTL: 7 days (config below). Manual refresh available via "Re-analyze".

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { app, ipcMain } from "electron";

const CACHE_DIR = path.join(app.getPath("userData"), "studio-cache", "sites");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCHEMA_VERSION = 1;

function normalizeUrl(url: string): string {
	return url
		.toLowerCase()
		.replace(/^https?:\/\/(www\.)?/, "")
		.replace(/\/+$/, "")
		.split("?")[0]
		.split("#")[0];
}

function urlHash(url: string): string {
	return crypto.createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
}

function cachePathFor(url: string): string {
	return path.join(CACHE_DIR, `${urlHash(url)}.json`);
}

async function ensureCacheDir(): Promise<void> {
	await fs.mkdir(CACHE_DIR, { recursive: true });
}

export function registerStudioCacheHandlers() {
	// ── GET ──
	ipcMain.handle("studio-cache-get", async (_, url: string) => {
		try {
			const filePath = cachePathFor(url);
			const content = await fs.readFile(filePath, "utf-8");
			const entry = JSON.parse(content);

			if (entry.schemaVersion !== SCHEMA_VERSION) {
				return { success: false, expired: true, reason: "schema-mismatch" };
			}

			const cachedAtMs = new Date(entry.cachedAt).getTime();
			const ageMs = Date.now() - cachedAtMs;
			if (ageMs > CACHE_TTL_MS) {
				return { success: false, expired: true, reason: "ttl", ageMs };
			}

			console.log(`[StudioCache] HIT for ${normalizeUrl(url)} (age: ${Math.round(ageMs / 1000)}s)`);
			return { success: true, entry, ageMs };
		} catch {
			console.log(`[StudioCache] MISS for ${normalizeUrl(url)}`);
			return { success: false, reason: "not-found" };
		}
	});

	// ── SET ──
	ipcMain.handle("studio-cache-set", async (_, url: string, entry: unknown) => {
		try {
			await ensureCacheDir();
			const filePath = cachePathFor(url);
			const enriched = {
				...(entry as object),
				url,
				cachedAt: new Date().toISOString(),
				schemaVersion: SCHEMA_VERSION,
			};
			const json = JSON.stringify(enriched, null, 2);
			await fs.writeFile(filePath, json, "utf-8");
			console.log(
				`[StudioCache] SET for ${normalizeUrl(url)} (${Math.round(json.length / 1024)} KB)`,
			);
			return { success: true, path: filePath };
		} catch (err) {
			console.warn("[StudioCache] SET failed:", err);
			return { success: false, error: String(err) };
		}
	});

	// ── CLEAR (single URL or all) ──
	ipcMain.handle("studio-cache-clear", async (_, url?: string) => {
		try {
			if (url) {
				await fs.unlink(cachePathFor(url)).catch(() => {
					// already gone
				});
				console.log(`[StudioCache] CLEAR for ${normalizeUrl(url)}`);
				return { success: true };
			}
			// Clear all
			const files = await fs.readdir(CACHE_DIR).catch(() => [] as string[]);
			let cleared = 0;
			for (const f of files) {
				if (f.endsWith(".json")) {
					await fs.unlink(path.join(CACHE_DIR, f)).catch(() => {});
					cleared++;
				}
			}
			console.log(`[StudioCache] CLEAR all (${cleared} files)`);
			return { success: true, cleared };
		} catch {
			return { success: true };
		}
	});

	// ── LIST (for diagnostics / future cache management UI) ──
	ipcMain.handle("studio-cache-list", async () => {
		try {
			await ensureCacheDir();
			const files = await fs.readdir(CACHE_DIR);
			const entries: Array<{
				url: string;
				cachedAt: string;
				sizeKB: number;
				stepCount: number;
				hasBrandBrief: boolean;
			}> = [];
			for (const f of files) {
				if (!f.endsWith(".json")) continue;
				try {
					const filePath = path.join(CACHE_DIR, f);
					const content = await fs.readFile(filePath, "utf-8");
					const entry = JSON.parse(content);
					const stat = await fs.stat(filePath);
					entries.push({
						url: entry.url,
						cachedAt: entry.cachedAt,
						sizeKB: Math.round(stat.size / 1024),
						stepCount: Array.isArray(entry.demoSteps) ? entry.demoSteps.length : 0,
						hasBrandBrief: !!entry.brandBrief,
					});
				} catch {
					// Skip corrupt entries
				}
			}
			entries.sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
			return { success: true, entries };
		} catch {
			return { success: false, entries: [] };
		}
	});
}
