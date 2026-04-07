// ── Pro Plugin Loader ───────────────────────────────────────────────────
//
// Handles authentication with Coherence and loading the pro plugin bundle.
// The pro plugin code is NOT in this repo — it's downloaded from the
// Coherence CDN at runtime, only for authenticated subscribers.
//
// Open source users see "Upgrade to Pro" prompts. Pro subscribers get
// the full plugin loaded automatically after login.

import { pluginRegistry } from "../registry";
import type { LucidPlugin } from "../types";

const COHERENCE_URL = "https://app.getcoherence.io";
const PRO_BUNDLE_URL = `${COHERENCE_URL}/api/lucid/pro-bundle.js`;
const AUTH_URL = `${COHERENCE_URL}/auth/lucid`;
const SUBSCRIPTION_URL = `${COHERENCE_URL}/api/lucid/subscription`;

const TOKEN_KEY = "lucid-pro-token";

/** Current pro status */
let proStatus: "unknown" | "checking" | "active" | "inactive" | "error" = "unknown";
let proToken: string | null = null;

/** Check if pro is currently active */
export function isProActive(): boolean {
	return proStatus === "active";
}

/** Get current pro status */
export function getProStatus(): typeof proStatus {
	return proStatus;
}

/** Get stored token */
function getStoredToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

/** Store token */
function storeToken(token: string): void {
	try {
		localStorage.setItem(TOKEN_KEY, token);
	} catch { /* ignore */ }
}

/** Clear stored token */
function clearToken(): void {
	try {
		localStorage.removeItem(TOKEN_KEY);
	} catch { /* ignore */ }
}

/**
 * Authenticate with Coherence via OAuth popup.
 * Returns the JWT token on success.
 */
export async function authenticatePro(): Promise<{ success: boolean; error?: string }> {
	return new Promise((resolve) => {
		// Open Coherence login in Electron BrowserWindow via IPC
		// Falls back to regular window.open for web builds
		const width = 500;
		const height = 650;
		const left = Math.round((window.screen.width - width) / 2);
		const top = Math.round((window.screen.height - height) / 2);

		const popup = window.open(
			`${AUTH_URL}?redirect=lucid-desktop&t=${Date.now()}`,
			"coherence-login",
			`width=${width},height=${height},left=${left},top=${top}`,
		);

		if (!popup) {
			resolve({ success: false, error: "Popup blocked. Please allow popups for this app." });
			return;
		}

		// Listen for the auth callback message
		const handler = (event: MessageEvent) => {
			if (event.origin !== COHERENCE_URL) return;
			const data = event.data;
			if (data?.type === "lucid-auth-success" && data.token) {
				window.removeEventListener("message", handler);
				proToken = data.token;
				storeToken(data.token);
				popup.close();
				resolve({ success: true });
			} else if (data?.type === "lucid-auth-error") {
				window.removeEventListener("message", handler);
				popup.close();
				resolve({ success: false, error: data.error || "Authentication failed" });
			}
		};

		window.addEventListener("message", handler);

		// Timeout after 5 minutes
		setTimeout(() => {
			window.removeEventListener("message", handler);
			if (!popup.closed) popup.close();
			resolve({ success: false, error: "Authentication timed out" });
		}, 300_000);

		// Check if popup was closed manually
		const checkClosed = setInterval(() => {
			if (popup.closed) {
				clearInterval(checkClosed);
				window.removeEventListener("message", handler);
				if (!proToken) resolve({ success: false, error: "Login cancelled" });
			}
		}, 500);
	});
}

/**
 * Check subscription status with Coherence API.
 */
export async function checkSubscription(): Promise<{
	active: boolean;
	plan?: string;
	expiresAt?: string;
}> {
	const token = proToken || getStoredToken();
	if (!token) return { active: false };

	try {
		const res = await fetch(SUBSCRIPTION_URL, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (res.status === 401) {
			clearToken();
			proStatus = "inactive";
			return { active: false };
		}

		const data = await res.json();
		return {
			active: data.active === true,
			plan: data.plan,
			expiresAt: data.expiresAt,
		};
	} catch {
		return { active: false };
	}
}

/**
 * Download and load the pro plugin bundle from Coherence CDN.
 */
async function loadProBundle(): Promise<void> {
	const token = proToken || getStoredToken();
	if (!token) throw new Error("Not authenticated");

	const res = await fetch(PRO_BUNDLE_URL, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!res.ok) {
		if (res.status === 401 || res.status === 403) {
			clearToken();
			throw new Error("Pro subscription expired or invalid");
		}
		throw new Error(`Failed to download pro bundle: ${res.status}`);
	}

	// The bundle is a UMD/ESM module that exports a LucidPlugin
	const code = await res.text();

	// Execute the bundle in a controlled scope
	// The bundle should set window.__LUCID_PRO_PLUGIN__
	const script = document.createElement("script");
	script.textContent = code;
	document.head.appendChild(script);
	document.head.removeChild(script);

	const proPlugin = (window as any).__LUCID_PRO_PLUGIN__ as LucidPlugin | undefined;
	if (!proPlugin) {
		throw new Error("Pro bundle did not export a valid plugin");
	}

	pluginRegistry.loadPlugin(proPlugin);
	console.log(`[Pro] Loaded: ${proPlugin.name} v${proPlugin.version}`);
}

/**
 * Full pro activation flow:
 * 1. Check stored token
 * 2. Verify subscription
 * 3. Download + load pro bundle
 */
export async function activatePro(): Promise<{ success: boolean; error?: string }> {
	proStatus = "checking";

	// Try stored token first
	const storedToken = getStoredToken();
	if (storedToken) {
		proToken = storedToken;
		const sub = await checkSubscription();
		if (sub.active) {
			try {
				await loadProBundle();
				proStatus = "active";
				return { success: true };
			} catch (err) {
				proStatus = "error";
				return { success: false, error: err instanceof Error ? err.message : String(err) };
			}
		}
	}

	// No stored token or subscription inactive — need to authenticate
	const auth = await authenticatePro();
	if (!auth.success) {
		proStatus = "inactive";
		return auth;
	}

	const sub = await checkSubscription();
	if (!sub.active) {
		proStatus = "inactive";
		return { success: false, error: "No active Pro subscription. Subscribe at getcoherence.io/pricing" };
	}

	try {
		await loadProBundle();
		proStatus = "active";
		return { success: true };
	} catch (err) {
		proStatus = "error";
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/** Disconnect pro (clear token, but keep plugins loaded for this session) */
export function disconnectPro(): void {
	clearToken();
	proToken = null;
	proStatus = "inactive";
}
