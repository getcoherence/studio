// Capture source
export interface CaptureSource {
	id: string;
	name: string;
	type: "display" | "window";
	thumbnailDataUrl?: string;
	displayId?: string;
	bounds?: { x: number; y: number; width: number; height: number };
}

// Capture options
export interface CaptureOptions {
	sourceId: string;
	sourceType: "display" | "window";
	fps: number;
	resolution?: { width: number; height: number };
	captureSystemAudio: boolean;
	captureMicrophone: boolean;
	microphoneDeviceId?: string;
}

// Capture backend
export type CaptureBackend = "screencapturekit" | "wgc" | "ffmpeg" | "browser";

// Capture status
export interface CaptureStatus {
	backend: CaptureBackend;
	recording: boolean;
	paused: boolean;
	durationMs: number;
	outputPath?: string;
}

// Capture diagnostics
export interface CaptureDiagnostics {
	backend: CaptureBackend;
	platform: NodeJS.Platform;
	osVersion: string;
	error?: string;
	outputFileSize?: number;
}
