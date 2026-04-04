// ── Rolling Number (Odometer) ────────────────────────────────────────────
//
// Digit-by-digit odometer counter that rolls from 0 to a target number.
// Each digit column independently scrolls through 0-9 to land on the target.
// Supports prefix ($) and suffix (%, x, K, M, etc.).

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface RollingNumberProps {
	/** The target number string, e.g. "465", "1,200", "99.9" */
	value: string;
	/** Prefix like "$" or "" */
	prefix?: string;
	/** Suffix like "%", "x", "K", "M", etc. */
	suffix?: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: string;
	color: string;
	textAlign?: "left" | "center" | "right";
	/** Delay in frames before the roll starts */
	delayFrames?: number;
	/** Stagger between each digit column (default: 3 frames) */
	staggerFrames?: number;
}

export const RollingNumber: React.FC<RollingNumberProps> = ({
	value,
	prefix = "",
	suffix = "",
	fontSize,
	fontFamily,
	fontWeight,
	color,
	textAlign = "center",
	delayFrames = 0,
	staggerFrames = 3,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Split value into individual characters (digits, commas, dots)
	const chars = value.split("");

	// Height of each digit cell — use fontSize * lineHeight
	const cellHeight = fontSize * 1.2;

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
					display: "flex",
					alignItems: "center",
					fontFamily,
					fontWeight: fontWeight as React.CSSProperties["fontWeight"],
					color,
					fontSize,
					lineHeight: 1.2,
				}}
			>
				{/* Prefix */}
				{prefix && (
					<span
						style={{
							opacity: spring({
								frame: Math.max(0, frame - delayFrames),
								fps,
								config: { damping: 20, stiffness: 120 },
							}),
						}}
					>
						{prefix}
					</span>
				)}

				{/* Digit columns */}
				{chars.map((char, i) => {
					const isDigit = /\d/.test(char);
					if (!isDigit) {
						// Static separator (comma, dot)
						return (
							<span key={i} style={{ display: "inline-block" }}>
								{char}
							</span>
						);
					}

					const targetDigit = parseInt(char, 10);
					const digitDelay = delayFrames + i * staggerFrames;
					const localFrame = Math.max(0, frame - digitDelay);

					const progress = spring({
						frame: localFrame,
						fps,
						config: { damping: 16, stiffness: 100, mass: 1.2 },
					});

					// Roll through digits: offset = targetDigit * cellHeight * progress
					const offset = targetDigit * cellHeight * progress;

					return (
						<div
							key={i}
							style={{
								display: "inline-block",
								height: cellHeight,
								overflow: "hidden",
								position: "relative",
								// Width: roughly 0.6em per digit
								width: fontSize * 0.65,
							}}
						>
							<div
								style={{
									position: "absolute",
									top: -offset,
									transition: "none",
								}}
							>
								{Array.from({ length: 10 }, (_, d) => (
									<div
										key={d}
										style={{
											height: cellHeight,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										{d}
									</div>
								))}
							</div>
						</div>
					);
				})}

				{/* Suffix */}
				{suffix && (
					<span
						style={{
							opacity: spring({
								frame: Math.max(0, frame - delayFrames - chars.length * staggerFrames),
								fps,
								config: { damping: 20, stiffness: 120 },
							}),
						}}
					>
						{suffix}
					</span>
				)}
			</div>
		</div>
	);
};
