/**
 * Pro Authentication — Electron-side OAuth flow for Coherence.
 *
 * Uses a custom protocol (coherence-studio://) for the auth callback.
 * Flow:
 * 1. Register coherence-studio:// as default protocol client
 * 2. Open system browser to login page with redirect=coherence-studio://auth?token=...
 * 3. After login, web app redirects to coherence-studio://auth?token=<jwt>
 * 4. OS opens the URL in our app, we extract the token
 */

import { app, BrowserWindow, shell } from "electron";

const PROTOCOL = "coherence-studio";
const CALLBACK_URL = `${PROTOCOL}://auth`;

interface ProAuthConfig {
	authBaseUrl: string;
}

const isDev = !app.isPackaged;
const config: ProAuthConfig = isDev
	? { authBaseUrl: "http://localhost:5175" }
	: { authBaseUrl: "https://app.getcoherence.io" };

// Pending auth promise resolver
let pendingResolve: ((result: { success: boolean; token?: string; error?: string }) => void) | null = null;
let authTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Register coherence-studio:// as the default protocol handler.
 * Call this before app.whenReady().
 */
export function registerProAuthProtocol(): void {
	if (process.defaultApp) {
		// Dev mode: need to pass the script path
		app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
			process.argv[1],
		]);
	} else {
		app.setAsDefaultProtocolClient(PROTOCOL);
	}
	console.log(`[ProAuth] Registered ${PROTOCOL}:// protocol`);
}

/**
 * Handle an incoming coherence-studio:// deep link.
 * Called from the main process when the OS opens a URL with our protocol.
 * Returns true if the URL was handled.
 */
export function handleProAuthDeepLink(url: string): boolean {
	if (!url.startsWith(`${PROTOCOL}://`)) return false;

	console.log("[ProAuth] Received deep link:", url.replace(/token=[^&]+/, "token=***"));

	try {
		const parsed = new URL(url);
		const token = parsed.searchParams.get("token");
		const error = parsed.searchParams.get("error");

		if (token && pendingResolve) {
			clearTimeout(authTimeout!);
			pendingResolve({ success: true, token });
			pendingResolve = null;
			authTimeout = null;

			// Focus the main Studio window
			const win = BrowserWindow.getAllWindows()[0];
			if (win) {
				if (win.isMinimized()) win.restore();
				win.focus();
			}
			return true;
		}

		if (error && pendingResolve) {
			clearTimeout(authTimeout!);
			pendingResolve({ success: false, error });
			pendingResolve = null;
			authTimeout = null;
			return true;
		}
	} catch (err) {
		console.error("[ProAuth] Failed to parse deep link:", err);
	}

	return false;
}

/**
 * Start the Coherence OAuth flow.
 * Opens system browser, waits for deep link callback.
 */
export async function authenticateCoherence(): Promise<{
	success: boolean;
	token?: string;
	error?: string;
}> {
	const redirectUrl = encodeURIComponent(CALLBACK_URL);
	const loginUrl = `${config.authBaseUrl}/login?redirect=${redirectUrl}`;

	console.log("[ProAuth] Starting auth flow via", PROTOCOL, "protocol");

	return new Promise((resolve) => {
		// Cancel any previous pending auth
		if (pendingResolve) {
			pendingResolve({ success: false, error: "Cancelled by new auth attempt" });
		}

		pendingResolve = resolve;

		// Timeout after 5 minutes
		authTimeout = setTimeout(() => {
			if (pendingResolve === resolve) {
				pendingResolve = null;
				resolve({ success: false, error: "Authentication timed out" });
			}
		}, 300_000);

		shell.openExternal(loginUrl);
	});
}
