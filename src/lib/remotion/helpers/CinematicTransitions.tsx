// ── Cinematic 3D Transitions ────────────────────────────────────────────
//
// Spatial transitions that create the feeling of flying through a 3D world.
// These are NOT slide/fade/wipe — they create depth, portals, and morphs
// that make scenes feel like interconnected spaces rather than slides.
//
// Inspired by Apple keynotes, film title sequences, and spatial computing UIs.

import type { TransitionPresentation } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";

// ── Shared easing functions ────────────────────────────────────────────

/** Smooth ease-in-out with slight overshoot (feels organic, not mechanical) */
function smoothOvershoot(t: number): number {
	if (t < 0.5) return 4 * t * t * t;
	const f = -2 * t + 2;
	return 1 - (f * f * f) / 2;
}

/** Dramatic ease — slow start, fast middle, gentle landing */
function dramaticEase(t: number): number {
	return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

// ── Zoom Through ───────────────────────────────────────────────────────
// Camera zooms INTO the current scene (scale → 15x, blur increases),
// then the new scene emerges from deep zoom-out (scale 0.1 → 1).
// Creates the feeling of "flying through" the current content into
// a new world behind it. Like entering a portal.

export function zoomThrough(opts?: {
	/** Focal point X (0-100%, default 50) */
	focalX?: number;
	/** Focal point Y (0-100%, default 50) */
	focalY?: number;
	/** Color flash at the transition midpoint */
	flashColor?: string;
}): TransitionPresentation<Record<string, never>> {
	const { focalX = 50, focalY = 50, flashColor = "rgba(255,255,255,0.15)" } = opts ?? {};

	const component = ({
		presentationProgress,
		presentationDirection,
		children,
	}: {
		presentationProgress: number;
		presentationDirection: "entering" | "exiting";
		children: React.ReactNode;
		passedProps: Record<string, never>;
	}) => {
		const p = dramaticEase(presentationProgress);

		if (presentationDirection === "exiting") {
			// Old scene: zoom in dramatically, blur, fade
			const scale = interpolate(p, [0, 1], [1, 18]);
			const blur = interpolate(p, [0, 0.3, 1], [0, 0, 12]);
			const opacity = interpolate(p, [0, 0.6, 1], [1, 0.8, 0]);

			return (
				<AbsoluteFill>
					<AbsoluteFill
						style={{
							transform: `scale(${scale})`,
							transformOrigin: `${focalX}% ${focalY}%`,
							filter: `blur(${blur}px)`,
							opacity,
						}}
					>
						{children}
					</AbsoluteFill>
					{/* Light flash at the zoom-through moment */}
					<AbsoluteFill
						style={{
							background: flashColor,
							opacity: interpolate(p, [0, 0.4, 0.6, 1], [0, 0, 1, 0]),
							pointerEvents: "none",
						}}
					/>
				</AbsoluteFill>
			);
		}

		// New scene: emerge from deep zoom, decelerate to normal
		const scale = interpolate(p, [0, 1], [0.05, 1]);
		const blur = interpolate(p, [0, 0.5, 1], [15, 3, 0]);
		const opacity = interpolate(p, [0, 0.2, 1], [0, 0.5, 1]);

		return (
			<AbsoluteFill
				style={{
					transform: `scale(${scale})`,
					transformOrigin: `${focalX}% ${focalY}%`,
					filter: `blur(${blur}px)`,
					opacity,
				}}
			>
				{children}
			</AbsoluteFill>
		);
	};

	return { component, props: {} };
}

// ── Portal ─────────────────────────────────────────────────────────────
// A circular reveal that expands from a focal point, as if opening a
// portal in the current scene. The old scene warps/bends at the edges
// of the portal. Feels like stepping through a dimensional rift.

export function portal(opts?: {
	/** Portal center X (0-100%, default 50) */
	centerX?: number;
	/** Portal center Y (0-100%, default 50) */
	centerY?: number;
	/** Portal edge color/glow */
	glowColor?: string;
}): TransitionPresentation<Record<string, never>> {
	const { centerX = 50, centerY = 50, glowColor = "#2563eb" } = opts ?? {};

	const component = ({
		presentationProgress,
		presentationDirection,
		children,
	}: {
		presentationProgress: number;
		presentationDirection: "entering" | "exiting";
		children: React.ReactNode;
		passedProps: Record<string, never>;
	}) => {
		const p = smoothOvershoot(presentationProgress);

		if (presentationDirection === "entering") {
			// New scene: revealed through expanding circle
			const radius = interpolate(p, [0, 1], [0, 150]);
			const clipPath = `circle(${radius}% at ${centerX}% ${centerY}%)`;

			return (
				<AbsoluteFill>
					<AbsoluteFill style={{ clipPath }}>{children}</AbsoluteFill>
					{/* Glowing edge ring at the portal boundary */}
					{radius > 5 && radius < 140 && (
						<div
							style={{
								position: "absolute",
								left: `${centerX}%`,
								top: `${centerY}%`,
								width: `${radius * 1.8}vw`,
								height: `${radius * 1.8}vw`,
								borderRadius: "50%",
								border: `3px solid ${glowColor}`,
								boxShadow: `0 0 40px 10px ${glowColor}60, inset 0 0 30px 5px ${glowColor}30`,
								transform: "translate(-50%, -50%)",
								pointerEvents: "none",
								opacity: interpolate(p, [0, 0.3, 0.8, 1], [0, 0.8, 0.6, 0]),
							}}
						/>
					)}
				</AbsoluteFill>
			);
		}

		// Old scene: slight scale-down and darken as portal opens
		const scale = interpolate(p, [0, 1], [1, 0.92]);
		const brightness = interpolate(p, [0, 1], [1, 0.6]);

		return (
			<AbsoluteFill
				style={{
					transform: `scale(${scale})`,
					filter: `brightness(${brightness})`,
				}}
			>
				{children}
			</AbsoluteFill>
		);
	};

	return { component, props: {} };
}

// ── Depth Parallax ─────────────────────────────────────────────────────
// Scenes slide horizontally but with a 3D depth effect — the old scene
// recedes into the distance (shrinks + shifts) while the new scene
// approaches from the side with perspective tilt. Creates the feeling
// of scenes arranged in 3D space.

export function depthParallax(opts?: {
	/** Direction the new scene enters from */
	direction?: "left" | "right";
	/** How much 3D perspective tilt to apply (degrees) */
	tiltDeg?: number;
}): TransitionPresentation<Record<string, never>> {
	const { direction = "right", tiltDeg = 8 } = opts ?? {};
	const sign = direction === "right" ? 1 : -1;

	const component = ({
		presentationProgress,
		presentationDirection,
		children,
	}: {
		presentationProgress: number;
		presentationDirection: "entering" | "exiting";
		children: React.ReactNode;
		passedProps: Record<string, never>;
	}) => {
		const p = smoothOvershoot(presentationProgress);

		if (presentationDirection === "exiting") {
			// Old scene: recede into distance (shrink + shift + darken)
			const translateX = interpolate(p, [0, 1], [0, -30 * sign]);
			const translateZ = interpolate(p, [0, 1], [0, -200]);
			const rotateY = interpolate(p, [0, 1], [0, tiltDeg * sign]);
			const opacity = interpolate(p, [0, 0.5, 1], [1, 0.7, 0]);

			return (
				<AbsoluteFill style={{ perspective: 1200 }}>
					<AbsoluteFill
						style={{
							transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
							opacity,
							transformStyle: "preserve-3d",
						}}
					>
						{children}
					</AbsoluteFill>
				</AbsoluteFill>
			);
		}

		// New scene: approach from the side with perspective
		const translateX = interpolate(p, [0, 1], [80 * sign, 0]);
		const translateZ = interpolate(p, [0, 1], [-150, 0]);
		const rotateY = interpolate(p, [0, 1], [-tiltDeg * sign * 1.5, 0]);
		const opacity = interpolate(p, [0, 0.3, 1], [0, 0.6, 1]);

		return (
			<AbsoluteFill style={{ perspective: 1200 }}>
				<AbsoluteFill
					style={{
						transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
						opacity,
						transformStyle: "preserve-3d",
					}}
				>
					{children}
				</AbsoluteFill>
			</AbsoluteFill>
		);
	};

	return { component, props: {} };
}

// ── Warp Dissolve ──────────────────────────────────────────────────────
// Old scene warps/distorts as if reality is bending, then dissolves
// into the new scene which stabilizes from a warped state.
// Creates a "dream sequence" or "dimension shift" feeling.

export function warpDissolve(opts?: {
	/** Intensity of the warp effect (1-3, default 2) */
	intensity?: number;
}): TransitionPresentation<Record<string, never>> {
	const { intensity = 2 } = opts ?? {};

	const component = ({
		presentationProgress,
		presentationDirection,
		children,
	}: {
		presentationProgress: number;
		presentationDirection: "entering" | "exiting";
		children: React.ReactNode;
		passedProps: Record<string, never>;
	}) => {
		const p = presentationProgress;

		if (presentationDirection === "exiting") {
			// Old scene: warp, scale, blur, fade
			const skewX = interpolate(p, [0, 0.5, 1], [0, 3 * intensity, 8 * intensity]);
			const skewY = interpolate(p, [0, 0.5, 1], [0, -1.5 * intensity, -4 * intensity]);
			const scale = interpolate(p, [0, 0.7, 1], [1, 1.05, 1.15]);
			const blur = interpolate(p, [0, 0.5, 1], [0, 2, 10]);
			const opacity = interpolate(p, [0, 0.6, 1], [1, 0.6, 0]);
			const hue = interpolate(p, [0, 1], [0, 30 * intensity]);

			return (
				<AbsoluteFill
					style={{
						transform: `skewX(${skewX}deg) skewY(${skewY}deg) scale(${scale})`,
						filter: `blur(${blur}px) hue-rotate(${hue}deg)`,
						opacity,
					}}
				>
					{children}
				</AbsoluteFill>
			);
		}

		// New scene: emerge from warped state, stabilize
		const skewX = interpolate(p, [0, 0.5, 1], [-6 * intensity, -2 * intensity, 0]);
		const skewY = interpolate(p, [0, 0.5, 1], [3 * intensity, 1 * intensity, 0]);
		const scale = interpolate(p, [0, 0.5, 1], [1.1, 1.03, 1]);
		const blur = interpolate(p, [0, 0.4, 1], [8, 2, 0]);
		const opacity = interpolate(p, [0, 0.3, 1], [0, 0.5, 1]);
		const hue = interpolate(p, [0, 1], [-20 * intensity, 0]);

		return (
			<AbsoluteFill
				style={{
					transform: `skewX(${skewX}deg) skewY(${skewY}deg) scale(${scale})`,
					filter: `blur(${blur}px) hue-rotate(${hue}deg)`,
					opacity,
				}}
			>
				{children}
			</AbsoluteFill>
		);
	};

	return { component, props: {} };
}

// ── Iris Zoom ──────────────────────────────────────────────────────────
// Like a camera iris — the old scene contracts into a shrinking circle
// while the new scene is revealed behind it. Combined with a slight
// 3D rotation for depth. Like looking through a closing aperture.

export function irisZoom(opts?: {
	/** Center point X (0-100%) */
	centerX?: number;
	/** Center point Y (0-100%) */
	centerY?: number;
}): TransitionPresentation<Record<string, never>> {
	const { centerX = 50, centerY = 50 } = opts ?? {};

	const component = ({
		presentationProgress,
		presentationDirection,
		children,
	}: {
		presentationProgress: number;
		presentationDirection: "entering" | "exiting";
		children: React.ReactNode;
		passedProps: Record<string, never>;
	}) => {
		const p = dramaticEase(presentationProgress);

		if (presentationDirection === "exiting") {
			// Old scene: shrink into closing iris with scale + rotation
			const radius = interpolate(p, [0, 1], [150, 0]);
			const scale = interpolate(p, [0, 1], [1, 1.3]);
			const rotate = interpolate(p, [0, 1], [0, 3]);
			const clipPath = `circle(${radius}% at ${centerX}% ${centerY}%)`;

			return (
				<AbsoluteFill style={{ perspective: 800 }}>
					<AbsoluteFill
						style={{
							clipPath,
							transform: `scale(${scale}) rotate(${rotate}deg)`,
							transformOrigin: `${centerX}% ${centerY}%`,
						}}
					>
						{children}
					</AbsoluteFill>
				</AbsoluteFill>
			);
		}

		// New scene: scale up from slightly small, full opacity
		const scale = interpolate(p, [0, 1], [0.95, 1]);
		const brightness = interpolate(p, [0, 0.5, 1], [0.7, 0.9, 1]);

		return (
			<AbsoluteFill
				style={{
					transform: `scale(${scale})`,
					filter: `brightness(${brightness})`,
				}}
			>
				{children}
			</AbsoluteFill>
		);
	};

	return { component, props: {} };
}

// ── Shatter ────────────────────────────────────────────────────────────
// Old scene breaks into geometric shards that fly outward in 3D space,
// revealing the new scene behind. High-energy, dramatic transition.

export function shatter(opts?: {
	/** Number of shards (default 12) */
	shardCount?: number;
	/** Shard color tint */
	tintColor?: string;
}): TransitionPresentation<Record<string, never>> {
	const { shardCount = 12 } = opts ?? {};

	const component = ({
		presentationProgress,
		presentationDirection,
		children,
	}: {
		presentationProgress: number;
		presentationDirection: "entering" | "exiting";
		children: React.ReactNode;
		passedProps: Record<string, never>;
	}) => {
		const p = dramaticEase(presentationProgress);

		if (presentationDirection === "exiting") {
			// Generate deterministic shard positions
			const shards = Array.from({ length: shardCount }, (_, i) => {
				const row = Math.floor(i / 4);
				const col = i % 4;
				const w = 25;
				const h = 100 / Math.ceil(shardCount / 4);
				const angle = ((i * 137.5) % 360) * (Math.PI / 180); // golden angle
				const dist = 150 + (i % 3) * 80;
				const rotX = (i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 15);
				const rotY = (i % 3 === 0 ? 1 : -1) * (15 + (i % 4) * 10);
				const stagger = (i / shardCount) * 0.3;
				const sp = Math.max(0, Math.min(1, (p - stagger) / (1 - stagger)));

				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${col * w}%`,
							top: `${row * h}%`,
							width: `${w}%`,
							height: `${h}%`,
							overflow: "hidden",
							transform: `translate(${Math.cos(angle) * dist * sp}px, ${Math.sin(angle) * dist * sp}px) rotateX(${rotX * sp}deg) rotateY(${rotY * sp}deg)`,
							opacity: interpolate(sp, [0, 0.5, 1], [1, 0.6, 0]),
							pointerEvents: "none",
						}}
					>
						<div
							style={{
								position: "absolute",
								left: `-${col * 100}%`,
								top: `-${row * 100}%`,
								width: "400%",
								height: `${Math.ceil(shardCount / 4) * 100}%`,
							}}
						>
							{children}
						</div>
					</div>
				);
			});

			return <AbsoluteFill style={{ perspective: 600 }}>{shards}</AbsoluteFill>;
		}

		// New scene: quick fade-scale-in behind the shards
		const scale = interpolate(p, [0, 1], [0.9, 1]);
		const opacity = interpolate(p, [0, 0.3, 1], [0, 0.7, 1]);

		return (
			<AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>{children}</AbsoluteFill>
		);
	};

	return { component, props: {} };
}
