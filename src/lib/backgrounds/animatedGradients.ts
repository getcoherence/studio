import type { AnimatedBackground } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic sine-based oscillator with a full cycle period in ms. */
function osc(timeMs: number, periodMs: number, phase = 0): number {
	return Math.sin((timeMs / periodMs) * Math.PI * 2 + phase);
}

/** Linearly interpolate between two values. */
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Map a [-1,1] oscillator value into [lo, hi]. */
function remap(value: number, lo: number, hi: number): number {
	return lerp(lo, hi, (value + 1) / 2);
}

/** Rotate gradient endpoints around center. */
function rotatedGradientPoints(
	angle: number,
	w: number,
	h: number,
): { x0: number; y0: number; x1: number; y1: number } {
	const cx = w / 2;
	const cy = h / 2;
	const diag = Math.sqrt(w * w + h * h) / 2;
	const rad = (angle * Math.PI) / 180;
	return {
		x0: cx - Math.cos(rad) * diag,
		y0: cy - Math.sin(rad) * diag,
		x1: cx + Math.cos(rad) * diag,
		y1: cy + Math.sin(rad) * diag,
	};
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const aurora: AnimatedBackground = {
	id: "animated-aurora",
	name: "Aurora",
	type: "animated-gradient",
	category: "Animated Gradients",
	available: true,
	previewColor: "#0a2e1a",
	render(ctx, w, h, timeMs) {
		const angle = remap(osc(timeMs, 96000), 100, 140);
		const pts = rotatedGradientPoints(angle, w, h);
		const grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);

		const shift = remap(osc(timeMs, 80000, 1), 0.15, 0.35);
		grad.addColorStop(0, "#0a2e1a");
		grad.addColorStop(shift, "#1a6b3c");
		grad.addColorStop(shift + 0.2, "#2dd4a8");
		grad.addColorStop(0.65, "#3b82f6");
		grad.addColorStop(0.85, "#7c3aed");
		grad.addColorStop(1, "#1e1b4b");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	},
};

const sunsetFlow: AnimatedBackground = {
	id: "animated-sunset-flow",
	name: "Sunset Flow",
	type: "animated-gradient",
	category: "Animated Gradients",
	available: true,
	previewColor: "#7c2d12",
	render(ctx, w, h, timeMs) {
		const angle = remap(osc(timeMs, 112000), 110, 170);
		const pts = rotatedGradientPoints(angle, w, h);
		const grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);

		const s1 = remap(osc(timeMs, 88000, 0.5), 0.2, 0.4);
		const s2 = remap(osc(timeMs, 72000, 2), 0.5, 0.7);
		grad.addColorStop(0, "#fdba74");
		grad.addColorStop(s1, "#f97316");
		grad.addColorStop(s2, "#db2777");
		grad.addColorStop(1, "#7c3aed");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	},
};

const oceanWave: AnimatedBackground = {
	id: "animated-ocean-wave",
	name: "Ocean Wave",
	type: "animated-gradient",
	category: "Animated Gradients",
	available: true,
	previewColor: "#0c4a6e",
	render(ctx, w, h, timeMs) {
		const angle = remap(osc(timeMs, 120000), 140, 200);
		const pts = rotatedGradientPoints(angle, w, h);
		const grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);

		const s = remap(osc(timeMs, 80000, 3), 0.25, 0.45);
		grad.addColorStop(0, "#0c4a6e");
		grad.addColorStop(s, "#0891b2");
		grad.addColorStop(s + 0.25, "#06b6d4");
		grad.addColorStop(0.85, "#164e63");
		grad.addColorStop(1, "#082f49");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	},
};

const neonPulse: AnimatedBackground = {
	id: "animated-neon-pulse",
	name: "Neon Pulse",
	type: "animated-gradient",
	category: "Animated Gradients",
	available: true,
	previewColor: "#0f0326",
	render(ctx, w, h, timeMs) {
		const angle = remap(osc(timeMs, 64000), 120, 180);
		const pts = rotatedGradientPoints(angle, w, h);
		const grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);

		// Pulsing brightness via stop offset oscillation
		const pulse = remap(osc(timeMs, 24000), 0.3, 0.6);
		grad.addColorStop(0, "#0f0326");
		grad.addColorStop(pulse - 0.1, "#ec4899");
		grad.addColorStop(pulse + 0.1, "#6366f1");
		grad.addColorStop(1, "#020617");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	},
};

const midnight: AnimatedBackground = {
	id: "animated-midnight",
	name: "Midnight",
	type: "animated-gradient",
	category: "Animated Gradients",
	available: true,
	previewColor: "#0f172a",
	render(ctx, w, h, timeMs) {
		const angle = remap(osc(timeMs, 160000), 130, 170);
		const pts = rotatedGradientPoints(angle, w, h);
		const grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);

		const shift = remap(osc(timeMs, 120000, 1.5), 0.3, 0.55);
		grad.addColorStop(0, "#0f172a");
		grad.addColorStop(shift, "#1e1b4b");
		grad.addColorStop(shift + 0.2, "#312e81");
		grad.addColorStop(1, "#0f172a");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	},
};

const forest: AnimatedBackground = {
	id: "animated-forest",
	name: "Forest",
	type: "animated-gradient",
	category: "Animated Gradients",
	available: true,
	previewColor: "#052e16",
	render(ctx, w, h, timeMs) {
		const angle = remap(osc(timeMs, 104000), 100, 160);
		const pts = rotatedGradientPoints(angle, w, h);
		const grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);

		const s = remap(osc(timeMs, 88000, 2), 0.25, 0.45);
		grad.addColorStop(0, "#052e16");
		grad.addColorStop(s, "#166534");
		grad.addColorStop(s + 0.2, "#10b981");
		grad.addColorStop(0.8, "#065f46");
		grad.addColorStop(1, "#022c22");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	},
};

export const ANIMATED_GRADIENTS: AnimatedBackground[] = [
	aurora,
	sunsetFlow,
	oceanWave,
	neonPulse,
	midnight,
	forest,
];
