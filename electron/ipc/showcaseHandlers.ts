import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BrowserWindow, ipcMain } from "electron";

const BUCKET = "coherence-content-media";
const ENDPOINT = "https://nyc3.digitaloceanspaces.com";
const REGION = "nyc3";
const SHOWCASE_PREFIX = "showcase";
const BASE_URL = `https://${BUCKET}.nyc3.digitaloceanspaces.com/${SHOWCASE_PREFIX}`;

function findFfmpegBinary(): string {
	const { app } = require("electron");
	const ext = process.platform === "win32" ? ".exe" : "";
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "bin", `ffmpeg${ext}`);
	}
	return path.join(app.getAppPath(), "native", "bin", process.platform, `ffmpeg${ext}`);
}

function getS3Client(): S3Client | null {
	const accessKeyId = process.env.SPACES_ACCESS_KEY_ID || "";
	const secretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY || "";
	if (!secretAccessKey) {
		console.warn("[Showcase] No SPACES_SECRET_ACCESS_KEY — upload disabled");
		return null;
	}
	return new S3Client({
		endpoint: ENDPOINT,
		region: REGION,
		credentials: { accessKeyId, secretAccessKey },
	});
}

interface ShowcaseEntry {
	id: string;
	title: string;
	prompt?: string;
	aesthetic?: string;
	model?: string;
	sceneCount?: number;
	durationSec?: number;
	videoUrl: string;
	posterUrl: string;
	author: string;
	createdAt: string;
}

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
				author?: string;
			},
		) => {
			const s3 = getS3Client();
			if (!s3) {
				return { success: false, error: "Spaces credentials not configured" };
			}

			const senderWindow = BrowserWindow.fromWebContents(event.sender);
			const sendProgress = (pct: number) => {
				senderWindow?.webContents.send("showcase-upload-progress", pct);
			};

			try {
				const id = randomUUID().slice(0, 8);
				sendProgress(0.05);

				// 1. Extract poster frame at 2 seconds
				const tmpDir = path.join(os.tmpdir(), "coherence-studio-showcase");
				await fs.mkdir(tmpDir, { recursive: true });
				const posterPath = path.join(tmpDir, `${id}-poster.jpg`);

				await new Promise<void>((resolve, reject) => {
					execFile(
						findFfmpegBinary(),
						["-ss", "2", "-i", opts.videoPath, "-frames:v", "1", "-q:v", "2", "-y", posterPath],
						{ timeout: 30000 },
						(err) => (err ? reject(err) : resolve()),
					);
				});
				sendProgress(0.2);

				// 2. Upload video
				const videoBody = await fs.readFile(opts.videoPath);
				await s3.send(
					new PutObjectCommand({
						Bucket: BUCKET,
						Key: `${SHOWCASE_PREFIX}/${id}.mp4`,
						Body: videoBody,
						ContentType: "video/mp4",
						ACL: "public-read",
					}),
				);
				sendProgress(0.6);

				// 3. Upload poster
				const posterBody = await fs.readFile(posterPath);
				await s3.send(
					new PutObjectCommand({
						Bucket: BUCKET,
						Key: `${SHOWCASE_PREFIX}/${id}-poster.jpg`,
						Body: posterBody,
						ContentType: "image/jpeg",
						ACL: "public-read",
					}),
				);
				sendProgress(0.8);

				// 4. Update index.json manifest
				const entry: ShowcaseEntry = {
					id,
					title: opts.title,
					prompt: opts.prompt,
					aesthetic: opts.aesthetic,
					model: opts.model,
					sceneCount: opts.sceneCount,
					durationSec: opts.durationSec,
					videoUrl: `${BASE_URL}/${id}.mp4`,
					posterUrl: `${BASE_URL}/${id}-poster.jpg`,
					author: opts.author || "Community",
					createdAt: new Date().toISOString(),
				};

				let entries: ShowcaseEntry[] = [];
				try {
					const existing = await s3.send(
						new GetObjectCommand({
							Bucket: BUCKET,
							Key: `${SHOWCASE_PREFIX}/index.json`,
						}),
					);
					const body = await existing.Body?.transformToString();
					if (body) entries = JSON.parse(body);
				} catch {
					// First entry — index.json doesn't exist yet
				}

				entries.unshift(entry);

				await s3.send(
					new PutObjectCommand({
						Bucket: BUCKET,
						Key: `${SHOWCASE_PREFIX}/index.json`,
						Body: JSON.stringify(entries, null, 2),
						ContentType: "application/json",
						ACL: "public-read",
					}),
				);
				sendProgress(1);

				// Cleanup temp poster
				await fs.unlink(posterPath).catch(() => {});

				return { success: true, entry };
			} catch (err: any) {
				console.error("[Showcase] Upload failed:", err);
				return { success: false, error: err.message || String(err) };
			}
		},
	);
}
