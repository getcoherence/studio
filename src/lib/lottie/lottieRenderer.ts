// ── Lottie Frame Renderer ────────────────────────────────────────────────
//
// Renders Lottie animations frame-by-frame to an offscreen canvas.
// Uses lottie-web's canvas renderer with goToAndStop() for deterministic,
// frame-exact rendering compatible with the scene renderer's per-frame loop.

import lottie, { type AnimationItem } from "lottie-web";
import { getLottieAsset } from "./assets";

interface CachedAnimation {
	animation: AnimationItem;
	container: HTMLDivElement;
	canvas: HTMLCanvasElement;
	totalFrames: number;
}

const cache = new Map<string, CachedAnimation>();

/**
 * Render a single frame of a Lottie animation and return the canvas.
 * The caller composites this onto the scene canvas via drawImage().
 */
export function renderLottieFrame(
	animationId: string,
	progress: number,
	width: number,
	height: number,
	loop: boolean,
	speed: number,
): HTMLCanvasElement | null {
	let cached = cache.get(animationId);

	if (!cached) {
		const created = createAnimation(animationId, width, height);
		if (!created) return null;
		cached = created;
	}

	// Resize canvas if needed
	if (cached.canvas.width !== width || cached.canvas.height !== height) {
		cached.canvas.width = width;
		cached.canvas.height = height;
		cached.container.style.width = `${width}px`;
		cached.container.style.height = `${height}px`;
		cached.animation.resize();
	}

	// Calculate frame number
	let effectiveProgress = progress * speed;
	if (loop) {
		effectiveProgress = effectiveProgress % 1;
		if (effectiveProgress < 0) effectiveProgress += 1;
	} else {
		effectiveProgress = Math.max(0, Math.min(1, effectiveProgress));
	}

	const frameNumber = Math.floor(effectiveProgress * (cached.totalFrames - 1));

	// Render the specific frame
	cached.animation.goToAndStop(frameNumber, true);

	return cached.canvas;
}

/**
 * Preload a Lottie animation so it's ready for immediate rendering.
 */
export function preloadLottie(animationId: string): void {
	if (cache.has(animationId)) return;
	createAnimation(animationId, 200, 200);
}

/** Release all cached animations */
export function disposeLottieCache(): void {
	for (const cached of cache.values()) {
		cached.animation.destroy();
		cached.container.remove();
	}
	cache.clear();
}

function createAnimation(
	animationId: string,
	width: number,
	height: number,
): CachedAnimation | null {
	const asset = getLottieAsset(animationId);
	if (!asset) {
		console.warn(`Lottie asset not found: ${animationId}`);
		return null;
	}

	// Create a hidden container with a canvas for lottie-web
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.left = "-9999px";
	container.style.width = `${width}px`;
	container.style.height = `${height}px`;
	document.body.appendChild(container);

	const animation = lottie.loadAnimation({
		container,
		renderer: "canvas",
		loop: false,
		autoplay: false,
		animationData: asset.data,
		rendererSettings: {
			clearCanvas: true,
			preserveAspectRatio: "xMidYMid meet",
		},
	});

	// Get the canvas element created by lottie-web
	const canvas = container.querySelector("canvas");
	if (!canvas) {
		console.warn(`Lottie failed to create canvas for: ${animationId}`);
		animation.destroy();
		container.remove();
		return null;
	}

	canvas.width = width;
	canvas.height = height;

	const cached: CachedAnimation = {
		animation,
		container,
		canvas,
		totalFrames: animation.totalFrames || 30,
	};

	cache.set(animationId, cached);
	return cached;
}
