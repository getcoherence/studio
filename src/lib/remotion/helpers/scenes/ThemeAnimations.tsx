// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import { Environment, MeshTransmissionMaterial } from "@react-three/drei";
import { Canvas as ThreeCanvas, useThree } from "@react-three/fiber";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	random,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
// 3D scene primitives — this file is usually rendered inside compileCode's
// JIT-compiled context where these names are in MODULE_SCOPE, but we
// still import them explicitly so Biome's static analysis sees them and
// the module also works when imported directly (e.g. Remotion preview).
import * as THREE from "three";

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

// ── Theme3DGlass ──

/**
 * Theme3DGlass - 3D Glass - 液体ガラス効果（透明感と流動性）
 */

export const Theme3DGlass = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// ゆったりとした浮遊アニメーション
	const floatY = Math.sin((frame - startDelay) * 0.04) * 12;
	const floatX = Math.cos((frame - startDelay) * 0.03) * 5;

	const glassProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 15, stiffness: 80 },
	});

	// よりゆるやかな回転
	const rotateX = 12 + Math.sin((frame - startDelay) * 0.025) * 4;
	const rotateY = -15 + Math.cos((frame - startDelay) * 0.02) * 6;

	// 液体的なうねり
	const wobble1 = Math.sin((frame - startDelay) * 0.06) * 3;
	const wobble2 = Math.cos((frame - startDelay) * 0.05) * 2;

	// カースティクス（水中の光）のアニメーション位置
	const causticOffset1 = ((frame - startDelay) * 0.8) % 400;
	const causticOffset2 = ((frame - startDelay) * 0.6 + 200) % 400;

	// ガラスのサイズ
	const cardWidth = 420;
	const cardHeight = 300;
	const borderRadius = 40; // より丸みを帯びた形状

	return (
		<AbsoluteFill
			style={{
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
				overflow: "hidden",
			}}
		>
			{/* 背景のオーブ（ガラス越しに見える） */}
			<div
				style={{
					position: "absolute",
					left: "15%",
					top: "25%",
					width: 500,
					height: 500,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)",
					filter: "blur(40px)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					right: "5%",
					bottom: "15%",
					width: 400,
					height: 400,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255, 150, 220, 0.5) 0%, rgba(255, 100, 200, 0.2) 50%, transparent 70%)",
					filter: "blur(50px)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "60%",
					width: 300,
					height: 300,
					borderRadius: "50%",
					background: "radial-gradient(circle, rgba(100, 200, 255, 0.4) 0%, transparent 60%)",
					filter: "blur(60px)",
				}}
			/>

			{/* メインの液体ガラス */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					perspective: 1500,
					transformStyle: "preserve-3d",
				}}
			>
				<div
					style={{
						transform: `
              translate(-50%, -50%)
              translateY(${floatY}px)
              translateX(${floatX}px)
              rotateX(${rotateX}deg)
              rotateY(${rotateY}deg)
              scale(${glassProgress})
            `,
						transformStyle: "preserve-3d",
					}}
				>
					{/* ===== 液体ガラス本体 ===== */}
					<div
						style={{
							position: "relative",
							width: cardWidth,
							height: cardHeight,
							transformStyle: "preserve-3d",
						}}
					>
						{/* 影（地面に落ちる） */}
						<div
							style={{
								position: "absolute",
								width: cardWidth * 0.9,
								height: 40,
								left: "5%",
								bottom: -80,
								background: "radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)",
								filter: "blur(20px)",
								transform: "rotateX(90deg)",
							}}
						/>

						{/* 背面の屈折レイヤー（ガラスの奥行き感） */}
						<div
							style={{
								position: "absolute",
								width: cardWidth,
								height: cardHeight,
								borderRadius,
								background: `
                  linear-gradient(
                    ${135 + wobble1 * 3}deg,
                    rgba(255, 255, 255, 0.05) 0%,
                    rgba(200, 180, 255, 0.1) 50%,
                    rgba(255, 200, 230, 0.08) 100%
                  )
                `,
								transform: "translateZ(-20px)",
								filter: "blur(2px)",
							}}
						/>

						{/* メインのガラス面 */}
						<div
							style={{
								position: "absolute",
								width: cardWidth,
								height: cardHeight,
								background: "rgba(255, 255, 255, 0.08)",
								backdropFilter: "blur(24px) saturate(180%)",
								WebkitBackdropFilter: "blur(24px) saturate(180%)",
								borderRadius,
								border: "1.5px solid rgba(255, 255, 255, 0.25)",
								boxShadow: `
                  0 25px 50px rgba(0, 0, 0, 0.15),
                  0 10px 20px rgba(0, 0, 0, 0.1),
                  inset 0 1px 1px rgba(255, 255, 255, 0.4),
                  inset 0 -1px 1px rgba(255, 255, 255, 0.1)
                `,
								overflow: "hidden",
							}}
						>
							{/* 内部の屈折グラデーション（液体感） */}
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									background: `
                    linear-gradient(
                      ${160 + wobble2 * 5}deg,
                      transparent 0%,
                      rgba(255, 255, 255, 0.12) 30%,
                      rgba(200, 220, 255, 0.08) 50%,
                      rgba(255, 200, 255, 0.1) 70%,
                      transparent 100%
                    )
                  `,
									borderRadius,
								}}
							/>

							{/* カースティクス効果1（水中の光の揺らめき） */}
							<div
								style={{
									position: "absolute",
									top: causticOffset1 - 200,
									left: causticOffset1 * 0.5 - 100,
									width: 300,
									height: 300,
									background: `
                    radial-gradient(ellipse at center,
                      rgba(255, 255, 255, 0.15) 0%,
                      rgba(255, 255, 255, 0.08) 30%,
                      transparent 60%
                    )
                  `,
									filter: "blur(20px)",
									opacity: 0.7,
									pointerEvents: "none",
								}}
							/>

							{/* カースティクス効果2 */}
							<div
								style={{
									position: "absolute",
									top: causticOffset2 - 150,
									right: causticOffset2 * 0.3 - 50,
									width: 250,
									height: 250,
									background: `
                    radial-gradient(ellipse at center,
                      rgba(200, 230, 255, 0.12) 0%,
                      rgba(255, 200, 255, 0.06) 40%,
                      transparent 70%
                    )
                  `,
									filter: "blur(25px)",
									opacity: 0.6,
									pointerEvents: "none",
								}}
							/>

							{/* 上部のスペキュラーハイライト（曲面反射） */}
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									height: "45%",
									background: `
                    linear-gradient(
                      180deg,
                      rgba(255, 255, 255, 0.35) 0%,
                      rgba(255, 255, 255, 0.15) 30%,
                      rgba(255, 255, 255, 0.05) 60%,
                      transparent 100%
                    )
                  `,
									borderRadius: `${borderRadius}px ${borderRadius}px 50% 50%`,
									pointerEvents: "none",
								}}
							/>

							{/* 虹色のエッジ（色収差/プリズム効果） */}
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									borderRadius,
									background: `
                    linear-gradient(
                      ${120 + wobble1 * 2}deg,
                      rgba(255, 100, 100, 0.08) 0%,
                      rgba(255, 200, 100, 0.06) 15%,
                      transparent 30%,
                      transparent 70%,
                      rgba(100, 200, 255, 0.08) 85%,
                      rgba(200, 100, 255, 0.06) 100%
                    )
                  `,
									pointerEvents: "none",
								}}
							/>

							{/* コンテンツ */}
							<div style={{ padding: 45, position: "relative", zIndex: 1 }}>
								<div
									style={{
										fontFamily: font,
										fontSize: 14,
										color: "rgba(255, 255, 255, 0.75)",
										letterSpacing: 4,
										marginBottom: 18,
										textShadow: "0 2px 8px rgba(0,0,0,0.2)",
									}}
								>
									PREMIUM
								</div>
								<div
									style={{
										fontFamily: font,
										fontSize: 52,
										fontWeight: 700,
										color: C.white,
										lineHeight: 1.15,
										textShadow: `
                      0 4px 20px rgba(0,0,0,0.25),
                      0 2px 4px rgba(0,0,0,0.15)
                    `,
									}}
								>
									Glass
									<br />
									Morphism
								</div>
							</div>
						</div>

						{/* 前面のハイライトエッジ */}
						<div
							style={{
								position: "absolute",
								top: 2,
								left: borderRadius,
								right: borderRadius,
								height: 1,
								background:
									"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 20%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.6) 80%, transparent 100%)",
								borderRadius: 1,
								transform: "translateZ(1px)",
							}}
						/>

						{/* 左エッジの虹色ハイライト */}
						<div
							style={{
								position: "absolute",
								top: borderRadius,
								left: 2,
								width: 2,
								height: cardHeight - borderRadius * 2,
								background: `
                  linear-gradient(
                    180deg,
                    rgba(255, 150, 150, 0.4) 0%,
                    rgba(255, 255, 150, 0.3) 25%,
                    rgba(150, 255, 200, 0.3) 50%,
                    rgba(150, 200, 255, 0.3) 75%,
                    rgba(200, 150, 255, 0.4) 100%
                  )
                `,
								filter: "blur(1px)",
								transform: "translateZ(1px)",
							}}
						/>
					</div>
				</div>

				{/* 浮遊する液体ガラス球（大） */}
				<div
					style={{
						position: "absolute",
						top: -80,
						right: -280,
						width: 90,
						height: 90,
						transformStyle: "preserve-3d",
						transform: `
              translateY(${floatY * 1.3 + wobble1 * 2}px)
              translateX(${wobble2 * 3}px)
              rotateX(${rotateX * 0.5}deg)
              rotateY(${rotateY * 0.5}deg)
              scale(${glassProgress})
            `,
					}}
				>
					<div
						style={{
							position: "absolute",
							width: "100%",
							height: "100%",
							borderRadius: "50%",
							background: `
                radial-gradient(
                  ellipse at 30% 25%,
                  rgba(255, 255, 255, 0.5) 0%,
                  rgba(255, 255, 255, 0.2) 20%,
                  rgba(200, 220, 255, 0.15) 40%,
                  rgba(255, 200, 255, 0.1) 60%,
                  rgba(150, 180, 220, 0.15) 100%
                )
              `,
							backdropFilter: "blur(12px) saturate(150%)",
							WebkitBackdropFilter: "blur(12px) saturate(150%)",
							border: "1px solid rgba(255, 255, 255, 0.3)",
							boxShadow: `
                0 15px 35px rgba(0, 0, 0, 0.15),
                inset -15px -15px 30px rgba(0, 0, 0, 0.05),
                inset 8px 8px 20px rgba(255, 255, 255, 0.3)
              `,
						}}
					/>
					{/* スペキュラー */}
					<div
						style={{
							position: "absolute",
							top: "12%",
							left: "18%",
							width: "35%",
							height: "25%",
							borderRadius: "50%",
							background: "rgba(255, 255, 255, 0.7)",
							filter: "blur(4px)",
						}}
					/>
					{/* 底部の反射 */}
					<div
						style={{
							position: "absolute",
							bottom: "15%",
							right: "20%",
							width: "20%",
							height: "12%",
							borderRadius: "50%",
							background: "rgba(255, 255, 255, 0.25)",
							filter: "blur(3px)",
						}}
					/>
				</div>

				{/* 浮遊する液体ガラス球（小） */}
				<div
					style={{
						position: "absolute",
						bottom: -50,
						left: -280,
						width: 55,
						height: 55,
						transformStyle: "preserve-3d",
						transform: `
              translateY(${floatY * -1.5 + wobble2 * 2}px)
              translateX(${wobble1 * -2}px)
              rotateX(${rotateX * 0.3}deg)
              rotateY(${rotateY * 0.3}deg)
              scale(${glassProgress})
            `,
					}}
				>
					<div
						style={{
							position: "absolute",
							width: "100%",
							height: "100%",
							borderRadius: "50%",
							background: `
                radial-gradient(
                  ellipse at 30% 25%,
                  rgba(255, 255, 255, 0.45) 0%,
                  rgba(255, 255, 255, 0.15) 25%,
                  rgba(220, 200, 255, 0.12) 50%,
                  rgba(180, 200, 240, 0.1) 100%
                )
              `,
							backdropFilter: "blur(10px) saturate(140%)",
							WebkitBackdropFilter: "blur(10px) saturate(140%)",
							border: "1px solid rgba(255, 255, 255, 0.25)",
							boxShadow: `
                0 10px 25px rgba(0, 0, 0, 0.12),
                inset -8px -8px 20px rgba(0, 0, 0, 0.04),
                inset 5px 5px 12px rgba(255, 255, 255, 0.25)
              `,
						}}
					/>
					<div
						style={{
							position: "absolute",
							top: "15%",
							left: "20%",
							width: "30%",
							height: "20%",
							borderRadius: "50%",
							background: "rgba(255, 255, 255, 0.6)",
							filter: "blur(3px)",
						}}
					/>
				</div>

				{/* 小さな気泡（浮遊） */}
				{[
					{ id: "bubble-a", offset: 0, left: 50, sizeAdd: 0 },
					{ id: "bubble-b", offset: 30, left: 120, sizeAdd: 3 },
					{ id: "bubble-c", offset: 60, left: 190, sizeAdd: 6 },
					{ id: "bubble-d", offset: 90, left: 260, sizeAdd: 9 },
					{ id: "bubble-e", offset: 120, left: 330, sizeAdd: 12 },
				].map((bubble) => {
					const bubbleFrame = (frame - startDelay + bubble.offset) % 150;
					const bubbleY = 150 - bubbleFrame * 1.5;
					const bubbleX = Math.sin(bubbleFrame * 0.1 + bubble.offset / 30) * 20;
					const bubbleSize = 8 + bubble.sizeAdd;
					const bubbleOpacity = Math.min(1, (150 - bubbleFrame) / 50) * glassProgress;

					return (
						<div
							key={bubble.id}
							style={{
								position: "absolute",
								left: bubble.left,
								top: bubbleY,
								width: bubbleSize,
								height: bubbleSize,
								borderRadius: "50%",
								background: `
                  radial-gradient(
                    ellipse at 30% 30%,
                    rgba(255, 255, 255, 0.6) 0%,
                    rgba(255, 255, 255, 0.2) 50%,
                    transparent 100%
                  )
                `,
								border: "1px solid rgba(255, 255, 255, 0.3)",
								transform: `translateX(${bubbleX}px)`,
								opacity: bubbleOpacity,
							}}
						/>
					);
				})}
			</div>

			{/* ラベル */}
			<div
				style={{
					position: "absolute",
					left: 60,
					bottom: 60,
					fontFamily: font,
					fontSize: 12,
					color: "rgba(255, 255, 255, 0.6)",
					letterSpacing: 2,
					opacity: glassProgress,
				}}
			>
				3D GLASS EFFECT
			</div>
		</AbsoluteFill>
	);
};

// ── Theme3DGlassThreeJS ──

/**
 * Theme3DGlassThreeJS - Three.js 3D Glass - 本格的な3Dガラス（Three.js使用）
 * MeshTransmissionMaterial使用
 */

// ガラスマテリアルを持つ角丸ボックス
const GlassBox3D = ({
	position,
	rotation,
	scale,
	progress,
}: {
	position: [number, number, number];
	rotation: [number, number, number];
	scale: number;
	progress: number;
}) => {
	const meshRef = useRef<THREE.Mesh>(null);

	// 角丸ボックスのジオメトリを作成
	const geometry = useMemo(() => {
		const shape = new THREE.Shape();
		const width = 3.2;
		const height = 2.4;
		const radius = 0.4;

		shape.moveTo(-width / 2 + radius, -height / 2);
		shape.lineTo(width / 2 - radius, -height / 2);
		shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
		shape.lineTo(width / 2, height / 2 - radius);
		shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
		shape.lineTo(-width / 2 + radius, height / 2);
		shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
		shape.lineTo(-width / 2, -height / 2 + radius);
		shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);

		const extrudeSettings = {
			depth: 0.6,
			bevelEnabled: true,
			bevelThickness: 0.15,
			bevelSize: 0.15,
			bevelSegments: 16,
		};

		const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
		geo.center();
		return geo;
	}, []);

	return (
		<mesh
			ref={meshRef}
			position={position}
			rotation={rotation}
			scale={scale * progress}
			geometry={geometry}
		>
			<MeshTransmissionMaterial
				thickness={0.5}
				roughness={0}
				transmission={1}
				ior={1.5}
				chromaticAberration={0.03}
				backside={true}
				backsideThickness={0.3}
				anisotropy={0.3}
				distortion={0.1}
				distortionScale={0.2}
				temporalDistortion={0.1}
			/>
		</mesh>
	);
};

// ガラス球
const GlassSphere3D = ({
	position,
	scale,
	progress,
	wobbleOffset = 0,
	frame,
}: {
	position: [number, number, number];
	scale: number;
	progress: number;
	wobbleOffset?: number;
	frame: number;
}) => {
	const wobble = Math.sin((frame + wobbleOffset) * 0.05) * 0.15;

	return (
		<mesh position={[position[0], position[1] + wobble, position[2]]} scale={scale * progress}>
			<sphereGeometry args={[0.5, 64, 64]} />
			<MeshTransmissionMaterial
				thickness={1}
				roughness={0}
				transmission={1}
				ior={1.8}
				chromaticAberration={0.05}
				backside={true}
				backsideThickness={0.5}
				distortion={0.2}
				distortionScale={0.3}
			/>
		</mesh>
	);
};

// 背景のカラフルな球とテキスト（ガラス越しに歪んで見える）
const BackgroundElements = ({ frame }: { frame: number }) => {
	const wobble1 = Math.sin(frame * 0.03) * 0.3;
	const wobble2 = Math.cos(frame * 0.025) * 0.4;

	return (
		<>
			{/* カラフルな球 */}
			<mesh position={[-2.5, 1 + wobble1, -2]}>
				<sphereGeometry args={[0.8, 32, 32]} />
				<meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.3} />
			</mesh>
			<mesh position={[2.5, -0.8 + wobble2, -2]}>
				<sphereGeometry args={[1, 32, 32]} />
				<meshStandardMaterial color="#f472b6" emissive="#f472b6" emissiveIntensity={0.3} />
			</mesh>
			<mesh position={[0, 2, -3]}>
				<sphereGeometry args={[0.6, 32, 32]} />
				<meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
			</mesh>
			<mesh position={[-1.2, -1.5, -1.5]}>
				<sphereGeometry args={[0.5, 32, 32]} />
				<meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.3} />
			</mesh>

			{/* 背景テキスト（ガラス越しに歪む） */}
			<Text
				position={[0, 0, -1.5]}
				fontSize={0.8}
				color="#ffffff"
				anchorX="center"
				anchorY="middle"
				font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2"
			>
				PREMIUM
			</Text>
			<Text
				position={[0, -0.8, -1.5]}
				fontSize={1.2}
				color="#ffffff"
				anchorX="center"
				anchorY="middle"
				font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6YAZ9hiJ-Ek-_EeA.woff2"
				fontWeight={700}
			>
				Glass
			</Text>
		</>
	);
};

// メインシーン
const GlassScene3D = ({ frame, progress }: { frame: number; progress: number }) => {
	const { camera } = useThree();

	const rotateY = Math.sin(frame * 0.02) * 0.2 - 0.2;
	const rotateX = Math.sin(frame * 0.015) * 0.1 + 0.15;
	const floatY = Math.sin(frame * 0.04) * 0.08;

	useEffect(() => {
		camera.position.set(0, 0, 5);
		camera.lookAt(0, 0, 0);
	}, [camera]);

	return (
		<>
			{/* 環境マップ（これが重要！） */}
			<Environment preset="city" />

			{/* ライティング */}
			<ambientLight intensity={0.5} />
			<directionalLight position={[5, 5, 5]} intensity={2} />
			<directionalLight position={[-3, 2, 4]} intensity={1} color="#f0abfc" />

			{/* 背景要素（ガラス越しに見える） */}
			<BackgroundElements frame={frame} />

			{/* メインのガラスボックス */}
			<GlassBox3D
				position={[0, floatY, 0]}
				rotation={[rotateX, rotateY, 0]}
				scale={1}
				progress={progress}
			/>

			{/* 浮遊するガラス球（大） */}
			<GlassSphere3D
				position={[2.2, 1.2, 0.8]}
				scale={0.9}
				progress={progress}
				wobbleOffset={0}
				frame={frame}
			/>

			{/* 浮遊するガラス球（小） */}
			<GlassSphere3D
				position={[-2, -0.8, 0.6]}
				scale={0.6}
				progress={progress}
				wobbleOffset={50}
				frame={frame}
			/>
		</>
	);
};

export const Theme3DGlassThreeJS = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();

	const progress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 15, stiffness: 80 },
	});

	return (
		<AbsoluteFill
			style={{
				background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
			}}
		>
			<ThreeCanvas
				width={width}
				height={height}
				camera={{
					fov: 50,
					near: 0.1,
					far: 100,
					position: [0, 0, 5],
				}}
				gl={{
					antialias: true,
					alpha: true,
					powerPreference: "high-performance",
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 1.2,
				}}
				style={{ background: "transparent" }}
			>
				<Suspense fallback={null}>
					<GlassScene3D frame={frame - startDelay} progress={progress} />
				</Suspense>
			</ThreeCanvas>

			{/* ラベル */}
			<div
				style={{
					position: "absolute",
					left: 60,
					bottom: 60,
					fontFamily: font,
					fontSize: 12,
					color: "rgba(255, 255, 255, 0.6)",
					letterSpacing: 2,
					opacity: progress,
				}}
			>
				THREE.JS 3D GLASS
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeArtDeco ──

/**
 * ThemeArtDeco - Art Deco - アールデコ
 */

export const ThemeArtDeco = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const goldOpacity = lerp(frame, [startDelay, startDelay + 30], [0, 1]);
	const fanScale = lerp(frame, [startDelay + 10, startDelay + 40], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: "#1a1a2e" }}>
			{/* 放射状パターン */}
			<svg
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: `translate(-50%, -50%) scale(${fanScale})`,
				}}
				width="600"
				height="600"
				viewBox="0 0 600 600"
				fill="none"
				aria-hidden="true"
			>
				{[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map((angle) => (
					<path
						key={`deco-fan-${angle}`}
						d="M300 300 L300 50 L350 100 Z"
						fill="#d4af37"
						fillOpacity="0.3"
						transform={`rotate(${angle} 300 300)`}
					/>
				))}
				{/* 中心円 */}
				<circle cx="300" cy="300" r="80" stroke="#d4af37" strokeWidth="2" fill="none" />
				<circle cx="300" cy="300" r="60" stroke="#d4af37" strokeWidth="1" fill="none" />
				<circle cx="300" cy="300" r="100" stroke="#d4af37" strokeWidth="3" fill="none" />
			</svg>

			{/* コーナー装飾 */}
			<svg
				style={{
					position: "absolute",
					left: 40,
					top: 40,
					opacity: goldOpacity,
				}}
				width="100"
				height="100"
				viewBox="0 0 100 100"
				fill="none"
				aria-hidden="true"
			>
				<path d="M0 0 L100 0 L100 20 L20 20 L20 100 L0 100 Z" fill="#d4af37" />
				<path d="M30 30 L60 30 L60 35 L35 35 L35 60 L30 60 Z" fill="#d4af37" />
			</svg>
			<svg
				style={{
					position: "absolute",
					right: 40,
					bottom: 40,
					transform: "rotate(180deg)",
					opacity: goldOpacity,
				}}
				width="100"
				height="100"
				viewBox="0 0 100 100"
				fill="none"
				aria-hidden="true"
			>
				<path d="M0 0 L100 0 L100 20 L20 20 L20 100 L0 100 Z" fill="#d4af37" />
				<path d="M30 30 L60 30 L60 35 L35 35 L35 60 L30 60 Z" fill="#d4af37" />
			</svg>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					textAlign: "center",
					opacity: goldOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: "#d4af37",
						letterSpacing: 8,
						marginBottom: 15,
					}}
				>
					THE ROARING
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 100,
						color: C.white,
						letterSpacing: 20,
					}}
				>
					1920
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "#d4af37",
						letterSpacing: 6,
						marginTop: 15,
					}}
				>
					ART DECO STYLE
				</div>
			</div>

			{/* 縦線装飾 */}
			{[-150, -75, 75, 150].map((offset) => (
				<div
					key={`deco-line-${offset}`}
					style={{
						position: "absolute",
						left: `calc(50% + ${offset}px)`,
						top: 0,
						width: 1,
						height: lerp(frame, [startDelay + 20, startDelay + 50], [0, 100]) + "%",
						background: "linear-gradient(180deg, #d4af37, transparent)",
					}}
				/>
			))}
		</AbsoluteFill>
	);
};

// ── ThemeBauhaus ──

/**
 * ThemeBauhaus - Bauhaus - バウハウス
 */

export const ThemeBauhaus = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const circleProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	const rectProgress = spring({
		frame: frame - startDelay - 10,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	const triProgress = spring({
		frame: frame - startDelay - 20,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	return (
		<AbsoluteFill style={{ background: "#f5f1e6" }}>
			{/* 円（赤） */}
			<div
				style={{
					position: "absolute",
					left: 150,
					top: 150,
					width: 250,
					height: 250,
					borderRadius: "50%",
					background: "#e63946",
					transform: `scale(${circleProgress})`,
				}}
			/>

			{/* 四角（青） */}
			<div
				style={{
					position: "absolute",
					right: 200,
					top: 200,
					width: 200,
					height: 200,
					background: "#1d3557",
					transform: `scale(${rectProgress}) rotate(${rectProgress * 15}deg)`,
				}}
			/>

			{/* 三角（黄） */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					bottom: 100,
					transform: `translateX(-50%) scale(${triProgress})`,
				}}
			>
				<div
					style={{
						width: 0,
						height: 0,
						borderLeft: "100px solid transparent",
						borderRight: "100px solid transparent",
						borderBottom: "180px solid #f4a261",
					}}
				/>
			</div>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					textAlign: "center",
					opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 900,
						color: C.gray[900],
						letterSpacing: 20,
					}}
				>
					BAUHAUS
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[600],
						letterSpacing: 8,
						marginTop: 20,
					}}
				>
					FORM FOLLOWS FUNCTION
				</div>
			</div>

			{/* 線の装飾 */}
			<div
				style={{
					position: "absolute",
					left: 100,
					bottom: 80,
					width: lerp(frame, [startDelay + 40, startDelay + 60], [0, 300]),
					height: 4,
					background: C.gray[900],
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeBoho ──

/**
 * ThemeBoho - ボーホー/ボヘミアン - 暖色、パターン
 */

export const ThemeBoho = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]);

	return (
		<AbsoluteFill style={{ background: "#faf3e8" }}>
			{/* パターン背景 */}
			<AbsoluteFill
				style={{
					backgroundImage: `
            radial-gradient(circle at 25% 25%, #d4a574 2px, transparent 2px),
            radial-gradient(circle at 75% 75%, #8b6d5c 2px, transparent 2px)
          `,
					backgroundSize: "60px 60px",
					opacity: 0.3,
				}}
			/>

			{/* アーチ装飾 */}
			<div
				style={{
					position: "absolute",
					right: 100,
					top: 100,
					width: 200,
					height: 300,
					borderRadius: "100px 100px 0 0",
					border: "3px solid #c4956a",
					borderBottom: "none",
					opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
				}}
			/>

			{/* 太陽モチーフ */}
			<svg
				style={{
					position: "absolute",
					left: 100,
					top: 100,
					opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
				}}
				width="80"
				height="80"
				viewBox="0 0 80 80"
				fill="none"
				aria-hidden="true"
			>
				<circle cx="40" cy="40" r="20" fill="#d4a574" />
				{[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
					<line
						key={`sun-ray-${angle}`}
						x1="40"
						y1="5"
						x2="40"
						y2="15"
						stroke="#d4a574"
						strokeWidth="2"
						transform={`rotate(${angle} 40 40)`}
					/>
				))}
			</svg>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: 100,
					bottom: 150,
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "#8b6d5c",
						letterSpacing: 4,
						marginBottom: 15,
					}}
				>
					FREE SPIRIT
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 56,
						fontWeight: 300,
						color: "#5a4a3f",
						lineHeight: 1.1,
					}}
				>
					Bohemian
					<br />
					<span style={{ fontStyle: "italic" }}>Style</span>
				</div>
			</div>

			{/* 植物装飾 */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: 80,
					width: 60,
					height: 100,
					borderLeft: "2px solid #7d8b6a",
					borderBottom: "2px solid #7d8b6a",
					borderBottomLeftRadius: 30,
					opacity: textOpacity,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeBrutalistWeb ──

/**
 * ThemeBrutalistWeb - Brutalist Web - ブルータリストウェブ
 */

export const ThemeBrutalistWeb = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 10, startDelay + 25], [0, 1]);

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* 巨大テキスト背景 */}
			<div
				style={{
					position: "absolute",
					left: -50,
					top: -50,
					fontFamily: font,
					fontSize: 400,
					fontWeight: 900,
					color: "#f0f0f0",
					lineHeight: 0.8,
					opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
				}}
			>
				RAW
			</div>

			{/* 境界線ボックス */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: 150,
					width: 400,
					padding: 30,
					border: `4px solid ${C.black}`,
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 48,
						fontWeight: 900,
						color: C.black,
						textTransform: "uppercase",
					}}
				>
					BRUTALIST
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.black,
						marginTop: 15,
						lineHeight: 1.5,
					}}
				>
					Raw, unpolished, and intentionally rough. Breaking conventional web design rules.
				</div>
			</div>

			{/* マーキー風テキスト */}
			<div
				style={{
					position: "absolute",
					left: 0,
					bottom: 150,
					width: "100%",
					overflow: "hidden",
					borderTop: `2px solid ${C.black}`,
					borderBottom: `2px solid ${C.black}`,
					padding: "10px 0",
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						display: "flex",
						gap: 50,
						transform: `translateX(-${(frame - startDelay) * 3}px)`,
						whiteSpace: "nowrap",
					}}
				>
					{["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => (
						<div
							key={`marquee-brutalist-${id}`}
							style={{
								fontFamily: font,
								fontSize: 24,
								fontWeight: 900,
								color: C.black,
							}}
						>
							NO DECORATION • ONLY FUNCTION • RAW CODE • ANTI-DESIGN •
						</div>
					))}
				</div>
			</div>

			{/* リンクスタイル */}
			<div
				style={{
					position: "absolute",
					right: 80,
					top: 200,
					opacity: textOpacity,
				}}
			>
				{["ABOUT", "WORK", "CONTACT"].map((link, i) => (
					<div
						key={`brutalist-link-${link}`}
						style={{
							fontFamily: font,
							fontSize: 20,
							fontWeight: 700,
							color: "#0000ff",
							textDecoration: "underline",
							marginBottom: 15,
							cursor: "pointer",
							transform: `translateX(${i * 20}px)`,
						}}
					>
						[{link}]
					</div>
				))}
			</div>

			{/* カウンター */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: 80,
					fontFamily: "monospace",
					fontSize: 14,
					color: C.gray[600],
					opacity: textOpacity,
				}}
			>
				VISITORS: {Math.floor(12847 + (frame - startDelay) * 3)}
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeCosmic ──

/**
 * ThemeCosmic - Cosmic/Space - 宇宙
 */

export const ThemeCosmic = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);

	// 星を生成
	const stars = Array.from({ length: 100 }, (_, i) => ({
		x: random(`star-x-${i}`) * 100,
		y: random(`star-y-${i}`) * 100,
		size: 1 + random(`star-s-${i}`) * 2,
		twinkle: random(`star-t-${i}`) * Math.PI * 2,
	}));

	return (
		<AbsoluteFill style={{ background: "#0a0a1a" }}>
			{/* 星空 */}
			{stars.map((star, i) => {
				const twinkle = Math.sin((frame - startDelay) * 0.1 + star.twinkle) * 0.5 + 0.5;
				return (
					<div
						key={`cosmic-star-${i}-${star.x.toFixed(2)}`}
						style={{
							position: "absolute",
							left: `${star.x}%`,
							top: `${star.y}%`,
							width: star.size,
							height: star.size,
							borderRadius: "50%",
							background: C.white,
							opacity: twinkle * lerp(frame, [startDelay, startDelay + 30], [0, 1]),
						}}
					/>
				);
			})}

			{/* 惑星 */}
			<div
				style={{
					position: "absolute",
					right: 150,
					top: 150,
					width: 200,
					height: 200,
					borderRadius: "50%",
					background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
					boxShadow: `
            inset -30px -30px 60px rgba(0,0,0,0.5),
            0 0 60px rgba(102, 126, 234, 0.5)
          `,
					opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
				}}
			/>

			{/* リング */}
			<div
				style={{
					position: "absolute",
					right: 80,
					top: 220,
					width: 340,
					height: 60,
					border: "2px solid rgba(255, 255, 255, 0.3)",
					borderRadius: "50%",
					transform: "rotateX(70deg)",
					opacity: lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]),
				}}
			/>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: "50%",
					transform: "translateY(-50%)",
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "#667eea",
						letterSpacing: 4,
						marginBottom: 15,
					}}
				>
					EXPLORE THE
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 200,
						color: C.white,
						lineHeight: 1,
					}}
				>
					COSMOS
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 18,
						color: C.gray[400],
						marginTop: 20,
					}}
				>
					Beyond infinity
				</div>
			</div>

			{/* 流れ星 */}
			<div
				style={{
					position: "absolute",
					left: `${50 + (frame - startDelay) * 2}%`,
					top: `${20 - (frame - startDelay) * 0.5}%`,
					width: 100,
					height: 2,
					background: "linear-gradient(90deg, #ffffff, transparent)",
					transform: "rotate(-30deg)",
					opacity: Math.sin((frame - startDelay) * 0.1) > 0.8 ? 1 : 0,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeCyberpunk ──

/**
 * ThemeCyberpunk - サイバーパンク - ネオン、グリッチ
 */

export const ThemeCyberpunk = ({ startDelay: _startDelay = 0 }: { startDelay?: number }) => {
	void _startDelay; // 未使用警告を抑制
	const frame = useCurrentFrame();

	const glitchOffset = Math.sin(frame * 0.5) * 3;
	const neonPulse = 0.8 + Math.sin(frame * 0.2) * 0.2;

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* グリッドライン */}
			<AbsoluteFill
				style={{
					backgroundImage: `
            linear-gradient(#ff00ff10 1px, transparent 1px),
            linear-gradient(90deg, #00ffff10 1px, transparent 1px)
          `,
					backgroundSize: "40px 40px",
					perspective: "500px",
					transform: "rotateX(60deg)",
					transformOrigin: "center 200%",
				}}
			/>

			{/* メインテキスト */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: "40%",
					transform: "translateY(-50%)",
				}}
			>
				{/* グリッチレイヤー */}
				<div
					style={{
						position: "absolute",
						fontFamily: font,
						fontSize: 100,
						fontWeight: 900,
						color: "#00ffff",
						opacity: 0.7,
						transform: `translateX(${glitchOffset}px)`,
						clipPath: "inset(0 0 50% 0)",
					}}
				>
					CYBER
				</div>
				<div
					style={{
						position: "absolute",
						fontFamily: font,
						fontSize: 100,
						fontWeight: 900,
						color: "#ff00ff",
						opacity: 0.7,
						transform: `translateX(${-glitchOffset}px)`,
						clipPath: "inset(50% 0 0 0)",
					}}
				>
					CYBER
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 100,
						fontWeight: 900,
						color: C.white,
						textShadow: `
              0 0 10px #ff00ff,
              0 0 20px #ff00ff,
              0 0 40px #ff00ff
            `,
						opacity: neonPulse,
					}}
				>
					CYBER
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 100,
						fontWeight: 900,
						color: "#00ffff",
						textShadow: `
              0 0 10px #00ffff,
              0 0 20px #00ffff,
              0 0 40px #00ffff
            `,
						marginTop: -20,
						opacity: neonPulse,
					}}
				>
					PUNK
				</div>
			</div>

			{/* スキャンライン */}
			<AbsoluteFill
				style={{
					background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          )`,
					pointerEvents: "none",
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeDarkMode ──

/**
 * ThemeDarkMode - ダークモード - 深い黒、微妙なグラデ
 */

export const ThemeDarkMode = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const glowIntensity = 0.5 + Math.sin(frame * 0.1) * 0.2;

	return (
		<AbsoluteFill
			style={{
				background: "linear-gradient(180deg, #0d0d0d 0%, #1a1a2e 100%)",
			}}
		>
			{/* 背景グロー */}
			<div
				style={{
					position: "absolute",
					left: "30%",
					top: "40%",
					width: 400,
					height: 400,
					borderRadius: "50%",
					background: "radial-gradient(circle, #6366f120 0%, transparent 70%)",
					filter: "blur(60px)",
					opacity: glowIntensity,
				}}
			/>

			{/* コンテンツ */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: "50%",
					transform: "translateY(-50%)",
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.accent,
						letterSpacing: 3,
						marginBottom: 20,
						opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
					}}
				>
					DARK MODE
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 56,
						fontWeight: 600,
						color: C.white,
						lineHeight: 1.2,
						opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
					}}
				>
					Easy on
					<br />
					the eyes
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.gray[600],
						marginTop: 25,
						opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
					}}
				>
					Designed for low-light environments
				</div>
			</div>

			{/* カード */}
			<div
				style={{
					position: "absolute",
					right: 100,
					top: "50%",
					transform: "translateY(-50%)",
					width: 280,
					background: "#1f1f2e",
					borderRadius: 16,
					padding: 25,
					border: "1px solid #2d2d3a",
					opacity: lerp(frame, [startDelay + 25, startDelay + 45], [0, 1]),
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15 }}>
					<div
						style={{
							width: 40,
							height: 40,
							borderRadius: "50%",
							background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
						}}
					/>
					<div>
						<div style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: C.white }}>
							Notification
						</div>
						<div style={{ fontFamily: font, fontSize: 12, color: C.gray[600] }}>Just now</div>
					</div>
				</div>
				<div style={{ fontFamily: font, fontSize: 14, color: C.gray[400], lineHeight: 1.6 }}>
					Your dark mode preferences have been saved.
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeDuotone ──

/**
 * ThemeDuotone - Duotone - デュオトーン
 */

export const ThemeDuotone = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const splitProgress = lerp(frame, [startDelay, startDelay + 30], [50, 0], EASE.out);
	const textOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* 左半分（シアン） */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: "50%",
					height: "100%",
					background: "#00d9ff",
					clipPath: `polygon(0 0, ${100 - splitProgress}% 0, ${100 - splitProgress}% 100%, 0 100%)`,
				}}
			/>

			{/* 右半分（マゼンタ） */}
			<div
				style={{
					position: "absolute",
					right: 0,
					top: 0,
					width: "50%",
					height: "100%",
					background: "#ff0080",
					clipPath: `polygon(${splitProgress}% 0, 100% 0, 100% 100%, ${splitProgress}% 100%)`,
				}}
			/>

			{/* オーバーレイ（中央にブレンド） */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: 0,
					width: 100,
					height: "100%",
					transform: "translateX(-50%)",
					background: "linear-gradient(90deg, #00d9ff, #ff0080)",
					mixBlendMode: "multiply",
					opacity: 0.5,
				}}
			/>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					textAlign: "center",
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 120,
						fontWeight: 900,
						color: C.white,
						mixBlendMode: "difference",
					}}
				>
					DUO
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 120,
						fontWeight: 100,
						color: C.white,
						mixBlendMode: "difference",
						marginTop: -30,
					}}
				>
					TONE
				</div>
			</div>

			{/* ハーフトーンパターン */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `radial-gradient(${C.black} 1px, transparent 1px)`,
					backgroundSize: "8px 8px",
					opacity: 0.1,
					mixBlendMode: "multiply",
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeGeometricAbstract ──

/**
 * ThemeGeometricAbstract - Geometric Abstraction - 幾何学抽象
 */

export const ThemeGeometricAbstract = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const shapes = [
		{ type: "rect", x: 100, y: 100, w: 200, h: 150, color: "#264653", rotation: 15, delay: 0 },
		{ type: "rect", x: 250, y: 250, w: 180, h: 180, color: "#2a9d8f", rotation: -10, delay: 5 },
		{ type: "circle", x: 500, y: 150, r: 100, color: "#e9c46a", delay: 10 },
		{ type: "rect", x: 700, y: 300, w: 250, h: 100, color: "#f4a261", rotation: 25, delay: 15 },
		{ type: "circle", x: 900, y: 200, r: 80, color: "#e76f51", delay: 8 },
		{ type: "rect", x: 150, y: 450, w: 300, h: 80, color: "#264653", rotation: -5, delay: 12 },
	];

	return (
		<AbsoluteFill style={{ background: "#fafafa" }}>
			{shapes.map((shape) => {
				const progress = spring({
					frame: frame - startDelay - shape.delay,
					fps,
					config: { damping: 15, stiffness: 100 },
				});

				if (shape.type === "rect") {
					return (
						<div
							key={`geo-${shape.x}-${shape.y}-${shape.color}`}
							style={{
								position: "absolute",
								left: shape.x,
								top: shape.y,
								width: shape.w,
								height: shape.h,
								background: shape.color,
								transform: `scale(${progress}) rotate(${shape.rotation}deg)`,
								transformOrigin: "center",
							}}
						/>
					);
				}
				return (
					<div
						key={`geo-circle-${shape.x}-${shape.y}`}
						style={{
							position: "absolute",
							left: shape.x,
							top: shape.y,
							width: (shape.r ?? 50) * 2,
							height: (shape.r ?? 50) * 2,
							borderRadius: "50%",
							background: shape.color,
							transform: `scale(${progress})`,
						}}
					/>
				);
			})}

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: 80,
					textAlign: "right",
					opacity: lerp(frame, [startDelay + 25, startDelay + 45], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 48,
						fontWeight: 800,
						color: "#264653",
					}}
				>
					ABSTRACT
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[400],
						letterSpacing: 3,
						marginTop: 10,
					}}
				>
					GEOMETRIC COMPOSITION
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeGlassmorphism ──

/**
 * ThemeGlassmorphism - グラスモーフィズム - 半透明、ブラー
 */

export const ThemeGlassmorphism = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cardProgress = spring({
		frame: frame - startDelay - 10,
		fps,
		config: { damping: 20, stiffness: 100 },
	});

	return (
		<AbsoluteFill
			style={{
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
			}}
		>
			{/* 背景の装飾円 */}
			<div
				style={{
					position: "absolute",
					left: -100,
					top: -100,
					width: 400,
					height: 400,
					borderRadius: "50%",
					background: "#ffffff30",
				}}
			/>
			<div
				style={{
					position: "absolute",
					right: -50,
					bottom: -50,
					width: 300,
					height: 300,
					borderRadius: "50%",
					background: "#ffffff20",
				}}
			/>

			{/* グラスカード */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: `translate(-50%, -50%) scale(${cardProgress})`,
					width: 500,
					background: "rgba(255, 255, 255, 0.15)",
					backdropFilter: "blur(20px)",
					WebkitBackdropFilter: "blur(20px)",
					borderRadius: 24,
					border: "1px solid rgba(255, 255, 255, 0.3)",
					padding: 50,
					opacity: cardProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "rgba(255, 255, 255, 0.7)",
						letterSpacing: 3,
						marginBottom: 20,
					}}
				>
					GLASSMORPHISM
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 42,
						fontWeight: 600,
						color: C.white,
						lineHeight: 1.2,
					}}
				>
					Frosted Glass
					<br />
					Effect
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeGradient ──

/**
 * ThemeGradient - グラデーション - カラフルなグラデ
 */

export const ThemeGradient = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const gradientAngle = 135 + frame * 0.5;

	return (
		<AbsoluteFill
			style={{
				background: `linear-gradient(${gradientAngle}deg, 
          #667eea 0%, 
          #764ba2 25%, 
          #f093fb 50%, 
          #f5576c 75%, 
          #feca57 100%
        )`,
			}}
		>
			{/* オーバーレイ */}
			<AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />

			{/* テキスト */}
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
						fontSize: 120,
						fontWeight: 900,
						color: C.white,
						textShadow: "0 4px 30px rgba(0,0,0,0.3)",
						opacity: lerp(frame, [startDelay, startDelay + 25], [0, 1]),
						transform: `scale(${lerp(frame, [startDelay, startDelay + 25], [0.8, 1], EASE.out)})`,
					}}
				>
					Gradient
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 20,
						color: "rgba(255,255,255,0.8)",
						letterSpacing: 5,
						marginTop: 20,
						opacity: lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]),
					}}
				>
					FLOW WITH COLORS
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeHolographic ──

/**
 * ThemeHolographic - Holographic - ホログラフィック
 */

export const ThemeHolographic = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const shimmer = (frame - startDelay) * 3;
	const textOpacity = lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]);

	return (
		<AbsoluteFill style={{ background: "#1a1a2e" }}>
			{/* ホログラフィック背景 */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: `
            linear-gradient(
              ${shimmer}deg,
              rgba(255, 0, 128, 0.3) 0%,
              rgba(0, 255, 255, 0.3) 25%,
              rgba(255, 255, 0, 0.3) 50%,
              rgba(128, 0, 255, 0.3) 75%,
              rgba(255, 0, 128, 0.3) 100%
            )
          `,
					opacity: 0.5,
				}}
			/>

			{/* プリズムカード */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: 450,
					height: 300,
					borderRadius: 20,
					background: `
            linear-gradient(
              ${shimmer + 45}deg,
              rgba(255, 100, 200, 0.4) 0%,
              rgba(100, 200, 255, 0.4) 33%,
              rgba(200, 255, 100, 0.4) 66%,
              rgba(255, 100, 200, 0.4) 100%
            )
          `,
					backdropFilter: "blur(10px)",
					border: "1px solid rgba(255, 255, 255, 0.3)",
					boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
					padding: 40,
					opacity: textOpacity,
				}}
			>
				{/* 虹色ライン */}
				<div
					style={{
						position: "absolute",
						top: 20,
						left: 20,
						right: 20,
						height: 3,
						background: `linear-gradient(90deg, #ff0080, #00ffff, #ffff00, #ff0080)`,
						backgroundSize: "200% 100%",
						backgroundPosition: `${shimmer}% 0`,
						borderRadius: 2,
					}}
				/>

				<div
					style={{
						marginTop: 40,
						fontFamily: font,
						fontSize: 14,
						color: "rgba(255, 255, 255, 0.7)",
						letterSpacing: 3,
					}}
				>
					IRIDESCENT
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 56,
						fontWeight: 700,
						background: `linear-gradient(${shimmer}deg, #ff0080, #00ffff, #ffff00)`,
						backgroundClip: "text",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						marginTop: 10,
					}}
				>
					HOLOGRAM
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeIndustrial ──

/**
 * ThemeIndustrial - Industrial - 工業的
 */

export const ThemeIndustrial = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const gearRotation = (frame - startDelay) * 0.5;
	const textOpacity = lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]);

	return (
		<AbsoluteFill style={{ background: "#2d2d2d" }}>
			{/* 金属テクスチャ */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 4px,
              rgba(255,255,255,0.02) 4px,
              rgba(255,255,255,0.02) 5px
            )
          `,
				}}
			/>

			{/* ギア */}
			<svg
				style={{
					position: "absolute",
					right: 100,
					top: 100,
					transform: `rotate(${gearRotation}deg)`,
					opacity: lerp(frame, [startDelay, startDelay + 20], [0, 0.3]),
				}}
				width="300"
				height="300"
				viewBox="0 0 100 100"
				aria-hidden="true"
			>
				<path
					d="M50 10 L55 25 L65 20 L60 35 L75 35 L65 45 L80 50 L65 55 L75 65 L60 65 L65 80 L55 75 L50 90 L45 75 L35 80 L40 65 L25 65 L35 55 L20 50 L35 45 L25 35 L40 35 L35 20 L45 25 Z"
					fill="#ff6600"
				/>
				<circle cx="50" cy="50" r="15" fill="#2d2d2d" />
			</svg>

			<svg
				style={{
					position: "absolute",
					right: 300,
					top: 250,
					transform: `rotate(${-gearRotation * 0.8}deg)`,
					opacity: lerp(frame, [startDelay + 5, startDelay + 25], [0, 0.2]),
				}}
				width="200"
				height="200"
				viewBox="0 0 100 100"
				aria-hidden="true"
			>
				<path
					d="M50 10 L55 25 L65 20 L60 35 L75 35 L65 45 L80 50 L65 55 L75 65 L60 65 L65 80 L55 75 L50 90 L45 75 L35 80 L40 65 L25 65 L35 55 L20 50 L35 45 L25 35 L40 35 L35 20 L45 25 Z"
					fill="#666666"
				/>
				<circle cx="50" cy="50" r="15" fill="#2d2d2d" />
			</svg>

			{/* 警告ストライプ */}
			<div
				style={{
					position: "absolute",
					left: 0,
					bottom: 0,
					width: "100%",
					height: 20,
					background: `repeating-linear-gradient(
            45deg,
            #ff6600,
            #ff6600 20px,
            #1a1a1a 20px,
            #1a1a1a 40px
          )`,
					opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
				}}
			/>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: "50%",
					transform: "translateY(-50%)",
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "#ff6600",
						letterSpacing: 4,
						marginBottom: 15,
					}}
				>
					HEAVY DUTY
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 900,
						color: C.white,
						lineHeight: 1,
						textTransform: "uppercase",
					}}
				>
					INDUSTRIAL
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.gray[400],
						marginTop: 20,
						letterSpacing: 2,
					}}
				>
					BUILT TO LAST — SINCE 1892
				</div>
			</div>

			{/* ボルト装飾 */}
			{[
				{ x: 40, y: 40 },
				{ x: 1200, y: 40 },
				{ x: 40, y: 640 },
				{ x: 1200, y: 640 },
			].map((pos) => (
				<div
					key={`bolt-${pos.x}-${pos.y}`}
					style={{
						position: "absolute",
						left: pos.x,
						top: pos.y,
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "#444444",
						border: "2px solid #555555",
						boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
						opacity: textOpacity,
					}}
				/>
			))}
		</AbsoluteFill>
	);
};

// ── ThemeIsometric ──

/**
 * ThemeIsometric - 3D/イソメトリック
 */

export const ThemeIsometric = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cubeProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	return (
		<AbsoluteFill style={{ background: "#1a1a2e" }}>
			{/* イソメトリックグリッド */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%) rotateX(60deg) rotateZ(45deg)",
					transformStyle: "preserve-3d",
				}}
			>
				{/* キューブ群 */}
				{[0, 1, 2].map((row) =>
					[0, 1, 2].map((col) => {
						const delay = (row + col) * 5;
						const height = 40 + random(`cube-${row}-${col}`) * 60;
						const progress = spring({
							frame: frame - startDelay - delay,
							fps,
							config: { damping: 12, stiffness: 150 },
						});

						const colors = [C.accent, "#8b5cf6", "#a855f7"];
						const color = colors[(row + col) % 3];

						return (
							<div
								key={`iso-cube-${row}-${col}`}
								style={{
									position: "absolute",
									left: col * 80,
									top: row * 80,
									width: 60,
									height: height * progress,
									background: color,
									transformStyle: "preserve-3d",
									transform: `translateZ(${height * progress}px)`,
									boxShadow: `
                    20px 20px 0 ${color}99,
                    40px 40px 0 ${color}66
                  `,
								}}
							/>
						);
					}),
				)}
			</div>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: 80,
					bottom: 100,
					opacity: cubeProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 48,
						fontWeight: 700,
						color: C.white,
					}}
				>
					3D Space
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.gray[400],
						marginTop: 10,
					}}
				>
					Isometric perspective
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeJapanese ──

/**
 * ThemeJapanese - 和風/ジャパニーズ - 余白、縦書き
 */

export const ThemeJapanese = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]);
	const lineHeight = lerp(frame, [startDelay + 20, startDelay + 50], [0, 300], EASE.out);

	return (
		<AbsoluteFill style={{ background: "#f5f0e8" }}>
			{/* 縦書きテキスト */}
			<div
				style={{
					position: "absolute",
					right: 150,
					top: 100,
					writingMode: "vertical-rl",
					fontFamily: font,
					fontSize: 60,
					fontWeight: 300,
					color: "#2d2d2d",
					letterSpacing: 15,
					opacity: textOpacity,
				}}
			>
				静寂の美
			</div>

			{/* 横書きサブテキスト */}
			<div
				style={{
					position: "absolute",
					left: 100,
					bottom: 150,
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[400],
						letterSpacing: 4,
						marginBottom: 15,
					}}
				>
					JAPANESE AESTHETICS
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 28,
						fontWeight: 300,
						color: "#2d2d2d",
					}}
				>
					The beauty of
					<br />
					empty space
				</div>
			</div>

			{/* 縦線装飾 */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: 100,
					width: 1,
					height: lineHeight,
					background: "#c4a77d",
				}}
			/>

			{/* 円（家紋風） */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: 80,
					width: 60,
					height: 60,
					borderRadius: "50%",
					border: "1px solid #c4a77d",
					opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 0.5]),
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeLuxury ──

/**
 * ThemeLuxury - ラグジュアリー - ゴールド、高級感
 */

export const ThemeLuxury = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]);
	const lineWidth = lerp(frame, [startDelay + 25, startDelay + 55], [0, 200], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* 金色のライン装飾 */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: 80,
					right: 80,
					bottom: 80,
					border: "1px solid #c9a962",
					opacity: 0.3,
				}}
			/>

			{/* メインコンテンツ */}
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
						color: "#c9a962",
						letterSpacing: 10,
						marginBottom: 30,
						opacity: textOpacity,
					}}
				>
					PREMIUM COLLECTION
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 72,
						fontWeight: 200,
						color: C.white,
						letterSpacing: 20,
						textTransform: "uppercase",
						opacity: textOpacity,
					}}
				>
					Luxury
				</div>
				<div
					style={{
						width: lineWidth,
						height: 1,
						background: "linear-gradient(90deg, transparent, #c9a962, transparent)",
						margin: "30px auto",
					}}
				/>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.gray[400],
						letterSpacing: 3,
						opacity: textOpacity,
					}}
				>
					Timeless Elegance
				</div>
			</div>

			{/* コーナー装飾 */}
			<div
				style={{
					position: "absolute",
					left: 60,
					top: 60,
					width: 40,
					height: 40,
					borderLeft: "1px solid #c9a962",
					borderTop: "1px solid #c9a962",
					opacity: textOpacity,
				}}
			/>
			<div
				style={{
					position: "absolute",
					right: 60,
					bottom: 60,
					width: 40,
					height: 40,
					borderRight: "1px solid #c9a962",
					borderBottom: "1px solid #c9a962",
					opacity: textOpacity,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeMemphis ──

/**
 * ThemeMemphis - Memphis - メンフィスデザイン
 */

export const ThemeMemphis = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const bounceProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 8, stiffness: 150 },
	});

	const shapes = [
		{ type: "circle", x: 100, y: 150, size: 80, color: "#ff6b6b", delay: 0 },
		{ type: "triangle", x: 200, y: 400, size: 100, color: "#4ecdc4", delay: 5 },
		{ type: "zigzag", x: 900, y: 200, size: 120, color: "#ffe66d", delay: 10 },
		{ type: "circle", x: 1000, y: 500, size: 60, color: "#ff6b6b", delay: 15 },
		{ type: "squiggle", x: 150, y: 550, size: 80, color: "#95e1d3", delay: 8 },
	];

	return (
		<AbsoluteFill style={{ background: "#ffeaa7" }}>
			{/* ドットパターン背景 */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `radial-gradient(${C.black} 2px, transparent 2px)`,
					backgroundSize: "30px 30px",
					opacity: 0.1,
				}}
			/>

			{/* シェイプ */}
			{shapes.map((shape, i) => {
				const shapeProgress = spring({
					frame: frame - startDelay - shape.delay,
					fps,
					config: { damping: 10, stiffness: 200 },
				});

				return (
					<div
						key={`memphis-${shape.type}-${shape.x}-${shape.y}`}
						style={{
							position: "absolute",
							left: shape.x,
							top: shape.y,
							transform: `scale(${shapeProgress}) rotate(${(frame - startDelay) * (i % 2 === 0 ? 1 : -1)}deg)`,
						}}
					>
						{shape.type === "circle" && (
							<div
								style={{
									width: shape.size,
									height: shape.size,
									borderRadius: "50%",
									background: shape.color,
									border: `4px solid ${C.black}`,
								}}
							/>
						)}
						{shape.type === "triangle" && (
							<div
								style={{
									width: 0,
									height: 0,
									borderLeft: `${shape.size / 2}px solid transparent`,
									borderRight: `${shape.size / 2}px solid transparent`,
									borderBottom: `${shape.size}px solid ${shape.color}`,
								}}
							/>
						)}
						{shape.type === "zigzag" && (
							<svg width={shape.size} height={shape.size / 2} aria-hidden="true">
								<path
									d={`M0 ${shape.size / 4} L${shape.size / 4} 0 L${shape.size / 2} ${shape.size / 4} L${shape.size * 0.75} 0 L${shape.size} ${shape.size / 4}`}
									stroke={shape.color}
									strokeWidth="8"
									fill="none"
								/>
							</svg>
						)}
						{shape.type === "squiggle" && (
							<svg width={shape.size} height={shape.size / 2} aria-hidden="true">
								<path
									d={`M0 ${shape.size / 4} Q${shape.size / 4} 0 ${shape.size / 2} ${shape.size / 4} Q${shape.size * 0.75} ${shape.size / 2} ${shape.size} ${shape.size / 4}`}
									stroke={shape.color}
									strokeWidth="6"
									fill="none"
								/>
							</svg>
						)}
					</div>
				);
			})}

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: `translate(-50%, -50%) scale(${bounceProgress})`,
					textAlign: "center",
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 100,
						fontWeight: 900,
						color: C.black,
						textShadow: "6px 6px 0 #ff6b6b, 12px 12px 0 #4ecdc4",
					}}
				>
					MEMPHIS
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 20,
						fontWeight: 700,
						color: C.black,
						letterSpacing: 15,
						marginTop: 10,
					}}
				>
					DESIGN GROUP
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeMinimalist ──

/**
 * ThemeMinimalist - ミニマリスト - 極限のシンプル
 */

export const ThemeMinimalist = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);
	const lineWidth = lerp(frame, [startDelay + 30, startDelay + 60], [0, 100], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.white }}>
			<div
				style={{
					position: "absolute",
					left: 100,
					bottom: 150,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 72,
						fontWeight: 300,
						color: C.black,
						letterSpacing: -2,
						opacity: textOpacity,
					}}
				>
					Less is more.
				</div>
				<div
					style={{
						width: lineWidth,
						height: 1,
						background: C.black,
						marginTop: 30,
					}}
				/>
			</div>

			{/* 右上の小さなアクセント */}
			<div
				style={{
					position: "absolute",
					right: 100,
					top: 100,
					width: 8,
					height: 8,
					background: C.black,
					opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeMonochrome ──

/**
 * ThemeMonochrome - モノクローム - 白黒の美学
 */

export const ThemeMonochrome = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const blockProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* 黒いブロック */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: `${blockProgress * 60}%`,
					height: "100%",
					background: C.black,
				}}
			/>

			{/* 白テキスト（黒背景上） */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: "50%",
					transform: "translateY(-50%)",
					opacity: lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 700,
						color: C.white,
						lineHeight: 0.9,
					}}
				>
					BLACK
				</div>
			</div>

			{/* 黒テキスト（白背景上） */}
			<div
				style={{
					position: "absolute",
					right: 80,
					top: "50%",
					transform: "translateY(-50%)",
					textAlign: "right",
					opacity: lerp(frame, [startDelay + 25, startDelay + 45], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 700,
						color: C.black,
						lineHeight: 0.9,
					}}
				>
					WHITE
				</div>
			</div>

			{/* 中央の境界線 */}
			<div
				style={{
					position: "absolute",
					left: "60%",
					top: 100,
					width: 1,
					height: lerp(frame, [startDelay + 20, startDelay + 50], [0, 520], EASE.out),
					background: C.gray[400],
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeNatural ──

/**
 * ThemeNatural - ナチュラル/オーガニック - 自然、アースカラー
 */

export const ThemeNatural = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const leafSway = Math.sin(frame * 0.05) * 5;

	return (
		<AbsoluteFill style={{ background: "#f5f1eb" }}>
			{/* 有機的な形状 */}
			<div
				style={{
					position: "absolute",
					right: -100,
					top: -100,
					width: 500,
					height: 500,
					borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
					background: "#d4c5b0",
					opacity: 0.3,
					transform: `rotate(${leafSway}deg)`,
				}}
			/>

			<div
				style={{
					position: "absolute",
					left: -50,
					bottom: -50,
					width: 300,
					height: 300,
					borderRadius: "40% 60% 70% 30% / 40% 70% 30% 60%",
					background: "#8b9a7d",
					opacity: 0.2,
					transform: `rotate(${-leafSway}deg)`,
				}}
			/>

			{/* コンテンツ */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: "50%",
					transform: "translateY(-50%)",
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "#8b9a7d",
						letterSpacing: 4,
						marginBottom: 20,
						opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
					}}
				>
					ORGANIC • NATURAL • PURE
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 64,
						fontWeight: 300,
						color: "#3d3d3d",
						lineHeight: 1.1,
						opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
					}}
				>
					Back to
					<br />
					<span style={{ fontWeight: 600, color: "#5a6b4d" }}>Nature</span>
				</div>
			</div>

			{/* 葉のアイコン */}
			<svg
				style={{
					position: "absolute",
					right: 150,
					top: "50%",
					transform: `translateY(-50%) rotate(${leafSway}deg)`,
					opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
				}}
				width="120"
				height="120"
				viewBox="0 0 120 120"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M60 10 C30 30, 20 60, 40 90 C50 100, 70 100, 80 90 C100 60, 90 30, 60 10"
					fill="#8b9a7d"
					opacity="0.6"
				/>
				<path d="M60 20 L60 100" stroke="#5a6b4d" strokeWidth="2" />
			</svg>
		</AbsoluteFill>
	);
};

// ── ThemeNeobrutalism ──

/**
 * ThemeNeobrutalism - ネオブルタリズム - 太い枠線、原色、影
 */

export const ThemeNeobrutalism = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cardProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 12, stiffness: 200 },
	});

	return (
		<AbsoluteFill style={{ background: "#fffdf0" }}>
			{/* メインカード */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: 150,
					width: 500,
					background: "#ff6b6b",
					border: "4px solid #000000",
					boxShadow: "8px 8px 0 #000000",
					padding: 40,
					transform: `scale(${cardProgress}) rotate(-2deg)`,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 48,
						fontWeight: 900,
						color: C.black,
						textTransform: "uppercase",
					}}
				>
					Bold &amp;
					<br />
					Brutal
				</div>
			</div>

			{/* サブカード */}
			<div
				style={{
					position: "absolute",
					right: 100,
					bottom: 150,
					width: 300,
					background: "#4ecdc4",
					border: "4px solid #000000",
					boxShadow: "8px 8px 0 #000000",
					padding: 30,
					transform: `translateY(${(1 - cardProgress) * 50}px) rotate(3deg)`,
					opacity: cardProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 20,
						fontWeight: 700,
						color: C.black,
					}}
				>
					Raw aesthetics with purpose
				</div>
			</div>

			{/* 装飾要素 */}
			<div
				style={{
					position: "absolute",
					right: 200,
					top: 100,
					width: 60,
					height: 60,
					background: "#ffe66d",
					border: "4px solid #000000",
					transform: `rotate(${frame * 2}deg)`,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeNeon ──

/**
 * ThemeNeon - Neon - ネオン
 */

export const ThemeNeon = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const flicker = Math.sin((frame - startDelay) * 0.5) > 0.95 ? 0.7 : 1;
	const glowPulse = 0.8 + Math.sin((frame - startDelay) * 0.1) * 0.2;
	const textOpacity = lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]);

	return (
		<AbsoluteFill style={{ background: C.black }}>
			{/* レンガ壁テクスチャ */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `
            linear-gradient(90deg, #1a1a1a 1px, transparent 1px),
            linear-gradient(0deg, #1a1a1a 1px, transparent 1px)
          `,
					backgroundSize: "60px 25px",
					opacity: 0.3,
				}}
			/>

			{/* ネオンテキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					textAlign: "center",
					opacity: textOpacity * flicker,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 100,
						fontWeight: 700,
						color: "#ff00ff",
						textShadow: `
              0 0 10px #ff00ff,
              0 0 20px #ff00ff,
              0 0 40px #ff00ff,
              0 0 80px #ff00ff
            `,
						filter: `brightness(${glowPulse})`,
					}}
				>
					NEON
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 40,
						fontWeight: 300,
						color: "#00ffff",
						textShadow: `
              0 0 10px #00ffff,
              0 0 20px #00ffff,
              0 0 40px #00ffff
            `,
						marginTop: 20,
						filter: `brightness(${glowPulse})`,
					}}
				>
					LIGHTS
				</div>
			</div>

			{/* 装飾ネオン */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: 100,
					width: 150,
					height: 150,
					border: "3px solid #ff6b6b",
					borderRadius: "50%",
					boxShadow: `
            0 0 10px #ff6b6b,
            0 0 20px #ff6b6b,
            inset 0 0 10px #ff6b6b
          `,
					opacity: textOpacity * flicker,
				}}
			/>

			<div
				style={{
					position: "absolute",
					right: 100,
					bottom: 100,
					width: 200,
					height: 3,
					background: "#ffe66d",
					boxShadow: `
            0 0 10px #ffe66d,
            0 0 20px #ffe66d
          `,
					opacity: textOpacity,
				}}
			/>
		</AbsoluteFill>
	);
};

// ── ThemeNeumorphism ──

/**
 * ThemeNeumorphism - ニューモーフィズム - ソフトな凹凸
 */

export const ThemeNeumorphism = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cardProgress = spring({
		frame: frame - startDelay - 10,
		fps,
		config: { damping: 20, stiffness: 100 },
	});

	const bgColor = "#e0e5ec";

	return (
		<AbsoluteFill style={{ background: bgColor }}>
			{/* メインカード */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: `translate(-50%, -50%) scale(${cardProgress})`,
					width: 400,
					background: bgColor,
					borderRadius: 30,
					padding: 40,
					boxShadow: `
            20px 20px 60px #bec3c9,
            -20px -20px 60px #ffffff
          `,
					opacity: cardProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: "#7a8594",
						letterSpacing: 3,
						marginBottom: 20,
					}}
				>
					NEUMORPHISM
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 36,
						fontWeight: 600,
						color: "#3d4a5c",
						marginBottom: 30,
					}}
				>
					Soft UI
				</div>

				{/* ボタン（凸） */}
				<button
					type="button"
					style={{
						fontFamily: font,
						fontSize: 15,
						fontWeight: 500,
						color: C.accent,
						background: bgColor,
						border: "none",
						borderRadius: 15,
						padding: "15px 35px",
						cursor: "pointer",
						boxShadow: `
              8px 8px 16px #bec3c9,
              -8px -8px 16px #ffffff
            `,
					}}
				>
					Press me
				</button>

				{/* インプット（凹） */}
				<div
					style={{
						marginTop: 25,
						background: bgColor,
						borderRadius: 15,
						padding: "15px 20px",
						boxShadow: `
              inset 8px 8px 16px #bec3c9,
              inset -8px -8px 16px #ffffff
            `,
					}}
				>
					<span style={{ fontFamily: font, fontSize: 14, color: "#9aa5b4" }}>
						Type something...
					</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeOrganic ──

/**
 * ThemeOrganic - Organic - オーガニック/流動的
 */

export const ThemeOrganic = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const morphProgress = (frame - startDelay) * 0.02;
	const textOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);

	// 流動的な形状の座標を計算
	const blobRadius1 = `${50 + Math.sin(morphProgress) * 10}% ${50 + Math.cos(morphProgress * 1.5) * 15}% ${50 + Math.sin(morphProgress * 0.8) * 12}% ${50 + Math.cos(morphProgress) * 10}% / ${50 + Math.sin(morphProgress * 1.2) * 10}% ${50 + Math.cos(morphProgress * 0.7) * 12}% ${50 + Math.sin(morphProgress * 1.1) * 15}% ${50 + Math.cos(morphProgress * 0.9) * 10}%`;

	return (
		<AbsoluteFill style={{ background: "#faf8f5" }}>
			{/* 流動的な背景ブロブ */}
			<div
				style={{
					position: "absolute",
					left: "60%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: 500,
					height: 500,
					borderRadius: blobRadius1,
					background: "linear-gradient(135deg, #a8e6cf 0%, #88d8b0 100%)",
					opacity: lerp(frame, [startDelay, startDelay + 30], [0, 0.8]),
				}}
			/>

			<div
				style={{
					position: "absolute",
					left: "30%",
					top: "40%",
					transform: "translate(-50%, -50%)",
					width: 300,
					height: 300,
					borderRadius: `${60 + Math.cos(morphProgress * 1.3) * 10}% ${40 + Math.sin(morphProgress) * 15}% ${50 + Math.cos(morphProgress * 0.9) * 10}% ${50 + Math.sin(morphProgress * 1.1) * 12}% / ${45 + Math.cos(morphProgress * 0.8) * 15}% ${55 + Math.sin(morphProgress * 1.2) * 10}% ${45 + Math.cos(morphProgress) * 12}% ${55 + Math.sin(morphProgress * 0.7) * 10}%`,
					background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
					opacity: lerp(frame, [startDelay + 10, startDelay + 35], [0, 0.7]),
				}}
			/>

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: 100,
					top: "50%",
					transform: "translateY(-50%)",
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[400],
						letterSpacing: 4,
						marginBottom: 15,
					}}
				>
					FLUID FORMS
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 64,
						fontWeight: 300,
						color: C.gray[800],
						lineHeight: 1.1,
					}}
				>
					Organic
					<br />
					<span style={{ fontWeight: 600 }}>Shapes</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemePaperCut ──

/**
 * ThemePaperCut - Paper Cut - ペーパーカット
 */

export const ThemePaperCut = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const layers = [
		{ color: "#ff6b6b", offset: 60, z: 40 },
		{ color: "#4ecdc4", offset: 120, z: 30 },
		{ color: "#ffe66d", offset: 180, z: 20 },
		{ color: "#95e1d3", offset: 240, z: 10 },
	];

	return (
		<AbsoluteFill style={{ background: "#fafafa" }}>
			{/* ペーパーレイヤー */}
			{layers.map((layer) => {
				const layerProgress = spring({
					frame: frame - startDelay - (layer.z / 10) * 3,
					fps,
					config: { damping: 15, stiffness: 100 },
				});

				return (
					<div
						key={`paper-${layer.color}`}
						style={{
							position: "absolute",
							left: layer.offset,
							top: 100 + layer.z * 2,
							width: 400,
							height: 500,
							background: layer.color,
							borderRadius: 8,
							boxShadow: `
                ${layer.z / 4}px ${layer.z / 2}px ${layer.z}px rgba(0,0,0,0.15)
              `,
							transform: `
                translateY(${(1 - layerProgress) * 100}px)
                rotate(${-5 + layer.z / 10}deg)
              `,
							opacity: layerProgress,
						}}
					/>
				);
			})}

			{/* メインカード */}
			<div
				style={{
					position: "absolute",
					right: 100,
					top: 150,
					width: 450,
					height: 420,
					background: C.white,
					borderRadius: 8,
					boxShadow: "8px 16px 32px rgba(0,0,0,0.15)",
					padding: 50,
					transform: `translateY(${lerp(frame, [startDelay, startDelay + 30], [50, 0])}px)`,
					opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[400],
						letterSpacing: 3,
						marginBottom: 20,
					}}
				>
					LAYERED DESIGN
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 64,
						fontWeight: 800,
						color: C.gray[900],
						lineHeight: 1.1,
					}}
				>
					Paper
					<br />
					Cut
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 16,
						color: C.gray[600],
						marginTop: 30,
						lineHeight: 1.6,
					}}
				>
					Depth through layers
					<br />
					and shadow effects
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemePop ──

/**
 * ThemePop - ポップ/カラフル - 鮮やかな色
 */

export const ThemePop = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const colors = ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#1dd1a1"];

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* カラフルなブロック */}
			{colors.map((color, i) => {
				const progress = spring({
					frame: frame - startDelay - i * 5,
					fps,
					config: { damping: 12, stiffness: 200 },
				});

				return (
					<div
						key={`pop-block-${color}`}
						style={{
							position: "absolute",
							left: 80 + i * 220,
							top: 150 + (i % 2) * 100,
							width: 180,
							height: 180,
							background: color,
							borderRadius: 20,
							transform: `scale(${progress}) rotate(${(i - 2) * 5}deg)`,
						}}
					/>
				);
			})}

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: 100,
					bottom: 100,
					fontFamily: font,
					fontSize: 80,
					fontWeight: 900,
					color: "#2d3436",
					opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
				}}
			>
				POP!
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeRetro ──

/**
 * ThemeRetro - レトロ/ヴィンテージ - セピア、ノイズ
 */

export const ThemeRetro = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);

	return (
		<AbsoluteFill style={{ background: "#f4e9d8" }}>
			{/* ノイズテクスチャ */}
			<AbsoluteFill
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
					opacity: 0.1,
					mixBlendMode: "multiply",
				}}
			/>

			{/* ビネット */}
			<AbsoluteFill
				style={{
					background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%)",
				}}
			/>

			{/* メインコンテンツ */}
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
						color: "#8b7355",
						letterSpacing: 8,
						marginBottom: 20,
						opacity: textProgress,
					}}
				>
					★ ESTABLISHED 1985 ★
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 80,
						fontWeight: 900,
						color: "#3d3027",
						letterSpacing: -2,
						textTransform: "uppercase",
						opacity: textProgress,
						transform: `translateY(${(1 - textProgress) * 30}px)`,
					}}
				>
					Vintage
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 24,
						fontWeight: 300,
						color: "#6b5a47",
						marginTop: 10,
						fontStyle: "italic",
						opacity: textProgress,
					}}
				>
					Classic Style Never Dies
				</div>

				{/* 装飾線 */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 20,
						marginTop: 30,
						opacity: textProgress,
					}}
				>
					<div style={{ width: 60, height: 1, background: "#8b7355" }} />
					<div
						style={{
							width: 8,
							height: 8,
							background: "#8b7355",
							transform: "rotate(45deg)",
						}}
					/>
					<div style={{ width: 60, height: 1, background: "#8b7355" }} />
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeSwiss ──

/**
 * ThemeSwiss - Swiss/International - スイスデザイン
 */

export const ThemeSwiss = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textProgress = lerp(frame, [startDelay + 10, startDelay + 40], [0, 1], EASE.out);
	const gridProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1]);

	return (
		<AbsoluteFill style={{ background: C.white }}>
			{/* グリッドライン */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `
            linear-gradient(#e0e0e0 1px, transparent 1px),
            linear-gradient(90deg, #e0e0e0 1px, transparent 1px)
          `,
					backgroundSize: "80px 80px",
					opacity: gridProgress * 0.5,
				}}
			/>

			{/* 赤いアクセントブロック */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: lerp(frame, [startDelay, startDelay + 25], [0, 320]),
					height: 160,
					background: "#ff0000",
				}}
			/>

			{/* メインテキスト */}
			<div
				style={{
					position: "absolute",
					left: 80,
					top: 200,
					opacity: textProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 120,
						fontWeight: 800,
						color: C.gray[900],
						lineHeight: 0.9,
						letterSpacing: -5,
					}}
				>
					GRID
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 120,
						fontWeight: 200,
						color: C.gray[900],
						lineHeight: 0.9,
						letterSpacing: -5,
					}}
				>
					SYSTEM
				</div>
			</div>

			{/* サイドテキスト */}
			<div
				style={{
					position: "absolute",
					right: 80,
					top: 200,
					textAlign: "right",
					opacity: textProgress,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[600],
						lineHeight: 2,
					}}
				>
					HELVETICA
					<br />
					NEUE
					<br />
					TYPOGRAPHY
				</div>
			</div>

			{/* 番号 */}
			<div
				style={{
					position: "absolute",
					right: 80,
					bottom: 80,
					fontFamily: font,
					fontSize: 200,
					fontWeight: 100,
					color: "#f0f0f0",
				}}
			>
				21
			</div>

			{/* 下部テキスト */}
			<div
				style={{
					position: "absolute",
					left: 80,
					bottom: 80,
					fontFamily: font,
					fontSize: 12,
					color: C.gray[400],
					letterSpacing: 2,
					opacity: textProgress,
				}}
			>
				INTERNATIONAL TYPOGRAPHIC STYLE — SINCE 1950
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeTech ──

/**
 * ThemeTech - テック/スタートアップ - モダン、クリーン
 */

export const ThemeTech = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cardProgress = spring({
		frame: frame - startDelay - 10,
		fps,
		config: { damping: 20, stiffness: 100 },
	});

	return (
		<AbsoluteFill style={{ background: "#fafafa" }}>
			{/* ヘッダー */}
			<div
				style={{
					position: "absolute",
					left: 60,
					top: 60,
					display: "flex",
					alignItems: "center",
					gap: 15,
					opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
				}}
			>
				<div
					style={{
						width: 36,
						height: 36,
						borderRadius: 10,
						background: `linear-gradient(135deg, ${C.accent}, #8b5cf6)`,
					}}
				/>
				<div style={{ fontFamily: font, fontSize: 18, fontWeight: 600, color: C.gray[900] }}>
					TechCo
				</div>
			</div>

			{/* メインコンテンツ */}
			<div
				style={{
					position: "absolute",
					left: 60,
					top: 180,
					maxWidth: 500,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.accent,
						fontWeight: 500,
						marginBottom: 15,
						opacity: lerp(frame, [startDelay + 10, startDelay + 25], [0, 1]),
					}}
				>
					Introducing v2.0
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 52,
						fontWeight: 700,
						color: C.gray[900],
						lineHeight: 1.1,
						opacity: lerp(frame, [startDelay + 15, startDelay + 35], [0, 1]),
					}}
				>
					Build faster.
					<br />
					Ship smarter.
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 18,
						color: C.gray[600],
						marginTop: 25,
						lineHeight: 1.6,
						opacity: lerp(frame, [startDelay + 25, startDelay + 45], [0, 1]),
					}}
				>
					The modern platform for teams who move fast.
				</div>

				{/* CTA */}
				<div
					style={{
						display: "flex",
						gap: 15,
						marginTop: 35,
						opacity: lerp(frame, [startDelay + 35, startDelay + 55], [0, 1]),
					}}
				>
					<button
						type="button"
						style={{
							fontFamily: font,
							fontSize: 15,
							fontWeight: 600,
							color: C.white,
							background: C.accent,
							border: "none",
							borderRadius: 10,
							padding: "14px 28px",
							cursor: "pointer",
						}}
					>
						Get Started
					</button>
					<button
						type="button"
						style={{
							fontFamily: font,
							fontSize: 15,
							fontWeight: 500,
							color: C.gray[900],
							background: "transparent",
							border: `1px solid ${C.gray[300]}`,
							borderRadius: 10,
							padding: "14px 28px",
							cursor: "pointer",
						}}
					>
						Learn More
					</button>
				</div>
			</div>

			{/* プロダクトカード */}
			<div
				style={{
					position: "absolute",
					right: 60,
					top: 150,
					width: 380,
					background: C.white,
					borderRadius: 20,
					boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
					padding: 30,
					transform: `translateY(${(1 - cardProgress) * 50}px)`,
					opacity: cardProgress,
				}}
			>
				<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 25 }}>
					<div style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: C.gray[900] }}>
						Dashboard
					</div>
					<div style={{ fontFamily: font, fontSize: 12, color: C.success }}>+24.5%</div>
				</div>
				<div
					style={{
						height: 120,
						background: `linear-gradient(180deg, ${C.accent}33 0%, transparent 100%)`,
						borderRadius: 12,
						position: "relative",
					}}
				>
					{/* 簡易グラフ */}
					<svg width="100%" height="100%" viewBox="0 0 320 120" aria-hidden="true">
						<path d="M0 100 Q80 80, 160 60 T320 20" fill="none" stroke={C.accent} strokeWidth="3" />
					</svg>
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeWatercolor ──

/**
 * ThemeWatercolor - Watercolor - 水彩
 */

export const ThemeWatercolor = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();

	const textOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);

	const blobs = [
		{ x: 200, y: 150, size: 300, color: "rgba(100, 200, 255, 0.4)", delay: 0 },
		{ x: 400, y: 300, size: 250, color: "rgba(255, 150, 200, 0.4)", delay: 10 },
		{ x: 600, y: 200, size: 200, color: "rgba(200, 255, 150, 0.4)", delay: 5 },
		{ x: 900, y: 400, size: 280, color: "rgba(255, 200, 100, 0.3)", delay: 15 },
	];

	return (
		<AbsoluteFill style={{ background: "#fefefe" }}>
			{/* 紙テクスチャ */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
					opacity: 0.03,
				}}
			/>

			{/* 水彩ブロブ */}
			{blobs.map((blob) => {
				const blobOpacity = lerp(
					frame,
					[startDelay + blob.delay, startDelay + blob.delay + 30],
					[0, 1],
				);
				const spread = lerp(
					frame,
					[startDelay + blob.delay, startDelay + blob.delay + 40],
					[0.5, 1],
				);

				return (
					<div
						key={`watercolor-${blob.x}-${blob.y}`}
						style={{
							position: "absolute",
							left: blob.x,
							top: blob.y,
							width: blob.size * spread,
							height: blob.size * spread,
							borderRadius: "60% 40% 50% 70% / 50% 60% 40% 50%",
							background: blob.color,
							filter: "blur(30px)",
							opacity: blobOpacity,
						}}
					/>
				);
			})}

			{/* テキスト */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					textAlign: "center",
					opacity: textOpacity,
				}}
			>
				<div
					style={{
						fontFamily: font,
						fontSize: 18,
						color: C.gray[400],
						letterSpacing: 6,
						marginBottom: 15,
					}}
				>
					HAND PAINTED
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 72,
						fontWeight: 200,
						color: C.gray[800],
						fontStyle: "italic",
					}}
				>
					Watercolor
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 14,
						color: C.gray[400],
						marginTop: 20,
					}}
				>
					Organic textures & soft edges
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ── ThemeY2K ──

/**
 * ThemeY2K - Y2K / Millennium - 2000年代初頭のグロッシー&メタリック
 */

export const ThemeY2K = ({ startDelay = 0 }: { startDelay?: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const mainProgress = spring({
		frame: frame - startDelay,
		fps,
		config: { damping: 15, stiffness: 100 },
	});

	// キラキラの回転
	const sparkleRotate = (frame - startDelay) * 2;
	// グラデーションのアニメーション
	const gradientShift = (frame - startDelay) * 3;

	return (
		<AbsoluteFill
			style={{
				background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ee9ca7 100%)",
				overflow: "hidden",
			}}
		>
			{/* メタリックな背景オーブ */}
			<div
				style={{
					position: "absolute",
					left: "20%",
					top: "20%",
					width: 400,
					height: 400,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 182, 193, 0.4) 50%, transparent 70%)",
					filter: "blur(60px)",
					opacity: mainProgress,
				}}
			/>
			<div
				style={{
					position: "absolute",
					right: "15%",
					bottom: "25%",
					width: 350,
					height: 350,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(173, 216, 230, 0.7) 0%, rgba(192, 192, 255, 0.3) 50%, transparent 70%)",
					filter: "blur(50px)",
					opacity: mainProgress,
				}}
			/>

			{/* キラキラ星 */}
			{[
				{ x: 15, y: 20, size: 30, delay: 0 },
				{ x: 75, y: 15, size: 25, delay: 10 },
				{ x: 85, y: 60, size: 35, delay: 5 },
				{ x: 10, y: 70, size: 28, delay: 15 },
				{ x: 50, y: 80, size: 22, delay: 8 },
				{ x: 30, y: 40, size: 20, delay: 12 },
				{ x: 70, y: 35, size: 24, delay: 3 },
			].map((star, i) => {
				const starProgress = spring({
					frame: frame - startDelay - star.delay,
					fps,
					config: { damping: 12, stiffness: 150 },
				});
				const twinkle = 0.5 + Math.sin((frame - startDelay + i * 20) * 0.15) * 0.5;
				return (
					<div
						key={`y2k-star-${i}`}
						style={{
							position: "absolute",
							left: `${star.x}%`,
							top: `${star.y}%`,
							width: star.size,
							height: star.size,
							transform: `rotate(${sparkleRotate + i * 45}deg) scale(${starProgress})`,
							opacity: twinkle * starProgress,
						}}
					>
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<defs>
								<linearGradient id={`y2kStarGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stopColor="#ffffff" />
									<stop offset="50%" stopColor="#ffd1dc" />
									<stop offset="100%" stopColor="#c0c0ff" />
								</linearGradient>
							</defs>
							<path
								d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
								fill={`url(#y2kStarGrad-${i})`}
							/>
						</svg>
					</div>
				);
			})}

			{/* メインのグロッシーカード */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: `translate(-50%, -50%) scale(${mainProgress})`,
					width: 500,
					height: 280,
					borderRadius: 40,
					background: `linear-gradient(${135 + gradientShift * 0.5}deg, 
            rgba(255, 255, 255, 0.9) 0%, 
            rgba(255, 182, 193, 0.7) 25%,
            rgba(192, 192, 255, 0.7) 50%,
            rgba(173, 216, 230, 0.7) 75%,
            rgba(255, 255, 255, 0.9) 100%)`,
					boxShadow: `
            0 20px 60px rgba(255, 105, 180, 0.3),
            0 10px 30px rgba(192, 192, 255, 0.2),
            inset 0 2px 0 rgba(255, 255, 255, 0.8),
            inset 0 -2px 0 rgba(0, 0, 0, 0.05)
          `,
					border: "2px solid rgba(255, 255, 255, 0.6)",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					padding: 40,
				}}
			>
				{/* グロッシーハイライト */}
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						height: "50%",
						borderRadius: "40px 40px 100px 100px",
						background: "linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%)",
						pointerEvents: "none",
					}}
				/>

				<div
					style={{
						fontFamily: font,
						fontSize: 56,
						fontWeight: 800,
						background: `linear-gradient(${90 + gradientShift}deg, #ff69b4, #9370db, #00bfff, #ff69b4)`,
						backgroundSize: "200% 100%",
						backgroundClip: "text",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						textShadow: "0 2px 10px rgba(255, 105, 180, 0.3)",
						letterSpacing: -2,
					}}
				>
					Y2K VIBES
				</div>
				<div
					style={{
						fontFamily: font,
						fontSize: 18,
						color: "#9370db",
						letterSpacing: 6,
						marginTop: 12,
						opacity: 0.8,
					}}
				>
					MILLENNIUM AESTHETIC
				</div>
			</div>

			{/* バブル装飾 */}
			{[
				{ x: 8, y: 30, size: 80 },
				{ x: 82, y: 25, size: 60 },
				{ x: 5, y: 65, size: 50 },
				{ x: 88, y: 70, size: 70 },
			].map((bubble, i) => {
				const bubbleProgress = spring({
					frame: frame - startDelay - i * 8,
					fps,
					config: { damping: 20, stiffness: 80 },
				});
				const floatY = Math.sin((frame - startDelay + i * 30) * 0.05) * 10;
				return (
					<div
						key={`y2k-bubble-${i}`}
						style={{
							position: "absolute",
							left: `${bubble.x}%`,
							top: `${bubble.y}%`,
							width: bubble.size,
							height: bubble.size,
							borderRadius: "50%",
							background: `radial-gradient(circle at 30% 30%, 
                rgba(255, 255, 255, 0.9) 0%, 
                rgba(255, 182, 193, 0.4) 40%, 
                rgba(192, 192, 255, 0.2) 70%, 
                transparent 100%)`,
							border: "1px solid rgba(255, 255, 255, 0.5)",
							transform: `translateY(${floatY}px) scale(${bubbleProgress})`,
							opacity: bubbleProgress * 0.7,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
