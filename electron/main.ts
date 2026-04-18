import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	Menu,
	nativeImage,
	protocol,
	session,
	shell,
	systemPreferences,
	Tray,
} from "electron";
import { mainT, setMainLocale } from "./i18n";
import { registerAIHandlers } from "./ipc/aiHandlers";
import { registerCaptureHandlers } from "./ipc/captureHandlers";
import { registerDemoHandlers } from "./ipc/demoHandlers";
import { registerExportHandlers } from "./ipc/exportHandlers";
import { registerFfmpegHandlers } from "./ipc/ffmpegHandlers";
import { registerIpcHandlers } from "./ipc/handlers";
import { registerProjectHandlers } from "./ipc/projectHandlers";
import { registerSettingsHandlers } from "./ipc/settingsHandlers";
import { registerStudioCacheHandlers } from "./ipc/studioCacheHandlers";
import { registerUpdaterHandlers } from "./ipc/updaterHandlers";
import { registerWhisperHandlers } from "./ipc/whisperHandlers";
import { registerShowcaseHandlers } from "./ipc/showcaseHandlers";
import { registerYouTubeHandlers } from "./ipc/youtubeHandlers";
import { getCachedSetting, loadSettings, setSetting } from "./settings";
import { checkForUpdates, setUpdateChannel, type UpdateChannel } from "./updater";
import { createEditorWindow, createSourceSelectorWindow } from "./windows";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use Screen & System Audio Recording permissions instead of CoreAudio Tap API on macOS.
// CoreAudio Tap requires NSAudioCaptureUsageDescription in the parent app's Info.plist,
// which doesn't work when running from a terminal/IDE during development, makes my life easier
if (process.platform === "darwin") {
	app.commandLine.appendSwitch("disable-features", "MacCatapLoopbackAudioForScreenShare");
}

// Dev-mode only: expose Chrome DevTools Protocol on :9222 so an external CLI
// driver (studio-pro/scripts/bench-cli.mjs) can trigger the bench harness via
// Runtime.evaluate without needing a human at devtools. Safe to leave enabled
// in dev because localhost only; absolutely must not run in packaged builds.
if (!app.isPackaged) {
	app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

export const RECORDINGS_DIR = path.join(app.getPath("userData"), "recordings");

async function ensureRecordingsDir() {
	try {
		await fs.mkdir(RECORDINGS_DIR, { recursive: true });
		console.log("RECORDINGS_DIR:", RECORDINGS_DIR);
		console.log("User Data Path:", app.getPath("userData"));
	} catch (error) {
		console.error("Failed to create recordings directory:", error);
	}
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
	? path.join(process.env.APP_ROOT, "public")
	: RENDERER_DIST;

// ── Multi-window state ────────────────────────────────────────────────
//
// `editorWindows` is the canonical set of open editor windows. Use the
// helpers (`getFocusedEditorWindow`, `getFirstEditorWindow`,
// `getEditorWindowFromEvent`) to find the right window in any handler —
// never reach for a global "main" reference because there isn't one.
//
// Use cases that drive multi-window:
//   1. Agency / freelancer multi-client — Window A on Brand A, Window B on
//      Brand B, generate in parallel.
//   2. Dogfood recording — Window A runs the AI Generator while Window B
//      records it via desktopCapturer to produce a demo of the tool.
const editorWindows = new Set<BrowserWindow>();
let sourceSelectorWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let selectedSourceName = "";

// Tray Icons
const defaultTrayIcon = getTrayIcon("coherence-studio.png");
const recordingTrayIcon = getTrayIcon("rec-button.png");

/** Returns the focused editor window, or any open editor as a fallback,
 *  or null if there are none. Prefer this over reaching for a "main"
 *  window because the user may have several windows open. */
function getFocusedEditorWindow(): BrowserWindow | null {
	const focused = BrowserWindow.getFocusedWindow();
	if (focused && editorWindows.has(focused) && !focused.isDestroyed()) {
		return focused;
	}
	for (const win of editorWindows) {
		if (!win.isDestroyed()) return win;
	}
	return null;
}

/** Returns the first open editor window, or null if there are none. */
function getFirstEditorWindow(): BrowserWindow | null {
	for (const win of editorWindows) {
		if (!win.isDestroyed()) return win;
	}
	return null;
}

function createWindow() {
	createEditorWindowWrapper();
}

function showMainWindow() {
	const existing = getFocusedEditorWindow();
	if (existing) {
		if (existing.isMinimized()) existing.restore();
		existing.show();
		existing.focus();
		return;
	}
	createEditorWindowWrapper();
}

function isEditorWindow(window: BrowserWindow) {
	return window.webContents.getURL().includes("windowType=editor");
}

function sendEditorMenuAction(
	channel: "menu-load-project" | "menu-save-project" | "menu-save-project-as",
) {
	let targetWindow: BrowserWindow | null = BrowserWindow.getFocusedWindow();
	if (!targetWindow || targetWindow.isDestroyed() || !isEditorWindow(targetWindow)) {
		targetWindow = getFirstEditorWindow();
	}

	if (!targetWindow) {
		// No editor open at all — spawn one and forward the action once it loads
		const newWin = createEditorWindowWrapper();
		if (!newWin) return;
		newWin.webContents.once("did-finish-load", () => {
			if (!newWin.isDestroyed()) newWin.webContents.send(channel);
		});
		return;
	}

	targetWindow.webContents.send(channel);
}

/** Build a list of menu items, one per open editor window, that focus
 *  that window when clicked. Lets the user jump between windows from
 *  the Window menu without alt-tabbing. */
function buildOpenWindowMenuItems(): Electron.MenuItemConstructorOptions[] {
	const items: Electron.MenuItemConstructorOptions[] = [];
	let index = 1;
	for (const win of editorWindows) {
		if (win.isDestroyed()) continue;
		const title = win.getTitle() || `Window ${index}`;
		items.push({
			label: `${index}. ${title}`,
			click: () => {
				if (!win.isDestroyed()) {
					if (win.isMinimized()) win.restore();
					win.show();
					win.focus();
				}
			},
		});
		index++;
	}
	if (items.length === 0) {
		items.push({ label: "(no editor windows)", enabled: false });
	}
	return items;
}

function triggerManualUpdateCheck() {
	checkForUpdates({ manual: true }).catch(() => {});
}

function handleChannelSelect(channel: UpdateChannel) {
	const isPro = getCachedSetting("licenseTier") === "pro";
	if (channel === "beta" && !isPro) {
		dialog
			.showMessageBox({
				type: "info",
				title: "Pro Feature",
				message: "Beta releases are a Coherence Studio Pro feature.",
				detail:
					"Pro subscribers get early access to new features through the Beta channel. " +
					"Upgrade to Pro from Settings to opt in.",
				buttons: ["OK", "Learn More"],
				defaultId: 0,
			})
			.then((result) => {
				if (result.response === 1) {
					shell.openExternal("https://getcoherence.io/studio/pro");
				}
			});
		// Rebuild menu so the checkmark stays on "Stable".
		setupApplicationMenu();
		return;
	}
	setUpdateChannel(channel);
	setSetting("updateChannel", channel).catch(() => {});
	setupApplicationMenu();
}

function setupApplicationMenu() {
	const isMac = process.platform === "darwin";
	const template: Electron.MenuItemConstructorOptions[] = [];
	const currentChannel: UpdateChannel = getCachedSetting("updateChannel") ?? "latest";

	if (isMac) {
		template.push({
			label: app.name,
			submenu: [
				{ role: "about" },
				{
					label: "Check for Updates…",
					click: triggerManualUpdateCheck,
				},
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" },
			],
		});
	}

	template.push(
		{
			label: "File",
			submenu: [
				{
					label: "New Window",
					accelerator: "CmdOrCtrl+Shift+T",
					click: () => {
						createEditorWindowWrapper();
					},
				},
				{
					label: "Open Window for Recording…",
					click: () => {
						// Forward to the focused editor as if it had called the IPC.
						// The renderer side fires the actual open-window-for-recording
						// invoke, which spawns the new window and pre-targets the picker.
						const target = getFocusedEditorWindow();
						if (target) target.webContents.send("menu-open-window-for-recording");
					},
				},
				{ type: "separator" },
				{
					label: "New Recording",
					accelerator: "CmdOrCtrl+N",
					click: () => {
						const target = getFocusedEditorWindow();
						if (target) target.webContents.send("menu-new-recording");
					},
				},
				{
					label: "Create Video",
					accelerator: "CmdOrCtrl+Shift+N",
					click: () => {
						const target = getFocusedEditorWindow();
						if (target) target.webContents.send("menu-create-video");
					},
				},
				{ type: "separator" },
				{
					label: "Open Video File…",
					click: () => {
						const target = getFocusedEditorWindow();
						if (target) target.webContents.send("menu-open-video");
					},
				},
				{
					label: "Load Project…",
					accelerator: "CmdOrCtrl+O",
					click: () => sendEditorMenuAction("menu-load-project"),
				},
				{
					label: "Recent Projects…",
					click: () => {
						const target = getFocusedEditorWindow();
						if (target) target.webContents.send("menu-recent-projects");
					},
				},
				{ type: "separator" },
				{
					label: "Save Project…",
					accelerator: "CmdOrCtrl+S",
					click: () => sendEditorMenuAction("menu-save-project"),
				},
				{
					label: "Save Project As…",
					accelerator: "CmdOrCtrl+Shift+S",
					click: () => sendEditorMenuAction("menu-save-project-as"),
				},
				...(isMac ? [] : [{ type: "separator" as const }, { role: "quit" as const }]),
			],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "forceReload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: "Window",
			submenu: [
				{
					label: "New Window",
					accelerator: "CmdOrCtrl+Shift+T",
					click: () => {
						createEditorWindowWrapper();
					},
				},
				{ type: "separator" as const },
				...(isMac
					? ([
							{ role: "minimize" },
							{ role: "zoom" },
							{ type: "separator" },
							{ role: "front" },
						] as Electron.MenuItemConstructorOptions[])
					: ([{ role: "minimize" }, { role: "close" }] as Electron.MenuItemConstructorOptions[])),
				{ type: "separator" as const },
				...buildOpenWindowMenuItems(),
			],
		},
		{
			label: "Help",
			submenu: [
				// On macOS, Check for Updates lives in the app menu per Apple HIG.
				// On Windows/Linux, it's here.
				...(!isMac
					? ([
							{
								label: "Check for Updates…",
								click: triggerManualUpdateCheck,
							},
							{ type: "separator" as const },
						] as Electron.MenuItemConstructorOptions[])
					: []),
				{
					label: "Release Channel",
					submenu: [
						{
							label: "Stable",
							type: "radio",
							checked: currentChannel === "latest",
							click: () => handleChannelSelect("latest"),
						},
						{
							label: getCachedSetting("licenseTier") === "pro" ? "Beta" : "Beta (Pro)",
							type: "radio",
							checked: currentChannel === "beta",
							click: () => handleChannelSelect("beta"),
						},
					],
				},
				{ type: "separator" },
				{
					label: "Coherence Website",
					click: () => shell.openExternal("https://getcoherence.io"),
				},
				{
					label: "Documentation",
					click: () => shell.openExternal("https://github.com/getcoherence/studio#readme"),
				},
				{
					label: "Report a Bug",
					click: () => shell.openExternal("https://github.com/getcoherence/studio/issues"),
				},
				{ type: "separator" },
				{ role: "toggleDevTools" },
				{
					label: "Restart Coherence Studio",
					click: () => {
						app.relaunch();
						app.exit(0);
					},
				},
				// About sinks to the bottom on Win/Linux (Mac has it in app menu).
				...(!isMac
					? ([
							{ type: "separator" as const },
							{
								label: "About Coherence Studio",
								click: () => {
									dialog
										.showMessageBox({
											type: "info",
											title: "About Coherence Studio",
											message: "Coherence Studio",
											detail:
												"AI-powered screen recording and editing.\n\n" +
												"Built by the team at Coherence — the AI-native work platform " +
												"for modern teams.\n\n" +
												"Originally forked from OpenScreen by Siddharth Vaddem.\n\n" +
												`Version ${app.getVersion()}\n` +
												"https://getcoherence.io",
											buttons: ["OK", "Visit Coherence", "View on GitHub"],
											defaultId: 0,
										})
										.then((result) => {
											if (result.response === 1) {
												shell.openExternal("https://getcoherence.io");
											} else if (result.response === 2) {
												shell.openExternal("https://github.com/getcoherence/studio");
											}
										});
								},
							},
						] as Electron.MenuItemConstructorOptions[])
					: []),
			],
		},
	);

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

function createTray() {
	tray = new Tray(defaultTrayIcon);
	tray.on("click", () => {
		showMainWindow();
	});
	tray.on("double-click", () => {
		showMainWindow();
	});
}

function getTrayIcon(filename: string) {
	return nativeImage
		.createFromPath(path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename))
		.resize({
			width: 24,
			height: 24,
			quality: "best",
		});
}

/**
 * Restart / reload the app.
 *
 * Behavior depends on environment:
 * - **Production**: full app restart via `app.relaunch() + app.exit()`.
 *   Picks up everything (main, preload, renderer).
 * - **Dev**: hard-reload the renderer only. A true relaunch is impossible
 *   in dev because vite-plugin-electron kills the Vite dev server when
 *   Electron exits, and the new Electron process has nothing to connect
 *   to (black screen). Instead we reload the renderer (which picks up
 *   the latest pro-bundle.js + Vite HMR) and tell the user how to
 *   restart main process changes.
 *
 * If the editor has unsaved changes, prompts the user first.
 */
function restartApp() {
	const isDev = !app.isPackaged;

	if (isDev) {
		// Dev mode: just reload every editor's renderer. Picks up:
		//   - Latest pro-bundle.js (via studio-pro/build.mjs auto-sync)
		//   - Vite HMR for renderer source
		// Does NOT pick up:
		//   - Main process / preload / IPC handler changes
		//     → vite-plugin-electron auto-restarts Electron when those
		//       files change on disk, no manual action needed
		//     → Or quit fully (File → Quit) and re-run `npm run dev`
		for (const win of editorWindows) {
			if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
		}
		console.log(
			"[Tray] Dev mode reload — renderer refreshed. Main process unchanged. " +
				"Save a main process file to trigger auto-restart, or quit fully to relaunch.",
		);
		return;
	}

	// Production: full app relaunch
	if (anyEditorHasUnsavedChanges()) {
		const target = getFocusedEditorWindow();
		if (target) {
			const choice = dialog.showMessageBoxSync(target, {
				type: "warning",
				buttons: ["Restart Anyway", "Cancel"],
				defaultId: 1,
				cancelId: 1,
				title: "Restart Coherence Studio",
				message: "You have unsaved changes that will be lost.",
				detail: "Restart and discard changes?",
			});
			if (choice !== 0) return;
		}
	}
	isForceClosing = true;
	app.relaunch();
	app.exit(0);
}

function updateTrayMenu(recording: boolean = false) {
	if (!tray) return;
	const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
	const trayToolTip = recording ? `Recording: ${selectedSourceName}` : "Coherence Studio";
	const menuTemplate = recording
		? [
				{
					label: mainT("common", "actions.stopRecording") || "Stop Recording",
					click: () => {
						// Tell every editor window to stop — only the one that's
						// actually recording will respond. Without this, the user
						// could be in window B and not get the stop event because
						// recording is owned by window A.
						for (const win of editorWindows) {
							if (!win.isDestroyed()) {
								win.webContents.send("stop-recording-from-tray");
							}
						}
					},
				},
			]
		: [
				{
					label: "New Window",
					click: () => {
						createEditorWindowWrapper();
					},
				},
				{
					label: mainT("common", "actions.open") || "Open",
					click: () => {
						showMainWindow();
					},
				},
				{
					// In dev, label as "Reload Window" since true restart breaks
					// vite-plugin-electron's parent process. In prod, "Restart" does
					// a real app.relaunch() + app.exit().
					label: !app.isPackaged ? "Reload Window" : "Restart",
					click: () => {
						restartApp();
					},
				},
				{ type: "separator" as const },
				{
					label: mainT("common", "actions.quit") || "Quit",
					click: () => {
						app.quit();
					},
				},
			];
	tray.setImage(trayIcon);
	tray.setToolTip(trayToolTip);
	tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

// Per-window unsaved-changes tracking. Keyed by webContents.id so each
// editor window's dirty state is independent. The renderer sends an IPC
// event whenever its dirty bit changes; we look up the sender to know
// which window the event came from.
const editorUnsavedChanges = new Map<number, boolean>();
let isForceClosing = false;

function anyEditorHasUnsavedChanges(): boolean {
	for (const [id, dirty] of editorUnsavedChanges) {
		if (dirty) {
			// Verify the window is still alive — stale entries shouldn't count
			const win = BrowserWindow.fromId(id);
			if (win && !win.isDestroyed()) return true;
		}
	}
	return false;
}

ipcMain.on("set-has-unsaved-changes", (event, hasChanges: boolean) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return;
	editorUnsavedChanges.set(win.id, hasChanges);
});

// Per-window title update from the renderer. The renderer dispatches this
// when a project loads or saves so the OS title bar reflects the project
// name (e.g. "Coherence Studio — getcoherence.io"). Multi-window: keys off
// event.sender so each window updates only its own title.
ipcMain.on("set-window-title", (event, title: string) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win || win.isDestroyed()) return;
	const safe = (title || "").trim();
	const finalTitle = safe ? `Coherence Studio — ${safe}` : "Coherence Studio";
	win.setTitle(finalTitle);
	// Refresh the Window menu so the new title shows up in the dropdown.
	setupApplicationMenu();
});

// Notify a target editor window that it's being recorded by another window.
// The renderer toggles a `recording-target` body class so dev-only UI
// (toasts, popovers, debug overlays) hides during capture for clean output.
// Sent by the renderer when a recording starts on a `window:` source ID.
ipcMain.handle("set-capture-target-mode", (_event, sourceId: string, recording: boolean) => {
	// Look up the editor window whose getMediaSourceId() matches sourceId.
	// Only fires for window-targeting captures — screen captures don't
	// trigger clean-capture mode (the user is recording the whole desktop).
	for (const win of editorWindows) {
		if (win.isDestroyed()) continue;
		if (win.getMediaSourceId() === sourceId) {
			win.webContents.send("capture-mode-changed", { recording });
			return { success: true, targetId: win.id };
		}
	}
	return { success: false, error: "Source ID does not match any editor window" };
});

// One-click "Open Window for Recording" — creates a fresh editor window
// (the target) and tells the requesting window to open its source picker
// pre-targeted at the new window. Used by the dogfood loop: Window A
// records Window B running the AI Generator.
ipcMain.handle("open-window-for-recording", async (event) => {
	const requester = BrowserWindow.fromWebContents(event.sender);
	if (!requester || requester.isDestroyed()) {
		return { success: false, error: "No requesting window" };
	}
	const target = createEditorWindowWrapper();

	// Wait for the new window to finish loading so its native handle is
	// stable and getMediaSourceId() returns the right value.
	if (!target.webContents.isLoading()) {
		// Already loaded — fire immediately
		fireOpenSourcePicker();
	} else {
		target.webContents.once("did-finish-load", fireOpenSourcePicker);
	}

	function fireOpenSourcePicker() {
		if (!requester || requester.isDestroyed() || target.isDestroyed()) return;
		const targetSourceId = target.getMediaSourceId();
		// Position the new window so it's not stacked on the requester
		offsetWindow(target, requester);
		requester.webContents.send("open-source-picker", {
			preferredSourceId: targetSourceId,
			targetWindowTitle: target.getTitle(),
		});
	}

	return { success: true, targetWindowId: target.id };
});

/** Offset a newly-created window so it doesn't sit directly on top of an
 *  existing one. Cascades by ~40px down-and-right from the reference. */
function offsetWindow(target: BrowserWindow, reference: BrowserWindow) {
	if (target.isDestroyed() || reference.isDestroyed()) return;
	const [refX, refY] = reference.getPosition();
	target.setPosition(refX + 40, refY + 40, true);
}

function forceCloseEditorWindow(windowToClose: BrowserWindow | null) {
	if (!windowToClose || windowToClose.isDestroyed()) return;

	isForceClosing = true;
	setImmediate(() => {
		try {
			if (!windowToClose.isDestroyed()) {
				windowToClose.close();
			}
		} finally {
			isForceClosing = false;
		}
	});
}

/** Create a new editor window. Multi-window safe — does NOT close any
 *  existing windows. Returns the new window so callers can wait for
 *  did-finish-load if they need to forward an action to it. */
function createEditorWindowWrapper(): BrowserWindow {
	const win = createEditorWindow();
	editorWindows.add(win);
	editorUnsavedChanges.set(win.id, false);

	win.on("close", (event) => {
		if (isForceClosing) return;
		const isDirty = editorUnsavedChanges.get(win.id) ?? false;
		if (!isDirty) return;

		event.preventDefault();

		const choice = dialog.showMessageBoxSync(win, {
			type: "warning",
			buttons: [
				mainT("dialogs", "unsavedChanges.saveAndClose"),
				mainT("dialogs", "unsavedChanges.discardAndClose"),
				mainT("common", "actions.cancel"),
			],
			defaultId: 0,
			cancelId: 2,
			title: mainT("dialogs", "unsavedChanges.title"),
			message: mainT("dialogs", "unsavedChanges.message"),
			detail: mainT("dialogs", "unsavedChanges.detail"),
		});

		if (win.isDestroyed()) return;

		if (choice === 0) {
			// Save & Close — tell renderer to save, then close
			win.webContents.send("request-save-before-close");
			ipcMain.once("save-before-close-done", (_, shouldClose: boolean) => {
				if (!shouldClose) return;
				forceCloseEditorWindow(win);
			});
		} else if (choice === 1) {
			// Discard & Close
			forceCloseEditorWindow(win);
		}
		// choice === 2: Cancel — do nothing, window stays open
	});

	win.on("closed", () => {
		editorWindows.delete(win);
		editorUnsavedChanges.delete(win.id);
		// Refresh the Window menu so the closed window disappears from the list
		setupApplicationMenu();
	});

	// Refresh the Window menu so the new window appears in the list
	setupApplicationMenu();
	return win;
}

function createSourceSelectorWindowWrapper() {
	sourceSelectorWindow = createSourceSelectorWindow();
	sourceSelectorWindow.on("closed", () => {
		sourceSelectorWindow = null;
	});
	return sourceSelectorWindow;
}

// On macOS, applications and their menu bar stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	// Keep app running (macOS behavior)
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// Pro auth via coherence-studio:// deep link protocol
import { handleProAuthDeepLink, registerProAuthProtocol } from "./pro/proAuth";

// Register the protocol before app is ready
registerProAuthProtocol();

// macOS: handle deep link when app is already running
app.on("open-url", (event, url) => {
	event.preventDefault();
	handleProAuthDeepLink(url);
});

// Windows/Linux: second instance receives the deep link URL in argv
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", (_event, argv) => {
		// The deep link URL is the last argument
		const deepLink = argv.find((arg) => arg.startsWith("coherence-studio://"));
		if (deepLink) {
			handleProAuthDeepLink(deepLink);
		}
		// Focus an existing editor window — preference order: focused, first
		const win = getFocusedEditorWindow() ?? getFirstEditorWindow();
		if (win) {
			if (win.isMinimized()) win.restore();
			win.focus();
		}
	});
}

// Register studio:// protocol for secure local file access (replaces webSecurity: false)
protocol.registerSchemesAsPrivileged([
	{
		scheme: "studio",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			stream: true,
			bypassCSP: true,
		},
	},
]);

// Register all IPC handlers when app is ready
app.whenReady().then(async () => {
	// Handle studio:// protocol — serves local files securely with Range
	// support so Remotion can seek into long media (TTS narration, music,
	// recordings). Without 206 Partial Content, audio elements stutter and
	// stop because they can't jump to a specific position.
	protocol.handle("studio", async (request) => {
		// studio://file/C:/path/to/file.webm → C:/path/to/file.webm
		const rawUrl = request.url;
		const filePath = decodeURIComponent(rawUrl.replace("studio://file/", "").replace(/#.*$/, ""));
		console.log("[studio://] request.url:", rawUrl, "→ filePath:", filePath);

		const mimeFor = (p: string): string => {
			const ext = path.extname(p).toLowerCase();
			switch (ext) {
				case ".mp3":
					return "audio/mpeg";
				case ".wav":
					return "audio/wav";
				case ".ogg":
					return "audio/ogg";
				case ".m4a":
					return "audio/mp4";
				case ".webm":
					return "video/webm";
				case ".mp4":
					return "video/mp4";
				case ".mov":
					return "video/quicktime";
				case ".png":
					return "image/png";
				case ".jpg":
				case ".jpeg":
					return "image/jpeg";
				case ".gif":
					return "image/gif";
				case ".webp":
					return "image/webp";
				case ".json":
					return "application/json";
				default:
					return "application/octet-stream";
			}
		};

		try {
			const stat = await fs.stat(filePath);
			const fileSize = stat.size;
			const mimeType = mimeFor(filePath);
			const rangeHeader = request.headers.get("range");

			if (rangeHeader) {
				// "bytes=start-end" — either side may be omitted
				const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
				if (match) {
					const start = match[1] ? parseInt(match[1], 10) : 0;
					const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
					if (
						Number.isNaN(start) ||
						Number.isNaN(end) ||
						start < 0 ||
						end >= fileSize ||
						start > end
					) {
						return new Response("Invalid range", {
							status: 416,
							headers: { "Content-Range": `bytes */${fileSize}` },
						});
					}
					const chunkSize = end - start + 1;
					const handle = await fs.open(filePath, "r");
					try {
						const buffer = Buffer.alloc(chunkSize);
						await handle.read(buffer, 0, chunkSize, start);
						return new Response(buffer, {
							status: 206,
							headers: {
								"Content-Type": mimeType,
								"Content-Length": String(chunkSize),
								"Content-Range": `bytes ${start}-${end}/${fileSize}`,
								"Accept-Ranges": "bytes",
								"Cache-Control": "no-cache",
							},
						});
					} finally {
						await handle.close();
					}
				}
			}

			// No Range header — return the full file but advertise byte ranges
			// so the next request can seek.
			const data = await fs.readFile(filePath);
			return new Response(data, {
				status: 200,
				headers: {
					"Content-Type": mimeType,
					"Content-Length": String(fileSize),
					"Accept-Ranges": "bytes",
					"Cache-Control": "no-cache",
				},
			});
		} catch (err) {
			console.error("[studio://] failed to serve", filePath, err);
			return new Response("Not found", { status: 404 });
		}
	});

	// Allow microphone/media permission checks
	session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
		const allowed = ["media", "audioCapture", "microphone", "videoCapture", "camera"];
		return allowed.includes(permission);
	});

	session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
		const allowed = ["media", "audioCapture", "microphone", "videoCapture", "camera"];
		callback(allowed.includes(permission));
	});

	// Request microphone permission from macOS
	if (process.platform === "darwin") {
		const micStatus = systemPreferences.getMediaAccessStatus("microphone");
		if (micStatus !== "granted") {
			await systemPreferences.askForMediaAccess("microphone");
		}
	}

	ipcMain.handle("set-locale", (_, locale: string) => {
		setMainLocale(locale);
		setupApplicationMenu();
		updateTrayMenu();
	});

	// Prime the settings cache before the initial menu builds — the Release
	// Channel submenu reads the stored channel + license tier synchronously.
	await loadSettings();

	createTray();
	updateTrayMenu();
	setupApplicationMenu();
	// Ensure recordings directory exists
	await ensureRecordingsDir();

	// Register native capture IPC handlers
	registerCaptureHandlers();

	registerAIHandlers();
	registerDemoHandlers(getFocusedEditorWindow);
	registerIpcHandlers(
		// createEditorWindowWrapper now returns the new window (multi-window safe)
		() => {
			createEditorWindowWrapper();
		},
		createSourceSelectorWindowWrapper,
		getFocusedEditorWindow,
		() => sourceSelectorWindow,
		(recording: boolean, sourceName: string) => {
			selectedSourceName = sourceName;
			if (!tray) createTray();
			updateTrayMenu(recording);
			if (!recording) {
				showMainWindow();
			}
		},
	);
	registerSettingsHandlers();
	registerStudioCacheHandlers();
	registerExportHandlers(getFocusedEditorWindow);
	registerYouTubeHandlers(getFocusedEditorWindow);
	registerShowcaseHandlers(getFocusedEditorWindow);
	registerFfmpegHandlers();
	await registerUpdaterHandlers();
	registerProjectHandlers();

	// Register Whisper / caption IPC handlers
	registerWhisperHandlers(getFocusedEditorWindow);

	createWindow();
});
