/**
 * NativeCaptureBackend — spawns a platform-specific native helper binary
 * and communicates via stdin/stdout JSON messages.
 *
 * The helper binaries are expected at:
 *   native/bin/darwin/lucid-capture   (macOS — ScreenCaptureKit)
 *   native/bin/win32/lucid-capture.exe (Windows — WGC)
 *
 * When the binary is not found the backend reports itself as unavailable so the
 * CaptureManager can fall back to FFmpeg or browser capture.
 */

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type {
	CaptureBackend,
	CaptureBackendId,
	CaptureOptions,
	CaptureSource,
	CaptureStatus,
	NativeHelperRequest,
	NativeHelperResponse,
} from "../../src/lib/native/types";

/** Resolve the expected path to the native helper binary. */
function resolveHelperPath(): string {
	const platform = process.platform; // "darwin" | "win32" | "linux"
	const ext = platform === "win32" ? ".exe" : "";
	const binaryName = `lucid-capture${ext}`;

	// In a packaged app the binaries live alongside the asar in resources/native/bin
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "native", "bin", platform, binaryName);
	}

	// During development look in the project root
	return path.join(app.getAppPath(), "native", "bin", platform, binaryName);
}

export class NativeCaptureBackend implements CaptureBackend {
	readonly id: CaptureBackendId;
	private helperPath: string;
	private process: ChildProcess | null = null;
	private status: CaptureStatus;
	private pendingCallbacks = new Map<
		string,
		{ resolve: (resp: NativeHelperResponse) => void; reject: (err: Error) => void }
	>();
	private responseBuffer = "";

	constructor(backendId: CaptureBackendId) {
		this.id = backendId;
		this.helperPath = resolveHelperPath();
		this.status = {
			recording: false,
			paused: false,
			backend: this.id,
		};
	}

	async isAvailable(): Promise<boolean> {
		try {
			await fs.promises.access(this.helperPath, fs.constants.X_OK);
			return true;
		} catch {
			return false;
		}
	}

	// ---- IPC helpers ----

	private ensureProcess(): ChildProcess {
		if (this.process && !this.process.killed) {
			return this.process;
		}

		const child = spawn(this.helperPath, [], {
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
		});

		child.stdout?.setEncoding("utf-8");
		child.stdout?.on("data", (chunk: string) => this.onStdout(chunk));
		child.stderr?.on("data", (data: Buffer) => {
			console.warn(`[native-capture stderr] ${data.toString()}`);
		});
		child.on("exit", (code) => {
			console.log(`[native-capture] helper exited with code ${code}`);
			this.process = null;
			// Reject all pending callbacks
			for (const [, cb] of this.pendingCallbacks) {
				cb.reject(new Error(`Native helper exited unexpectedly (code ${code})`));
			}
			this.pendingCallbacks.clear();
			this.status.recording = false;
			this.status.paused = false;
		});

		this.process = child;
		return child;
	}

	private onStdout(chunk: string) {
		this.responseBuffer += chunk;

		// The helper writes one JSON object per line
		let newlineIdx: number = this.responseBuffer.indexOf("\n");
		while (newlineIdx !== -1) {
			const line = this.responseBuffer.slice(0, newlineIdx).trim();
			this.responseBuffer = this.responseBuffer.slice(newlineIdx + 1);
			if (!line) continue;

			try {
				const response: NativeHelperResponse = JSON.parse(line);
				this.dispatchResponse(response);
			} catch (err) {
				console.warn("[native-capture] failed to parse helper response:", line, err);
			}
			newlineIdx = this.responseBuffer.indexOf("\n");
		}
	}

	private dispatchResponse(response: NativeHelperResponse) {
		const key = response.type;
		const cb = this.pendingCallbacks.get(key);
		if (cb) {
			this.pendingCallbacks.delete(key);
			if (response.type === "error") {
				cb.reject(new Error(response.error ?? "Unknown native helper error"));
			} else {
				cb.resolve(response);
			}
		}
	}

	private sendRequest(request: NativeHelperRequest): Promise<NativeHelperResponse> {
		return new Promise<NativeHelperResponse>((resolve, reject) => {
			try {
				const child = this.ensureProcess();

				// Map request type to expected response type
				const responseType = this.expectedResponseType(request.type);
				this.pendingCallbacks.set(responseType, { resolve, reject });

				const payload = JSON.stringify(request) + "\n";
				child.stdin?.write(payload, (err) => {
					if (err) {
						this.pendingCallbacks.delete(responseType);
						reject(new Error(`Failed to write to native helper: ${err.message}`));
					}
				});
			} catch (err) {
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	private expectedResponseType(
		requestType: NativeHelperRequest["type"],
	): NativeHelperResponse["type"] {
		switch (requestType) {
			case "get_sources":
				return "sources";
			case "start":
				return "started";
			case "stop":
				return "stopped";
			case "pause":
				return "paused";
			case "resume":
				return "resumed";
			case "ping":
				return "pong";
		}
	}

	// ---- CaptureBackend implementation ----

	async getSources(): Promise<CaptureSource[]> {
		const response = await this.sendRequest({ type: "get_sources" });
		return response.sources ?? [];
	}

	async startCapture(options: CaptureOptions): Promise<void> {
		const outputPath =
			options.outputPath ??
			path.join(app.getPath("userData"), "recordings", `native-recording-${Date.now()}.mp4`);

		await this.sendRequest({
			type: "start",
			options: { ...options, outputPath },
		});

		this.status = {
			recording: true,
			paused: false,
			backend: this.id,
			outputPath,
			startedAt: Date.now(),
		};
	}

	async stopCapture(): Promise<string> {
		const response = await this.sendRequest({ type: "stop" });
		const outputPath = response.outputPath ?? this.status.outputPath ?? "";

		this.status = {
			recording: false,
			paused: false,
			backend: this.id,
			outputPath,
			durationMs: this.status.startedAt ? Date.now() - this.status.startedAt : undefined,
		};

		return outputPath;
	}

	async pauseCapture(): Promise<void> {
		await this.sendRequest({ type: "pause" });
		this.status.paused = true;
	}

	async resumeCapture(): Promise<void> {
		await this.sendRequest({ type: "resume" });
		this.status.paused = false;
	}

	getStatus(): CaptureStatus {
		return { ...this.status };
	}

	dispose(): void {
		if (this.process && !this.process.killed) {
			this.process.kill("SIGTERM");
			this.process = null;
		}
		this.pendingCallbacks.clear();
		this.status = { recording: false, paused: false, backend: this.id };
	}
}
