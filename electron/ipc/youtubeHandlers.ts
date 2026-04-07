// ── YouTube IPC Handlers ────────────────────────────────────────────────

import { BrowserWindow, ipcMain } from "electron";
import {
	authenticateYouTube,
	disconnectYouTube,
	isYouTubeConnected,
	setYouTubeCredentials,
	uploadToYouTube,
} from "../youtube/youtubeAuth";

export function registerYouTubeHandlers(getMainWindow: () => BrowserWindow | null) {
	ipcMain.handle("youtube-is-connected", () => {
		return isYouTubeConnected();
	});

	ipcMain.handle("youtube-connect", async () => {
		return authenticateYouTube();
	});

	ipcMain.handle("youtube-disconnect", () => {
		disconnectYouTube();
		return { success: true };
	});

	ipcMain.handle("youtube-set-credentials", (_event, clientId: string, clientSecret: string) => {
		setYouTubeCredentials(clientId, clientSecret);
		return { success: true };
	});

	ipcMain.handle(
		"youtube-upload",
		async (
			_event,
			opts: {
				filePath: string;
				title: string;
				description?: string;
				privacy: "public" | "unlisted" | "private";
			},
		) => {
			return uploadToYouTube({
				...opts,
				onProgress: (percent) => {
					const win = getMainWindow();
					if (win && !win.isDestroyed()) {
						win.webContents.send("youtube-upload-progress", percent);
					}
				},
			});
		},
	);
}
