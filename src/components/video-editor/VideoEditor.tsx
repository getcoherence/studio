import type { Span } from "dnd-timeline";
import {
	Camera,
	FolderOpen,
	Languages,
	MessageSquare,
	Save,
	Sparkles,
	Video,
	Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { ProjectBrowser } from "@/components/project-browser/ProjectBrowser";
import { CountdownOverlay } from "@/components/recording/CountdownOverlay";
import { LiveMonitor } from "@/components/recording/LiveMonitor";
import {
	type RecordingConfig,
	RecordingSetupDialog,
} from "@/components/recording/RecordingSetupDialog";
import { WelcomeScreen } from "@/components/recording/WelcomeScreen";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import type { EditorState } from "@/hooks/useEditorHistory";
import { INITIAL_EDITOR_STATE, useEditorHistory } from "@/hooks/useEditorHistory";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { getLocaleName } from "@/i18n/loader";
import { generatePolishEdits } from "@/lib/ai/oneClickPolish";
import type { CaptionStyle, CaptionTrack, PolishPreview } from "@/lib/ai/types";
import {
	calculateOutputDimensions,
	type ExportFormat,
	type ExportProgress,
	type ExportQuality,
	type ExportSettings,
	GIF_SIZE_PRESETS,
	GifExporter,
	type GifFrameRate,
	type GifSizePreset,
	VideoExporter,
} from "@/lib/exporter";
import type { ProjectMedia } from "@/lib/recordingSession";
import { matchesShortcut } from "@/lib/shortcuts";
import {
	getAspectRatioValue,
	getNativeAspectRatioValue,
	isPortraitAspectRatio,
} from "@/utils/aspectRatioUtils";
import { AIChatSidebar } from "./AIChatSidebar";
import { AIPanelSidebar } from "./AIPanelSidebar";
import { CursorOverlay } from "./CursorOverlay";
import { ExportDialog } from "./ExportDialog";
import PlaybackControls from "./PlaybackControls";
import {
	createProjectData,
	deriveNextId,
	fromFileUrl,
	normalizeProjectEditor,
	resolveProjectMedia,
	toFileUrl,
	validateProjectData,
} from "./projectPersistence";
import { SettingsPanel } from "./SettingsPanel";
import TimelineEditor from "./timeline/TimelineEditor";
import {
	type AnnotationRegion,
	type CursorTelemetryPoint,
	clampFocusToDepth,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_FIGURE_DATA,
	DEFAULT_PLAYBACK_SPEED,
	DEFAULT_ZOOM_DEPTH,
	type FigureData,
	type PlaybackSpeed,
	type SpeedRegion,
	type TrimRegion,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomRegion,
} from "./types";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";

export default function VideoEditor() {
	const {
		state: editorState,
		pushState,
		updateState,
		commitState,
		undo,
		redo,
	} = useEditorHistory(INITIAL_EDITOR_STATE);

	const {
		zoomRegions,
		trimRegions,
		speedRegions,
		annotationRegions,
		cropRegion,
		wallpaper,
		shadowIntensity,
		showBlur,
		motionBlurAmount,
		borderRadius,
		padding,
		aspectRatio,
		webcamLayoutPreset,
		webcamPosition,
		cursorSmoothing,
		cursorSway,
		cursorStyle,
		showClickRings,
		showCursor,
		captionTrack,
		captionStyle,
	} = editorState;

	// ── Non-undoable state
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [videoSourcePath, setVideoSourcePath] = useState<string | null>(null);
	const [webcamVideoPath, setWebcamVideoPath] = useState<string | null>(null);
	const [webcamVideoSourcePath, setWebcamVideoSourcePath] = useState<string | null>(null);
	const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
	const [selectedSpeedId, setSelectedSpeedId] = useState<string | null>(null);
	const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [exportQuality, setExportQuality] = useState<ExportQuality>("good");
	const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
	const [gifFrameRate, setGifFrameRate] = useState<GifFrameRate>(15);
	const [gifLoop, setGifLoop] = useState(true);
	const [gifSizePreset, setGifSizePreset] = useState<GifSizePreset>("medium");
	const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
	const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
	const [unsavedExport, setUnsavedExport] = useState<{
		arrayBuffer: ArrayBuffer;
		fileName: string;
		format: string;
	} | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [showAIPanel, setShowAIPanel] = useState(false);
	const [aiPanelMode, setAIPanelMode] = useState<"chat" | "tools">("chat");
	const [polishPreview, setPolishPreview] = useState<PolishPreview | null>(null);
	const [polishEdits, setPolishEdits] = useState<Partial<EditorState> | null>(null);
	const [showPolishDialog, setShowPolishDialog] = useState(false);
	const [showRecordingSetup, setShowRecordingSetup] = useState(false);
	const [showProjectBrowser, setShowProjectBrowser] = useState(false);
	const [showCountdown, setShowCountdown] = useState(false);
	const [pendingRecordingConfig, setPendingRecordingConfig] = useState<RecordingConfig | null>(
		null,
	);
	const [reloadTrigger, setReloadTrigger] = useState(0);
	const [previewWallpaper, setPreviewWallpaper] = useState<string | null>(null);

	const playerContainerRef = useRef<HTMLDivElement>(null);
	const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
	const cursorContainerRef = useRef<HTMLDivElement>(null);
	const [cursorContainerSize, setCursorContainerSize] = useState({ width: 0, height: 0 });

	const nextZoomIdRef = useRef(1);
	const nextTrimIdRef = useRef(1);
	const nextSpeedIdRef = useRef(1);

	// Refs used by keyboard shortcut handler to avoid stale closures
	const handleOpenExportDialogRef = useRef<() => void>(() => {});
	const captionTrackStashRef = useRef<CaptionTrack | null>(null);
	const captionTrackRef = useRef<CaptionTrack | null>(null);
	const [, setCaptionsHidden] = useState(false);

	const { shortcuts, isMac } = useShortcuts();
	const t = useScopedT("editor");
	const ts = useScopedT("settings");
	const { locale, setLocale } = useI18n();

	const {
		recording,
		toggleRecording,
		setMicrophoneEnabled,
		setSystemAudioEnabled,
		setWebcamEnabled,
		liveScreenStream,
		liveWebcamStream,
	} = useScreenRecorder({
		onRecordingFinalized: () => {
			setReloadTrigger((prev) => prev + 1);
		},
	});

	const nextAnnotationIdRef = useRef(1);
	const nextAnnotationZIndexRef = useRef(1);
	const exporterRef = useRef<VideoExporter | null>(null);

	const currentProjectMedia = useMemo<ProjectMedia | null>(() => {
		const screenVideoPath = videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null);
		if (!screenVideoPath) {
			return null;
		}

		const webcamSourcePath =
			webcamVideoSourcePath ?? (webcamVideoPath ? fromFileUrl(webcamVideoPath) : null);
		return webcamSourcePath
			? { screenVideoPath, webcamVideoPath: webcamSourcePath }
			: { screenVideoPath };
	}, [videoPath, videoSourcePath, webcamVideoPath, webcamVideoSourcePath]);

	const applyLoadedProject = useCallback(
		async (candidate: unknown, path?: string | null) => {
			if (!validateProjectData(candidate)) {
				return false;
			}

			const project = candidate;
			const media = resolveProjectMedia(project);
			if (!media) {
				return false;
			}
			const sourcePath = fromFileUrl(media.screenVideoPath);
			const webcamSourcePath = media.webcamVideoPath ? fromFileUrl(media.webcamVideoPath) : null;
			const normalizedEditor = normalizeProjectEditor(project.editor);

			try {
				videoPlaybackRef.current?.pause();
			} catch {
				// no-op
			}
			setIsPlaying(false);
			setCurrentTime(0);
			setDuration(0);

			setError(null);
			setVideoSourcePath(sourcePath);
			setVideoPath(toFileUrl(sourcePath));
			setWebcamVideoSourcePath(webcamSourcePath);
			setWebcamVideoPath(webcamSourcePath ? toFileUrl(webcamSourcePath) : null);
			setCurrentProjectPath(path ?? null);

			pushState({
				wallpaper: normalizedEditor.wallpaper,
				shadowIntensity: normalizedEditor.shadowIntensity,
				showBlur: normalizedEditor.showBlur,
				motionBlurAmount: normalizedEditor.motionBlurAmount,
				borderRadius: normalizedEditor.borderRadius,
				padding: normalizedEditor.padding,
				cropRegion: normalizedEditor.cropRegion,
				zoomRegions: normalizedEditor.zoomRegions,
				trimRegions: normalizedEditor.trimRegions,
				speedRegions: normalizedEditor.speedRegions,
				annotationRegions: normalizedEditor.annotationRegions,
				aspectRatio: normalizedEditor.aspectRatio,
				webcamLayoutPreset: normalizedEditor.webcamLayoutPreset,
				webcamPosition: normalizedEditor.webcamPosition,
				cursorSmoothing: normalizedEditor.cursorSmoothing ?? 0.5,
				cursorSway: normalizedEditor.cursorSway ?? 0.3,
				cursorStyle: normalizedEditor.cursorStyle ?? "default",
				showClickRings: normalizedEditor.showClickRings ?? true,
				showCursor: normalizedEditor.showCursor ?? true,
			});
			setExportQuality(normalizedEditor.exportQuality);
			setExportFormat(normalizedEditor.exportFormat);
			setGifFrameRate(normalizedEditor.gifFrameRate);
			setGifLoop(normalizedEditor.gifLoop);
			setGifSizePreset(normalizedEditor.gifSizePreset);

			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedSpeedId(null);
			setSelectedAnnotationId(null);

			nextZoomIdRef.current = deriveNextId(
				"zoom",
				normalizedEditor.zoomRegions.map((region) => region.id),
			);
			nextTrimIdRef.current = deriveNextId(
				"trim",
				normalizedEditor.trimRegions.map((region) => region.id),
			);
			nextSpeedIdRef.current = deriveNextId(
				"speed",
				normalizedEditor.speedRegions.map((region) => region.id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				normalizedEditor.annotationRegions.map((region) => region.id),
			);
			nextAnnotationZIndexRef.current =
				normalizedEditor.annotationRegions.reduce(
					(max, region) => Math.max(max, region.zIndex),
					0,
				) + 1;

			setLastSavedSnapshot(
				JSON.stringify(
					createProjectData(
						webcamSourcePath
							? { screenVideoPath: sourcePath, webcamVideoPath: webcamSourcePath }
							: { screenVideoPath: sourcePath },
						normalizedEditor,
					),
				),
			);
			return true;
		},
		[pushState],
	);

	const currentProjectSnapshot = useMemo(() => {
		if (!currentProjectMedia) {
			return null;
		}
		return JSON.stringify(
			createProjectData(currentProjectMedia, {
				wallpaper,
				shadowIntensity,
				showBlur,
				motionBlurAmount,
				borderRadius,
				padding,
				cropRegion,
				zoomRegions,
				trimRegions,
				speedRegions,
				annotationRegions,
				aspectRatio,
				webcamLayoutPreset,
				webcamPosition,
				exportQuality,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
				cursorSmoothing,
				cursorSway,
				cursorStyle,
				showClickRings,
				showCursor,
			}),
		);
	}, [
		currentProjectMedia,
		wallpaper,
		shadowIntensity,
		showBlur,
		motionBlurAmount,
		borderRadius,
		padding,
		cropRegion,
		zoomRegions,
		trimRegions,
		speedRegions,
		annotationRegions,
		aspectRatio,
		webcamLayoutPreset,
		webcamPosition,
		exportQuality,
		exportFormat,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		cursorSmoothing,
		cursorSway,
		cursorStyle,
		showClickRings,
		showCursor,
	]);

	const hasUnsavedChanges = Boolean(
		currentProjectPath &&
			currentProjectSnapshot &&
			lastSavedSnapshot &&
			currentProjectSnapshot !== lastSavedSnapshot,
	);

	useEffect(() => {
		async function loadInitialData() {
			setLoading(true);
			setError(null);
			try {
				const currentProjectResult = await window.electronAPI.loadCurrentProjectFile();
				if (currentProjectResult.success && currentProjectResult.project) {
					const restored = await applyLoadedProject(
						currentProjectResult.project,
						currentProjectResult.path ?? null,
					);
					if (restored) {
						return;
					}
				}

				const currentSessionResult = await window.electronAPI.getCurrentRecordingSession();
				if (currentSessionResult.success && currentSessionResult.session) {
					const session = currentSessionResult.session;
					const sourcePath = fromFileUrl(session.screenVideoPath);
					const webcamSourcePath = session.webcamVideoPath
						? fromFileUrl(session.webcamVideoPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(toFileUrl(sourcePath));
					setWebcamVideoSourcePath(webcamSourcePath);
					setWebcamVideoPath(webcamSourcePath ? toFileUrl(webcamSourcePath) : null);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					return;
				}

				const result = await window.electronAPI.getCurrentVideoPath();
				if (result.success && result.path) {
					const sourcePath = fromFileUrl(result.path);
					setVideoSourcePath(sourcePath);
					setVideoPath(toFileUrl(sourcePath));
					setWebcamVideoSourcePath(null);
					setWebcamVideoPath(null);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
				} else {
					setError("No video to load. Please record or select a video.");
				}
			} catch (err) {
				setError("Error loading video: " + String(err));
			} finally {
				setLoading(false);
			}
		}

		loadInitialData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [applyLoadedProject, reloadTrigger]);

	const saveProject = useCallback(
		async (forceSaveAs: boolean) => {
			if (!videoPath) {
				toast.error(t("errors.noVideoLoaded"));
				return false;
			}

			if (!currentProjectMedia) {
				toast.error(t("errors.unableToDetermineSourcePath"));
				return false;
			}

			const projectData = createProjectData(currentProjectMedia, {
				wallpaper,
				shadowIntensity,
				showBlur,
				motionBlurAmount,
				borderRadius,
				padding,
				cropRegion,
				zoomRegions,
				trimRegions,
				speedRegions,
				annotationRegions,
				aspectRatio,
				webcamLayoutPreset,
				webcamPosition,
				exportQuality,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
				cursorSmoothing,
				cursorSway,
				cursorStyle,
				showClickRings,
				showCursor,
			});

			const fileNameBase =
				currentProjectMedia.screenVideoPath
					.split(/[\\/]/)
					.pop()
					?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
			const projectSnapshot = JSON.stringify(projectData);
			const result = await window.electronAPI.saveProjectFile(
				projectData,
				fileNameBase,
				forceSaveAs ? undefined : (currentProjectPath ?? undefined),
			);

			if (result.canceled) {
				toast.info(t("project.saveCanceled"));
				return false;
			}

			if (!result.success) {
				toast.error(result.message || t("project.failedToSave"));
				return false;
			}

			if (result.path) {
				setCurrentProjectPath(result.path);
			}
			setLastSavedSnapshot(projectSnapshot);

			toast.success(t("project.savedTo", { path: result.path ?? "" }));
			return true;
		},
		[
			currentProjectMedia,
			currentProjectPath,
			wallpaper,
			shadowIntensity,
			showBlur,
			motionBlurAmount,
			borderRadius,
			padding,
			cropRegion,
			zoomRegions,
			trimRegions,
			speedRegions,
			annotationRegions,
			aspectRatio,
			webcamLayoutPreset,
			webcamPosition,
			exportQuality,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			cursorSmoothing,
			cursorSway,
			cursorStyle,
			showClickRings,
			showCursor,
			videoPath,
			t,
		],
	);

	useEffect(() => {
		window.electronAPI.setHasUnsavedChanges(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		const cleanup = window.electronAPI.onRequestSaveBeforeClose(async () => {
			return saveProject(false);
		});
		return () => cleanup();
	}, [saveProject]);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		await saveProject(true);
	}, [saveProject]);

	const handleLoadProject = useCallback(async () => {
		const result = await window.electronAPI.loadProjectFile();

		if (result.canceled) {
			return;
		}

		if (!result.success) {
			toast.error(result.message || "Failed to load project");
			return;
		}

		const restored = await applyLoadedProject(result.project, result.path ?? null);
		if (!restored) {
			toast.error("Invalid project file format");
			return;
		}

		toast.success(`Project loaded from ${result.path}`);
	}, [applyLoadedProject]);

	useEffect(() => {
		const removeNewRecording = window.electronAPI.onMenuNewRecording?.(() => {
			setShowRecordingSetup(true);
		});
		const removeLoadListener = window.electronAPI.onMenuLoadProject(handleLoadProject);
		const removeOpenVideo = window.electronAPI.onMenuOpenVideo?.(async () => {
			const result = await window.electronAPI.openVideoFilePicker();
			if (result.canceled) return;
			if (result.success && result.path) {
				await window.electronAPI.setCurrentVideoPath(result.path);
				setError(null);
				setReloadTrigger((prev) => prev + 1);
			}
		});
		const removeSaveListener = window.electronAPI.onMenuSaveProject(handleSaveProject);
		const removeSaveAsListener = window.electronAPI.onMenuSaveProjectAs(handleSaveProjectAs);

		return () => {
			removeNewRecording?.();
			removeLoadListener?.();
			removeOpenVideo?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleLoadProject, handleSaveProject, handleSaveProjectAs]);

	// Listen for stop-recording-from-bar event
	useEffect(() => {
		if (!window.electronAPI?.onStopRecordingFromBar) return;
		const cleanup = window.electronAPI.onStopRecordingFromBar(() => {
			if (recording) {
				toggleRecording();
			}
		});
		return cleanup;
	}, [recording, toggleRecording]);

	// Recording setup handlers
	const handleStartRecording = useCallback((config: RecordingConfig) => {
		setPendingRecordingConfig(config);
		setShowRecordingSetup(false);
		setShowCountdown(true);
	}, []);

	const handleCountdownComplete = useCallback(async () => {
		setShowCountdown(false);
		if (!pendingRecordingConfig) return;

		// Select the source via IPC
		await window.electronAPI.selectSource(pendingRecordingConfig.source);

		// Set mic/audio/webcam state
		setMicrophoneEnabled(pendingRecordingConfig.microphoneEnabled);
		setSystemAudioEnabled(pendingRecordingConfig.systemAudioEnabled);
		await setWebcamEnabled(pendingRecordingConfig.webcamEnabled);

		// Start recording with explicit config overrides to avoid stale state
		toggleRecording({
			mic: pendingRecordingConfig.microphoneEnabled,
			webcam: pendingRecordingConfig.webcamEnabled,
			systemAudio: pendingRecordingConfig.systemAudioEnabled,
		});

		setPendingRecordingConfig(null);
	}, [
		pendingRecordingConfig,
		setMicrophoneEnabled,
		setSystemAudioEnabled,
		setWebcamEnabled,
		toggleRecording,
	]);

	const handleCountdownCancel = useCallback(() => {
		setShowCountdown(false);
		setPendingRecordingConfig(null);
	}, []);

	const handleWelcomeNewRecording = useCallback(() => {
		setShowRecordingSetup(true);
	}, []);

	const handleWelcomeOpenVideo = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled) return;
		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			setReloadTrigger((prev) => prev + 1);
		}
	}, []);

	useEffect(() => {
		let mounted = true;

		async function loadCursorTelemetry() {
			const sourcePath = currentProjectMedia?.screenVideoPath ?? null;

			if (!sourcePath) {
				if (mounted) {
					setCursorTelemetry([]);
				}
				return;
			}

			try {
				const result = await window.electronAPI.getCursorTelemetry(sourcePath);
				if (mounted) {
					setCursorTelemetry(result.success ? result.samples : []);
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (mounted) {
					setCursorTelemetry([]);
				}
			}
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
		};
	}, [currentProjectMedia]);

	// Track cursor overlay container dimensions
	useEffect(() => {
		const el = cursorContainerRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				setCursorContainerSize({ width, height });
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	function togglePlayPause() {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!playback || !video) return;

		if (isPlaying) {
			playback.pause();
		} else {
			playback.play().catch((err) => console.error("Video play failed:", err));
		}
	}

	const toggleFullscreen = useCallback(() => {
		setIsFullscreen((prev) => !prev);
	}, []);

	useEffect(() => {
		if (!isFullscreen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsFullscreen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isFullscreen]);

	function handleSeek(time: number) {
		const video = videoPlaybackRef.current?.video;
		if (!video) return;
		video.currentTime = time;
	}

	const handleSelectZoom = useCallback((id: string | null) => {
		setSelectedZoomId(id);
		if (id) setSelectedTrimId(null);
	}, []);

	const handleSelectTrim = useCallback((id: string | null) => {
		setSelectedTrimId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedAnnotationId(null);
		}
	}, []);

	const handleSelectAnnotation = useCallback((id: string | null) => {
		setSelectedAnnotationId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedTrimId(null);
		}
	}, []);

	const handleZoomAdded = useCallback(
		(span: Span) => {
			const id = `zoom-${nextZoomIdRef.current++}`;
			const newRegion: ZoomRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				depth: DEFAULT_ZOOM_DEPTH,
				focus: { cx: 0.5, cy: 0.5 },
			};
			pushState((prev) => ({ zoomRegions: [...prev.zoomRegions, newRegion] }));
			setSelectedZoomId(id);
			setSelectedTrimId(null);
			setSelectedAnnotationId(null);
		},
		[pushState],
	);

	const handleZoomSuggested = useCallback(
		(span: Span, focus: ZoomFocus) => {
			const id = `zoom-${nextZoomIdRef.current++}`;
			const newRegion: ZoomRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				depth: DEFAULT_ZOOM_DEPTH,
				focus: clampFocusToDepth(focus, DEFAULT_ZOOM_DEPTH),
			};
			pushState((prev) => ({ zoomRegions: [...prev.zoomRegions, newRegion] }));
			setSelectedZoomId(id);
			setSelectedTrimId(null);
			setSelectedAnnotationId(null);
		},
		[pushState],
	);

	const handleTrimAdded = useCallback(
		(span: Span) => {
			const id = `trim-${nextTrimIdRef.current++}`;
			const newRegion: TrimRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
			};
			pushState((prev) => ({ trimRegions: [...prev.trimRegions, newRegion] }));
			setSelectedTrimId(id);
			setSelectedZoomId(null);
			setSelectedAnnotationId(null);
		},
		[pushState],
	);

	const handleZoomSpanChange = useCallback(
		(id: string, span: Span) => {
			pushState((prev) => ({
				zoomRegions: prev.zoomRegions.map((region) =>
					region.id === id
						? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) }
						: region,
				),
			}));
		},
		[pushState],
	);

	const handleTrimSpanChange = useCallback(
		(id: string, span: Span) => {
			pushState((prev) => ({
				trimRegions: prev.trimRegions.map((region) =>
					region.id === id
						? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) }
						: region,
				),
			}));
		},
		[pushState],
	);

	// Focus drag: updateState for live preview, commitState on pointer-up
	const handleZoomFocusChange = useCallback(
		(id: string, focus: ZoomFocus) => {
			updateState((prev) => ({
				zoomRegions: prev.zoomRegions.map((region) =>
					region.id === id ? { ...region, focus: clampFocusToDepth(focus, region.depth) } : region,
				),
			}));
		},
		[updateState],
	);

	const handleZoomDepthChange = useCallback(
		(depth: ZoomDepth) => {
			if (!selectedZoomId) return;
			pushState((prev) => ({
				zoomRegions: prev.zoomRegions.map((region) =>
					region.id === selectedZoomId
						? { ...region, depth, focus: clampFocusToDepth(region.focus, depth) }
						: region,
				),
			}));
		},
		[selectedZoomId, pushState],
	);

	const handleZoomDelete = useCallback(
		(id: string) => {
			pushState((prev) => ({ zoomRegions: prev.zoomRegions.filter((r) => r.id !== id) }));
			if (selectedZoomId === id) {
				setSelectedZoomId(null);
			}
		},
		[selectedZoomId, pushState],
	);

	const handleTrimDelete = useCallback(
		(id: string) => {
			pushState((prev) => ({ trimRegions: prev.trimRegions.filter((r) => r.id !== id) }));
			if (selectedTrimId === id) {
				setSelectedTrimId(null);
			}
		},
		[selectedTrimId, pushState],
	);

	const handleSelectSpeed = useCallback((id: string | null) => {
		setSelectedSpeedId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedAnnotationId(null);
		}
	}, []);

	const handleSpeedAdded = useCallback(
		(span: Span) => {
			const id = `speed-${nextSpeedIdRef.current++}`;
			const newRegion: SpeedRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				speed: DEFAULT_PLAYBACK_SPEED,
			};
			pushState((prev) => ({ speedRegions: [...prev.speedRegions, newRegion] }));
			setSelectedSpeedId(id);
			setSelectedZoomId(null);
			setSelectedTrimId(null);
			setSelectedAnnotationId(null);
		},
		[pushState],
	);

	const handleSpeedSpanChange = useCallback(
		(id: string, span: Span) => {
			pushState((prev) => ({
				speedRegions: prev.speedRegions.map((region) =>
					region.id === id
						? {
								...region,
								startMs: Math.round(span.start),
								endMs: Math.round(span.end),
							}
						: region,
				),
			}));
		},
		[pushState],
	);

	const handleSpeedDelete = useCallback(
		(id: string) => {
			pushState((prev) => ({
				speedRegions: prev.speedRegions.filter((region) => region.id !== id),
			}));
			if (selectedSpeedId === id) {
				setSelectedSpeedId(null);
			}
		},
		[selectedSpeedId, pushState],
	);

	const handleSpeedChange = useCallback(
		(speed: PlaybackSpeed) => {
			if (!selectedSpeedId) return;
			pushState((prev) => ({
				speedRegions: prev.speedRegions.map((region) =>
					region.id === selectedSpeedId ? { ...region, speed } : region,
				),
			}));
		},
		[selectedSpeedId, pushState],
	);

	const handleAnnotationAdded = useCallback(
		(span: Span) => {
			const id = `annotation-${nextAnnotationIdRef.current++}`;
			const zIndex = nextAnnotationZIndexRef.current++;
			const newRegion: AnnotationRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				type: "text",
				content: "Enter text...",
				position: { ...DEFAULT_ANNOTATION_POSITION },
				size: { ...DEFAULT_ANNOTATION_SIZE },
				style: { ...DEFAULT_ANNOTATION_STYLE },
				zIndex,
			};
			pushState((prev) => ({ annotationRegions: [...prev.annotationRegions, newRegion] }));
			setSelectedAnnotationId(id);
			setSelectedZoomId(null);
			setSelectedTrimId(null);
		},
		[pushState],
	);

	const handleAnnotationSpanChange = useCallback(
		(id: string, span: Span) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) =>
					region.id === id
						? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) }
						: region,
				),
			}));
		},
		[pushState],
	);

	const handleAnnotationDelete = useCallback(
		(id: string) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.filter((r) => r.id !== id),
			}));
			if (selectedAnnotationId === id) {
				setSelectedAnnotationId(null);
			}
		},
		[selectedAnnotationId, pushState],
	);

	const handleAnnotationContentChange = useCallback(
		(id: string, content: string) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) => {
					if (region.id !== id) return region;
					if (region.type === "text") {
						return { ...region, content, textContent: content };
					} else if (region.type === "image") {
						return { ...region, content, imageContent: content };
					}
					return { ...region, content };
				}),
			}));
		},
		[pushState],
	);

	const handleAnnotationTypeChange = useCallback(
		(id: string, type: AnnotationRegion["type"]) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) => {
					if (region.id !== id) return region;
					const updatedRegion = { ...region, type };
					if (type === "text") {
						updatedRegion.content = region.textContent || "Enter text...";
					} else if (type === "image") {
						updatedRegion.content = region.imageContent || "";
					} else if (type === "figure") {
						updatedRegion.content = "";
						if (!region.figureData) {
							updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
						}
					}
					return updatedRegion;
				}),
			}));
		},
		[pushState],
	);

	const handleAnnotationStyleChange = useCallback(
		(id: string, style: Partial<AnnotationRegion["style"]>) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) =>
					region.id === id ? { ...region, style: { ...region.style, ...style } } : region,
				),
			}));
		},
		[pushState],
	);

	const handleAnnotationFigureDataChange = useCallback(
		(id: string, figureData: FigureData) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) =>
					region.id === id ? { ...region, figureData } : region,
				),
			}));
		},
		[pushState],
	);

	const handleAnnotationPositionChange = useCallback(
		(id: string, position: { x: number; y: number }) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) =>
					region.id === id ? { ...region, position } : region,
				),
			}));
		},
		[pushState],
	);

	const handleAnnotationSizeChange = useCallback(
		(id: string, size: { width: number; height: number }) => {
			pushState((prev) => ({
				annotationRegions: prev.annotationRegions.map((region) =>
					region.id === id ? { ...region, size } : region,
				),
			}));
		},
		[pushState],
	);

	// ── Caption handlers ──
	const handleCaptionStyleChange = useCallback(
		(styleUpdate: Partial<CaptionStyle>) => {
			pushState((prev) => ({
				captionStyle: { ...prev.captionStyle, ...styleUpdate },
			}));
		},
		[pushState],
	);

	const handleCaptionTrackChange = useCallback(
		(track: CaptionTrack | null) => {
			pushState({ captionTrack: track });
		},
		[pushState],
	);

	const handleAutoCaption = useCallback(async () => {
		const sourcePath = videoSourcePath ?? (videoPath ? videoPath.replace(/^file:\/\//, "") : null);
		if (!sourcePath) {
			toast.error("No video loaded");
			return;
		}

		setIsTranscribing(true);
		try {
			const result = await window.electronAPI.whisperTranscribe(sourcePath, { modelId: "base" });
			if (result.success && result.captionTrack) {
				pushState({ captionTrack: result.captionTrack });
				toast.success(`Auto-captioned: ${result.captionTrack.lines.length} lines detected`);
			} else {
				toast.error(result.error || "Transcription failed");
			}
		} catch (err) {
			toast.error(`Transcription error: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setIsTranscribing(false);
		}
	}, [videoSourcePath, videoPath, pushState]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const mod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();

			if (mod && key === "z" && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				undo();
				return;
			}
			if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
				e.preventDefault();
				e.stopPropagation();
				redo();
				return;
			}

			const isInput =
				e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

			if (e.key === "Tab" && !isInput) {
				e.preventDefault();
			}

			if (matchesShortcut(e, shortcuts.playPause, isMac)) {
				if (isInput) return;
				e.preventDefault();
				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					playback.video.paused ? playback.play().catch(console.error) : playback.pause();
				}
				return;
			}

			if (matchesShortcut(e, shortcuts.togglePlay, isMac)) {
				if (isInput) return;
				e.preventDefault();
				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					playback.video.paused ? playback.play().catch(console.error) : playback.pause();
				}
				return;
			}

			if (matchesShortcut(e, shortcuts.export, isMac)) {
				e.preventDefault();
				handleOpenExportDialogRef.current();
				return;
			}

			if (matchesShortcut(e, shortcuts.toggleCaptions, isMac)) {
				if (isInput) return;
				e.preventDefault();
				// Toggle captions: hide if visible, show stored track if hidden
				setCaptionsHidden((prev) => {
					const next = !prev;
					if (next) {
						// Hiding — stash current track and set null
						captionTrackStashRef.current = captionTrackRef.current;
						pushState({ captionTrack: null });
					} else {
						// Showing — restore stashed track
						if (captionTrackStashRef.current) {
							pushState({ captionTrack: captionTrackStashRef.current });
						}
					}
					return next;
				});
				return;
			}

			if (matchesShortcut(e, shortcuts.toggleCursor, isMac)) {
				if (isInput) return;
				e.preventDefault();
				pushState((prev) => ({ showCursor: !prev.showCursor }));
				return;
			}

			// zoomIn / zoomOut — reserved for future timeline zoom control
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [undo, redo, shortcuts, isMac, pushState]);

	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
			setSelectedZoomId(null);
		}
	}, [selectedZoomId, zoomRegions]);

	useEffect(() => {
		if (selectedTrimId && !trimRegions.some((region) => region.id === selectedTrimId)) {
			setSelectedTrimId(null);
		}
	}, [selectedTrimId, trimRegions]);

	useEffect(() => {
		if (
			selectedAnnotationId &&
			!annotationRegions.some((region) => region.id === selectedAnnotationId)
		) {
			setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, annotationRegions]);

	useEffect(() => {
		if (selectedSpeedId && !speedRegions.some((region) => region.id === selectedSpeedId)) {
			setSelectedSpeedId(null);
		}
	}, [selectedSpeedId, speedRegions]);

	const handleShowExportedFile = useCallback(async (filePath: string) => {
		try {
			const result = await window.electronAPI.revealInFolder(filePath);
			if (!result.success) {
				const errorMessage = result.error || result.message || "Failed to reveal item in folder.";
				console.error("Failed to reveal in folder:", errorMessage);
				toast.error(errorMessage);
			}
		} catch (error) {
			const errorMessage = String(error);
			console.error("Error calling revealInFolder IPC:", errorMessage);
			toast.error(`Error revealing in folder: ${errorMessage}`);
		}
	}, []);

	const handleExportSaved = useCallback(
		(formatLabel: "GIF" | "Video", filePath: string) => {
			setExportedFilePath(filePath);
			toast.success(`${formatLabel} exported successfully`, {
				description: filePath,
				action: {
					label: "Show in Folder",
					onClick: () => {
						void handleShowExportedFile(filePath);
					},
				},
			});
		},
		[handleShowExportedFile],
	);

	const handleSaveUnsavedExport = useCallback(async () => {
		if (!unsavedExport) return;
		try {
			const saveResult = await window.electronAPI.saveExportedVideo(
				unsavedExport.arrayBuffer,
				unsavedExport.fileName,
			);
			if (saveResult.canceled) {
				toast.info("Export canceled");
			} else if (saveResult.success && saveResult.path) {
				setUnsavedExport(null);
				handleExportSaved(unsavedExport.format === "gif" ? "GIF" : "Video", saveResult.path);
			} else {
				toast.error(saveResult.message || "Failed to save export");
			}
		} catch (error) {
			console.error("Error saving unsaved export:", error);
			toast.error("Failed to save exported video");
		}
	}, [unsavedExport, handleExportSaved]);

	const handleExport = useCallback(
		async (settings: ExportSettings) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error("Video not ready");
				return;
			}

			setIsExporting(true);
			setExportProgress(null);
			setExportError(null);
			setExportedFilePath(null);

			try {
				const wasPlaying = isPlaying;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				const sourceWidth = video.videoWidth || 1920;
				const sourceHeight = video.videoHeight || 1080;
				const aspectRatioValue =
					aspectRatio === "native"
						? getNativeAspectRatioValue(sourceWidth, sourceHeight, cropRegion)
						: getAspectRatioValue(aspectRatio);

				// Get preview CONTAINER dimensions for scaling
				const playbackRef = videoPlaybackRef.current;
				const containerElement = playbackRef?.containerRef?.current;
				const previewWidth = containerElement?.clientWidth || 1920;
				const previewHeight = containerElement?.clientHeight || 1080;

				if (settings.format === "gif" && settings.gifConfig) {
					// GIF Export
					const gifExporter = new GifExporter({
						videoUrl: videoPath,
						webcamVideoUrl: webcamVideoPath || undefined,
						width: settings.gifConfig.width,
						height: settings.gifConfig.height,
						frameRate: settings.gifConfig.frameRate,
						loop: settings.gifConfig.loop,
						sizePreset: settings.gifConfig.sizePreset,
						wallpaper,
						zoomRegions,
						trimRegions,
						speedRegions,
						showShadow: shadowIntensity > 0,
						shadowIntensity,
						showBlur,
						motionBlurAmount,
						borderRadius,
						padding,
						videoPadding: padding,
						cropRegion,
						annotationRegions,
						webcamLayoutPreset,
						webcamPosition,
						previewWidth,
						previewHeight,
						cursorTelemetry,
						showCursor,
						cursorStyle,
						cursorSmoothing,
						cursorSway,
						showClickRings,
						captionTrack,
						captionStyle,
						onProgress: (progress: ExportProgress) => {
							setExportProgress(progress);
						},
					});

					exporterRef.current = gifExporter as unknown as VideoExporter;
					const result = await gifExporter.export();

					if (result.success && result.blob) {
						const arrayBuffer = await result.blob.arrayBuffer();
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.gif`;

						const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

						if (saveResult.canceled) {
							setUnsavedExport({ arrayBuffer, fileName, format: "gif" });
							toast.info("Export canceled");
						} else if (saveResult.success && saveResult.path) {
							setUnsavedExport(null);
							handleExportSaved("GIF", saveResult.path);
						} else {
							setExportError(saveResult.message || "Failed to save GIF");
							toast.error(saveResult.message || "Failed to save GIF");
						}
					} else {
						setExportError(result.error || "GIF export failed");
						toast.error(result.error || "GIF export failed");
					}
				} else {
					// MP4 Export
					const quality = settings.quality || exportQuality;
					let exportWidth: number;
					let exportHeight: number;
					let bitrate: number;

					if (quality === "source") {
						// Use source resolution
						exportWidth = sourceWidth;
						exportHeight = sourceHeight;

						if (aspectRatioValue === 1) {
							// Square (1:1): use smaller dimension to avoid codec limits
							const baseDimension = Math.floor(Math.min(sourceWidth, sourceHeight) / 2) * 2;
							exportWidth = baseDimension;
							exportHeight = baseDimension;
						} else if (aspectRatioValue > 1) {
							// Landscape: find largest even dimensions that exactly match aspect ratio
							const baseWidth = Math.floor(sourceWidth / 2) * 2;
							let found = false;
							for (let w = baseWidth; w >= 100 && !found; w -= 2) {
								const h = Math.round(w / aspectRatioValue);
								if (h % 2 === 0 && Math.abs(w / h - aspectRatioValue) < 0.0001) {
									exportWidth = w;
									exportHeight = h;
									found = true;
								}
							}
							if (!found) {
								exportWidth = baseWidth;
								exportHeight = Math.floor(baseWidth / aspectRatioValue / 2) * 2;
							}
						} else {
							// Portrait: find largest even dimensions that exactly match aspect ratio
							const baseHeight = Math.floor(sourceHeight / 2) * 2;
							let found = false;
							for (let h = baseHeight; h >= 100 && !found; h -= 2) {
								const w = Math.round(h * aspectRatioValue);
								if (w % 2 === 0 && Math.abs(w / h - aspectRatioValue) < 0.0001) {
									exportWidth = w;
									exportHeight = h;
									found = true;
								}
							}
							if (!found) {
								exportHeight = baseHeight;
								exportWidth = Math.floor((baseHeight * aspectRatioValue) / 2) * 2;
							}
						}

						// Calculate visually lossless bitrate matching screen recording optimization
						const totalPixels = exportWidth * exportHeight;
						bitrate = 30_000_000;
						if (totalPixels > 1920 * 1080 && totalPixels <= 2560 * 1440) {
							bitrate = 50_000_000;
						} else if (totalPixels > 2560 * 1440) {
							bitrate = 80_000_000;
						}
					} else {
						// Use quality-based target resolution
						const targetHeight = quality === "medium" ? 720 : 1080;

						// Calculate dimensions maintaining aspect ratio
						exportHeight = Math.floor(targetHeight / 2) * 2;
						exportWidth = Math.floor((exportHeight * aspectRatioValue) / 2) * 2;

						// Adjust bitrate for lower resolutions
						const totalPixels = exportWidth * exportHeight;
						if (totalPixels <= 1280 * 720) {
							bitrate = 10_000_000;
						} else if (totalPixels <= 1920 * 1080) {
							bitrate = 20_000_000;
						} else {
							bitrate = 30_000_000;
						}
					}

					const exporter = new VideoExporter({
						videoUrl: videoPath,
						webcamVideoUrl: webcamVideoPath || undefined,
						width: exportWidth,
						height: exportHeight,
						frameRate: 60,
						bitrate,
						codec: "avc1.640033",
						wallpaper,
						zoomRegions,
						trimRegions,
						speedRegions,
						showShadow: shadowIntensity > 0,
						shadowIntensity,
						showBlur,
						motionBlurAmount,
						borderRadius,
						padding,
						cropRegion,
						annotationRegions,
						webcamLayoutPreset,
						webcamPosition,
						previewWidth,
						previewHeight,
						cursorTelemetry,
						showCursor,
						cursorStyle,
						cursorSmoothing,
						cursorSway,
						showClickRings,
						captionTrack,
						captionStyle,
						onProgress: (progress: ExportProgress) => {
							setExportProgress(progress);
						},
					});

					exporterRef.current = exporter;
					const result = await exporter.export();

					if (result.success && result.blob) {
						const arrayBuffer = await result.blob.arrayBuffer();
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.mp4`;

						const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

						if (saveResult.canceled) {
							setUnsavedExport({ arrayBuffer, fileName, format: "mp4" });
							toast.info("Export canceled");
						} else if (saveResult.success && saveResult.path) {
							setUnsavedExport(null);
							handleExportSaved("Video", saveResult.path);
						} else {
							setExportError(saveResult.message || "Failed to save video");
							toast.error(saveResult.message || "Failed to save video");
						}
					} else {
						setExportError(result.error || "Export failed");
						toast.error(result.error || "Export failed");
					}
				}

				if (wasPlaying) {
					videoPlaybackRef.current?.play();
				}
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				setExportError(errorMessage);
				toast.error(`Export failed: ${errorMessage}`);
			} finally {
				setIsExporting(false);
				exporterRef.current = null;
				// Reset dialog state to ensure it can be opened again on next export
				// This fixes the bug where second export doesn't show save dialog
				setShowExportDialog(false);
				setExportProgress(null);
			}
		},
		[
			videoPath,
			webcamVideoPath,
			wallpaper,
			zoomRegions,
			trimRegions,
			speedRegions,
			shadowIntensity,
			showBlur,
			motionBlurAmount,
			borderRadius,
			padding,
			cropRegion,
			annotationRegions,
			isPlaying,
			aspectRatio,
			webcamLayoutPreset,
			webcamPosition,
			exportQuality,
			cursorTelemetry,
			showCursor,
			cursorStyle,
			cursorSmoothing,
			cursorSway,
			showClickRings,
			handleExportSaved,
			captionTrack,
			captionStyle,
		],
	);

	const handleScreenshot = useCallback(async () => {
		const canvas = videoPlaybackRef.current?.app?.canvas;
		if (!canvas) {
			toast.error("No canvas available for screenshot");
			return;
		}

		const blob = await new Promise<Blob | null>((resolve) => {
			(canvas as HTMLCanvasElement).toBlob(resolve, "image/png");
		});
		if (!blob) {
			toast.error("Failed to capture screenshot");
			return;
		}

		const buffer = await blob.arrayBuffer();
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const result = await window.electronAPI.saveScreenshot(
			buffer,
			`lucid-screenshot-${timestamp}.png`,
		);
		if (result.success) {
			toast.success("Screenshot saved", { description: result.path });
		} else if (!result.canceled) {
			toast.error("Failed to save screenshot", { description: result.error });
		}
	}, []);

	const handleOpenExportDialog = useCallback(() => {
		if (!videoPath) {
			toast.error("No video loaded");
			return;
		}

		const video = videoPlaybackRef.current?.video;
		if (!video) {
			toast.error("Video not ready");
			return;
		}

		// Build export settings from current state
		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const aspectRatioValue =
			aspectRatio === "native"
				? getNativeAspectRatioValue(sourceWidth, sourceHeight, cropRegion)
				: getAspectRatioValue(aspectRatio);
		const gifDimensions = calculateOutputDimensions(
			sourceWidth,
			sourceHeight,
			gifSizePreset,
			GIF_SIZE_PRESETS,
			aspectRatioValue,
		);

		const settings: ExportSettings = {
			format: exportFormat,
			quality: exportFormat === "mp4" ? exportQuality : undefined,
			gifConfig:
				exportFormat === "gif"
					? {
							frameRate: gifFrameRate,
							loop: gifLoop,
							sizePreset: gifSizePreset,
							width: gifDimensions.width,
							height: gifDimensions.height,
						}
					: undefined,
		};

		setShowExportDialog(true);
		setExportError(null);
		setExportedFilePath(null);

		// Start export immediately
		handleExport(settings);
	}, [
		videoPath,
		exportFormat,
		exportQuality,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		aspectRatio,
		cropRegion,
		handleExport,
	]);

	// Keep refs in sync for the keyboard shortcut handler
	handleOpenExportDialogRef.current = handleOpenExportDialog;
	captionTrackRef.current = captionTrack;

	const handleCancelExport = useCallback(() => {
		if (exporterRef.current) {
			exporterRef.current.cancel();
			toast.info("Export canceled");
			setShowExportDialog(false);
			setIsExporting(false);
			setExportProgress(null);
			setExportError(null);
			setExportedFilePath(null);
		}
	}, []);

	// ── AI Feature handlers ──

	const handleMagicPolish = useCallback(() => {
		if (cursorTelemetry.length === 0 || duration <= 0) return;

		const result = generatePolishEdits({
			cursorTelemetry,
			videoDurationMs: duration * 1000,
			currentState: editorState,
		});

		setPolishPreview(result.preview);
		setPolishEdits(result.edits);
		setShowPolishDialog(true);
	}, [cursorTelemetry, duration, editorState]);

	const handleApplyPolish = useCallback(() => {
		if (!polishEdits) return;
		pushState(polishEdits);
		setShowPolishDialog(false);
		setPolishPreview(null);
		setPolishEdits(null);
		toast.success("Magic Polish applied!");
	}, [polishEdits, pushState]);

	const handleCancelPolish = useCallback(() => {
		setShowPolishDialog(false);
		setPolishPreview(null);
		setPolishEdits(null);
	}, []);

	const handleAIApplyEdits = useCallback(
		(edits: Partial<EditorState>) => {
			pushState(edits);
		},
		[pushState],
	);

	const handleAcceptTrimSuggestions = useCallback(
		(trims: { id: string; startMs: number; endMs: number }[]) => {
			pushState((prev) => ({
				trimRegions: [...prev.trimRegions, ...trims],
			}));
		},
		[pushState],
	);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen bg-background">
				<div className="text-foreground">Loading video...</div>
			</div>
		);
	}
	if (recording) {
		return (
			<LiveMonitor
				screenStream={liveScreenStream}
				webcamStream={liveWebcamStream}
				onStop={() => toggleRecording()}
				onMinimize={async () => {
					await window.electronAPI?.showRecordingBar();
				}}
			/>
		);
	}
	if (error || !videoPath) {
		return (
			<>
				<WelcomeScreen
					onNewRecording={handleWelcomeNewRecording}
					onOpenVideo={handleWelcomeOpenVideo}
					onOpenProject={() => setShowProjectBrowser(true)}
				/>
				<RecordingSetupDialog
					open={showRecordingSetup}
					onOpenChange={setShowRecordingSetup}
					onStartRecording={handleStartRecording}
				/>
				<ProjectBrowser
					open={showProjectBrowser}
					onOpenChange={setShowProjectBrowser}
					onProjectOpened={() => {
						setError(null);
						setReloadTrigger((prev) => prev + 1);
					}}
				/>
				{showCountdown && (
					<CountdownOverlay onComplete={handleCountdownComplete} onCancel={handleCountdownCancel} />
				)}
			</>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-[#09090b] text-slate-200 overflow-hidden selection:bg-[#2563eb]/30">
			<div
				className="h-10 flex-shrink-0 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-50"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div
					className="flex-1 flex items-center gap-1"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<div
						className={`flex items-center gap-1 px-2 py-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-150 ${isMac ? "ml-14" : "ml-2"}`}
					>
						<Languages size={14} />
						<select
							value={locale}
							onChange={(e) => setLocale(e.target.value as Locale)}
							className="bg-transparent text-[11px] font-medium outline-none cursor-pointer appearance-none pr-1"
							style={{ color: "inherit" }}
						>
							{SUPPORTED_LOCALES.map((loc) => (
								<option key={loc} value={loc} className="bg-[#09090b] text-white">
									{getLocaleName(loc)}
								</option>
							))}
						</select>
					</div>
					<button
						type="button"
						onClick={() => setShowRecordingSetup(true)}
						className="flex items-center gap-1 px-2 py-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-150 text-[11px] font-medium"
						title="Start a new recording"
					>
						<Video size={14} />
						New Recording
					</button>
					<button
						type="button"
						onClick={() => setShowProjectBrowser(true)}
						className="flex items-center gap-1 px-2 py-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-150 text-[11px] font-medium"
					>
						<FolderOpen size={14} />
						{ts("project.load")}
					</button>
					<button
						type="button"
						onClick={handleSaveProject}
						className="flex items-center gap-1 px-2 py-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-150 text-[11px] font-medium"
					>
						<Save size={14} />
						{ts("project.save")}
					</button>
				</div>
				<div
					className="flex items-center gap-1"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<button
						type="button"
						onClick={handleMagicPolish}
						disabled={cursorTelemetry.length === 0 || duration <= 0}
						className="flex items-center gap-1 px-2 py-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-150 text-[11px] font-medium disabled:opacity-30 disabled:cursor-not-allowed"
						title="Magic Polish — auto-enhance your recording"
					>
						<Wand2 size={14} />
						Magic Polish
					</button>
					<button
						type="button"
						onClick={handleScreenshot}
						disabled={!videoPath}
						className="flex items-center gap-1 px-2 py-1 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-150 text-[11px] font-medium disabled:opacity-30 disabled:cursor-not-allowed"
						title="Save current frame as image"
					>
						<Camera size={14} />
						Screenshot
					</button>
					<button
						type="button"
						onClick={() => {
							if (!showAIPanel) {
								setShowAIPanel(true);
								setAIPanelMode("chat");
							} else if (aiPanelMode === "chat") {
								setAIPanelMode("tools");
							} else {
								setShowAIPanel(false);
							}
						}}
						className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-150 text-[11px] font-medium ${
							showAIPanel
								? "text-[#2563eb] bg-[#2563eb]/10"
								: "text-white/50 hover:text-white/90 hover:bg-white/10"
						}`}
						title="Toggle AI panel (Chat / Tools)"
					>
						{showAIPanel && aiPanelMode === "chat" ? (
							<MessageSquare size={14} />
						) : (
							<Sparkles size={14} />
						)}
						AI{showAIPanel ? (aiPanelMode === "chat" ? " Chat" : " Tools") : ""}
					</button>
				</div>
			</div>

			{/* Magic Polish confirmation dialog */}
			{showPolishDialog && polishPreview && (
				<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-[#18181b] rounded-xl border border-white/10 shadow-2xl p-6 max-w-sm w-full mx-4">
						<div className="flex items-center gap-2 mb-4">
							<Wand2 size={18} className="text-[#2563eb]" />
							<h3 className="text-sm font-semibold text-white">Magic Polish Preview</h3>
						</div>
						<div className="space-y-1.5 mb-5 text-xs text-white/70">
							{polishPreview.zoomCount > 0 && (
								<div>
									+ {polishPreview.zoomCount} auto-zoom region
									{polishPreview.zoomCount !== 1 ? "s" : ""}
								</div>
							)}
							{polishPreview.trimCount > 0 && (
								<div>
									+ {polishPreview.trimCount} auto-trim{polishPreview.trimCount !== 1 ? "s" : ""}
								</div>
							)}
							{polishPreview.speedRampCount > 0 && (
								<div>
									+ {polishPreview.speedRampCount} speed ramp
									{polishPreview.speedRampCount !== 1 ? "s" : ""}
								</div>
							)}
							{polishPreview.wallpaperChanged && <div>+ Set default wallpaper</div>}
							{polishPreview.borderRadiusChanged && <div>+ Border radius: 12px</div>}
							{polishPreview.paddingChanged && <div>+ Padding: 8px</div>}
							{!polishPreview.zoomCount &&
								!polishPreview.trimCount &&
								!polishPreview.speedRampCount &&
								!polishPreview.wallpaperChanged &&
								!polishPreview.borderRadiusChanged &&
								!polishPreview.paddingChanged && (
									<div className="text-white/40">No changes needed — recording looks good!</div>
								)}
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleApplyPolish}
								className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#2563eb] hover:bg-[#2563eb]/90 text-white transition-colors"
							>
								Apply Changes
							</button>
							<button
								type="button"
								onClick={handleCancelPolish}
								className="px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			<div className="flex-1 min-h-0 relative p-3">
				<PanelGroup direction="horizontal" className="h-full gap-1">
					{/* Left Column - Video & Timeline */}
					<Panel defaultSize={60} minSize={35}>
						<div className="flex flex-col gap-3 min-w-0 h-full">
							<PanelGroup direction="vertical" className="gap-3">
								{/* Top section: video preview and controls */}
								<Panel defaultSize={70} maxSize={70} minSize={40}>
									<div
										ref={playerContainerRef}
										className={
											isFullscreen
												? "fixed inset-0 z-[99999] w-full h-full flex flex-col items-center justify-center bg-[#09090b]"
												: "w-full h-full flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative"
										}
									>
										{/* Video preview */}
										<div className="w-full flex justify-center items-center flex-auto mt-1.5">
											<div
												ref={cursorContainerRef}
												className="relative flex justify-center items-center w-auto h-full max-w-full box-border"
												style={{
													aspectRatio:
														aspectRatio === "native"
															? getNativeAspectRatioValue(
																	videoPlaybackRef.current?.video?.videoWidth || 1920,
																	videoPlaybackRef.current?.video?.videoHeight || 1080,
																	cropRegion,
																)
															: getAspectRatioValue(aspectRatio),
												}}
											>
												<VideoPlayback
													key={`${videoPath || "no-video"}:${webcamVideoPath || "no-webcam"}`}
													aspectRatio={aspectRatio}
													ref={videoPlaybackRef}
													videoPath={videoPath || ""}
													webcamVideoPath={webcamVideoPath || undefined}
													webcamLayoutPreset={webcamLayoutPreset}
													webcamPosition={webcamPosition}
													onWebcamPositionChange={(pos) => updateState({ webcamPosition: pos })}
													onWebcamPositionDragEnd={commitState}
													onDurationChange={setDuration}
													onTimeUpdate={setCurrentTime}
													currentTime={currentTime}
													onPlayStateChange={setIsPlaying}
													onError={setError}
													wallpaper={previewWallpaper ?? wallpaper}
													zoomRegions={zoomRegions}
													selectedZoomId={selectedZoomId}
													onSelectZoom={handleSelectZoom}
													onZoomFocusChange={handleZoomFocusChange}
													onZoomFocusDragEnd={commitState}
													isPlaying={isPlaying}
													showShadow={shadowIntensity > 0}
													shadowIntensity={shadowIntensity}
													showBlur={showBlur}
													motionBlurAmount={motionBlurAmount}
													borderRadius={borderRadius}
													padding={padding}
													cropRegion={cropRegion}
													trimRegions={trimRegions}
													speedRegions={speedRegions}
													annotationRegions={annotationRegions}
													selectedAnnotationId={selectedAnnotationId}
													onSelectAnnotation={handleSelectAnnotation}
													onAnnotationPositionChange={handleAnnotationPositionChange}
													onAnnotationSizeChange={handleAnnotationSizeChange}
													captionTrack={captionTrack}
													captionStyle={captionStyle}
												/>
												{showCursor && cursorTelemetry.length > 0 && (
													<CursorOverlay
														cursorTelemetry={cursorTelemetry}
														currentTimeS={currentTime}
														isPlaying={isPlaying}
														containerWidth={cursorContainerSize.width}
														containerHeight={cursorContainerSize.height}
														cursorSmoothing={cursorSmoothing}
														cursorSway={cursorSway}
														cursorStyle={cursorStyle}
														showClickRings={showClickRings}
														showCursor={showCursor}
													/>
												)}
											</div>
										</div>
										{/* Playback controls */}
										<div className="w-full flex justify-center items-center h-12 flex-shrink-0 px-3 py-1.5 my-1.5">
											<div className="w-full max-w-[700px]">
												<PlaybackControls
													isPlaying={isPlaying}
													currentTime={currentTime}
													duration={duration}
													isFullscreen={isFullscreen}
													onToggleFullscreen={toggleFullscreen}
													onTogglePlayPause={togglePlayPause}
													onSeek={handleSeek}
												/>
											</div>
										</div>
									</div>
								</Panel>

								<PanelResizeHandle className="bg-[#09090b]/80 hover:bg-[#09090b] transition-colors rounded-full flex items-center justify-center">
									<div className="w-8 h-1 bg-white/20 rounded-full"></div>
								</PanelResizeHandle>

								{/* Timeline section */}
								<Panel defaultSize={30} maxSize={60} minSize={30}>
									<div className="h-full bg-[#09090b] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
										<TimelineEditor
											videoDuration={duration}
											currentTime={currentTime}
											onSeek={handleSeek}
											cursorTelemetry={cursorTelemetry}
											zoomRegions={zoomRegions}
											onZoomAdded={handleZoomAdded}
											onZoomSuggested={handleZoomSuggested}
											onZoomSpanChange={handleZoomSpanChange}
											onZoomDelete={handleZoomDelete}
											selectedZoomId={selectedZoomId}
											onSelectZoom={handleSelectZoom}
											trimRegions={trimRegions}
											onTrimAdded={handleTrimAdded}
											onTrimSpanChange={handleTrimSpanChange}
											onTrimDelete={handleTrimDelete}
											selectedTrimId={selectedTrimId}
											onSelectTrim={handleSelectTrim}
											speedRegions={speedRegions}
											onSpeedAdded={handleSpeedAdded}
											onSpeedSpanChange={handleSpeedSpanChange}
											onSpeedDelete={handleSpeedDelete}
											selectedSpeedId={selectedSpeedId}
											onSelectSpeed={handleSelectSpeed}
											annotationRegions={annotationRegions}
											onAnnotationAdded={handleAnnotationAdded}
											onAnnotationSpanChange={handleAnnotationSpanChange}
											onAnnotationDelete={handleAnnotationDelete}
											selectedAnnotationId={selectedAnnotationId}
											onSelectAnnotation={handleSelectAnnotation}
											aspectRatio={aspectRatio}
											onAspectRatioChange={(ar) =>
												pushState({
													aspectRatio: ar,
													webcamLayoutPreset:
														!isPortraitAspectRatio(ar) && webcamLayoutPreset === "vertical-stack"
															? "picture-in-picture"
															: webcamLayoutPreset,
												})
											}
											captionTrack={captionTrack}
											onAutoCaption={handleAutoCaption}
											isTranscribing={isTranscribing}
										/>
									</div>
								</Panel>
							</PanelGroup>
						</div>
					</Panel>

					<PanelResizeHandle className="w-1 rounded-full bg-white/5 hover:bg-[#2563eb]/40 transition-colors" />

					{/* Right section: settings panel */}
					<Panel defaultSize={22} minSize={15} maxSize={35}>
						<div className="h-full overflow-y-auto">
							<SettingsPanel
								selected={wallpaper}
								onWallpaperChange={(w) => {
									setPreviewWallpaper(null);
									pushState({ wallpaper: w });
								}}
								onWallpaperHover={setPreviewWallpaper}
								onWallpaperHoverEnd={() => setPreviewWallpaper(null)}
								selectedZoomDepth={
									selectedZoomId ? zoomRegions.find((z) => z.id === selectedZoomId)?.depth : null
								}
								onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
								selectedZoomId={selectedZoomId}
								onZoomDelete={handleZoomDelete}
								selectedTrimId={selectedTrimId}
								onTrimDelete={handleTrimDelete}
								shadowIntensity={shadowIntensity}
								onShadowChange={(v) => updateState({ shadowIntensity: v })}
								onShadowCommit={commitState}
								showBlur={showBlur}
								onBlurChange={(v) => pushState({ showBlur: v })}
								motionBlurAmount={motionBlurAmount}
								onMotionBlurChange={(v) => updateState({ motionBlurAmount: v })}
								onMotionBlurCommit={commitState}
								borderRadius={borderRadius}
								onBorderRadiusChange={(v) => updateState({ borderRadius: v })}
								onBorderRadiusCommit={commitState}
								padding={padding}
								onPaddingChange={(v) => updateState({ padding: v })}
								onPaddingCommit={commitState}
								cropRegion={cropRegion}
								onCropChange={(r) => pushState({ cropRegion: r })}
								aspectRatio={aspectRatio}
								hasWebcam={Boolean(webcamVideoPath)}
								webcamLayoutPreset={webcamLayoutPreset}
								onWebcamLayoutPresetChange={(preset) =>
									pushState({
										webcamLayoutPreset: preset,
										webcamPosition: preset === "vertical-stack" ? null : webcamPosition,
									})
								}
								videoElement={videoPlaybackRef.current?.video || null}
								exportQuality={exportQuality}
								onExportQualityChange={setExportQuality}
								exportFormat={exportFormat}
								onExportFormatChange={setExportFormat}
								gifFrameRate={gifFrameRate}
								onGifFrameRateChange={setGifFrameRate}
								gifLoop={gifLoop}
								onGifLoopChange={setGifLoop}
								gifSizePreset={gifSizePreset}
								onGifSizePresetChange={setGifSizePreset}
								gifOutputDimensions={calculateOutputDimensions(
									videoPlaybackRef.current?.video?.videoWidth || 1920,
									videoPlaybackRef.current?.video?.videoHeight || 1080,
									gifSizePreset,
									GIF_SIZE_PRESETS,
									aspectRatio === "native"
										? getNativeAspectRatioValue(
												videoPlaybackRef.current?.video?.videoWidth || 1920,
												videoPlaybackRef.current?.video?.videoHeight || 1080,
												cropRegion,
											)
										: getAspectRatioValue(aspectRatio),
								)}
								onExport={handleOpenExportDialog}
								selectedAnnotationId={selectedAnnotationId}
								annotationRegions={annotationRegions}
								onAnnotationContentChange={handleAnnotationContentChange}
								onAnnotationTypeChange={handleAnnotationTypeChange}
								onAnnotationStyleChange={handleAnnotationStyleChange}
								onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
								onAnnotationDelete={handleAnnotationDelete}
								selectedSpeedId={selectedSpeedId}
								selectedSpeedValue={
									selectedSpeedId
										? (speedRegions.find((r) => r.id === selectedSpeedId)?.speed ?? null)
										: null
								}
								onSpeedChange={handleSpeedChange}
								onSpeedDelete={handleSpeedDelete}
								unsavedExport={unsavedExport}
								onSaveUnsavedExport={handleSaveUnsavedExport}
								showCursor={showCursor}
								onShowCursorChange={(v) => pushState({ showCursor: v })}
								cursorStyle={cursorStyle}
								onCursorStyleChange={(v) => pushState({ cursorStyle: v })}
								cursorSmoothing={cursorSmoothing}
								onCursorSmoothingChange={(v) => updateState({ cursorSmoothing: v })}
								onCursorSmoothingCommit={commitState}
								cursorSway={cursorSway}
								onCursorSwayChange={(v) => updateState({ cursorSway: v })}
								onCursorSwayCommit={commitState}
								showClickRings={showClickRings}
								onShowClickRingsChange={(v) => pushState({ showClickRings: v })}
								captionTrack={captionTrack}
								captionStyle={captionStyle}
								onCaptionStyleChange={handleCaptionStyleChange}
								onCaptionTrackChange={handleCaptionTrackChange}
								videoPath={videoSourcePath || videoPath}
							/>
						</div>
					</Panel>

					{/* AI Panel sidebar */}
					{showAIPanel && (
						<>
							<PanelResizeHandle className="w-1 rounded-full bg-white/5 hover:bg-[#2563eb]/40 transition-colors" />
							<Panel defaultSize={18} minSize={14} maxSize={30}>
								<div className="h-full flex flex-col">
									{/* Tab switcher */}
									<div className="flex bg-[#09090b] rounded-t-2xl border border-b-0 border-white/5 overflow-hidden">
										<button
											type="button"
											onClick={() => setAIPanelMode("chat")}
											className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium transition-colors ${
												aiPanelMode === "chat"
													? "text-[#2563eb] bg-[#2563eb]/10 border-b-2 border-[#2563eb]"
													: "text-white/40 hover:text-white/70 border-b-2 border-transparent"
											}`}
										>
											<MessageSquare size={12} />
											Chat
										</button>
										<button
											type="button"
											onClick={() => setAIPanelMode("tools")}
											className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium transition-colors ${
												aiPanelMode === "tools"
													? "text-[#2563eb] bg-[#2563eb]/10 border-b-2 border-[#2563eb]"
													: "text-white/40 hover:text-white/70 border-b-2 border-transparent"
											}`}
										>
											<Sparkles size={12} />
											Tools
										</button>
									</div>

									{/* Panel content */}
									<div className="flex-1 min-h-0">
										{aiPanelMode === "chat" ? (
											<AIChatSidebar
												cursorTelemetry={cursorTelemetry}
												videoDurationMs={duration * 1000}
												editorState={editorState}
												onApplyEdits={handleAIApplyEdits}
												onSeek={(timeMs) => {
													const timeSec = timeMs / 1000;
													setCurrentTime(timeSec);
													if (videoPlaybackRef.current?.video) {
														videoPlaybackRef.current.video.currentTime = timeSec;
													}
												}}
												onScreenshot={handleScreenshot}
												captionTrack={captionTrack}
												videoPath={videoSourcePath || videoPath}
											/>
										) : (
											<AIPanelSidebar
												cursorTelemetry={cursorTelemetry}
												videoDurationMs={duration * 1000}
												editorState={editorState}
												onApplyEdits={handleAIApplyEdits}
												onAcceptTrimSuggestions={handleAcceptTrimSuggestions}
												onSeek={(timeMs) => {
													const timeSec = timeMs / 1000;
													setCurrentTime(timeSec);
													if (videoPlaybackRef.current?.video) {
														videoPlaybackRef.current.video.currentTime = timeSec;
													}
												}}
											/>
										)}
									</div>
								</div>
							</Panel>
						</>
					)}
				</PanelGroup>
			</div>

			<ExportDialog
				isOpen={showExportDialog}
				onClose={() => setShowExportDialog(false)}
				progress={exportProgress}
				isExporting={isExporting}
				error={exportError}
				onCancel={handleCancelExport}
				exportFormat={exportFormat}
				exportedFilePath={exportedFilePath || undefined}
				onShowInFolder={
					exportedFilePath ? () => void handleShowExportedFile(exportedFilePath) : undefined
				}
			/>

			<RecordingSetupDialog
				open={showRecordingSetup}
				onOpenChange={setShowRecordingSetup}
				onStartRecording={handleStartRecording}
			/>
			<ProjectBrowser
				open={showProjectBrowser}
				onOpenChange={setShowProjectBrowser}
				onProjectOpened={() => {
					setError(null);
					setReloadTrigger((prev) => prev + 1);
				}}
			/>
			{showCountdown && (
				<CountdownOverlay onComplete={handleCountdownComplete} onCancel={handleCountdownCancel} />
			)}
		</div>
	);
}
