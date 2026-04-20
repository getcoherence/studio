import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findRemotionFfmpeg } from "../ffmpeg";

// Use the canonical Remotion-compositor ffmpeg lookup. The previous
// `process.resourcesPath/bin/ffmpeg.exe` location was never bundled and
// silently failed in production, breaking Whisper transcription.
const findFfmpegBinary = findRemotionFfmpeg;

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
 * Remux a video to MP4 with fast-start (moov atom at front) so Remotion
 * can seek efficiently. MediaRecorder webm files have metadata at EOF which
 * causes blank frames during playback in the Remotion Player.
 * Returns the path to the remuxed MP4 file.
 */
export async function remuxToFastStartMp4(inputPath: string): Promise<string> {
	const ffmpegBin = findFfmpegBinary();
	const outputPath = inputPath.replace(/\.[^.]+$/, "-faststart.mp4");

	const args = [
		"-i",
		inputPath,
		"-c:v",
		"copy",
		"-c:a",
		"copy",
		"-movflags",
		"+faststart",
		"-y",
		outputPath,
	];

	await new Promise<void>((resolve, reject) => {
		execFile(ffmpegBin, args, { timeout: 300_000 }, (error, _stdout, _stderr) => {
			if (error) {
				// If copy codec fails (webm→mp4 incompatible codecs), re-encode
				const reencodeArgs = [
					"-i",
					inputPath,
					"-c:v",
					"libx264",
					"-preset",
					"fast",
					"-crf",
					"18",
					"-c:a",
					"aac",
					"-movflags",
					"+faststart",
					"-y",
					outputPath,
				];
				execFile(ffmpegBin, reencodeArgs, { timeout: 600_000 }, (err2, _, stderr2) => {
					if (err2) {
						reject(new Error(`Remux failed: ${stderr2?.trim() || err2.message}`));
					} else {
						resolve();
					}
				});
				return;
			}
			resolve();
		});
	});

	await fs.access(outputPath);
	return outputPath;
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
