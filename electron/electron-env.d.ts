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
		mergeVideoAudio: (
			videoPath: string,
			audioPath: string,
		) => Promise<{ success: boolean; error?: string }>;
		autoSaveProject: (
			projectData: unknown,
			fileName: string,
		) => Promise<{ success: boolean; path?: string; error?: string }>;
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
		aiGetAllKeys: () => Promise<{ keys: Record<string, string>; models: Record<string, string> }>;
		aiAnalyze: (
			prompt: string,
			context?: string,
			modelOverride?: { provider: string; model: string },
		) => Promise<import("../src/lib/ai/types").AIServiceResult>;
		aiGenerateJSON: (
			prompt: string,
			context?: string,
			schema?: Record<string, unknown>,
		) => Promise<{ success: boolean; data?: unknown; error?: string }>;
		aiAnalyzeImage: (
			prompt: string,
			imageBase64: string,
			systemPrompt?: string,
		) => Promise<import("../src/lib/ai/types").AIServiceResult>;
		aiCheckAvailability: () => Promise<import("../src/lib/ai/types").AIAvailability>;
		aiGetConfig: () => Promise<import("../src/lib/ai/types").AIServiceConfig>;
		aiSaveConfig: (
			config: Partial<import("../src/lib/ai/types").AIServiceConfig>,
		) => Promise<{ success: boolean }>;
		aiTtsSynthesize: (
			text: string,
			voice?: string,
		) => Promise<{ success: boolean; audioPath?: string; error?: string }>;
		aiGenerateMusic: (
			mood: string,
			customPrompt?: string,
			videoDurationSec?: number,
			vocalMode?: string,
			lyrics?: string,
		) => Promise<{ success: boolean; audioPath?: string; durationSec?: number; error?: string }>;
		aiGenerateLyrics: (
			themePrompt: string,
			title?: string,
		) => Promise<{
			success: boolean;
			lyrics?: string;
			title?: string;
			styleTags?: string;
			error?: string;
		}>;
		musicLibraryList: () => Promise<
			Array<{
				path: string;
				name: string;
				createdAt: number;
				sizeBytes: number;
				label?: string;
				mood?: string;
				prompt?: string;
			}>
		>;
		musicLibraryDelete: (filePath: string) => Promise<{ success: boolean; error?: string }>;

		// Video generation
		aiGenerateVideo: (
			prompt: string,
			options?: {
				model?: string;
				durationSec?: number;
				resolution?: "720P" | "768P" | "1080P";
			},
		) => Promise<{
			success: boolean;
			videoPath?: string;
			width?: number;
			height?: number;
			error?: string;
		}>;
		aiGenerateVideoBatch: (
			clips: Array<{
				prompt: string;
				sceneIndex: number;
				model?: string;
				durationSec?: number;
				resolution?: "720P" | "768P" | "1080P";
			}>,
		) => Promise<
			Array<{
				sceneIndex: number;
				result: {
					success: boolean;
					videoPath?: string;
					width?: number;
					height?: number;
					error?: string;
				};
			}>
		>;

		lottieSearch: (
			query: string,
			page?: number,
		) => Promise<{
			results: Array<{
				id: string;
				name: string;
				imageUrl: string;
				lottieUrl: string;
				bgColor: string;
			}>;
			error?: string;
		}>;
		lottiePopular: (page?: number) => Promise<{
			results: Array<{
				id: string;
				name: string;
				imageUrl: string;
				lottieUrl: string;
				bgColor: string;
			}>;
			error?: string;
		}>;
		lottieDownload: (
			lottieUrl: string,
			name: string,
		) => Promise<{ success: boolean; filePath?: string; error?: string }>;

		// Remotion SSR Export
		exportRemotion: (opts: {
			code: string;
			screenshots: string[];
			fps?: number;
			durationInFrames?: number;
			width?: number;
			height?: number;
			fileName?: string;
			musicPath?: string;
			musicVolume?: number;
		}) => Promise<{
			success: boolean;
			path?: string;
			canceled?: boolean;
			error?: string;
			logs?: string[];
		}>;
		onExportRemotionProgress: (callback: (percent: number) => void) => () => void;

		// YouTube
		youtubeIsConnected: () => Promise<boolean>;
		youtubeConnect: () => Promise<{ success: boolean; error?: string }>;
		youtubeDisconnect: () => Promise<{ success: boolean }>;
		youtubeSetCredentials: (clientId: string, clientSecret: string) => Promise<{ success: boolean }>;
		youtubeUpload: (opts: {
			filePath: string;
			title: string;
			description?: string;
			privacy: "public" | "unlisted" | "private";
		}) => Promise<{ success: boolean; videoId?: string; url?: string; error?: string }>;
		onYoutubeUploadProgress: (callback: (percent: number) => void) => () => void;

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

		// AI Demo Recorder
		demoStart: (config: {
			url: string;
			prompt: string;
			maxSteps?: number;
			viewport?: { width: number; height: number };
			headless?: boolean;
		}) => Promise<{
			steps: Array<{
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
			}>;
			totalDurationMs: number;
			narrationText: string;
		}>;
		demoStop: () => Promise<{ success: boolean }>;
		demoResume: () => Promise<{ success: boolean }>;
		demoGetStatus: () => Promise<{ running: boolean }>;
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
