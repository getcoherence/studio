/**
 * LottieFiles Search API — search and download Lottie animations.
 * Uses the semi-public REST API at lottiefiles.com/api.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

const API_BASE = "https://lottiefiles.com/api";
const LOTTIE_DIR = "lottie-library";

function getLottieDir(): string {
	return path.join(app.getPath("userData"), LOTTIE_DIR);
}

async function ensureLottieDir(): Promise<string> {
	const dir = getLottieDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

export interface LottieSearchResult {
	id: string;
	name: string;
	imageUrl: string;
	lottieUrl: string;
	bgColor: string;
	createdBy?: { firstName: string };
}

/**
 * Search LottieFiles for animations by keyword.
 */
export async function searchLottieAnimations(
	query: string,
	page = 1,
	limit = 20,
): Promise<{ results: LottieSearchResult[]; error?: string }> {
	try {
		const url = `${API_BASE}/search/get-animations?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}&format=json`;
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(15_000),
		});

		if (!response.ok) {
			return { results: [], error: `LottieFiles API returned ${response.status}` };
		}

		const data = await response.json();
		// Response is triply nested: data.data.data
		const animations = data?.data?.data?.data || data?.data?.data || data?.data || [];

		const results: LottieSearchResult[] = Array.isArray(animations)
			? animations.map((a: any) => ({
					id: String(a.id || a.hash || ""),
					name: a.name || "Untitled",
					imageUrl: a.imageUrl || a.gifUrl || "",
					lottieUrl: a.lottieUrl || "",
					bgColor: a.bgColor || "#ffffff",
					createdBy: a.createdBy,
				}))
			: [];

		return { results };
	} catch (err) {
		return { results: [], error: `Search failed: ${err}` };
	}
}

/**
 * Get popular/featured animations.
 */
export async function getPopularLotties(
	page = 1,
	limit = 20,
): Promise<{ results: LottieSearchResult[]; error?: string }> {
	try {
		const url = `${API_BASE}/iconscout/popular-animations-weekly?page=${page}&limit=${limit}&format=json`;
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(15_000),
		});

		if (!response.ok) {
			return { results: [], error: `API returned ${response.status}` };
		}

		const data = await response.json();
		const animations = data?.data?.popularWeeklyData?.data || data?.data?.data || [];

		const results: LottieSearchResult[] = Array.isArray(animations)
			? animations.map((a: any) => ({
					id: String(a.id || a.hash || ""),
					name: a.name || "Untitled",
					imageUrl: a.imageUrl || a.gifUrl || "",
					lottieUrl: a.lottieUrl || "",
					bgColor: a.bgColor || "#ffffff",
					createdBy: a.createdBy,
				}))
			: [];

		return { results };
	} catch (err) {
		return { results: [], error: `Popular fetch failed: ${err}` };
	}
}

/**
 * Download a Lottie animation JSON and save to the local library.
 */
export async function downloadLottieAnimation(
	lottieUrl: string,
	name: string,
): Promise<{ success: boolean; filePath?: string; error?: string }> {
	try {
		const response = await fetch(lottieUrl, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
			signal: AbortSignal.timeout(30_000),
		});

		if (!response.ok) {
			return { success: false, error: `Download failed: ${response.status}` };
		}

		const json = await response.text();
		const dir = await ensureLottieDir();
		const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
		const filePath = path.join(dir, `${safeName}.json`);
		await fs.writeFile(filePath, json, "utf-8");

		return { success: true, filePath };
	} catch (err) {
		return { success: false, error: `Download failed: ${err}` };
	}
}
