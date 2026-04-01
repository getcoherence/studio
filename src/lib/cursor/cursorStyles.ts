/**
 * Cursor style presets.
 *
 * Each style defines how the cursor is rendered in the preview and export
 * pipeline.  SVG paths are used for arrow-like cursors; simple shapes
 * (dot, crosshair, ring) are drawn procedurally.
 */

export interface CursorStyleHotspot {
	x: number;
	y: number;
}

export interface CursorStyleDefinition {
	name: string;
	/** SVG markup (optional). When absent the renderer draws a procedural shape. */
	svg?: string;
	/** Logical size in pixels. */
	size: number;
	/** Hotspot offset from the top-left corner in pixels. */
	hotspot: CursorStyleHotspot;
	/** Primary color (used for fill / stroke). */
	color: string;
}

// ── Default arrow cursor (macOS-style) ──────────────────────────────────
const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M5 3l14 9.5L11.5 14l-2.5 7L5 3z" fill="white" stroke="black" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

// ── Crosshair SVG ───────────────────────────────────────────────────────
const CROSSHAIR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="1.5" opacity="0.9"/>
  <line x1="12" y1="2" x2="12" y2="8" stroke="white" stroke-width="1.5" opacity="0.9"/>
  <line x1="12" y1="16" x2="12" y2="22" stroke="white" stroke-width="1.5" opacity="0.9"/>
  <line x1="2" y1="12" x2="8" y2="12" stroke="white" stroke-width="1.5" opacity="0.9"/>
  <line x1="16" y1="12" x2="22" y2="12" stroke="white" stroke-width="1.5" opacity="0.9"/>
</svg>`;

export const CURSOR_STYLES: CursorStyleDefinition[] = [
	{
		name: "default",
		svg: ARROW_SVG,
		size: 24,
		hotspot: { x: 5, y: 3 },
		color: "#ffffff",
	},
	{
		name: "dot",
		size: 16,
		hotspot: { x: 8, y: 8 },
		color: "#34B27B",
	},
	{
		name: "crosshair",
		svg: CROSSHAIR_SVG,
		size: 24,
		hotspot: { x: 12, y: 12 },
		color: "#ffffff",
	},
	{
		name: "ring",
		size: 20,
		hotspot: { x: 10, y: 10 },
		color: "#ffffff",
	},
];

/**
 * Look up a cursor style by name. Falls back to `"default"` if not found.
 */
export function getCursorStyle(name: string): CursorStyleDefinition {
	return CURSOR_STYLES.find((s) => s.name === name) ?? CURSOR_STYLES[0];
}
