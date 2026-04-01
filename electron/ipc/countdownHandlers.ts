import { BrowserWindow, ipcMain } from "electron";
import { createCountdownWindow } from "../windows";

let countdownWindow: BrowserWindow | null = null;

export function registerCountdownHandlers() {
	ipcMain.handle("show-countdown", () => {
		if (countdownWindow && !countdownWindow.isDestroyed()) {
			countdownWindow.close();
		}

		countdownWindow = createCountdownWindow();

		countdownWindow.on("closed", () => {
			countdownWindow = null;
		});

		return { success: true };
	});

	ipcMain.handle("cancel-countdown", () => {
		if (countdownWindow && !countdownWindow.isDestroyed()) {
			countdownWindow.close();
			countdownWindow = null;
		}
		return { success: true };
	});

	ipcMain.handle("countdown-complete", () => {
		if (countdownWindow && !countdownWindow.isDestroyed()) {
			countdownWindow.close();
			countdownWindow = null;
		}
		// Forward to all windows so the LaunchWindow knows to start recording
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send("countdown-finished");
			}
		}
		return { success: true };
	});
}
