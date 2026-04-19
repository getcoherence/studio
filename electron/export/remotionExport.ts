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

/**
 * Resolve the directory containing Remotion's native binaries (remotion.exe,
 * ffmpeg.exe, ffprobe.exe). Remotion's internal resolution uses
 * require.resolve("@remotion/compositor-...") which returns the asar path
 * in a packaged Electron app — spawn() can't execute from inside asar.
 * electron-builder's asarUnpack copies them to app.asar.unpacked; we point
 * Remotion at that directory explicitly via the binariesDirectory option.
 */
function getRemotionBinariesDirectory(): string {
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
	return path.join(base, "@remotion", pkg);
}

const execFile = promisify(execFileCb);

/** Cached bundle location — reused across exports within a session. */
let cachedBundleLocation: string | null = null;

export interface RemotionExportOptions {
	code: string;
	screenshots: string[];
	outputPath: string;
	fps?: number;
	durationInFrames?: number;
	width?: number;
	height?: number;
	musicPath?: string;
	musicVolume?: number;
	onProgress?: (percent: number) => void;
}

export async function exportWithRemotion(opts: RemotionExportOptions) {
	const {
		code: rawCode,
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

	// 2. The studio:// custom protocol only exists in the renderer process
	//    where we registered it. The headless Chromium that Remotion's
	//    renderer spawns has no idea what studio:// is, AND it can't fetch
	//    arbitrary absolute paths either — Remotion prepends file:/// and
	//    routes everything through its HTTP downloader, which only accepts
	//    http/https. The pattern that DOES work is the same one we use for
	//    screenshots: copy the asset into the bundle directory (which
	//    Remotion serves as a static HTTP root) and reference it via a
	//    relative path. So we walk every studio://file/ URL in the code,
	//    copy each file into <bundle>/_external_assets/, and rewrite the
	//    URL to a relative path.
	const { code, copiedCount } = await copyExternalAssetsIntoBundle(rawCode, serveUrl);
	if (copiedCount > 0) {
		console.log(
			`[remotionExport] Copied ${copiedCount} external asset(s) into bundle and rewrote URLs`,
		);
	}

	// 3. Write screenshots to the bundle directory as static files. If any
	//    screenshot is a studio:// URL (rare but possible), rewrite it too.
	const screenshotUrls = (await writeScreenshotsToBundle(serveUrl, screenshots)).map((url) =>
		rewriteStudioUrls(url),
	);

	console.log(`[remotionExport] Code length: ${code.length}, screenshots: ${screenshots.length}`);

	// 4. Select the DynamicVideo composition
	const inputProps = { code, screenshots: screenshotUrls };

	const binariesDirectory = getRemotionBinariesDirectory();

	const composition = await selectComposition({
		serveUrl,
		id: "DynamicVideo",
		inputProps,
		binariesDirectory,
	});

	// 5. Override duration/resolution if explicitly provided
	if (durationInFrames && durationInFrames > 0) {
		composition.durationInFrames = durationInFrames;
	}
	composition.fps = fps;
	if (opts.width) composition.width = opts.width;
	if (opts.height) composition.height = opts.height;

	console.log(
		`[remotionExport] Rendering ${composition.durationInFrames} frames @ ${composition.fps}fps`,
	);

	// 6. Render to a temp file — Remotion's output may not be Windows-compatible
	const tempPath = outputPath.replace(/\.mp4$/i, "_raw.mp4");

	await renderMedia({
		composition,
		serveUrl,
		codec: "h264",
		pixelFormat: "yuv420p",
		outputLocation: tempPath,
		inputProps,
		binariesDirectory,
		onProgress: ({ progress }) => {
			// Scale to 0–0.9 so the post-process step gets 0.9–1.0
			onProgress?.(progress * 0.9);
		},
	});

	console.log("[remotionExport] Remotion render complete, post-processing for compatibility...");

	// 7. Re-encode with our ffmpeg for universal playback + mux music in one pass:
	//    - baseline profile (no B-frames, CAVLC — works on every device)
	//    - level 4.0 (safe for 1080p30)
	//    - yuv420p + limited/TV range + bt709 color space
	//    - faststart (moov atom at front)
	//    - CRF 18 (visually lossless quality)
	//    - Music mixed at 25% volume if provided
	await reencodeForCompatibility(tempPath, outputPath, musicPath, musicVolume);
	onProgress?.(1);

	// 8. Clean up temp files
	try {
		fs.unlinkSync(tempPath);
	} catch {
		/* best-effort */
	}
	cleanupScreenshots(serveUrl);
	cleanupExternalAssets(serveUrl);

	// 9. Log file details for diagnostics
	await logFileInfo(outputPath);

	console.log("[remotionExport] Export complete:", outputPath);
}

/** Invalidate the cached dev bundle (e.g. after source changes). */
export function invalidateRemotionBundle() {
	cachedBundleLocation = null;
}

const EXTERNAL_ASSETS_SUBDIR = "_external_assets";

/** Walk the AI-generated code, copy every asset referenced by a
 *  `studio://file/<abs-path>` URL into <bundlePath>/_external_assets/, and
 *  rewrite the URL to a relative path that Remotion's static server can
 *  resolve. This is the only path that actually works for arbitrary local
 *  files: Remotion's downloader can't handle bare absolute paths, can't
 *  handle file:// URLs, and obviously doesn't know about studio://. But
 *  files INSIDE the bundle directory are served as static HTTP assets
 *  during render, the same way we already do for screenshots. */
async function copyExternalAssetsIntoBundle(
	code: string,
	bundlePath: string,
): Promise<{ code: string; copiedCount: number }> {
	if (!code.includes("studio://file/")) return { code, copiedCount: 0 };

	const targetDir = path.join(bundlePath, EXTERNAL_ASSETS_SUBDIR);
	fs.mkdirSync(targetDir, { recursive: true });

	// Collect unique asset paths first so we don't copy the same file twice
	// when it's referenced by multiple <Audio> elements.
	const uniquePaths = new Set<string>();
	for (const match of code.matchAll(/studio:\/\/file\/([^"'\s)]+)/g)) {
		uniquePaths.add(match[1]);
	}

	const replacements = new Map<string, string>();
	let copiedCount = 0;
	let nextIndex = 0;

	for (const rawPath of uniquePaths) {
		// Strip any leading slashes from "/C:/..." → "C:/..."
		const absPath = rawPath.replace(/^\/+/, "");

		if (!fs.existsSync(absPath)) {
			console.warn(`[remotionExport] external asset not found, skipping: ${absPath}`);
			continue;
		}

		// Generate a collision-free filename. Narration mp3s already have
		// timestamps but we add an index suffix anyway as a guarantee.
		const ext = path.extname(absPath);
		const base = path.basename(absPath, ext);
		const uniqueName = `${base}-${nextIndex++}${ext}`;
		const destPath = path.join(targetDir, uniqueName);

		try {
			fs.copyFileSync(absPath, destPath);
			copiedCount++;
			replacements.set(rawPath, `${EXTERNAL_ASSETS_SUBDIR}/${uniqueName}`);
		} catch (err) {
			console.warn(`[remotionExport] failed to copy ${absPath}:`, err);
		}
	}

	// Single-pass replacement using the captured map. Anything that wasn't
	// successfully copied falls back to the bare path (best effort — it'll
	// still fail in Remotion but the diagnostics group will tell us which
	// file was missing).
	const rewritten = code.replace(/studio:\/\/file\/([^"'\s)]+)/g, (_match, p1) => {
		const replacement = replacements.get(p1);
		return replacement ?? p1.replace(/^\/+/, "");
	});

	return { code: rewritten, copiedCount };
}

function cleanupExternalAssets(bundlePath: string) {
	const dir = path.join(bundlePath, EXTERNAL_ASSETS_SUBDIR);
	try {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true });
		}
	} catch {
		/* best-effort */
	}
}

/** Fallback rewrite for screenshot URLs that may have come in as
 *  `studio://file/...`. Strips the scheme and any leading slashes so the
 *  bare path can be used. Used only for screenshots — code references go
 *  through `copyExternalAssetsIntoBundle` instead. */
function rewriteStudioUrls(input: string): string {
	if (!input.includes("studio://file/")) return input;
	return input.replace(/studio:\/\/file\/([^"'\s)]+)/g, (_match, p1) => {
		return p1.replace(/^\/+/, "");
	});
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

	// The Remotion output (input 0) always contains an audio stream — even
	// when the composition has no <Audio> elements, Remotion emits a silent
	// track. When the scene plan has narration + SFX, those are in [0:a].
	// When music is also provided, we amix Remotion audio with music.
	const hasRemotionAudio = await checkForAudioStream(inputPath, ffmpegPath);
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

	// Audio handling — 4 cases:
	// 1. Remotion audio + music → amix both (narration/SFX at 1.0, music ducked)
	// 2. Remotion audio only → map through
	// 3. Music only → use music as the audio track
	// 4. Neither → silent output (-an)
	if (hasRemotionAudio && musicPath) {
		args.push(
			"-filter_complex",
			`[0:a]volume=1.0[narr];[1:a]volume=${musicVolume}[mus];[narr][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`,
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
	} else if (hasRemotionAudio) {
		args.push("-map", "0:v", "-map", "0:a", "-c:a", "aac", "-b:a", "192k");
	} else if (musicPath) {
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

	console.log(
		`[remotionExport] Post-processing (remotion-audio=${hasRemotionAudio}, music=${!!musicPath}): ffmpeg ${args.join(" ")}`,
	);

	await execFile(ffmpegPath, args, { timeout: 600_000 });
}

/** Probe a file with ffmpeg -i to detect whether it has an audio stream.
 *  ffmpeg prints stream info to stderr and always exits with code 1 when
 *  given no output file, so we parse stderr instead of checking exit code. */
async function checkForAudioStream(filePath: string, ffmpegPath: string): Promise<boolean> {
	try {
		await execFile(ffmpegPath, ["-i", filePath, "-hide_banner"], { timeout: 10_000 });
		return false;
	} catch (err: any) {
		const stderr = String(err?.stderr || "");
		// Match "Stream #0:1(und): Audio: aac" or similar
		return /Stream #\d+:\d+[^:]*: Audio:/i.test(stderr);
	}
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
