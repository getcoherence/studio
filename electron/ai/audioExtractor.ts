import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

/**
 * Locate the ffmpeg binary. Checks bundled paths first, then falls back to
 * assuming it's available on the system PATH.
 */
function findFfmpegBinary(): string {
	const platform = process.platform;
	const ext = platform === "win32" ? ".exe" : "";

	// Check bundled location inside packaged app
	if (app.isPackaged) {
		const bundled = path.join(process.resourcesPath, "bin", `ffmpeg${ext}`);
		return bundled;
	}

	// Check native/bin/{platform}/ during development
	const devBin = path.join(app.getAppPath(), "native", "bin", platform, `ffmpeg${ext}`);
	// Fall back to system PATH
	return devBin || `ffmpeg${ext}`;
}

/**
 * Extract audio from a video file as 16 kHz mono WAV (the format Whisper expects).
 *
 * @param videoPath  Absolute path to the source video
 * @returns          Absolute path to the temporary WAV file
 */
export async function extractAudio(videoPath: string): Promise<string> {
	const tmpDir = path.join(os.tmpdir(), "coherence-studio-whisper");
	await fs.mkdir(tmpDir, { recursive: true });

	const baseName = path.parse(videoPath).name;
	const wavPath = path.join(tmpDir, `${baseName}-${Date.now()}.wav`);

	const ffmpegBin = findFfmpegBinary();

	// First check if the video has an audio stream
	await new Promise<void>((resolve, reject) => {
		execFile(
			ffmpegBin,
			["-i", videoPath, "-hide_banner"],
			{ timeout: 10_000 },
			(_error, _stdout, stderr) => {
				// ffmpeg -i always exits with error (no output file), but stderr has stream info
				const output = stderr || "";
				if (!output.includes("Audio:")) {
					reject(
						new Error(
							"No audio found in this recording. Record with microphone or system audio enabled to use auto-captions.",
						),
					);
					return;
				}
				resolve();
			},
		);
	});

	const args = [
		"-i",
		videoPath,
		"-ar",
		"16000", // 16 kHz sample rate
		"-ac",
		"1", // mono
		"-c:a",
		"pcm_s16le", // 16-bit signed PCM
		"-y", // overwrite
		wavPath,
	];

	await new Promise<void>((resolve, reject) => {
		execFile(ffmpegBin, args, { timeout: 120_000 }, (error, _stdout, stderr) => {
			if (error) {
				const msg = stderr?.trim() || error.message;
				reject(new Error(`Audio extraction failed: ${msg}`));
				return;
			}
			resolve();
		});
	});

	// Verify the output file exists
	try {
		await fs.access(wavPath);
	} catch {
		throw new Error(`ffmpeg completed but output WAV not found at ${wavPath}`);
	}

	return wavPath;
}

/**
 * Clean up temporary audio files. Safe to call even if the file doesn't exist.
 */
export async function cleanupTempAudio(wavPath: string): Promise<void> {
	try {
		await fs.unlink(wavPath);
	} catch {
		// Ignore – file may already have been cleaned up
	}
}
