import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, ipcMain, safeStorage } from "electron";

// Mirror the secure-store layout used by electron/ipc/handlers.ts so the
// showcase handler can refresh expired tokens without going through IPC.
// Keep keys consistent with src/lib/plugins/pro/proLoader.ts (tokenKey =
// "studio-pro-token", refresh key = `${tokenKey}-refresh`).
const SECURE_STORE_FILE = path.join(app.getPath("userData"), "secure-store.json");
const ACCESS_KEY = "studio-pro-token";
const REFRESH_KEY = "studio-pro-token-refresh";

async function readSecureValue(key: string): Promise<string | null> {
	try {
		const raw = await fs.readFile(SECURE_STORE_FILE, "utf-8");
		const store = JSON.parse(raw) as Record<string, string>;
		const encoded = store[key];
		if (!encoded) return null;
		if (encoded.startsWith("enc:") && safeStorage.isEncryptionAvailable()) {
			return safeStorage.decryptString(Buffer.from(encoded.slice(4), "base64"));
		}
		if (encoded.startsWith("plain:")) {
			return Buffer.from(encoded.slice(6), "base64").toString("utf-8");
		}
		return null;
	} catch {
		return null;
	}
}

async function writeSecureValue(key: string, value: string): Promise<void> {
	let store: Record<string, string> = {};
	try {
		const raw = await fs.readFile(SECURE_STORE_FILE, "utf-8");
		store = JSON.parse(raw);
	} catch {
		/* new file */
	}
	const encoded = safeStorage.isEncryptionAvailable()
		? `enc:${safeStorage.encryptString(value).toString("base64")}`
		: `plain:${Buffer.from(value, "utf-8").toString("base64")}`;
	store[key] = encoded;
	await fs.writeFile(SECURE_STORE_FILE, JSON.stringify(store), "utf-8");
}

/**
 * Use the stored refresh token to get a fresh access token from the auth
 * service. Updates secure storage on success. Returns null if refresh fails
 * (expired, missing, network error) — caller should surface a "reconnect"
 * error in that case.
 */
async function refreshProAccessToken(baseUrl: string): Promise<string | null> {
	const refreshToken = await readSecureValue(REFRESH_KEY);
	if (!refreshToken) return null;
	try {
		const res = await fetch(`${baseUrl}/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken }),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
		if (!data.accessToken) return null;
		await writeSecureValue(ACCESS_KEY, data.accessToken);
		if (data.refreshToken) await writeSecureValue(REFRESH_KEY, data.refreshToken);
		return data.accessToken;
	} catch {
		return null;
	}
}

function findFfmpegBinary(): string {
	// Use the ffmpeg binary shipped with @remotion/compositor-<platform>-<arch>.
	// It's already a dependency (via @remotion/renderer), already signed in
	// packaged builds, and unpacked into resources/app.asar.unpacked/node_modules
	// by electron-builder automatically because it contains native code.
	// Avoids maintaining a separate native/bin/ that would need to be
	// downloaded in CI and kept in sync per-arch per-platform.
	const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
	const libcSuffix =
		process.platform === "win32"
			? "-msvc"
			: process.platform === "linux"
				? "-gnu"
				: "";
	const pkg = `compositor-${process.platform}-${process.arch}${libcSuffix}`;
	const base = app.isPackaged
		? path.join(process.resourcesPath, "app.asar.unpacked", "node_modules")
		: path.join(app.getAppPath(), "node_modules");
	return path.join(base, "@remotion", pkg, name);
}

// auth.getcoherence.io is the marketing/frontends static-site app, not the
// auth service. The actual auth service lives behind app.getcoherence.io at
// /api/v1/auth/*, matching the other pro endpoints in src/lib/plugins/pro/
// proLoader.ts (refreshUrl, subscriptionUrl, bundleUrl).
const AUTH_BASE_URL = "https://app.getcoherence.io/api/v1/auth";

export function registerShowcaseHandlers(_getMainWindow: () => BrowserWindow | null): void {
	ipcMain.handle(
		"showcase-upload",
		async (
			event,
			opts: {
				videoPath: string;
				title: string;
				prompt?: string;
				aesthetic?: string;
				model?: string;
				sceneCount?: number;
				durationSec?: number;
				token: string;
			},
		) => {
			const senderWindow = BrowserWindow.fromWebContents(event.sender);
			const sendProgress = (pct: number) => {
				senderWindow?.webContents.send("showcase-upload-progress", pct);
			};

			try {
				const baseUrl = AUTH_BASE_URL;
				sendProgress(0.05);

				// 1. Get presigned URLs from auth service. If the stored token
				// has expired (401), refresh it with the refresh token and retry
				// once before surfacing an error.
				let accessToken = opts.token;
				const doPresign = (token: string) =>
					fetch(`${baseUrl}/studio/showcase/presign`, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
					});
				let presignRes = await doPresign(accessToken);
				if (presignRes.status === 401) {
					const fresh = await refreshProAccessToken(baseUrl);
					if (!fresh) {
						throw new Error(
							"Your Coherence session expired. Please sign in to Studio again and retry.",
						);
					}
					accessToken = fresh;
					presignRes = await doPresign(accessToken);
				}
				if (!presignRes.ok) {
					const err = await presignRes.text();
					throw new Error(`Presign failed: ${presignRes.status} ${err}`);
				}
				const presign = await presignRes.json();
				sendProgress(0.1);

				// 2. Extract poster frame at 2 seconds
				const tmpDir = path.join(os.tmpdir(), "coherence-studio-showcase");
				await fs.mkdir(tmpDir, { recursive: true });
				const posterPath = path.join(tmpDir, `${presign.id}-poster.jpg`);

				await new Promise<void>((resolve, reject) => {
					execFile(
						findFfmpegBinary(),
						["-ss", "2", "-i", opts.videoPath, "-frames:v", "1", "-q:v", "2", "-y", posterPath],
						{ timeout: 30000 },
						(err) => (err ? reject(err) : resolve()),
					);
				});
				sendProgress(0.2);

				// 3. Upload video directly to Spaces via presigned URL
				const videoBody = await fs.readFile(opts.videoPath);
				const videoUpRes = await fetch(presign.videoUploadUrl, {
					method: "PUT",
					headers: { "Content-Type": "video/mp4" },
					body: videoBody,
				});
				if (!videoUpRes.ok) throw new Error(`Video upload failed: ${videoUpRes.status}`);
				sendProgress(0.6);

				// 4. Upload poster via presigned URL
				const posterBody = await fs.readFile(posterPath);
				const posterUpRes = await fetch(presign.posterUploadUrl, {
					method: "PUT",
					headers: { "Content-Type": "image/jpeg" },
					body: posterBody,
				});
				if (!posterUpRes.ok) throw new Error(`Poster upload failed: ${posterUpRes.status}`);
				sendProgress(0.8);

				// 5. Publish entry via auth service (updates index.json server-side)
				const publishRes = await fetch(`${baseUrl}/studio/showcase/publish`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						id: presign.id,
						title: opts.title,
						prompt: opts.prompt,
						aesthetic: opts.aesthetic,
						model: opts.model,
						sceneCount: opts.sceneCount,
						durationSec: opts.durationSec,
						videoUrl: presign.videoPublicUrl,
						posterUrl: presign.posterPublicUrl,
					}),
				});
				if (!publishRes.ok) {
					const err = await publishRes.text();
					throw new Error(`Publish failed: ${publishRes.status} ${err}`);
				}
				const result = await publishRes.json();
				sendProgress(1);

				// Cleanup
				await fs.unlink(posterPath).catch(() => {});

				return { success: true, entry: result.entry };
			} catch (err: any) {
				console.error("[Showcase] Upload failed:", err);
				return { success: false, error: err.message || String(err) };
			}
		},
	);
}
