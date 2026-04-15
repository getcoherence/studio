import { BrowserWindow, ipcMain } from "electron";
import { loadSettings, setSetting } from "../settings";
import {
	checkForUpdates,
	dismissUpdate,
	getUpdateChannel,
	getUpdateStatus,
	initAutoUpdater,
	installUpdate,
	setUpdateChannel,
	startAutoUpdateCheck,
	type UpdateChannel,
} from "../updater";

export async function registerUpdaterHandlers() {
	// Broadcast events to every renderer via a single "update:event" channel.
	// The React UpdateNotifier component subscribes and renders toast + badge.
	const settings = await loadSettings();
	initAutoUpdater(() => BrowserWindow.getAllWindows(), settings.updateChannel);

	ipcMain.handle("update:check", async (_, manual?: boolean) => {
		return await checkForUpdates({ manual: manual ?? false });
	});

	ipcMain.handle("update:status", () => getUpdateStatus());

	ipcMain.handle("update:dismiss", () => {
		dismissUpdate();
		return { success: true };
	});

	ipcMain.handle("update:install", () => {
		installUpdate();
		return { success: true };
	});

	ipcMain.handle("update:get-channel", () => getUpdateChannel());

	ipcMain.handle("update:set-channel", async (_, channel: UpdateChannel) => {
		setUpdateChannel(channel);
		await setSetting("updateChannel", channel);
		return { success: true, channel };
	});

	startAutoUpdateCheck();
}
