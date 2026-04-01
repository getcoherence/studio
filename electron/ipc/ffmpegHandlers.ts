import { ipcMain } from "electron";
import { getFfmpegPath } from "../ffmpeg";

export function registerFfmpegHandlers() {
	ipcMain.handle("get-ffmpeg-path", async () => {
		try {
			const ffmpegPath = await getFfmpegPath();
			return { success: !!ffmpegPath, path: ffmpegPath };
		} catch (error) {
			console.error("Failed to get FFmpeg path:", error);
			return { success: false, error: String(error) };
		}
	});
}
