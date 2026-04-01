/**
 * IPC handlers for the native capture pipeline.
 *
 * Registered alongside the existing handlers in electron/main.ts.
 * All channels are prefixed with "native-" to distinguish them from
 * the existing browser-based recording flow.
 */

import { ipcMain } from "electron";
import type { CaptureOptions, CaptureSource } from "../../src/lib/native/types";
import { getCaptureManager } from "../capture/captureManager";

export function registerCaptureHandlers(): void {
	const manager = getCaptureManager();

	// Lazily initialize the capture manager on first use
	let initPromise: Promise<void> | null = null;
	async function ensureInitialized() {
		if (!initPromise) {
			initPromise = manager.initialize().then(() => undefined);
		}
		await initPromise;
	}

	/**
	 * Returns the list of capturable sources (displays and windows)
	 * from the native backend, or an empty array if no native backend
	 * is available.
	 */
	ipcMain.handle("native-get-sources", async () => {
		try {
			await ensureInitialized();

			if (!manager.hasNativeBackend()) {
				return { success: true, sources: [] as CaptureSource[] };
			}

			const sources = await manager.getSources();
			return { success: true, sources };
		} catch (error) {
			console.error("[native-get-sources]", error);
			return {
				success: false,
				sources: [] as CaptureSource[],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});

	/**
	 * Start a native capture session.
	 */
	ipcMain.handle("native-start-capture", async (_, options: CaptureOptions) => {
		try {
			await ensureInitialized();

			if (!manager.hasNativeBackend()) {
				return {
					success: false,
					error: "No native capture backend available",
				};
			}

			await manager.startCapture(options);
			return { success: true };
		} catch (error) {
			console.error("[native-start-capture]", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});

	/**
	 * Stop the current native capture session. Returns the output file path.
	 */
	ipcMain.handle("native-stop-capture", async () => {
		try {
			await ensureInitialized();

			if (!manager.hasNativeBackend()) {
				return {
					success: false,
					error: "No native capture backend available",
				};
			}

			const outputPath = await manager.stopCapture();
			return { success: true, outputPath };
		} catch (error) {
			console.error("[native-stop-capture]", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});

	/**
	 * Pause the current native capture session.
	 */
	ipcMain.handle("native-pause-capture", async () => {
		try {
			await ensureInitialized();
			await manager.pauseCapture();
			return { success: true };
		} catch (error) {
			console.error("[native-pause-capture]", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});

	/**
	 * Resume the current native capture session.
	 */
	ipcMain.handle("native-resume-capture", async () => {
		try {
			await ensureInitialized();
			await manager.resumeCapture();
			return { success: true };
		} catch (error) {
			console.error("[native-resume-capture]", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});

	/**
	 * Returns the current capture status.
	 */
	ipcMain.handle("native-get-capture-status", async () => {
		try {
			await ensureInitialized();
			const status = manager.getStatus();
			return { success: true, status };
		} catch (error) {
			console.error("[native-get-capture-status]", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});

	/**
	 * Returns which capture backend is currently active.
	 */
	ipcMain.handle("native-get-backend", async () => {
		try {
			await ensureInitialized();
			return {
				success: true,
				backend: manager.getBackendId(),
				hasNative: manager.hasNativeBackend(),
			};
		} catch (error) {
			console.error("[native-get-backend]", error);
			return {
				success: false,
				backend: "browser" as const,
				hasNative: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});
}
