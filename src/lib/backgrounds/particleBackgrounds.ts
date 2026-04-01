import type { AnimatedBackground } from "./types";

// ---------------------------------------------------------------------------
// Deterministic pseudo-random seeding
// ---------------------------------------------------------------------------

/**
 * Hash-based pseudo-random in [0,1) from an integer seed.
 * Uses a simple triple-xorshift + golden-ratio multiply.
 */
function seededRandom(seed: number): number {
	let s = (seed | 0) + 0x9e3779b9;
	s ^= s >>> 16;
	s = Math.imul(s, 0x21f0aaad);
	s ^= s >>> 15;
	s = Math.imul(s, 0x735a2d97);
	s ^= s >>> 15;
	return (s >>> 0) / 0xffffffff;
}

// ---------------------------------------------------------------------------
// Particle position helpers (fully deterministic based on timeMs)
// ---------------------------------------------------------------------------

interface ParticleConfig {
	count: number;
	/** Base colors as CSS strings */
	colors: string[];
	/** Min/max radius in fraction of canvas width */
	minRadius: number;
	maxRadius: number;
	/** Speed multiplier (larger = faster) */
	speed: number;
	/** Direction: 1 = upward drift, -1 = downward drift */
	driftDirection: number;
	/** Min/max opacity for the outer edge of radial gradient */
	minOpacity: number;
	maxOpacity: number;
	/** Background fill */
	bgColor: string;
}

function renderParticles(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	timeMs: number,
	config: ParticleConfig,
): void {
	// Fill background
	ctx.fillStyle = config.bgColor;
	ctx.fillRect(0, 0, w, h);

	const t = timeMs / 1000; // seconds

	for (let i = 0; i < config.count; i++) {
		const seed = i;
		const r0 = seededRandom(seed * 3);
		const r1 = seededRandom(seed * 3 + 1);
		const r2 = seededRandom(seed * 3 + 2);

		// Particle radius (fraction of width)
		const radiusFrac = config.minRadius + r0 * (config.maxRadius - config.minRadius);
		const radius = radiusFrac * w;

		// Horizontal position wrapping
		const baseX = r1;
		const horizSpeed = (seededRandom(seed * 7) - 0.5) * config.speed * 0.003;
		const px = (((baseX + t * horizSpeed) % 1) + 1) % 1;

		// Vertical position wrapping
		const baseY = r2;
		const vertSpeed =
			config.driftDirection * config.speed * 0.005 * (0.5 + seededRandom(seed * 11) * 0.5);
		const py = (((baseY + t * vertSpeed) % 1) + 1) % 1;

		const x = px * w;
		const y = py * h;

		// Opacity with gentle pulsing
		const pulsePhase = seededRandom(seed * 13) * Math.PI * 2;
		const pulseSpeed = 0.5 + seededRandom(seed * 17) * 1.0;
		const pulse = (Math.sin(t * pulseSpeed + pulsePhase) + 1) / 2;
		const opacity = config.minOpacity + pulse * (config.maxOpacity - config.minOpacity);

		// Pick color deterministically
		const colorIdx =
			Math.floor(seededRandom(seed * 19) * config.colors.length) % config.colors.length;
		const color = config.colors[colorIdx];

		// Draw soft bokeh circle (radial gradient from solid center to transparent edge)
		const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
		grad.addColorStop(0, color);
		grad.addColorStop(0.4, color);
		grad.addColorStop(1, "rgba(0,0,0,0)");

		ctx.globalAlpha = opacity;
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const bokehWarm: AnimatedBackground = {
	id: "particle-bokeh-warm",
	name: "Bokeh Warm",
	type: "particles",
	category: "Particles",
	available: true,
	previewColor: "#1c1917",
	render(ctx, w, h, timeMs) {
		renderParticles(ctx, w, h, timeMs, {
			count: 30,
			colors: [
				"rgba(251,191,36,0.8)",
				"rgba(245,158,11,0.7)",
				"rgba(239,68,68,0.6)",
				"rgba(249,115,22,0.7)",
				"rgba(254,240,138,0.5)",
			],
			minRadius: 0.02,
			maxRadius: 0.08,
			speed: 1,
			driftDirection: -1, // upward
			minOpacity: 0.2,
			maxOpacity: 0.7,
			bgColor: "#1c1917",
		});
	},
};

const bokehCool: AnimatedBackground = {
	id: "particle-bokeh-cool",
	name: "Bokeh Cool",
	type: "particles",
	category: "Particles",
	available: true,
	previewColor: "#0f172a",
	render(ctx, w, h, timeMs) {
		renderParticles(ctx, w, h, timeMs, {
			count: 30,
			colors: [
				"rgba(99,102,241,0.7)",
				"rgba(139,92,246,0.6)",
				"rgba(59,130,246,0.7)",
				"rgba(14,165,233,0.5)",
				"rgba(192,132,252,0.6)",
			],
			minRadius: 0.02,
			maxRadius: 0.08,
			speed: 0.8,
			driftDirection: -1,
			minOpacity: 0.2,
			maxOpacity: 0.65,
			bgColor: "#0f172a",
		});
	},
};

const snow: AnimatedBackground = {
	id: "particle-snow",
	name: "Snow",
	type: "particles",
	category: "Particles",
	available: true,
	previewColor: "#1e293b",
	render(ctx, w, h, timeMs) {
		renderParticles(ctx, w, h, timeMs, {
			count: 45,
			colors: ["rgba(255,255,255,0.9)", "rgba(226,232,240,0.8)", "rgba(248,250,252,0.85)"],
			minRadius: 0.003,
			maxRadius: 0.012,
			speed: 0.6,
			driftDirection: 1, // downward
			minOpacity: 0.3,
			maxOpacity: 0.9,
			bgColor: "#1e293b",
		});
	},
};

const stars: AnimatedBackground = {
	id: "particle-stars",
	name: "Stars",
	type: "particles",
	category: "Particles",
	available: true,
	previewColor: "#030712",
	render(ctx, w, h, timeMs) {
		// Dark background
		ctx.fillStyle = "#030712";
		ctx.fillRect(0, 0, w, h);

		const t = timeMs / 1000;
		const count = 50;

		for (let i = 0; i < count; i++) {
			const x = seededRandom(i * 5) * w;
			const y = seededRandom(i * 5 + 1) * h;
			const baseSize = 1 + seededRandom(i * 5 + 2) * 2.5;

			// Twinkling
			const phase = seededRandom(i * 5 + 3) * Math.PI * 2;
			const speed = 0.8 + seededRandom(i * 5 + 4) * 2;
			const twinkle = (Math.sin(t * speed + phase) + 1) / 2;
			const opacity = 0.2 + twinkle * 0.8;

			ctx.globalAlpha = opacity;
			ctx.fillStyle = "#f8fafc";
			ctx.beginPath();
			ctx.arc(x, y, baseSize, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
	},
};

export const PARTICLE_BACKGROUNDS: AnimatedBackground[] = [bokehWarm, bokehCool, snow, stars];
