import { ipcMain } from "electron";
import { getSetting, loadSettings, type StudioSettings, setSetting } from "../settings";

export function registerSettingsHandlers() {
	ipcMain.handle("get-settings", async () => {
		try {
			const settings = await loadSettings();
			return { success: true, settings };
		} catch (error) {
			console.error("Failed to load settings:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("get-setting", async (_, key: keyof StudioSettings) => {
		try {
			const value = await getSetting(key);
			return { success: true, value };
		} catch (error) {
			console.error(`Failed to get setting ${key}:`, error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("set-setting", async (_, key: keyof StudioSettings, value: unknown) => {
		try {
			await setSetting(key, value as StudioSettings[typeof key]);
			return { success: true };
		} catch (error) {
			console.error(`Failed to set setting ${key}:`, error);
			return { success: false, error: String(error) };
		}
	});
}
