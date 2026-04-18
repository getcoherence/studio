// ── Scene Renderer ────────────────────────────────────────────────────────
//
// Renders a complete Scene frame to a CanvasRenderingContext2D at a given
// point in time. Pure function — deterministic output for a given timeMs.

import { getAnimatedBackground, isAnimatedBackground } from "@/lib/backgrounds";
import { renderLottieFrame } from "@/lib/lottie/lottieRenderer";
import { applyEasing, computeAnimation, identityTransform } from "./animations";
import type {
	ImageContent,
	LayerTransform,
	LottieContent,
	Scene,
	SceneLayer,
	ShapeContent,
	TextContent,
} from "./types";

// Cache loaded images by src to avoid reloading every frame
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): HTMLImageElement | null {
	if (!src) return null;
	const cached = imageCache.get(src);
	if (cached && cached.complete && cached.naturalWidth > 0) return cached;
	if (!cached) {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = src;
		imageCache.set(src, img);
	}
	return null; // not ready yet
}

// ── Background rendering ──────────────────────────────────────────────────

function renderBackground(
	ctx: CanvasRenderingContext2D,
	background: string,
	width: number,
	height: number,
	timeMs: number,
	animatedBgSpeed: number,
): void {
	if (isAnimatedBackground(background)) {
		const bg = getAnimatedBackground(background);
		if (bg) {
			bg.render(ctx, width, height, timeMs * animatedBgSpeed);
			return;
		}
	}
	// Solid color fallback
	ctx.fillStyle = background || "#09090b";
	ctx.fillRect(0, 0, width, height);
}

// ── Layer transform computation ───────────────────────────────────────────

function computeLayerTransform(
	layer: SceneLayer,
	timeMs: number,
	canvasWidth: number,
	canvasHeight: number,
): LayerTransform {
	const layerW = (layer.size.width / 100) * canvasWidth;
	const layerH = (layer.size.height / 100) * canvasHeight;
	const totalChars = layer.type === "text" ? (layer.content as TextContent).text.length : 0;

	// Layer not visible yet or already ended
	if (timeMs < layer.startMs || timeMs > layer.endMs) {
		return { ...identityTransform(), opacity: 0 };
	}

	const localTime = timeMs - layer.startMs;
	const layerDuration = layer.endMs - layer.startMs;

	const focusPoint = layer.entrance.focusPoint;

	// Entrance animation
	const entranceEnd = layer.entrance.delay + layer.entrance.durationMs;
	if (layer.entrance.type !== "none" && localTime < entranceEnd) {
		const rawProgress =
			localTime <= layer.entrance.delay
				? 0
				: (localTime - layer.entrance.delay) / layer.entrance.durationMs;
		const progress = applyEasing(layer.entrance.easing, Math.max(0, Math.min(1, rawProgress)));
		return computeAnimation(
			layer.entrance.type,
			progress,
			canvasWidth,
			canvasHeight,
			layerW,
			layerH,
			totalChars,
			focusPoint,
		);
	}

	// Exit animation
	const exitStart = layerDuration - layer.exit.durationMs;
	if (layer.exit.type !== "none" && localTime > exitStart && layer.exit.durationMs > 0) {
		const rawProgress = (localTime - exitStart) / layer.exit.durationMs;
		const progress = applyEasing(layer.exit.easing, Math.max(0, Math.min(1, rawProgress)));
		return computeAnimation(
			layer.exit.type,
			1 - progress,
			canvasWidth,
			canvasHeight,
			layerW,
			layerH,
			totalChars,
			layer.exit.focusPoint,
		);
	}

	// Steady state (ken-burns still animates during steady state for images)
	if (layer.type === "image" && layer.entrance.type === "ken-burns") {
		const steadyProgress = localTime / layerDuration;
		return computeAnimation(
			"ken-burns",
			steadyProgress,
			canvasWidth,
			canvasHeight,
			layerW,
			layerH,
			totalChars,
			focusPoint,
		);
	}

	return identityTransform();
}

// ── Text rendering ────────────────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines.length > 0 ? lines : [""];
}

function renderTextLayer(
	ctx: CanvasRenderingContext2D,
	content: TextContent,
	x: number,
	y: number,
	w: number,
	h: number,
	transform: LayerTransform,
): void {
	ctx.font = `${content.fontWeight} ${content.fontSize}px ${content.fontFamily}`;
	ctx.fillStyle = content.color;
	ctx.textBaseline = "top";

	const lineHeightPx = content.fontSize * content.lineHeight;
	const lines = wrapText(ctx, content.text, w);

	// Optional background
	if (content.backgroundColor) {
		ctx.fillStyle = content.backgroundColor;
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = content.color;
	}

	// If typewriter animation, limit visible characters
	let charsRemaining = transform.visibleChars === -1 ? Infinity : transform.visibleChars;

	for (let i = 0; i < lines.length; i++) {
		let lineText = lines[i];
		if (charsRemaining <= 0) break;
		if (charsRemaining < lineText.length) {
			lineText = lineText.slice(0, charsRemaining);
		}
		charsRemaining -= lines[i].length;

		let lineX = x;
		if (content.textAlign === "center") {
			const lw = ctx.measureText(lineText).width;
			lineX = x + (w - lw) / 2;
		} else if (content.textAlign === "right") {
			const lw = ctx.measureText(lineText).width;
			lineX = x + w - lw;
		}

		ctx.fillText(lineText, lineX, y + i * lineHeightPx);
	}
}

// ── Image rendering ───────────────────────────────────────────────────────

function renderImageLayer(
	ctx: CanvasRenderingContext2D,
	content: ImageContent,
	x: number,
	y: number,
	w: number,
	h: number,
): void {
	const img = loadImage(content.src);
	if (!img) {
		// Placeholder while loading
		ctx.fillStyle = "#ffffff10";
		ctx.fillRect(x, y, w, h);
		return;
	}

	ctx.save();

	// Border radius clipping
	if (content.borderRadius > 0) {
		const r = Math.min(content.borderRadius, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
		ctx.clip();
	}

	// Shadow
	if (content.shadow) {
		ctx.shadowColor = "rgba(0,0,0,0.5)";
		ctx.shadowBlur = 20;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 4;
	}

	// Determine source region (full image or cropped)
	const crop = content.cropRegion;
	const sx = crop ? Math.round(crop.x * img.naturalWidth) : 0;
	const sy = crop ? Math.round(crop.y * img.naturalHeight) : 0;
	const sw = crop ? Math.round(crop.width * img.naturalWidth) : img.naturalWidth;
	const sh = crop ? Math.round(crop.height * img.naturalHeight) : img.naturalHeight;

	// Draw image based on fit mode (using source region)
	if (content.fit === "fill") {
		ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
	} else if (content.fit === "contain") {
		const imgAspect = sw / sh;
		const boxAspect = w / h;
		let dw: number;
		let dh: number;
		if (imgAspect > boxAspect) {
			dw = w;
			dh = w / imgAspect;
		} else {
			dh = h;
			dw = h * imgAspect;
		}
		ctx.drawImage(img, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
	} else {
		// cover
		const imgAspect = sw / sh;
		const boxAspect = w / h;
		let dw: number;
		let dh: number;
		if (imgAspect > boxAspect) {
			dh = h;
			dw = h * imgAspect;
		} else {
			dw = w;
			dh = w / imgAspect;
		}
		ctx.drawImage(img, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
	}

	ctx.restore();
}

// ── Shape rendering ───────────────────────────────────────────────────────

function renderShapeLayer(
	ctx: CanvasRenderingContext2D,
	content: ShapeContent,
	x: number,
	y: number,
	w: number,
	h: number,
): void {
	ctx.fillStyle = content.fill;

	if (content.shape === "circle") {
		const cx = x + w / 2;
		const cy = y + h / 2;
		const r = Math.min(w, h) / 2;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
		if (content.stroke && content.strokeWidth) {
			ctx.strokeStyle = content.stroke;
			ctx.lineWidth = content.strokeWidth;
			ctx.stroke();
		}
	} else if (content.shape === "rounded-rect") {
		const r = Math.min(12, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
		ctx.fill();
		if (content.stroke && content.strokeWidth) {
			ctx.strokeStyle = content.stroke;
			ctx.lineWidth = content.strokeWidth;
			ctx.stroke();
		}
	} else {
		// rectangle
		ctx.fillRect(x, y, w, h);
		if (content.stroke && content.strokeWidth) {
			ctx.strokeStyle = content.stroke;
			ctx.lineWidth = content.strokeWidth;
			ctx.strokeRect(x, y, w, h);
		}
	}
}

// ── Main render function ──────────────────────────────────────────────────

export function renderScene(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	timeMs: number,
	width: number,
	height: number,
): void {
	ctx.clearRect(0, 0, width, height);

	// 1. Draw background
	renderBackground(ctx, scene.background, width, height, timeMs, scene.animatedBgSpeed);

	// 2. Sort layers by zIndex and render each
	const sortedLayers = [...scene.layers].sort((a, b) => a.zIndex - b.zIndex);

	for (const layer of sortedLayers) {
		// Skip layers outside their time window
		if (timeMs < layer.startMs || timeMs > layer.endMs) continue;

		const transform = computeLayerTransform(layer, timeMs, width, height);

		// Skip fully transparent layers
		if (transform.opacity <= 0 && transform.visibleChars === 0) continue;

		const layerX = (layer.position.x / 100) * width;
		const layerY = (layer.position.y / 100) * height;
		const layerW = (layer.size.width / 100) * width;
		const layerH = (layer.size.height / 100) * height;

		ctx.save();

		// Apply opacity
		if (transform.opacity < 1) {
			ctx.globalAlpha = Math.max(0, transform.opacity);
		}

		// Apply blur filter
		if (transform.blur > 0) {
			ctx.filter = `blur(${transform.blur}px)`;
		}

		// Apply wipe (clip) if partial
		if (transform.clipProgress < 1) {
			ctx.beginPath();
			ctx.rect(layerX, layerY, layerW * transform.clipProgress, layerH);
			ctx.clip();
		}

		// Apply scale + rotation around layer center
		const cx = layerX + layerW / 2 + transform.x;
		const cy = layerY + layerH / 2 + transform.y;
		if (
			transform.scaleX !== 1 ||
			transform.scaleY !== 1 ||
			transform.rotation !== 0 ||
			transform.x !== 0 ||
			transform.y !== 0
		) {
			ctx.translate(cx, cy);
			if (transform.rotation !== 0) {
				ctx.rotate((transform.rotation * Math.PI) / 180);
			}
			ctx.scale(transform.scaleX, transform.scaleY);
			ctx.translate(-cx, -cy);
			// Apply positional offset
			if (transform.x !== 0 || transform.y !== 0) {
				ctx.translate(transform.x, transform.y);
			}
		}

		// Render layer content
		switch (layer.type) {
			case "text":
				renderTextLayer(
					ctx,
					layer.content as TextContent,
					layerX,
					layerY,
					layerW,
					layerH,
					transform,
				);
				break;
			case "image":
				renderImageLayer(ctx, layer.content as ImageContent, layerX, layerY, layerW, layerH);
				break;
			case "video":
				// Video layers render first frame as static image on canvas
				renderImageLayer(ctx, { src: (layer.content as any).src, fit: (layer.content as any).fit, borderRadius: (layer.content as any).borderRadius, shadow: false } as ImageContent, layerX, layerY, layerW, layerH);
				break;
			case "shape":
				renderShapeLayer(ctx, layer.content as ShapeContent, layerX, layerY, layerW, layerH);
				break;
			case "lottie":
				renderLottieLayer(
					ctx,
					layer.content as LottieContent,
					layerX,
					layerY,
					layerW,
					layerH,
					timeMs,
					layer.startMs,
					layer.endMs,
				);
				break;
		}

		ctx.restore();
	}
}

// ── Lottie layer rendering ────────────────────────────────────────────────

function renderLottieLayer(
	ctx: CanvasRenderingContext2D,
	content: LottieContent,
	x: number,
	y: number,
	w: number,
	h: number,
	sceneTimeMs: number,
	layerStartMs: number,
	layerEndMs: number,
): void {
	const layerDuration = layerEndMs - layerStartMs;
	const localTime = sceneTimeMs - layerStartMs;
	let progress = layerDuration > 0 ? localTime / layerDuration : 0;

	if (content.loop) {
		progress = progress % 1;
	} else {
		progress = Math.max(0, Math.min(1, progress));
	}

	const frame = renderLottieFrame(
		content.animationId,
		progress,
		Math.round(w),
		Math.round(h),
		content.loop,
		content.speed,
	);

	if (frame) {
		if (content.tintColor) {
			ctx.drawImage(frame, x, y, w, h);
			ctx.globalCompositeOperation = "source-atop";
			ctx.fillStyle = content.tintColor;
			ctx.fillRect(x, y, w, h);
			ctx.globalCompositeOperation = "source-over";
		} else {
			ctx.drawImage(frame, x, y, w, h);
		}
	}
}

// ── Hit testing (for layer selection) ─────────────────────────────────────

export function hitTestLayers(
	scene: Scene,
	clickX: number,
	clickY: number,
	canvasWidth: number,
	canvasHeight: number,
	timeMs: number,
): SceneLayer | null {
	// Check layers in reverse zIndex order (topmost first)
	const sortedLayers = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex);

	for (const layer of sortedLayers) {
		if (timeMs < layer.startMs || timeMs > layer.endMs) continue;

		const lx = (layer.position.x / 100) * canvasWidth;
		const ly = (layer.position.y / 100) * canvasHeight;
		const lw = (layer.size.width / 100) * canvasWidth;
		const lh = (layer.size.height / 100) * canvasHeight;

		if (clickX >= lx && clickX <= lx + lw && clickY >= ly && clickY <= ly + lh) {
			return layer;
		}
	}
	return null;
}
