/**
 * Feature gating — Free vs Pro license system.
 *
 * Free: Screen recording, basic video editing (trim, zoom, speed, export)
 * Pro:  AI features (chat, scene generation, demo recorder), scene builder,
 *       animated backgrounds, AI captions, TTS
 *
 * Pro is unlocked by connecting to a Coherence account with an active
 * Studio Pro subscription (or Coherence Team plan).
 */

import {
	checkSubscription,
	getProStatus,
	getStoredProToken,
	hydrateProTokenCache,
	isProActive,
} from "./plugins/pro/proLoader";

export type LicenseTier = "free" | "pro";

export type ProFeature =
	| "ai-chat"
	| "ai-scene-generation"
	| "ai-demo-recorder"
	| "scene-builder"
	| "animated-backgrounds"
	| "ai-captions"
	| "tts"
	| "ai-polish";

const PRO_FEATURES: Set<ProFeature> = new Set([
	"ai-chat",
	"ai-scene-generation",
	"ai-demo-recorder",
	"scene-builder",
	"animated-backgrounds",
	"ai-captions",
	"tts",
	"ai-polish",
]);

const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
	"ai-chat": "AI Chat Assistant",
	"ai-scene-generation": "AI Scene Generation",
	"ai-demo-recorder": "AI Demo Recorder",
	"scene-builder": "Scene Builder",
	"animated-backgrounds": "Animated Backgrounds",
	"ai-captions": "AI Captions",
	tts: "Text-to-Speech",
	"ai-polish": "AI Polish",
};

let cachedTier: LicenseTier | null = null;

/**
 * Load the current license tier.
 * Only trusts proLoader — the stored setting is no longer authoritative.
 */
export async function getLicenseTier(): Promise<LicenseTier> {
	if (isProActive()) {
		cachedTier = "pro";
		return "pro";
	}
	if (cachedTier) return cachedTier;
	cachedTier = "free";
	return cachedTier;
}

/**
 * Set the license tier (called after successful pro activation).
 */
export async function setLicenseTier(tier: LicenseTier): Promise<void> {
	cachedTier = tier;
	await window.electronAPI?.setSetting("licenseTier", tier);
}

/**
 * Check if a feature is available in the current license tier.
 */
export async function isFeatureAvailable(feature: ProFeature): Promise<boolean> {
	if (!PRO_FEATURES.has(feature)) return true; // free features always available
	const tier = await getLicenseTier();
	return tier === "pro";
}

/**
 * Synchronous check using cached tier (call getLicenseTier() first to warm cache).
 */
export function isFeatureAvailableSync(feature: ProFeature): boolean {
	if (!PRO_FEATURES.has(feature)) return true;
	if (isProActive()) return true;
	return cachedTier === "pro";
}

/**
 * Get the human-readable label for a pro feature.
 */
export function getFeatureLabel(feature: ProFeature): string {
	return PRO_FEATURE_LABELS[feature] ?? feature;
}

/**
 * Warm the license cache at app startup.
 * Only does a SILENT check — if a stored token exists, verify the subscription.
 * Never opens the browser. The explicit "Connect to Coherence" button handles that.
 */
export async function initLicense(): Promise<LicenseTier> {
	cachedTier = null;

	// Hydrate the secure-storage token cache before any sync token reads.
	await hydrateProTokenCache();

	// If proLoader already verified, trust it
	if (getProStatus() === "active" || isProActive()) {
		cachedTier = "pro";
		return "pro";
	}

	// Silent check: if we have a stored token, verify the subscription without UI
	const storedToken = getStoredProToken();
	if (storedToken) {
		try {
			const sub = await checkSubscription();
			if (sub.active) {
				cachedTier = "pro";
				return "pro";
			}
		} catch {
			// Token expired or service unreachable — stay on free
		}
	}

	cachedTier = "free";
	return "free";
}
