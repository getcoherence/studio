// ── Theme Configuration ─────────────────────────────────────────────────
//
// Structured theme system that flows from brand settings into every
// Remotion component. A single theme change transforms the entire
// visual language of a video.
//
// Inspired by OpenMontage's ThemeConfig pattern.

export interface ThemeConfig {
	// ── Colors ──
	primaryColor: string;
	accentColor: string;
	backgroundColor: string;
	surfaceColor: string;
	textColor: string;
	mutedTextColor: string;

	// ── Typography ──
	headingFont: string;
	bodyFont: string;
	monoFont: string;
	fontScale: "compact" | "default" | "spacious";

	// ── Motion ──
	springConfig: { damping: number; stiffness: number; mass: number };
	transitionDuration: number;
	pacing: "fast" | "normal" | "cinematic";

	// ── Visual Style ──
	chartColors: string[];
	particleStyle: "warm" | "cool" | "neon" | "minimal" | "none";
	backgroundStyle: "dark" | "light" | "gradient" | "mesh";

	// ── Captions ──
	captionHighlightColor: string;
	captionBackgroundColor: string;
}

/** Build a theme from minimal brand inputs */
export function buildTheme(opts: {
	accentColor: string;
	mood?: "professional" | "playful" | "cinematic" | "minimal" | "bold";
	darkMode?: boolean;
}): ThemeConfig {
	const { accentColor, mood = "professional", darkMode = true } = opts;

	// Derive complementary colors from accent
	const accent = accentColor;
	const accentLight = lighten(accent, 0.3);
	const accentDark = darken(accent, 0.3);

	const isDark = darkMode;

	const base: ThemeConfig = {
		primaryColor: accent,
		accentColor: accent,
		backgroundColor: isDark ? "#0a0a1a" : "#fafafa",
		surfaceColor: isDark ? "#1a1a2e" : "#ffffff",
		textColor: isDark ? "#f0f0f0" : "#1a1a1a",
		mutedTextColor: isDark ? "#888888" : "#666666",

		headingFont: "'Inter', system-ui, sans-serif",
		bodyFont: "'Inter', system-ui, sans-serif",
		monoFont: "'JetBrains Mono', monospace",
		fontScale: "default",

		springConfig: { damping: 14, stiffness: 180, mass: 1 },
		transitionDuration: 10,
		pacing: "normal",

		chartColors: [accent, accentLight, accentDark, "#10b981", "#f59e0b", "#ec4899"],
		particleStyle: "warm",
		backgroundStyle: isDark ? "dark" : "light",

		captionHighlightColor: accent,
		captionBackgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)",
	};

	// Apply mood-specific overrides
	switch (mood) {
		case "playful":
			base.springConfig = { damping: 10, stiffness: 200, mass: 0.8 };
			base.fontScale = "spacious";
			base.particleStyle = "warm";
			base.pacing = "fast";
			break;
		case "cinematic":
			base.springConfig = { damping: 20, stiffness: 120, mass: 1.2 };
			base.fontScale = "spacious";
			base.particleStyle = "minimal";
			base.pacing = "cinematic";
			base.transitionDuration = 15;
			base.headingFont = "'Playfair Display', serif";
			break;
		case "minimal":
			base.springConfig = { damping: 18, stiffness: 160, mass: 1 };
			base.fontScale = "compact";
			base.particleStyle = "none";
			base.pacing = "normal";
			break;
		case "bold":
			base.springConfig = { damping: 8, stiffness: 250, mass: 0.7 };
			base.fontScale = "spacious";
			base.particleStyle = "neon";
			base.pacing = "fast";
			base.headingFont = "'Oswald', sans-serif";
			break;
		case "professional":
		default:
			break;
	}

	return base;
}

/** Pre-built theme presets */
export const THEME_PRESETS: Record<string, ThemeConfig> = {
	"clean-professional": buildTheme({ accentColor: "#2563eb", mood: "professional" }),
	"bold-startup": buildTheme({ accentColor: "#7c3aed", mood: "bold" }),
	"cinematic-dark": buildTheme({ accentColor: "#e2e8f0", mood: "cinematic" }),
	"minimal-light": buildTheme({ accentColor: "#1a1a1a", mood: "minimal", darkMode: false }),
	"neon-tech": buildTheme({ accentColor: "#00ff88", mood: "bold" }),
	"warm-editorial": buildTheme({
		accentColor: "#c2410c",
		mood: "cinematic",
		darkMode: false,
	}),
	"anime-pop": buildTheme({ accentColor: "#ec4899", mood: "playful" }),
};

/** Resolve a theme from either a full config, a preset name, or accent color fallback */
export function resolveTheme(plan: {
	theme?: ThemeConfig;
	themePreset?: string;
	accentColor: string;
}): ThemeConfig {
	if (plan.theme) return plan.theme;
	if (plan.themePreset && THEME_PRESETS[plan.themePreset]) {
		return { ...THEME_PRESETS[plan.themePreset], accentColor: plan.accentColor };
	}
	return buildTheme({ accentColor: plan.accentColor });
}

// ── Color utilities ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [
		Number.parseInt(h.slice(0, 2), 16),
		Number.parseInt(h.slice(2, 4), 16),
		Number.parseInt(h.slice(4, 6), 16),
	];
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((c) =>
			Math.round(Math.max(0, Math.min(255, c)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

function lighten(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darken(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
