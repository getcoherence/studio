// ── Remotion Export IPC Handlers ─────────────────────────────────────────

import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { mainT } from "../i18n";

export function registerExportHandlers(_getMainWindow: () => BrowserWindow | null) {
	ipcMain.handle(
		"export-remotion",
		async (
			event,
			opts: {
				code: string;
				screenshots: string[];
				fps?: number;
				durationInFrames?: number;
				width?: number;
				height?: number;
				fileName?: string;
				musicPath?: string;
				musicVolume?: number;
			},
		) => {
			// Captured here so the catch block can also return them — previously
			// `logs` was declared inside the try and the failure path silently
			// dropped every breadcrumb that would explain why an export crashed.
			const logs: string[] = [];
			const origLog = console.log;
			const origWarn = console.warn;
			const origError = console.error;
			let consolesPatched = false;

			const restoreConsoles = () => {
				if (!consolesPatched) return;
				console.log = origLog;
				console.warn = origWarn;
				console.error = origError;
				consolesPatched = false;
			};

			try {
				const safeName =
					(opts.fileName || "export").replace(/[^a-zA-Z0-9-_ ]/g, "_").trim() || "export";

				// Show save dialog first so user picks destination
				const result = await dialog.showSaveDialog({
					title: mainT("dialogs", "fileDialogs.saveVideo"),
					defaultPath: path.join(app.getPath("downloads"), `${safeName}.mp4`),
					filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return { success: false, canceled: true };
				}

				const outputPath = result.filePath;

				// Lazy-import to avoid loading @remotion/bundler+renderer at startup
				const { exportWithRemotion } = await import("../export/remotionExport");

				// Capture main-process logs for this export so we can ship them
				// back to the renderer DevTools (where the user actually looks).
				// Includes anything tagged [remotionExport] OR [export-remotion],
				// plus a couple of common downstream tags so ffmpeg/bundler errors
				// aren't lost.
				const capture = (...args: unknown[]) => {
					const msg = args
						.map((a) => {
							if (typeof a === "string") return a;
							if (a instanceof Error) return a.stack || a.message;
							try {
								return JSON.stringify(a, null, 2);
							} catch {
								return String(a);
							}
						})
						.join(" ");
					if (
						msg.includes("[remotionExport]") ||
						msg.includes("[export-remotion]") ||
						msg.includes("[ffmpeg]") ||
						msg.includes("[bundler]")
					) {
						logs.push(msg);
					}
				};
				console.log = (...args: unknown[]) => {
					origLog(...args);
					capture(...args);
				};
				console.warn = (...args: unknown[]) => {
					origWarn(...args);
					capture("[warn]", ...args);
				};
				console.error = (...args: unknown[]) => {
					origError(...args);
					capture("[error]", ...args);
				};
				consolesPatched = true;

				try {
					await exportWithRemotion({
						code: opts.code,
						screenshots: opts.screenshots,
						outputPath,
						fps: opts.fps,
						durationInFrames: opts.durationInFrames,
						width: opts.width,
						height: opts.height,
						musicPath: opts.musicPath,
						musicVolume: opts.musicVolume,
						onProgress: (percent) => {
							// Send progress to the window that initiated the export,
							// not whichever window happens to be focused at the time.
							const senderWindow = BrowserWindow.fromWebContents(event.sender);
							if (senderWindow && !senderWindow.isDestroyed()) {
								senderWindow.webContents.send("export-remotion-progress", percent);
							}
						},
					});

					return { success: true, path: outputPath, logs };
				} finally {
					restoreConsoles();
				}
			} catch (error) {
				// Restore consoles before logging the failure so the error itself
				// goes to the real console (and not back through the capture).
				restoreConsoles();
				const message = error instanceof Error ? error.message : String(error);
				const stack = error instanceof Error ? error.stack : undefined;
				console.error("[export-remotion] Failed:", error);
				// Push the error onto logs so the renderer can show it inside
				// the same diagnostics group as the breadcrumbs.
				logs.push(`[export-remotion] FAILED: ${message}`);
				if (stack) logs.push(stack);
				return {
					success: false,
					error: message,
					stack,
					logs,
				};
			}
		},
	);
}
