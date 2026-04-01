/**
 * FFmpeg-based screen capture backend (fallback).
 *
 * Uses FFmpeg to capture the screen or a specific window, encoding to H.264 MP4.
 * This is the universal fallback when native helpers (ScreenCaptureKit / WGC) are
 * not available.
 *
 * FFmpeg binary discovery order:
 *  1. Bundled in the app resources: resources/ffmpeg/ffmpeg[.exe]
 *  2. On the system PATH
 */

import { type ChildProcess, execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type {
	CaptureBackend,
	CaptureBackendId,
	CaptureOptions,
	CaptureSource,
	CaptureStatus,
} from "../../src/lib/native/types";

// ---------------------------------------------------------------------------
// FFmpeg binary resolution
// ---------------------------------------------------------------------------

function ffmpegBinaryName(): string {
	return process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

/** Try to find a usable ffmpeg binary. Returns the absolute path or null. */
async function findFfmpeg(): Promise<string | null> {
	const name = ffmpegBinaryName();

	// 1. Bundled alongside the app
	const bundledPaths = [
		path.join(process.resourcesPath ?? "", "ffmpeg", name),
		path.join(app.getAppPath(), "ffmpeg", name),
	];

	for (const p of bundledPaths) {
		try {
			await fs.promises.access(p, fs.constants.X_OK);
			return p;
		} catch {
			// Not found, continue
		}
	}

	// 2. System PATH — check by running `ffmpeg -version`
	return new Promise<string | null>((resolve) => {
		execFile(name, ["-version"], (err) => {
			resolve(err ? null : name);
		});
	});
}

// ---------------------------------------------------------------------------
// Platform-specific capture input arguments
// ---------------------------------------------------------------------------

function buildInputArgs(options: CaptureOptions): string[] {
	const platform = process.platform;

	if (platform === "darwin") {
		// macOS: use AVFoundation
		// Display index 0 = main display. FFmpeg avfoundation uses "screen index" for video.
		const videoInput = options.source.type === "display" ? "1" : "1";
		const audioInput = options.systemAudio ? ":0" : "";
		return [
			"-f",
			"avfoundation",
			"-framerate",
			String(options.frameRate ?? 30),
			"-capture_cursor",
			"1",
			"-i",
			`${videoInput}${audioInput}`,
		];
	}

	if (platform === "win32") {
		// Windows: use gdigrab (desktop) or dshow
		if (options.source.type === "window") {
			return [
				"-f",
				"gdigrab",
				"-framerate",
				String(options.frameRate ?? 30),
				"-i",
				`title=${options.source.name}`,
			];
		}
		return ["-f", "gdigrab", "-framerate", String(options.frameRate ?? 30), "-i", "desktop"];
	}

	// Linux: use x11grab
	return [
		"-f",
		"x11grab",
		"-framerate",
		String(options.frameRate ?? 30),
		"-video_size",
		`${options.width ?? 1920}x${options.height ?? 1080}`,
		"-i",
		":0.0",
	];
}

// ---------------------------------------------------------------------------
// FFmpegCaptureBackend
// ---------------------------------------------------------------------------

export class FFmpegCaptureBackend implements CaptureBackend {
	readonly id: CaptureBackendId = "ffmpeg";
	private ffmpegPath: string | null = null;
	private process: ChildProcess | null = null;
	private status: CaptureStatus = {
		recording: false,
		paused: false,
		backend: "ffmpeg",
	};

	async isAvailable(): Promise<boolean> {
		this.ffmpegPath = await findFfmpeg();
		return this.ffmpegPath !== null;
	}

	async getSources(): Promise<CaptureSource[]> {
		// FFmpeg cannot enumerate sources portably. Return a single "entire screen" entry.
		return [
			{
				id: "ffmpeg-screen-0",
				name: "Entire Screen",
				type: "display",
				displayId: "0",
			},
		];
	}

	async startCapture(options: CaptureOptions): Promise<void> {
		if (!this.ffmpegPath) {
			throw new Error("FFmpeg binary not found");
		}

		const outputPath =
			options.outputPath ??
			path.join(app.getPath("userData"), "recordings", `ffmpeg-recording-${Date.now()}.mp4`);

		const inputArgs = buildInputArgs(options);

		const args = [
			// Overwrite without asking
			"-y",
			// Input
			...inputArgs,
			// Video encoding
			"-c:v",
			"libx264",
			"-preset",
			"ultrafast",
			"-crf",
			"18",
			"-pix_fmt",
			"yuv420p",
			// Output
			outputPath,
		];

		return new Promise<void>((resolve, reject) => {
			const child = spawn(this.ffmpegPath!, args, {
				stdio: ["pipe", "pipe", "pipe"],
			});

			let started = false;

			child.stderr?.setEncoding("utf-8");
			child.stderr?.on("data", (data: string) => {
				// FFmpeg writes progress to stderr. Once we see frame output, recording has started.
				if (!started && (data.includes("frame=") || data.includes("Output #0"))) {
					started = true;
					resolve();
				}
			});

			child.on("error", (err) => {
				if (!started) {
					reject(err);
				}
			});

			child.on("exit", (code) => {
				if (!started) {
					reject(new Error(`FFmpeg exited before recording started (code ${code})`));
				}
				this.process = null;
				this.status.recording = false;
				this.status.paused = false;
			});

			this.process = child;
			this.status = {
				recording: true,
				paused: false,
				backend: "ffmpeg",
				outputPath,
				startedAt: Date.now(),
			};

			// If FFmpeg takes a while to report progress, resolve after a short timeout
			setTimeout(() => {
				if (!started) {
					started = true;
					resolve();
				}
			}, 3000);
		});
	}

	async stopCapture(): Promise<string> {
		const outputPath = this.status.outputPath ?? "";

		if (this.process && !this.process.killed) {
			// Sending 'q' to FFmpeg's stdin triggers a graceful stop
			this.process.stdin?.write("q");

			await new Promise<void>((resolve) => {
				const timeout = setTimeout(() => {
					// Force kill if it hasn't stopped after 5 seconds
					if (this.process && !this.process.killed) {
						this.process.kill("SIGKILL");
					}
					resolve();
				}, 5000);

				this.process?.on("exit", () => {
					clearTimeout(timeout);
					resolve();
				});
			});
		}

		this.process = null;
		this.status = {
			recording: false,
			paused: false,
			backend: "ffmpeg",
			outputPath,
			durationMs: this.status.startedAt ? Date.now() - this.status.startedAt : undefined,
		};

		return outputPath;
	}

	async pauseCapture(): Promise<void> {
		// FFmpeg doesn't natively support pause. We send SIGSTOP on Unix.
		if (this.process && process.platform !== "win32") {
			this.process.kill("SIGSTOP");
			this.status.paused = true;
		}
	}

	async resumeCapture(): Promise<void> {
		if (this.process && process.platform !== "win32") {
			this.process.kill("SIGCONT");
			this.status.paused = false;
		}
	}

	getStatus(): CaptureStatus {
		return { ...this.status };
	}

	dispose(): void {
		if (this.process && !this.process.killed) {
			this.process.kill("SIGKILL");
			this.process = null;
		}
		this.status = { recording: false, paused: false, backend: "ffmpeg" };
	}
}
