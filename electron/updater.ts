import { app, type BrowserWindow } from "electron";
import { autoUpdater, type UpdateInfo as ElectronUpdateInfo } from "electron-updater";

// ── Auto-update ──────────────────────────────────────────────────────────
//
// Wraps electron-updater against GitHub Releases. Handles:
//   • launch check + hourly interval while app is open
//   • stable ("latest") and "beta" channels — beta is gated to Pro users
//     in the UI, but this module accepts either channel unconditionally
//   • broadcasting state transitions to all renderer windows via
//     `update:event` so the React UI can render toast + persistent badge
//   • `checkForUpdates(manual)` — when true, `not-available` is surfaced
//     to the UI as a confirmation ("You're on the latest version");
//     when false, it's silent (interval poll)
//
// Distinct from the homemade GitHub API poller this replaces:
// electron-updater downloads the installer in the background, verifies
// the signature, and hands off to NSIS on "quit and install".

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export type UpdateState =
	| "idle"
	| "checking"
	| "available"
	| "not-available"
	| "downloading"
	| "downloaded"
	| "error";

export type UpdateChannel = "latest" | "beta";

export interface UpdateEvent {
	state: UpdateState;
	currentVersion: string;
	latestVersion?: string;
	progress?: number; // 0..100
	error?: string;
	/** True when the check was triggered by a menu click (not the background poll). */
	manual?: boolean;
}

let checkTimer: NodeJS.Timeout | null = null;
let lastEvent: UpdateEvent = { state: "idle", currentVersion: app.getVersion() };
let manualInFlight = false;
let broadcast: (event: UpdateEvent) => void = () => {};

function emit(event: UpdateEvent) {
	lastEvent = event;
	broadcast(event);
}

export function configureUpdater(channel: UpdateChannel = "latest") {
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.autoRunAppAfterInstall = true;
	autoUpdater.allowPrerelease = channel === "beta";
	autoUpdater.channel = channel;
	// Suppress electron-updater's built-in Windows dialogs — we use our own
	// UpdateToast component in the renderer for a consistent UX.
	autoUpdater.disableWebInstaller = true;
	// Logging — electron-updater emits detailed logs to autoUpdater.logger.
	// Leaving the default console logger in place; electron-log integration
	// can be added later if we need persistent logs.
}

export function getUpdateChannel(): UpdateChannel {
	return autoUpdater.allowPrerelease ? "beta" : "latest";
}

export function setUpdateChannel(channel: UpdateChannel) {
	configureUpdater(channel);
	// After switching channels, trigger a fresh check so the user sees
	// the other channel's latest version reflected quickly.
	checkForUpdates({ manual: false }).catch(() => {});
}

export async function checkForUpdates(options: { manual?: boolean } = {}): Promise<UpdateEvent> {
	if (!app.isPackaged) {
		// electron-updater doesn't work in dev; surface a shape the UI
		// can handle so manual "Check for Updates" menu clicks don't silently no-op.
		const event: UpdateEvent = {
			state: "not-available",
			currentVersion: app.getVersion(),
			manual: options.manual,
		};
		emit(event);
		return event;
	}
	manualInFlight = options.manual ?? false;
	try {
		await autoUpdater.checkForUpdates();
	} catch (err) {
		emit({
			state: "error",
			currentVersion: app.getVersion(),
			error: err instanceof Error ? err.message : String(err),
			manual: options.manual,
		});
	}
	return lastEvent;
}

export function installUpdate(): void {
	// Quits the app and runs the downloaded installer. Only meaningful when
	// state is "downloaded"; calling earlier is a no-op.
	if (lastEvent.state === "downloaded") {
		autoUpdater.quitAndInstall();
	}
}

export function getUpdateStatus(): UpdateEvent {
	return lastEvent;
}

export function dismissUpdate(): void {
	// Demotes the "available"/"downloaded" banner back to idle for the
	// session. The underlying download is still queued to install at quit
	// because autoInstallOnAppQuit is true.
	if (lastEvent.state === "available" || lastEvent.state === "downloaded") {
		lastEvent = { state: "idle", currentVersion: app.getVersion() };
		broadcast(lastEvent);
	}
}

export function initAutoUpdater(
	getAllWindows: () => BrowserWindow[],
	initialChannel: UpdateChannel = "latest",
) {
	broadcast = (event) => {
		for (const win of getAllWindows()) {
			if (!win.isDestroyed()) win.webContents.send("update:event", event);
		}
	};

	configureUpdater(initialChannel);

	autoUpdater.on("checking-for-update", () => {
		emit({ state: "checking", currentVersion: app.getVersion(), manual: manualInFlight });
	});

	autoUpdater.on("update-available", (info: ElectronUpdateInfo) => {
		emit({
			state: "available",
			currentVersion: app.getVersion(),
			latestVersion: info.version,
		});
	});

	autoUpdater.on("update-not-available", (info: ElectronUpdateInfo) => {
		emit({
			state: "not-available",
			currentVersion: app.getVersion(),
			latestVersion: info.version,
			manual: manualInFlight,
		});
		manualInFlight = false;
	});

	autoUpdater.on("download-progress", (progress: { percent: number }) => {
		emit({
			state: "downloading",
			currentVersion: app.getVersion(),
			progress: progress.percent,
		});
	});

	autoUpdater.on("update-downloaded", (info: ElectronUpdateInfo) => {
		emit({
			state: "downloaded",
			currentVersion: app.getVersion(),
			latestVersion: info.version,
		});
	});

	autoUpdater.on("error", (err: Error) => {
		emit({
			state: "error",
			currentVersion: app.getVersion(),
			error: err.message,
			manual: manualInFlight,
		});
		manualInFlight = false;
	});
}

export function startAutoUpdateCheck(): void {
	// Launch check after a short delay so the app finishes booting first.
	setTimeout(() => {
		checkForUpdates({ manual: false }).catch(() => {});
	}, 10_000);

	if (checkTimer) clearInterval(checkTimer);
	checkTimer = setInterval(() => {
		checkForUpdates({ manual: false }).catch(() => {});
	}, CHECK_INTERVAL_MS);
}

export function stopAutoUpdateCheck(): void {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
}
