import type { AnimatedBackground } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MeshBlob {
	/** Orbit center in [0,1] canvas-relative coords */
	cx: number;
	cy: number;
	/** Orbit radius as fraction of canvas diagonal */
	orbitRadius: number;
	/** Orbit angular speed (radians per second) */
	angularSpeed: number;
	/** Initial angle offset */
	phaseOffset: number;
	/** Blob radius as fraction of canvas diagonal */
	radius: number;
	/** CSS color (should include some alpha for blending) */
	color: string;
}

function renderMesh(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	timeMs: number,
	bgColor: string,
	blobs: MeshBlob[],
	compositeOp: GlobalCompositeOperation,
): void {
	// Fill solid background
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, w, h);

	const t = timeMs / 1000;
	const diag = Math.sqrt(w * w + h * h);

	ctx.save();
	ctx.globalCompositeOperation = compositeOp;

	for (const blob of blobs) {
		const angle = blob.phaseOffset + t * blob.angularSpeed;
		const orbitPx = blob.orbitRadius * diag;
		const x = blob.cx * w + Math.cos(angle) * orbitPx;
		const y = blob.cy * h + Math.sin(angle) * orbitPx;
		const r = blob.radius * diag;

		const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
		grad.addColorStop(0, blob.color);
		grad.addColorStop(0.6, blob.color);
		grad.addColorStop(1, "rgba(0,0,0,0)");

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	}

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const appleDark: AnimatedBackground = {
	id: "mesh-apple-dark",
	name: "Apple Dark",
	type: "mesh",
	category: "Mesh Gradients",
	available: true,
	previewColor: "#09090b",
	render(ctx, w, h, timeMs) {
		renderMesh(
			ctx,
			w,
			h,
			timeMs,
			"#09090b",
			[
				{
					cx: 0.3,
					cy: 0.4,
					orbitRadius: 0.08,
					angularSpeed: 0.15,
					phaseOffset: 0,
					radius: 0.28,
					color: "rgba(168,85,247,0.45)",
				},
				{
					cx: 0.7,
					cy: 0.3,
					orbitRadius: 0.06,
					angularSpeed: -0.12,
					phaseOffset: 2.1,
					radius: 0.25,
					color: "rgba(59,130,246,0.4)",
				},
				{
					cx: 0.5,
					cy: 0.7,
					orbitRadius: 0.07,
					angularSpeed: 0.1,
					phaseOffset: 4.2,
					radius: 0.3,
					color: "rgba(236,72,153,0.35)",
				},
				{
					cx: 0.6,
					cy: 0.5,
					orbitRadius: 0.05,
					angularSpeed: -0.08,
					phaseOffset: 1.0,
					radius: 0.2,
					color: "rgba(16,185,129,0.3)",
				},
			],
			"screen",
		);
	},
};

const appleLight: AnimatedBackground = {
	id: "mesh-apple-light",
	name: "Apple Light",
	type: "mesh",
	category: "Mesh Gradients",
	available: true,
	previewColor: "#fafafa",
	render(ctx, w, h, timeMs) {
		renderMesh(
			ctx,
			w,
			h,
			timeMs,
			"#fafafa",
			[
				{
					cx: 0.35,
					cy: 0.35,
					orbitRadius: 0.06,
					angularSpeed: 0.12,
					phaseOffset: 0.5,
					radius: 0.3,
					color: "rgba(196,181,253,0.5)",
				},
				{
					cx: 0.65,
					cy: 0.4,
					orbitRadius: 0.07,
					angularSpeed: -0.1,
					phaseOffset: 2.5,
					radius: 0.28,
					color: "rgba(147,197,253,0.45)",
				},
				{
					cx: 0.5,
					cy: 0.65,
					orbitRadius: 0.05,
					angularSpeed: 0.09,
					phaseOffset: 4.0,
					radius: 0.25,
					color: "rgba(252,165,165,0.4)",
				},
			],
			"multiply",
		);
	},
};

const vapor: AnimatedBackground = {
	id: "mesh-vapor",
	name: "Vapor",
	type: "mesh",
	category: "Mesh Gradients",
	available: true,
	previewColor: "#1a0a2e",
	render(ctx, w, h, timeMs) {
		renderMesh(
			ctx,
			w,
			h,
			timeMs,
			"#1a0a2e",
			[
				{
					cx: 0.3,
					cy: 0.5,
					orbitRadius: 0.09,
					angularSpeed: 0.13,
					phaseOffset: 0,
					radius: 0.32,
					color: "rgba(236,72,153,0.5)",
				},
				{
					cx: 0.7,
					cy: 0.4,
					orbitRadius: 0.07,
					angularSpeed: -0.11,
					phaseOffset: 1.8,
					radius: 0.28,
					color: "rgba(6,182,212,0.45)",
				},
				{
					cx: 0.5,
					cy: 0.6,
					orbitRadius: 0.06,
					angularSpeed: 0.08,
					phaseOffset: 3.6,
					radius: 0.24,
					color: "rgba(168,85,247,0.4)",
				},
			],
			"screen",
		);
	},
};

export const MESH_GRADIENTS: AnimatedBackground[] = [appleDark, appleLight, vapor];
