/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The built directory structure
		 *
		 * ```tree
		 * ├─┬─┬ dist
		 * │ │ └── index.html
		 * │ │
		 * │ ├─┬ dist-electron
		 * │ │ ├── main.js
		 * │ │ └── preload.js
		 * │
		 * ```
		 */
		APP_ROOT: string;
		/** /dist/ or /public/ */
		VITE_PUBLIC: string;
	}
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
	electronAPI: {
		getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>;
		switchToEditor: () => Promise<void>;
		selectSource: (source: ProcessedDesktopSource) => Promise<ProcessedDesktopSource | null>;
		getSelectedSource: () => Promise<ProcessedDesktopSource | null>;
		requestCameraAccess: () => Promise<{
			success: boolean;
			granted: boolean;
			status: string;
			error?: string;
		}>;
		getAssetBasePath: () => Promise<string | null>;
		storeRecordedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{
			success: boolean;
			path?: string;
			session?: import("../src/lib/recordingSession").RecordingSession;
			message?: string;
			error?: string;
		}>;
		storeRecordedSession: (
			payload: import("../src/lib/recordingSession").StoreRecordedSessionInput,
		) => Promise<{
			success: boolean;
			path?: string;
			session?: import("../src/lib/recordingSession").RecordingSession;
			message?: string;
			error?: string;
		}>;
		getRecordedVideoPath: () => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			error?: string;
		}>;
		setRecordingState: (recording: boolean) => Promise<void>;
		getCursorTelemetry: (videoPath?: string) => Promise<{
			success: boolean;
			samples: CursorTelemetryPoint[];
			message?: string;
			error?: string;
		}>;
		onStopRecordingFromTray: (callback: () => void) => () => void;
		openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
		saveExportedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{ success: boolean; path?: string; message?: string; canceled?: boolean }>;
		saveScreenshot: (
			imageData: ArrayBuffer,
			fileName: string,
		) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
		openVideoFilePicker: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
		setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>;
		setCurrentRecordingSession: (
			session: import("../src/lib/recordingSession").RecordingSession | null,
		) => Promise<{
			success: boolean;
			session?: import("../src/lib/recordingSession").RecordingSession;
		}>;
		getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>;
		getCurrentRecordingSession: () => Promise<{
			success: boolean;
			session?: import("../src/lib/recordingSession").RecordingSession;
		}>;
		readBinaryFile: (filePath: string) => Promise<{
			success: boolean;
			data?: ArrayBuffer;
			path?: string;
			message?: string;
			error?: string;
		}>;
		clearCurrentVideoPath: () => Promise<{ success: boolean }>;
		saveProjectFile: (
			projectData: unknown,
			suggestedName?: string,
			existingProjectPath?: string,
		) => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			canceled?: boolean;
			error?: string;
		}>;
		loadProjectByPath: (filePath: string) => Promise<{
			success: boolean;
			path?: string;
			project?: unknown;
			message?: string;
		}>;
		loadProjectFile: () => Promise<{
			success: boolean;
			path?: string;
			project?: unknown;
			message?: string;
			canceled?: boolean;
			error?: string;
		}>;
		loadCurrentProjectFile: () => Promise<{
			success: boolean;
			path?: string;
			project?: unknown;
			message?: string;
			canceled?: boolean;
			error?: string;
		}>;
		onMenuNewRecording: (callback: () => void) => () => void;
		onMenuCreateVideo: (callback: () => void) => () => void;
		onMenuOpenVideo: (callback: () => void) => () => void;
		onMenuLoadProject: (callback: () => void) => () => void;
		onMenuSaveProject: (callback: () => void) => () => void;
		onMenuSaveProjectAs: (callback: () => void) => () => void;
		getPlatform: () => Promise<string>;
		revealInFolder: (
			filePath: string,
		) => Promise<{ success: boolean; error?: string; message?: string }>;
		getShortcuts: () => Promise<Record<string, unknown> | null>;
		saveShortcuts: (shortcuts: unknown) => Promise<{ success: boolean; error?: string }>;
		// AI features
		aiAnalyze: (
			prompt: string,
			context?: string,
		) => Promise<import("../src/lib/ai/types").AIServiceResult>;
		aiGenerateJSON: (
			prompt: string,
			context?: string,
			schema?: Record<string, unknown>,
		) => Promise<{ success: boolean; data?: unknown; error?: string }>;
		aiCheckAvailability: () => Promise<import("../src/lib/ai/types").AIAvailability>;
		aiGetConfig: () => Promise<import("../src/lib/ai/types").AIServiceConfig>;
		aiSaveConfig: (
			config: Partial<import("../src/lib/ai/types").AIServiceConfig>,
		) => Promise<{ success: boolean }>;
		aiTtsSynthesize: (
			text: string,
			voice?: string,
		) => Promise<{ success: boolean; audioPath?: string; error?: string }>;

		setMicrophoneExpanded: (expanded: boolean) => void;
		setHasUnsavedChanges: (hasChanges: boolean) => void;
		onRequestSaveBeforeClose: (callback: () => Promise<boolean> | boolean) => () => void;
		setLocale: (locale: string) => Promise<void>;

		// Recording bar
		showRecordingBar: () => Promise<{ success: boolean }>;
		hideRecordingBar: () => Promise<{ success: boolean }>;
		stopRecordingFromBar: () => Promise<{ success: boolean }>;
		minimizeEditor: () => Promise<{ success: boolean }>;
		restoreEditor: () => Promise<{ success: boolean }>;
		onStopRecordingFromBar: (callback: () => void) => () => void;

		// Updater
		checkForUpdates: () => Promise<{
			success: boolean;
			state: string;
			latestVersion?: string;
			currentVersion?: string;
			downloadUrl?: string;
		}>;
		getUpdateStatus: () => Promise<{
			state: string;
			latestVersion?: string;
			currentVersion?: string;
			downloadUrl?: string;
		}>;
		dismissUpdate: () => Promise<{ success: boolean }>;
		onUpdateAvailable: (callback: (version: string) => void) => () => void;

		// Project browser
		getRecentProjects: () => Promise<RecentProject[]>;
		removeRecentProject: (filePath: string) => Promise<{ success: boolean }>;
		onMenuRecentProjects: (callback: () => void) => () => void;

		// Native Capture
		nativeGetSources: () => Promise<{
			success: boolean;
			sources: import("../src/lib/native/types").CaptureSource[];
			error?: string;
		}>;
		nativeStartCapture: (
			options: import("../src/lib/native/types").CaptureOptions,
		) => Promise<{ success: boolean; error?: string }>;
		nativeStopCapture: () => Promise<{
			success: boolean;
			outputPath?: string;
			error?: string;
		}>;
		nativePauseCapture: () => Promise<{ success: boolean; error?: string }>;
		nativeResumeCapture: () => Promise<{ success: boolean; error?: string }>;
		nativeGetCaptureStatus: () => Promise<{
			success: boolean;
			status?: import("../src/lib/native/types").CaptureStatus;
			error?: string;
		}>;
		nativeGetBackend: () => Promise<{
			success: boolean;
			backend: import("../src/lib/native/types").CaptureBackendId;
			hasNative: boolean;
			error?: string;
		}>;
		getSetting: (key: string) => Promise<string | null>;
		setSetting: (key: string, value: string) => Promise<{ success: boolean }>;

		// Whisper / Captions
		whisperTranscribe: (
			videoPath: string,
			options?: { modelId?: string; language?: string; threads?: number },
		) => Promise<{
			success: boolean;
			captionTrack?: import("../src/lib/ai/types").CaptionTrack;
			error?: string;
		}>;
		whisperModelStatus: (
			modelId: string,
		) => Promise<import("../src/lib/ai/types").WhisperModelStatus>;
		whisperModelDownload: (
			modelId: string,
		) => Promise<{ success: boolean; path?: string; error?: string }>;
		whisperModelDelete: (modelId: string) => Promise<{ success: boolean; error?: string }>;
		whisperAvailable: () => Promise<boolean>;
		onWhisperModelDownloadProgress: (
			callback: (progress: import("../src/lib/ai/types").ModelDownloadProgress) => void,
		) => () => void;
	};
}

interface RecentProject {
	filePath: string;
	fileName: string;
	lastModified: number;
	fileSize: number;
}

interface ProcessedDesktopSource {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string | null;
	appIcon: string | null;
}

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	clickType?: "left" | "right" | "double" | "middle";
	cursorType?: "arrow" | "text" | "pointer" | "crosshair" | "hand" | "resize";
}
