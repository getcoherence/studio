// ── Lottie Helper ───────────────────────────────────────────────────────
//
// Wrapper for @remotion/lottie that loads animations from URLs or
// the public/lottie/ folder. Provides easy-to-use presets for common
// cinematic effects.

import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import React, { useEffect, useState } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";

// ── LottieOverlay ───────────────────────────────────────────────────────

/** Lottie animation overlay — positioned absolutely over scene content */
export const LottieOverlay: React.FC<{
	/** Animation data (JSON object) or path to JSON file in public/lottie/ */
	src: string | Record<string, unknown>;
	/** Position presets */
	position?: "center" | "top" | "bottom" | "full" | "top-right" | "bottom-left";
	/** Size as percentage of frame (default: 40) */
	size?: number;
	/** Opacity (default: 1) */
	opacity?: number;
	/** Playback speed (default: 1) */
	speed?: number;
	/** Loop animation (default: false) */
	loop?: boolean;
	/** Delay in frames before showing */
	delay?: number;
}> = ({ src, position = "center", size = 40, opacity = 1, speed = 1, loop = false, delay = 0 }) => {
	const frame = useCurrentFrame();
	const [animationData, setAnimationData] = useState<LottieAnimationData | null>(
		typeof src === "object" ? (src as LottieAnimationData) : null,
	);

	// Load from file path if string
	useEffect(() => {
		if (typeof src !== "string") return;
		const url = src.startsWith("http") ? src : staticFile(`lottie/${src}`);
		fetch(url)
			.then((r) => r.json())
			.then((data) => setAnimationData(data))
			.catch((err) => console.error("Failed to load Lottie:", err));
	}, [src]);

	if (!animationData || frame < delay) return null;

	const posStyle = getPositionStyle(position, size);

	return (
		<div
			style={{
				position: "absolute",
				...posStyle,
				opacity,
				pointerEvents: "none",
				zIndex: 10,
			}}
		>
			<Lottie
				animationData={animationData}
				playbackRate={speed}
				loop={loop}
				style={{ width: "100%", height: "100%" }}
			/>
		</div>
	);
};

// ── LottieBackground ────────────────────────────────────────────────────

/** Full-frame Lottie animation as a scene background */
export const LottieBackground: React.FC<{
	src: string | Record<string, unknown>;
	opacity?: number;
	speed?: number;
}> = ({ src, opacity = 0.3, speed = 0.5 }) => {
	const [animationData, setAnimationData] = useState<LottieAnimationData | null>(
		typeof src === "object" ? (src as LottieAnimationData) : null,
	);

	useEffect(() => {
		if (typeof src !== "string") return;
		const url = src.startsWith("http") ? src : staticFile(`lottie/${src}`);
		fetch(url)
			.then((r) => r.json())
			.then((data) => setAnimationData(data))
			.catch((err) => console.error("Failed to load Lottie bg:", err));
	}, [src]);

	if (!animationData) return null;

	return (
		<AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
			<Lottie
				animationData={animationData}
				playbackRate={speed}
				loop
				style={{ width: "100%", height: "100%" }}
			/>
		</AbsoluteFill>
	);
};

// ── Position helpers ────────────────────────────────────────────────────

function getPositionStyle(position: string, size: number): React.CSSProperties {
	const s = `${size}%`;
	switch (position) {
		case "center":
			return {
				left: `${(100 - size) / 2}%`,
				top: `${(100 - size) / 2}%`,
				width: s,
				height: s,
			};
		case "top":
			return {
				left: `${(100 - size) / 2}%`,
				top: "5%",
				width: s,
				height: s,
			};
		case "bottom":
			return {
				left: `${(100 - size) / 2}%`,
				bottom: "5%",
				width: s,
				height: s,
			};
		case "top-right":
			return {
				right: "5%",
				top: "5%",
				width: s,
				height: s,
			};
		case "bottom-left":
			return {
				left: "5%",
				bottom: "5%",
				width: s,
				height: s,
			};
		case "full":
			return {
				left: 0,
				top: 0,
				width: "100%",
				height: "100%",
			};
		default:
			return {
				left: `${(100 - size) / 2}%`,
				top: `${(100 - size) / 2}%`,
				width: s,
				height: s,
			};
	}
}

// ── Lottie catalog ──────────────────────────────────────────────────────

export interface LottieCatalogItem {
	id: string;
	name: string;
	category: "text-effect" | "transition" | "shape" | "background" | "decoration";
	/** File name in public/lottie/ or URL */
	src: string;
	/** Default size % */
	defaultSize: number;
	/** Default position */
	defaultPosition: "center" | "top" | "bottom" | "full" | "top-right" | "bottom-left";
}

/**
 * Curated Lottie animations catalog.
 * Add JSON files to public/lottie/ and register them here.
 * Users can also load custom Lottie files.
 */
export const LOTTIE_CATALOG: LottieCatalogItem[] = [
	// These are placeholders — replace src with actual Lottie JSON files
	// Download from https://lottiefiles.com/free-animations/
];
