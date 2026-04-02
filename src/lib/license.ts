/**
 * Feature gating — Free vs Pro license system.
 *
 * Free: Screen recording, basic video editing (trim, zoom, speed, export)
 * Pro:  AI features (chat, scene generation, demo recorder), scene builder,
 *       animated backgrounds, AI captions, TTS
 */

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

/** In dev mode, everything is unlocked. */
function isDevMode(): boolean {
	try {
		return import.meta.env?.DEV === true;
	} catch {
		return false;
	}
}

/**
 * Load the current license tier from settings.
 * Dev mode always returns "pro".
 */
export async function getLicenseTier(): Promise<LicenseTier> {
	if (isDevMode()) {
		cachedTier = "pro";
		return "pro";
	}
	if (cachedTier) return cachedTier;
	try {
		const tier = (await window.electronAPI?.getSetting("licenseTier")) as LicenseTier | undefined;
		cachedTier = tier === "pro" ? "pro" : "free";
	} catch {
		cachedTier = "free";
	}
	return cachedTier;
}

/**
 * Set the license tier (called after purchase or license key validation).
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
 */
export async function initLicense(): Promise<LicenseTier> {
	cachedTier = null;
	return getLicenseTier();
}

/**
 * Validate a license key (placeholder — will call a license server in the future).
 */
export async function validateLicenseKey(key: string): Promise<boolean> {
	// TODO: Call license validation API
	// For now, accept any key starting with "LUCID-PRO-"
	if (key.startsWith("LUCID-PRO-") && key.length > 15) {
		await setLicenseTier("pro");
		return true;
	}
	return false;
}
