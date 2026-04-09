/**
 * Pro Authentication — Electron-side OAuth flow for Coherence.
 *
 * Opens system browser for login. After auth, the server redirects to
 * a local HTTP callback server that captures the token.
 * Same proven pattern as YouTube auth.
 */

import http from "node:http";
import { app, BrowserWindow, shell } from "electron";

const CALLBACK_PORT = 19385;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/studio-auth-callback`;

interface ProAuthConfig {
	authBaseUrl: string;
}

const isDev = !app.isPackaged;
const config: ProAuthConfig = isDev
	? { authBaseUrl: "http://localhost:5175" }
	: { authBaseUrl: "https://app.getcoherence.io" };

/** No-op — deep links removed in favor of local HTTP server */
export function registerProAuthProtocol(): void {
	// intentionally empty
}
export function handleProAuthDeepLink(_url: string): boolean {
	return false;
}

// Track active server so we can kill it if a new auth attempt starts
let activeServer: http.Server | null = null;

/**
 * Start the Coherence OAuth flow.
 * Opens system browser, captures callback via local HTTP server.
 */
export async function authenticateCoherence(): Promise<{
	success: boolean;
	token?: string;
	error?: string;
}> {
	const redirectUrl = encodeURIComponent(CALLBACK_URL);
	const loginUrl = `${config.authBaseUrl}/login?redirect=${redirectUrl}`;

	// Kill any previous server that's still hanging around
	if (activeServer) {
		try {
			activeServer.close();
		} catch {
			/* ignore */
		}
		activeServer = null;
	}

	console.log("[ProAuth] Starting auth flow, callback on port", CALLBACK_PORT);

	return new Promise((resolve) => {
		let resolved = false;

		const server = http.createServer((req, res) => {
			if (resolved) {
				res.end();
				return;
			}

			const url = new URL(req.url || "", `http://localhost:${CALLBACK_PORT}`);

			if (url.pathname === "/studio-auth-callback") {
				const token = url.searchParams.get("token");

				if (token) {
					resolved = true;
					res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
					res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Connected</title></head>
<body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<div style="font-size:48px;margin-bottom:16px">✓</div>
<div style="font-size:18px;opacity:0.8">Connected to Studio!</div>
<div style="font-size:14px;opacity:0.4;margin-top:8px">You can close this tab</div>
</div></body></html>`);

					console.log("[ProAuth] Token received, auth successful");
					setTimeout(() => {
						server.close();
						activeServer = null;
						// Focus the main Studio window
						const win = BrowserWindow.getAllWindows()[0];
						if (win) {
							if (win.isMinimized()) win.restore();
							win.focus();
						}
						resolve({ success: true, token });
					}, 500);
				} else {
					resolved = true;
					const error = url.searchParams.get("error") || "No token received";
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(
						`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh"><div>Authentication failed: ${error}</div></body></html>`,
					);
					server.close();
					activeServer = null;
					resolve({ success: false, error });
				}
			} else {
				res.writeHead(404);
				res.end("Not found");
			}
		});

		activeServer = server;

		server.on("error", (err: NodeJS.ErrnoException) => {
			console.error("[ProAuth] Server error:", err);

			if (err.code === "EADDRINUSE") {
				// Port still held by a previous server — force-kill and retry once
				console.log("[ProAuth] Port in use, retrying...");
				server.close();
				activeServer = null;

				// Small delay then retry
				setTimeout(() => {
					const retryServer = http.createServer(
						server.listeners("request")[0] as http.RequestListener,
					);
					activeServer = retryServer;
					retryServer.on("error", (retryErr) => {
						console.error("[ProAuth] Retry failed:", retryErr);
						if (!resolved) {
							resolved = true;
							activeServer = null;
							resolve({
								success: false,
								error: `Port ${CALLBACK_PORT} is busy. Close other Studio instances and try again.`,
							});
						}
					});
					retryServer.listen(CALLBACK_PORT, () => {
						console.log("[ProAuth] Retry succeeded, opening browser");
						shell.openExternal(loginUrl);
					});
				}, 1000);
				return;
			}

			if (!resolved) {
				resolved = true;
				activeServer = null;
				resolve({ success: false, error: `Local server failed: ${err.message}` });
			}
		});

		server.listen(CALLBACK_PORT, () => {
			console.log("[ProAuth] Callback server listening on", CALLBACK_PORT);
			console.log("[ProAuth] Opening browser:", loginUrl);
			shell.openExternal(loginUrl);
		});

		// Timeout after 5 minutes
		setTimeout(() => {
			if (!resolved) {
				resolved = true;
				server.close();
				activeServer = null;
				resolve({ success: false, error: "Authentication timed out" });
			}
		}, 300_000);
	});
}
