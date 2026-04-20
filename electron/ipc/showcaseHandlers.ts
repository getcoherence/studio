import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BrowserWindow, ipcMain } from "electron";
import { findRemotionFfmpeg } from "../ffmpeg";

// Canonical ffmpeg lookup lives in electron/ffmpeg.ts so every feature
// (export post-process, music merge, whisper, showcase poster) shares the
// same binary and can't drift out of sync.
const findFfmpegBinary = findRemotionFfmpeg;

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

				// 1. Get presigned URLs from auth service.
				//
				// IMPORTANT: we deliberately do NOT attempt a refresh here.
				// Running a refresh from main while the renderer's proLoader is
				// also running one races on a single-use refresh token — the
				// auth service interprets the second POST as replay and revokes
				// the whole session (symptom: 401 on /refresh). The renderer
				// owns refresh via a single in-flight lock, and the caller in
				// SceneEditor catches a 401 here, calls refreshProToken() on
				// the renderer side, and retries the upload with the new
				// token.
				const accessToken = opts.token;
				const presignRes = await fetch(`${baseUrl}/studio/showcase/presign`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
				});
				if (presignRes.status === 401) {
					return { success: false, authFailed: true, error: "auth_expired" };
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
