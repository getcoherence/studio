// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── BackgroundAurora ──

/**
 * BackgroundAurora - オーロラ効果
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundAurora = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const layer1X = Math.sin((frame - startDelay) * 0.02) * 20;
  const layer2X = Math.cos((frame - startDelay) * 0.03) * 30;
  const layer3X = Math.sin((frame - startDelay) * 0.015 + 1) * 25;

  return (
    <AbsoluteFill style={{ background: "#0a0a20" }}>
      {/* オーロラレイヤー1 */}
      <div
        style={{
          position: "absolute",
          left: `${40 + layer1X}%`,
          top: "10%",
          width: "60%",
          height: "50%",
          background: `radial-gradient(ellipse at center, ${C.accent}60 0%, transparent 70%)`,
          filter: "blur(60px)",
          transform: `rotate(${(frame - startDelay) * 0.2}deg)`,
        }}
      />

      {/* オーロラレイヤー2 */}
      <div
        style={{
          position: "absolute",
          left: `${20 + layer2X}%`,
          top: "20%",
          width: "70%",
          height: "40%",
          background: `radial-gradient(ellipse at center, ${C.tertiary}50 0%, transparent 70%)`,
          filter: "blur(80px)",
          transform: `rotate(${-(frame - startDelay) * 0.15}deg)`,
        }}
      />

      {/* オーロラレイヤー3 */}
      <div
        style={{
          position: "absolute",
          left: `${50 + layer3X}%`,
          top: "5%",
          width: "50%",
          height: "60%",
          background: `radial-gradient(ellipse at center, ${C.secondary}40 0%, transparent 70%)`,
          filter: "blur(70px)",
          transform: `rotate(${(frame - startDelay) * 0.1}deg)`,
        }}
      />

      {/* 星 */}
      {Array.from({ length: 30 }).map((_, i) => {
        const twinkle = Math.sin((frame - startDelay) * 0.1 + i) * 0.5 + 0.5;
        return (
          <div
            key={`star-aurora-${i}`}
            style={{
              position: "absolute",
              left: `${random(`star-x-${i}`) * 100}%`,
              top: `${random(`star-y-${i}`) * 60}%`,
              width: random(`star-s-${i}`) * 3 + 1,
              height: random(`star-s-${i}`) * 3 + 1,
              background: C.white,
              borderRadius: "50%",
              opacity: twinkle * 0.8,
            }}
          />
        );
      })}

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "20%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 60,
          fontWeight: 700,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 40], [0, 1]),
          textShadow: `0 0 40px ${C.accent}`,
        }}
      >
        AURORA
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundBokeh ──

/**
 * BackgroundBokeh - ボケ効果
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundBokeh = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const bokehCount = 20;
  const bokehs = React.useMemo(() => {
    return Array.from({ length: bokehCount }).map((_, i) => ({
      id: `bokeh-${i}`,
      x: random(`bokeh-x-${i}`) * 100,
      y: random(`bokeh-y-${i}`) * 100,
      size: random(`bokeh-s-${i}`) * 150 + 50,
      color: [C.accent, C.secondary, C.tertiary, C.orange][i % 4],
      speedX: (random(`bokeh-sx-${i}`) - 0.5) * 0.3,
      speedY: (random(`bokeh-sy-${i}`) - 0.5) * 0.3,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {bokehs.map((bokeh) => {
        const x = (bokeh.x + (frame - startDelay) * bokeh.speedX) % 120 - 10;
        const y = (bokeh.y + (frame - startDelay) * bokeh.speedY) % 120 - 10;
        const pulse = 0.8 + Math.sin((frame - startDelay) * 0.05 + bokeh.x) * 0.2;

        return (
          <div
            key={bokeh.id}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: bokeh.size * pulse,
              height: bokeh.size * pulse,
              background: `radial-gradient(circle, ${bokeh.color}60 0%, transparent 70%)`,
              borderRadius: "50%",
              filter: "blur(30px)",
              opacity: lerp(frame, [startDelay, startDelay + 30], [0, 0.6]),
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
          fontFamily: font,
          fontSize: 80,
          fontWeight: 700,
          color: C.white,
          opacity: lerp(frame, [startDelay + 20, startDelay + 50], [0, 1]),
        }}
      >
        BOKEH
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundFlowingGradient ──

/**
 * BackgroundFlowingGradient - 流れるグラデーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundFlowingGradient = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const hue1 = ((frame - startDelay) * 0.5) % 360;
  const hue2 = (hue1 + 60) % 360;
  const hue3 = (hue1 + 120) % 360;

  const angle = (frame - startDelay) * 0.5;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(
          ${angle}deg,
          hsl(${hue1}, 70%, 50%),
          hsl(${hue2}, 70%, 40%),
          hsl(${hue3}, 70%, 50%)
        )`,
      }}
    >
      {/* オーバーレイテキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          color: C.white,
          mixBlendMode: "overlay",
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 0.5]),
        }}
      >
        FLOW
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundGeometric ──

/**
 * BackgroundGeometric - ジオメトリックパターン
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundGeometric = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const shapes = React.useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: `geo-shape-${i}`,
      x: random(`geo-x-${i}`) * 100,
      y: random(`geo-y-${i}`) * 100,
      size: random(`geo-s-${i}`) * 100 + 50,
      rotation: random(`geo-r-${i}`) * 360,
      type: Math.floor(random(`geo-t-${i}`) * 3),
      color: [C.accent, C.secondary, C.tertiary][i % 3],
      speed: random(`geo-sp-${i}`) * 0.5 + 0.2,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {shapes.map((shape) => {
        const rotation = shape.rotation + (frame - startDelay) * shape.speed;
        const opacity = lerp(frame, [startDelay, startDelay + 30], [0, 0.15]);

        return (
          <div
            key={shape.id}
            style={{
              position: "absolute",
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: shape.size,
              height: shape.size,
              background: shape.type === 0 ? shape.color : "transparent",
              border: shape.type !== 0 ? `2px solid ${shape.color}` : "none",
              borderRadius: shape.type === 1 ? "50%" : 0,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              opacity: opacity,
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
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
          opacity: lerp(frame, [startDelay + 20, startDelay + 50], [0, 1]),
        }}
      >
        GEOMETRIC
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundGrid ──

/**
 * BackgroundGrid - グリッドアニメーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundGrid = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const gridSize = 50;
  const rows = 15;
  const cols = 26;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* アニメーショングリッド */}
      {Array.from({ length: rows * cols }).map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;

        const distance = Math.sqrt(
          Math.pow(row - rows / 2, 2) + Math.pow(col - cols / 2, 2)
        );

        const wave = Math.sin((frame - startDelay) * 0.1 - distance * 0.3);
        const opacity = (wave + 1) * 0.3;

        return (
          <div
            key={`grid-cell-${i}`}
            style={{
              position: "absolute",
              left: col * gridSize,
              top: row * gridSize,
              width: gridSize - 2,
              height: gridSize - 2,
              background: C.accent,
              opacity: opacity * lerp(frame, [startDelay, startDelay + 30], [0, 1]),
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
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          color: C.white,
          textShadow: "0 0 40px rgba(0,0,0,0.8)",
        }}
      >
        GRID
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundMeshGradient ──

/**
 * BackgroundMeshGradient - メッシュグラデーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundMeshGradient = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const blob1X = 30 + Math.sin((frame - startDelay) * 0.02) * 20;
  const blob1Y = 30 + Math.cos((frame - startDelay) * 0.03) * 15;
  const blob2X = 70 + Math.cos((frame - startDelay) * 0.025) * 15;
  const blob2Y = 60 + Math.sin((frame - startDelay) * 0.02) * 20;
  const blob3X = 50 + Math.sin((frame - startDelay) * 0.015) * 25;
  const blob3Y = 80 + Math.cos((frame - startDelay) * 0.02) * 10;

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* ブロブ1 */}
      <div
        style={{
          position: "absolute",
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          width: "60%",
          height: "60%",
          background: C.accent,
          borderRadius: "50%",
          filter: "blur(100px)",
          opacity: 0.6,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* ブロブ2 */}
      <div
        style={{
          position: "absolute",
          left: `${blob2X}%`,
          top: `${blob2Y}%`,
          width: "50%",
          height: "50%",
          background: C.secondary,
          borderRadius: "50%",
          filter: "blur(100px)",
          opacity: 0.5,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* ブロブ3 */}
      <div
        style={{
          position: "absolute",
          left: `${blob3X}%`,
          top: `${blob3Y}%`,
          width: "40%",
          height: "40%",
          background: C.tertiary,
          borderRadius: "50%",
          filter: "blur(80px)",
          opacity: 0.5,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        MESH
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundNoiseTexture ──

/**
 * BackgroundNoiseTexture - ノイズテクスチャ
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundNoiseTexture = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const noiseSeed = Math.floor(frame / 2);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${C.accent}80, ${C.secondary}80)`,
      }}
    >
      {/* ノイズオーバーレイ */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${noiseSeed}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.15,
          mixBlendMode: "overlay",
        }}
      />

      {/* グレインオーバーレイ */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 1px,
            rgba(255, 255, 255, 0.03) 1px,
            rgba(255, 255, 255, 0.03) 2px
          )`,
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
          textShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        TEXTURE
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundPerspectiveGrid ──

/**
 * BackgroundPerspectiveGrid - パースペクティブグリッド
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundPerspectiveGrid = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const scrollZ = (frame - startDelay) * 2;

  return (
    <AbsoluteFill style={{ background: C.black, perspective: 500, overflow: "hidden" }}>
      {/* グリッド */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 2000,
          height: 2000,
          transform: `translate(-50%, -50%) rotateX(70deg) translateZ(${scrollZ % 100}px)`,
          transformStyle: "preserve-3d",
          backgroundImage: `
            linear-gradient(${C.accent}40 1px, transparent 1px),
            linear-gradient(90deg, ${C.accent}40 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
        }}
      />

      {/* 水平線 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          width: "100%",
          height: 2,
          background: C.accent,
          transform: "translateY(-50%)",
        }}
      />

      {/* 太陽/光源 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "45%",
          width: 80,
          height: 80,
          background: `radial-gradient(circle, ${C.orange}, ${C.secondary})`,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 60px ${C.orange}, 0 0 120px ${C.secondary}`,
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "15%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 60,
          fontWeight: 700,
          color: C.white,
          letterSpacing: 8,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        RETRO GRID
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundRadial ──

/**
 * BackgroundRadial - 放射状パターン
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundRadial = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const rayCount = 24;
  const rotation = (frame - startDelay) * 0.5;

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 放射状の光線 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      >
        {Array.from({ length: rayCount }).map((_, i) => {
          const angle = (i / rayCount) * 360;
          const opacity = lerp(frame, [startDelay, startDelay + 30], [0, 0.3]);

          return (
            <div
              key={`ray-${i}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 1000,
                height: 4,
                background: `linear-gradient(90deg, ${i % 2 === 0 ? C.accent : C.secondary}, transparent)`,
                transformOrigin: "left center",
                transform: `rotate(${angle}deg)`,
                opacity: opacity,
              }}
            />
          );
        })}
      </div>

      {/* 中央の円 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 200,
          height: 200,
          background: C.gray[950],
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 40,
            fontWeight: 800,
            color: C.white,
          }}
        >
          RADIAL
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── BackgroundWaves ──

/**
 * BackgroundWaves - 波形背景
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, lerp, font } from "../../common";

export const BackgroundWaves = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const generateWavePath = (offset: number, amplitude: number, frequency: number) => {
    let path = "M 0 360";
    for (let x = 0; x <= width; x += 10) {
      const y = 360 + Math.sin((x * frequency + (frame - startDelay) * 2 + offset) * 0.01) * amplitude;
      path += ` L ${x} ${y}`;
    }
    path += ` L ${width} 720 L 0 720 Z`;
    return path;
  };

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        {/* 波1（背面） */}
        <path
          d={generateWavePath(0, 40, 1)}
          fill={C.accent}
          opacity={0.3}
        />
        {/* 波2（中間） */}
        <path
          d={generateWavePath(100, 50, 1.5)}
          fill={C.secondary}
          opacity={0.4}
        />
        {/* 波3（前面） */}
        <path
          d={generateWavePath(200, 60, 2)}
          fill={C.tertiary}
          opacity={0.5}
        />
      </svg>

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "30%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        WAVES
      </div>
    </AbsoluteFill>
  );
};
