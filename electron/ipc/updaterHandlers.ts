import { BrowserWindow, ipcMain } from "electron";
import {
	checkForUpdates,
	dismissUpdate,
	getUpdateStatus,
	onUpdateAvailable,
	startAutoUpdateCheck,
} from "../updater";

export function registerUpdaterHandlers() {
	ipcMain.handle("check-for-updates", async () => {
		const result = await checkForUpdates();
		return { success: true, ...result };
	});

	ipcMain.handle("get-update-status", () => {
		return getUpdateStatus();
	});

	ipcMain.handle("dismiss-update", () => {
		dismissUpdate();
		return { success: true };
	});

	// Notify all renderer windows when an update is available
	onUpdateAvailable((version: string) => {
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send("update-available", version);
			}
		}
	});

	// Start auto-checking for updates
	startAutoUpdateCheck();
}
