/**
 * Cursor renderer for the export pipeline.
 *
 * Draws the cursor (with sway rotation, style, and click ring state) onto
 * a Canvas2D context.  Used by `FrameRenderer` during video export.
 */

import type { ClickRingState } from "./clickRing";
import type { CursorStyleDefinition } from "./cursorStyles";
import { getCursorStyle } from "./cursorStyles";

export interface RenderCursorOptions {
	/** Pixel X position on the export canvas. */
	x: number;
	/** Pixel Y position on the export canvas. */
	y: number;
	/** Rotation in radians (from sway effect). */
	rotation?: number;
	/** Cursor style definition (or name to look up). */
	style?: CursorStyleDefinition | string;
	/** Active click ring states to draw. */
	clickRings?: ClickRingState[];
	/** Resolved SVG image element for arrow-style cursors. */
	cursorImage?: HTMLImageElement | null;
}

/**
 * Draw the cursor and any active click rings onto a 2D canvas context.
 */
export function renderCursor(ctx: CanvasRenderingContext2D, options: RenderCursorOptions): void {
	const { x, y, rotation = 0, style: styleOrName, clickRings = [], cursorImage } = options;

	const styleDef =
		typeof styleOrName === "string"
			? getCursorStyle(styleOrName)
			: (styleOrName ?? getCursorStyle("default"));

	// Draw click rings first (behind cursor)
	for (const ring of clickRings) {
		ctx.save();
		ctx.beginPath();
		ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
		ctx.strokeStyle = ring.color;
		ctx.globalAlpha = ring.opacity;
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.restore();
	}

	// Draw cursor
	ctx.save();
	ctx.translate(x, y);
	if (rotation !== 0) {
		ctx.rotate(rotation);
	}

	if (styleDef.svg && cursorImage) {
		ctx.drawImage(
			cursorImage,
			-styleDef.hotspot.x,
			-styleDef.hotspot.y,
			styleDef.size,
			styleDef.size,
		);
	} else if (styleDef.name === "dot") {
		ctx.beginPath();
		ctx.arc(0, 0, styleDef.size / 2, 0, Math.PI * 2);
		ctx.fillStyle = styleDef.color;
		ctx.globalAlpha = 0.85;
		ctx.fill();
	} else if (styleDef.name === "crosshair" && cursorImage) {
		ctx.drawImage(
			cursorImage,
			-styleDef.hotspot.x,
			-styleDef.hotspot.y,
			styleDef.size,
			styleDef.size,
		);
	} else if (styleDef.name === "ring") {
		ctx.beginPath();
		ctx.arc(0, 0, styleDef.size / 2, 0, Math.PI * 2);
		ctx.strokeStyle = styleDef.color;
		ctx.lineWidth = 2;
		ctx.globalAlpha = 0.85;
		ctx.stroke();
		ctx.globalAlpha = 1;
		// Center dot
		ctx.beginPath();
		ctx.arc(0, 0, 2, 0, Math.PI * 2);
		ctx.fillStyle = styleDef.color;
		ctx.fill();
	} else {
		// Fallback: simple filled circle
		ctx.beginPath();
		ctx.arc(0, 0, 4, 0, Math.PI * 2);
		ctx.fillStyle = styleDef.color;
		ctx.fill();
	}

	ctx.restore();
}

/**
 * Pre-load an SVG-based cursor style into an HTMLImageElement that can be
 * passed to `renderCursor`.  Returns `null` for procedural styles (dot/ring).
 */
export function loadCursorImage(styleName: string): Promise<HTMLImageElement | null> {
	const styleDef = getCursorStyle(styleName);
	if (!styleDef.svg) return Promise.resolve(null);

	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		const blob = new Blob([styleDef.svg!], { type: "image/svg+xml" });
		const url = URL.createObjectURL(blob);
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = (err) => {
			URL.revokeObjectURL(url);
			reject(err);
		};
		img.src = url;
	});
}
