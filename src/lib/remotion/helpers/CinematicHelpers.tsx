// ── Cinematic Helper Components ─────────────────────────────────────────
//
// Pre-built, safe components injected into the AI's module scope.
// These handle overflow, sizing, word-wrapping, and animation correctly
// so the AI can't make common layout mistakes.
//
// The AI uses these instead of raw divs — guarantees visual quality.

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
	Bubbles,
	Confetti,
	Embers,
	Fireflies,
	FlowingGradient,
	LightRays,
	Mist,
	MoneyRain,
	PerspectiveGrid,
	Sakura,
	Snow,
	Sparks,
	Stars,
} from "./ParticleEffects";

// ── Scene ───────────────────────────────────────────────────────────────

/** Full-screen scene with safe padding and centered content.
 * Optionally includes an animated background layer above the base color. */
export const Scene: React.FC<{
	bg?: string;
	children: React.ReactNode;
	align?: "center" | "left" | "split";
	padding?: number;
	/** Optional animated background effect rendered between the base bg and the content */
	bgEffect?:
		| "none"
		| "flowing-lines"
		| "drifting-orbs"
		| "mesh-shift"
		| "particle-field"
		| "grain"
		| "pulse-grid"
		| "aurora";
	bgEffectColors?: string[];
	bgEffectIntensity?: number;
}> = ({
	bg = "#050505",
	children,
	align = "center",
	padding = 80,
	bgEffect,
	bgEffectColors,
	bgEffectIntensity = 0.7,
}) => (
	<AbsoluteFill
		style={{
			background: bg,
			display: "flex",
			flexDirection: align === "split" ? "row" : "column",
			alignItems: align === "left" ? "flex-start" : "center",
			justifyContent: "center",
			padding,
			overflow: "hidden",
			position: "relative",
		}}
	>
		{bgEffect && bgEffect !== "none" && (
			<AnimatedBackground
				variant={bgEffect}
				colors={bgEffectColors}
				intensity={bgEffectIntensity}
			/>
		)}
		<div
			style={{
				position: "relative",
				zIndex: 1,
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: align === "split" ? "row" : "column",
				alignItems: align === "left" ? "flex-start" : "center",
				justifyContent: "center",
			}}
		>
			{children}
		</div>
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
	animation?:
		| "chars"
		| "words"
		| "scale"
		| "clip"
		| "blur-in"
		| "bounce"
		| "wave"
		| "typewriter"
		| "staccato"
		| "split"
		| "drop"
		| "scramble"
		| "gradient"
		| "matrix"
		| "rotate-3d"
		| "glitch-in"
		| "none";
	/** Spring damping — lower = bouncier (default 14) */
	damping?: number;
	/** Spring stiffness — higher = faster (default 180) */
	stiffness?: number;
	/** Stagger between elements in frames (default 2 for chars, 6 for words) */
	stagger?: number;
	/** Delay in frames before animation starts */
	delay?: number;
	/** Gradient colors for "gradient" animation or gradient text fill.
	 *  When set, text uses background-clip: text with an animated gradient. */
	gradientColors?: string[];
	/** Defensive: AI sometimes passes the text under the wrong prop name
	 *  (`value`, `children`, `content`). Accept those too so a typo doesn't
	 *  crash the entire scene. */
	value?: string;
	content?: string;
	children?: React.ReactNode;
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
	maxWidth = 1760,
	animation = "chars",
	delay = 0,
	gradientColors,
	value,
	content,
	children,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localFrame = Math.max(0, frame - delay);

	// Defensive: pull the text from any of the common prop names the AI
	// might use, then coerce to string. If we still have nothing, render
	// null — the rest of the scene keeps playing.
	const rawText: unknown = text ?? value ?? content ?? children ?? "";
	const safeText: string = typeof rawText === "string" ? rawText : String(rawText ?? "");
	if (!safeText) return null;

	// Sanitize: replace literal \n with spaces (AI sometimes puts these in)
	const cleanText = safeText.replace(/\\n/g, " ").replace(/\n/g, " ");
	const words = cleanText.split(" ").filter(Boolean);

	// Auto-fit: estimate if text overflows and scale down fontSize
	const avgCharWidth = fontSize * 0.55; // rough estimate for most fonts
	const estimatedWidth = cleanText.length * avgCharWidth;
	const effectiveFontSize =
		estimatedWidth > maxWidth
			? Math.max(48, Math.floor(fontSize * (maxWidth / estimatedWidth)))
			: fontSize;

	// Gradient text fill: animated gradient that shifts over time.
	// Applied as a wrapper style when gradientColors is set or animation === "gradient".
	const useGradient = animation === "gradient" || (gradientColors && gradientColors.length >= 2);
	const gradientStyle: React.CSSProperties | undefined = useGradient
		? (() => {
				const colors = gradientColors || [color, accentColor || "#7c3aed", "#ec4899"];
				const angle = 90 + Math.sin(frame * 0.03) * 30;
				const shift = frame * 2;
				return {
					background: `linear-gradient(${angle}deg, ${(colors as string[]).map((c: string, i: number) => `${c} ${(i / (colors.length - 1)) * 100 + shift}%`).join(", ")})`,
					backgroundSize: "200% 200%",
					backgroundClip: "text",
					WebkitBackgroundClip: "text",
					WebkitTextFillColor: "transparent",
					color: "transparent",
				};
			})()
		: undefined;

	if (animation === "gradient") {
		// Gradient animation: words fade in with gradient fill
		const progress = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 120 } });
		return (
			<div
				style={{
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					textAlign: align,
					maxWidth,
					opacity: progress,
					transform: `scale(${0.85 + progress * 0.15})`,
					...gradientStyle,
				}}
			>
				{cleanText}
			</div>
		);
	}

	// ── Matrix decode: characters cycle through random glyphs before settling ──
	if (animation === "matrix") {
		const chars = cleanText.split("");
		const matrixGlyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
		return (
			<div
				style={{
					fontSize: effectiveFontSize,
					fontFamily: "'Courier New', monospace",
					fontWeight,
					letterSpacing: "0.05em",
					lineHeight,
					color: gradientStyle ? undefined : color,
					textAlign: align,
					maxWidth,
					...gradientStyle,
				}}
			>
				{chars.map((char, i) => {
					const settleFrame = i * 2 + 8;
					const settled = localFrame >= settleFrame;
					const displayChar =
						char === " "
							? "\u00A0"
							: settled
								? char
								: matrixGlyphs[Math.floor((localFrame * 7 + i * 13) % matrixGlyphs.length)];
					const opacity = localFrame < i * 2 ? 0 : settled ? 1 : 0.6;
					return (
						<span
							key={i}
							style={{ opacity, color: settled ? undefined : accentColor || "#22c55e" }}
						>
							{displayChar}
						</span>
					);
				})}
			</div>
		);
	}

	// ── 3D rotate: each character rotates in from 3D perspective ──
	if (animation === "rotate-3d") {
		const chars = cleanText.split("");
		return (
			<div
				style={{
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					textAlign: align,
					maxWidth,
					perspective: 800,
					display: "flex",
					flexWrap: "wrap",
					justifyContent:
						align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
				}}
			>
				{chars.map((char, i) => {
					const progress = spring({
						frame: Math.max(0, localFrame - i * 1.5),
						fps,
						config: { damping: 16, stiffness: 140 },
					});
					const rotateY = (1 - progress) * 90;
					const rotateX = (1 - progress) * -20;
					return (
						<span
							key={i}
							style={{
								display: "inline-block",
								color: gradientStyle ? undefined : color,
								opacity: progress,
								transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
								transformOrigin: "center center",
								...gradientStyle,
							}}
						>
							{char === " " ? "\u00A0" : char}
						</span>
					);
				})}
			</div>
		);
	}

	// ── Glitch in: text appears with chromatic aberration and offset layers ──
	if (animation === "glitch-in") {
		const revealProgress = spring({
			frame: localFrame,
			fps,
			config: { damping: 10, stiffness: 200 },
		});
		const glitchIntensity = Math.max(0, 1 - revealProgress) * 15;
		const offsetR = Math.sin(localFrame * 0.7) * glitchIntensity;
		const offsetB = Math.cos(localFrame * 0.9) * glitchIntensity;
		const clipLeft = (1 - revealProgress) * 100;
		return (
			<div
				style={{
					position: "relative",
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					textAlign: align,
					maxWidth,
				}}
			>
				{/* Red channel offset */}
				{glitchIntensity > 0.5 && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							color: "#ff000060",
							transform: `translate(${offsetR}px, ${-offsetR * 0.5}px)`,
							clipPath: `inset(0 ${clipLeft}% 0 0)`,
							...gradientStyle,
						}}
					>
						{cleanText}
					</div>
				)}
				{/* Blue channel offset */}
				{glitchIntensity > 0.5 && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							color: "#0000ff60",
							transform: `translate(${offsetB}px, ${offsetB * 0.5}px)`,
							clipPath: `inset(0 ${clipLeft}% 0 0)`,
							...gradientStyle,
						}}
					>
						{cleanText}
					</div>
				)}
				{/* Main text */}
				<div
					style={{
						position: "relative",
						color: gradientStyle ? undefined : color,
						clipPath: `inset(0 ${clipLeft}% 0 0)`,
						...gradientStyle,
					}}
				>
					{cleanText}
				</div>
			</div>
		);
	}

	if (animation === "scale") {
		const progress = spring({
			frame: localFrame,
			fps,
			config: { damping: 14, stiffness: 120 },
		});
		return (
			<div
				style={{
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
					opacity: progress,
					transform: `scale(${0.6 + progress * 0.4})`,
					...gradientStyle,
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
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
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
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
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
					gap: `0 ${effectiveFontSize * 0.3}px`,
					maxWidth,
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
						accentWord &&
						accentWord
							.toLowerCase()
							.split(/\s+/)
							.some(
								(aw) =>
									word.replace(/[^\w]/g, "").toLowerCase() ===
									aw.replace(/[^\w]/g, "").toLowerCase(),
							);
					const bounceY =
						progress < 1 ? (1 - progress) * -60 : Math.sin((localFrame - wordDelay) * 0.3) * 3;
					return (
						<span
							key={wi}
							style={{
								display: "inline-block",
								whiteSpace: "nowrap",
								fontSize: effectiveFontSize,
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
					gap: `0 ${effectiveFontSize * 0.3}px`,
					maxWidth,
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
				}}
			>
				{words.map((word, wi) => {
					const isAccent =
						accentWord &&
						accentWord
							.toLowerCase()
							.split(/\s+/)
							.some(
								(aw) =>
									word.replace(/[^\w]/g, "").toLowerCase() ===
									aw.replace(/[^\w]/g, "").toLowerCase(),
							);
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
											fontSize: effectiveFontSize,
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

	if (animation === "typewriter") {
		const totalChars = cleanText.length;
		const charsVisible = Math.floor(
			interpolate(localFrame, [0, totalChars * 1.5], [0, totalChars], {
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
			}),
		);
		const cursorOpacity = Math.round(localFrame / 8) % 2 === 0 ? 1 : 0;
		return (
			<div
				style={{
					fontSize: effectiveFontSize,
					fontFamily: fontFamily || "'SF Mono', 'Fira Code', monospace",
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
				}}
			>
				{cleanText.slice(0, charsVisible)}
				<span style={{ opacity: cursorOpacity, color: accentColor || color }}>|</span>
			</div>
		);
	}

	if (animation === "staccato") {
		return (
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: align === "center" ? "center" : "flex-start",
					gap: `0 ${effectiveFontSize * 0.3}px`,
					maxWidth,
				}}
			>
				{words.map((word, wi) => {
					const wordDelay = wi * 4;
					// Higher damping (14) to prevent oscillation — gives a crisp
					// punch-in with one clean overshoot instead of bouncing.
					const rawProgress = spring({
						frame: Math.max(0, localFrame - wordDelay),
						fps,
						config: { damping: 14, stiffness: 300, mass: 0.5 },
					});
					// Smooth overshoot: scale pops to 1.08x then settles to 1.0.
					// Uses interpolate (continuous, no branch discontinuity) so
					// the scale never jumps between two formulas.
					const scale = interpolate(rawProgress, [0, 0.5, 0.85, 1], [0.5, 1.08, 1.02, 1], {
						extrapolateRight: "clamp",
					});
					const isAccent =
						accentWord &&
						accentWord
							.toLowerCase()
							.split(/\s+/)
							.some(
								(aw) =>
									word.replace(/[^\w]/g, "").toLowerCase() ===
									aw.replace(/[^\w]/g, "").toLowerCase(),
							);
					return (
						<span
							key={wi}
							style={{
								display: "inline-block",
								whiteSpace: "nowrap",
								fontSize: effectiveFontSize,
								fontFamily,
								fontWeight,
								letterSpacing,
								lineHeight,
								color: isAccent && accentColor ? accentColor : color,
								opacity: Math.min(1, rawProgress * 3),
								transform: `scale(${scale})`,
							}}
						>
							{word}
						</span>
					);
				})}
			</div>
		);
	}

	if (animation === "split") {
		return (
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: align === "center" ? "center" : "flex-start",
					gap: `0 ${effectiveFontSize * 0.3}px`,
					maxWidth,
				}}
			>
				{words.map((word, wi) => {
					const mid = words.length / 2;
					const distance = wi - mid;
					const wordDelay = Math.abs(distance) * 3;
					const progress = spring({
						frame: Math.max(0, localFrame - wordDelay),
						fps,
						config: { damping: 14, stiffness: 120 },
					});
					const offsetX = (1 - progress) * distance * 60;
					const isAccent =
						accentWord &&
						accentWord
							.toLowerCase()
							.split(/\s+/)
							.some(
								(aw) =>
									word.replace(/[^\w]/g, "").toLowerCase() ===
									aw.replace(/[^\w]/g, "").toLowerCase(),
							);
					return (
						<span
							key={wi}
							style={{
								display: "inline-block",
								whiteSpace: "nowrap",
								fontSize: effectiveFontSize,
								fontFamily,
								fontWeight,
								letterSpacing,
								lineHeight,
								color: isAccent && accentColor ? accentColor : color,
								opacity: progress,
								transform: `translateX(${offsetX}px)`,
							}}
						>
							{word}
						</span>
					);
				})}
			</div>
		);
	}

	if (animation === "drop") {
		return (
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: align === "center" ? "center" : "flex-start",
					gap: `0 ${effectiveFontSize * 0.3}px`,
					maxWidth,
					fontSize: effectiveFontSize,
					fontFamily,
					fontWeight,
					letterSpacing,
					lineHeight,
				}}
			>
				{words.map((word, wi) => {
					const isAccent =
						accentWord &&
						accentWord
							.toLowerCase()
							.split(/\s+/)
							.some(
								(aw) =>
									word.replace(/[^\w]/g, "").toLowerCase() ===
									aw.replace(/[^\w]/g, "").toLowerCase(),
							);
					return (
						<span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
							{word.split("").map((char, ci) => {
								const charIdx = words.slice(0, wi).join("").length + ci;
								const charDelay = charIdx * 2;
								const progress = spring({
									frame: Math.max(0, localFrame - charDelay),
									fps,
									config: { damping: 10, stiffness: 200, mass: 0.8 },
								});
								return (
									<span
										key={ci}
										style={{
											display: "inline-block",
											fontSize: effectiveFontSize,
											color: isAccent && accentColor ? accentColor : color,
											opacity: progress,
											transform: `translateY(${(1 - progress) * -80}px)`,
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

	if (animation === "scramble") {
		const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
		const scrambleSpeed = 2; // frames per char to resolve
		return (
			<div
				style={{
					fontSize: effectiveFontSize,
					fontFamily: fontFamily || "'SF Mono', 'Fira Code', monospace",
					fontWeight,
					letterSpacing,
					lineHeight,
					color,
					textAlign: align,
					maxWidth,
				}}
			>
				{cleanText.split("").map((char, ci) => {
					const resolveFrame = ci * scrambleSpeed;
					const isResolved = localFrame >= resolveFrame + 8;
					if (char === " ") return <span key={ci}> </span>;
					if (isResolved) {
						return (
							<span key={ci} style={{ color: ci === 0 && accentColor ? accentColor : color }}>
								{char}
							</span>
						);
					}
					// Deterministic pseudo-random char
					const seed = (localFrame * 9301 + ci * 49297) % CHARS.length;
					return (
						<span key={ci} style={{ opacity: 0.6, color: accentColor || color }}>
							{localFrame < resolveFrame ? CHARS[seed] : char}
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
						accentWord &&
						accentWord
							.toLowerCase()
							.split(/\s+/)
							.some(
								(aw) =>
									word.replace(/[^\w]/g, "").toLowerCase() ===
									aw.replace(/[^\w]/g, "").toLowerCase(),
							);
					return (
						<span
							key={wi}
							style={{
								display: "inline-block",
								whiteSpace: "nowrap",
								fontSize: effectiveFontSize,
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
				gap: `0 ${effectiveFontSize * 0.3}px`,
				maxWidth,
				fontSize: effectiveFontSize,
				fontFamily,
				fontWeight,
				letterSpacing,
				lineHeight,
			}}
		>
			{words.map((word, wi) => {
				const isAccent =
					accentWord &&
					accentWord
						.toLowerCase()
						.split(/\s+/)
						.some(
							(aw) =>
								word.replace(/[^\w]/g, "").toLowerCase() === aw.replace(/[^\w]/g, "").toLowerCase(),
						);
				const wordNode = (
					<span
						key={wi}
						style={{
							display: "inline-block",
							whiteSpace: "nowrap",
							fontSize: effectiveFontSize,
							fontWeight,
						}}
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
										fontSize: effectiveFontSize,
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
	bg?: string;
}> = ({ children, width = 420, delay = 0, borderColor = "rgba(255,255,255,0.08)", bg }) => {
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
				background: bg || "linear-gradient(180deg, #16181f 0%, #0c0e14 100%)",
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
	text?: string;
	label?: string;
	delay?: number;
	color?: string;
	bg?: string;
	width?: number;
}> = ({ text, label, delay = 0, color = "#ffffff", bg = "rgba(255,255,255,0.06)", width }) => {
	const safeText = text || label || "";
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 14, stiffness: 160 },
	});
	const visible = Math.floor(
		interpolate(frame, [delay + 5, delay + 5 + safeText.length * 1.5], [0, safeText.length], {
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
				{safeText.slice(0, visible)}
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
export const GradientText: React.FC<any> = (props: any) => {
	const {
		text,
		value,
		content,
		children,
		fontSize = 120,
		fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
		fontWeight = 900,
		colors = ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#ff6b6b"],
		speed = 4,
		delay = 0,
		align = "center",
		maxWidth = 1400,
	}: {
		text?: unknown;
		value?: unknown;
		content?: unknown;
		children?: unknown;
		fontSize?: number;
		fontFamily?: string;
		fontWeight?: number;
		colors?: string[];
		speed?: number;
		delay?: number;
		align?: "center" | "left" | "right";
		maxWidth?: number;
	} = props || {};
	const frame = useCurrentFrame();
	// Defensive: pull text from any common prop name and bail on missing.
	const rawText: unknown = text ?? value ?? content ?? children ?? "";
	const safeText = typeof rawText === "string" ? rawText : String(rawText ?? "");
	if (!safeText) return null;
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

	return (
		<div
			style={
				{
					fontSize,
					fontFamily,
					fontWeight,
					letterSpacing: "-0.04em",
					lineHeight: 1.0,
					textAlign: align,
					maxWidth,
					overflow: "hidden",
					backgroundImage: `linear-gradient(${angle}deg, ${colors.join(", ")})`,
					backgroundSize: "200% 200%",
					backgroundRepeat: "no-repeat",
					// background-clip: text must be set as inline styles (not via useEffect)
					// because Remotion SSR export doesn't run useEffect
					WebkitBackgroundClip: "text",
					backgroundClip: "text",
					WebkitTextFillColor: "transparent",
					color: "transparent",
					opacity,
					transform: `scale(${scale})`,
				} as React.CSSProperties
			}
		>
			{safeText}
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

// ── WordCarousel ────────────────────────────────────────────────────────

/** Cycles through words with a flip animation */
export const WordCarousel: React.FC<{
	words: string[];
	prefix?: string;
	suffix?: string;
	fontSize?: number;
	color?: string;
	accentColor?: string;
	fontFamily?: string;
	fontWeight?: number;
	frameDuration?: number;
}> = ({
	words,
	prefix = "",
	suffix = "",
	fontSize = 100,
	color = "#ffffff",
	accentColor = "#2563eb",
	fontFamily = "'Inter', sans-serif",
	fontWeight = 900,
	frameDuration = 30,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const currentIndex = Math.floor(frame / frameDuration) % words.length;
	const localFrame = frame % frameDuration;
	const progress = spring({
		frame: localFrame,
		fps,
		config: { damping: 14, stiffness: 160 },
	});
	const longestWord = words.reduce((a, b) => (a.length >= b.length ? a : b), words[0]);

	return (
		<div
			style={{
				fontSize,
				fontFamily,
				fontWeight,
				color,
				textAlign: "center",
				letterSpacing: "-0.04em",
			}}
		>
			{prefix && <span>{prefix} </span>}
			<span style={{ display: "inline-block", position: "relative" }}>
				<span style={{ visibility: "hidden" }}>{longestWord}</span>
				<span
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						width: "100%",
						color: accentColor,
						opacity: progress,
						transform: `translateY(${(1 - progress) * 20}px)`,
					}}
				>
					{words[currentIndex]}
				</span>
			</span>
			{suffix && <span> {suffix}</span>}
		</div>
	);
};

// ── ProgressBar ─────────────────────────────────────────────────────────

/** Animated progress bar with label */
export const ProgressBar: React.FC<{
	label: string;
	value: number;
	maxValue?: number;
	color?: string;
	delay?: number;
	width?: number;
}> = ({ label, value, maxValue = 100, color = "#2563eb", delay = 0, width = 600 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 20, stiffness: 80 },
	});
	const barWidth = (value / maxValue) * 100 * progress;

	return (
		<div style={{ width, display: "flex", flexDirection: "column", gap: 6 }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					fontFamily: "'Inter', sans-serif",
					fontSize: 18,
					color: "rgba(255,255,255,0.7)",
				}}
			>
				<span>{label}</span>
				<span>{Math.round(value * progress)}%</span>
			</div>
			<div
				style={{
					width: "100%",
					height: 8,
					borderRadius: 4,
					backgroundColor: "rgba(255,255,255,0.1)",
				}}
			>
				<div
					style={{
						width: `${barWidth}%`,
						height: "100%",
						borderRadius: 4,
						backgroundColor: color,
						transition: "none",
					}}
				/>
			</div>
		</div>
	);
};

// ── MetricCounter ───────────────────────────────────────────────────────

/** Large animated number with label below */
export const MetricCounter: React.FC<{
	value: number;
	label: string;
	prefix?: string;
	suffix?: string;
	fontSize?: number;
	color?: string;
	delay?: number;
}> = ({ value, label, prefix = "", suffix = "", fontSize = 96, color = "#ffffff", delay = 0 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 16, stiffness: 60, mass: 1.5 },
	});
	const displayValue = Math.round(value * progress);

	return (
		<div style={{ textAlign: "center" }}>
			<div
				style={{
					fontSize,
					fontWeight: 900,
					fontFamily: "'Inter', sans-serif",
					color,
					letterSpacing: "-0.04em",
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{prefix}
				{displayValue.toLocaleString()}
				{suffix}
			</div>
			<div
				style={{
					fontSize: 20,
					color: "rgba(255,255,255,0.5)",
					fontFamily: "'Inter', sans-serif",
					marginTop: 4,
				}}
			>
				{label}
			</div>
		</div>
	);
};

// ── GhostSentence ──────────────────────────────────────────────────────

/**
 * Sentence fragmentation with "ghost future words" — shows upcoming words faded
 * before they animate to bold. The signature "Let's make it [happen]" pattern
 * from top SaaS videos (Lovable, Venture, etc).
 */
/** Parse a color (hex or rgb/rgba) into its rgb components, for computing a
 * contrasting ghost tint. */
function parseColorRgb(c: string): { r: number; g: number; b: number } {
	const hex = c.match(/^#([0-9a-f]{6})$/i);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
	}
	const short = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
	if (short) {
		return {
			r: Number.parseInt(short[1] + short[1], 16),
			g: Number.parseInt(short[2] + short[2], 16),
			b: Number.parseInt(short[3] + short[3], 16),
		};
	}
	const rgb = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (rgb) {
		return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
	}
	return { r: 255, g: 255, b: 255 };
}

export const GhostSentence: React.FC<{
	words: string[];
	/** Starting active index. Defaults to 0. The component auto-progresses from
	 * here through words.length - 1 over the scene duration. */
	activeIndex?: number;
	/** Frames per word reveal. If omitted, the component divides the scene's
	 * sequence duration evenly across the words. */
	autoProgressFrames?: number;
	fontSize?: number;
	color?: string;
	ghostColor?: string;
	fontFamily?: string;
	gap?: number;
	/** Max container width in px — prevents text overflow on long fragments */
	maxWidth?: number;
}> = ({
	words,
	activeIndex = 0,
	autoProgressFrames,
	fontSize = 140,
	color = "#1a1a1a",
	ghostColor,
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	gap = 0.3,
	maxWidth,
}) => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	// Derive a ghost color that contrasts with the scene bg: use the active text
	// color at low opacity so white-on-dark scenes get faint-white ghosts (visible)
	// and dark-on-light scenes get faint-dark ghosts. Without this, the old
	// hardcoded rgba(26,26,26,0.12) default was invisible on dark backgrounds.
	const resolvedGhostColor =
		ghostColor ||
		(() => {
			const { r, g, b } = parseColorRgb(color);
			return `rgba(${r},${g},${b},0.22)`;
		})();

	// Auto-progress the active index over the scene duration so multi-word
	// sentences reveal across time instead of freezing at activeIndex forever.
	const perWord =
		autoProgressFrames && autoProgressFrames > 0
			? autoProgressFrames
			: Math.max(6, Math.floor(durationInFrames / Math.max(1, words.length)));
	const progressedIndex = Math.min(words.length - 1, activeIndex + Math.floor(frame / perWord));

	return (
		<div
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: `${fontSize * gap}px`,
				justifyContent: "center",
				fontSize,
				fontFamily,
				fontWeight: 900,
				letterSpacing: "-0.04em",
				lineHeight: 0.95,
				...(maxWidth ? { maxWidth, margin: "0 auto" } : {}),
			}}
		>
			{words.map((word, i) => {
				const isActive = i <= progressedIndex;
				const justActivated = i === progressedIndex;
				// Each word animates on its reveal frame (not frame 0) so late
				// words still get a spring when they activate.
				const activationFrame = (i - activeIndex) * perWord;
				const progress = justActivated
					? spring({
							frame: Math.max(0, frame - activationFrame),
							fps,
							config: { damping: 14, stiffness: 160 },
						})
					: 1;
				return (
					<span
						key={i}
						style={{
							color: isActive ? color : resolvedGhostColor,
							opacity: isActive ? progress : 1,
							transform: justActivated ? `scale(${0.95 + progress * 0.05})` : undefined,
							whiteSpace: "nowrap",
						}}
					>
						{word}
					</span>
				);
			})}
		</div>
	);
};

// ── WordSlotMachine ────────────────────────────────────────────────────

/**
 * Vertical word list with ONE bolded (selected) — "Whatever your [X] is" pattern.
 * Used in Kris Zeljukina's SaaS Promo for "Your [App/Product/Agency/Story]".
 */
export const WordSlotMachine: React.FC<{
	prefix?: string;
	words: string[];
	selectedIndex?: number;
	fontSize?: number;
	color?: string;
	accentColor?: string;
	checkmark?: boolean;
	fontFamily?: string;
}> = ({
	prefix = "",
	words,
	selectedIndex = 0,
	fontSize = 120,
	color = "#1a1a1a",
	accentColor = "#2563eb",
	checkmark = true,
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// ── Phased choreography ─────────────────────────
	// Phase 1 (0-12f):  Prefix typewriter
	// Phase 2 (12-40f): Slot wheel spins, words rise from below, decelerating
	// Phase 3 (40-50f): Checkmark pops in beside the prefix
	// Phase 4 (50+f):   Hold

	const PHASE1_END = 12;
	const PHASE2_START = 12;
	const PHASE2_END = 40;
	const PHASE3_START = 40;

	// Phase 1: prefix typewriter
	const prefixChars = prefix.length;
	const prefixVisible = Math.min(
		prefixChars,
		Math.floor(
			interpolate(frame, [0, PHASE1_END], [0, prefixChars], {
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
			}),
		),
	);
	const typedPrefix = prefix.slice(0, prefixVisible);

	// Phase 2: slot wheel — vertical list that scrolls up, decelerating
	const wheelLocalFrame = Math.max(0, frame - PHASE2_START);
	const wheelDuration = PHASE2_END - PHASE2_START;
	const wheelT = Math.max(0, Math.min(1, wheelLocalFrame / wheelDuration));
	// Cubic ease-out (fast start, slow landing)
	const wheelEased = 1 - Math.pow(1 - wheelT, 3);

	// The wheel cycles through the word list 3 full times, then lands on selected
	const WORD_HEIGHT = fontSize * 1.1;
	const REPEATS = 3;
	// Auto-size wheel width based on longest word (approximation: chars * 0.55 * fontSize)
	const longestCharCount = Math.max(...words.map((w) => w.length), 4);
	const wheelMinWidth = Math.min(1400, longestCharCount * fontSize * 0.58);
	const totalStops = words.length * REPEATS + selectedIndex;
	const currentOffset = wheelEased * totalStops * WORD_HEIGHT;
	// Render a long list of words (REPEATS + 1 copies) so the viewing window always has content
	const rollingList: string[] = [];
	for (let r = 0; r < REPEATS + 2; r++) {
		for (let i = 0; i < words.length; i++) rollingList.push(words[i]);
	}
	rollingList.push(words[selectedIndex]); // final landing word

	const wheelStarted = frame >= PHASE2_START;

	// Phase 3: checkmark pop
	const checkmarkSpring = spring({
		frame: Math.max(0, frame - PHASE3_START),
		fps,
		config: { damping: 8, stiffness: 220, mass: 0.5 },
	});
	const checkmarkScale =
		checkmarkSpring < 1 ? checkmarkSpring * 1.2 : 1 + (1 - checkmarkSpring) * 0.2;

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: fontSize * 0.35,
				fontFamily,
			}}
		>
			{/* Prefix with typewriter cursor */}
			{prefix && (
				<div
					style={{
						fontSize,
						fontWeight: 900,
						color,
						letterSpacing: "-0.04em",
						background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}aa 100%)`,
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						display: "inline-flex",
						alignItems: "center",
						whiteSpace: "nowrap",
					}}
				>
					{typedPrefix}
					{prefixVisible < prefixChars && (
						<span
							style={{
								display: "inline-block",
								width: fontSize * 0.05,
								height: fontSize * 0.8,
								marginLeft: 4,
								background: accentColor,
								WebkitTextFillColor: accentColor,
								opacity: Math.floor(frame / 4) % 2 === 0 ? 1 : 0,
							}}
						/>
					)}
				</div>
			)}

			{/* Checkmark — pops in AFTER wheel lands */}
			{checkmark && (
				<div
					style={{
						width: fontSize * 0.75,
						height: fontSize * 0.75,
						borderRadius: fontSize * 0.15,
						background: accentColor,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#fff",
						fontSize: fontSize * 0.55,
						fontWeight: 900,
						opacity: checkmarkSpring,
						transform: `scale(${checkmarkScale})`,
						boxShadow: `0 ${fontSize * 0.08}px ${fontSize * 0.25}px ${accentColor}50`,
						flexShrink: 0,
					}}
				>
					✓
				</div>
			)}

			{/* Slot wheel — viewing window showing 5 words (2 above, center, 2 below).
			    Uses CSS mask-image to fade edges to transparent so it works on any bg. */}
			{wheelStarted &&
				(() => {
					const VISIBLE_ROWS = 5;
					const windowHeight = WORD_HEIGHT * VISIBLE_ROWS;
					// Offset so the "current" word sits in the center row (row 2 of 0-4)
					const centerRowOffset = WORD_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
					const scrollY = -currentOffset + centerRowOffset;
					return (
						<div
							style={{
								height: windowHeight,
								overflow: "hidden",
								position: "relative",
								minWidth: wheelMinWidth,
								whiteSpace: "nowrap",
								WebkitMaskImage:
									"linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
								maskImage:
									"linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
							}}
						>
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									transform: `translateY(${scrollY}px)`,
									willChange: "transform",
								}}
							>
								{rollingList.map((word, i) => {
									const isFinal = i === rollingList.length - 1;
									// Distance from the "center" position in the viewport
									const wordY = i * WORD_HEIGHT + scrollY;
									const distFromCenter = Math.abs(wordY + WORD_HEIGHT / 2 - windowHeight / 2);
									const maxDist = windowHeight / 2;
									const proximity = 1 - Math.min(1, distFromCenter / maxDist);
									// Scale + opacity based on proximity to center
									const wordScale = 0.7 + proximity * 0.3;
									const wordOpacity = 0.25 + proximity * 0.75;
									return (
										<div
											key={i}
											style={{
												height: WORD_HEIGHT,
												display: "flex",
												alignItems: "center",
												fontSize,
												fontWeight: isFinal && wheelT >= 1 ? 900 : 700,
												color: isFinal && wheelT >= 1 ? color : color,
												opacity: isFinal && wheelT >= 1 ? 1 : wordOpacity,
												transform: `scale(${isFinal && wheelT >= 1 ? 1 : wordScale})`,
												transformOrigin: "left center",
												letterSpacing: "-0.04em",
												lineHeight: 1,
												whiteSpace: "nowrap",
											}}
										>
											{word}
										</div>
									);
								})}
							</div>
						</div>
					);
				})()}
		</div>
	);
};

// ── AvatarConstellation ────────────────────────────────────────────────

/**
 * Scattered gradient avatar cards around a central claim.
 * Social proof pattern from Kris Zeljukina's "Trusted by thousands" scene.
 */
export const AvatarConstellation: React.FC<{
	children: React.ReactNode;
	avatarCount?: number;
	colors?: string[];
	cardSize?: number;
}> = ({
	children,
	avatarCount = 8,
	colors = ["#2563eb", "#7c3aed", "#ec4899", "#f59e0b", "#10b981"],
	cardSize = 90,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const emojis = ["🧑", "👩", "👨", "🧑‍💼", "👩‍💻", "👨‍💻", "🧑‍🎨", "👩‍🚀"];

	// Deterministic positions around the text — pushed to edges to avoid
	// overlapping the centered headline (center ~30-70% x, ~35-65% y)
	const positions = [
		{ x: 12, y: 14 },
		{ x: 50, y: 8 },
		{ x: 88, y: 14 },
		{ x: 92, y: 50 },
		{ x: 85, y: 86 },
		{ x: 50, y: 92 },
		{ x: 15, y: 86 },
		{ x: 5, y: 50 },
	];

	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			{positions.slice(0, avatarCount).map((pos, i) => {
				const delay = i * 4;
				const progress = spring({
					frame: Math.max(0, frame - delay),
					fps,
					config: { damping: 12, stiffness: 160 },
				});
				const colorA = colors[i % colors.length];
				const colorB = colors[(i + 2) % colors.length];
				const rotation = ((i * 37) % 20) - 10;
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${pos.x}%`,
							top: `${pos.y}%`,
							width: cardSize,
							height: cardSize,
							transform: `translate(-50%, -50%) scale(${progress}) rotate(${rotation}deg)`,
							opacity: progress,
							borderRadius: 18,
							background: `linear-gradient(135deg, ${colorA}, ${colorB})`,
							boxShadow: `0 0 40px ${colorA}60, 0 12px 32px rgba(0,0,0,0.3)`,
							border: `2px solid ${colorA}80`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: cardSize * 0.55,
						}}
					>
						{emojis[i % emojis.length]}
					</div>
				);
			})}
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "0 14%",
					zIndex: 10,
				}}
			>
				{children}
			</div>
		</div>
	);
};

// ── ViewfinderFrame ────────────────────────────────────────────────────

/**
 * Camera-viewfinder corner brackets around children.
 * Treats the scene like a camera shot — adds editorial weight.
 */
export const ViewfinderFrame: React.FC<{
	children: React.ReactNode;
	color?: string;
	thickness?: number;
	bracketSize?: number;
	inset?: number;
}> = ({ children, color = "#1a1a1a", thickness = 4, bracketSize = 60, inset = 40 }) => {
	const corners: React.CSSProperties[] = [
		{
			top: inset,
			left: inset,
			borderTop: `${thickness}px solid ${color}`,
			borderLeft: `${thickness}px solid ${color}`,
		},
		{
			top: inset,
			right: inset,
			borderTop: `${thickness}px solid ${color}`,
			borderRight: `${thickness}px solid ${color}`,
		},
		{
			bottom: inset,
			left: inset,
			borderBottom: `${thickness}px solid ${color}`,
			borderLeft: `${thickness}px solid ${color}`,
		},
		{
			bottom: inset,
			right: inset,
			borderBottom: `${thickness}px solid ${color}`,
			borderRight: `${thickness}px solid ${color}`,
		},
	];
	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			{children}
			{corners.map((style, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						width: bracketSize,
						height: bracketSize,
						pointerEvents: "none",
						...style,
					}}
				/>
			))}
		</div>
	);
};

// ── GlassmorphismCard ──────────────────────────────────────────────────

/**
 * Frosted glass card with backdrop blur, subtle border, and inner glow.
 * Works on both light and dark backgrounds.
 */
export const GlassCard: React.FC<{
	children: React.ReactNode;
	width?: number;
	padding?: number;
	borderRadius?: number;
	blur?: number;
	opacity?: number;
	borderColor?: string;
	tilt?: number;
}> = ({
	children,
	width = 600,
	padding = 40,
	borderRadius = 24,
	blur = 20,
	opacity = 0.15,
	borderColor = "rgba(255,255,255,0.18)",
	tilt = 0,
}) => {
	return (
		<div
			style={{
				width,
				padding,
				borderRadius,
				background: `rgba(255, 255, 255, ${opacity})`,
				backdropFilter: `blur(${blur}px)`,
				WebkitBackdropFilter: `blur(${blur}px)`,
				border: `1px solid ${borderColor}`,
				boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
				transform: tilt ? `rotate(${tilt}deg)` : undefined,
			}}
		>
			{children}
		</div>
	);
};

// ── DeviceMockup ──────────────────────────────────────────────────────

/**
 * Wraps content in a laptop/phone device frame for product screenshots.
 * Creates the "3D floating device" look from professional product videos.
 */
export const DeviceMockup: React.FC<{
	children: React.ReactNode;
	device?: "laptop" | "phone";
	tilt?: number;
	shadow?: boolean;
}> = ({ children, device = "laptop", tilt = -3, shadow = true }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
	const float = Math.sin((frame / fps) * 1.2) * 4;

	if (device === "phone") {
		return (
			<div
				style={{
					transform: `perspective(1200px) rotateY(${tilt}deg) translateY(${(1 - enter) * 60 + float}px)`,
					opacity: enter,
					width: 320,
					borderRadius: 40,
					background: "#1a1a1a",
					padding: "12px 8px",
					boxShadow: shadow ? "0 40px 80px rgba(0,0,0,0.4)" : undefined,
				}}
			>
				<div style={{ borderRadius: 28, overflow: "hidden", aspectRatio: "9/19.5" }}>
					{children}
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				transform: `perspective(1600px) rotateX(${tilt * 0.5}deg) rotateY(${tilt}deg) translateY(${(1 - enter) * 80 + float}px)`,
				opacity: enter,
			}}
		>
			{/* Screen */}
			<div
				style={{
					width: 900,
					borderRadius: "16px 16px 0 0",
					background: "#0a0a0a",
					padding: "8px 8px 0",
					boxShadow: shadow ? "0 40px 100px rgba(0,0,0,0.5)" : undefined,
				}}
			>
				{/* Browser chrome */}
				<div
					style={{
						height: 32,
						background: "#1a1a1a",
						borderRadius: "8px 8px 0 0",
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "0 12px",
					}}
				>
					<div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
					<div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
					<div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
					<div
						style={{
							flex: 1,
							height: 20,
							borderRadius: 4,
							background: "#0a0a0a",
							marginLeft: 8,
							display: "flex",
							alignItems: "center",
							padding: "0 8px",
							fontSize: 10,
							color: "rgba(255,255,255,0.3)",
							fontFamily: "'Inter', sans-serif",
						}}
					>
						getcoherence.io/studio
					</div>
				</div>
				<div style={{ overflow: "hidden", borderRadius: "0 0 0 0" }}>{children}</div>
			</div>
			{/* Keyboard base */}
			<div
				style={{
					width: 980,
					height: 14,
					margin: "0 auto",
					background: "linear-gradient(180deg, #2a2a2a, #1a1a1a)",
					borderRadius: "0 0 12px 12px",
				}}
			/>
		</div>
	);
};

// ── GlowFrame ──────────────────────────────────────────────────────────

/**
 * Wraps children in a brand-gradient glow aura (like Lovable's product shots).
 * Creates the signature "premium product moment" look.
 */
export const GlowFrame: React.FC<{
	children: React.ReactNode;
	colors?: string[];
	intensity?: number;
	padding?: number;
	borderRadius?: number;
	tilt?: number;
	/** 3D perspective rotation on X axis in degrees (-25 to 25). Dramatic cinematic tilt. */
	perspectiveX?: number;
	/** 3D perspective rotation on Y axis in degrees (-25 to 25). */
	perspectiveY?: number;
}> = ({
	children,
	colors = ["#ff006e", "#ff6b35", "#a855f7"],
	intensity = 1,
	padding = 40,
	borderRadius = 20,
	tilt = 0,
	perspectiveX = 0,
	perspectiveY = 0,
}) => {
	const gradientBg = `linear-gradient(135deg, ${colors.join(", ")})`;
	const transform3d =
		perspectiveX || perspectiveY
			? `perspective(1600px) rotateX(${perspectiveX}deg) rotateY(${perspectiveY}deg) ${tilt ? `rotate(${tilt}deg)` : ""}`
			: tilt
				? `rotate(${tilt}deg)`
				: undefined;
	// CSS filter: blur() on a parent element blurs its children too — applying
	// filter: blur(0) on the inner div does NOT cancel it. The correct way to
	// make a glow frame around content is to render the blurred gradient as an
	// absolutely-positioned sibling BEHIND the content, not as a parent.
	const blurAmount = 8 * intensity;
	const frameInset = -padding * intensity;
	return (
		<div
			style={{
				position: "relative",
				display: "inline-block",
				transform: transform3d,
				transformStyle: "preserve-3d",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: frameInset,
					left: frameInset,
					right: frameInset,
					bottom: frameInset,
					borderRadius: borderRadius + 20,
					background: gradientBg,
					filter: `blur(${blurAmount}px)`,
					zIndex: 0,
					pointerEvents: "none",
				}}
			/>
			<div
				style={{
					position: "relative",
					borderRadius,
					overflow: "hidden",
					zIndex: 1,
					boxShadow: `0 0 ${80 * intensity}px ${40 * intensity}px ${colors[0]}80`,
				}}
			>
				{children}
			</div>
		</div>
	);
};

// ── TypewriterInput ────────────────────────────────────────────────────

/**
 * Isolated pill-shaped input with typewriter text and animated cursor.
 * Mirrors the "hero product component" pattern from Lovable/Vercel videos.
 */
export const TypewriterInput: React.FC<{
	placeholder: string;
	width?: number;
	bg?: string;
	glowColors?: string[];
	charsPerFrame?: number;
	delay?: number;
	showCursor?: boolean;
}> = ({
	placeholder,
	width = 900,
	bg = "#0a0a0a",
	glowColors = ["#ff006e", "#ff6b35", "#a855f7"],
	charsPerFrame = 0.5,
	delay = 0,
	showCursor = true,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localFrame = Math.max(0, frame - delay);
	const visible = Math.floor(localFrame * charsPerFrame);
	const typed = placeholder.slice(0, Math.min(visible, placeholder.length));
	const complete = visible >= placeholder.length + 8;

	const entrance = spring({
		frame: localFrame,
		fps,
		config: { damping: 14, stiffness: 120 },
	});

	return (
		<div
			style={{
				position: "relative",
				display: "inline-block",
				opacity: entrance,
				transform: `scale(${0.9 + entrance * 0.1})`,
			}}
		>
			{/* Glow halo */}
			<div
				style={{
					position: "absolute",
					inset: -60,
					borderRadius: 9999,
					background: `radial-gradient(ellipse at center, ${glowColors[0]} 0%, ${glowColors[1]}80 30%, ${glowColors[2]}40 60%, transparent 75%)`,
					filter: "blur(40px)",
					opacity: 0.8,
				}}
			/>
			{/* Pill input */}
			<div
				style={{
					position: "relative",
					width,
					padding: "28px 40px",
					borderRadius: 9999,
					background: bg,
					border: "1px solid rgba(255,255,255,0.1)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 20,
				}}
			>
				<div
					style={{
						flex: 1,
						fontSize: 28,
						fontFamily: "'Inter', sans-serif",
						color: typed.length < placeholder.length ? "rgba(255,255,255,0.9)" : "#fff",
						fontWeight: 500,
					}}
				>
					{typed}
					{showCursor && !complete && (
						<span
							style={{
								opacity: Math.floor(localFrame / 8) % 2 === 0 ? 1 : 0,
								marginLeft: 2,
								color: glowColors[0],
							}}
						>
							|
						</span>
					)}
				</div>
				{/* Submit button */}
				<div
					style={{
						width: 48,
						height: 48,
						borderRadius: "50%",
						background: `linear-gradient(135deg, ${glowColors.join(", ")})`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#fff",
						fontSize: 20,
					}}
				>
					→
				</div>
			</div>
		</div>
	);
};

// ── FloatingOrbs ───────────────────────────────────────────────────────

/** Slow-moving blurred color orbs for premium depth backgrounds */
export const FloatingOrbs: React.FC<{
	colors?: string[];
	count?: number;
	speed?: number;
	opacity?: number;
	blurAmount?: number;
}> = ({
	colors = ["#2563eb", "#7c3aed", "#06b6d4"],
	count = 3,
	speed = 0.008,
	opacity = 0.3,
	blurAmount = 120,
}) => {
	const frame = useCurrentFrame();
	const isPreview = (window as any).__STUDIO_PREVIEW_MODE__;
	const effectiveCount = isPreview ? Math.min(count, 2) : count;
	const effectiveBlur = isPreview ? Math.round(blurAmount * 0.6) : blurAmount;
	const orbs = Array.from({ length: Math.min(effectiveCount, 5) }, (_, i) => {
		const color = colors[i % colors.length];
		const phase = (i * Math.PI * 2) / count;
		const x = 30 + Math.sin(frame * speed + phase) * 25;
		const y = 30 + Math.cos(frame * speed * 0.7 + phase) * 20;
		const size = 300 + i * 80;
		return (
			<div
				key={i}
				style={{
					position: "absolute",
					left: `${x}%`,
					top: `${y}%`,
					width: size,
					height: size,
					borderRadius: "50%",
					background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
					opacity,
					filter: `blur(${effectiveBlur}px)`,
					transform: "translate(-50%, -50%)",
				}}
			/>
		);
	});

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
			{orbs}
		</div>
	);
};

// ── IconGrid ───────────────────────────────────────────────────────────

/** Sequential pop-in grid of feature icons/emoji */
export const IconGrid: React.FC<{
	items: Array<{ icon: string; label: string }>;
	columns?: number;
	iconSize?: number;
	color?: string;
	delay?: number;
	gap?: number;
}> = ({ items, columns = 3, iconSize = 48, color = "#ffffff", delay = 0, gap = 32 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localFrame = Math.max(0, frame - delay);

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${columns}, auto)`,
				gap,
				justifyContent: "center",
			}}
		>
			{items.slice(0, 9).map((item, i) => {
				const itemDelay = i * 5;
				const progress = spring({
					frame: Math.max(0, localFrame - itemDelay),
					fps,
					config: { damping: 10, stiffness: 200, mass: 0.6 },
				});
				return (
					<div
						key={i}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 8,
							opacity: progress,
							transform: `scale(${0.5 + progress * 0.5}) translateY(${(1 - progress) * 20}px)`,
						}}
					>
						<span style={{ fontSize: iconSize }}>{item.icon}</span>
						<span
							style={{
								fontSize: Math.max(16, Math.round(iconSize * 0.4)),
								fontFamily: "'Inter', sans-serif",
								fontWeight: 600,
								color,
								opacity: 0.8,
								textAlign: "center",
								maxWidth: Math.max(120, iconSize * 3),
							}}
						>
							{item.label}
						</span>
					</div>
				);
			})}
		</div>
	);
};

// ── Divider ────────────────────────────────────────────────────────────

/** Animated horizontal line reveal */
export const Divider: React.FC<{
	color?: string;
	width?: number;
	thickness?: number;
	delay?: number;
}> = ({ color = "rgba(255,255,255,0.2)", width = 200, thickness = 2, delay = 0 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 20, stiffness: 100 },
	});

	return (
		<div
			style={{
				width,
				height: thickness,
				backgroundColor: color,
				transformOrigin: "center",
				transform: `scaleX(${progress})`,
				opacity: progress,
				borderRadius: thickness / 2,
			}}
		/>
	);
};

// ═══════════════════════════════════════════════════════════════════════
// AnimatedBackground — animated backdrop options for any scene
// ═══════════════════════════════════════════════════════════════════════
//
// Drop this INSIDE a Scene as the first child to get an animated background
// layer that complements the base color. Variants:
//   - "flowing-lines": soft curved lines sweeping across (Numtera intro style)
//   - "drifting-orbs": large blurred color orbs slowly moving around
//   - "mesh-shift": soft multi-color gradient mesh that shifts hue over time
//   - "particle-field": tiny bright particles drifting upward
//   - "grain": subtle animated grain/noise overlay
//   - "pulse-grid": geometric grid pattern that pulses
//   - "aurora": flowing aurora-like color gradients

type BackgroundVariant =
	| "flowing-lines"
	| "drifting-orbs"
	| "mesh-shift"
	| "particle-field"
	| "grain"
	| "pulse-grid"
	| "aurora"
	| "spotlight"
	| "wave-grid"
	| "gradient-wipe"
	| "bokeh"
	| "liquid-glass"
	| "confetti"
	| "snow"
	| "fireflies"
	| "sakura"
	| "sparks"
	| "perspective-grid"
	| "flowing-gradient"
	| "money-rain"
	| "mist"
	| "light-rays"
	| "bubbles"
	| "embers"
	| "stars"
	| "none";

export const AnimatedBackground: React.FC<{
	variant: BackgroundVariant;
	colors?: string[];
	intensity?: number;
}> = ({ variant, colors = ["#2563eb", "#7c3aed", "#06b6d4", "#ec4899"], intensity = 1 }) => {
	const frame = useCurrentFrame();
	const isPreview = (window as any).__STUDIO_PREVIEW_MODE__;
	if (isPreview) intensity = Math.min(intensity, 0.4);

	if (variant === "none") return null;

	if (variant === "flowing-lines") {
		// Soft curved SVG lines sweeping across the frame
		return (
			<AbsoluteFill style={{ pointerEvents: "none" }}>
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 1920 1080"
					preserveAspectRatio="none"
					style={{ position: "absolute", inset: 0 }}
				>
					{[0, 1, 2, 3, 4].map((i) => {
						const phase = (frame + i * 30) * 0.015;
						const y1 = 200 + i * 140 + Math.sin(phase) * 60;
						const y2 = 400 + i * 100 + Math.cos(phase * 1.1) * 80;
						const color = colors[i % colors.length];
						return (
							<path
								key={i}
								d={`M 0 ${y1} Q 480 ${y1 - 120} 960 ${y1 + 30} T 1920 ${y2}`}
								stroke={color}
								strokeWidth={3 * intensity}
								fill="none"
								opacity={0.4 * intensity}
							/>
						);
					})}
				</svg>
			</AbsoluteFill>
		);
	}

	if (variant === "drifting-orbs") {
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				{[0, 1, 2, 3].map((i) => {
					const color = colors[i % colors.length];
					const x = 20 + i * 25 + Math.sin((frame + i * 50) * 0.008) * 20;
					const y = 25 + Math.cos((frame + i * 70) * 0.01) * 30;
					const size = 400 + i * 80;
					return (
						<div
							key={i}
							style={{
								position: "absolute",
								left: `${x}%`,
								top: `${y}%`,
								width: size,
								height: size,
								borderRadius: "50%",
								background: `radial-gradient(circle, ${color}60 0%, transparent 70%)`,
								filter: `blur(${80 * intensity}px)`,
								transform: "translate(-50%, -50%)",
								opacity: 0.6 * intensity,
							}}
						/>
					);
				})}
			</AbsoluteFill>
		);
	}

	if (variant === "mesh-shift") {
		const shift = frame * 0.2;
		const g1 = `radial-gradient(ellipse at ${25 + Math.sin(shift * 0.01) * 15}% ${30 + Math.cos(shift * 0.012) * 10}%, ${colors[0]}aa 0%, transparent 55%)`;
		const g2 = `radial-gradient(ellipse at ${75 + Math.cos(shift * 0.009) * 15}% ${25 + Math.sin(shift * 0.011) * 12}%, ${colors[1] || colors[0]}aa 0%, transparent 55%)`;
		const g3 = `radial-gradient(ellipse at ${30 + Math.sin(shift * 0.008) * 18}% ${75 + Math.cos(shift * 0.013) * 12}%, ${colors[2] || colors[0]}aa 0%, transparent 55%)`;
		const g4 = `radial-gradient(ellipse at ${75 + Math.sin(shift * 0.01) * 15}% ${75 + Math.cos(shift * 0.009) * 10}%, ${colors[3] || colors[1] || colors[0]}aa 0%, transparent 55%)`;
		return (
			<AbsoluteFill
				style={{
					background: `${g1}, ${g2}, ${g3}, ${g4}`,
					opacity: intensity,
					pointerEvents: "none",
				}}
			/>
		);
	}

	if (variant === "particle-field") {
		const particles = Array.from({ length: 40 }, (_, i) => {
			const seed = i * 9301 + 49297;
			const xBase = seed % 100;
			const yBase = (seed >> 3) % 100;
			const drift = Math.sin((frame + i * 3) * 0.02) * 3;
			const riseSpeed = 0.3 + ((seed >> 5) % 10) / 30;
			const y = (yBase - (frame * riseSpeed) / 10 + 200) % 120;
			const size = 2 + ((seed >> 7) % 4);
			return { x: xBase + drift, y, size, color: colors[i % colors.length] };
		});
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				{particles.map((p, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${p.x}%`,
							top: `${p.y}%`,
							width: p.size,
							height: p.size,
							borderRadius: "50%",
							background: p.color,
							boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
							opacity: 0.7 * intensity,
						}}
					/>
				))}
			</AbsoluteFill>
		);
	}

	if (variant === "grain") {
		// SVG turbulence filter for animated grain
		return (
			<AbsoluteFill
				style={{ pointerEvents: "none", opacity: 0.08 * intensity, mixBlendMode: "overlay" }}
			>
				<svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
					<filter id={`grain-${frame % 5}`}>
						<feTurbulence type="fractalNoise" baseFrequency="0.9" seed={frame} />
						<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
					</filter>
					<rect width="100%" height="100%" filter={`url(#grain-${frame % 5})`} />
				</svg>
			</AbsoluteFill>
		);
	}

	if (variant === "pulse-grid") {
		const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
		return (
			<AbsoluteFill style={{ pointerEvents: "none" }}>
				<svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="none">
					<defs>
						<pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
							<path
								d="M 80 0 L 0 0 0 80"
								fill="none"
								stroke={colors[0]}
								strokeWidth="1"
								opacity={pulse * 0.5 * intensity}
							/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#grid)" />
				</svg>
			</AbsoluteFill>
		);
	}

	if (variant === "aurora") {
		const shift = frame * 0.3;
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				<div
					style={{
						position: "absolute",
						inset: "-50%",
						background: `conic-gradient(from ${shift}deg at 50% 50%, ${colors[0]}40 0deg, ${colors[1]}40 90deg, ${colors[2]}40 180deg, ${colors[3] || colors[0]}40 270deg, ${colors[0]}40 360deg)`,
						filter: `blur(100px)`,
						opacity: 0.7 * intensity,
					}}
				/>
			</AbsoluteFill>
		);
	}

	if (variant === "spotlight") {
		// Dramatic spotlight cone that drifts across the frame
		const x = 40 + Math.sin(frame * 0.012) * 25;
		const y = 35 + Math.cos(frame * 0.015) * 20;
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: `radial-gradient(ellipse at ${x}% ${y}%, ${colors[0]}50 0%, ${colors[0]}15 30%, transparent 65%)`,
						opacity: intensity,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: `radial-gradient(ellipse at ${100 - x}% ${100 - y}%, ${colors[1] || colors[0]}30 0%, transparent 50%)`,
						opacity: intensity * 0.5,
					}}
				/>
			</AbsoluteFill>
		);
	}

	if (variant === "wave-grid") {
		// Animated 3D-perspective wave grid (Tron/retro feel)
		const lines = 12;
		const cols = 20;
		return (
			<AbsoluteFill style={{ pointerEvents: "none", perspective: 600, overflow: "hidden" }}>
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 1920 1080"
					preserveAspectRatio="none"
					style={{ position: "absolute", inset: 0, transform: "rotateX(55deg) translateY(30%)" }}
				>
					{Array.from({ length: lines }, (_, row) => {
						const y = (row / lines) * 1080;
						const pts = Array.from({ length: cols + 1 }, (_, col) => {
							const x = (col / cols) * 1920;
							const wave = Math.sin(x / 200 + frame * 0.06 + row * 0.5) * 25;
							return `${x},${y + wave}`;
						}).join(" ");
						return (
							<polyline
								key={row}
								points={pts}
								fill="none"
								stroke={colors[row % colors.length]}
								strokeWidth={1.5}
								opacity={0.3 * intensity}
							/>
						);
					})}
					{Array.from({ length: cols + 1 }, (_, col) => {
						const x = (col / cols) * 1920;
						return (
							<line
								key={`v${col}`}
								x1={x}
								y1={0}
								x2={x}
								y2={1080}
								stroke={colors[0]}
								strokeWidth={0.8}
								opacity={0.15 * intensity}
							/>
						);
					})}
				</svg>
			</AbsoluteFill>
		);
	}

	if (variant === "gradient-wipe") {
		// Smooth animated gradient band that sweeps diagonally across the frame
		const angle = 135 + Math.sin(frame * 0.008) * 15;
		const pos = ((frame * 0.4) % 200) - 50;
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				<div
					style={{
						position: "absolute",
						inset: "-20%",
						background: `linear-gradient(${angle}deg, transparent ${pos}%, ${colors[0]}35 ${pos + 15}%, ${colors[1] || colors[0]}25 ${pos + 30}%, transparent ${pos + 50}%)`,
						opacity: intensity,
					}}
				/>
			</AbsoluteFill>
		);
	}

	if (variant === "bokeh") {
		// Soft out-of-focus circles drifting (cinematic bokeh)
		const circles = Array.from({ length: 15 }, (_, i) => {
			const seed = i * 7919 + 104729;
			const size = 40 + (seed % 120);
			const x = (seed % 100) + Math.sin((frame + i * 40) * 0.01) * 8;
			const y = ((seed >> 4) % 100) + Math.cos((frame + i * 55) * 0.008) * 6;
			return { x, y, size, color: colors[i % colors.length] };
		});
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				{circles.map((c, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${c.x}%`,
							top: `${c.y}%`,
							width: c.size,
							height: c.size,
							borderRadius: "50%",
							border: `2px solid ${c.color}30`,
							background: `radial-gradient(circle, ${c.color}18 0%, ${c.color}05 60%, transparent 100%)`,
							transform: "translate(-50%, -50%)",
							opacity: 0.7 * intensity,
						}}
					/>
				))}
			</AbsoluteFill>
		);
	}

	if (variant === "liquid-glass") {
		// Morphing blobs that create a frosted glass / lava lamp feel
		const t = frame * 0.015;
		const blobs = [0, 1, 2].map((i) => {
			const cx = 30 + i * 25 + Math.sin(t + i * 2.1) * 20;
			const cy = 40 + Math.cos(t * 0.8 + i * 1.7) * 25;
			const rx = 250 + Math.sin(t * 1.2 + i) * 80;
			const ry = 200 + Math.cos(t * 0.9 + i * 2) * 60;
			const rotate = Math.sin(t * 0.5 + i * 3) * 30;
			return { cx, cy, rx, ry, rotate, color: colors[i % colors.length] };
		});
		return (
			<AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
				{blobs.map((b, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${b.cx}%`,
							top: `${b.cy}%`,
							width: b.rx * 2,
							height: b.ry * 2,
							borderRadius: "40% 60% 55% 45% / 50% 40% 60% 50%",
							background: `radial-gradient(ellipse, ${b.color}40 0%, ${b.color}10 50%, transparent 80%)`,
							filter: `blur(${60 * intensity}px)`,
							transform: `translate(-50%, -50%) rotate(${b.rotate}deg)`,
							opacity: 0.8 * intensity,
						}}
					/>
				))}
			</AbsoluteFill>
		);
	}

	// ── Particle effects (from ParticleEffects.tsx) ──
	if (variant === "confetti") return <Confetti colors={colors} intensity={intensity} />;
	if (variant === "snow") return <Snow intensity={intensity} />;
	if (variant === "fireflies") return <Fireflies color={colors[0]} intensity={intensity} />;
	if (variant === "sakura") return <Sakura intensity={intensity} />;
	if (variant === "sparks") return <Sparks color={colors[0]} intensity={intensity} />;
	if (variant === "money-rain") return <MoneyRain colors={colors} intensity={intensity} />;
	if (variant === "perspective-grid")
		return <PerspectiveGrid color={colors[0]} intensity={intensity} />;
	if (variant === "flowing-gradient") return <FlowingGradient colors={colors} />;

	// Animation engine particles
	if (variant === "mist") return <Mist color={colors[0]} intensity={intensity} />;
	if (variant === "light-rays") return <LightRays color={colors[0]} intensity={intensity} />;
	if (variant === "bubbles") return <Bubbles color={colors[0]} intensity={intensity} />;
	if (variant === "embers") return <Embers colors={colors} intensity={intensity} />;
	if (variant === "stars") return <Stars color={colors[0]} intensity={intensity} />;

	return null;
};

// ═══════════════════════════════════════════════════════════════════════
// CameraText — the "Numtera" text-in-camera-space animation
// ═══════════════════════════════════════════════════════════════════════
//
// Treats text as a 3D object the camera flies through. Supports:
//   - Words appearing at specific frames with typewriter reveal
//   - Camera keyframes for scale + translate with spring interpolation
//   - Motion blur tied to scale change rate (blurs during fast zooms)
//   - Inline logo slots (using isLogo word type)
//
// Use this as ONE scene that spans what would otherwise be 4-8 simple scenes.
// Example: opening brand reveal with "Meet [logo] Numtera" → "The AI-powered..."

export type CameraTextWord = {
	text: string;
	/** Frame within the scene when this word starts appearing */
	appearsAt: number;
	color?: string;
	isLogo?: boolean;
	/** Content if isLogo=true — typically emoji or single char */
	logoContent?: string;
	logoColor?: string;
};

export type CameraKey = {
	frame: number;
	scale?: number;
	translateX?: number;
	translateY?: number;
};

// Detect if a CSS color or gradient string is dark (for auto-contrast text)
const isBgDark = (bg: string): boolean => {
	const hexMatch = bg.match(/#([0-9a-fA-F]{3,8})/);
	if (!hexMatch) return false;
	let hex = hexMatch[1];
	if (hex.length === 3)
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	if (hex.length < 6) return false;
	const r = Number.parseInt(hex.slice(0, 2), 16);
	const g = Number.parseInt(hex.slice(2, 4), 16);
	const b = Number.parseInt(hex.slice(4, 6), 16);
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

export const CameraText: React.FC<{
	words: CameraTextWord[];
	camera: CameraKey[];
	fontSize?: number;
	fontFamily?: string;
	baseColor?: string;
	bg?: string;
	gap?: number;
	/** Typewriter reveal speed — frames per character (default 1.2) */
	typewriterSpeed?: number;
}> = ({
	words,
	camera,
	fontSize = 180,
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	baseColor,
	bg = "linear-gradient(135deg, #f0f9ff 0%, #dbeafe 50%, #bfdbfe 100%)",
	gap = 0.3,
	typewriterSpeed = 1.2,
}) => {
	// Auto-detect text color based on bg luminance if not explicitly set
	const resolvedBaseColor = baseColor ?? (isBgDark(bg) ? "#ffffff" : "#1a1a1a");
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Sort camera keyframes by frame
	const keys = [...camera].sort((a, b) => a.frame - b.frame);
	if (keys.length === 0) return null;

	// Find current and next keyframe
	let currentKey = keys[0];
	let nextKey = keys[keys.length - 1];
	for (let i = 0; i < keys.length - 1; i++) {
		if (keys[i].frame <= frame && keys[i + 1].frame > frame) {
			currentKey = keys[i];
			nextKey = keys[i + 1];
			break;
		}
	}
	if (frame >= keys[keys.length - 1].frame) {
		currentKey = keys[keys.length - 1];
		nextKey = currentKey;
	}

	// Spring-eased interpolation between keys
	const keyDuration = Math.max(1, nextKey.frame - currentKey.frame);
	const localFrame = Math.max(0, frame - currentKey.frame);
	const eased = spring({
		frame: localFrame,
		fps,
		durationInFrames: keyDuration,
		config: { damping: 22, stiffness: 70, mass: 1.2 },
	});

	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	// Clamp scale to sane range (0.2 - 2.5) to prevent unreadable overflow/blur
	const rawScale = lerp(currentKey.scale ?? 1, nextKey.scale ?? 1, eased);
	const scale = Math.max(0.2, Math.min(2.5, rawScale));
	const translateX = lerp(currentKey.translateX ?? 0, nextKey.translateX ?? 0, eased);
	const translateY = lerp(currentKey.translateY ?? 0, nextKey.translateY ?? 0, eased);

	// Motion blur tied to scale change rate. Cap aggressively so text stays readable —
	// previous version caused entire scenes to be blurry when keyframes were close together.
	const scaleDelta = Math.abs((nextKey.scale ?? 1) - (currentKey.scale ?? 1));
	// Only apply blur during the mid-50% of a transition; no blur near keyframes
	const midpointBoost = Math.max(0, 1 - Math.abs(eased - 0.5) * 2.5);
	const motionBlur = Math.min(6, scaleDelta * 3 * midpointBoost);

	return (
		<AbsoluteFill
			style={{
				background: bg,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					fontSize,
					fontWeight: 900,
					fontFamily,
					letterSpacing: "-0.04em",
					lineHeight: 1,
					transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
					transformOrigin: "center center",
					filter: motionBlur > 0.2 ? `blur(${motionBlur}px)` : undefined,
					display: "flex",
					alignItems: "center",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: `${gap}em`,
					willChange: "transform, filter",
					maxWidth: 1600,
				}}
			>
				{words.map((word, i) => {
					const wordAge = frame - word.appearsAt;
					// Check if this word forces a line break (text ends with \n)
					const hasLineBreak = word.text.endsWith("\n") || word.text.endsWith("\\n");
					const cleanText = word.text.replace(/\\?n$/, "");
					if (wordAge < 0) return null;

					if (word.isLogo) {
						// Logo: spring in, no typewriter
						const logoProgress = spring({
							frame: wordAge,
							fps,
							config: { damping: 12, stiffness: 180 },
						});
						return (
							<React.Fragment key={i}>
								<span
									style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										width: `${fontSize * 0.9}px`,
										height: `${fontSize * 0.9}px`,
										borderRadius: `${fontSize * 0.18}px`,
										background: word.logoColor || word.color || "#2563eb",
										color: "#ffffff",
										fontSize: `${fontSize * 0.55}px`,
										fontWeight: 900,
										opacity: logoProgress,
										transform: `scale(${0.3 + logoProgress * 0.7})`,
										boxShadow: `0 ${fontSize * 0.04}px ${fontSize * 0.12}px rgba(37,99,235,0.3)`,
										flexShrink: 0,
									}}
								>
									{word.logoContent || cleanText || "●"}
								</span>
								{hasLineBreak && <div style={{ width: "100%", height: 0 }} />}
							</React.Fragment>
						);
					}

					// Word: typewriter reveal + opacity fade-in
					const charsVisible = Math.min(
						cleanText.length,
						Math.max(0, Math.floor(wordAge / typewriterSpeed) + 1),
					);
					const opacity = Math.min(1, wordAge / 5);
					const displayText = cleanText.slice(0, charsVisible);

					return (
						<React.Fragment key={i}>
							<span
								style={{
									display: "inline-block",
									color: word.color || resolvedBaseColor,
									opacity,
									whiteSpace: "nowrap",
								}}
							>
								{displayText}
							</span>
							{hasLineBreak && <div style={{ width: "100%", height: 0 }} />}
						</React.Fragment>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

// ═══════════════════════════════════════════════════════════════════════
// Cinematic Zoom Morph Transition
// ═══════════════════════════════════════════════════════════════════════
//
// A Remotion TransitionPresentation that zooms THROUGH the outgoing scene
// into the incoming scene. The outgoing scene scales from 1x → 15x while
// fading out, while the incoming scene scales from 0.2x → 1x while fading in.
// Creates the illusion that the camera is flying into the current frame.
//
// Usage with TransitionSeries:
//   <TransitionSeries.Transition
//     presentation={zoomMorph()}
//     timing={linearTiming({ durationInFrames: 18 })}
//   />
//
// Perfect for "Smart Zoom" → next scene style transitions where the viewer
// feels like they're falling into the previous scene's text.

type ZoomMorphProps = {
	focalX?: number; // 0-1, horizontal focal point (default 0.5 = center)
	focalY?: number; // 0-1, vertical focal point (default 0.5 = center)
	maxScale?: number; // peak scale of the exiting scene (default 15)
};

const ZoomMorphPresentation: React.FC<{
	passedProps: ZoomMorphProps;
	presentationDirection: "entering" | "exiting";
	presentationProgress: number;
	children: React.ReactNode;
}> = ({ passedProps, presentationDirection, presentationProgress: progress, children }) => {
	const focalX = passedProps.focalX ?? 0.5;
	const focalY = passedProps.focalY ?? 0.5;
	const maxScale = passedProps.maxScale ?? 15;

	const style: React.CSSProperties = {
		width: "100%",
		height: "100%",
		transformOrigin: `${focalX * 100}% ${focalY * 100}%`,
	};

	if (presentationDirection === "exiting") {
		// Outgoing scene: scale from 1 → maxScale, opacity 1 → 0
		const scale = 1 + (maxScale - 1) * progress;
		const opacity = 1 - progress;
		style.transform = `scale(${scale})`;
		style.opacity = opacity;
	} else {
		// Incoming scene: scale from 0.2 → 1, opacity 0 → 1
		const scale = 0.2 + 0.8 * progress;
		const opacity = progress;
		style.transform = `scale(${scale})`;
		style.opacity = opacity;
	}

	return <div style={style}>{children}</div>;
};

/**
 * Zoom morph transition presentation. Creates a "fly into the text" effect
 * where the outgoing scene scales up dramatically while the incoming scene
 * scales in from small, making the viewer feel like they're falling into
 * the previous scene.
 *
 * Pair with an IMPACT scene that has one massive word (e.g. "Smart Zoom.")
 * and the next scene will feel like it emerged FROM inside that text.
 */
export const zoomMorph = (props: ZoomMorphProps = {}) => ({
	component: ZoomMorphPresentation,
	props,
});

// ═══════════════════════════════════════════════════════════════════════
// TIER 1: Extracted from video analysis (Lovable, PostSyncer, Framer, etc.)
// ═══════════════════════════════════════════════════════════════════════

// ── NotificationCloud ──────────────────────────────────────────────────

type PlatformKey = "instagram" | "linkedin" | "twitter" | "youtube" | "email" | "slack" | "generic";

/**
 * Scattered recreated notification cards around a central claim.
 * THE pattern for "overwhelm / notifications everywhere" problem scenes.
 * Extracted from PostSyncer's hero problem scene.
 */
export const NotificationCloud: React.FC<{
	notifications: Array<{
		platform: PlatformKey;
		title: string;
		subtitle?: string;
		time?: string;
		avatar?: string;
	}>;
	children?: React.ReactNode;
	bg?: string;
}> = ({ notifications, children, bg }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Deterministic scattered positions (all around the central text)
	const positions = [
		{ x: 18, y: 18, rot: -7 },
		{ x: 52, y: 12, rot: 3 },
		{ x: 82, y: 22, rot: 6 },
		{ x: 88, y: 70, rot: -4 },
		{ x: 62, y: 86, rot: 5 },
		{ x: 18, y: 82, rot: -6 },
		{ x: 10, y: 50, rot: 2 },
		{ x: 82, y: 50, rot: -3 },
	];

	const platformStyles: Record<PlatformKey, { icon: string; color: string; bg: string }> = {
		instagram: { icon: "📸", color: "#E1306C", bg: "#fff" },
		linkedin: { icon: "in", color: "#0077B5", bg: "#fff" },
		twitter: { icon: "𝕏", color: "#000", bg: "#fff" },
		youtube: { icon: "▶", color: "#FF0000", bg: "#fff" },
		email: { icon: "✉", color: "#4285F4", bg: "#fff" },
		slack: { icon: "#", color: "#4A154B", bg: "#fff" },
		generic: { icon: "●", color: "#666", bg: "#fff" },
	};

	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				background: bg || "#0a0a0a",
			}}
		>
			{notifications.slice(0, 8).map((notif, i) => {
				const pos = positions[i % positions.length];
				const delay = i * 4;
				const progress = spring({
					frame: Math.max(0, frame - delay),
					fps,
					config: { damping: 13, stiffness: 160 },
				});
				const style = platformStyles[notif.platform] || platformStyles.generic;
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${pos.x}%`,
							top: `${pos.y}%`,
							width: 320,
							transform: `translate(-50%, -50%) rotate(${pos.rot}deg) scale(${progress})`,
							opacity: progress,
							background: style.bg,
							borderRadius: 14,
							padding: "12px 14px",
							boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
							display: "flex",
							gap: 10,
							alignItems: "flex-start",
							fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
						}}
					>
						<div
							style={{
								width: 32,
								height: 32,
								borderRadius: 8,
								background: style.color,
								color: "#fff",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 18,
								fontWeight: 700,
								flexShrink: 0,
							}}
						>
							{style.icon}
						</div>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div
								style={{
									fontSize: 14,
									fontWeight: 700,
									color: "#1a1a1a",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{notif.title}
							</div>
							{notif.subtitle && (
								<div
									style={{
										fontSize: 12,
										color: "#666",
										marginTop: 2,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{notif.subtitle}
								</div>
							)}
						</div>
						{notif.time && (
							<div style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>{notif.time}</div>
						)}
					</div>
				);
			})}
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					zIndex: 20,
					pointerEvents: "none",
				}}
			>
				{children}
			</div>
		</div>
	);
};

// ── ChatMessageFlow ────────────────────────────────────────────────────

/**
 * Progressive chat UI with messages appearing over time. Slack-like dark interface.
 * Extracted from Viktor's "your last hire" video.
 */
export const ChatMessageFlow: React.FC<{
	messages: Array<{ user: string; text: string; time?: string; avatar?: string; color?: string }>;
	channel?: string;
	channels?: string[];
	users?: string[];
	messageDelay?: number;
	bg?: string;
}> = ({
	messages,
	channel = "general",
	channels = ["general", "marketing", "engineering", "sales"],
	users = [],
	messageDelay = 30,
	bg = "#1a0d1f",
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const avatarColors = [
		"#ef4444",
		"#f59e0b",
		"#10b981",
		"#3b82f6",
		"#8b5cf6",
		"#ec4899",
		"#14b8a6",
	];

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: bg,
				display: "flex",
				fontFamily: "'Inter', sans-serif",
				color: "#fff",
				borderRadius: 16,
				overflow: "hidden",
				border: "1px solid rgba(255,255,255,0.08)",
			}}
		>
			{/* Sidebar */}
			<div
				style={{
					width: 220,
					padding: "24px 16px",
					background: "rgba(0,0,0,0.3)",
					borderRight: "1px solid rgba(255,255,255,0.05)",
				}}
			>
				<div style={{ fontSize: 13, fontWeight: 700, opacity: 0.6, marginBottom: 12 }}>
					Channels
				</div>
				{channels.map((ch) => (
					<div
						key={ch}
						style={{
							padding: "6px 8px",
							borderRadius: 6,
							fontSize: 15,
							opacity: ch === channel ? 1 : 0.6,
							background: ch === channel ? "rgba(255,255,255,0.1)" : "transparent",
							marginBottom: 2,
						}}
					>
						# {ch}
					</div>
				))}
				{users.length > 0 && (
					<>
						<div
							style={{
								fontSize: 13,
								fontWeight: 700,
								opacity: 0.6,
								marginTop: 20,
								marginBottom: 12,
							}}
						>
							Direct messages
						</div>
						{users.map((u, i) => (
							<div
								key={u}
								style={{
									padding: "6px 8px",
									fontSize: 15,
									opacity: 0.7,
									display: "flex",
									alignItems: "center",
									gap: 8,
								}}
							>
								<div
									style={{
										width: 20,
										height: 20,
										borderRadius: 4,
										background: avatarColors[i % avatarColors.length],
										flexShrink: 0,
									}}
								/>
								{u}
							</div>
						))}
					</>
				)}
			</div>
			{/* Main */}
			<div
				style={{
					flex: 1,
					padding: 32,
					display: "flex",
					flexDirection: "column",
					gap: 20,
					overflow: "hidden",
				}}
			>
				{messages.map((msg, i) => {
					const showFrame = i * messageDelay;
					const progress = spring({
						frame: Math.max(0, frame - showFrame),
						fps,
						config: { damping: 16, stiffness: 180 },
					});
					if (progress < 0.05) return null;
					return (
						<div
							key={i}
							style={{
								display: "flex",
								gap: 14,
								opacity: progress,
								transform: `translateY(${(1 - progress) * 12}px)`,
							}}
						>
							<div
								style={{
									width: 40,
									height: 40,
									borderRadius: 8,
									background: msg.color || avatarColors[i % avatarColors.length],
									flexShrink: 0,
								}}
							/>
							<div style={{ flex: 1 }}>
								<div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
									<span style={{ fontSize: 18, fontWeight: 700 }}>{msg.user}</span>
									{msg.time && <span style={{ fontSize: 13, opacity: 0.5 }}>{msg.time}</span>}
								</div>
								<div style={{ fontSize: 18, marginTop: 4, lineHeight: 1.4 }}>{msg.text}</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

// ── BackgroundVideo ────────────────────────────────────────────────────

/**
 * Background video for AI-generated clips. Uses a plain <video> element
 * that plays from mount and only seeks when scrubbing (large frame jumps).
 * Does NOT try to sync every frame — lets the browser play naturally.
 */
export const BackgroundVideo: React.FC<{
	src: string;
	onError?: () => void;
}> = ({ src, onError }) => {
	const videoRef = React.useRef<HTMLVideoElement>(null);
	const playingRef = React.useRef(false);
	const [hasError, setHasError] = React.useState(false);
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Start playing on mount, seek only on large jumps (scrubbing)
	React.useEffect(() => {
		const video = videoRef.current;
		if (!video || hasError) return;
		const targetTime = frame / fps;

		if (!playingRef.current) {
			// First mount — start from beginning
			video.currentTime = 0;
			video
				.play()
				.then(() => {
					playingRef.current = true;
				})
				.catch(() => {});
			return;
		}

		// Only seek if the video drifts more than 1.5s from where it should be
		// This handles scrubbing/jumping without interfering with smooth playback
		const drift = Math.abs(video.currentTime - targetTime);
		if (drift > 1.5) {
			video.currentTime = targetTime;
			if (video.paused) video.play().catch(() => {});
		}
	});

	// Reset when sequence restarts
	React.useEffect(() => {
		return () => {
			playingRef.current = false;
		};
	}, []);

	if (hasError) return null;

	return (
		<video
			ref={videoRef}
			src={src}
			muted
			playsInline
			onError={() => {
				setHasError(true);
				onError?.();
			}}
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				objectFit: "cover",
			}}
		/>
	);
};

// ── ButtonPill ─────────────────────────────────────────────────────────

/**
 * Animated button component with multiple animation styles.
 * - none: static pill button
 * - racing-border: glowing border traces clockwise around the button
 * - pulse: subtle scale pulse loop
 * - glow-pulse: box-shadow intensity pulses
 * - slide-in: button slides up with spring
 */
export const ButtonPill: React.FC<{
	text?: string;
	fontSize?: number;
	bgColor?: string;
	textColor?: string;
	borderColor?: string;
	borderRadius?: number;
	animation?: "none" | "racing-border" | "pulse" | "glow-pulse" | "slide-in";
	delay?: number;
}> = ({
	text = "Get Started",
	fontSize = 26,
	bgColor = "#2563eb",
	textColor = "#ffffff",
	borderColor,
	borderRadius = 50,
	animation = "none",
	delay = 0,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localFrame = Math.max(0, frame - delay);

	const padY = Math.round(fontSize * 0.55);
	const padX = Math.round(fontSize * 1.7);

	// Slide-in entrance
	const entrance =
		animation === "slide-in"
			? spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 120 } })
			: 1;
	const translateY = animation === "slide-in" ? (1 - entrance) * 40 : 0;
	const opacity = animation === "slide-in" ? entrance : 1;

	// Pulse scale
	const pulseScale = animation === "pulse" ? 1 + Math.sin(localFrame * 0.08) * 0.03 : 1;

	// Glow pulse
	const glowIntensity = animation === "glow-pulse" ? 30 + Math.sin(localFrame * 0.1) * 20 : 30;

	// Racing border: a conic-gradient that rotates
	const racingAngle = (localFrame * 4) % 360;
	const racingBorder = animation === "racing-border";
	const effectiveBC = borderColor || bgColor;

	return (
		<div
			style={{
				position: "relative",
				display: "inline-block",
				transform: `translateY(${translateY}px) scale(${pulseScale})`,
				opacity,
			}}
		>
			{racingBorder && (
				<div
					style={{
						position: "absolute",
						inset: -3,
						borderRadius: borderRadius + 3,
						background: `conic-gradient(from ${racingAngle}deg, transparent 0%, ${effectiveBC} 25%, transparent 50%)`,
						zIndex: 0,
						filter: `blur(1px)`,
					}}
				/>
			)}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					padding: `${padY}px ${padX}px`,
					borderRadius,
					background: bgColor,
					color: textColor,
					fontSize,
					fontWeight: 700,
					fontFamily: "'Inter', sans-serif",
					boxShadow: `0 8px ${glowIntensity}px ${bgColor}40`,
					letterSpacing: "-0.01em",
					textAlign: "center",
					...(borderColor && !racingBorder ? { border: `2px solid ${borderColor}` } : {}),
				}}
			>
				{text}
			</div>
		</div>
	);
};

// ── StackedText ────────────────────────────────────────────────────────

/**
 * Multi-line text with dramatic size hierarchy.
 * Extracted from PostSyncer ("WHY SETTLE / FOR / LESS") — key word is MASSIVE.
 */
export const StackedText: React.FC<{
	lines: Array<{
		text: string;
		size: number;
		weight?: number;
		color?: string;
		spacingAfter?: number;
		accentWord?: string;
		accentColor?: string;
	}>;
	color?: string;
	fontFamily?: string;
	gap?: number;
	align?: "center" | "left" | "right";
	/**
	 * Animation style:
	 * - scroll-up: each line slides up from below (+80 → 0), PRONOUNCED stagger. Lines stay visible.
	 * - drop: each line drops from above (-40 → 0), medium stagger
	 * - scale: each line scales up (0.85 → 1), subtle
	 * - typewriter: each line types in char-by-char after the previous finishes
	 * - none: all visible immediately
	 */
	animation?: "scroll-up" | "drop" | "scale" | "typewriter" | "none";
	/** Frames between each line's animation start (default 14 — pronounced stagger) */
	stagger?: number;
}> = ({
	lines,
	color = "#050505",
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	gap = 12,
	align = "center",
	animation = "scroll-up",
	stagger = 14,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
				gap,
				fontFamily,
				color,
				letterSpacing: "-0.04em",
				lineHeight: 0.95,
			}}
		>
			{lines.map((line, i) => {
				const delay = i * stagger;
				const localFrame = Math.max(0, frame - delay);
				const progress = spring({
					frame: localFrame,
					fps,
					config: { damping: 16, stiffness: 140, mass: 1 },
				});

				// Typewriter mode — reveal characters sequentially
				if (animation === "typewriter") {
					const charsPerFrame = 0.6;
					const visibleChars = Math.min(line.text.length, Math.floor(localFrame * charsPerFrame));
					return (
						<div
							key={i}
							style={{
								fontSize: line.size,
								fontWeight: line.weight ?? 900,
								color: line.color || color,
								whiteSpace: "nowrap",
								minHeight: line.size,
							}}
						>
							{line.text.slice(0, visibleChars)}
						</div>
					);
				}

				// Other modes use transform + opacity
				let translateY = 0;
				let scale = 1;
				if (animation === "scroll-up") {
					translateY = (1 - progress) * 80; // slide up from 80px below
				} else if (animation === "drop") {
					translateY = (1 - progress) * -40; // drop from 40px above
				} else if (animation === "scale") {
					scale = 0.85 + progress * 0.15;
				}
				const lineContent = line.accentWord
					? line.text.split(/\s+/).map((word, wi) => {
							const isAccent = line
								.accentWord!.toLowerCase()
								.split(/\s+/)
								.some(
									(aw) =>
										word.replace(/[^\w]/g, "").toLowerCase() ===
										aw.replace(/[^\w]/g, "").toLowerCase(),
								);
							return (
								<React.Fragment key={wi}>
									{wi > 0 ? " " : ""}
									<span style={isAccent ? { color: line.accentColor || color } : undefined}>
										{word}
									</span>
								</React.Fragment>
							);
						})
					: line.text;

				return (
					<div
						key={i}
						style={{
							fontSize: line.size,
							fontWeight: line.weight ?? 900,
							color: line.color || color,
							opacity: animation === "none" ? 1 : progress,
							transform: `translateY(${translateY}px) scale(${scale})`,
							whiteSpace: "nowrap",
							...(line.spacingAfter ? { marginBottom: line.spacingAfter } : {}),
						}}
					>
						{lineContent}
					</div>
				);
			})}
		</div>
	);
};

// ── GradientMesh ───────────────────────────────────────────────────────

/**
 * Soft multi-color pastel mesh gradient background with subtle bokeh dots.
 * Extracted from TriNet SaaS (note-taking) — premium ethereal feel.
 */
export const GradientMesh: React.FC<{
	colors?: string[];
	dots?: boolean;
	speed?: number;
}> = ({ colors = ["#ffd6e7", "#e0d4ff", "#d4fff1", "#ffefd6"], dots = true, speed = 0.5 }) => {
	const frame = useCurrentFrame();
	const shift = frame * speed * 0.3;

	// 4 radial gradients at different positions create a mesh effect
	const gradients = [
		`radial-gradient(ellipse at ${20 + Math.sin(shift * 0.01) * 10}% ${30 + Math.cos(shift * 0.01) * 8}%, ${colors[0]} 0%, transparent 50%)`,
		`radial-gradient(ellipse at ${80 + Math.sin(shift * 0.012) * 8}% ${20 + Math.cos(shift * 0.012) * 10}%, ${colors[1]} 0%, transparent 50%)`,
		`radial-gradient(ellipse at ${30 + Math.sin(shift * 0.008) * 12}% ${80 + Math.cos(shift * 0.008) * 6}%, ${colors[2] || colors[0]} 0%, transparent 50%)`,
		`radial-gradient(ellipse at ${75 + Math.sin(shift * 0.011) * 8}% ${75 + Math.cos(shift * 0.011) * 8}%, ${colors[3] || colors[1]} 0%, transparent 50%)`,
	];

	// Deterministic bokeh dots
	const bokehDots = dots
		? Array.from({ length: 20 }, (_, i) => {
				const seed = i * 9301 + 49297;
				const x = (seed % 100) + Math.sin(shift * 0.02 + i) * 2;
				const y = ((seed >> 3) % 100) + Math.cos(shift * 0.015 + i) * 2;
				const size = 40 + (seed % 60);
				return { x, y, size, opacity: 0.15 + ((seed >> 5) % 15) / 100 };
			})
		: [];

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: `${gradients.join(", ")}, ${colors[0] || "#fef5ed"}`,
				overflow: "hidden",
			}}
		>
			{bokehDots.map((dot, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${dot.x}%`,
						top: `${dot.y}%`,
						width: dot.size,
						height: dot.size,
						borderRadius: "50%",
						background: "rgba(255,255,255,0.6)",
						opacity: dot.opacity,
						filter: "blur(20px)",
					}}
				/>
			))}
		</div>
	);
};

// ═══════════════════════════════════════════════════════════════════════
// TIER 2: Higher complexity patterns
// ═══════════════════════════════════════════════════════════════════════

// ── FloatingAppIcon ────────────────────────────────────────────────────

/**
 * Large 3D-style floating app icon with drop shadow and spring entrance.
 * Used as a "solution delivered" visual (Viktor's floating PDF icon).
 */
export const FloatingAppIcon: React.FC<{
	icon: string;
	color?: string;
	size?: number;
	delay?: number;
	rotation?: number;
}> = ({ icon, color = "#ef4444", size = 260, delay = 0, rotation = -8 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 10, stiffness: 120, mass: 0.9 },
	});
	const floatY = Math.sin((frame - delay) * 0.05) * 6;
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: size * 0.23,
				background: `linear-gradient(135deg, ${color}, ${color}dd)`,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: size * 0.5,
				color: "#fff",
				fontWeight: 900,
				boxShadow: `0 ${size * 0.2}px ${size * 0.3}px rgba(0,0,0,0.35), 0 0 ${size * 0.5}px ${color}60`,
				transform: `translateY(${(1 - progress) * -40 + floatY}px) scale(${progress}) rotate(${rotation}deg)`,
				opacity: progress,
			}}
		>
			{icon}
		</div>
	);
};

// ── BlurredUI ──────────────────────────────────────────────────────────

/**
 * Wrapper that applies animated blur to children.
 * Used for "things are unclear / information overload" transition scenes.
 */
export const BlurredUI: React.FC<{
	children: React.ReactNode;
	blurFrom?: number;
	blurTo?: number;
	duration?: number;
	delay?: number;
}> = ({ children, blurFrom = 20, blurTo = 0, duration = 25, delay = 0 }) => {
	const frame = useCurrentFrame();
	const t = Math.max(0, Math.min(1, (frame - delay) / duration));
	const blur = blurFrom + (blurTo - blurFrom) * t;
	return <div style={{ filter: `blur(${blur}px)`, width: "100%", height: "100%" }}>{children}</div>;
};

// ── DashboardGrid ──────────────────────────────────────────────────────

/**
 * Floating metric cards connected by a chart line.
 * Extracted from Box Corporate's "See the impact" deconstructed dashboard.
 */
export const DashboardGrid: React.FC<{
	metrics: Array<{ label: string; value: string; delta?: string; color?: string }>;
	showChart?: boolean;
}> = ({ metrics, showChart = true }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const positions = [
		{ x: 15, y: 30 },
		{ x: 60, y: 20 },
		{ x: 25, y: 75 },
		{ x: 75, y: 70 },
	];

	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			{showChart && (
				<svg
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						pointerEvents: "none",
					}}
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<path
						d="M 5 80 Q 25 75, 40 55 T 75 35 T 95 20"
						stroke="#2563eb"
						strokeWidth="0.8"
						fill="none"
						strokeDasharray="200"
						strokeDashoffset={interpolate(frame, [0, 45], [200, 0], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						})}
					/>
				</svg>
			)}
			{metrics.slice(0, 4).map((metric, i) => {
				const pos = positions[i] || positions[0];
				const delay = i * 6 + 10;
				const progress = spring({
					frame: Math.max(0, frame - delay),
					fps,
					config: { damping: 14, stiffness: 160 },
				});
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: `${pos.x}%`,
							top: `${pos.y}%`,
							transform: `translate(-50%, -50%) scale(${progress})`,
							opacity: progress,
							background: "#ffffff",
							padding: "18px 24px",
							borderRadius: 14,
							boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
							fontFamily: "'Inter', sans-serif",
							minWidth: 180,
						}}
					>
						<div
							style={{
								fontSize: 12,
								color: "#888",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								fontWeight: 600,
							}}
						>
							{metric.label}
						</div>
						<div
							style={{
								fontSize: 34,
								fontWeight: 900,
								color: "#1a1a1a",
								marginTop: 4,
								fontVariantNumeric: "tabular-nums",
							}}
						>
							{metric.value}
						</div>
						{metric.delta && (
							<div
								style={{
									fontSize: 13,
									color: metric.color || "#10b981",
									marginTop: 2,
									fontWeight: 600,
								}}
							>
								{metric.delta}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};

// ── CredibilityLogos ───────────────────────────────────────────────────

/**
 * Row of brand partner/customer logos with optional "Trusted by" eyebrow text.
 * Uses text labels (can be replaced with Img when logo URLs are available).
 */
export const CredibilityLogos: React.FC<{
	logos: string[];
	eyebrow?: string;
	color?: string;
	delay?: number;
}> = ({ logos, eyebrow = "Trusted by", color = "#888", delay = 0 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 24,
				fontFamily: "'Inter', sans-serif",
			}}
		>
			{eyebrow && (
				<div
					style={{
						fontSize: 16,
						color,
						letterSpacing: "0.15em",
						textTransform: "uppercase",
						fontWeight: 600,
						opacity: spring({
							frame: Math.max(0, frame - delay),
							fps,
							config: { damping: 20, stiffness: 100 },
						}),
					}}
				>
					{eyebrow}
				</div>
			)}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 60,
					flexWrap: "wrap",
					justifyContent: "center",
				}}
			>
				{logos.map((logo, i) => {
					const progress = spring({
						frame: Math.max(0, frame - delay - i * 5),
						fps,
						config: { damping: 16, stiffness: 140 },
					});
					return (
						<div
							key={i}
							style={{
								fontSize: 32,
								fontWeight: 700,
								color,
								opacity: progress * 0.75,
								transform: `translateY(${(1 - progress) * 16}px)`,
								letterSpacing: "-0.01em",
							}}
						>
							{logo}
						</div>
					);
				})}
			</div>
		</div>
	);
};

// ── CharacterCardRow ───────────────────────────────────────────────────

/**
 * Row of uniform cards with image + label. For showing variations/options.
 * Extracted from Elser AI's character showcase (Alan, Archer, Barry, Felix).
 */
export const CharacterCardRow: React.FC<{
	items: Array<{ image?: string; emoji?: string; label: string; bg?: string }>;
	cardWidth?: number;
	cardHeight?: number;
	gap?: number;
}> = ({ items, cardWidth = 260, cardHeight = 380, gap = 16 }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<div style={{ display: "flex", gap, justifyContent: "center", alignItems: "center" }}>
			{items.map((item, i) => {
				const delay = i * 6;
				const progress = spring({
					frame: Math.max(0, frame - delay),
					fps,
					config: { damping: 14, stiffness: 140 },
				});
				return (
					<div
						key={i}
						style={{
							width: cardWidth,
							height: cardHeight,
							borderRadius: 20,
							background: item.bg || "linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "flex-end",
							padding: 20,
							opacity: progress,
							transform: `translateY(${(1 - progress) * 30}px) scale(${0.94 + progress * 0.06})`,
							boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
							position: "relative",
							overflow: "hidden",
						}}
					>
						{item.image && (
							<div
								style={{
									position: "absolute",
									inset: 0,
									backgroundImage: `url(${item.image})`,
									backgroundSize: "cover",
									backgroundPosition: "center",
								}}
							/>
						)}
						{item.emoji && !item.image && (
							<div
								style={{
									position: "absolute",
									top: "50%",
									left: "50%",
									transform: "translate(-50%, -60%)",
									fontSize: cardWidth * 0.6,
								}}
							>
								{item.emoji}
							</div>
						)}
						<div
							style={{
								position: "relative",
								fontSize: 28,
								fontWeight: 700,
								color: "#fff",
								textShadow: "0 2px 20px rgba(0,0,0,0.8)",
								fontFamily: "'Inter', sans-serif",
								zIndex: 2,
							}}
						>
							{item.label}
						</div>
					</div>
				);
			})}
		</div>
	);
};

// ── CornerTriangleFrame ────────────────────────────────────────────────

/**
 * 4 brand-colored triangles in corners for a framed composition.
 * Extracted from Viktor's "We're replacing your overtime" closing scene.
 */
export const CornerTriangleFrame: React.FC<{
	children: React.ReactNode;
	color?: string;
	size?: number;
}> = ({ children, color = "#e0d4ff", size = 90 }) => {
	const corners: React.CSSProperties[] = [
		{
			top: 0,
			left: 0,
			borderTop: `${size}px solid ${color}`,
			borderRight: `${size}px solid transparent`,
		},
		{
			top: 0,
			right: 0,
			borderTop: `${size}px solid ${color}`,
			borderLeft: `${size}px solid transparent`,
		},
		{
			bottom: 0,
			left: 0,
			borderBottom: `${size}px solid ${color}`,
			borderRight: `${size}px solid transparent`,
		},
		{
			bottom: 0,
			right: 0,
			borderBottom: `${size}px solid ${color}`,
			borderLeft: `${size}px solid transparent`,
		},
	];
	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			{children}
			{corners.map((style, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						width: 0,
						height: 0,
						pointerEvents: "none",
						...style,
					}}
				/>
			))}
		</div>
	);
};

// ═══════════════════════════════════════════════════════════════════════
// TIER 3: Advanced patterns (CSS-based; Lottie recommended for 3D physics)
// ═══════════════════════════════════════════════════════════════════════

// ── OutlineText ────────────────────────────────────────────────────────

/**
 * Stroke-only (hollow) typography. Editorial/architectural feel.
 * Extracted from Agency Manifesto's "AVERAGE" scene.
 */
export const OutlineText: React.FC<{
	text: string;
	fontSize?: number;
	strokeWidth?: number;
	color?: string;
	fontFamily?: string;
	align?: "center" | "left" | "right";
	maxWidth?: number;
}> = ({
	text,
	fontSize = 240,
	strokeWidth = 2,
	color = "#ffffff",
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	align = "center",
	maxWidth = 2200,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });

	return (
		<div
			style={{
				fontSize,
				fontFamily,
				fontWeight: 900,
				letterSpacing: "-0.04em",
				lineHeight: 0.95,
				textAlign: align,
				maxWidth,
				color: "transparent",
				WebkitTextStroke: `${strokeWidth}px ${color}`,
				opacity: progress,
				transform: `scale(${0.95 + progress * 0.05})`,
			}}
		>
			{text}
		</div>
	);
};

// ── RadialTextVortex ───────────────────────────────────────────────────

/**
 * Concentric rings of repeated text spiraling outward with depth blur.
 * Extracted from Agency Manifesto's "GOOD ENOUGH" vortex. Pure CSS 3D.
 */
export const RadialTextVortex: React.FC<{
	text: string;
	rings?: number;
	baseFontSize?: number;
	color?: string;
	fontFamily?: string;
	rotationSpeed?: number;
	delay?: number;
}> = ({
	text,
	rings = 5,
	baseFontSize = 80,
	color = "#ffffff",
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	rotationSpeed = 0.3,
	delay = 0,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const entrance = spring({
		frame: Math.max(0, frame - delay),
		fps,
		config: { damping: 18, stiffness: 80 },
	});

	const ringConfigs = Array.from({ length: rings }, (_, i) => {
		const scale = 0.3 + i * 0.45;
		const blur = Math.abs(i - Math.floor(rings / 2)) * 2;
		const opacity = 1 - Math.abs(i - Math.floor(rings / 2)) * 0.2;
		const rotation = (frame - delay) * rotationSpeed * (i % 2 === 0 ? 1 : -1);
		const count = Math.max(4, 4 + i * 2);
		return { scale, blur, opacity, rotation, count, ringIndex: i };
	});

	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				opacity: entrance,
			}}
		>
			{ringConfigs.map((ring) => (
				<div
					key={ring.ringIndex}
					style={{
						position: "absolute",
						width: "100%",
						height: "100%",
						transform: `scale(${ring.scale * entrance})`,
						filter: `blur(${ring.blur}px)`,
						opacity: ring.opacity,
					}}
				>
					{Array.from({ length: ring.count }, (_, j) => {
						const angle = (360 / ring.count) * j + ring.rotation;
						return (
							<div
								key={j}
								style={{
									position: "absolute",
									top: "50%",
									left: "50%",
									transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${(ring.ringIndex + 1) * 140}px)`,
									fontSize: baseFontSize,
									fontFamily,
									fontWeight: 900,
									color,
									whiteSpace: "nowrap",
									letterSpacing: "0.05em",
									textTransform: "uppercase",
								}}
							>
								{text}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
};

// ── EchoText ───────────────────────────────────────────────────────────

/**
 * Text with motion-blur echo copies creating a trail effect.
 * Extracted from TriNet SaaS "33% time" zooming text.
 */
export const EchoText: React.FC<{
	text: string;
	fontSize?: number;
	color?: string;
	colors?: string[];
	fontFamily?: string;
	echoCount?: number;
	maxOffset?: number;
}> = ({
	text,
	fontSize = 200,
	color = "#4c1d95",
	colors,
	fontFamily = "'Inter', 'Helvetica Neue', sans-serif",
	echoCount = 3,
	maxOffset = 60,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const progress = spring({ frame, fps, config: { damping: 10, stiffness: 140 } });

	const finalStyle: React.CSSProperties = {
		fontSize,
		fontFamily,
		fontWeight: 900,
		letterSpacing: "-0.04em",
		lineHeight: 0.95,
		position: "relative",
		zIndex: 10,
		opacity: progress,
		transform: `scale(${0.8 + progress * 0.2})`,
	};

	if (colors) {
		finalStyle.background = `linear-gradient(135deg, ${colors.join(", ")})`;
		finalStyle.WebkitBackgroundClip = "text";
		finalStyle.WebkitTextFillColor = "transparent";
	} else {
		finalStyle.color = color;
	}

	return (
		<div style={{ position: "relative", display: "inline-block" }}>
			{Array.from({ length: echoCount }, (_, i) => {
				const t = (i + 1) / echoCount;
				const offset = (1 - progress) * maxOffset * t * (i % 2 === 0 ? -1 : 1);
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							fontSize,
							fontFamily,
							fontWeight: 900,
							letterSpacing: "-0.04em",
							lineHeight: 0.95,
							color: colors ? colors[0] : color,
							opacity: (1 - progress) * (0.4 - t * 0.1),
							filter: `blur(${t * 8}px)`,
							transform: `translate(${offset}px, ${offset * 0.5}px) scale(${1 + t * 0.1})`,
							whiteSpace: "nowrap",
						}}
					>
						{text}
					</div>
				);
			})}
			<div style={finalStyle}>{text}</div>
		</div>
	);
};
