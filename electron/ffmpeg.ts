import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

/**
 * Resolves the path to the FFmpeg binary.
 *
 * Priority:
 * 1. Bundled binary in app resources (for packaged app)
 * 2. System FFmpeg on PATH
 * 3. null if not found
 */
export async function getFfmpegPath(): Promise<string | null> {
	// Check bundled binary first (in extraResources)
	const bundledPath = getBundledFfmpegPath();
	if (bundledPath) {
		try {
			await fs.access(bundledPath);
			return bundledPath;
		} catch {
			// Bundled binary not found, fall through
		}
	}

	// Check system PATH
	const systemPath = await findSystemFfmpeg();
	if (systemPath) return systemPath;

	return null;
}

function getBundledFfmpegPath(): string | null {
	const platform = process.platform;
	const binaryName = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

	// In development — check native/bin/{platform}/
	if (!app.isPackaged) {
		const devPath = path.join(
			app.getAppPath(),
			"native",
			"bin",
			platform === "win32" ? "win32" : platform === "darwin" ? "darwin" : "linux",
			binaryName,
		);
		return devPath;
	}

	// In packaged app — extraResources
	const resourcesPath = process.resourcesPath;
	return path.join(resourcesPath, "ffmpeg", binaryName);
}

/**
 * Merge a video file with an audio file using ffmpeg.
 * The audio is mixed at the specified volume and trimmed to the video duration.
 */
export async function mergeVideoWithAudio(
	videoPath: string,
	audioPath: string,
	outputPath: string,
	audioVolume = 0.25,
): Promise<{ success: boolean; error?: string }> {
	const ffmpegPath = await getFfmpegPath();
	if (!ffmpegPath) {
		return { success: false, error: "FFmpeg not found" };
	}

	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFileAsync = promisify(execFile);

	// Determine audio codec from output extension — WebM needs libopus, MP4 needs AAC
	const isWebm = outputPath.toLowerCase().endsWith(".webm");
	const audioCodec = isWebm ? "libopus" : "aac";
	const audioBitrate = isWebm ? "128k" : "192k";

	// Try simple merge first (video likely has no audio from html2canvas export)
	try {
		await execFileAsync(
			ffmpegPath,
			[
				"-i",
				videoPath,
				"-i",
				audioPath,
				"-filter_complex",
				`[1:a]volume=${audioVolume}[aout]`,
				"-map",
				"0:v",
				"-map",
				"[aout]",
				"-c:v",
				"copy",
				"-c:a",
				audioCodec,
				"-b:a",
				audioBitrate,
				"-shortest",
				"-y",
				outputPath,
			],
			{ timeout: 120_000 },
		);
		return { success: true };
	} catch (err1) {
		console.error("[FFmpeg] Simple merge failed:", err1);
		// Fallback: try with amix in case video has an audio track
		try {
			await execFileAsync(
				ffmpegPath,
				[
					"-i",
					videoPath,
					"-i",
					audioPath,
					"-filter_complex",
					`[1:a]volume=${audioVolume}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3[aout]`,
					"-map",
					"0:v",
					"-map",
					"[aout]",
					"-c:v",
					"copy",
					"-c:a",
					audioCodec,
					"-b:a",
					audioBitrate,
					"-shortest",
					"-y",
					outputPath,
				],
				{ timeout: 120_000 },
			);
			return { success: true };
		} catch (err2) {
			console.error("[FFmpeg] Amix merge also failed:", err2);
			return { success: false, error: `FFmpeg merge failed: ${err2}` };
		}
	}
}

async function findSystemFfmpeg(): Promise<string | null> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFileAsync = promisify(execFile);

	try {
		const cmd = process.platform === "win32" ? "where" : "which";
		const { stdout } = await execFileAsync(cmd, ["ffmpeg"]);
		const ffmpegPath = stdout.trim().split("\n")[0]?.trim();
		if (ffmpegPath) return ffmpegPath;
	} catch {
		// FFmpeg not on PATH
	}

	return null;
}
