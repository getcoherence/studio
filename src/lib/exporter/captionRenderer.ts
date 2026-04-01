import type { CaptionLine, CaptionStyle, CaptionTrack } from "@/lib/ai/types";

/**
 * Find the active caption line at a given timestamp.
 */
function findActiveLine(track: CaptionTrack, timeMs: number): CaptionLine | null {
	for (const line of track.lines) {
		if (timeMs >= line.startMs && timeMs <= line.endMs) {
			return line;
		}
	}
	return null;
}

/**
 * Draw a rounded rectangle (squircle-style background) on a 2D canvas context.
 */
function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "");
	return {
		r: Number.parseInt(clean.slice(0, 2), 16) || 0,
		g: Number.parseInt(clean.slice(2, 4), 16) || 0,
		b: Number.parseInt(clean.slice(4, 6), 16) || 0,
	};
}

/**
 * Measure the width of a word using the current font settings.
 */
function measureWord(ctx: CanvasRenderingContext2D, word: string): number {
	return ctx.measureText(word).width;
}

/**
 * Render captions onto a canvas 2D context at a specific timestamp.
 *
 * This is used during video export to burn captions into the output.
 *
 * @param ctx            Canvas 2D rendering context
 * @param captionTrack   The caption track data
 * @param captionStyle   Style configuration
 * @param currentTimeMs  Current playback time in milliseconds
 * @param canvasWidth    Canvas width in pixels
 * @param canvasHeight   Canvas height in pixels
 */
export function renderCaptions(
	ctx: CanvasRenderingContext2D,
	captionTrack: CaptionTrack,
	captionStyle: CaptionStyle,
	currentTimeMs: number,
	canvasWidth: number,
	canvasHeight: number,
): void {
	const activeLine = findActiveLine(captionTrack, currentTimeMs);
	if (!activeLine) return;

	// Scale font size relative to canvas height (designed for 1080p)
	const scaleFactor = canvasHeight / 1080;
	const fontSize = Math.round(captionStyle.fontSize * scaleFactor);
	const paddingX = Math.round(16 * scaleFactor);
	const paddingY = Math.round(8 * scaleFactor);
	const borderRadius = Math.round(8 * scaleFactor);

	// Set font
	ctx.font = `600 ${fontSize}px "${captionStyle.fontFamily}", sans-serif`;
	ctx.textBaseline = "middle";

	// Measure the full line width (with spacing)
	const words = activeLine.words;
	const spaceWidth = measureWord(ctx, " ");
	let totalTextWidth = 0;
	const wordWidths: number[] = [];

	for (let i = 0; i < words.length; i++) {
		const w = measureWord(ctx, words[i].text);
		wordWidths.push(w);
		totalTextWidth += w;
		if (i < words.length - 1) {
			totalTextWidth += spaceWidth;
		}
	}

	// Cap text width to 85% of canvas
	const maxWidth = canvasWidth * 0.85;
	const boxWidth = Math.min(totalTextWidth + paddingX * 2, maxWidth + paddingX * 2);
	const boxHeight = fontSize * 1.4 + paddingY * 2;

	// Calculate vertical position
	let boxY: number;
	switch (captionStyle.position) {
		case "top":
			boxY = canvasHeight * 0.08;
			break;
		case "center":
			boxY = (canvasHeight - boxHeight) / 2;
			break;
		case "bottom":
		default:
			boxY = canvasHeight * 0.92 - boxHeight;
			break;
	}

	// Center horizontally
	const boxX = (canvasWidth - boxWidth) / 2;

	// Draw background
	if (captionStyle.backgroundOpacity > 0) {
		const bg = hexToRgb(captionStyle.backgroundColor);
		ctx.save();
		ctx.fillStyle = `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${captionStyle.backgroundOpacity})`;
		drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, borderRadius);
		ctx.fill();
		ctx.restore();
	}

	// Draw text shadow
	ctx.save();
	ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
	ctx.shadowBlur = 4 * scaleFactor;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 1 * scaleFactor;

	// Draw each word
	let cursorX = boxX + paddingX;
	const textY = boxY + boxHeight / 2;

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		const isActive = currentTimeMs >= word.startMs && currentTimeMs <= word.endMs;
		const isPast = currentTimeMs > word.endMs;

		// Determine word color based on animation style
		if (captionStyle.animation === "word-highlight") {
			ctx.fillStyle = isActive ? captionStyle.activeWordColor : captionStyle.fontColor;
		} else if (captionStyle.animation === "fade-in") {
			const isFuture = currentTimeMs < word.startMs;
			const alpha = isFuture ? 0.3 : isPast || isActive ? 1 : 0.3;
			const color = hexToRgb(captionStyle.fontColor);
			ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
		} else {
			ctx.fillStyle = captionStyle.fontColor;
		}

		ctx.fillText(word.text, cursorX, textY);
		cursorX += wordWidths[i] + spaceWidth;
	}

	ctx.restore();
}
