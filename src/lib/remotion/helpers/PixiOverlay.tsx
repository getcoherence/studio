// ── PixiJS Overlay ──────────────────────────────────────────────────────
//
// GPU-accelerated effects layer using PixiJS. Renders particle systems,
// shader-based filters, and custom GLSL effects on a transparent canvas
// overlaid on Remotion scene content.
//
// Key requirements for Remotion compatibility:
// 1. Ticker is stopped — no requestAnimationFrame loop
// 2. app.render() called manually per frame
// 3. All randomness uses frame-seeded RNG for deterministic output
// 4. Canvas is transparent so it composites cleanly

import React, { useCallback, useEffect, useRef } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

// ── Types ──────────────────────────────────────────────────────────────

export type PixiEffectDescriptor =
	| { type: "particles"; config: PixiParticleConfig }
	| { type: "filter"; config: PixiFilterConfig };

export interface PixiParticleConfig {
	/** Preset particle behavior */
	preset: "confetti-burst" | "fire" | "smoke" | "rain" | "dust" | "sparks-gpu" | "custom";
	/** Number of particles */
	count: number;
	/** Particle colors */
	colors: string[];
	/** Gravity force (negative = upward) */
	gravity: number;
	/** Velocity range */
	velocity: { min: number; max: number };
	/** Lifetime in frames */
	lifetime: { min: number; max: number };
	/** Seed for deterministic RNG */
	seed?: string;
}

export interface PixiFilterConfig {
	/** Built-in filter effect */
	preset: "film-grain" | "vhs-scanlines" | "chromatic-aberration" | "crt" | "noise";
	/** Effect intensity 0-1 */
	intensity: number;
}

export interface PixiOverlayProps {
	/** Effect descriptors to render */
	effects: PixiEffectDescriptor[];
	/** Overall opacity of the overlay */
	opacity?: number;
}

// ── Deterministic RNG ──────────────────────────────────────────────────

/** Seeded random using Remotion's random() for deterministic output */
function seededRandom(seed: string, index: number): number {
	return random(`${seed}-${index}`);
}

// ── Particle State ─────────────────────────────────────────────────────

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	color: string;
	size: number;
	rotation: number;
	rotSpeed: number;
}

function generateParticles(config: PixiParticleConfig, width: number, height: number): Particle[] {
	const seed = config.seed ?? "pixi-particles";
	return Array.from({ length: config.count }, (_, i) => {
		const angle = seededRandom(`${seed}-angle`, i) * Math.PI * 2;
		const speed =
			config.velocity.min +
			seededRandom(`${seed}-vel`, i) * (config.velocity.max - config.velocity.min);
		const life =
			config.lifetime.min +
			Math.floor(seededRandom(`${seed}-life`, i) * (config.lifetime.max - config.lifetime.min));

		let x = seededRandom(`${seed}-x`, i) * width;
		let y = seededRandom(`${seed}-y`, i) * height;

		// Preset-specific spawn positions
		switch (config.preset) {
			case "confetti-burst":
				x = width / 2;
				y = height / 2;
				break;
			case "fire":
				x = width * 0.3 + seededRandom(`${seed}-fx`, i) * width * 0.4;
				y = height;
				break;
			case "rain":
				y = -20;
				break;
			case "smoke":
				x = width / 2 + (seededRandom(`${seed}-sx`, i) - 0.5) * 100;
				y = height * 0.8;
				break;
		}

		return {
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			life: 0,
			maxLife: life,
			color: config.colors[i % config.colors.length],
			size: 2 + seededRandom(`${seed}-size`, i) * 6,
			rotation: seededRandom(`${seed}-rot`, i) * 360,
			rotSpeed: (seededRandom(`${seed}-rs`, i) - 0.5) * 10,
		};
	});
}

function simulateParticle(p: Particle, frame: number, gravity: number): Particle | null {
	if (frame < 0 || frame > p.maxLife) return null;
	const t = frame;
	return {
		...p,
		x: p.x + p.vx * t,
		y: p.y + p.vy * t + 0.5 * gravity * t * t,
		life: frame,
		rotation: p.rotation + p.rotSpeed * t,
	};
}

// ── Canvas Renderer ────────────────────────────────────────────────────

/**
 * Render particles to a 2D canvas context.
 * Uses Canvas2D instead of PixiJS WebGL for simplicity and reliability
 * in Remotion's headless rendering environment. Can be upgraded to
 * PixiJS Application for GPU-accelerated effects when needed.
 */
function renderParticlesToCanvas(
	ctx: CanvasRenderingContext2D,
	particles: Particle[],
	config: PixiParticleConfig,
	frame: number,
	width: number,
	height: number,
) {
	for (const baseParticle of particles) {
		// Stagger particle start times based on their initial random values
		const delay = Math.floor(baseParticle.rotation % 30);
		const localFrame = frame - delay;
		const p = simulateParticle(baseParticle, localFrame, config.gravity);
		if (!p) continue;

		// Skip if out of bounds
		if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;

		// Fade based on lifetime
		const lifeRatio = p.life / p.maxLife;
		const alpha = lifeRatio < 0.1 ? lifeRatio / 0.1 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;

		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate((p.rotation * Math.PI) / 180);
		ctx.globalAlpha = Math.max(0, alpha);
		ctx.fillStyle = p.color;

		switch (config.preset) {
			case "confetti-burst": {
				const w = p.size * 1.5;
				const h = p.size * 0.8;
				ctx.fillRect(-w / 2, -h / 2, w, h);
				break;
			}
			case "fire":
			case "sparks-gpu": {
				ctx.beginPath();
				ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
				ctx.fill();
				// Glow
				ctx.globalAlpha = alpha * 0.3;
				ctx.beginPath();
				ctx.arc(0, 0, p.size * 1.5, 0, Math.PI * 2);
				ctx.fill();
				break;
			}
			case "smoke": {
				ctx.globalAlpha = alpha * 0.15;
				ctx.beginPath();
				ctx.arc(0, 0, p.size * 3 + lifeRatio * 10, 0, Math.PI * 2);
				ctx.fill();
				break;
			}
			case "rain": {
				ctx.fillRect(-0.5, 0, 1, p.size * 3);
				break;
			}
			case "dust": {
				ctx.beginPath();
				ctx.arc(0, 0, p.size * 0.3, 0, Math.PI * 2);
				ctx.fill();
				break;
			}
			default: {
				ctx.beginPath();
				ctx.arc(0, 0, p.size, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.restore();
	}
}

/**
 * Render filter effects to canvas.
 */
function renderFilterToCanvas(
	ctx: CanvasRenderingContext2D,
	config: PixiFilterConfig,
	frame: number,
	width: number,
	height: number,
) {
	switch (config.preset) {
		case "film-grain": {
			const imageData = ctx.createImageData(width, height);
			const data = imageData.data;
			const intensity = config.intensity * 40;
			for (let i = 0; i < data.length; i += 4) {
				const noise = (seededRandom(`grain-${frame}`, i / 4) - 0.5) * intensity;
				data[i] = 128 + noise;
				data[i + 1] = 128 + noise;
				data[i + 2] = 128 + noise;
				data[i + 3] = Math.abs(noise) * 2;
			}
			ctx.putImageData(imageData, 0, 0);
			break;
		}

		case "vhs-scanlines": {
			ctx.fillStyle = `rgba(0, 0, 0, ${config.intensity * 0.15})`;
			for (let y = 0; y < height; y += 3) {
				ctx.fillRect(0, y, width, 1);
			}
			// Occasional horizontal distortion
			if (seededRandom(`vhs-glitch-${frame}`, 0) > 0.95) {
				const glitchY = Math.floor(seededRandom(`vhs-gy-${frame}`, 0) * height);
				const glitchH = 2 + Math.floor(seededRandom(`vhs-gh-${frame}`, 0) * 8);
				ctx.fillStyle = `rgba(255, 255, 255, ${config.intensity * 0.1})`;
				ctx.fillRect(0, glitchY, width, glitchH);
			}
			break;
		}

		case "chromatic-aberration": {
			// Simplified: offset colored rectangles at edges
			const offset = config.intensity * 4;
			ctx.globalAlpha = config.intensity * 0.1;
			ctx.fillStyle = "#ff0000";
			ctx.fillRect(-offset, 0, width + offset * 2, height);
			ctx.fillStyle = "#0000ff";
			ctx.fillRect(offset, 0, width - offset * 2, height);
			ctx.globalAlpha = 1;
			break;
		}

		case "crt": {
			// Curved vignette + scanlines
			const gradient = ctx.createRadialGradient(
				width / 2,
				height / 2,
				width * 0.3,
				width / 2,
				height / 2,
				width * 0.7,
			);
			gradient.addColorStop(0, "transparent");
			gradient.addColorStop(1, `rgba(0, 0, 0, ${config.intensity * 0.5})`);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);
			// Scanlines
			ctx.fillStyle = `rgba(0, 0, 0, ${config.intensity * 0.08})`;
			for (let y = 0; y < height; y += 2) {
				ctx.fillRect(0, y, width, 1);
			}
			break;
		}

		case "noise": {
			const noiseIntensity = config.intensity * 25;
			const imageData = ctx.createImageData(width, height);
			const data = imageData.data;
			// Sample every 4th pixel for performance
			for (let y = 0; y < height; y += 2) {
				for (let x = 0; x < width; x += 2) {
					const idx = (y * width + x) * 4;
					const noise = (seededRandom(`noise-${frame}-${x}-${y}`, 0) - 0.5) * noiseIntensity;
					data[idx] = 128 + noise;
					data[idx + 1] = 128 + noise;
					data[idx + 2] = 128 + noise;
					data[idx + 3] = Math.abs(noise);
					// Fill adjacent pixels
					if (x + 1 < width) {
						const idx2 = idx + 4;
						data[idx2] = data[idx];
						data[idx2 + 1] = data[idx + 1];
						data[idx2 + 2] = data[idx + 2];
						data[idx2 + 3] = data[idx + 3];
					}
				}
			}
			ctx.putImageData(imageData, 0, 0);
			break;
		}
	}
}

// ── React Component ────────────────────────────────────────────────────

export const PixiOverlay: React.FC<PixiOverlayProps> = ({ effects, opacity = 1 }) => {
	// Skip entirely in preview mode — grain/particles are invisible at half-res
	if ((window as any).__STUDIO_PREVIEW_MODE__) return null;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const particleCacheRef = useRef<Map<number, Particle[]>>(new Map());
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();

	// Generate particles once per effect config
	const getParticles = useCallback(
		(index: number, config: PixiParticleConfig): Particle[] => {
			if (!particleCacheRef.current.has(index)) {
				particleCacheRef.current.set(index, generateParticles(config, width, height));
			}
			return particleCacheRef.current.get(index)!;
		},
		[width, height],
	);

	// Render on every frame
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Clear
		ctx.clearRect(0, 0, width, height);

		// Render each effect
		effects.forEach((effect, i) => {
			if (effect.type === "particles") {
				const particles = getParticles(i, effect.config);
				renderParticlesToCanvas(ctx, particles, effect.config, frame, width, height);
			} else if (effect.type === "filter") {
				renderFilterToCanvas(ctx, effect.config, frame, width, height);
			}
		});
	}, [frame, effects, width, height, getParticles]);

	return (
		<AbsoluteFill style={{ pointerEvents: "none", opacity }}>
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				style={{ width: "100%", height: "100%" }}
			/>
		</AbsoluteFill>
	);
};

// ── Pre-built Presets ──────────────────────────────────────────────────

export const PIXI_PRESETS: Record<string, PixiEffectDescriptor[]> = {
	"film-grain-light": [{ type: "filter", config: { preset: "film-grain", intensity: 0.3 } }],
	"film-grain-heavy": [{ type: "filter", config: { preset: "film-grain", intensity: 0.7 } }],
	"vhs-retro": [
		{ type: "filter", config: { preset: "vhs-scanlines", intensity: 0.5 } },
		{ type: "filter", config: { preset: "chromatic-aberration", intensity: 0.3 } },
	],
	"cinematic-grain": [
		{ type: "filter", config: { preset: "film-grain", intensity: 0.15 } },
		{
			type: "particles",
			config: {
				preset: "dust",
				count: 20,
				colors: ["#ffffff"],
				gravity: -0.02,
				velocity: { min: 0.1, max: 0.5 },
				lifetime: { min: 30, max: 90 },
				seed: "cinematic-dust",
			},
		},
	],
	"crt-monitor": [{ type: "filter", config: { preset: "crt", intensity: 0.5 } }],
	"confetti-party": [
		{
			type: "particles",
			config: {
				preset: "confetti-burst",
				count: 100,
				colors: ["#2563eb", "#7c3aed", "#ec4899", "#f59e0b", "#10b981"],
				gravity: 0.15,
				velocity: { min: 3, max: 8 },
				lifetime: { min: 30, max: 80 },
				seed: "confetti-party",
			},
		},
	],
	"fire-embers": [
		{
			type: "particles",
			config: {
				preset: "fire",
				count: 40,
				colors: ["#f97316", "#ef4444", "#fbbf24"],
				gravity: -0.2,
				velocity: { min: 0.5, max: 2 },
				lifetime: { min: 20, max: 60 },
				seed: "fire-embers",
			},
		},
	],
	"gentle-rain": [
		{
			type: "particles",
			config: {
				preset: "rain",
				count: 80,
				colors: ["#94a3b8"],
				gravity: 0.3,
				velocity: { min: 2, max: 5 },
				lifetime: { min: 20, max: 50 },
				seed: "gentle-rain",
			},
		},
	],
};
