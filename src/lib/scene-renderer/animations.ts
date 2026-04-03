// ── Animation Engine ──────────────────────────────────────────────────────
//
// Pure functions that map a progress value (0-1) to a LayerTransform object.
// These are used by the scene renderer to compute per-frame layer state.

import type { AnimationType, LayerTransform } from "./types";

// ── Easing functions ──────────────────────────────────────────────────────

export type EasingName = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring";

export function linear(t: number): number {
	return t;
}

export function easeIn(t: number): number {
	return t * t * t;
}

export function easeOut(t: number): number {
	const inv = 1 - t;
	return 1 - inv * inv * inv;
}

export function easeInOut(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function spring(t: number): number {
	// Attempt to model a spring-like overshoot with damped oscillation
	const c4 = (2 * Math.PI) / 3;
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

const EASING_MAP: Record<EasingName, (t: number) => number> = {
	linear,
	"ease-in": easeIn,
	"ease-out": easeOut,
	"ease-in-out": easeInOut,
	spring,
};

export function applyEasing(name: EasingName, t: number): number {
	const fn = EASING_MAP[name] ?? linear;
	return fn(Math.max(0, Math.min(1, t)));
}

// ── Identity transform (fully visible, no transforms) ─────────────────────

export function identityTransform(): LayerTransform {
	return {
		opacity: 1,
		x: 0,
		y: 0,
		scaleX: 1,
		scaleY: 1,
		rotation: 0,
		clipProgress: 1,
		blur: 0,
		visibleChars: -1,
	};
}

// ── Animation functions ───────────────────────────────────────────────────
//
// Each returns a LayerTransform representing the entrance state at the given
// progress (0 = just entering, 1 = fully visible).
// For exit animations, the caller provides (1 - exitProgress) so these same
// functions work in reverse.

export function animateFade(progress: number): LayerTransform {
	return { ...identityTransform(), opacity: progress };
}

export function animateSlideLeft(
	progress: number,
	_w: number,
	_h: number,
	canvasW: number,
): LayerTransform {
	// Slide from left edge (off-screen) to position
	const offset = (1 - progress) * -canvasW * 0.3;
	return { ...identityTransform(), x: offset, opacity: progress };
}

export function animateSlideRight(
	progress: number,
	_w: number,
	_h: number,
	canvasW: number,
): LayerTransform {
	const offset = (1 - progress) * canvasW * 0.3;
	return { ...identityTransform(), x: offset, opacity: progress };
}

export function animateSlideUp(
	progress: number,
	_w: number,
	_h: number,
	_canvasW: number,
	canvasH: number,
): LayerTransform {
	const offset = (1 - progress) * canvasH * 0.3;
	return { ...identityTransform(), y: offset, opacity: progress };
}

export function animateSlideDown(
	progress: number,
	_w: number,
	_h: number,
	_canvasW: number,
	canvasH: number,
): LayerTransform {
	const offset = (1 - progress) * -canvasH * 0.3;
	return { ...identityTransform(), y: offset, opacity: progress };
}

export function animateTypewriter(progress: number, totalChars: number): LayerTransform {
	return {
		...identityTransform(),
		visibleChars: Math.floor(totalChars * progress),
	};
}

export function animateBounce(progress: number): LayerTransform {
	// Spring-style bounce uses easeOut already applied, but we add overshoot
	const p = progress;
	let scale: number;
	if (p < 0.6) {
		// Scale from 0 to ~1.15
		scale = (p / 0.6) * 1.15;
	} else if (p < 0.8) {
		// Overshoot back to ~0.95
		const t = (p - 0.6) / 0.2;
		scale = 1.15 - 0.2 * t;
	} else {
		// Settle to 1
		const t = (p - 0.8) / 0.2;
		scale = 0.95 + 0.05 * t;
	}
	return {
		...identityTransform(),
		scaleX: scale,
		scaleY: scale,
		opacity: Math.min(1, progress * 3),
	};
}

export function animateZoomIn(progress: number): LayerTransform {
	const scale = progress;
	return {
		...identityTransform(),
		scaleX: scale,
		scaleY: scale,
		opacity: progress,
	};
}

export function animateZoomOut(progress: number): LayerTransform {
	const scale = 2 - progress; // 2 → 1
	return {
		...identityTransform(),
		scaleX: scale,
		scaleY: scale,
		opacity: progress,
	};
}

export function animateBlurIn(progress: number): LayerTransform {
	// Blur decreases from 20px → 0
	const blur = (1 - progress) * 20;
	return { ...identityTransform(), opacity: progress, blur };
}

export function animateWipe(progress: number): LayerTransform {
	// clipProgress controls a left-to-right reveal
	return { ...identityTransform(), clipProgress: progress };
}

/**
 * Ken Burns — slow zoom + pan toward a focus point.
 * focusPoint is 0-1 normalized (0.5, 0.5 = center).
 * layerW/layerH are the layer's pixel dimensions for calculating pan distance.
 */
export function animateKenBurns(
	progress: number,
	focusPoint?: { x: number; y: number },
	layerW?: number,
	layerH?: number,
): LayerTransform {
	const zoom = 1 + 0.08 * progress; // 8% zoom over duration (subtle, performant)
	const fx = focusPoint?.x ?? 0.5;
	const fy = focusPoint?.y ?? 0.5;
	const w = layerW ?? 100;
	const h = layerH ?? 100;

	// Pan toward the focus point: offset = distance from center * zoom * progress
	const panX = (0.5 - fx) * w * 0.08 * progress;
	const panY = (0.5 - fy) * h * 0.08 * progress;

	return {
		...identityTransform(),
		scaleX: zoom,
		scaleY: zoom,
		x: panX,
		y: panY,
	};
}

export function animateRotateIn(progress: number): LayerTransform {
	const rotation = (1 - progress) * -90; // -90° → 0°
	return {
		...identityTransform(),
		rotation,
		opacity: progress,
		scaleX: 0.5 + 0.5 * progress,
		scaleY: 0.5 + 0.5 * progress,
	};
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export function computeAnimation(
	type: AnimationType,
	progress: number,
	canvasWidth: number,
	canvasHeight: number,
	layerWidth: number,
	layerHeight: number,
	totalChars: number,
	focusPoint?: { x: number; y: number },
): LayerTransform {
	switch (type) {
		case "none":
			return identityTransform();
		case "fade":
			return animateFade(progress);
		case "slide-left":
			return animateSlideLeft(progress, layerWidth, layerHeight, canvasWidth);
		case "slide-right":
			return animateSlideRight(progress, layerWidth, layerHeight, canvasWidth);
		case "slide-up":
			return animateSlideUp(progress, layerWidth, layerHeight, canvasWidth, canvasHeight);
		case "slide-down":
			return animateSlideDown(progress, layerWidth, layerHeight, canvasWidth, canvasHeight);
		case "typewriter":
			return animateTypewriter(progress, totalChars);
		case "bounce":
			return animateBounce(progress);
		case "zoom-in":
			return animateZoomIn(progress);
		case "zoom-out":
			return animateZoomOut(progress);
		case "blur-in":
			return animateBlurIn(progress);
		case "wipe":
			return animateWipe(progress);
		case "ken-burns":
			return animateKenBurns(progress, focusPoint, layerWidth, layerHeight);
		case "rotate-in":
			return animateRotateIn(progress);
		default:
			return identityTransform();
	}
}
