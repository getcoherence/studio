// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── LiquidBlob ──

/**
 * LiquidBlob - 有機的ブロブモーション - 複数レイヤーの巨大ブロブ
 */


export const LiquidBlob = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 複数のブロブレイヤー
  const blobLayers = [
    { scale: 4, rotation: 1, color: C.accent, opacity: 0.3, blur: 60, delay: 0 },
    { scale: 3.5, rotation: -0.8, color: C.secondary, opacity: 0.4, blur: 40, delay: 3 },
    { scale: 3, rotation: 1.2, color: C.tertiary, opacity: 0.5, blur: 20, delay: 6 },
    { scale: 2.5, rotation: -0.5, color: C.white, opacity: 0.6, blur: 10, delay: 9 },
    { scale: 2, rotation: 0.7, color: C.accent, opacity: 0.9, blur: 0, delay: 12 },
  ];

  // アニメーションするブロブパス生成
  const generateAnimatedBlob = (f: number, seed: number, points: number = 10) => {
    const radius = 100;
    const angleStep = (Math.PI * 2) / points;
    const pathPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < points; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const noise1 = Math.sin(f * 0.04 + i * 1.2 + seed) * 40;
      const noise2 = Math.cos(f * 0.06 + i * 0.8 + seed * 2) * 25;
      const r = radius + noise1 + noise2;
      pathPoints.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      });
    }

    let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let i = 0; i < points; i++) {
      const curr = pathPoints[i];
      const next = pathPoints[(i + 1) % points];
      const prev = pathPoints[(i - 1 + points) % points];
      const nextNext = pathPoints[(i + 2) % points];

      const cp1x = curr.x + (next.x - prev.x) * 0.35;
      const cp1y = curr.y + (next.y - prev.y) * 0.35;
      const cp2x = next.x - (nextNext.x - curr.x) * 0.35;
      const cp2y = next.y - (nextNext.y - curr.y) * 0.35;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return path + " Z";
  };

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 複数のブロブレイヤー */}
      {blobLayers.map((layer, idx) => {
        const layerProgress = spring({
          frame: frame - startDelay - layer.delay,
          fps,
          config: { damping: 12, stiffness: 40 },
        });

        const rotation = (frame - startDelay) * layer.rotation;

        return (
          <div
            key={`blob-layer-${layer.color}-${layer.scale}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${layerProgress * layer.scale})`,
              filter: layer.blur > 0 ? `blur(${layer.blur}px)` : undefined,
            }}
          >
            <svg width="400" height="400" viewBox="-200 -200 400 400" aria-hidden="true">
              <path
                d={generateAnimatedBlob(frame - startDelay, idx * 100)}
                fill={layer.color}
                opacity={layer.opacity}
              />
            </svg>
          </div>
        );
      })}

      {/* 飛び散るサブブロブ */}
      {Array.from({ length: 15 }).map((_, i) => {
        const angle = random(`blob-angle-${i}`) * Math.PI * 2;
        const dist = 200 + random(`blob-dist-${i}`) * 300;
        const size = 30 + random(`blob-size-${i}`) * 60;
        const delay = random(`blob-delay-${i}`) * 20;

        const subProgress = spring({
          frame: frame - startDelay - 15 - delay,
          fps,
          config: { damping: 15, stiffness: 60 },
        });

        const x = Math.cos(angle) * dist * subProgress;
        const y = Math.sin(angle) * dist * subProgress;
        const rotation = (frame - startDelay) * (i % 2 === 0 ? 2 : -2);

        return (
          <div
            key={`sub-blob-${i}-${size.toFixed(0)}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size,
              height: size,
              background: [C.accent, C.secondary, C.tertiary, C.white][i % 4],
              borderRadius: "50%",
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${subProgress})`,
              opacity: subProgress * 0.8,
            }}
          />
        );
      })}

      {/* 中央テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 25, startDelay + 45], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 60px ${C.accent}, 0 0 120px ${C.secondary}`,
        }}
      >
        BLOB
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidCalligraphyInk ──

/**
 * LiquidCalligraphyInk - 墨/書道風インク - ダイナミックな筆致と飛沫
 */


export const LiquidCalligraphyInk = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 複数の筆致レイヤー
  const brushStrokes = [
    { scale: 4, rotation: -15, delay: 0, thickness: 1.5 },
    { scale: 3.5, rotation: 25, delay: 5, thickness: 1.2 },
    { scale: 3, rotation: -35, delay: 10, thickness: 1 },
    { scale: 2.5, rotation: 45, delay: 15, thickness: 0.8 },
  ];

  // ダイナミックな筆致パス生成
  const generateBrushStroke = (seed: number, progress: number) => {
    const points: string[] = [];
    const segments = 20;

    for (let i = 0; i <= segments * progress; i++) {
      const t = i / segments;
      const x = -200 + t * 400;
      // 有機的な揺れ
      const wave1 = Math.sin(t * 8 + seed) * 40;
      const wave2 = Math.cos(t * 5 + seed * 2) * 25;
      const y = wave1 + wave2;
      points.push(`${x},${y}`);
    }

    if (points.length < 2) return "";
    return `M ${points.join(" L ")}`;
  };

  // 飛沫
  const splatters = React.useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: `ink-splat-${i}`,
      x: (random(`ink-x-${i}`) - 0.5) * width * 1.2,
      y: (random(`ink-y-${i}`) - 0.5) * height,
      size: random(`ink-sz-${i}`) * 60 + 10,
      delay: random(`ink-del-${i}`) * 40,
      rotation: random(`ink-rot-${i}`) * 360,
    }));
  }, [width, height]);

  return (
    <AbsoluteFill style={{ background: "#f5f0e8" }}>
      {/* 和紙テクスチャ */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.1,
        }}
      />

      {/* 背景の滲み */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: width * 1.5,
          height: height,
          background: `radial-gradient(ellipse, rgba(26,26,26,0.15) 0%, transparent 60%)`,
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 20, startDelay + 60], [0, 1])})`,
        }}
      />

      {/* 筆致レイヤー */}
      {brushStrokes.map((stroke, idx) => {
        const strokeProgress = spring({
          frame: frame - startDelay - stroke.delay,
          fps,
          config: { damping: 20, stiffness: 40 },
        });

        return (
          <div
            key={`brush-${idx}-${stroke.scale}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${stroke.rotation}deg) scale(${stroke.scale})`,
            }}
          >
            <svg width="600" height="200" viewBox="-300 -100 600 200" aria-hidden="true">
              <path
                d={generateBrushStroke(idx * 10, strokeProgress)}
                fill="none"
                stroke="#1a1a1a"
                strokeWidth={60 * stroke.thickness}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            </svg>
          </div>
        );
      })}

      {/* 飛沫 */}
      {splatters.map((splat) => {
        const splatProgress = spring({
          frame: frame - startDelay - splat.delay,
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        return (
          <div
            key={splat.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${splat.x}px, ${splat.y}px) rotate(${splat.rotation}deg) scale(${splatProgress})`,
            }}
          >
            <svg width={splat.size * 3} height={splat.size * 3} viewBox="-50 -50 100 100" aria-hidden="true">
              <path
                d={generateBlobPath(`ink-blob-${splat.id}`, 6, 0.6, 30)}
                fill="#1a1a1a"
                opacity={splatProgress * 0.8}
              />
            </svg>
          </div>
        );
      })}

      {/* 中央の漢字 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 35, startDelay + 55], [0.5, 1], EASE.overshoot)})`,
          fontFamily: "serif",
          fontSize: 300,
          fontWeight: 900,
          color: "#1a1a1a",
          opacity: lerp(frame, [startDelay + 35, startDelay + 50], [0, 1]),
          textShadow: "0 0 60px rgba(26,26,26,0.3)",
        }}
      >
        墨
      </div>

      {/* 署名 */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 16,
          color: "#c41e3a",
          letterSpacing: 4,
          opacity: lerp(frame, [startDelay + 60, startDelay + 75], [0, 1]),
          padding: "8px 16px",
          border: "2px solid #c41e3a",
        }}
      >
        書道
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidFluidWave ──

/**
 * LiquidFluidWave - 流体ウェーブ - 画面を覆う巨大な波
 */


export const LiquidFluidWave = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const waveOffset = (frame - startDelay) * 4;

  // 複雑な波パス生成
  const generateComplexWave = (
    yBase: number,
    amplitude: number,
    frequency: number,
    phase: number,
    noiseStrength: number = 0.3
  ) => {
    const points: string[] = [];
    const steps = 80;

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const t = (waveOffset + phase) * 0.05;
      const y =
        yBase +
        Math.sin((x * frequency) / 100 + t) * amplitude +
        Math.sin((x * frequency * 1.5) / 100 + t * 1.3) * (amplitude * 0.4) +
        Math.cos((x * frequency * 0.7) / 100 + t * 0.8) * (amplitude * noiseStrength);
      points.push(`${x},${y}`);
    }

    return `M 0 ${height} L ${points.join(" L ")} L ${width} ${height} Z`;
  };

  // 波レイヤー
  const waveLayers = [
    { yBase: 0.4, amp: 150, freq: 1.5, phase: 0, color: C.accent, opacity: 0.15, delay: 0 },
    { yBase: 0.45, amp: 120, freq: 2, phase: 50, color: C.secondary, opacity: 0.2, delay: 3 },
    { yBase: 0.5, amp: 100, freq: 2.5, phase: 100, color: C.tertiary, opacity: 0.3, delay: 6 },
    { yBase: 0.55, amp: 80, freq: 3, phase: 150, color: C.accent, opacity: 0.4, delay: 9 },
    { yBase: 0.6, amp: 60, freq: 3.5, phase: 200, color: C.secondary, opacity: 0.5, delay: 12 },
    { yBase: 0.65, amp: 50, freq: 4, phase: 250, color: C.white, opacity: 0.6, delay: 15 },
    { yBase: 0.7, amp: 40, freq: 4.5, phase: 300, color: C.cyan, opacity: 0.8, delay: 18 },
  ];

  // 飛沫
  const splashes = React.useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      id: `wave-splash-${i}`,
      x: random(`ws-x-${i}`) * width,
      baseY: height * (0.5 + random(`ws-y-${i}`) * 0.3),
      size: random(`ws-sz-${i}`) * 40 + 15,
      speed: random(`ws-sp-${i}`) * 2 + 1,
      delay: random(`ws-del-${i}`) * 20,
    }));
  }, [width, height]);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #0a0a1a 0%, #1a1a3a 100%)` }}>
      {/* 背景グロー */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: width * 2,
          height: height,
          background: `radial-gradient(ellipse at 50% 100%, ${C.accent}40 0%, transparent 60%)`,
          transform: "translateX(-50%)",
        }}
      />

      {/* 波レイヤー */}
      {waveLayers.map((wave, idx) => {
        const waveProgress = spring({
          frame: frame - startDelay - wave.delay,
          fps,
          config: { damping: 15, stiffness: 40 },
        });

        return (
          <svg
            key={`wave-${idx}-${wave.color}`}
            width={width}
            height={height}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translateY(${(1 - waveProgress) * 200}px)`,
            }}
            aria-hidden="true"
          >
            <path
              d={generateComplexWave(height * wave.yBase, wave.amp, wave.freq, wave.phase)}
              fill={wave.color}
              opacity={wave.opacity * waveProgress}
            />
          </svg>
        );
      })}

      {/* 飛沫 */}
      {splashes.map((splash) => {
        const splashProgress = spring({
          frame: frame - startDelay - splash.delay,
          fps,
          config: { damping: 12, stiffness: 80 },
        });

        const floatY = Math.sin((frame - startDelay) * 0.1 * splash.speed) * 30;

        return (
          <div
            key={splash.id}
            style={{
              position: "absolute",
              left: splash.x,
              top: splash.baseY + floatY,
              width: splash.size,
              height: splash.size,
              background: C.white,
              borderRadius: "50%",
              opacity: splashProgress * 0.6,
              boxShadow: `0 0 20px ${C.cyan}`,
              transform: `scale(${splashProgress})`,
            }}
          />
        );
      })}

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "20%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 20, startDelay + 40], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 120,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 60px ${C.accent}, 0 0 120px ${C.secondary}`,
        }}
      >
        WAVE
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidInkSplash ──

/**
 * LiquidInkSplash - インクスプラッシュリビール（Spotify風）
 */


export const LiquidInkSplash = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({
    frame: frame - startDelay - 25,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const rotation = (frame - startDelay) * 2;

  // 複数のスプラッシュレイヤー
  const splashes = [
    { scale: 1, rotation: rotation, color: C.white, delay: 0 },
    { scale: 0.8, rotation: -rotation * 1.2, color: C.spotify, delay: 5 },
    { scale: 0.6, rotation: rotation * 0.8, color: C.black, delay: 10 },
  ];

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* スプラッシュレイヤー */}
      {splashes.map((splash, i) => {
        const splashSpring = spring({
          frame: frame - startDelay - splash.delay,
          fps,
          config: { damping: 10, stiffness: 50 },
        });

        return (
          <div
            key={`splash-layer-${splash.color}-${splash.delay}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${splash.rotation}deg) scale(${splashSpring * splash.scale * 3})`,
            }}
          >
            <svg
              width="600"
              height="600"
              viewBox="-300 -300 600 600"
              style={{ overflow: "visible" }}
              aria-hidden="true"
            >
              {/* メインブロブ */}
              <path
                d={generateBlobPath(`splash-${i}`, 8, 0.4, 150)}
                fill={splash.color}
                opacity={0.9}
              />
              {/* サブブロブ */}
              {Array.from({ length: 5 }).map((_, j) => {
                const angle = (j / 5) * Math.PI * 2 + rotation * 0.01;
                const dist = 120 + random(`sub-dist-${i}-${j}`) * 60;
                const x = Math.cos(angle) * dist;
                const y = Math.sin(angle) * dist;
                const size = 30 + random(`sub-size-${i}-${j}`) * 40;

                return (
                  <circle
                    key={`sub-${splash.delay}-${j}`}
                    cx={x}
                    cy={y}
                    r={size * splashSpring}
                    fill={splash.color}
                    opacity={0.8}
                  />
                );
              })}
            </svg>
          </div>
        );
      })}

      {/* 中央のロゴ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${logoProgress})`,
          fontFamily: font,
          fontSize: 80,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 40px ${C.spotify}`,
          opacity: logoProgress,
        }}
      >
        SPLASH
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidMorphBlob ──

/**
 * LiquidMorphBlob - モーフィングブロブ - 巨大な変形するブロブ群
 */


export const LiquidMorphBlob = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const time = (frame - startDelay) * 0.03;

  // 動的なブロブパス生成（時間で変形）
  const generateMorphingBlob = (seed: number, t: number, baseRadius: number, points: number = 10) => {
    const angleStep = (Math.PI * 2) / points;
    const pathPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < points; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const noise1 = Math.sin(t * 2 + i * 1.5 + seed) * 40;
      const noise2 = Math.cos(t * 1.5 + i * 2 + seed * 0.5) * 30;
      const noise3 = Math.sin(t * 3 + i * 0.8 + seed * 2) * 20;
      const r = baseRadius + noise1 + noise2 + noise3;
      pathPoints.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      });
    }

    let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let i = 0; i < points; i++) {
      const curr = pathPoints[i];
      const next = pathPoints[(i + 1) % points];
      const prev = pathPoints[(i - 1 + points) % points];
      const nextNext = pathPoints[(i + 2) % points];

      const cp1x = curr.x + (next.x - prev.x) * 0.35;
      const cp1y = curr.y + (next.y - prev.y) * 0.35;
      const cp2x = next.x - (nextNext.x - curr.x) * 0.35;
      const cp2y = next.y - (nextNext.y - curr.y) * 0.35;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return path + " Z";
  };

  // 複数のブロブレイヤー
  const blobLayers = [
    { scale: 5, seed: 0, color: C.accent, opacity: 0.2, blur: 80, delay: 0 },
    { scale: 4.5, seed: 10, color: C.secondary, opacity: 0.25, blur: 60, delay: 3 },
    { scale: 4, seed: 20, color: C.tertiary, opacity: 0.3, blur: 40, delay: 6 },
    { scale: 3.5, seed: 30, color: C.orange, opacity: 0.4, blur: 20, delay: 9 },
    { scale: 3, seed: 40, color: C.white, opacity: 0.5, blur: 10, delay: 12 },
    { scale: 2.5, seed: 50, color: C.accent, opacity: 0.8, blur: 0, delay: 15 },
  ];

  // 浮遊する小ブロブ
  const floatingBlobs = React.useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: `float-${i}`,
      x: (random(`fb-x-${i}`) - 0.5) * width * 1.5,
      y: (random(`fb-y-${i}`) - 0.5) * height * 1.5,
      size: random(`fb-sz-${i}`) * 80 + 40,
      speed: random(`fb-sp-${i}`) * 2 + 1,
      seed: random(`fb-seed-${i}`) * 100,
      color: [C.accent, C.secondary, C.tertiary, C.orange][i % 4],
    }));
  }, [width, height]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景グロー */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: width * 2,
          height: height * 2,
          background: `radial-gradient(circle, ${C.accent}30 0%, ${C.secondary}20 40%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* メインブロブレイヤー */}
      {blobLayers.map((layer) => {
        const layerProgress = spring({
          frame: frame - startDelay - layer.delay,
          fps,
          config: { damping: 12, stiffness: 40 },
        });

        return (
          <div
            key={`morph-layer-${layer.color}-${layer.scale}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) scale(${layerProgress * layer.scale})`,
              filter: layer.blur > 0 ? `blur(${layer.blur}px)` : undefined,
            }}
          >
            <svg width="400" height="400" viewBox="-200 -200 400 400" aria-hidden="true">
              <path
                d={generateMorphingBlob(layer.seed, time, 100, 12)}
                fill={layer.color}
                opacity={layer.opacity}
              />
            </svg>
          </div>
        );
      })}

      {/* 浮遊する小ブロブ */}
      {floatingBlobs.map((blob) => {
        const blobProgress = spring({
          frame: frame - startDelay - 20,
          fps,
          config: { damping: 15, stiffness: 50 },
        });

        const floatX = blob.x + Math.sin(time * blob.speed) * 50;
        const floatY = blob.y + Math.cos(time * blob.speed * 0.8) * 40;

        return (
          <div
            key={blob.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${floatX}px, ${floatY}px) scale(${blobProgress})`,
            }}
          >
            <svg width={blob.size * 2} height={blob.size * 2} viewBox="-100 -100 200 200" aria-hidden="true">
              <path
                d={generateMorphingBlob(blob.seed, time * blob.speed, 60, 8)}
                fill={blob.color}
                opacity={0.6}
              />
            </svg>
          </div>
        );
      })}

      {/* 中央テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 25, startDelay + 45], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 60px ${C.accent}, 0 0 120px ${C.secondary}`,
        }}
      >
        MORPH
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidOilSpill ──

/**
 * LiquidOilSpill - オイルスピル風 - 虹色に輝く巨大な油膜
 */


export const LiquidOilSpill = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const hueShift = (frame - startDelay) * 3;
  const time = (frame - startDelay) * 0.02;

  // 動的なオイルブロブパス生成
  const generateOilBlob = (seed: number, t: number, baseRadius: number) => {
    const points = 12;
    const angleStep = (Math.PI * 2) / points;
    const pathPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < points; i++) {
      const angle = i * angleStep;
      const noise1 = Math.sin(t * 2 + i * 1.2 + seed) * 50;
      const noise2 = Math.cos(t * 1.5 + i * 0.8 + seed * 2) * 30;
      const r = baseRadius + noise1 + noise2;
      pathPoints.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      });
    }

    let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let i = 0; i < points; i++) {
      const curr = pathPoints[i];
      const next = pathPoints[(i + 1) % points];
      const prev = pathPoints[(i - 1 + points) % points];
      const nextNext = pathPoints[(i + 2) % points];

      const cp1x = curr.x + (next.x - prev.x) * 0.35;
      const cp1y = curr.y + (next.y - prev.y) * 0.35;
      const cp2x = next.x - (nextNext.x - curr.x) * 0.35;
      const cp2y = next.y - (nextNext.y - curr.y) * 0.35;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return path + " Z";
  };

  // 複数のオイルレイヤー（画面を覆うサイズ）
  const oilLayers = [
    { scale: 6, seed: 0, rotation: 0.3, delay: 0 },
    { scale: 5.5, seed: 20, rotation: -0.4, delay: 3 },
    { scale: 5, seed: 40, rotation: 0.5, delay: 6 },
    { scale: 4.5, seed: 60, rotation: -0.3, delay: 9 },
    { scale: 4, seed: 80, rotation: 0.4, delay: 12 },
  ];

  return (
    <AbsoluteFill style={{ background: "#0a0a15" }}>
      {/* 暗い水面 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, #1a1a2e 0%, #0a0a15 100%)`,
        }}
      />

      {/* オイルレイヤー */}
      {oilLayers.map((layer, idx) => {
        const layerProgress = spring({
          frame: frame - startDelay - layer.delay,
          fps,
          config: { damping: 15, stiffness: 35 },
        });

        const rotation = (frame - startDelay) * layer.rotation;
        const layerHue = (hueShift + idx * 60) % 360;

        return (
          <div
            key={`oil-layer-${idx}-${layer.scale}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${layerProgress * layer.scale})`,
            }}
          >
            <svg width="400" height="400" viewBox="-200 -200 400 400" aria-hidden="true">
              <defs>
                <linearGradient
                  id={`oil-grad-${startDelay}-${idx}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={`hsl(${layerHue}, 80%, 60%)`} stopOpacity="0.7" />
                  <stop offset="30%" stopColor={`hsl(${(layerHue + 40) % 360}, 80%, 50%)`} stopOpacity="0.6" />
                  <stop offset="60%" stopColor={`hsl(${(layerHue + 80) % 360}, 80%, 55%)`} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={`hsl(${(layerHue + 120) % 360}, 80%, 45%)`} stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <path
                d={generateOilBlob(layer.seed, time, 100)}
                fill={`url(#oil-grad-${startDelay}-${idx})`}
                style={{ mixBlendMode: "screen" }}
              />
            </svg>
          </div>
        );
      })}

      {/* 光の反射 */}
      {Array.from({ length: 15 }).map((_, i) => {
        const reflectProgress = spring({
          frame: frame - startDelay - 15 - i * 3,
          fps,
          config: { damping: 20, stiffness: 60 },
        });

        const x = (random(`ref-x-${i}`) - 0.5) * width;
        const y = (random(`ref-y-${i}`) - 0.5) * height;
        const size = random(`ref-sz-${i}`) * 100 + 50;
        const hue = (hueShift + random(`ref-hue-${i}`) * 180) % 360;

        return (
          <div
            key={`reflect-${i}-${size.toFixed(0)}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size,
              height: size,
              background: `radial-gradient(circle, hsla(${hue}, 80%, 70%, 0.6) 0%, transparent 70%)`,
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${reflectProgress})`,
              mixBlendMode: "screen",
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
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 25, startDelay + 45], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 40px hsl(${hueShift}, 80%, 50%), 0 0 80px hsl(${(hueShift + 60) % 360}, 80%, 50%)`,
        }}
      >
        OIL SPILL
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidPaintDrip ──

/**
 * LiquidPaintDrip - ペイントドリップ - 画面を覆うカラフルなペイント
 */


export const LiquidPaintDrip = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 大きなドリップ（画面全体をカバー）
  const drips = React.useMemo(() => {
    const colors = [C.accent, C.secondary, C.tertiary, C.orange, C.cyan, C.spotify];
    return Array.from({ length: 15 }).map((_, i) => ({
      id: `drip-${i}`,
      x: (i / 14) * width,
      width: 80 + random(`drip-w-${i}`) * 100,
      delay: random(`drip-delay-${i}`) * 25,
      color: colors[i % colors.length],
      wobbleSpeed: random(`drip-wobble-${i}`) * 2 + 1,
      wobbleAmp: random(`drip-wobble-amp-${i}`) * 20 + 10,
    }));
  }, [width]);

  // スプラッシュ（下に落ちた時）
  const splashes = React.useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: `splash-${i}`,
      x: random(`splash-x-${i}`) * width,
      size: random(`splash-sz-${i}`) * 60 + 30,
      delay: 30 + random(`splash-del-${i}`) * 40,
      color: [C.accent, C.secondary, C.tertiary, C.orange, C.cyan][i % 5],
    }));
  }, [width]);

  // 上部のペイント溜まり
  const paintPools = React.useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      id: `pool-${i}`,
      x: (i / 7) * width,
      width: 150 + random(`pool-w-${i}`) * 100,
      color: [C.accent, C.secondary, C.tertiary, C.orange][i % 4],
      delay: random(`pool-del-${i}`) * 10,
    }));
  }, [width]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 上部のペイント溜まり */}
      {paintPools.map((pool) => {
        const poolProgress = spring({
          frame: frame - startDelay - pool.delay,
          fps,
          config: { damping: 15, stiffness: 60 },
        });

        return (
          <div
            key={pool.id}
            style={{
              position: "absolute",
              left: pool.x - pool.width / 2,
              top: -40,
              width: pool.width,
              height: 120 * poolProgress,
              background: pool.color,
              borderRadius: "0 0 50% 50%",
              opacity: poolProgress,
            }}
          />
        );
      })}

      {/* メインドリップ */}
      {drips.map((drip) => {
        const dripProgress = spring({
          frame: frame - startDelay - drip.delay,
          fps,
          config: { damping: 8, stiffness: 30 },
        });

        const wobble = Math.sin((frame - startDelay) * 0.1 * drip.wobbleSpeed) * drip.wobbleAmp;
        const dripLength = dripProgress * height * 1.2;
        const bulgeSize = drip.width * 1.5;

        return (
          <React.Fragment key={drip.id}>
            {/* メインドリップ */}
            <div
              style={{
                position: "absolute",
                left: drip.x - drip.width / 2 + wobble,
                top: 0,
                width: drip.width,
                height: Math.min(dripLength, height + 100),
                background: `linear-gradient(180deg, ${drip.color} 0%, ${drip.color}dd 100%)`,
                borderRadius: `0 0 ${drip.width / 2}px ${drip.width / 2}px`,
                boxShadow: `0 0 30px ${drip.color}60`,
              }}
            />

            {/* 先端の膨らみ */}
            {dripProgress > 0.2 && dripLength < height && (
              <div
                style={{
                  position: "absolute",
                  left: drip.x - bulgeSize / 2 + wobble,
                  top: Math.min(dripLength - bulgeSize / 2, height - bulgeSize),
                  width: bulgeSize,
                  height: bulgeSize * 1.3,
                  background: drip.color,
                  borderRadius: "50%",
                  boxShadow: `0 10px 40px ${drip.color}80`,
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* 下部のスプラッシュ */}
      {splashes.map((splash) => {
        const splashProgress = spring({
          frame: frame - startDelay - splash.delay,
          fps,
          config: { damping: 12, stiffness: 80 },
        });

        return (
          <div
            key={splash.id}
            style={{
              position: "absolute",
              left: splash.x - splash.size / 2,
              bottom: 0,
              width: splash.size,
              height: splash.size * 0.6 * splashProgress,
              background: splash.color,
              borderRadius: "50% 50% 0 0",
              opacity: splashProgress * 0.8,
            }}
          />
        );
      })}

      {/* 下部のペイント溜まり */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: lerp(frame, [startDelay + 40, startDelay + 70], [0, 150]),
          background: `linear-gradient(90deg, ${C.accent}, ${C.secondary}, ${C.tertiary}, ${C.orange}, ${C.cyan}, ${C.accent})`,
          opacity: 0.9,
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 30, startDelay + 50], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 150,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 60px ${C.accent}, 0 0 120px ${C.secondary}`,
          mixBlendMode: "difference",
        }}
      >
        DRIP
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidSplatter ──

/**
 * LiquidSplatter - スプラッターエフェクト - 画面を覆う大胆なスプラッシュ
 */


export const LiquidSplatter = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const impactFrame = startDelay + 10;

  // 大きなスプラッシュブロブ（画面を覆うサイズ）
  const mainSplashes = [
    { scale: 6, rotation: 0, color: C.secondary, delay: 0, points: 12 },
    { scale: 5.5, rotation: 45, color: C.accent, delay: 2, points: 10 },
    { scale: 5, rotation: -30, color: C.orange, delay: 4, points: 14 },
    { scale: 4.5, rotation: 60, color: C.tertiary, delay: 6, points: 8 },
    { scale: 4, rotation: -15, color: C.white, delay: 8, points: 11 },
  ];

  // 飛び散る小さなスプラッター
  const splatters = React.useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: `splat-${i}`,
      angle: random(`splat-angle-${i}`) * Math.PI * 2,
      distance: random(`splat-dist-${i}`) * 600 + 200,
      size: random(`splat-size-${i}`) * 80 + 30,
      delay: random(`splat-delay-${i}`) * 15,
      color: [C.accent, C.secondary, C.tertiary, C.orange, C.white][i % 5],
      elongation: random(`splat-elong-${i}`) * 3 + 1,
      rotSpeed: (random(`splat-rot-${i}`) - 0.5) * 10,
    }));
  }, []);

  // トレイル（飛沫の尾）
  const trails = React.useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: `trail-${i}`,
      startAngle: random(`trail-start-${i}`) * Math.PI * 2,
      length: random(`trail-len-${i}`) * 400 + 300,
      width: random(`trail-width-${i}`) * 40 + 20,
      color: [C.accent, C.secondary, C.orange][i % 3],
      delay: random(`trail-delay-${i}`) * 10,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景グラデーション */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${C.gray[900]} 0%, ${C.black} 70%)`,
        }}
      />

      {/* インパクトフラッシュ */}
      {frame >= impactFrame && frame < impactFrame + 8 && (
        <AbsoluteFill
          style={{
            background: C.white,
            opacity: lerp(frame, [impactFrame, impactFrame + 8], [1, 0]),
          }}
        />
      )}

      {/* トレイル（飛沫の筋） */}
      {trails.map((trail) => {
        const trailProgress = spring({
          frame: frame - impactFrame - trail.delay,
          fps,
          config: { damping: 20, stiffness: 100 },
        });

        const startX = width / 2;
        const startY = height / 2;

        return (
          <div
            key={trail.id}
            style={{
              position: "absolute",
              left: startX,
              top: startY,
              width: trail.length * trailProgress,
              height: trail.width,
              background: `linear-gradient(90deg, ${trail.color}, ${trail.color}00)`,
              transform: `rotate(${(trail.startAngle * 180) / Math.PI}deg)`,
              transformOrigin: "left center",
              borderRadius: trail.width / 2,
              opacity: trailProgress * 0.7,
            }}
          />
        );
      })}

      {/* メインスプラッシュブロブ */}
      {mainSplashes.map((splash, idx) => {
        const splashProgress = spring({
          frame: frame - impactFrame - splash.delay,
          fps,
          config: { damping: 12, stiffness: 60 },
        });

        return (
          <div
            key={`main-splash-${splash.color}-${splash.scale}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${splash.rotation}deg) scale(${splashProgress * splash.scale})`,
            }}
          >
            <svg width="300" height="300" viewBox="-150 -150 300 300" aria-hidden="true">
              <path
                d={generateBlobPath(`main-splat-${idx}`, splash.points, 0.5, 100)}
                fill={splash.color}
                opacity={0.85}
              />
            </svg>
          </div>
        );
      })}

      {/* 飛び散るスプラッター */}
      {splatters.map((splat) => {
        const splatProgress = spring({
          frame: frame - impactFrame - splat.delay,
          fps,
          config: { damping: 15, stiffness: 120 },
        });

        const x = Math.cos(splat.angle) * splat.distance * splatProgress;
        const y = Math.sin(splat.angle) * splat.distance * splatProgress;
        const rotation = (frame - impactFrame) * splat.rotSpeed;

        return (
          <div
            key={splat.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
            }}
          >
            <svg
              width={splat.size * 2}
              height={splat.size * splat.elongation * 2}
              viewBox={`-${splat.size} -${splat.size * splat.elongation} ${splat.size * 2} ${splat.size * splat.elongation * 2}`}
              aria-hidden="true"
            >
              <ellipse
                cx="0"
                cy="0"
                rx={splat.size * splatProgress}
                ry={splat.size * splat.elongation * splatProgress}
                fill={splat.color}
                opacity={splatProgress * 0.9}
              />
            </svg>
          </div>
        );
      })}

      {/* 中央テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [impactFrame + 15, impactFrame + 35], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 120,
          fontWeight: 900,
          color: C.white,
          textShadow: `0 0 40px ${C.accent}, 0 0 80px ${C.secondary}`,
        }}
      >
        SPLAT!
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidSwirl ──

/**
 * LiquidSwirl - 渦巻きスワール - 巨大な液体渦巻き
 */


export const LiquidSwirl = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const rotation = (frame - startDelay) * 4;

  // 複数の渦巻きレイヤー
  const swirlLayers = [
    { scale: 5, rotMult: 1, color: C.white, thickness: 80, spirals: 2.5, delay: 0 },
    { scale: 4.5, rotMult: -0.7, color: C.spotify, thickness: 60, spirals: 3, delay: 5 },
    { scale: 4, rotMult: 0.9, color: C.black, thickness: 100, spirals: 2, delay: 8 },
    { scale: 3.5, rotMult: -1.1, color: C.white, thickness: 50, spirals: 3.5, delay: 12 },
    { scale: 3, rotMult: 0.8, color: C.spotify, thickness: 40, spirals: 4, delay: 15 },
  ];

  // 有機的な渦巻きパス生成
  const generateSwirlPath = (spirals: number, seed: number, f: number) => {
    const points: string[] = [];
    const totalPoints = 60;

    for (let i = 0; i <= totalPoints; i++) {
      const t = i / totalPoints;
      const angle = t * Math.PI * 2 * spirals;
      const baseRadius = 20 + t * 150;
      // 有機的な揺らぎを追加
      const noise = Math.sin(f * 0.05 + t * 10 + seed) * 15 + Math.cos(f * 0.03 + t * 8) * 10;
      const radius = baseRadius + noise;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(`${x},${y}`);
    }

    return `M ${points.join(" L ")}`;
  };

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景グロー */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: width * 1.5,
          height: height * 1.5,
          background: `radial-gradient(circle, ${C.spotify}40 0%, transparent 60%)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* 渦巻きレイヤー */}
      {swirlLayers.map((layer, idx) => {
        const layerProgress = spring({
          frame: frame - startDelay - layer.delay,
          fps,
          config: { damping: 10, stiffness: 35 },
        });

        const rot = rotation * layer.rotMult;

        return (
          <div
            key={`swirl-layer-${layer.color}-${layer.scale}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${layerProgress * layer.scale})`,
            }}
          >
            <svg width="600" height="600" viewBox="-300 -300 600 600" aria-hidden="true">
              <path
                d={generateSwirlPath(layer.spirals, idx * 50, frame - startDelay)}
                fill="none"
                stroke={layer.color}
                strokeWidth={layer.thickness}
                strokeLinecap="round"
                opacity={0.9}
              />
            </svg>
          </div>
        );
      })}

      {/* 飛び散る液滴 */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = random(`swirl-drop-angle-${i}`) * Math.PI * 2;
        const dist = 150 + random(`swirl-drop-dist-${i}`) * 400;
        const size = 20 + random(`swirl-drop-size-${i}`) * 50;
        const delay = 10 + random(`swirl-drop-delay-${i}`) * 25;

        const dropProgress = spring({
          frame: frame - startDelay - delay,
          fps,
          config: { damping: 12, stiffness: 80 },
        });

        const orbitSpeed = (i % 2 === 0 ? 1 : -1) * 2;
        const currentAngle = angle + (frame - startDelay) * 0.03 * orbitSpeed;
        const x = Math.cos(currentAngle) * dist * dropProgress;
        const y = Math.sin(currentAngle) * dist * dropProgress;

        return (
          <div
            key={`swirl-drop-${i}-${size.toFixed(0)}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size,
              height: size * (1.2 + random(`swirl-elong-${i}`) * 0.8),
              background: [C.white, C.spotify][i % 2],
              borderRadius: "50%",
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${currentAngle * 57}deg)`,
              opacity: dropProgress * 0.85,
            }}
          />
        );
      })}

      {/* 中央コア */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [startDelay + 20, startDelay + 40], [0, 1], EASE.overshoot)})`,
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            background: C.spotify,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 80px ${C.spotify}, 0 0 160px ${C.spotify}60`,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 80,
              fontWeight: 900,
              color: C.black,
            }}
          >
            S
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── LiquidWaterDrop ──

/**
 * LiquidWaterDrop - 水滴リップルエフェクト - 巨大な波紋と水柱
 */


export const LiquidWaterDrop = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const dropFrame = startDelay + 15;
  const impactProgress = spring({
    frame: frame - dropFrame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  // 大きな波紋
  const rippleCount = 8;
  const ripples = Array.from({ length: rippleCount }).map((_, i) => {
    const delay = i * 8;
    const localFrame = frame - dropFrame - delay;
    if (localFrame < 0) return null;
    const size = localFrame * 30;
    const opacity = Math.max(0, 1 - localFrame / 80);
    const thickness = 8 - i * 0.5;
    return { size, opacity, delay, thickness };
  });

  // 水柱スプラッシュ
  const splashColumns = React.useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      height: 100 + random(`col-h-${i}`) * 200,
      width: 30 + random(`col-w-${i}`) * 40,
      delay: random(`col-d-${i}`) * 10,
      curve: random(`col-c-${i}`) * 0.5 + 0.3,
    }));
  }, []);

  // 飛び散る水滴
  const droplets = React.useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: `droplet-${i}`,
      angle: random(`drop-a-${i}`) * Math.PI * 2,
      distance: random(`drop-dist-${i}`) * 400 + 100,
      size: random(`drop-sz-${i}`) * 30 + 10,
      delay: random(`drop-del-${i}`) * 15,
      arcHeight: random(`drop-arc-${i}`) * 200 + 100,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #0a1628 0%, #1e3a5f 50%, #0a1628 100%)`,
      }}
    >
      {/* 水面反射 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "45%",
          background: `linear-gradient(180deg, ${C.cyan}30 0%, ${C.accent}50 100%)`,
          opacity: 0.6,
        }}
      />

      {/* 波紋 */}
      {ripples.map(
        (ripple, i) =>
          ripple && (
            <div
              key={`ripple-${i}-${ripple.delay}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "55%",
                width: ripple.size,
                height: ripple.size * 0.25,
                border: `${ripple.thickness}px solid ${C.white}`,
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                opacity: ripple.opacity,
                boxShadow: `0 0 20px ${C.cyan}60`,
              }}
            />
          )
      )}

      {/* 水柱 */}
      {splashColumns.map((col, i) => {
        const colProgress = spring({
          frame: frame - dropFrame - col.delay,
          fps,
          config: { damping: 12, stiffness: 150 },
        });

        const x = Math.cos(col.angle) * 100;
        const baseY = height * 0.55;
        const colHeight = col.height * colProgress * (1 - (frame - dropFrame - col.delay) / 60);

        if (colHeight < 10) return null;

        return (
          <div
            key={`col-${i}-${col.angle.toFixed(2)}`}
            style={{
              position: "absolute",
              left: width / 2 + x - col.width / 2,
              top: baseY - colHeight,
              width: col.width,
              height: Math.max(0, colHeight),
              background: `linear-gradient(180deg, ${C.white}90 0%, ${C.cyan}80 100%)`,
              borderRadius: `${col.width / 2}px ${col.width / 2}px 0 0`,
              opacity: 0.7,
            }}
          />
        );
      })}

      {/* 飛び散る水滴 */}
      {droplets.map((drop) => {
        const dropProgress = lerp(
          frame,
          [dropFrame + drop.delay, dropFrame + drop.delay + 40],
          [0, 1],
          EASE.out
        );

        if (dropProgress <= 0) return null;

        const x = Math.cos(drop.angle) * drop.distance * dropProgress;
        const arcY = -drop.arcHeight * Math.sin(dropProgress * Math.PI);
        const y = drop.distance * 0.3 * dropProgress + arcY;

        return (
          <div
            key={drop.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "55%",
              width: drop.size,
              height: drop.size * 1.5,
              background: `radial-gradient(ellipse, ${C.white} 0%, ${C.cyan} 100%)`,
              borderRadius: "50%",
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
              opacity: (1 - dropProgress) * 0.9,
              boxShadow: `0 0 10px ${C.cyan}`,
            }}
          />
        );
      })}

      {/* 中央インパクト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "55%",
          width: 200 * impactProgress,
          height: 200 * impactProgress,
          background: `radial-gradient(circle, ${C.white} 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          opacity: (1 - impactProgress) * 0.8,
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "25%",
          transform: `translate(-50%, -50%) scale(${lerp(frame, [dropFrame + 20, dropFrame + 40], [0, 1], EASE.overshoot)})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 800,
          color: C.white,
          textShadow: `0 0 40px ${C.cyan}, 0 0 80px ${C.accent}`,
        }}
      >
        SPLASH
      </div>
    </AbsoluteFill>
  );
};
