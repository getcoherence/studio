/**
 * Types for the native capture pipeline.
 *
 * These are shared between the Electron main process (capture backends)
 * and the renderer process (useScreenRecorder hook / settings UI).
 */

/** Which capture backend is in use. */
export type CaptureBackendId = "screencapturekit" | "wgc" | "ffmpeg" | "browser";

/** User-facing preference stored in settings. */
export type CaptureBackendPreference = "auto" | "native" | "browser";

/** Describes one capturable display or window. */
export interface CaptureSource {
	id: string;
	name: string;
	type: "display" | "window";
	/** Display-specific identifier (matches Electron display_id). */
	displayId?: string;
	/** Base64-encoded thumbnail data-URL (optional). */
	thumbnail?: string | null;
	/** Base64-encoded app icon data-URL (optional, windows only). */
	appIcon?: string | null;
}

/** Options passed to startCapture. */
export interface CaptureOptions {
	/** Source to capture. */
	source: CaptureSource;
	/** Desired output width (pixels). */
	width?: number;
	/** Desired output height (pixels). */
	height?: number;
	/** Desired frame rate. */
	frameRate?: number;
	/** Capture system audio. */
	systemAudio?: boolean;
	/** Output file path override. When omitted, a temp path is generated. */
	outputPath?: string;
}

/** Current state of a capture session. */
export interface CaptureStatus {
	/** Whether a capture is actively recording. */
	recording: boolean;
	/** Whether the capture is paused. */
	paused: boolean;
	/** Which backend is handling the capture. */
	backend: CaptureBackendId;
	/** Absolute path the output file is being written to (if known). */
	outputPath?: string;
	/** Capture start timestamp (ms since epoch). */
	startedAt?: number;
	/** Duration captured so far (ms). */
	durationMs?: number;
}

/**
 * A capture backend must implement this interface.
 * Each backend (ScreenCaptureKit, WGC, FFmpeg) provides a concrete class.
 */
export interface CaptureBackend {
	readonly id: CaptureBackendId;

	/** Check whether this backend is available on the current platform. */
	isAvailable(): Promise<boolean>;

	/** List capturable sources (displays + windows). */
	getSources(): Promise<CaptureSource[]>;

	/** Start a capture session. Resolves once recording has begun. */
	startCapture(options: CaptureOptions): Promise<void>;

	/** Stop the current capture session. Returns the output file path. */
	stopCapture(): Promise<string>;

	/** Pause the current capture (if supported). */
	pauseCapture(): Promise<void>;

	/** Resume a paused capture. */
	resumeCapture(): Promise<void>;

	/** Get the current capture status. */
	getStatus(): CaptureStatus;

	/** Tear down any resources held by this backend. */
	dispose(): void;
}

/** JSON message sent from the Electron main process to the native helper. */
export interface NativeHelperRequest {
	type: "get_sources" | "start" | "stop" | "pause" | "resume" | "ping";
	options?: CaptureOptions;
}

/** JSON message received from the native helper. */
export interface NativeHelperResponse {
	type: "sources" | "started" | "stopped" | "paused" | "resumed" | "pong" | "error";
	sources?: CaptureSource[];
	outputPath?: string;
	error?: string;
}
