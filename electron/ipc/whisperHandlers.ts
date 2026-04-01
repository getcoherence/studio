import { type BrowserWindow, ipcMain } from "electron";
import type {
	CaptionTrack,
	ModelDownloadProgress,
	WhisperModelStatus,
} from "../../src/lib/ai/types";
import { cleanupTempAudio, extractAudio } from "../ai/audioExtractor";
import { deleteModel, downloadModel, getModelStatus } from "../ai/modelManager";
import { createCaptionTrack, isWhisperAvailable, type TranscribeOptions } from "../ai/whisper";

/**
 * Register all Whisper / caption-related IPC handlers.
 *
 * @param getMainWindow  Returns the current main BrowserWindow (for sending progress events)
 */
export function registerWhisperHandlers(getMainWindow: () => BrowserWindow | null): void {
	// ── Transcribe a video file ──
	ipcMain.handle(
		"whisper-transcribe",
		async (
			_,
			videoPath: string,
			options?: TranscribeOptions,
		): Promise<{ success: boolean; captionTrack?: CaptionTrack; error?: string }> => {
			let wavPath: string | null = null;

			try {
				// Check if whisper binary is available
				const available = await isWhisperAvailable();
				if (!available) {
					return {
						success: false,
						error:
							"Whisper is not installed. Please place the whisper binary at native/bin/{platform}/whisper",
					};
				}

				// Extract audio from video
				wavPath = await extractAudio(videoPath);

				// Run transcription
				const captionTrack = await createCaptionTrack(wavPath, options);

				return { success: true, captionTrack };
			} catch (error) {
				console.error("Whisper transcription failed:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			} finally {
				// Clean up temp audio file
				if (wavPath) {
					await cleanupTempAudio(wavPath);
				}
			}
		},
	);

	// ── Check model download status ──
	ipcMain.handle(
		"whisper-model-status",
		async (_, modelId: string): Promise<WhisperModelStatus> => {
			return getModelStatus(modelId);
		},
	);

	// ── Download a model with progress ──
	ipcMain.handle(
		"whisper-model-download",
		async (_, modelId: string): Promise<{ success: boolean; path?: string; error?: string }> => {
			try {
				const filePath = await downloadModel(modelId, (progress: ModelDownloadProgress) => {
					// Send progress events to the renderer
					const mainWindow = getMainWindow();
					if (mainWindow && !mainWindow.isDestroyed()) {
						mainWindow.webContents.send("whisper-model-download-progress", progress);
					}
				});

				return { success: true, path: filePath };
			} catch (error) {
				console.error("Model download failed:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	// ── Delete a model ──
	ipcMain.handle(
		"whisper-model-delete",
		async (_, modelId: string): Promise<{ success: boolean; error?: string }> => {
			try {
				await deleteModel(modelId);
				return { success: true };
			} catch (error) {
				console.error("Model deletion failed:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	// ── Check if whisper binary is available ──
	ipcMain.handle("whisper-available", async (): Promise<boolean> => {
		return isWhisperAvailable();
	});
}
