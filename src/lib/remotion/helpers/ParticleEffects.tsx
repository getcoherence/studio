// ── Particle Effects ────────────────────────────────────────────────────
//
// Standalone particle overlay components for use as background effects or
// scene overlays. Inspired by remotion-scenes and remotion-bits.
// All use Remotion's `random()` for deterministic, seedable randomness.

import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

// ── Confetti ────────────────────────────────────────────────────────────

interface ConfettiProps {
	count?: number;
	colors?: string[];
	/** Burst from center vs rain from top */
	mode?: "burst" | "rain";
	intensity?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({
	count = 80,
	colors = ["#2563eb", "#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#f43f5e"],
	mode = "rain",
	intensity = 1,
}) => {
	const frame = useCurrentFrame();
	const { height, width } = useVideoConfig();

	const pieces = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
				x: random(`cf-x-${i}`) * 100,
				delay: random(`cf-d-${i}`) * 30 * intensity,
				speed: (random(`cf-sp-${i}`) * 3 + 2) * intensity,
				rotation: random(`cf-r-${i}`) * 360,
				rotSpeed: (random(`cf-rs-${i}`) - 0.5) * 20,
				size: random(`cf-s-${i}`) * 14 + 6,
				color: colors[i % colors.length],
				shape: Math.floor(random(`cf-t-${i}`) * 3),
				// Burst mode: radial velocity
				angle: random(`cf-a-${i}`) * Math.PI * 2,
				burstSpeed: (random(`cf-bs-${i}`) * 8 + 4) * intensity,
			})),
		[count, colors.join(","), intensity],
	);

	return (
		<AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
			{pieces.map((c, i) => {
				const t = frame - c.delay;
				if (t < 0) return null;

				let x: number;
				let y: number;
				if (mode === "burst") {
					x = width / 2 + Math.cos(c.angle) * c.burstSpeed * t;
					y = height / 2 + Math.sin(c.angle) * c.burstSpeed * t + 0.15 * t * t;
				} else {
					y = -50 + t * c.speed;
					x = (c.x / 100) * width + Math.sin(t * 0.1 + c.x) * 30;
				}

				if (y > height + 50) return null;

				const rotation = c.rotation + t * c.rotSpeed;
				const w = c.shape === 0 ? c.size : c.size * 0.5;
				const h = c.shape === 0 ? c.size * 0.5 : c.size;

				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: x,
							top: y,
							width: w,
							height: h,
							background: c.color,
							borderRadius: c.shape === 2 ? "50%" : 2,
							transform: `rotate(${rotation}deg)`,
							opacity: Math.max(0, 1 - t * 0.005),
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// ── Snow ────────────────────────────────────────────────────────────────

interface SnowProps {
	count?: number;
	intensity?: number;
}

export const Snow: React.FC<SnowProps> = ({ count = 60, intensity = 1 }) => {
	const frame = useCurrentFrame();
	const { height } = useVideoConfig();

	const flakes = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
				x: random(`sn-x-${i}`) * 100,
				delay: random(`sn-d-${i}`) * 50,
				speed: (random(`sn-sp-${i}`) * 1 + 0.5) * intensity,
				size: random(`sn-s-${i}`) * 6 + 2,
				opacity: random(`sn-o-${i}`) * 0.5 + 0.3,
			})),
		[count, intensity],
	);

	return (
		<AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
			{flakes.map((s, i) => {
				const t = frame - s.delay;
				if (t < 0) return null;
				const y = -20 + t * s.speed;
				if (y > height + 20) return null;
				const wobble = Math.sin(t * 0.02 + s.x) * 20;

				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${s.x}%`,
							top: y,
							width: s.size,
							height: s.size,
							background: "#ffffff",
							borderRadius: "50%",
							transform: `translateX(${wobble}px)`,
							opacity: s.opacity,
							boxShadow: "0 0 8px rgba(255,255,255,0.4)",
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// ── Fireflies ───────────────────────────────────────────────────────────

interface FirefliesProps {
	count?: number;
	color?: string;
	intensity?: number;
}

export const Fireflies: React.FC<FirefliesProps> = ({
	count = 25,
	color = "#fbbf24",
	intensity = 1,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const flies = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
				x: random(`ff-x-${i}`) * 100,
				y: random(`ff-y-${i}`) * 100,
				speed: random(`ff-sp-${i}`) * 0.5 + 0.2,
				phase: random(`ff-ph-${i}`) * Math.PI * 2,
				size: (random(`ff-s-${i}`) * 6 + 4) * intensity,
				blinkPhase: random(`ff-bp-${i}`) * Math.PI * 2,
				blinkSpeed: random(`ff-bs-${i}`) * 2 + 1,
			})),
		[count, intensity],
	);

	const t = frame / fps;

	return (
		<AbsoluteFill style={{ pointerEvents: "none" }}>
			{flies.map((f, i) => {
				const x = f.x + Math.sin(t * f.speed + f.phase) * 8;
				const y = f.y + Math.cos(t * f.speed * 0.7 + f.phase) * 6;
				const glow = (Math.sin(t * f.blinkSpeed + f.blinkPhase) + 1) / 2;

				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${x}%`,
							top: `${y}%`,
							width: f.size,
							height: f.size,
							borderRadius: "50%",
							background: color,
							opacity: 0.3 + glow * 0.7,
							boxShadow: `0 0 ${f.size * 2}px ${f.size}px ${color}60`,
							transform: "translate(-50%, -50%)",
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// ── Sakura (cherry blossom petals) ──────────────────────────────────────

interface SakuraProps {
	count?: number;
	intensity?: number;
}

export const Sakura: React.FC<SakuraProps> = ({ count = 40, intensity = 1 }) => {
	const frame = useCurrentFrame();
	const { height } = useVideoConfig();

	const petals = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
				x: random(`sk-x-${i}`) * 120 - 10,
				delay: random(`sk-d-${i}`) * 40,
				speed: (random(`sk-sp-${i}`) * 1.5 + 1) * intensity,
				size: random(`sk-s-${i}`) * 14 + 8,
				rotSpeed: (random(`sk-rs-${i}`) - 0.5) * 10,
			})),
		[count, intensity],
	);

	return (
		<AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
			{petals.map((p, i) => {
				const t = frame - p.delay;
				if (t < 0) return null;
				const y = -30 + t * p.speed;
				if (y > height + 30) return null;
				const wobble = Math.sin(t * 0.03 + p.x) * 40;
				const rotation = t * p.rotSpeed;

				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${p.x}%`,
							top: y,
							width: p.size,
							height: p.size * 0.6,
							background: "radial-gradient(ellipse, #ffb6c1 30%, #ff69b4 100%)",
							borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
							transform: `translateX(${wobble}px) rotate(${rotation}deg)`,
							opacity: 0.75,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// ── Sparks / shooting stars ─────────────────────────────────────────────

interface SparksProps {
	count?: number;
	color?: string;
	intensity?: number;
}

export const Sparks: React.FC<SparksProps> = ({ count = 15, color = "#ffffff", intensity = 1 }) => {
	const frame = useCurrentFrame();

	const stars = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => ({
				startX: random(`sp-sx-${i}`) * 100,
				startY: random(`sp-sy-${i}`) * 60,
				angle: random(`sp-a-${i}`) * 0.5 + 0.3,
				speed: (random(`sp-sp-${i}`) * 12 + 8) * intensity,
				delay: random(`sp-d-${i}`) * 90,
				length: random(`sp-l-${i}`) * 80 + 40,
				thickness: random(`sp-t-${i}`) * 2 + 1,
			})),
		[count, intensity],
	);

	return (
		<AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
			{stars.map((s, i) => {
				const t = frame - s.delay;
				if (t < 0 || t > 30) return null;
				const progress = t / 30;
				const x = s.startX + t * s.speed * Math.cos(s.angle);
				const y = s.startY + t * s.speed * Math.sin(s.angle);
				const opacity = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;

				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${x}%`,
							top: `${y}%`,
							width: s.length * (1 - progress * 0.5),
							height: s.thickness,
							background: `linear-gradient(90deg, ${color}, transparent)`,
							transform: `rotate(${s.angle}rad)`,
							opacity: opacity * 0.8,
							borderRadius: s.thickness,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// ── Perspective Grid (retro/synthwave) ──────────────────────────────────

interface PerspectiveGridProps {
	color?: string;
	intensity?: number;
}

export const PerspectiveGrid: React.FC<PerspectiveGridProps> = ({
	color = "#2563eb",
	intensity = 1,
}) => {
	const frame = useCurrentFrame();
	const scrollZ = frame * 2 * intensity;

	return (
		<AbsoluteFill style={{ perspective: 500, overflow: "hidden", pointerEvents: "none" }}>
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					width: 2000,
					height: 2000,
					transform: `translate(-50%, -50%) rotateX(70deg) translateZ(${scrollZ % 100}px)`,
					transformStyle: "preserve-3d",
					backgroundImage: `
						linear-gradient(${color}40 1px, transparent 1px),
						linear-gradient(90deg, ${color}40 1px, transparent 1px)
					`,
					backgroundSize: "100px 100px",
					opacity: 0.6 * intensity,
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 0,
					top: "50%",
					width: "100%",
					height: 2,
					background: color,
					transform: "translateY(-50%)",
					opacity: 0.5,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── Flowing Gradient Background ─────────────────────────────────────────

interface FlowingGradientProps {
	colors?: string[];
	speed?: number;
}

export const FlowingGradient: React.FC<FlowingGradientProps> = ({ colors, speed = 0.5 }) => {
	const frame = useCurrentFrame();
	const hue1 = (frame * speed) % 360;
	const hue2 = (hue1 + 60) % 360;
	const hue3 = (hue1 + 120) % 360;
	const angle = frame * speed;

	const bg = colors
		? `linear-gradient(${angle}deg, ${colors.join(", ")})`
		: `linear-gradient(${angle}deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%), hsl(${hue3}, 70%, 50%))`;

	return <AbsoluteFill style={{ background: bg, pointerEvents: "none" }} />;
};
