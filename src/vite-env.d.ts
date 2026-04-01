/// <reference types="vite/client" />
/// <reference types="../electron/electron-env" />

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
		storeRecordedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{
			success: boolean;
			path?: string;
			session?: import("./lib/recordingSession").RecordingSession;
			message?: string;
			error?: string;
		}>;
		storeRecordedSession: (
			payload: import("./lib/recordingSession").StoreRecordedSessionInput,
		) => Promise<{
			success: boolean;
			path?: string;
			session?: import("./lib/recordingSession").RecordingSession;
			message?: string;
			error?: string;
		}>;
		getRecordedVideoPath: () => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			error?: string;
		}>;
		getAssetBasePath: () => Promise<string | null>;
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
		) => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			canceled?: boolean;
		}>;
		openVideoFilePicker: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
		setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>;
		setCurrentRecordingSession: (
			session: import("./lib/recordingSession").RecordingSession | null,
		) => Promise<{
			success: boolean;
			session?: import("./lib/recordingSession").RecordingSession;
		}>;
		getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>;
		getCurrentRecordingSession: () => Promise<{
			success: boolean;
			session?: import("./lib/recordingSession").RecordingSession;
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
		onMenuLoadProject: (callback: () => void) => () => void;
		onMenuSaveProject: (callback: () => void) => () => void;
		onMenuSaveProjectAs: (callback: () => void) => () => void;
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
		onMenuNewRecording: (callback: () => void) => () => void;

		// Whisper / Captions
		whisperTranscribe: (
			videoPath: string,
			options?: { modelId?: string; language?: string; threads?: number },
		) => Promise<{
			success: boolean;
			captionTrack?: import("./lib/ai/types").CaptionTrack;
			error?: string;
		}>;
		whisperModelStatus: (modelId: string) => Promise<import("./lib/ai/types").WhisperModelStatus>;
		whisperModelDownload: (
			modelId: string,
		) => Promise<{ success: boolean; path?: string; error?: string }>;
		whisperModelDelete: (modelId: string) => Promise<{ success: boolean; error?: string }>;
		whisperAvailable: () => Promise<boolean>;
		onWhisperModelDownloadProgress: (
			callback: (progress: import("./lib/ai/types").ModelDownloadProgress) => void,
		) => () => void;
	};
}
