// ── Remotion Export IPC Handlers ─────────────────────────────────────────

import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { mainT } from "../i18n";

export function registerExportHandlers(getMainWindow: () => BrowserWindow | null) {
	ipcMain.handle(
		"export-remotion",
		async (
			_event,
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

				const logs: string[] = [];
				const origLog = console.log;
				const origWarn = console.warn;
				const origError = console.error;
				// Capture main process logs for this export
				const capture = (...args: unknown[]) => {
					const msg = args
						.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
						.join(" ");
					if (msg.includes("[remotionExport]")) logs.push(msg);
				};
				console.log = (...args: unknown[]) => {
					origLog(...args);
					capture(...args);
				};
				console.warn = (...args: unknown[]) => {
					origWarn(...args);
					capture(...args);
				};
				console.error = (...args: unknown[]) => {
					origError(...args);
					capture(...args);
				};

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
							const win = getMainWindow();
							if (win && !win.isDestroyed()) {
								win.webContents.send("export-remotion-progress", percent);
							}
						},
					});

					return { success: true, path: outputPath, logs };
				} finally {
					console.log = origLog;
					console.warn = origWarn;
					console.error = origError;
				}
			} catch (error) {
				console.error("[export-remotion] Failed:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);
}
