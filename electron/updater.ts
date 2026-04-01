import https from "node:https";
import { app } from "electron";

export type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

export interface UpdateInfo {
	state: UpdateState;
	latestVersion?: string;
	currentVersion?: string;
	downloadUrl?: string;
	error?: string;
}

const GITHUB_REPO = "getcoherence/lucid";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let currentState: UpdateInfo = { state: "idle" };
let checkTimer: NodeJS.Timeout | null = null;
let onUpdateAvailableCallback: ((version: string) => void) | null = null;

function getCurrentVersion(): string {
	return app.getVersion();
}

function compareVersions(a: string, b: string): number {
	const pa = a.replace(/^v/, "").split(".").map(Number);
	const pb = b.replace(/^v/, "").split(".").map(Number);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const na = pa[i] || 0;
		const nb = pb[i] || 0;
		if (na > nb) return 1;
		if (na < nb) return -1;
	}
	return 0;
}

function fetchLatestRelease(): Promise<{
	version: string;
	downloadUrl: string;
} | null> {
	return new Promise((resolve) => {
		const options = {
			hostname: "api.github.com",
			path: `/repos/${GITHUB_REPO}/releases/latest`,
			method: "GET",
			headers: {
				"User-Agent": `LucidStudio/${getCurrentVersion()}`,
				Accept: "application/vnd.github.v3+json",
			},
		};

		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk: Buffer) => {
				data += chunk.toString();
			});
			res.on("end", () => {
				try {
					if (res.statusCode !== 200) {
						resolve(null);
						return;
					}
					const release = JSON.parse(data) as {
						tag_name?: string;
						html_url?: string;
					};
					if (!release.tag_name) {
						resolve(null);
						return;
					}
					resolve({
						version: release.tag_name.replace(/^v/, ""),
						downloadUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
					});
				} catch {
					resolve(null);
				}
			});
		});

		req.on("error", () => {
			resolve(null);
		});

		req.end();
	});
}

export async function checkForUpdates(): Promise<UpdateInfo> {
	const currentVersion = getCurrentVersion();
	currentState = { state: "checking", currentVersion };

	try {
		const latest = await fetchLatestRelease();
		if (!latest) {
			currentState = { state: "idle", currentVersion };
			return currentState;
		}

		if (compareVersions(latest.version, currentVersion) > 0) {
			currentState = {
				state: "available",
				latestVersion: latest.version,
				currentVersion,
				downloadUrl: latest.downloadUrl,
			};
			if (onUpdateAvailableCallback) {
				onUpdateAvailableCallback(latest.version);
			}
		} else {
			currentState = { state: "idle", currentVersion };
		}
	} catch (err) {
		currentState = {
			state: "error",
			currentVersion,
			error: String(err),
		};
	}

	return currentState;
}

export function getUpdateStatus(): UpdateInfo {
	return currentState;
}

export function dismissUpdate(): void {
	if (currentState.state === "available") {
		currentState = { state: "idle", currentVersion: getCurrentVersion() };
	}
}

export function onUpdateAvailable(callback: (version: string) => void): void {
	onUpdateAvailableCallback = callback;
}

export function startAutoUpdateCheck(): void {
	// Initial check after a short delay so the app loads first
	setTimeout(() => {
		checkForUpdates().catch(() => {
			// Silently ignore auto-check failures
		});
	}, 10_000);

	// Periodic checks
	if (checkTimer) {
		clearInterval(checkTimer);
	}
	checkTimer = setInterval(() => {
		checkForUpdates().catch(() => {
			// Silently ignore auto-check failures
		});
	}, CHECK_INTERVAL_MS);
}

export function stopAutoUpdateCheck(): void {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
}
