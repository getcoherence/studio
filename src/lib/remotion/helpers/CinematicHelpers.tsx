// ── Cinematic Helper Components ─────────────────────────────────────────
//
// Pre-built, safe components injected into the AI's module scope.
// These handle overflow, sizing, word-wrapping, and animation correctly
// so the AI can't make common layout mistakes.
//
// The AI uses these instead of raw divs — guarantees visual quality.

import React, { useEffect, useRef } from "react";
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

	// Sanitize: replace literal \n with spaces (AI sometimes puts these in)
	const cleanText = text.replace(/\\n/g, " ").replace(/\n/g, " ");
	const words = cleanText.split(" ").filter(Boolean);

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
				{cleanText}
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
				{cleanText}
			</div>
		);
	}

	if (animation === "blur-in") {
		const progress = spring({
			frame: localFrame,
			fps,
			config: { damping: 18, stiffness: 80 },
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
					filter: `blur(${(1 - progress) * 20}px)`,
				}}
			>
				{cleanText}
			</div>
		);
	}

	if (animation === "bounce") {
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
					const wordDelay = wi * 5;
					const progress = spring({
						frame: Math.max(0, localFrame - wordDelay),
						fps,
						config: { damping: 8, stiffness: 200, mass: 0.6 },
					});
					const isAccent =
						accentWord && word.replace(/[^\w]/g, "") === accentWord.replace(/[^\w]/g, "");
					const bounceY =
						progress < 1 ? (1 - progress) * -60 : Math.sin((localFrame - wordDelay) * 0.3) * 3;
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
								opacity: Math.min(1, progress * 2),
								transform: `translateY(${bounceY}px) scale(${0.8 + progress * 0.2})`,
							}}
						>
							{word}
						</span>
					);
				})}
			</div>
		);
	}

	if (animation === "wave") {
		return (
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: align === "center" ? "center" : "flex-start",
					gap: `0 ${fontSize * 0.25}px`,
					maxWidth,
					overflow: "hidden",
					fontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
				}}
			>
				{words.map((word, wi) => {
					const isAccent =
						accentWord && word.replace(/[^\w]/g, "") === accentWord.replace(/[^\w]/g, "");
					return (
						<span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
							{word.split("").map((char, ci) => {
								const charIdx = words.slice(0, wi).join("").length + ci;
								const waveOffset = Math.sin(localFrame * 0.15 + charIdx * 0.5) * 12;
								const fadeIn = spring({
									frame: Math.max(0, localFrame - charIdx * 1.5),
									fps,
									config: { damping: 14, stiffness: 180 },
								});
								return (
									<span
										key={ci}
										style={{
											display: "inline-block",
											fontSize,
											color: isAccent && accentColor ? accentColor : color,
											opacity: fadeIn,
											transform: `translateY(${waveOffset * fadeIn}px)`,
										}}
									>
										{char}
									</span>
								);
							})}
						</span>
					);
				})}
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
				fontSize,
				fontFamily,
				fontWeight,
				letterSpacing,
				lineHeight,
			}}
		>
			{words.map((word, wi) => {
				const isAccent =
					accentWord && word.replace(/[^\w]/g, "") === accentWord.replace(/[^\w]/g, "");
				const wordNode = (
					<span
						key={wi}
						style={{ display: "inline-block", whiteSpace: "nowrap", fontSize, fontWeight }}
					>
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
										fontSize,
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

// ── GradientText ────────────────────────────────────────────────────────

/** Animated gradient/shimmer text — Apple/Linear style */
export const GradientText: React.FC<{
	text: string;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: number;
	colors?: string[];
	speed?: number;
	delay?: number;
	align?: "center" | "left" | "right";
	maxWidth?: number;
}> = ({
	text,
	fontSize = 120,
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	fontWeight = 900,
	colors = ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#ff6b6b"],
	speed = 4,
	delay = 0,
	align = "center",
	maxWidth = 1400,
}) => {
	const frame = useCurrentFrame();
	const textRef = useRef<HTMLDivElement>(null);
	const localFrame = Math.max(0, frame - delay);
	const angle = localFrame * speed;
	const opacity = interpolate(localFrame, [0, 15], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const scale = interpolate(localFrame, [0, 20], [0.9, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// Apply background-clip: text via DOM ref (React strips it from style prop)
	useEffect(() => {
		if (textRef.current) {
			const el = textRef.current;
			el.style.setProperty("-webkit-background-clip", "text");
			el.style.setProperty("background-clip", "text");
			el.style.setProperty("-webkit-text-fill-color", "transparent");
		}
	});

	return (
		<div
			ref={textRef}
			style={{
				fontSize,
				fontFamily,
				fontWeight,
				letterSpacing: "-0.04em",
				lineHeight: 1.0,
				textAlign: align,
				maxWidth,
				overflow: "hidden",
				background: `linear-gradient(${angle}deg, ${colors.join(", ")})`,
				backgroundSize: "200% 200%",
				color: "transparent",
				opacity,
				transform: `scale(${scale})`,
			}}
		>
			{text}
		</div>
	);
};

// ── ClipReveal ──────────────────────────────────────────────────────────

/** Reveal children through an expanding shape — circle, wipe, diamond, iris */
export const ClipReveal: React.FC<{
	children: React.ReactNode;
	shape?: "circle" | "wipe" | "diamond" | "iris";
	delay?: number;
}> = ({ children, shape = "circle", delay = 0 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 18, stiffness: 80 },
	});

	const clipPath = (() => {
		switch (shape) {
			case "circle":
				return `circle(${progress * 75}% at 50% 50%)`;
			case "wipe":
				return `inset(0 ${(1 - progress) * 100}% 0 0)`;
			case "diamond": {
				const s = (1 - progress) * 50;
				return `polygon(50% ${s}%, ${100 - s}% 50%, 50% ${100 - s}%, ${s}% 50%)`;
			}
			case "iris":
				return `circle(${progress * 80}% at 50% 50%)`;
			default:
				return "none";
		}
	})();

	return (
		<div style={{ clipPath, WebkitClipPath: clipPath, width: "100%", height: "100%" }}>
			{children}
		</div>
	);
};

// ── LightStreak ─────────────────────────────────────────────────────────

/** Cinematic lens flare / light streak overlay */
export const LightStreak: React.FC<{
	startFrame?: number;
	durationFrames?: number;
	color?: string;
	yPosition?: number;
}> = ({ startFrame = 0, durationFrames = 25, color = "rgba(255,255,255,0.8)", yPosition = 45 }) => {
	const frame = useCurrentFrame();
	const localFrame = frame - startFrame;
	if (localFrame < 0 || localFrame > durationFrames) return null;

	const x = interpolate(localFrame, [0, durationFrames], [-20, 120], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const intensity = interpolate(
		localFrame,
		[0, durationFrames * 0.3, durationFrames * 0.7, durationFrames],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				mixBlendMode: "screen" as const,
			}}
		>
			<div
				style={{
					position: "absolute",
					left: `${x}%`,
					top: `${yPosition}%`,
					width: "40%",
					height: 3,
					transform: "translateX(-50%)",
					background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
					opacity: intensity,
					filter: "blur(2px)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: `${x}%`,
					top: `${yPosition}%`,
					width: 180,
					height: 180,
					transform: "translate(-50%, -50%)",
					background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
					opacity: intensity * 0.5,
					filter: "blur(15px)",
				}}
			/>
		</div>
	);
};

// ── GlitchText ──────────────────────────────────────────────────────────

/** Chromatic aberration glitch effect on text */
export const GlitchText: React.FC<{
	text: string;
	fontSize?: number;
	color?: string;
	intensity?: number;
	durationFrames?: number;
	delay?: number;
}> = ({
	text,
	fontSize = 100,
	color = "#fff",
	intensity = 0.7,
	durationFrames = 15,
	delay = 0,
}) => {
	const frame = useCurrentFrame();
	const localFrame = frame - delay;
	const active = localFrame >= 0 && localFrame < durationFrames;

	// Deterministic pseudo-random from frame
	const seed = localFrame * 9301 + 49297;
	const rand = (offset: number) => ((seed + offset * 1000) % 233280) / 233280;

	const offsetX1 = active ? (rand(1) * 20 - 10) * intensity : 0;
	const offsetX2 = active ? (rand(2) * 20 - 10) * intensity : 0;
	const skew = active ? (rand(3) - 0.5) * 6 * intensity : 0;

	const baseStyle: React.CSSProperties = {
		fontSize,
		fontWeight: 900,
		fontFamily: "'Inter', sans-serif",
		position: "absolute" as const,
		whiteSpace: "nowrap" as const,
		letterSpacing: "-0.04em",
	};

	// After glitch, show clean text
	const { fps } = useVideoConfig();
	const cleanProgress = spring({
		frame: Math.max(0, localFrame - durationFrames),
		fps,
		config: { damping: 14, stiffness: 180 },
	});
	const showClean = localFrame >= durationFrames;

	return (
		<div style={{ position: "relative", display: "inline-block" }}>
			{active && (
				<>
					<div
						style={{
							...baseStyle,
							color: "rgba(255,0,0,0.6)",
							transform: `translateX(${offsetX1}px) skewX(${skew}deg)`,
							mixBlendMode: "screen" as const,
						}}
					>
						{text}
					</div>
					<div
						style={{
							...baseStyle,
							color: "rgba(0,255,255,0.6)",
							transform: `translateX(${offsetX2}px) skewX(${-skew}deg)`,
							mixBlendMode: "screen" as const,
						}}
					>
						{text}
					</div>
				</>
			)}
			<div
				style={{
					...baseStyle,
					color,
					position: "relative",
					opacity: showClean ? cleanProgress : 1,
					transform: showClean
						? `scale(${0.95 + cleanProgress * 0.05})`
						: active
							? `skewX(${skew * 0.3}deg)`
							: "none",
				}}
			>
				{text}
			</div>
		</div>
	);
};

// ── Vignette ────────────────────────────────────────────────────────────

/** Cinematic vignette overlay — darkens edges */
export const Vignette: React.FC<{ intensity?: number }> = ({ intensity = 0.6 }) => (
	<div
		style={{
			position: "absolute",
			inset: 0,
			pointerEvents: "none",
			background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${intensity}) 100%)`,
		}}
	/>
);
