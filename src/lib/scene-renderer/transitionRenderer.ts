// ── Scene Transition Renderer ─────────────────────────────────────────────
//
// Renders a visual transition between two scenes. Takes the last frame of
// the outgoing scene and first frame of the incoming scene as offscreen
// canvases, and composites them to the target context at a given progress.

import type { SceneTransition } from "./types";

/**
 * Render a transition between two scenes at the given progress (0-1).
 *
 * @param ctx       Target canvas context to draw into
 * @param from      Last frame of the outgoing scene
 * @param to        First frame of the incoming scene
 * @param progress  0 = fully showing "from", 1 = fully showing "to"
 * @param type      Transition type
 * @param width     Canvas width
 * @param height    Canvas height
 */
export function renderTransition(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	type: SceneTransition["type"],
	width: number,
	height: number,
): void {
	// Clamp progress
	const p = Math.max(0, Math.min(1, progress));

	switch (type) {
		case "fade":
			renderFade(ctx, from, to, p, width, height);
			break;
		case "wipe-left":
			renderWipeLeft(ctx, from, to, p, width, height);
			break;
		case "wipe-right":
			renderWipeRight(ctx, from, to, p, width, height);
			break;
		case "wipe-up":
			renderWipeUp(ctx, from, to, p, width, height);
			break;
		case "dissolve":
			renderDissolve(ctx, from, to, p, width, height);
			break;
		case "zoom":
			renderZoom(ctx, from, to, p, width, height);
			break;
		case "none":
		default:
			// No transition — just show the "to" canvas
			ctx.drawImage(to, 0, 0, width, height);
			break;
	}
}

// ── Fade ─────────────────────────────────────────────────────────────────

function renderFade(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// Draw outgoing at decreasing opacity
	ctx.globalAlpha = 1 - progress;
	ctx.drawImage(from, 0, 0, width, height);

	// Draw incoming at increasing opacity
	ctx.globalAlpha = progress;
	ctx.drawImage(to, 0, 0, width, height);

	ctx.globalAlpha = 1;
}

// ── Wipe Left (incoming wipes in from the right edge, moving left) ──────

function renderWipeLeft(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// Draw outgoing scene fully
	ctx.drawImage(from, 0, 0, width, height);

	// Clip region for the incoming scene — starts from right edge, sweeps left
	const clipX = width * (1 - progress);
	ctx.save();
	ctx.beginPath();
	ctx.rect(clipX, 0, width - clipX, height);
	ctx.clip();
	ctx.drawImage(to, 0, 0, width, height);
	ctx.restore();
}

// ── Wipe Right (incoming wipes in from the left edge, moving right) ─────

function renderWipeRight(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// Draw outgoing scene fully
	ctx.drawImage(from, 0, 0, width, height);

	// Clip region — starts from left edge, sweeps right
	const clipW = width * progress;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, clipW, height);
	ctx.clip();
	ctx.drawImage(to, 0, 0, width, height);
	ctx.restore();
}

// ── Wipe Up (incoming wipes in from the bottom, moving up) ──────────────

function renderWipeUp(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// Draw outgoing scene fully
	ctx.drawImage(from, 0, 0, width, height);

	// Clip from bottom moving up
	const clipY = height * (1 - progress);
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, clipY, width, height - clipY);
	ctx.clip();
	ctx.drawImage(to, 0, 0, width, height);
	ctx.restore();
}

// ── Dissolve (pixelated crossfade using imageData mixing) ───────────────

function renderDissolve(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// Draw both scenes to get their image data
	ctx.drawImage(from, 0, 0, width, height);
	const fromData = ctx.getImageData(0, 0, width, height);

	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(to, 0, 0, width, height);
	const toData = ctx.getImageData(0, 0, width, height);

	// Mix pixel data with a block-based dissolve pattern
	const blockSize = 8;
	const result = ctx.createImageData(width, height);
	const fd = fromData.data;
	const td = toData.data;
	const rd = result.data;

	// Use a pseudo-random threshold pattern per block for the dissolve effect
	for (let by = 0; by < height; by += blockSize) {
		for (let bx = 0; bx < width; bx += blockSize) {
			// Simple hash for this block to create a pseudo-random threshold
			const hash = ((bx * 7919 + by * 6271) % 997) / 997;
			const showTo = hash < progress;

			for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
				for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
					const i = ((by + dy) * width + (bx + dx)) * 4;
					if (showTo) {
						rd[i] = td[i];
						rd[i + 1] = td[i + 1];
						rd[i + 2] = td[i + 2];
						rd[i + 3] = td[i + 3];
					} else {
						rd[i] = fd[i];
						rd[i + 1] = fd[i + 1];
						rd[i + 2] = fd[i + 2];
						rd[i + 3] = fd[i + 3];
					}
				}
			}
		}
	}

	ctx.putImageData(result, 0, 0);
}

// ── Zoom (outgoing scales down, incoming scales up) ─────────────────────

function renderZoom(
	ctx: CanvasRenderingContext2D,
	from: HTMLCanvasElement,
	to: HTMLCanvasElement,
	progress: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// Outgoing: shrinks from 1 → 0.5, fades out
	const fromScale = 1 - progress * 0.5;
	const fromAlpha = 1 - progress;
	const fromW = width * fromScale;
	const fromH = height * fromScale;

	ctx.save();
	ctx.globalAlpha = fromAlpha;
	ctx.drawImage(from, (width - fromW) / 2, (height - fromH) / 2, fromW, fromH);
	ctx.restore();

	// Incoming: grows from 0.5 → 1, fades in
	const toScale = 0.5 + progress * 0.5;
	const toAlpha = progress;
	const toW = width * toScale;
	const toH = height * toScale;

	ctx.save();
	ctx.globalAlpha = toAlpha;
	ctx.drawImage(to, (width - toW) / 2, (height - toH) / 2, toW, toH);
	ctx.restore();
}

/**
 * Capture the current content of a CanvasRenderingContext2D to an offscreen canvas.
 */
export function captureCanvas(
	sourceCtx: CanvasRenderingContext2D,
	width: number,
	height: number,
): HTMLCanvasElement {
	const offscreen = document.createElement("canvas");
	offscreen.width = width;
	offscreen.height = height;
	const ctx = offscreen.getContext("2d")!;
	ctx.drawImage(sourceCtx.canvas, 0, 0, width, height);
	return offscreen;
}
