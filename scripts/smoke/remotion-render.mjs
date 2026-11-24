#!/usr/bin/env node
// ── Remotion SSR smoke render ────────────────────────────────────────────
//
// Renders ~1 s of the "DynamicVideo" composition to MP4 the same way Create's
// export does (electron/export/remotionExport.ts: bundle → selectComposition
// → renderMedia with an explicit binariesDirectory), without Electron, and
// fails unless the output is a real video.
//
//   npm run smoke:remotion [-- options]
//
// Options (each also settable by env var):
//   --out-dir <dir>              SMOKE_REMOTION_OUT_DIR      where the MP4 goes (default: a temp dir)
//   --bundle <dir>               SMOKE_REMOTION_BUNDLE       reuse a pre-built bundle (e.g. dist-remotion)
//                                                            instead of bundling into a temp dir
//   --binaries-dir <dir>         SMOKE_REMOTION_BINARIES_DIR Remotion compositor dir (remotion, ffmpeg,
//                                                            ffprobe). Default mirrors remotionExport.ts:
//                                                            node_modules/@remotion/compositor-<platform>-<arch>[-msvc|-gnu]
//   --browser-executable <path>  SMOKE_REMOTION_BROWSER_EXECUTABLE
//   --chrome-mode <mode>         SMOKE_REMOTION_CHROME_MODE  "headless-shell" (default) | "chrome-for-testing"
//   --x64-headless-shell         SMOKE_REMOTION_X64_HEADLESS_SHELL=1  (Windows only) fetch the win64
//                                                            Chrome Headless Shell Remotion would use on
//                                                            win32-x64 and use it as the browser
//
// Windows on Arm: Remotion 4.0.448 ships no win32-arm64 compositor, and its
// browser downloader refuses win32-arm64 ("Chrome Headless Shell is not
// available for Windows for arm64"). To test the x64 toolchain under
// emulation from native arm64 Node, point --binaries-dir at a force-installed
// node_modules/@remotion/compositor-win32-x64-msvc and pass --x64-headless-shell.
//
// Exit code 0 only if: the MP4 exists and is > 10 KB; the composition's own
// compile step logged success (so we didn't just render the "SSR Compilation
// Error" fallback); and, when the compositor's ffprobe/ffmpeg can run, the
// file has an h264 video stream of the expected duration and a marker pixel
// of the expected colour.

import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

const FPS = 30;
const DURATION_IN_FRAMES = 30; // 1 second
const MIN_BYTES = 10 * 1024;
const DURATION_TOLERANCE_S = 0.15;
/** Solid marker square drawn on top of everything; sampled to prove the
 *  composition (not the error fallback) was rendered. */
const MARKER = { x: 0, y: 0, size: 160, sampleX: 80, sampleY: 80 };

// AI-composition-style code: a VideoComposition that only references names
// from MODULE_SCOPE (src/lib/remotion/compileCode.ts). Lots of moving,
// colourful tiles so the H.264 output can't compress below MIN_BYTES.
const SMOKE_CODE = `
function VideoComposition({ screenshots }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], { extrapolateRight: "clamp" });
  const tiles = [];
  for (let i = 0; i < 240; i++) {
    const size = 20 + random("s" + i) * 60;
    const speed = 4 + random("v" + i) * 12;
    const hue = Math.floor(random("h" + i) * 360 + frame * 12) % 360;
    tiles.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: (random("x" + i) * width + frame * speed) % width,
          top: random("y" + i) * height,
          width: size,
          height: size,
          borderRadius: size / 4,
          background: "hsl(" + hue + ", 80%, 55%)",
          transform: "rotate(" + (frame * 9 + i) + "deg)",
        }}
      />
    );
  }
  return (
    <AbsoluteFill style={{ backgroundColor: "#101820" }}>
      {tiles}
      <div style={{ position: "absolute", left: ${MARKER.x}, top: ${MARKER.y}, width: ${MARKER.size}, height: ${MARKER.size}, backgroundColor: "#00ff00" }} />
      <div style={{ position: "absolute", left: 40, bottom: 40, color: "#ffffff", fontSize: 64, fontFamily: "sans-serif" }}>
        Remotion smoke - frame {frame} - {Math.round(progress * 100)}%
      </div>
    </AbsoluteFill>
  );
}
`;

function parseArgs(argv) {
	const opts = {
		outDir: process.env.SMOKE_REMOTION_OUT_DIR || null,
		bundle: process.env.SMOKE_REMOTION_BUNDLE || null,
		binariesDir: process.env.SMOKE_REMOTION_BINARIES_DIR || null,
		browserExecutable: process.env.SMOKE_REMOTION_BROWSER_EXECUTABLE || null,
		chromeMode: process.env.SMOKE_REMOTION_CHROME_MODE || "headless-shell",
		x64HeadlessShell: process.env.SMOKE_REMOTION_X64_HEADLESS_SHELL === "1",
	};
	const flags = {
		"--out-dir": "outDir",
		"--bundle": "bundle",
		"--binaries-dir": "binariesDir",
		"--browser-executable": "browserExecutable",
		"--chrome-mode": "chromeMode",
	};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--x64-headless-shell") {
			opts.x64HeadlessShell = true;
			continue;
		}
		const key = flags[argv[i]];
		if (!key || i + 1 >= argv.length) throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
		opts[key] = argv[++i];
	}
	return opts;
}

/** Mirrors getRemotionBinariesDirectory() in electron/export/remotionExport.ts (dev branch). */
function defaultBinariesDirectory() {
	const libcSuffix =
		process.platform === "win32" ? "-msvc" : process.platform === "linux" ? "-gnu" : "";
	const pkg = `compositor-${process.platform}-${process.arch}${libcSuffix}`;
	return path.join(projectRoot, "node_modules", "@remotion", pkg);
}

function exe(binariesDir, name) {
	return path.join(binariesDir, process.platform === "win32" ? `${name}.exe` : name);
}

/** Run a compositor-bundled ffmpeg/ffprobe the way Remotion does (cwd + DYLD path on macOS). */
async function runFf(binariesDir, name, args, options = {}) {
	const bin = exe(binariesDir, name);
	return execFile(bin, args, {
		cwd: binariesDir,
		env:
			process.platform === "darwin"
				? { ...process.env, DYLD_LIBRARY_PATH: binariesDir }
				: process.env,
		maxBuffer: 16 * 1024 * 1024,
		timeout: 60_000,
		...options,
	});
}

function seconds(ms) {
	return `${(ms / 1000).toFixed(1)}s`;
}

/** Chrome version this Remotion release downloads (TESTED_VERSION). Not
 *  exported publicly, so read it from the installed file; fall back to the
 *  value shipped with Remotion 4.0.448. */
function remotionTestedChromeVersion() {
	const file = path.join(
		projectRoot,
		"node_modules/@remotion/renderer/dist/browser/get-chrome-download-url.js",
	);
	try {
		const match = fs.readFileSync(file, "utf-8").match(/TESTED_VERSION\s*=\s*'([\d.]+)'/);
		if (match) return match[1];
	} catch {
		/* fall through */
	}
	return "144.0.7559.20";
}

/**
 * Fetch the win64 Chrome Headless Shell from the same Chrome-for-Testing URL
 * Remotion's own downloader uses on win32-x64, cached in the OS temp dir.
 * Used on Windows on Arm, where Remotion refuses to download a browser; the
 * x64 shell runs under emulation, matching the x64 control leg.
 */
async function fetchX64HeadlessShell() {
	if (process.platform !== "win32") {
		throw new Error("--x64-headless-shell is only meaningful on Windows");
	}
	const version = remotionTestedChromeVersion();
	const cacheDir = path.join(
		os.tmpdir(),
		"studio-remotion-smoke",
		`chrome-headless-shell-win64-${version}`,
	);
	const exePath = path.join(cacheDir, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
	if (fs.existsSync(exePath)) return exePath;

	const url = `https://storage.googleapis.com/chrome-for-testing-public/${version}/win64/chrome-headless-shell-win64.zip`;
	console.log(`[smoke] Downloading x64 Chrome Headless Shell ${version}: ${url}`);
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);
	fs.mkdirSync(cacheDir, { recursive: true });
	const zipPath = path.join(cacheDir, "chrome-headless-shell-win64.zip");
	await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(zipPath));
	// Windows' bundled bsdtar extracts zip files.
	const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
	await execFile(tar, ["-xf", zipPath, "-C", cacheDir]);
	fs.rmSync(zipPath, { force: true });
	if (!fs.existsSync(exePath)) throw new Error(`Extracted archive has no ${exePath}`);
	return exePath;
}

async function main() {
	const started = Date.now();
	const opts = parseArgs(process.argv.slice(2));
	const failures = [];
	const fail = (msg) => {
		failures.push(msg);
		console.error(`[smoke] FAIL: ${msg}`);
	};

	const rendererPkg = JSON.parse(
		fs.readFileSync(
			path.join(projectRoot, "node_modules/@remotion/renderer/package.json"),
			"utf-8",
		),
	);
	console.log("[smoke] Remotion SSR smoke render");
	console.log(
		`  node ${process.version}  process.platform=${process.platform}  process.arch=${process.arch}  os.arch()=${os.arch()}`,
	);
	console.log(`  @remotion/renderer ${rendererPkg.version}`);

	// 1. Compositor binaries — same resolution as the app, with an override.
	const binariesDirectory = path.resolve(opts.binariesDir ?? defaultBinariesDirectory());
	console.log(`  binariesDirectory: ${binariesDirectory}${opts.binariesDir ? " (override)" : ""}`);
	if (!fs.existsSync(exe(binariesDirectory, "remotion"))) {
		console.error(
			`[smoke] No Remotion compositor at ${binariesDirectory}. ` +
				(process.platform === "win32" && process.arch === "arm64"
					? "Remotion ships no win32-arm64 compositor; install @remotion/compositor-win32-x64-msvc " +
						"and pass --binaries-dir / SMOKE_REMOTION_BINARIES_DIR to it."
					: "Is the matching @remotion/compositor-* optional dependency installed?"),
		);
		process.exit(1);
	}
	if (opts.x64HeadlessShell && !opts.browserExecutable) {
		opts.browserExecutable = await fetchX64HeadlessShell();
		opts.chromeMode = "headless-shell";
	}
	if (opts.browserExecutable) {
		console.log(`  browserExecutable: ${opts.browserExecutable} (chromeMode=${opts.chromeMode})`);
	}

	const outDir = path.resolve(
		opts.outDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "studio-remotion-smoke-")),
	);
	fs.mkdirSync(outDir, { recursive: true });
	const outputLocation = path.join(
		outDir,
		`remotion-smoke-${process.platform}-${process.arch}.mp4`,
	);
	if (fs.existsSync(outputLocation)) fs.rmSync(outputLocation);

	const { renderMedia, selectComposition } = await import("@remotion/renderer");

	// 2. Bundle exactly like production (scripts/lib/bundleRemotion.mjs), unless reusing one.
	let serveUrl;
	let tempBundleDir = null;
	let bundleMs = 0;
	if (opts.bundle) {
		serveUrl = path.resolve(opts.bundle);
		console.log(`[smoke] Using existing bundle: ${serveUrl}`);
	} else {
		const { bundleRemotion } = await import("../lib/bundleRemotion.mjs");
		const t = Date.now();
		tempBundleDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-remotion-bundle-"));
		serveUrl = await bundleRemotion({ outDir: tempBundleDir });
		bundleMs = Date.now() - t;
		console.log(`[smoke] Bundled in ${seconds(bundleMs)}`);
	}

	// 3. selectComposition + renderMedia, as remotionExport.ts does.
	// Remotion already echoes browser console output; we only collect it.
	const browserLogs = [];
	const onBrowserLog = (log) => {
		browserLogs.push(log.text);
	};
	const inputProps = { code: SMOKE_CODE, screenshots: [] };
	const browserOptions = {
		binariesDirectory,
		browserExecutable: opts.browserExecutable,
		chromeMode: opts.chromeMode,
		onBrowserLog,
	};

	const renderStarted = Date.now();
	const composition = await selectComposition({
		serveUrl,
		id: "DynamicVideo",
		inputProps,
		...browserOptions,
	});
	composition.durationInFrames = DURATION_IN_FRAMES;
	composition.fps = FPS;
	console.log(
		`[smoke] Rendering ${composition.id}: ${composition.width}x${composition.height}, ` +
			`${composition.durationInFrames} frames @ ${composition.fps}fps → ${outputLocation}`,
	);

	let lastLogged = -1;
	await renderMedia({
		composition,
		serveUrl,
		codec: "h264",
		pixelFormat: "yuv420p",
		outputLocation,
		inputProps,
		...browserOptions,
		onProgress: ({ progress }) => {
			const pct = Math.floor(progress * 4) * 25;
			if (pct > lastLogged) {
				lastLogged = pct;
				console.log(`  render ${pct}%`);
			}
		},
	});
	const renderMs = Date.now() - renderStarted;
	console.log(`[smoke] Rendered in ${seconds(renderMs)}`);

	// 4. Verify.
	if (!fs.existsSync(outputLocation)) {
		fail(`output file missing: ${outputLocation}`);
	} else {
		const size = fs.statSync(outputLocation).size;
		console.log(`[smoke] Output size: ${(size / 1024).toFixed(1)} KB`);
		if (size <= MIN_BYTES) fail(`output is only ${size} bytes (need > ${MIN_BYTES})`);
	}

	if (browserLogs.some((t) => t.includes("[DynamicVideoComposition] Compilation failed"))) {
		fail("DynamicVideoComposition reported a compilation failure (rendered the error fallback)");
	} else if (
		!browserLogs.some((t) => t.includes("[DynamicVideoComposition] Compilation succeeded"))
	) {
		fail("never saw '[DynamicVideoComposition] Compilation succeeded' in the browser logs");
	}

	if (fs.existsSync(outputLocation)) {
		await probe(binariesDirectory, outputLocation, composition, fail);
	}

	if (tempBundleDir) {
		try {
			fs.rmSync(tempBundleDir, { recursive: true, force: true });
		} catch {
			/* best-effort */
		}
	}

	const totalMs = Date.now() - started;
	console.log(
		`[smoke] ${failures.length ? "FAILED" : "PASSED"} in ${seconds(totalMs)} ` +
			`(bundle ${seconds(bundleMs)}, render ${seconds(renderMs)}) — ${process.platform}-${process.arch}`,
	);
	process.exit(failures.length ? 1 : 0);
}

/** Stream/duration check with ffprobe, marker-pixel check with ffmpeg. Skipped if they can't run. */
async function probe(binariesDir, file, composition, fail) {
	let info;
	try {
		const { stdout } = await runFf(binariesDir, "ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"stream=codec_type,codec_name,width,height,nb_frames,duration:format=duration",
			"-of",
			"json",
			file,
		]);
		info = JSON.parse(stdout);
	} catch (err) {
		console.warn(`[smoke] ffprobe unavailable, skipping stream checks: ${err.message}`);
		return;
	}
	const video = (info.streams ?? []).find((s) => s.codec_type === "video");
	if (!video) {
		fail("no video stream in output");
		return;
	}
	const expected = composition.durationInFrames / composition.fps;
	const duration = Number(video.duration ?? info.format?.duration);
	console.log(
		`[smoke] ffprobe: ${video.codec_name} ${video.width}x${video.height}, ` +
			`${video.nb_frames ?? "?"} frames, ${duration}s (expected ${expected}s)`,
	);
	if (video.codec_name !== "h264") fail(`video codec is ${video.codec_name}, expected h264`);
	if (video.width !== composition.width || video.height !== composition.height) {
		fail(
			`video is ${video.width}x${video.height}, expected ${composition.width}x${composition.height}`,
		);
	}
	if (!Number.isFinite(duration) || Math.abs(duration - expected) > DURATION_TOLERANCE_S) {
		fail(`video duration ${duration}s, expected ${expected}s ±${DURATION_TOLERANCE_S}s`);
	}

	// Sample the marker square from a middle frame: proves our composition
	// rendered (the compile-error fallback is a near-black screen).
	// Remotion's ffmpeg is a minimal build (no select filter, no rawvideo
	// muxer), so: input-seek, crop to 1 px, rawvideo codec via image2pipe.
	let pixel;
	try {
		const { stdout } = await runFf(
			binariesDir,
			"ffmpeg",
			[
				"-v",
				"error",
				"-ss",
				String(expected / 2),
				"-i",
				file,
				"-frames:v",
				"1",
				"-vf",
				`crop=1:1:${MARKER.sampleX}:${MARKER.sampleY},format=rgb24`,
				"-c:v",
				"rawvideo",
				"-f",
				"image2pipe",
				"-",
			],
			{ encoding: "buffer" },
		);
		pixel = stdout;
	} catch (err) {
		console.warn(`[smoke] ffmpeg unavailable, skipping pixel check: ${err.message}`);
		return;
	}
	if (pixel.length < 3) {
		fail(`ffmpeg returned ${pixel.length} bytes for the marker pixel, expected 3 (rgb24)`);
		return;
	}
	const [r, g, b] = pixel;
	console.log(`[smoke] marker pixel rgb(${r}, ${g}, ${b}) (expected ~rgb(0, 255, 0))`);
	if (!(g > 200 && r < 80 && b < 80)) fail(`marker pixel is rgb(${r}, ${g}, ${b}), expected green`);
}

main().catch((err) => {
	console.error("[smoke] FAILED with an exception:", err);
	process.exit(1);
});
