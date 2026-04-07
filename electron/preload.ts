import { contextBridge, ipcRenderer } from "electron";
import type {
	AIServiceConfig,
	CaptionTrack,
	ModelDownloadProgress,
	WhisperModelStatus,
} from "../src/lib/ai/types";
import type { RecordingSession, StoreRecordedSessionInput } from "../src/lib/recordingSession";

contextBridge.exposeInMainWorld("electronAPI", {
	getAssetBasePath: async () => {
		// ask main process for the correct base path (production vs dev)
		return await ipcRenderer.invoke("get-asset-base-path");
	},
	getSources: async (opts: Electron.SourcesOptions) => {
		return await ipcRenderer.invoke("get-sources", opts);
	},
	switchToEditor: () => {
		return ipcRenderer.invoke("switch-to-editor");
	},
	selectSource: (source: ProcessedDesktopSource) => {
		return ipcRenderer.invoke("select-source", source);
	},
	getSelectedSource: () => {
		return ipcRenderer.invoke("get-selected-source");
	},
	requestCameraAccess: () => {
		return ipcRenderer.invoke("request-camera-access");
	},

	storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("store-recorded-video", videoData, fileName);
	},
	storeRecordedSession: (payload: StoreRecordedSessionInput) => {
		return ipcRenderer.invoke("store-recorded-session", payload);
	},

	getRecordedVideoPath: () => {
		return ipcRenderer.invoke("get-recorded-video-path");
	},
	setRecordingState: (recording: boolean) => {
		return ipcRenderer.invoke("set-recording-state", recording);
	},
	getCursorTelemetry: (videoPath?: string) => {
		return ipcRenderer.invoke("get-cursor-telemetry", videoPath);
	},
	onStopRecordingFromTray: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("stop-recording-from-tray", listener);
		return () => ipcRenderer.removeListener("stop-recording-from-tray", listener);
	},
	openExternalUrl: (url: string) => {
		return ipcRenderer.invoke("open-external-url", url);
	},
	saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("save-exported-video", videoData, fileName);
	},
	saveScreenshot: (imageData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("save-screenshot", imageData, fileName);
	},
	openVideoFilePicker: () => {
		return ipcRenderer.invoke("open-video-file-picker");
	},
	setCurrentVideoPath: (path: string) => {
		return ipcRenderer.invoke("set-current-video-path", path);
	},
	setCurrentRecordingSession: (session: RecordingSession | null) => {
		return ipcRenderer.invoke("set-current-recording-session", session);
	},
	getCurrentVideoPath: () => {
		return ipcRenderer.invoke("get-current-video-path");
	},
	getCurrentRecordingSession: () => {
		return ipcRenderer.invoke("get-current-recording-session");
	},
	readBinaryFile: (filePath: string) => {
		return ipcRenderer.invoke("read-binary-file", filePath);
	},
	clearCurrentVideoPath: () => {
		return ipcRenderer.invoke("clear-current-video-path");
	},
	saveProjectFile: (projectData: unknown, suggestedName?: string, existingProjectPath?: string) => {
		return ipcRenderer.invoke("save-project-file", projectData, suggestedName, existingProjectPath);
	},
	autoSaveProject: (projectData: unknown, fileName: string) => {
		return ipcRenderer.invoke("auto-save-project", projectData, fileName);
	},
	mergeVideoAudio: (videoPath: string, audioPath: string) => {
		return ipcRenderer.invoke("merge-video-audio", videoPath, audioPath);
	},
	loadProjectFile: () => {
		return ipcRenderer.invoke("load-project-file");
	},
	loadCurrentProjectFile: () => {
		return ipcRenderer.invoke("load-current-project-file");
	},
	onMenuNewRecording: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-new-recording", listener);
		return () => ipcRenderer.removeListener("menu-new-recording", listener);
	},
	onMenuCreateVideo: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-create-video", listener);
		return () => ipcRenderer.removeListener("menu-create-video", listener);
	},
	loadProjectByPath: (filePath: string) => {
		return ipcRenderer.invoke("load-project-by-path", filePath);
	},
	onMenuOpenVideo: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-open-video", listener);
		return () => ipcRenderer.removeListener("menu-open-video", listener);
	},
	onMenuLoadProject: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-load-project", listener);
		return () => ipcRenderer.removeListener("menu-load-project", listener);
	},
	onMenuSaveProject: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-save-project", listener);
		return () => ipcRenderer.removeListener("menu-save-project", listener);
	},
	onMenuSaveProjectAs: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-save-project-as", listener);
		return () => ipcRenderer.removeListener("menu-save-project-as", listener);
	},
	getPlatform: () => {
		return ipcRenderer.invoke("get-platform");
	},
	revealInFolder: (filePath: string) => {
		return ipcRenderer.invoke("reveal-in-folder", filePath);
	},
	getShortcuts: () => {
		return ipcRenderer.invoke("get-shortcuts");
	},
	saveShortcuts: (shortcuts: unknown) => {
		return ipcRenderer.invoke("save-shortcuts", shortcuts);
	},
	setLocale: (locale: string) => {
		return ipcRenderer.invoke("set-locale", locale);
	},
	// ── AI features ──
	aiAnalyze: (
		prompt: string,
		context?: string,
		modelOverride?: { provider: string; model: string },
	) => {
		return ipcRenderer.invoke("ai-analyze", prompt, context, modelOverride);
	},
	aiGenerateJSON: (prompt: string, context?: string, schema?: Record<string, unknown>) => {
		return ipcRenderer.invoke("ai-generate-json", prompt, context, schema);
	},
	aiAnalyzeImage: (prompt: string, imageBase64: string, systemPrompt?: string) => {
		return ipcRenderer.invoke("ai-analyze-image", prompt, imageBase64, systemPrompt);
	},
	aiCheckAvailability: () => {
		return ipcRenderer.invoke("ai-check-availability");
	},
	aiGetConfig: () => {
		return ipcRenderer.invoke("ai-get-config");
	},
	aiGetAllKeys: () => {
		return ipcRenderer.invoke("ai-get-all-keys") as Promise<{
			keys: Record<string, string>;
			models: Record<string, string>;
		}>;
	},
	aiSaveConfig: (config: Partial<AIServiceConfig>) => {
		return ipcRenderer.invoke("ai-save-config", config);
	},
	aiTtsSynthesize: (text: string, voice?: string) => {
		return ipcRenderer.invoke("ai-tts-synthesize", text, voice);
	},
	aiGenerateMusic: (
		mood: string,
		customPrompt?: string,
		videoDurationSec?: number,
		vocalMode?: string,
		lyrics?: string,
	) => {
		return ipcRenderer.invoke(
			"ai-generate-music",
			mood,
			customPrompt,
			videoDurationSec,
			vocalMode,
			lyrics,
		);
	},
	aiGenerateLyrics: (themePrompt: string, title?: string) => {
		return ipcRenderer.invoke("ai-generate-lyrics", themePrompt, title);
	},
	musicLibraryList: () => {
		return ipcRenderer.invoke("music-library-list");
	},
	musicLibraryDelete: (filePath: string) => {
		return ipcRenderer.invoke("music-library-delete", filePath);
	},

	// ── YouTube ──
	youtubeIsConnected: () => ipcRenderer.invoke("youtube-is-connected"),
	youtubeConnect: () => ipcRenderer.invoke("youtube-connect"),
	youtubeDisconnect: () => ipcRenderer.invoke("youtube-disconnect"),
	youtubeSetCredentials: (clientId: string, clientSecret: string) =>
		ipcRenderer.invoke("youtube-set-credentials", clientId, clientSecret),
	youtubeUpload: (opts: { filePath: string; title: string; description?: string; privacy: "public" | "unlisted" | "private" }) =>
		ipcRenderer.invoke("youtube-upload", opts),
	onYoutubeUploadProgress: (callback: (percent: number) => void) => {
		const listener = (_: unknown, percent: number) => callback(percent);
		ipcRenderer.on("youtube-upload-progress", listener);
		return () => ipcRenderer.removeListener("youtube-upload-progress", listener);
	},
	lottieSearch: (query: string, page?: number) => {
		return ipcRenderer.invoke("lottie-search", query, page);
	},
	lottiePopular: (page?: number) => {
		return ipcRenderer.invoke("lottie-popular", page);
	},
	lottieDownload: (lottieUrl: string, name: string) => {
		return ipcRenderer.invoke("lottie-download", lottieUrl, name);
	},

	// ── Remotion SSR Export ──
	exportRemotion: (opts: {
		code: string;
		screenshots: string[];
		fps?: number;
		durationInFrames?: number;
		fileName?: string;
		musicPath?: string;
		musicVolume?: number;
	}) => {
		return ipcRenderer.invoke("export-remotion", opts);
	},
	onExportRemotionProgress: (callback: (percent: number) => void) => {
		const listener = (_: unknown, percent: number) => callback(percent);
		ipcRenderer.on("export-remotion-progress", listener);
		return () => ipcRenderer.removeListener("export-remotion-progress", listener);
	},

	setMicrophoneExpanded: (expanded: boolean) => {
		ipcRenderer.send("hud:setMicrophoneExpanded", expanded);
	},
	setHasUnsavedChanges: (hasChanges: boolean) => {
		ipcRenderer.send("set-has-unsaved-changes", hasChanges);
	},

	// Settings
	getSettings: () => {
		return ipcRenderer.invoke("get-settings");
	},
	getSetting: (key: string) => {
		return ipcRenderer.invoke("get-setting", key);
	},
	setSetting: (key: string, value: unknown) => {
		return ipcRenderer.invoke("set-setting", key, value);
	},

	// FFmpeg
	getFfmpegPath: () => {
		return ipcRenderer.invoke("get-ffmpeg-path");
	},

	onRequestSaveBeforeClose: (callback: () => Promise<boolean> | boolean) => {
		const listener = async () => {
			try {
				const shouldClose = await callback();
				ipcRenderer.send("save-before-close-done", shouldClose);
			} catch {
				ipcRenderer.send("save-before-close-done", false);
			}
		};
		ipcRenderer.on("request-save-before-close", listener);
		return () => ipcRenderer.removeListener("request-save-before-close", listener);
	},

	// Recording bar
	showRecordingBar: () => {
		return ipcRenderer.invoke("show-recording-bar");
	},
	hideRecordingBar: () => {
		return ipcRenderer.invoke("hide-recording-bar");
	},
	stopRecordingFromBar: () => {
		return ipcRenderer.invoke("stop-recording-from-bar");
	},
	minimizeEditor: () => {
		return ipcRenderer.invoke("minimize-editor");
	},
	restoreEditor: () => {
		return ipcRenderer.invoke("restore-editor");
	},
	onStopRecordingFromBar: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("stop-recording-from-bar", listener);
		return () => ipcRenderer.removeListener("stop-recording-from-bar", listener);
	},

	// Updater
	checkForUpdates: () => {
		return ipcRenderer.invoke("check-for-updates");
	},
	getUpdateStatus: () => {
		return ipcRenderer.invoke("get-update-status");
	},
	dismissUpdate: () => {
		return ipcRenderer.invoke("dismiss-update");
	},
	onUpdateAvailable: (callback: (version: string) => void) => {
		const listener = (_: unknown, version: string) => callback(version);
		ipcRenderer.on("update-available", listener);
		return () => ipcRenderer.removeListener("update-available", listener);
	},

	// Project browser
	getRecentProjects: () => {
		return ipcRenderer.invoke("get-recent-projects");
	},
	removeRecentProject: (filePath: string) => {
		return ipcRenderer.invoke("remove-recent-project", filePath);
	},
	onMenuRecentProjects: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-recent-projects", listener);
		return () => ipcRenderer.removeListener("menu-recent-projects", listener);
	},

	// Native Capture
	nativeGetSources: () => {
		return ipcRenderer.invoke("native-get-sources");
	},
	nativeStartCapture: (options: import("../src/lib/native/types").CaptureOptions) => {
		return ipcRenderer.invoke("native-start-capture", options);
	},
	nativeStopCapture: () => {
		return ipcRenderer.invoke("native-stop-capture");
	},
	nativePauseCapture: () => {
		return ipcRenderer.invoke("native-pause-capture");
	},
	nativeResumeCapture: () => {
		return ipcRenderer.invoke("native-resume-capture");
	},
	nativeGetCaptureStatus: () => {
		return ipcRenderer.invoke("native-get-capture-status");
	},
	nativeGetBackend: () => {
		return ipcRenderer.invoke("native-get-backend");
	},

	// Whisper / Captions
	whisperTranscribe: (
		videoPath: string,
		options?: { modelId?: string; language?: string; threads?: number },
	): Promise<{ success: boolean; captionTrack?: CaptionTrack; error?: string }> => {
		return ipcRenderer.invoke("whisper-transcribe", videoPath, options);
	},
	whisperModelStatus: (modelId: string): Promise<WhisperModelStatus> => {
		return ipcRenderer.invoke("whisper-model-status", modelId);
	},
	whisperModelDownload: (
		modelId: string,
	): Promise<{ success: boolean; path?: string; error?: string }> => {
		return ipcRenderer.invoke("whisper-model-download", modelId);
	},
	whisperModelDelete: (modelId: string): Promise<{ success: boolean; error?: string }> => {
		return ipcRenderer.invoke("whisper-model-delete", modelId);
	},
	whisperAvailable: (): Promise<boolean> => {
		return ipcRenderer.invoke("whisper-available");
	},
	onWhisperModelDownloadProgress: (callback: (progress: ModelDownloadProgress) => void) => {
		const listener = (_: unknown, progress: ModelDownloadProgress) => callback(progress);
		ipcRenderer.on("whisper-model-download-progress", listener);
		return () => ipcRenderer.removeListener("whisper-model-download-progress", listener);
	},

	// ── AI Demo Recorder ──
	demoStart: (config: {
		url: string;
		prompt: string;
		maxSteps?: number;
		viewport?: { width: number; height: number };
		headless?: boolean;
	}) => {
		return ipcRenderer.invoke("demo-start", config);
	},
	demoStop: () => {
		return ipcRenderer.invoke("demo-stop");
	},
	demoResume: () => {
		return ipcRenderer.invoke("demo-resume");
	},
	demoGetStatus: () => {
		return ipcRenderer.invoke("demo-get-status");
	},
	onDemoProgress: (
		callback: (data: {
			step: {
				action: {
					action: string;
					target?: string;
					value?: string;
					narration: string;
					waitMs?: number;
					reasoning?: string;
				};
				timestamp: number;
				screenshotDataUrl?: string;
			};
			stepIndex: number;
		}) => void,
	) => {
		const listener = (_: unknown, data: Parameters<typeof callback>[0]) => callback(data);
		ipcRenderer.on("demo-progress", listener);
		return () => ipcRenderer.removeListener("demo-progress", listener);
	},
});
