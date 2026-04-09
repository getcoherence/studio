/**
 * Pro Authentication — Electron-side OAuth flow for Coherence.
 *
 * Opens system browser for login. After auth, the server redirects to
 * a local HTTP callback server that captures the token.
 * Same proven pattern as YouTube auth.
 */

import http from "node:http";
import { app, shell, BrowserWindow } from "electron";

const CALLBACK_PORT = 19385;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/lucid-auth-callback`;

interface ProAuthConfig {
	authBaseUrl: string;
}

const isDev = !app.isPackaged;
const config: ProAuthConfig = isDev
	? { authBaseUrl: "http://localhost:5175" }
	: { authBaseUrl: "https://app.getcoherence.io" };

/** No-op — deep links removed in favor of local HTTP server */
export function registerProAuthProtocol(): void {}
export function handleProAuthDeepLink(_url: string): boolean { return false; }

/**
 * Start the Coherence OAuth flow.
 * Opens system browser, captures callback via local HTTP server.
 */
export async function authenticateCoherence(): Promise<{ success: boolean; token?: string; error?: string }> {
	const redirectUrl = encodeURIComponent(CALLBACK_URL);
	const loginUrl = `${config.authBaseUrl}/login?redirect=${redirectUrl}`;

	console.log("[ProAuth] Starting auth flow, callback on port", CALLBACK_PORT);

	return new Promise((resolve) => {
		let resolved = false;

		const server = http.createServer((req, res) => {
			if (resolved) { res.end(); return; }

			const url = new URL(req.url || "", `http://localhost:${CALLBACK_PORT}`);

			if (url.pathname === "/lucid-auth-callback") {
				const token = url.searchParams.get("token");

				if (token) {
					resolved = true;
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<!DOCTYPE html>
<html><head><title>Connected</title></head>
<body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<div style="font-size:48px;margin-bottom:16px">✓</div>
<div style="font-size:18px;opacity:0.8">Connected to Lucid Studio!</div>
<div style="font-size:14px;opacity:0.4;margin-top:8px">You can close this tab</div>
</div></body></html>`);

					console.log("[ProAuth] Token received, auth successful");
					setTimeout(() => {
						server.close();
						// Focus the main Lucid window
						const win = BrowserWindow.getAllWindows()[0];
						if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
						resolve({ success: true, token });
					}, 500);
				} else {
					resolved = true;
					const error = url.searchParams.get("error") || "No token received";
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh"><div>Authentication failed: ${error}</div></body></html>`);
					server.close();
					resolve({ success: false, error });
				}
			} else {
				res.writeHead(404);
				res.end("Not found");
			}
		});

		server.on("error", (err) => {
			console.error("[ProAuth] Server error:", err);
			if (!resolved) {
				resolved = true;
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
				resolve({ success: false, error: "Authentication timed out" });
			}
		}, 300_000);
	});
}
