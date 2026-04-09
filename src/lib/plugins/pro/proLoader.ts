// ── Pro Plugin Loader ───────────────────────────────────────────────────
//
// Handles authentication and loading premium plugin bundles.
// By default configured for Coherence, but fully configurable for
// self-hosted or custom auth providers.
//
// To disable pro features entirely: don't call activatePro().
// To use your own auth: call configureProAuth({ ... }) before activatePro().

import { pluginRegistry } from "../registry";
import type { LucidPlugin } from "../types";

// ── Configuration (swappable by self-hosters) ───────────────────────────

interface ProAuthConfig {
	/** Base URL of the auth provider */
	baseUrl: string;
	/** OAuth login page URL (opens in popup) */
	authUrl: string;
	/** Subscription check endpoint (GET, needs Bearer token) */
	subscriptionUrl: string;
	/** Pro plugin bundle URL (GET, needs Bearer token) */
	bundleUrl: string;
	/** localStorage key for storing the JWT */
	tokenKey: string;
	/** Display name of the auth provider (shown in UI) */
	providerName: string;
}

const DEFAULT_CONFIG: ProAuthConfig = {
	baseUrl: "https://app.getcoherence.io",
	authUrl: "https://app.getcoherence.io/login?redirect=studio-desktop",
	subscriptionUrl: "https://app.getcoherence.io/api/v1/auth/studio/subscription",
	bundleUrl: "https://app.getcoherence.io/api/v1/content/studio/pro-bundle.js",
	tokenKey: "studio-pro-token",
	providerName: "Coherence",
};

// Auto-detect local development and use localhost URLs
const isDev = typeof window !== "undefined" && window.location.hostname === "localhost";
const DEV_CONFIG: ProAuthConfig = {
	baseUrl: "http://localhost:5175",
	authUrl: "http://localhost:5175/login?redirect=studio-desktop",
	subscriptionUrl: "http://localhost:4100/studio/subscription",
	bundleUrl: "http://localhost:4900/studio/pro-bundle.js",
	tokenKey: "studio-pro-token",
	providerName: "Coherence (dev)",
};

let config: ProAuthConfig = isDev ? { ...DEV_CONFIG } : { ...DEFAULT_CONFIG };

/**
 * Configure the pro auth provider. Call this before activatePro()
 * to use a custom auth backend instead of Coherence.
 *
 * Self-hosters: you can point this at your own server that implements
 * the same 3 endpoints (auth, subscription check, bundle download).
 *
 * To disable pro entirely: simply don't call activatePro() or
 * configureProAuth() — all pro features will show upgrade prompts
 * that do nothing.
 */
export function configureProAuth(custom: Partial<ProAuthConfig>): void {
	config = { ...DEFAULT_CONFIG, ...custom };
}

/** Get current config (for display in settings UI) */
export function getProAuthConfig(): ProAuthConfig {
	return { ...config };
}

/** Current pro status */
let proStatus: "unknown" | "checking" | "active" | "inactive" | "error" = "unknown";
let proToken: string | null = null;
let proValidUntil: number = 0; // timestamp — pro deactivates after this
let revalidationTimer: ReturnType<typeof setInterval> | null = null;

// How long pro stays active without server confirmation (grace period for offline use)
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
// How often to re-validate subscription while app is running
const REVALIDATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** Check if pro is currently active */
export function isProActive(): boolean {
	if (proStatus !== "active") return false;
	// Even if status says active, check the validity window
	if (Date.now() > proValidUntil) {
		proStatus = "inactive";
		stopRevalidation();
		return false;
	}
	return true;
}

/** Get current pro status */
export function getProStatus(): typeof proStatus {
	return proStatus;
}

/** Get stored token (internal) */
function getStoredToken(): string | null {
	try {
		return localStorage.getItem(config.tokenKey);
	} catch {
		return null;
	}
}

/** Get stored token (exported for silent init check in license.ts) */
export function getStoredProToken(): string | null {
	return getStoredToken();
}

/** Get the in-memory token (may still be valid even if localStorage was cleared) */
export function getProToken(): string | null {
	return proToken || getStoredToken();
}

/** Store token */
function storeToken(token: string): void {
	try {
		localStorage.setItem(config.tokenKey, token);
	} catch {
		/* ignore */
	}
}

/** Store refresh token */
function storeRefreshToken(token: string): void {
	try {
		localStorage.setItem(`${config.tokenKey}-refresh`, token);
	} catch {
		/* ignore */
	}
}

/** Get stored refresh token */
function getStoredRefreshToken(): string | null {
	try {
		return localStorage.getItem(`${config.tokenKey}-refresh`);
	} catch {
		return null;
	}
}

/** Use refresh token to get a fresh access token */
async function refreshAccessToken(): Promise<string | null> {
	const refreshToken = getStoredRefreshToken();
	if (!refreshToken) return null;

	try {
		const baseUrl = config.subscriptionUrl.replace("/studio/subscription", "");
		const res = await fetch(`${baseUrl}/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken }),
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (data.accessToken) {
			proToken = data.accessToken;
			storeToken(data.accessToken);
			if (data.refreshToken) storeRefreshToken(data.refreshToken);
			return data.accessToken;
		}
	} catch {
		// refresh failed
	}
	return null;
}

/** Clear stored tokens */
function clearToken(): void {
	try {
		localStorage.removeItem(config.tokenKey);
		localStorage.removeItem(`${config.tokenKey}-refresh`);
	} catch {
		/* ignore */
	}
}

/**
 * Authenticate with Coherence via OAuth popup.
 * Returns the JWT token on success.
 */
export async function authenticatePro(): Promise<{ success: boolean; error?: string }> {
	// Use Electron IPC for OAuth (opens BrowserWindow + local HTTP server)
	// Falls back to window.open for web builds
	if ((window as any).electronAPI?.proAuthenticate) {
		const result = await (window as any).electronAPI.proAuthenticate();
		if (result.success && result.token) {
			proToken = result.token;
			storeToken(result.token);
			if (result.refreshToken) storeRefreshToken(result.refreshToken);
			return { success: true };
		}
		return { success: false, error: result.error || "Authentication failed" };
	}

	// Web fallback: use popup + postMessage
	return new Promise((resolve) => {
		const width = 500;
		const height = 650;
		const left = Math.round((window.screen.width - width) / 2);
		const top = Math.round((window.screen.height - height) / 2);

		const separator = config.authUrl.includes("?") ? "&" : "?";
		const popup = window.open(
			`${config.authUrl}${separator}t=${Date.now()}`,
			"coherence-login",
			`width=${width},height=${height},left=${left},top=${top}`,
		);

		if (!popup) {
			resolve({ success: false, error: "Popup blocked. Please allow popups for this app." });
			return;
		}

		const handler = (event: MessageEvent) => {
			if (event.origin !== config.baseUrl) return;
			const data = event.data;
			if (data?.type === "studio-auth-success" && data.token) {
				window.removeEventListener("message", handler);
				proToken = data.token;
				storeToken(data.token);
				popup.close();
				resolve({ success: true });
			} else if (data?.type === "studio-auth-error") {
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
	authFailed?: boolean;
	plan?: string;
	expiresAt?: string;
}> {
	const token = proToken || getStoredToken();
	if (!token) return { active: false };

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

		const res = await fetch(config.subscriptionUrl, {
			headers: { Authorization: `Bearer ${token}` },
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (res.status === 401) {
			// Try refreshing the access token before giving up
			const newToken = await refreshAccessToken();
			if (newToken) {
				const retryRes = await fetch(config.subscriptionUrl, {
					headers: { Authorization: `Bearer ${newToken}` },
				});
				if (retryRes.ok) {
					const data = await retryRes.json();
					return { active: data.active === true, plan: data.plan, expiresAt: data.expiresAt };
				}
			}
			return { active: false, authFailed: true };
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

	const res = await fetch(config.bundleUrl, {
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
	// The bundle should set window.__STUDIO_PRO_PLUGIN__
	const script = document.createElement("script");
	script.textContent = code;
	document.head.appendChild(script);
	document.head.removeChild(script);

	const proPlugin = (window as any).__STUDIO_PRO_PLUGIN__ as LucidPlugin | undefined;
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
export async function activatePro(): Promise<{
	success: boolean;
	error?: string;
	code?: "no_subscription" | "auth_failed" | "bundle_failed";
}> {
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
				proValidUntil = Date.now() + GRACE_PERIOD_MS;
				startRevalidation();
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
	if (sub.authFailed) {
		// Token was accepted by Electron callback but rejected by API — re-auth needed
		clearToken();
		proStatus = "inactive";
		return {
			success: false,
			code: "auth_failed",
			error: "Authentication failed — please try again",
		};
	}
	if (!sub.active) {
		proStatus = "inactive";
		return { success: false, code: "no_subscription", error: "No active Studio Pro subscription" };
	}

	try {
		await loadProBundle();
		proStatus = "active";
		proValidUntil = Date.now() + GRACE_PERIOD_MS;
		startRevalidation();
		return { success: true };
	} catch (err) {
		proStatus = "error";
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/** Periodically re-validate the subscription while the app is running */
function startRevalidation(): void {
	stopRevalidation();
	revalidationTimer = setInterval(async () => {
		const sub = await checkSubscription();
		if (!sub.active) {
			console.warn("[Pro] Subscription no longer active — deactivating pro features");
			proStatus = "inactive";
			proValidUntil = 0;
			stopRevalidation();
		} else {
			// Subscription still good — extend the grace window
			proValidUntil = Date.now() + GRACE_PERIOD_MS;
		}
	}, REVALIDATION_INTERVAL_MS);
}

function stopRevalidation(): void {
	if (revalidationTimer) {
		clearInterval(revalidationTimer);
		revalidationTimer = null;
	}
}

/** Disconnect pro (clear token, but keep plugins loaded for this session) */
export function disconnectPro(): void {
	clearToken();
	proToken = null;
	proStatus = "inactive";
}
