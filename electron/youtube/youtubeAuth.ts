// ── YouTube OAuth2 + Upload ─────────────────────────────────────────────
//
// Handles Google OAuth2 flow via Electron BrowserWindow and video upload
// to YouTube Data API v3 with resumable uploads and progress tracking.

import fs from "node:fs";
import path from "node:path";
import { BrowserWindow, app } from "electron";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];
const TOKEN_PATH = path.join(app.getPath("userData"), "youtube-tokens.json");

// OAuth2 credentials — users must set these in settings or environment
let clientId = process.env.YOUTUBE_CLIENT_ID || "";
let clientSecret = process.env.YOUTUBE_CLIENT_SECRET || "";
const REDIRECT_URI = "http://localhost:19284/oauth2callback";

export function setYouTubeCredentials(id: string, secret: string) {
	clientId = id;
	clientSecret = secret;
}

function getOAuth2Client() {
	if (!clientId || !clientSecret) {
		throw new Error("YouTube API credentials not configured. Set Client ID and Secret in Settings → YouTube.");
	}
	return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/** Check if we have stored tokens */
export function isYouTubeConnected(): boolean {
	try {
		if (!clientId || !clientSecret) return false;
		const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
		return !!tokens.access_token;
	} catch {
		return false;
	}
}

/** Get stored tokens or null */
function getStoredTokens(): any | null {
	try {
		return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
	} catch {
		return null;
	}
}

/** Start OAuth2 flow in a popup window. Returns when auth completes. */
export async function authenticateYouTube(): Promise<{ success: boolean; error?: string }> {
	const oauth2Client = getOAuth2Client();

	const authUrl = oauth2Client.generateAuthUrl({
		access_type: "offline",
		scope: SCOPES,
		prompt: "consent",
	});

	return new Promise((resolve) => {
		// Start a tiny HTTP server to capture the OAuth redirect
		const http = require("node:http");
		const server = http.createServer(async (req: any, res: any) => {
			const url = new URL(req.url, `http://localhost:19284`);
			const code = url.searchParams.get("code");

			if (code) {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end("<html><body><h2>YouTube connected! You can close this window.</h2><script>window.close()</script></body></html>");

				try {
					const { tokens } = await oauth2Client.getToken(code);
					fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
					server.close();
					authWindow?.close();
					resolve({ success: true });
				} catch (err) {
					server.close();
					authWindow?.close();
					resolve({ success: false, error: String(err) });
				}
			} else {
				res.writeHead(400);
				res.end("Missing authorization code");
			}
		});

		server.listen(19284);

		const authWindow = new BrowserWindow({
			width: 600,
			height: 700,
			title: "Connect YouTube",
			autoHideMenuBar: true,
		});

		authWindow.loadURL(authUrl);

		authWindow.on("closed", () => {
			server.close();
			// If we haven't resolved yet, user closed the window
			resolve({ success: false, error: "Authentication cancelled" });
		});
	});
}

/** Disconnect YouTube (remove stored tokens) */
export function disconnectYouTube(): void {
	try {
		fs.unlinkSync(TOKEN_PATH);
	} catch { /* ignore */ }
}

/** Upload a video to YouTube */
export async function uploadToYouTube(opts: {
	filePath: string;
	title: string;
	description?: string;
	privacy: "public" | "unlisted" | "private";
	onProgress?: (percent: number) => void;
}): Promise<{ success: boolean; videoId?: string; url?: string; error?: string }> {
	const oauth2Client = getOAuth2Client();
	const tokens = getStoredTokens();
	if (!tokens) {
		return { success: false, error: "Not authenticated. Connect YouTube first." };
	}

	oauth2Client.setCredentials(tokens);

	// Refresh token if needed
	oauth2Client.on("tokens", (newTokens) => {
		const merged = { ...tokens, ...newTokens };
		fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
	});

	const youtube = google.youtube({ version: "v3", auth: oauth2Client });

	const fileSize = fs.statSync(opts.filePath).size;

	try {
		const res = await youtube.videos.insert(
			{
				part: ["snippet", "status"],
				requestBody: {
					snippet: {
						title: opts.title,
						description: opts.description || "",
					},
					status: {
						privacyStatus: opts.privacy,
					},
				},
				media: {
					body: fs.createReadStream(opts.filePath),
				},
			},
			{
				onUploadProgress: (evt: { bytesRead: number }) => {
					const percent = evt.bytesRead / fileSize;
					opts.onProgress?.(percent);
				},
			},
		);

		const videoId = res.data.id;
		return {
			success: true,
			videoId: videoId || undefined,
			url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
		};
	} catch (err: any) {
		// Check for expired/revoked tokens
		if (err.code === 401 || err.code === 403) {
			disconnectYouTube();
			return { success: false, error: "YouTube access expired. Please reconnect." };
		}
		return { success: false, error: err.message || String(err) };
	}
}
