// ── Cinematic Helper Components ─────────────────────────────────────────
//
// Pre-built, safe components injected into the AI's module scope.
// These handle overflow, sizing, word-wrapping, and animation correctly
// so the AI can't make common layout mistakes.
//
// The AI uses these instead of raw divs — guarantees visual quality.

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ── Scene ───────────────────────────────────────────────────────────────

/** Full-screen scene with safe padding and centered content */
export const Scene: React.FC<{
	bg?: string;
	children: React.ReactNode;
	align?: "center" | "left" | "split";
	padding?: number;
}> = ({ bg = "#050505", children, align = "center", padding = 80 }) => (
	<AbsoluteFill
		style={{
			background: bg,
			display: "flex",
			flexDirection: align === "split" ? "row" : "column",
			alignItems: align === "left" ? "flex-start" : "center",
			justifyContent: "center",
			padding,
			overflow: "hidden",
		}}
	>
		{children}
	</AbsoluteFill>
);

// ── Animated Text ───────────────────────────────────────────────────────

/** Per-word animated text with safe wrapping. Each word stays intact. */
export const AnimatedText: React.FC<{
	text: string;
	fontSize?: number;
	color?: string;
	accentColor?: string;
	accentWord?: string;
	fontFamily?: string;
	fontWeight?: number;
	letterSpacing?: string;
	lineHeight?: number;
	align?: "center" | "left" | "right";
	maxWidth?: number;
	/** Animation style */
	animation?: "chars" | "words" | "scale" | "clip" | "none";
	/** Delay in frames before animation starts */
	delay?: number;
}> = ({
	text,
	fontSize = 100,
	color = "#ffffff",
	accentColor,
	accentWord,
	fontFamily = "Georgia, 'Times New Roman', serif",
	fontWeight = 900,
	letterSpacing = "-0.04em",
	lineHeight = 1.0,
	align = "center",
	maxWidth = 1400,
	animation = "chars",
	delay = 0,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localFrame = Math.max(0, frame - delay);

	const words = text.split(" ");

	if (animation === "scale") {
		const progress = spring({
			frame: localFrame,
			fps,
			config: { damping: 14, stiffness: 120 },
		});
		return (
			<div
				style={{
					fontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
					overflow: "hidden",
					opacity: progress,
					transform: `scale(${0.6 + progress * 0.4})`,
				}}
			>
				{text}
			</div>
		);
	}

	if (animation === "clip") {
		const progress = spring({
			frame: localFrame,
			fps,
			config: { damping: 20, stiffness: 100 },
		});
		return (
			<div
				style={{
					fontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
					overflow: "hidden",
					clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)`,
				}}
			>
				{text}
			</div>
		);
	}

	if (animation === "words") {
		return (
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: align === "center" ? "center" : "flex-start",
					gap: `0 ${fontSize * 0.3}px`,
					maxWidth,
					overflow: "hidden",
				}}
			>
				{words.map((word, wi) => {
					const wordDelay = wi * 6;
					const progress = spring({
						frame: Math.max(0, localFrame - wordDelay),
						fps,
						config: { damping: 12, stiffness: 200 },
					});
					const isAccent =
						accentWord && word.replace(/[^\w]/g, "") === accentWord.replace(/[^\w]/g, "");
					return (
						<span
							key={wi}
							style={{
								display: "inline-block",
								whiteSpace: "nowrap",
								fontSize,
								fontFamily,
								fontWeight,
								letterSpacing,
								lineHeight,
								color: isAccent && accentColor ? accentColor : color,
								opacity: progress,
								transform: `scale(${0.85 + progress * 0.15}) translateY(${(1 - progress) * 15}px)`,
							}}
						>
							{word}
						</span>
					);
				})}
			</div>
		);
	}

	// Default: per-character animation
	let charIndex = 0;
	return (
		<div
			style={{
				display: "flex",
				flexWrap: "wrap",
				justifyContent: align === "center" ? "center" : "flex-start",
				gap: `0 ${fontSize * 0.25}px`,
				maxWidth,
				overflow: "hidden",
			}}
		>
			{words.map((word, wi) => {
				const isAccent =
					accentWord && word.replace(/[^\w]/g, "") === accentWord.replace(/[^\w]/g, "");
				const wordNode = (
					<span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
						{word.split("").map((char, ci) => {
							const charDelay = charIndex * 2;
							charIndex++;
							const progress = spring({
								frame: Math.max(0, localFrame - charDelay),
								fps,
								config: { damping: 14, stiffness: 180, mass: 0.8 },
							});
							return (
								<span
									key={ci}
									style={{
										display: "inline-block",
										opacity: progress,
										transform: `translateY(${(1 - progress) * 24}px)`,
										color: isAccent && accentColor ? accentColor : color,
									}}
								>
									{char}
								</span>
							);
						})}
					</span>
				);
				return wordNode;
			})}
		</div>
	);
};

// ── Card ────────────────────────────────────────────────────────────────

/** Dark card with safe overflow, animation, and consistent styling */
export const Card: React.FC<{
	children: React.ReactNode;
	width?: number;
	delay?: number;
	borderColor?: string;
}> = ({ children, width = 420, delay = 0, borderColor = "rgba(255,255,255,0.08)" }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 14, stiffness: 140 },
	});

	return (
		<div
			style={{
				width,
				borderRadius: 24,
				background: "linear-gradient(180deg, #16181f 0%, #0c0e14 100%)",
				border: `1px solid ${borderColor}`,
				boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
				padding: 24,
				overflow: "hidden",
				opacity: progress,
				transform: `translateY(${(1 - progress) * 30}px)`,
			}}
		>
			{children}
		</div>
	);
};

// ── Pill ────────────────────────────────────────────────────────────────

/** Animated pill button with typewriter text */
export const Pill: React.FC<{
	text: string;
	delay?: number;
	color?: string;
	bg?: string;
	width?: number;
}> = ({ text, delay = 0, color = "#ffffff", bg = "rgba(255,255,255,0.06)", width }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 14, stiffness: 160 },
	});
	const visible = Math.floor(
		interpolate(frame, [delay + 5, delay + 5 + text.length * 1.5], [0, text.length], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		}),
	);

	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 8,
				padding: "12px 24px",
				borderRadius: 999,
				background: bg,
				border: "1px solid rgba(255,255,255,0.1)",
				opacity: progress,
				transform: `translateY(${(1 - progress) * 20}px)`,
				overflow: "hidden",
				whiteSpace: "nowrap",
				...(width ? { width, justifyContent: "center" } : {}),
			}}
		>
			<span style={{ fontSize: 16, fontWeight: 600, color, fontFamily: "'Inter', sans-serif" }}>
				{text.slice(0, visible)}
			</span>
		</div>
	);
};

// ── Underline ───────────────────────────────────────────────────────────

/** Animated underline that scales from left */
export const Underline: React.FC<{
	color?: string;
	width?: number;
	delay?: number;
}> = ({ color = "#2563eb", width = 200, delay = 10 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 16, stiffness: 140 },
	});

	return (
		<div
			style={{
				width,
				height: 6,
				borderRadius: 3,
				backgroundColor: color,
				transformOrigin: "left center",
				transform: `scaleX(${progress})`,
				marginTop: 12,
			}}
		/>
	);
};
