/**
 * CaptureManager — orchestrates native, FFmpeg, and browser capture backends.
 *
 * Platform detection:
 *   macOS 12+  → ScreenCaptureKit (native helper)
 *   Win 10 19041+ → Windows Graphics Capture (native helper)
 *   Fallback   → FFmpeg, then browser-based desktopCapturer
 *
 * The manager tries backends in priority order and settles on the first one
 * that reports itself as available.
 */

import os from "node:os";
import type {
	CaptureBackend,
	CaptureBackendId,
	CaptureOptions,
	CaptureSource,
	CaptureStatus,
} from "../../src/lib/native/types";
import { FFmpegCaptureBackend } from "./ffmpegCapture";
import { NativeCaptureBackend } from "./nativeCapture";

// ---------------------------------------------------------------------------
// Platform version detection
// ---------------------------------------------------------------------------

/** macOS 12 (Monterey) introduced ScreenCaptureKit. */
function isMacOSMontereyOrLater(): boolean {
	if (process.platform !== "darwin") return false;
	const [major] = os.release().split(".").map(Number);
	// Darwin 21 = macOS 12 Monterey
	return major >= 21;
}

/** Windows 10 build 19041 introduced Windows.Graphics.Capture. */
function isWindows10_19041OrLater(): boolean {
	if (process.platform !== "win32") return false;
	const [major, , build] = os.release().split(".").map(Number);
	return major >= 10 && build >= 19041;
}

// ---------------------------------------------------------------------------
// CaptureManager
// ---------------------------------------------------------------------------

export class CaptureManager {
	private backend: CaptureBackend | null = null;
	/**
	 * Determine the best available backend.
	 * Must be called before any other method.
	 */
	async initialize(): Promise<CaptureBackendId> {
		// Build candidate list in priority order
		const candidates: CaptureBackend[] = [];

		if (isMacOSMontereyOrLater()) {
			candidates.push(new NativeCaptureBackend("screencapturekit"));
		} else if (isWindows10_19041OrLater()) {
			candidates.push(new NativeCaptureBackend("wgc"));
		}

		candidates.push(new FFmpegCaptureBackend());

		for (const candidate of candidates) {
			try {
				const available = await candidate.isAvailable();
				if (available) {
					this.backend = candidate;
					console.log(`[CaptureManager] Using backend: ${candidate.id}`);
					return candidate.id;
				}
			} catch (err) {
				console.warn(`[CaptureManager] Backend ${candidate.id} availability check failed:`, err);
			}
		}

		// No native/FFmpeg backend available — the renderer will use browser capture
		console.log("[CaptureManager] No native backend available — falling back to browser capture");
		return "browser";
	}

	/** The currently active backend, or null if using browser fallback. */
	getBackend(): CaptureBackend | null {
		return this.backend;
	}

	/** Which backend is active. */
	getBackendId(): CaptureBackendId {
		return this.backend?.id ?? "browser";
	}

	/** Whether a non-browser backend is available. */
	hasNativeBackend(): boolean {
		return this.backend !== null;
	}

	/** List capturable sources via the active backend. */
	async getSources(): Promise<CaptureSource[]> {
		if (!this.backend) {
			throw new Error("No native capture backend available");
		}
		return this.backend.getSources();
	}

	/** Start capturing. */
	async startCapture(options: CaptureOptions): Promise<void> {
		if (!this.backend) {
			throw new Error("No native capture backend available");
		}
		return this.backend.startCapture(options);
	}

	/** Stop capturing. Returns the output file path. */
	async stopCapture(): Promise<string> {
		if (!this.backend) {
			throw new Error("No native capture backend available");
		}
		return this.backend.stopCapture();
	}

	/** Pause the current capture. */
	async pauseCapture(): Promise<void> {
		if (!this.backend) {
			throw new Error("No native capture backend available");
		}
		return this.backend.pauseCapture();
	}

	/** Resume a paused capture. */
	async resumeCapture(): Promise<void> {
		if (!this.backend) {
			throw new Error("No native capture backend available");
		}
		return this.backend.resumeCapture();
	}

	/** Get the current capture status. */
	getStatus(): CaptureStatus {
		if (!this.backend) {
			return { recording: false, paused: false, backend: "browser" };
		}
		return this.backend.getStatus();
	}

	/** Tear down the active backend. */
	dispose(): void {
		this.backend?.dispose();
		this.backend = null;
	}
}

/** Singleton instance shared by IPC handlers. */
let _instance: CaptureManager | null = null;

export function getCaptureManager(): CaptureManager {
	if (!_instance) {
		_instance = new CaptureManager();
	}
	return _instance;
}
