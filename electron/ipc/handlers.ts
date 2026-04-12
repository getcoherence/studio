import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	app,
	BrowserWindow,
	desktopCapturer,
	dialog,
	ipcMain,
	screen,
	shell,
	systemPreferences,
} from "electron";
import {
	normalizeProjectMedia,
	normalizeRecordingSession,
	type RecordingSession,
	type StoreRecordedSessionInput,
} from "../../src/lib/recordingSession";
import { mergeVideoWithAudio } from "../ffmpeg";
import { mainT } from "../i18n";
import { InputMonitor } from "../input/inputMonitor";
import { RECORDINGS_DIR } from "../main";
import { createRecordingBarWindow } from "../windows";
import { addRecentProject } from "./projectHandlers";

const PROJECT_FILE_EXTENSION = "lucid";
const SHORTCUTS_FILE = path.join(app.getPath("userData"), "shortcuts.json");
const RECORDING_SESSION_SUFFIX = ".session.json";

type SelectedSource = {
	name: string;
	[key: string]: unknown;
};

let selectedSource: SelectedSource | null = null;
let recordingBarWindow: BrowserWindow | null = null;
/** Owning editor window for the current recording bar — set when the bar
 *  is created so stop-recording fires back to the right editor when the
 *  user has multiple windows open. */
let recordingBarOwnerId: number | null = null;

// ── Per-window state ─────────────────────────────────────────────────
//
// Each editor window has its own "current project" and "current recording
// session" — without this, opening Window B and loading a project there
// would clobber Window A's project state and break Save (Cmd+S).
//
// Keyed by webContents.id. Cleaned up automatically when a window closes
// (via the closed listener registered in ensureWindowCleanup below).
const currentProjectPathByWindow = new Map<number, string | null>();
const currentRecordingSessionByWindow = new Map<number, RecordingSession | null>();
const cleanupListenersAttached = new Set<number>();

/** Returns the editor window that fired this IPC event, or null if the
 *  event came from a destroyed window. Use this in every handler that
 *  reads/writes per-window state. */
function getSenderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win || win.isDestroyed()) return null;
	ensureWindowCleanup(win);
	return win;
}

/** Attach a one-time `closed` listener to a window so its per-window state
 *  is removed from the maps when it goes away. Idempotent — safe to call
 *  every IPC turn. */
function ensureWindowCleanup(win: BrowserWindow) {
	if (cleanupListenersAttached.has(win.id)) return;
	cleanupListenersAttached.add(win.id);
	win.once("closed", () => {
		currentProjectPathByWindow.delete(win.id);
		currentRecordingSessionByWindow.delete(win.id);
		cleanupListenersAttached.delete(win.id);
		// If the recording bar was owned by this editor, drop the link.
		if (recordingBarOwnerId === win.id) recordingBarOwnerId = null;
	});
}

function getProjectPath(win: BrowserWindow | null): string | null {
	if (!win) return null;
	return currentProjectPathByWindow.get(win.id) ?? null;
}

function setProjectPath(win: BrowserWindow | null, p: string | null): void {
	if (!win) return;
	currentProjectPathByWindow.set(win.id, p);
}

function getRecordingSession(win: BrowserWindow | null): RecordingSession | null {
	if (!win) return null;
	return currentRecordingSessionByWindow.get(win.id) ?? null;
}

function setRecordingSession(win: BrowserWindow | null, s: RecordingSession | null): void {
	if (!win) return;
	currentRecordingSessionByWindow.set(win.id, s);
}

function normalizePath(filePath: string) {
	return path.resolve(filePath);
}

function normalizeVideoSourcePath(videoPath?: string | null): string | null {
	if (typeof videoPath !== "string") {
		return null;
	}

	const trimmed = videoPath.trim();
	if (!trimmed) {
		return null;
	}

	if (/^file:\/\//i.test(trimmed)) {
		try {
			return fileURLToPath(trimmed);
		} catch {
			// Fall through and keep best-effort string path below.
		}
	}

	return trimmed;
}

function isTrustedProjectPath(win: BrowserWindow | null, filePath?: string | null) {
	const known = getProjectPath(win);
	if (!filePath || !known) return false;
	return normalizePath(filePath) === normalizePath(known);
}

function setCurrentRecordingSessionState(
	win: BrowserWindow | null,
	session: RecordingSession | null,
) {
	setRecordingSession(win, session);
}

function getSessionManifestPathForVideo(videoPath: string) {
	const parsed = path.parse(videoPath);
	const baseName = parsed.name.endsWith("-webcam")
		? parsed.name.slice(0, -"-webcam".length)
		: parsed.name;
	return path.join(parsed.dir, `${baseName}${RECORDING_SESSION_SUFFIX}`);
}

async function loadRecordedSessionForVideoPath(
	videoPath: string,
): Promise<RecordingSession | null> {
	const normalizedVideoPath = normalizeVideoSourcePath(videoPath);
	if (!normalizedVideoPath) {
		return null;
	}

	try {
		const manifestPath = getSessionManifestPathForVideo(normalizedVideoPath);
		const content = await fs.readFile(manifestPath, "utf-8");
		const session = normalizeRecordingSession(JSON.parse(content));
		if (!session) {
			return null;
		}

		const normalizedSession: RecordingSession = {
			...session,
			screenVideoPath: normalizeVideoSourcePath(session.screenVideoPath) ?? session.screenVideoPath,
			...(session.webcamVideoPath
				? {
						webcamVideoPath:
							normalizeVideoSourcePath(session.webcamVideoPath) ?? session.webcamVideoPath,
					}
				: {}),
		};

		const targetPath = normalizePath(normalizedVideoPath);
		const screenMatches = normalizePath(normalizedSession.screenVideoPath) === targetPath;
		const webcamMatches = normalizedSession.webcamVideoPath
			? normalizePath(normalizedSession.webcamVideoPath) === targetPath
			: false;

		return screenMatches || webcamMatches ? normalizedSession : null;
	} catch {
		return null;
	}
}

async function storeRecordedSessionFiles(
	win: BrowserWindow | null,
	payload: StoreRecordedSessionInput,
) {
	const createdAt =
		typeof payload.createdAt === "number" && Number.isFinite(payload.createdAt)
			? payload.createdAt
			: Date.now();
	const screenVideoPath = path.join(RECORDINGS_DIR, payload.screen.fileName);
	await fs.writeFile(screenVideoPath, Buffer.from(payload.screen.videoData));

	let webcamVideoPath: string | undefined;
	if (payload.webcam) {
		webcamVideoPath = path.join(RECORDINGS_DIR, payload.webcam.fileName);
		await fs.writeFile(webcamVideoPath, Buffer.from(payload.webcam.videoData));
	}

	const session: RecordingSession = webcamVideoPath
		? { screenVideoPath, webcamVideoPath, createdAt }
		: { screenVideoPath, createdAt };
	setCurrentRecordingSessionState(win, session);
	setProjectPath(win, null);

	const telemetryPath = `${screenVideoPath}.cursor.json`;
	if (pendingCursorSamples.length > 0) {
		await fs.writeFile(
			telemetryPath,
			JSON.stringify({ version: CURSOR_TELEMETRY_VERSION, samples: pendingCursorSamples }, null, 2),
			"utf-8",
		);
	}
	pendingCursorSamples = [];

	const sessionManifestPath = path.join(
		RECORDINGS_DIR,
		`${path.parse(payload.screen.fileName).name}${RECORDING_SESSION_SUFFIX}`,
	);
	await fs.writeFile(sessionManifestPath, JSON.stringify(session, null, 2), "utf-8");

	return {
		success: true,
		path: screenVideoPath,
		session,
		message: "Recording session stored successfully",
	};
}

const CURSOR_TELEMETRY_VERSION = 2;
const CURSOR_SAMPLE_INTERVAL_MS = 100;
const MAX_CURSOR_SAMPLES = 60 * 60 * 10; // 1 hour @ 10Hz

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	clickType?: "left" | "right" | "double" | "middle";
	cursorType?: "arrow" | "text" | "pointer" | "crosshair" | "hand" | "resize";
}

let cursorCaptureInterval: NodeJS.Timeout | null = null;
let cursorCaptureStartTimeMs = 0;
let activeCursorSamples: CursorTelemetryPoint[] = [];
let pendingCursorSamples: CursorTelemetryPoint[] = [];
const inputMonitor = new InputMonitor();

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function stopCursorCapture() {
	if (cursorCaptureInterval) {
		clearInterval(cursorCaptureInterval);
		cursorCaptureInterval = null;
	}
}

function sampleCursorPoint() {
	const cursor = screen.getCursorScreenPoint();
	const sourceDisplayId = Number(selectedSource?.display_id);
	const sourceDisplay = Number.isFinite(sourceDisplayId)
		? (screen.getAllDisplays().find((display) => display.id === sourceDisplayId) ?? null)
		: null;
	const display = sourceDisplay ?? screen.getDisplayNearestPoint(cursor);
	const bounds = display.bounds;
	const width = Math.max(1, bounds.width);
	const height = Math.max(1, bounds.height);

	const cx = clamp((cursor.x - bounds.x) / width, 0, 1);
	const cy = clamp((cursor.y - bounds.y) / height, 0, 1);

	activeCursorSamples.push({
		timeMs: Math.max(0, Date.now() - cursorCaptureStartTimeMs),
		cx,
		cy,
	});

	if (activeCursorSamples.length > MAX_CURSOR_SAMPLES) {
		activeCursorSamples.shift();
	}
}

export function registerIpcHandlers(
	_createEditorWindow: () => void,
	_createSourceSelectorWindow: () => BrowserWindow,
	getMainWindow: () => BrowserWindow | null,
	getSourceSelectorWindow: () => BrowserWindow | null,
	onRecordingStateChange?: (recording: boolean, sourceName: string) => void,
) {
	ipcMain.handle("get-sources", async (event, opts) => {
		const sources = await desktopCapturer.getSources(opts);

		// Exclude the requesting window from its own source list. Without
		// this, when the user is in window A and wants to record window B
		// (the dogfood "record the AI generator" use case), window A would
		// show up in its own picker — clicking it creates an infinite-mirror
		// effect that pegs the GPU. Use BrowserWindow.getMediaSourceId() to
		// get the same `window:N:M` identifier the OS gave to desktopCapturer.
		const senderWindow = BrowserWindow.fromWebContents(event.sender);
		const excludeId = senderWindow ? senderWindow.getMediaSourceId() : null;

		return sources
			.filter((source) => !excludeId || source.id !== excludeId)
			.map((source) => ({
				id: source.id,
				name: source.name,
				display_id: source.display_id,
				thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
				appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
			}));
	});

	ipcMain.handle("select-source", (_, source: SelectedSource) => {
		selectedSource = source;
		const sourceSelectorWin = getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.close();
		}
		return selectedSource;
	});

	ipcMain.handle("get-selected-source", () => {
		return selectedSource;
	});

	ipcMain.handle("request-camera-access", async () => {
		if (process.platform !== "darwin") {
			return { success: true, granted: true, status: "granted" };
		}

		try {
			const status = systemPreferences.getMediaAccessStatus("camera");
			if (status === "granted") {
				return { success: true, granted: true, status };
			}

			if (status === "not-determined") {
				const granted = await systemPreferences.askForMediaAccess("camera");
				return {
					success: true,
					granted,
					status: granted ? "granted" : systemPreferences.getMediaAccessStatus("camera"),
				};
			}

			return { success: true, granted: false, status };
		} catch (error) {
			console.error("Failed to request camera access:", error);
			return {
				success: false,
				granted: false,
				status: "unknown",
				error: String(error),
			};
		}
	});

	/** Find the editor window that owns the current recording bar (set by
	 *  show-recording-bar). Falls back to the focused window if the owner
	 *  link was lost. */
	function getRecordingBarOwner(): BrowserWindow | null {
		if (recordingBarOwnerId !== null) {
			const owner = BrowserWindow.fromId(recordingBarOwnerId);
			if (owner && !owner.isDestroyed()) return owner;
			recordingBarOwnerId = null;
		}
		return getMainWindow();
	}

	ipcMain.handle("switch-to-editor", () => {
		// Close recording bar if open
		if (recordingBarWindow && !recordingBarWindow.isDestroyed()) {
			recordingBarWindow.close();
			recordingBarWindow = null;
		}
		// Restore/show/focus the OWNING editor window (not just any focused
		// one) so the right window comes back when the user has multiples.
		const owner = getRecordingBarOwner();
		if (owner && !owner.isDestroyed()) {
			if (owner.isMinimized()) owner.restore();
			owner.show();
			owner.focus();
		}
		recordingBarOwnerId = null;
	});

	ipcMain.handle("show-recording-bar", (event) => {
		if (recordingBarWindow && !recordingBarWindow.isDestroyed()) {
			recordingBarWindow.close();
		}
		recordingBarWindow = createRecordingBarWindow();
		// Remember which editor opened the bar so stop-recording fires back
		// to the right window in multi-window setups.
		const owner = getSenderWindow(event);
		recordingBarOwnerId = owner ? owner.id : null;
		recordingBarWindow.on("closed", () => {
			recordingBarWindow = null;
			recordingBarOwnerId = null;
		});
		// Minimize the OWNING editor (not all of them)
		if (owner && !owner.isDestroyed()) {
			owner.minimize();
		}
		return { success: true };
	});

	ipcMain.handle("hide-recording-bar", () => {
		if (recordingBarWindow && !recordingBarWindow.isDestroyed()) {
			recordingBarWindow.close();
			recordingBarWindow = null;
		}
		recordingBarOwnerId = null;
		return { success: true };
	});

	ipcMain.handle("stop-recording-from-bar", () => {
		// Fire ONLY to the owning editor — if we sent to all editors, every
		// window would think it should stop recording (and only one is).
		const owner = getRecordingBarOwner();
		if (owner && !owner.isDestroyed()) {
			owner.webContents.send("stop-recording-from-bar");
		}
		return { success: true };
	});

	ipcMain.handle("minimize-editor", (event) => {
		const win = getSenderWindow(event);
		if (win && !win.isDestroyed()) win.minimize();
		return { success: true };
	});

	ipcMain.handle("restore-editor", () => {
		// Close recording bar if open
		if (recordingBarWindow && !recordingBarWindow.isDestroyed()) {
			recordingBarWindow.close();
			recordingBarWindow = null;
		}
		const owner = getRecordingBarOwner();
		if (owner && !owner.isDestroyed()) {
			if (owner.isMinimized()) owner.restore();
			owner.show();
			owner.focus();
		}
		recordingBarOwnerId = null;
		return { success: true };
	});

	ipcMain.handle("store-recorded-session", async (event, payload: StoreRecordedSessionInput) => {
		try {
			return await storeRecordedSessionFiles(getSenderWindow(event), payload);
		} catch (error) {
			console.error("Failed to store recording session:", error);
			return {
				success: false,
				message: "Failed to store recording session",
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		"store-recorded-video",
		async (event, videoData: ArrayBuffer, fileName: string) => {
			try {
				return await storeRecordedSessionFiles(getSenderWindow(event), {
					screen: { videoData, fileName },
					createdAt: Date.now(),
				});
			} catch (error) {
				console.error("Failed to store recorded video:", error);
				return {
					success: false,
					message: "Failed to store recorded video",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("get-recorded-video-path", async (event) => {
		try {
			const session = getRecordingSession(getSenderWindow(event));
			if (session?.screenVideoPath) {
				return { success: true, path: session.screenVideoPath };
			}

			const files = await fs.readdir(RECORDINGS_DIR);
			const videoFiles = files.filter(
				(file) => file.endsWith(".webm") && !file.endsWith("-webcam.webm"),
			);

			if (videoFiles.length === 0) {
				return { success: false, message: "No recorded video found" };
			}

			const latestVideo = videoFiles.sort().reverse()[0];
			const videoPath = path.join(RECORDINGS_DIR, latestVideo);

			return { success: true, path: videoPath };
		} catch (error) {
			console.error("Failed to get video path:", error);
			return { success: false, message: "Failed to get video path", error: String(error) };
		}
	});

	ipcMain.handle("read-binary-file", async (_, inputPath: string) => {
		try {
			const normalizedPath = normalizeVideoSourcePath(inputPath);
			if (!normalizedPath) {
				return { success: false, message: "Invalid file path" };
			}

			const data = await fs.readFile(normalizedPath);
			return {
				success: true,
				data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
				path: normalizedPath,
			};
		} catch (error) {
			console.error("Failed to read binary file:", error);
			return {
				success: false,
				message: "Failed to read binary file",
				error: String(error),
			};
		}
	});

	ipcMain.handle("set-recording-state", (_, recording: boolean) => {
		if (recording) {
			stopCursorCapture();
			activeCursorSamples = [];
			pendingCursorSamples = [];
			cursorCaptureStartTimeMs = Date.now();
			sampleCursorPoint();
			cursorCaptureInterval = setInterval(sampleCursorPoint, CURSOR_SAMPLE_INTERVAL_MS);
			inputMonitor.start();
		} else {
			stopCursorCapture();
			inputMonitor.stop();
			pendingCursorSamples = inputMonitor.processSamples([...activeCursorSamples]);
			activeCursorSamples = [];
		}

		const source = selectedSource || { name: "Screen" };
		if (onRecordingStateChange) {
			onRecordingStateChange(recording, source.name);
		}
	});

	ipcMain.handle("get-cursor-telemetry", async (event, videoPath?: string) => {
		const session = getRecordingSession(getSenderWindow(event));
		const targetVideoPath = normalizeVideoSourcePath(videoPath ?? session?.screenVideoPath);
		if (!targetVideoPath) {
			return { success: true, samples: [] };
		}

		const telemetryPath = `${targetVideoPath}.cursor.json`;
		try {
			const content = await fs.readFile(telemetryPath, "utf-8");
			const parsed = JSON.parse(content);
			const rawSamples = Array.isArray(parsed)
				? parsed
				: Array.isArray(parsed?.samples)
					? parsed.samples
					: [];

			const VALID_CLICK_TYPES = ["left", "right", "double", "middle"] as const;
			const VALID_CURSOR_TYPES = [
				"arrow",
				"text",
				"pointer",
				"crosshair",
				"hand",
				"resize",
			] as const;

			const samples: CursorTelemetryPoint[] = rawSamples
				.filter((sample: unknown) => Boolean(sample && typeof sample === "object"))
				.map((sample: unknown) => {
					const point = sample as Record<string, unknown>;
					const result: CursorTelemetryPoint = {
						timeMs:
							typeof point.timeMs === "number" && Number.isFinite(point.timeMs)
								? Math.max(0, point.timeMs)
								: 0,
						cx:
							typeof point.cx === "number" && Number.isFinite(point.cx)
								? clamp(point.cx as number, 0, 1)
								: 0.5,
						cy:
							typeof point.cy === "number" && Number.isFinite(point.cy)
								? clamp(point.cy as number, 0, 1)
								: 0.5,
					};
					if (
						typeof point.clickType === "string" &&
						(VALID_CLICK_TYPES as readonly string[]).includes(point.clickType)
					) {
						result.clickType = point.clickType as CursorTelemetryPoint["clickType"];
					}
					if (
						typeof point.cursorType === "string" &&
						(VALID_CURSOR_TYPES as readonly string[]).includes(point.cursorType)
					) {
						result.cursorType = point.cursorType as CursorTelemetryPoint["cursorType"];
					}
					return result;
				})
				.sort((a: CursorTelemetryPoint, b: CursorTelemetryPoint) => a.timeMs - b.timeMs);

			return { success: true, samples };
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code === "ENOENT") {
				return { success: true, samples: [] };
			}
			console.error("Failed to load cursor telemetry:", error);
			return {
				success: false,
				message: "Failed to load cursor telemetry",
				error: String(error),
				samples: [],
			};
		}
	});

	ipcMain.handle("open-external-url", async (_, url: string) => {
		try {
			await shell.openExternal(url);
			return { success: true };
		} catch (error) {
			console.error("Failed to open URL:", error);
			return { success: false, error: String(error) };
		}
	});

	// Return base path for assets so renderer can resolve file:// paths in production
	ipcMain.handle("get-asset-base-path", () => {
		try {
			if (app.isPackaged) {
				const assetPath = path.join(process.resourcesPath, "assets");
				return pathToFileURL(`${assetPath}${path.sep}`).toString();
			}
			const assetPath = path.join(app.getAppPath(), "public", "assets");
			return pathToFileURL(`${assetPath}${path.sep}`).toString();
		} catch (err) {
			console.error("Failed to resolve asset base path:", err);
			return null;
		}
	});

	ipcMain.handle("save-exported-video", async (_, videoData: ArrayBuffer, fileName: string) => {
		try {
			// Determine file type from extension
			const isGif = fileName.toLowerCase().endsWith(".gif");
			const filters = isGif
				? [{ name: mainT("dialogs", "fileDialogs.gifImage"), extensions: ["gif"] }]
				: [{ name: mainT("dialogs", "fileDialogs.mp4Video"), extensions: ["mp4"] }];

			const result = await dialog.showSaveDialog({
				title: isGif
					? mainT("dialogs", "fileDialogs.saveGif")
					: mainT("dialogs", "fileDialogs.saveVideo"),
				defaultPath: path.join(app.getPath("downloads"), fileName),
				filters,
				properties: ["createDirectory", "showOverwriteConfirmation"],
			});

			if (result.canceled || !result.filePath) {
				return {
					success: false,
					canceled: true,
					message: "Export canceled",
				};
			}

			await fs.writeFile(result.filePath, Buffer.from(videoData));

			return {
				success: true,
				path: result.filePath,
				message: "Video exported successfully",
			};
		} catch (error) {
			console.error("Failed to save exported video:", error);
			return {
				success: false,
				message: "Failed to save exported video",
				error: String(error),
			};
		}
	});

	ipcMain.handle("save-screenshot", async (_, imageData: ArrayBuffer, fileName: string) => {
		try {
			const isPng = fileName.toLowerCase().endsWith(".png");
			const filters = isPng
				? [
						{ name: "PNG Image", extensions: ["png"] },
						{ name: "JPEG Image", extensions: ["jpg", "jpeg"] },
					]
				: [
						{ name: "JPEG Image", extensions: ["jpg", "jpeg"] },
						{ name: "PNG Image", extensions: ["png"] },
					];

			const result = await dialog.showSaveDialog({
				title: "Save Screenshot",
				defaultPath: path.join(app.getPath("pictures"), fileName),
				filters,
				properties: ["createDirectory", "showOverwriteConfirmation"],
			});

			if (result.canceled || !result.filePath) {
				return { success: false, canceled: true };
			}

			await fs.writeFile(result.filePath, Buffer.from(imageData));
			return { success: true, path: result.filePath };
		} catch (error) {
			console.error("Failed to save screenshot:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("open-video-file-picker", async (event) => {
		try {
			const result = await dialog.showOpenDialog({
				title: mainT("dialogs", "fileDialogs.selectVideo"),
				defaultPath: RECORDINGS_DIR,
				filters: [
					{
						name: mainT("dialogs", "fileDialogs.videoFiles"),
						extensions: ["webm", "mp4", "mov", "avi", "mkv"],
					},
					{ name: mainT("dialogs", "fileDialogs.allFiles"), extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			setProjectPath(getSenderWindow(event), null);
			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open file picker:", error);
			return {
				success: false,
				message: "Failed to open file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle("reveal-in-folder", async (_, filePath: string) => {
		try {
			// shell.showItemInFolder doesn't return a value, it throws on error
			shell.showItemInFolder(filePath);
			return { success: true };
		} catch (error) {
			console.error(`Error revealing item in folder: ${filePath}`, error);
			// Fallback to open the directory if revealing the item fails
			// This might happen if the file was moved or deleted after export,
			// or if the path is somehow invalid for showItemInFolder
			try {
				const openPathResult = await shell.openPath(path.dirname(filePath));
				if (openPathResult) {
					// openPath returned an error message
					return { success: false, error: openPathResult };
				}
				return { success: true, message: "Could not reveal item, but opened directory." };
			} catch (openError) {
				console.error(`Error opening directory: ${path.dirname(filePath)}`, openError);
				return { success: false, error: String(error) };
			}
		}
	});

	ipcMain.handle(
		"save-project-file",
		async (event, projectData: unknown, suggestedName?: string, existingProjectPath?: string) => {
			try {
				const win = getSenderWindow(event);
				// Extract metadata from the project payload (if it's an AI-generated SceneProject)
				const projectMetadata =
					projectData && typeof projectData === "object" && "metadata" in projectData
						? (
								projectData as {
									metadata?: import("../../src/lib/scene-renderer/types").GenerationMetadata;
								}
							).metadata
						: undefined;

				const trustedExistingProjectPath = isTrustedProjectPath(win, existingProjectPath)
					? existingProjectPath
					: null;

				if (trustedExistingProjectPath) {
					await fs.writeFile(
						trustedExistingProjectPath,
						JSON.stringify(projectData, null, 2),
						"utf-8",
					);
					setProjectPath(win, trustedExistingProjectPath);
					addRecentProject(trustedExistingProjectPath, projectMetadata).catch(() => {
						/* fire-and-forget */
					});
					return {
						success: true,
						path: trustedExistingProjectPath,
						message: "Project saved successfully",
					};
				}

				const safeName = (suggestedName || `project-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, "_");
				const defaultName = safeName.endsWith(`.${PROJECT_FILE_EXTENSION}`)
					? safeName
					: `${safeName}.${PROJECT_FILE_EXTENSION}`;

				const result = await dialog.showSaveDialog({
					title: mainT("dialogs", "fileDialogs.saveProject"),
					defaultPath: path.join(RECORDINGS_DIR, defaultName),
					filters: [
						{
							name: mainT("dialogs", "fileDialogs.lucidProject"),
							extensions: [PROJECT_FILE_EXTENSION],
						},
						{ name: "JSON", extensions: ["json"] },
					],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return {
						success: false,
						canceled: true,
						message: "Save project canceled",
					};
				}

				await fs.writeFile(result.filePath, JSON.stringify(projectData, null, 2), "utf-8");
				setProjectPath(win, result.filePath);
				addRecentProject(result.filePath, projectMetadata).catch(() => {
					/* fire-and-forget */
				});

				return {
					success: true,
					path: result.filePath,
					message: "Project saved successfully",
				};
			} catch (error) {
				console.error("Failed to save project file:", error);
				return {
					success: false,
					message: "Failed to save project file",
					error: String(error),
				};
			}
		},
	);

	// Merge video with background music — merges in-place (replaces original)
	ipcMain.handle("merge-video-audio", async (_, videoPath: string, audioPath: string) => {
		const ext = path.extname(videoPath) || ".webm";
		const tempPath = videoPath.replace(/\.[^.]+$/, `_merging${ext}`);
		const result = await mergeVideoWithAudio(videoPath, audioPath, tempPath);
		if (result.success) {
			try {
				// Replace original with merged file
				await fs.unlink(videoPath);
				await fs.rename(tempPath, videoPath);
			} catch (swapErr) {
				console.error("[merge-video-audio] Failed to swap files:", swapErr);
				// Merged file still exists at tempPath — not ideal but not a data loss
				return { success: true, path: tempPath };
			}
		}
		return result;
	});

	// Silent auto-save — saves directly to recordings dir without dialog
	ipcMain.handle("auto-save-project", async (event, projectData: unknown, fileName: string) => {
		try {
			const safeName = fileName.replace(/[^a-zA-Z0-9-_. ]/g, "_");
			const fullName = safeName.endsWith(`.${PROJECT_FILE_EXTENSION}`)
				? safeName
				: `${safeName}.${PROJECT_FILE_EXTENSION}`;
			const filePath = path.join(RECORDINGS_DIR, fullName);

			// Extract metadata if present so the recent projects browser can show it
			const projectMetadata =
				projectData && typeof projectData === "object" && "metadata" in projectData
					? (
							projectData as {
								metadata?: import("../../src/lib/scene-renderer/types").GenerationMetadata;
							}
						).metadata
					: undefined;

			await fs.mkdir(RECORDINGS_DIR, { recursive: true });
			await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), "utf-8");
			setProjectPath(getSenderWindow(event), filePath);
			addRecentProject(filePath, projectMetadata).catch(() => {
				/* fire-and-forget */
			});

			return { success: true, path: filePath };
		} catch (error) {
			console.error("Auto-save failed:", error);
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("load-project-file", async (event) => {
		try {
			const win = getSenderWindow(event);
			const result = await dialog.showOpenDialog({
				title: mainT("dialogs", "fileDialogs.openProject"),
				defaultPath: RECORDINGS_DIR,
				filters: [
					{
						name: mainT("dialogs", "fileDialogs.lucidProject"),
						extensions: [PROJECT_FILE_EXTENSION],
					},
					{ name: "JSON", extensions: ["json"] },
					{ name: mainT("dialogs", "fileDialogs.allFiles"), extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, message: "Open project canceled" };
			}

			const filePath = result.filePaths[0];
			const content = await fs.readFile(filePath, "utf-8");
			const project = JSON.parse(content);
			setProjectPath(win, filePath);
			// Refresh recent-project metadata snapshot from the loaded file
			const loadedMetadata =
				project && typeof project === "object" && "metadata" in project
					? (
							project as {
								metadata?: import("../../src/lib/scene-renderer/types").GenerationMetadata;
							}
						).metadata
					: undefined;
			addRecentProject(filePath, loadedMetadata).catch(() => {
				/* fire-and-forget */
			});
			if (project && typeof project === "object") {
				const rawProject = project as { media?: unknown; videoPath?: unknown };
				const media =
					normalizeProjectMedia(rawProject.media) ??
					(typeof rawProject.videoPath === "string"
						? {
								screenVideoPath:
									normalizeVideoSourcePath(rawProject.videoPath) ?? rawProject.videoPath,
							}
						: null);
				setCurrentRecordingSessionState(win, media ? { ...media, createdAt: Date.now() } : null);
			}

			return {
				success: true,
				path: filePath,
				project,
			};
		} catch (error) {
			console.error("Failed to load project file:", error);
			return {
				success: false,
				message: "Failed to load project file",
				error: String(error),
			};
		}
	});

	ipcMain.handle("load-current-project-file", async (event) => {
		try {
			const win = getSenderWindow(event);
			const projectPath = getProjectPath(win);
			if (!projectPath) {
				return { success: false, message: "No active project" };
			}

			const content = await fs.readFile(projectPath, "utf-8");
			const project = JSON.parse(content);
			if (project && typeof project === "object") {
				const rawProject = project as { media?: unknown; videoPath?: unknown };
				const media =
					normalizeProjectMedia(rawProject.media) ??
					(typeof rawProject.videoPath === "string"
						? {
								screenVideoPath:
									normalizeVideoSourcePath(rawProject.videoPath) ?? rawProject.videoPath,
							}
						: null);
				setCurrentRecordingSessionState(win, media ? { ...media, createdAt: Date.now() } : null);
			}
			return {
				success: true,
				path: projectPath,
				project,
			};
		} catch (error) {
			console.error("Failed to load current project file:", error);
			return {
				success: false,
				message: "Failed to load current project file",
				error: String(error),
			};
		}
	});
	ipcMain.handle("set-current-recording-session", (event, session: RecordingSession | null) => {
		const win = getSenderWindow(event);
		const normalized = normalizeRecordingSession(session);
		setCurrentRecordingSessionState(win, normalized);
		setProjectPath(win, null);
		return { success: true, session: normalized ?? undefined };
	});

	ipcMain.handle("get-current-recording-session", (event) => {
		const session = getRecordingSession(getSenderWindow(event));
		return session ? { success: true, session } : { success: false };
	});

	ipcMain.handle("set-current-video-path", async (event, path: string) => {
		const win = getSenderWindow(event);
		const restoredSession = await loadRecordedSessionForVideoPath(path);
		if (restoredSession) {
			setCurrentRecordingSessionState(win, restoredSession);
		} else {
			setCurrentRecordingSessionState(win, {
				screenVideoPath: normalizeVideoSourcePath(path) ?? path,
				createdAt: Date.now(),
			});
		}
		setProjectPath(win, null);
		return { success: true };
	});

	ipcMain.handle("load-project-by-path", async (event, filePath: string) => {
		try {
			const win = getSenderWindow(event);
			const content = await fs.readFile(filePath, "utf-8");
			const project = JSON.parse(content);
			setProjectPath(win, filePath);
			// Refresh recent-project metadata snapshot from the loaded file
			const loadedMetadata =
				project && typeof project === "object" && "metadata" in project
					? (
							project as {
								metadata?: import("../../src/lib/scene-renderer/types").GenerationMetadata;
							}
						).metadata
					: undefined;
			addRecentProject(filePath, loadedMetadata).catch(() => {
				/* fire-and-forget */
			});
			if (project && typeof project === "object") {
				const rawProject = project as { media?: unknown; videoPath?: unknown };
				const media =
					normalizeProjectMedia(rawProject.media) ??
					(typeof rawProject.videoPath === "string"
						? {
								screenVideoPath:
									normalizeVideoSourcePath(rawProject.videoPath) ?? rawProject.videoPath,
							}
						: null);
				setCurrentRecordingSessionState(win, media ? { ...media, createdAt: Date.now() } : null);
			}
			return { success: true, path: filePath, project };
		} catch (error) {
			console.error("Failed to load project by path:", error);
			return { success: false, message: String(error) };
		}
	});

	ipcMain.handle("get-current-video-path", (event) => {
		const session = getRecordingSession(getSenderWindow(event));
		return session?.screenVideoPath
			? { success: true, path: session.screenVideoPath }
			: { success: false };
	});

	ipcMain.handle("clear-current-video-path", (event) => {
		setCurrentRecordingSessionState(getSenderWindow(event), null);
		return { success: true };
	});

	ipcMain.handle("get-platform", () => {
		return process.platform;
	});

	// Fetch a YouTube channel's recent video IDs from the public RSS feed.
	// Used by the Chit TV arcade tab to get a scrollable list of shorts
	// from a creator without needing the YouTube Data API. Two-step:
	//   1. Fetch the channel page to extract the channelId
	//      (you can't query the RSS feed by @handle directly).
	//   2. Fetch the channel's RSS feed and parse out video IDs.
	// Lives in main process so it bypasses renderer CORS restrictions.
	ipcMain.handle(
		"youtube-fetch-channel-shorts",
		async (
			_event,
			channelHandle: string,
		): Promise<{
			success: boolean;
			channelId?: string;
			videoIds?: string[];
			error?: string;
		}> => {
			try {
				// Normalize: strip leading @ if present
				const handle = channelHandle.replace(/^@/, "");

				// Step 1: fetch the channel page and extract channelId
				const channelPageRes = await fetch(`https://www.youtube.com/@${handle}`, {
					headers: {
						// Pretend to be a real browser so YouTube returns the full HTML
						// instead of a stripped-down bot response
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					},
					signal: AbortSignal.timeout(10_000),
				});
				if (!channelPageRes.ok) {
					return { success: false, error: `Channel page HTTP ${channelPageRes.status}` };
				}
				const channelHtml = await channelPageRes.text();
				// Channel ID lives in a few places — try the most reliable one first
				const channelIdMatch =
					channelHtml.match(/"channelId":"(UC[\w-]{22})"/) ??
					channelHtml.match(/<meta itemprop="channelId" content="(UC[\w-]{22})"/) ??
					channelHtml.match(/channel\/(UC[\w-]{22})"/);
				const channelId = channelIdMatch?.[1];
				if (!channelId) {
					return { success: false, error: "Could not extract channelId from channel page" };
				}

				// Step 2: fetch the RSS feed (no auth required)
				const feedRes = await fetch(
					`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
					{ signal: AbortSignal.timeout(10_000) },
				);
				if (!feedRes.ok) {
					return {
						success: false,
						channelId,
						error: `RSS feed HTTP ${feedRes.status}`,
					};
				}
				const feedXml = await feedRes.text();
				// Parse out video IDs — they appear as <yt:videoId>...</yt:videoId>
				const videoIds: string[] = [];
				const videoIdRe = /<yt:videoId>([\w-]{11})<\/yt:videoId>/g;
				let match: RegExpExecArray | null;
				match = videoIdRe.exec(feedXml);
				while (match !== null) {
					videoIds.push(match[1]);
					match = videoIdRe.exec(feedXml);
				}
				if (videoIds.length === 0) {
					return { success: false, channelId, error: "No videos found in RSS feed" };
				}
				return { success: true, channelId, videoIds };
			} catch (err) {
				return {
					success: false,
					error: err instanceof Error ? err.message : String(err),
				};
			}
		},
	);

	ipcMain.handle("get-shortcuts", async () => {
		try {
			const data = await fs.readFile(SHORTCUTS_FILE, "utf-8");
			return JSON.parse(data);
		} catch {
			return null;
		}
	});

	ipcMain.handle("save-shortcuts", async (_, shortcuts: unknown) => {
		try {
			await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			console.error("Failed to save shortcuts:", error);
			return { success: false, error: String(error) };
		}
	});
}
