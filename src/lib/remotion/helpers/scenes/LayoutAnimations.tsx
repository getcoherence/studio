// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	random,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

const C = {
	black: "#0a0a0a",
	white: "#fafafa",
	gray: {
		50: "#fafafa",
		100: "#f4f4f5",
		200: "#e4e4e7",
		300: "#d4d4d8",
		400: "#a1a1aa",
		500: "#71717a",
		600: "#52525b",
		700: "#3f3f46",
		800: "#27272a",
		900: "#18181b",
		950: "#0c0c0d",
	},
	accent: "#6366f1",
	secondary: "#ec4899",
	tertiary: "#14b8a6",
	success: "#22c55e",
	warning: "#f59e0b",
	danger: "#ef4444",
	orange: "#f97316",
	yellow: "#eab308",
	gold: "#fbbf24",
	red: "#dc2626",
	cyan: "#06b6d4",
};
const font = "Inter, system-ui, sans-serif";
const lerp = (
	frame: number,
	range: [number, number],
	output: [number, number],
	easing?: (t: number) => number,
) =>
	interpolate(frame, range, output, {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing,
	});
const EASE = {
	out: Easing.bezier(0.16, 1, 0.3, 1),
	inFn: Easing.bezier(0.7, 0, 0.84, 0),
	inOut: Easing.bezier(0.87, 0, 0.13, 1),
	overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
	snap: Easing.bezier(0.075, 0.82, 0.165, 1),
};

// ── LayoutAsymmetric ──

/**
 * LayoutAsymmetric - 極端な非対称レイアウト - 左に巨大テキスト、右に小さな情報
 */

export const LayoutAsymmetric = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const mainTextProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 20, stiffness: 100 },
	});

	const sideInfoProgress = spring({
		frame: frame - startDelay - 15,
		fps,
		config: { damping: 15, stiffness: 150 },
	});

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* 左側：巨大テキスト（画面の70%を占める） */}
			<div
				style={{
					position: "absolute",
					left: -30,
					top: "50%",
					transform: `translateY(-50%) translateX(${(1 - mainTextProgress) * -100}px)`,
					opacity: mainTextProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 280,
						fontWeight: 900,
						color: C.white,
						lineHeight: 0.85,
						letterSpacing: -15,
					}}
				>
					BIG
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 280,
						fontWeight: 900,
						color: C.accent,
						lineHeight: 0.85,
						letterSpacing: -15,
						marginLeft: 60,
					}}
				>
					IDEA
				</div>
			</div>

			{/* 右側：小さな情報群 */}
			<div
				style={{
					position: "absolute",
					right: 60,
					top: 80,
					width: 200,
					opacity: sideInfoProgress,
					transform: `translateY(${(1 - sideInfoProgress) * 30}px)`,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 11,
						color: C.gray[500],
						letterSpacing: 3,
						marginBottom: 15,
					}}
				>
					EST. 2024
				</div>
				<div
					style={{
						width: 40,
						height: 2,
						background: C.accent,
						marginBottom: 20,
					}}
				/>
				<div
					style={{
						fontFamily: font,
						fontSize: 13,
						color: C.gray[400],
						lineHeight: 1.8,
					}}
				>
					Creative Agency
					<br />
					Tokyo, Japan
				</div>
			</div>

			{/* 右下：装飾番号 */}
			<div
				style={{
					position: "absolute",
					right: 60,
					bottom: 60,
					fontFamily: font,
					fontSize: 120,
					fontWeight: 100,
					color: C.gray[900],
					opacity: sideInfoProgress,
				}}
			>
				01
			</div>

			{/* 縦線装飾 */}
			<div
				style={{
					position: "absolute",
					right: 280,
					top: 60,
					width: 1,
					height: lerp(frame, [startDelay + 20, startDelay + 50], [0, 600], EASE.out),
					background: C.gray[800],
				}}
			/>
		</AbsoluteFill>
	);
};

// ── LayoutDiagonal ──

/**
 * LayoutDiagonal - 対角線構成 - ダイナミックな斜め配置
 */

export const LayoutDiagonal = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const diagonalProgress = lerp(frame, [startDelay, startDelay + 40], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.white, overflow: "hidden" }}>
			{/* 斜めの背景 */}
			<div
				style={{
					position: "absolute",
					left: "-20%",
					top: "-20%",
					width: "80%",
					height: "140%",
					background: C.black,
					transform: `rotate(-15deg) translateX(${(1 - diagonalProgress) * -100}%)`,
				}}
			/>

			{/* 左側（黒背景上）のテキスト */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: "40%",
					transform: `translateY(-50%) rotate(-15deg)`,
					opacity: lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 100,
						fontWeight: 900,
						color: C.white,
						lineHeight: 0.9,
					}}
				>
					DYNAMIC
				</div>
			</div>

			{/* 右側（白背景上）のテキスト */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: "30%",
					textAlign: "right",
					opacity: lerp(frame, [startDelay + 25, startDelay + 45], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 60,
						fontWeight: 300,
						color: C.black,
						lineHeight: 1.2,
					}}
				>
					Motion
					<br />
					Design
				</div>
			</div>

			{/* アクセントライン */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: "25%",
					width: lerp(frame, [startDelay + 35, startDelay + 55], [0, 150], EASE.out),
					height: 4,
					background: C.accent,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── LayoutFrameInFrame ──

/**
 * LayoutFrameInFrame - フレーム・イン・フレーム
 */

export const LayoutFrameInFrame = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const outerProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 20, stiffness: 100 },
	});

	const innerProgress = spring({
		frame: frame - startDelay - 15,
		fps,
		config: { damping: 15, stiffness: 150 },
	});

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* 外側のフレーム */}
			<div
				style={{
					position: "absolute",
					left: 40,
					top: 40,
					right: 40,
					bottom: 40,
					border: `1px solid ${C.gray[800]}`,
					transform: `scale(${outerProgress})`,
					opacity: outerProgress,
				}}
			>
				{/* コーナー装飾 */}
				<div
					style={{
						position: "absolute",
						left: -1,
						top: -1,
						width: 30,
						height: 30,
						borderLeft: `3px solid ${C.accent}`,
						borderTop: `3px solid ${C.accent}`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						right: -1,
						top: -1,
						width: 30,
						height: 30,
						borderRight: `3px solid ${C.accent}`,
						borderTop: `3px solid ${C.accent}`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: -1,
						bottom: -1,
						width: 30,
						height: 30,
						borderLeft: `3px solid ${C.accent}`,
						borderBottom: `3px solid ${C.accent}`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						right: -1,
						bottom: -1,
						width: 30,
						height: 30,
						borderRight: `3px solid ${C.accent}`,
						borderBottom: `3px solid ${C.accent}`,
					}}
				/>
			</div>

			{/* 内側のフレーム */}
			<div
				style={{
					position: "absolute",
					left: 120,
					top: 120,
					right: 120,
					bottom: 120,
					border: `2px solid ${C.white}`,
					transform: `scale(${innerProgress})`,
					opacity: innerProgress,
				}}
			>
				{/* コンテンツ */}
				<div
					style={{
						position: "absolute",
						left: "50%",
						top: "50%",
						transform: "translate(-50%, -50%)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							fontFamily: font,
							fontSize: 14,
							color: C.gray[500],
							letterSpacing: 6,
							marginBottom: 20,
						}}
					>
						INTRODUCING
					</div>
					<div
						style={{
							fontFamily: font,
							fontSize: 80,
							fontWeight: 700,
							color: C.white,
						}}
					>
						FRAME
					</div>
				</div>
			</div>

			{/* 外側の情報 */}
			<div
				style={{
					position: "absolute",
					left: 60,
					bottom: 60,
					fontFamily: font,
					fontSize: 11,
					color: C.gray[600],
					letterSpacing: 2,
					opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
				}}
			>
				VOL.01 — 2024
			</div>
		</AbsoluteFill>
	);
};

// ── LayoutFullscreenType ──

/**
 * LayoutFullscreenType - フルスクリーンタイポグラフィ - 画面いっぱいの文字
 */

export const LayoutFullscreenType = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const line1Y = lerp(frame, [startDelay, startDelay + 25], [100, 0], EASE.out);
	const line2Y = lerp(frame, [startDelay + 8, startDelay + 33], [100, 0], EASE.out);
	const line3Y = lerp(frame, [startDelay + 16, startDelay + 41], [100, 0], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
			{/* 行1 */}
			<div style={{ overflow: "hidden", position: "absolute", left: 40, top: 80 }}>
				<div
					style={{
						fontFamily: font,
						fontSize: 180,
						fontWeight: 900,
						color: C.white,
						letterSpacing: -8,
						lineHeight: 0.85,
						transform: `translateY(${line1Y}%)`,
					}}
				>
					MAKE
				</div>
			</div>

			{/* 行2 */}
			<div style={{ overflow: "hidden", position: "absolute", left: 40, top: 250 }}>
				<div
					style={{
						fontFamily: font,
						fontSize: 180,
						fontWeight: 900,
						color: C.white,
						letterSpacing: -8,
						lineHeight: 0.85,
						transform: `translateY(${line2Y}%)`,
					}}
				>
					IT<span style={{ color: C.secondary }}> HAPPEN</span>
				</div>
			</div>

			{/* 行3 */}
			<div style={{ overflow: "hidden", position: "absolute", left: 40, top: 420 }}>
				<div
					style={{
						fontFamily: font,
						fontSize: 180,
						fontWeight: 900,
						color: C.accent,
						letterSpacing: -8,
						lineHeight: 0.85,
						transform: `translateY(${line3Y}%)`,
					}}
				>
					NOW.
				</div>
			</div>

			{/* 右下の小テキスト */}
			<div
				style={{
					position: "absolute",
					right: 60,
					bottom: 60,
					textAlign: "right",
					opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 12,
						color: C.gray[600],
						letterSpacing: 3,
					}}
				>
					START TODAY
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── LayoutGiantNumber ──

/**
 * LayoutGiantNumber - 巨大数字 + テキスト - データ強調レイアウト
 */

export const LayoutGiantNumber = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const numberProgress = lerp(frame, [startDelay, startDelay + 40], [0, 1], EASE.dramatic);
	const textProgress = lerp(frame, [startDelay + 20, startDelay + 50], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* 巨大な数字（画面をはみ出す） */}
			<div
				style={{
					position: "absolute",
					right: -80,
					top: "50%",
					transform: `translateY(-50%) scale(${0.8 + numberProgress * 0.2})`,
					fontFamily: font,
					fontSize: 500,
					fontWeight: 900,
					color: C.gray[100],
					lineHeight: 0.8,
					opacity: numberProgress,
				}}
			>
				97
			</div>

			{/* 左側のテキスト情報 */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: "50%",
					transform: `translateY(-50%) translateX(${(1 - textProgress) * -50}px)`,
					opacity: textProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						fontWeight: 500,
						color: C.accent,
						letterSpacing: 4,
						marginBottom: 20,
					}}
				>
					CUSTOMER SATISFACTION
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 60,
						fontWeight: 700,
						color: C.black,
						lineHeight: 1.1,
					}}
				>
					Percent
					<br />
					<span style={{ color: C.accent }}>Happy</span>
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.gray[500],
						marginTop: 30,
						maxWidth: 300,
						lineHeight: 1.7,
					}}
				>
					Based on 10,000+ reviews from verified customers worldwide.
				</div>
			</div>

			{/* 上部のライン */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: 60,
					width: lerp(frame, [startDelay + 30, startDelay + 60], [0, 200], EASE.out),
					height: 4,
					background: C.black,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── LayoutGridBreak ──

/**
 * LayoutGridBreak - グリッドブレイク - 規則性を崩す
 */

export const LayoutGridBreak = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const items = [
		{ x: 10, y: 15, w: 25, h: 35, color: C.accent, delay: 0 },
		{ x: 40, y: 10, w: 20, h: 25, color: C.secondary, delay: 5 },
		{ x: 65, y: 20, w: 30, h: 40, color: C.gray[800], delay: 10 },
		{ x: 15, y: 55, w: 35, h: 30, color: C.tertiary, delay: 15 },
		{ x: 55, y: 65, w: 25, h: 25, color: C.gray[700], delay: 20 },
	];

	return (
		<AbsoluteFill style={{ background: C.gray[950] }}>
			{/* グリッドライン（かすかに見える） */}
			<AbsoluteFill
				style={{
					backgroundImage: `
            linear-gradient(${C.gray[900]} 1px, transparent 1px),
            linear-gradient(90deg, ${C.gray[900]} 1px, transparent 1px)
          `,
					backgroundSize: "10% 10%",
					opacity: 0.3,
				}}
			/>

			{/* ブロック要素 */}
			{items.map((item, i) => {
				const progress = spring({
					frame: frame - startDelay - item.delay,
					fps,
					config: { damping: 15, stiffness: 150 },
				});

				return (
					<div
						key={`grid-block-${i}`}
						style={{
							position: "absolute",
							left: `${item.x}%`,
							top: `${item.y}%`,
							width: `${item.w}%`,
							height: `${item.h}%`,
							background: item.color,
							transform: `scale(${progress})`,
							opacity: progress * 0.9,
						}}
					/>
				);
			})}

			{/* オーバーレイテキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					fontFamily: font,
					fontSize: 80,
					fontWeight: 900,
					color: C.white,
					mixBlendMode: "difference",
					opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
				}}
			>
				BREAK
			</div>
		</AbsoluteFill>
	);
};

// ── LayoutLayered ──

/**
 * LayoutLayered - レイヤード構成 - 奥行き感
 */

export const LayoutLayered = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const layer1 = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);
	const layer2 = lerp(frame, [startDelay + 10, startDelay + 40], [0, 1], EASE.out);
	const layer3 = lerp(frame, [startDelay + 20, startDelay + 50], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* 最背面レイヤー */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: 100,
					width: 800,
					height: 400,
					background: C.gray[900],
					transform: `translateX(${(1 - layer1) * -100}px)`,
					opacity: layer1 * 0.5,
				}}
			/>

			{/* 中間レイヤー */}
			<div
				style={{
					position: "absolute",
					left: 150,
					top: 150,
					width: 700,
					height: 350,
					background: C.gray[800],
					transform: `translateX(${(1 - layer2) * -80}px)`,
					opacity: layer2 * 0.7,
				}}
			/>

			{/* 前面レイヤー（コンテンツ） */}
			<div
				style={{
					position: "absolute",
					left: 200,
					top: 200,
					width: 600,
					height: 300,
					background: C.accent,
					transform: `translateX(${(1 - layer3) * -60}px)`,
					opacity: layer3,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 60,
						fontWeight: 700,
						color: C.white,
					}}
				>
					DEPTH
				</div>
			</div>

			{/* 右側の情報 */}
			<div
				style={{
					position: "absolute",
					right: 60,
					top: "50%",
					transform: "translateY(-50%)",
					textAlign: "right",
					opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[500],
						letterSpacing: 3,
					}}
				>
					LAYERED
					<br />
					COMPOSITION
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── LayoutMultiColumn ──

/**
 * LayoutMultiColumn - マルチコラムレイアウト - 情報の並列配置
 */

export const LayoutMultiColumn = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const columns = [
		{ number: "01", title: "Strategy", desc: "Define clear goals and roadmap" },
		{ number: "02", title: "Design", desc: "Create beautiful experiences" },
		{ number: "03", title: "Develop", desc: "Build with modern technology" },
		{ number: "04", title: "Deliver", desc: "Launch and iterate fast" },
	];

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* ヘッダー */}
			<div
				style={{
					position: "absolute",
					left: 60,
					top: 60,
					opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[500],
						letterSpacing: 3,
						marginBottom: 15,
					}}
				>
					OUR PROCESS
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 48,
						fontWeight: 700,
						color: C.black,
					}}
				>
					How We Work
				</div>
			</div>

			{/* 4カラム */}
			<div
				style={{
					position: "absolute",
					left: 60,
					right: 60,
					bottom: 100,
					display: "flex",
					gap: 40,
				}}
			>
				{columns.map((col, i) => {
					const progress = spring({
						frame: frame - startDelay - 20 - i * 8,
						fps,
						config: { damping: 15, stiffness: 150 },
					});

					return (
						<div
							key={`col-${col.number}`}
							style={{
								flex: 1,
								borderTop: `2px solid ${C.black}`,
								paddingTop: 25,
								transform: `translateY(${(1 - progress) * 40}px)`,
								opacity: progress,
							}}
						>
							<div
								style={{
									fontFamily: font,
									fontSize: 48,
									fontWeight: 200,
									color: C.gray[300],
									marginBottom: 15,
								}}
							>
								{col.number}
							</div>
							<div
								style={{
									fontFamily: font,
									fontSize: 24,
									fontWeight: 700,
									color: C.black,
									marginBottom: 10,
								}}
							>
								{col.title}
							</div>
							<div
								style={{
									fontFamily: font,
									fontSize: 14,
									color: C.gray[500],
									lineHeight: 1.6,
								}}
							>
								{col.desc}
							</div>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

// ── LayoutOffGrid ──

/**
 * LayoutOffGrid - オフグリッドレイアウト - 意図的にずらした配置
 */

export const LayoutOffGrid = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const elements = [
		{ text: "THINK", x: 5, y: 15, size: 100, weight: 900, delay: 0 },
		{ text: "DIFFERENT", x: 35, y: 45, size: 80, weight: 300, delay: 8 },
		{ text: "BE", x: 70, y: 20, size: 60, weight: 700, delay: 16 },
		{ text: "BOLD", x: 55, y: 70, size: 120, weight: 900, delay: 24 },
	];

	return (
		<AbsoluteFill style={{ background: C.gray[950] }}>
			{elements.map((el) => {
				const progress = spring({
					frame: frame - startDelay - el.delay,
					fps,
					config: { damping: 15, stiffness: 150 },
				});

				return (
					<div
						key={`offgrid-${el.text}`}
						style={{
							position: "absolute",
							left: `${el.x}%`,
							top: `${el.y}%`,
							fontFamily: font,
							fontSize: el.size,
							fontWeight: el.weight,
							color: el.text === "BOLD" ? C.accent : C.white,
							transform: `translateY(${(1 - progress) * 50}px)`,
							opacity: progress,
						}}
					>
						{el.text}
					</div>
				);
			})}

			{/* 装飾ライン */}
			<div
				style={{
					position: "absolute",
					left: "20%",
					top: "80%",
					width: lerp(frame, [startDelay + 40, startDelay + 70], [0, 300], EASE.out),
					height: 2,
					background: C.gray[700],
				}}
			/>

			{/* 小さな情報 */}
			<div
				style={{
					position: "absolute",
					right: 40,
					bottom: 40,
					fontFamily: font,
					fontSize: 11,
					color: C.gray[600],
					letterSpacing: 2,
					textAlign: "right",
					opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
				}}
			>
				CREATIVE
				<br />
				DIRECTION
			</div>
		</AbsoluteFill>
	);
};

// ── LayoutSplitContrast ──

/**
 * LayoutSplitContrast - スプリットスクリーン - 左右で対比
 */

export const LayoutSplitContrast = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const leftProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);
	const rightProgress = lerp(frame, [startDelay + 10, startDelay + 40], [0, 1], EASE.out);

	return (
		<AbsoluteFill>
			{/* 左半分：黒背景 */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: "50%",
					height: "100%",
					background: C.black,
					clipPath: `inset(0 ${(1 - leftProgress) * 100}% 0 0)`,
				}}
			>
				<div
					style={{
						position: "absolute",
						left: 60,
						top: "50%",
						transform: "translateY(-50%)",
					}}
				>
					<div
						style={{
							fontFamily: font,
							fontSize: 14,
							color: C.gray[500],
							letterSpacing: 3,
							marginBottom: 20,
						}}
					>
						BEFORE
					</div>
					<div
						style={{
							fontFamily: font,
							fontSize: 80,
							fontWeight: 300,
							color: C.white,
							lineHeight: 1,
						}}
					>
						OLD
						<br />
						WAY
					</div>
				</div>
			</div>

			{/* 右半分：白背景 */}
			<div
				style={{
					position: "absolute",
					right: 0,
					top: 0,
					width: "50%",
					height: "100%",
					background: C.white,
					clipPath: `inset(0 0 0 ${(1 - rightProgress) * 100}%)`,
				}}
			>
				<div
					style={{
						position: "absolute",
						right: 60,
						top: "50%",
						transform: "translateY(-50%)",
						textAlign: "right",
					}}
				>
					<div
						style={{
							fontFamily: font,
							fontSize: 14,
							color: C.gray[500],
							letterSpacing: 3,
							marginBottom: 20,
						}}
					>
						AFTER
					</div>
					<div
						style={{
							fontFamily: font,
							fontSize: 80,
							fontWeight: 900,
							color: C.black,
							lineHeight: 1,
						}}
					>
						NEW
						<br />
						<span style={{ color: C.accent }}>ERA</span>
					</div>
				</div>
			</div>

			{/* 中央の縦線 */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: 0,
					width: 4,
					height: "100%",
					background: C.accent,
					transform: "translateX(-50%)",
					opacity: Math.min(leftProgress, rightProgress),
				}}
			/>
		</AbsoluteFill>
	);
};

// ── LayoutVerticalMix ──

/**
 * LayoutVerticalMix - 縦書き + 横書きミックス
 */

export const LayoutVerticalMix = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const verticalProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);
	const horizontalProgress = lerp(frame, [startDelay + 15, startDelay + 45], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.gray[950] }}>
			{/* 縦書きテキスト（左端） */}
			<div
				style={{
					position: "absolute",
					left: 60,
					top: 80,
					writingMode: "vertical-rl",
					fontFamily: font,
					fontSize: 14,
					color: C.gray[500],
					letterSpacing: 4,
					opacity: verticalProgress,
					transform: `translateX(${(1 - verticalProgress) * -30}px)`,
				}}
			>
				BRAND IDENTITY 2024
			</div>

			{/* 縦書き大文字（右端） */}
			<div
				style={{
					position: "absolute",
					right: 60,
					top: 80,
					bottom: 80,
					writingMode: "vertical-rl",
					fontFamily: font,
					fontSize: 200,
					fontWeight: 900,
					color: C.gray[900],
					lineHeight: 0.85,
					opacity: verticalProgress,
				}}
			>
				創造
			</div>

			{/* 横書きメインテキスト */}
			<div
				style={{
					position: "absolute",
					left: 120,
					top: "50%",
					transform: `translateY(-50%) translateX(${(1 - horizontalProgress) * 50}px)`,
					opacity: horizontalProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 700,
						color: C.white,
						lineHeight: 1.1,
					}}
				>
					CREATE
					<br />
					<span style={{ color: C.accent }}>SOMETHING</span>
					<br />
					NEW
				</div>
			</div>

			{/* 下部ライン */}
			<div
				style={{
					position: "absolute",
					left: 120,
					bottom: 100,
					width: lerp(frame, [startDelay + 30, startDelay + 60], [0, 400], EASE.out),
					height: 1,
					background: C.gray[700],
				}}
			/>
		</AbsoluteFill>
	);
};

// ── LayoutWhitespace ──

/**
 * LayoutWhitespace - ホワイトスペース活用 - ミニマル極致
 */

export const LayoutWhitespace = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textProgress = lerp(frame, [startDelay + 20, startDelay + 50], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* 左下に小さく配置 */}
			<div
				style={{
					position: "absolute",
					left: 80,
					bottom: 80,
					opacity: textProgress,
					transform: `translateY(${(1 - textProgress) * 20}px)`,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 11,
						color: C.gray[400],
						letterSpacing: 4,
						marginBottom: 20,
					}}
				>
					LESS IS MORE
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 48,
						fontWeight: 300,
						color: C.black,
						lineHeight: 1.3,
					}}
				>
					Simple.
					<br />
					<span style={{ fontWeight: 700 }}>Powerful.</span>
				</div>
			</div>

			{/* 右上に小さなアクセント */}
			<div
				style={{
					position: "absolute",
					right: 80,
					top: 80,
					width: 40,
					height: 40,
					background: C.accent,
					opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
				}}
			/>

			{/* ほぼ見えない装飾 */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: 80,
					fontFamily: font,
					fontSize: 200,
					fontWeight: 100,
					color: C.gray[100],
					opacity: lerp(frame, [startDelay + 30, startDelay + 60], [0, 1]),
				}}
			>
				01
			</div>
		</AbsoluteFill>
	);
};
