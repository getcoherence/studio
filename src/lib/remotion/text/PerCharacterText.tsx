// ── Per-Character Text Animation ────────────────────────────────────────
//
// Splits text into individual <span> elements, each with staggered spring
// animation on opacity + translateY. Creates the cinematic character-by-character
// entrance seen in polished product videos (e.g., Adaptive.ai).

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface PerCharacterTextProps {
	text: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: string;
	color: string;
	/** Optional accent color for a gradient sweep during entrance */
	accentColor?: string;
	textAlign?: "left" | "center" | "right";
	lineHeight?: number;
	/** Delay in frames before animation starts */
	delayFrames?: number;
	/** Frames between each character's entrance (default: 2) */
	staggerFrames?: number;
}

export const PerCharacterText: React.FC<PerCharacterTextProps> = ({
	text,
	fontSize,
	fontFamily,
	fontWeight,
	color,
	accentColor,
	textAlign = "center",
	lineHeight = 1.15,
	delayFrames = 0,
	staggerFrames = 2,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const characters = text.split("");

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent:
					textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
			}}
		>
			<div
				style={{
					fontSize,
					fontFamily,
					fontWeight: fontWeight as React.CSSProperties["fontWeight"],
					color,
					textAlign,
					lineHeight,
					width: "100%",
					wordWrap: "break-word",
					overflowWrap: "break-word",
				}}
			>
				{characters.map((char, i) => {
					const charDelay = delayFrames + i * staggerFrames;
					const localFrame = Math.max(0, frame - charDelay);

					const progress = spring({
						frame: localFrame,
						fps,
						config: { damping: 14, stiffness: 180, mass: 0.8 },
					});

					// If accent color is set, blend from accent → final color during entrance
					const charColor =
						accentColor && progress < 0.95 ? interpolateColor(accentColor, color, progress) : color;

					return (
						<span
							key={i}
							style={{
								display: "inline-block",
								opacity: progress,
								transform: `translateY(${(1 - progress) * 24}px)`,
								color: charColor,
								// Preserve spaces
								whiteSpace: char === " " ? "pre" : undefined,
							}}
						>
							{char}
						</span>
					);
				})}
			</div>
		</div>
	);
};

/**
 * Simple hex color interpolation (from → to, t = 0..1).
 */
function interpolateColor(from: string, to: string, t: number): string {
	const f = parseHex(from);
	const tC = parseHex(to);
	if (!f || !tC) return to;

	const r = Math.round(f.r + (tC.r - f.r) * t);
	const g = Math.round(f.g + (tC.g - f.g) * t);
	const b = Math.round(f.b + (tC.b - f.b) * t);
	return `rgb(${r},${g},${b})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
	const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
	if (!m) return null;
	return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
