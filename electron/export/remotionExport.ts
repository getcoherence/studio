// ── Remotion SSR Export ──────────────────────────────────────────────────
//
// Renders AI-generated compositions to H.264 MP4 via headless Chromium.
// Runs entirely in the Electron main process — no UI impact.
//
// Production: uses a pre-bundled webpack output shipped as an extraResource
//             (built by scripts/bundle-remotion.mjs during `npm run build`).
// Development: bundles on-the-fly via @remotion/bundler (cached after first run).
//
// Screenshots are written to temp files and served as static assets within the
// Remotion bundle. This avoids passing megabytes of base64 through inputProps.
//
// Post-processing: Remotion's ffmpeg output uses color metadata (full-range,
// bt470bg) that Windows Media Foundation can't decode. We re-encode with our
// own ffmpeg binary using known-good H.264 settings for universal playback.

import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { app } from "electron";
import { getFfmpegPath } from "../ffmpeg";

const execFile = promisify(execFileCb);

/** Cached bundle location — reused across exports within a session. */
let cachedBundleLocation: string | null = null;

export interface RemotionExportOptions {
	code: string;
	screenshots: string[];
	outputPath: string;
	fps?: number;
	durationInFrames?: number;
	musicPath?: string;
	musicVolume?: number;
	onProgress?: (percent: number) => void;
}

export async function exportWithRemotion(opts: RemotionExportOptions) {
	const {
		code,
		screenshots,
		outputPath,
		fps = 30,
		durationInFrames,
		musicPath,
		musicVolume = 0.25,
		onProgress,
	} = opts;

	// 1. Resolve the serve URL (pre-bundled in prod, on-the-fly in dev)
	const serveUrl = await resolveServeUrl();

	// 2. Write screenshots to the bundle directory as static files.
	const screenshotUrls = await writeScreenshotsToBundle(serveUrl, screenshots);

	console.log(`[remotionExport] Code length: ${code.length}, screenshots: ${screenshots.length}`);

	// 3. Select the DynamicVideo composition
	const inputProps = { code, screenshots: screenshotUrls };

	const composition = await selectComposition({
		serveUrl,
		id: "DynamicVideo",
		inputProps,
	});

	// 4. Override duration if explicitly provided (otherwise calculateMetadata handles it)
	if (durationInFrames && durationInFrames > 0) {
		composition.durationInFrames = durationInFrames;
	}
	composition.fps = fps;

	console.log(
		`[remotionExport] Rendering ${composition.durationInFrames} frames @ ${composition.fps}fps`,
	);

	// 5. Render to a temp file — Remotion's output may not be Windows-compatible
	const tempPath = outputPath.replace(/\.mp4$/i, "_raw.mp4");

	await renderMedia({
		composition,
		serveUrl,
		codec: "h264",
		pixelFormat: "yuv420p",
		outputLocation: tempPath,
		inputProps,
		onProgress: ({ progress }) => {
			// Scale to 0–0.9 so the post-process step gets 0.9–1.0
			onProgress?.(progress * 0.9);
		},
	});

	console.log("[remotionExport] Remotion render complete, post-processing for compatibility...");

	// 6. Re-encode with our ffmpeg for universal playback + mux music in one pass:
	//    - baseline profile (no B-frames, CAVLC — works on every device)
	//    - level 4.0 (safe for 1080p30)
	//    - yuv420p + limited/TV range + bt709 color space
	//    - faststart (moov atom at front)
	//    - CRF 18 (visually lossless quality)
	//    - Music mixed at 25% volume if provided
	await reencodeForCompatibility(tempPath, outputPath, musicPath, musicVolume);
	onProgress?.(1);

	// 7. Clean up temp files
	try {
		fs.unlinkSync(tempPath);
	} catch {
		/* best-effort */
	}
	cleanupScreenshots(serveUrl);

	// 8. Log file details for diagnostics
	await logFileInfo(outputPath);

	console.log("[remotionExport] Export complete:", outputPath);
}

/** Invalidate the cached dev bundle (e.g. after source changes). */
export function invalidateRemotionBundle() {
	cachedBundleLocation = null;
}

// ── Post-processing ─────────────────────────────────────────────────────

async function reencodeForCompatibility(
	inputPath: string,
	outputPath: string,
	musicPath?: string,
	musicVolume = 0.25,
) {
	const ffmpegPath = await getFfmpegPath();
	if (!ffmpegPath) {
		console.warn("[remotionExport] ffmpeg not found, skipping post-process");
		fs.renameSync(inputPath, outputPath);
		return;
	}

	const args: string[] = ["-i", inputPath];

	if (musicPath) {
		args.push("-i", musicPath);
	}

	args.push(
		"-map_metadata",
		"-1",
		"-c:v",
		"libx264",
		"-profile:v",
		"baseline",
		"-level",
		"4.0",
		"-pix_fmt",
		"yuv420p",
		"-crf",
		"18",
		"-preset",
		"fast",
	);

	if (musicPath) {
		args.push(
			"-filter_complex",
			`[1:a]volume=${musicVolume}[aout]`,
			"-map",
			"0:v",
			"-map",
			"[aout]",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-shortest",
		);
	} else {
		args.push("-an");
	}

	args.push("-movflags", "+faststart", "-y", outputPath);

	console.log(`[remotionExport] Post-processing: ffmpeg ${args.join(" ")}`);

	await execFile(ffmpegPath, args, { timeout: 600_000 });
}

async function logFileInfo(filePath: string) {
	try {
		const stat = fs.statSync(filePath);
		console.log(
			`[remotionExport] Output: ${filePath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`,
		);

		const ffmpegPath = await getFfmpegPath();
		if (!ffmpegPath) return;

		// Use ffmpeg -i to get stream info (ffprobe may not be bundled)
		try {
			await execFile(ffmpegPath, ["-i", filePath, "-hide_banner"], { timeout: 10_000 });
		} catch (probeErr: any) {
			// ffmpeg -i always exits with code 1 but prints stream info to stderr
			if (probeErr.stderr) {
				console.log("[remotionExport] File info:\n" + probeErr.stderr);
			}
		}
	} catch (err) {
		console.warn("[remotionExport] Diagnostics failed:", err);
	}
}

// ── Screenshot handling ─────────────────────────────────────────────────

async function writeScreenshotsToBundle(
	bundlePath: string,
	screenshots: string[],
): Promise<string[]> {
	const screenshotDir = path.join(bundlePath, "_screenshots");
	fs.mkdirSync(screenshotDir, { recursive: true });

	const urls: string[] = [];

	for (let i = 0; i < screenshots.length; i++) {
		const dataUrl = screenshots[i];
		if (!dataUrl || !dataUrl.startsWith("data:")) {
			urls.push(dataUrl || "");
			continue;
		}

		const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
		if (!match) {
			urls.push(dataUrl);
			continue;
		}

		const ext = match[1] === "jpeg" ? "jpg" : match[1];
		const buffer = Buffer.from(match[2], "base64");
		const fileName = `screenshot-${i}.${ext}`;
		const filePath = path.join(screenshotDir, fileName);

		fs.writeFileSync(filePath, buffer);
		urls.push(`_screenshots/${fileName}`);
	}

	console.log(`[remotionExport] Wrote ${urls.length} screenshots to ${screenshotDir}`);
	return urls;
}

function cleanupScreenshots(bundlePath: string) {
	const screenshotDir = path.join(bundlePath, "_screenshots");
	try {
		if (fs.existsSync(screenshotDir)) {
			fs.rmSync(screenshotDir, { recursive: true });
		}
	} catch {
		/* best-effort */
	}
}

// ── Bundle resolution ───────────────────────────────────────────────────

async function resolveServeUrl(): Promise<string> {
	if (cachedBundleLocation) return cachedBundleLocation;

	if (app.isPackaged) {
		const preBundledPath = path.join(process.resourcesPath, "remotion-bundle");
		if (fs.existsSync(preBundledPath)) {
			console.log("[remotionExport] Using pre-bundled Remotion project:", preBundledPath);
			cachedBundleLocation = preBundledPath;
			return preBundledPath;
		}
		throw new Error(
			"Pre-bundled Remotion project not found at " +
				preBundledPath +
				". Ensure scripts/bundle-remotion.mjs ran during the build.",
		);
	}

	const entryPoint = path.resolve(app.getAppPath(), "src/lib/remotion/index.ts");
	console.log("[remotionExport] Bundling Remotion project from:", entryPoint);

	const { bundle } = await import("@remotion/bundler");

	cachedBundleLocation = await bundle({
		entryPoint,
		webpackOverride: (config) => {
			config.resolve = config.resolve || {};
			config.resolve.alias = {
				...(config.resolve.alias || {}),
				"@": path.resolve(app.getAppPath(), "src"),
			};
			return config;
		},
	});

	console.log("[remotionExport] Bundle ready at:", cachedBundleLocation);
	return cachedBundleLocation;
}
