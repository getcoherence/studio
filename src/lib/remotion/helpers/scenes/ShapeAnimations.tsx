// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── Shape3DCube ──

/**
 * Shape3DCube - 3D回転キューブ
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, font } from "../../common";

export const Shape3DCube = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const rotateX = (frame - startDelay) * 0.8;
  const rotateY = (frame - startDelay) * 1.2;

  const cubeSize = 200;

  const faces = [
    { transform: `translateZ(${cubeSize / 2}px)`, bg: C.accent },
    { transform: `rotateY(180deg) translateZ(${cubeSize / 2}px)`, bg: C.secondary },
    { transform: `rotateY(-90deg) translateZ(${cubeSize / 2}px)`, bg: C.tertiary },
    { transform: `rotateY(90deg) translateZ(${cubeSize / 2}px)`, bg: C.orange },
    { transform: `rotateX(90deg) translateZ(${cubeSize / 2}px)`, bg: C.yellow },
    { transform: `rotateX(-90deg) translateZ(${cubeSize / 2}px)`, bg: C.gray[500] },
  ];

  return (
    <AbsoluteFill
      style={{
        background: C.gray[950],
        perspective: 1000,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: cubeSize,
          height: cubeSize,
          transformStyle: "preserve-3d",
          transform: `
            translate(-50%, -50%)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            scale(${entryProgress})
          `,
        }}
      >
        {faces.map((face, i) => (
          <div
            key={`cube-face-${i}`}
            style={{
              position: "absolute",
              width: cubeSize,
              height: cubeSize,
              background: face.bg,
              opacity: 0.9,
              transform: face.transform,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: font,
              fontSize: 40,
              fontWeight: 700,
              color: C.white,
              border: `2px solid ${C.white}20`,
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* ラベル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 80,
          fontFamily: font,
          fontSize: 16,
          color: C.gray[500],
          letterSpacing: 4,
          opacity: entryProgress,
        }}
      >
        3D TRANSFORM
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeCircularProgress ──

/**
 * ShapeCircularProgress - 円形プログレス
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const ShapeCircularProgress = ({ percentage = 75, startDelay = 0 }: {
  percentage?: number;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const progress = lerp(frame, [startDelay, startDelay + 60], [0, percentage], EASE.out);
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 円形プログレス */}
      <svg
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(-90deg)",
        }}
        width="300"
        height="300"
        aria-hidden="true"
      >
        {/* 背景円 */}
        <circle
          cx="150"
          cy="150"
          r="120"
          fill="none"
          stroke={C.gray[800]}
          strokeWidth="12"
        />
        {/* プログレス円 */}
        <circle
          cx="150"
          cy="150"
          r="120"
          fill="none"
          stroke={`url(#progressGradient-${startDelay})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
        <defs>
          <linearGradient id={`progressGradient-${startDelay}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.accent} />
            <stop offset="100%" stopColor={C.secondary} />
          </linearGradient>
        </defs>
      </svg>

      {/* 中央の数字 */}
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
        }}
      >
        {Math.round(progress)}
        <span style={{ fontSize: 40, color: C.gray[500] }}>%</span>
      </div>

      {/* ラベル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 150,
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 18,
          color: C.gray[500],
          letterSpacing: 4,
          opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
        }}
      >
        COMPLETION RATE
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeExplosion ──

/**
 * ShapeExplosion - 爆発するシェイプ
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random, spring } from "remotion";
import { C, lerp, font } from "../../common";

export const ShapeExplosion = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shapeCount = 20;
  const shapes = React.useMemo(() => {
    return Array.from({ length: shapeCount }).map((_, i) => ({
      id: `explosion-shape-${i}`,
      angle: (i / shapeCount) * Math.PI * 2 + random(`angle-${i}`) * 0.5,
      distance: random(`dist-${i}`) * 200 + 150,
      size: random(`size-${i}`) * 30 + 20,
      rotation: random(`rot-${i}`) * 360,
      color: [C.accent, C.secondary, C.tertiary, C.orange][i % 4],
      isCircle: random(`shape-${i}`) > 0.5,
    }));
  }, []);

  const explodeProgress = spring({
    frame: frame - startDelay - 20,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* フラッシュ */}
      {frame >= startDelay + 20 && frame < startDelay + 28 && (
        <AbsoluteFill
          style={{
            background: C.white,
            opacity: lerp(frame, [startDelay + 20, startDelay + 28], [0.6, 0]),
          }}
        />
      )}

      {/* シェイプ */}
      {shapes.map((shape) => {
        const x = Math.cos(shape.angle) * shape.distance * explodeProgress;
        const y = Math.sin(shape.angle) * shape.distance * explodeProgress;
        const rotation = shape.rotation * explodeProgress;

        return (
          <div
            key={shape.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: shape.size,
              height: shape.size,
              background: shape.color,
              borderRadius: shape.isCircle ? "50%" : "0",
              transform: `
                translate(-50%, -50%)
                translate(${x}px, ${y}px)
                rotate(${rotation}deg)
                scale(${explodeProgress})
              `,
              opacity: lerp(frame, [startDelay + 60, startDelay + 90], [1, 0]),
            }}
          />
        );
      })}

      {/* 中央テキスト（爆発前） */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${1 - explodeProgress})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
          opacity: 1 - explodeProgress,
        }}
      >
        BANG!
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeHelix ──

/**
 * ShapeHelix - DNA風らせん構造
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const ShapeHelix = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const entryProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);
  const rotation = (frame - startDelay) * 0.03;

  const points = 20;
  const helixHeight = 500;

  return (
    <AbsoluteFill style={{ background: C.black, perspective: 800 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotateY(${rotation * 57}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {Array.from({ length: points }).map((_, i) => {
          const progress = i / points;
          const y = (progress - 0.5) * helixHeight;
          const angle = progress * Math.PI * 4 + rotation;
          const x1 = Math.cos(angle) * 80;
          const z1 = Math.sin(angle) * 80;
          const x2 = Math.cos(angle + Math.PI) * 80;
          const z2 = Math.sin(angle + Math.PI) * 80;

          const delay = i * 2;
          const pointProgress = lerp(frame, [startDelay + delay, startDelay + delay + 15], [0, 1], EASE.out);

          return (
            <React.Fragment key={`helix-${i}`}>
              {/* 点1 */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 16,
                  height: 16,
                  background: C.accent,
                  borderRadius: "50%",
                  transform: `translate(-50%, -50%) translate3d(${x1}px, ${y}px, ${z1}px) scale(${pointProgress * entryProgress})`,
                  boxShadow: `0 0 20px ${C.accent}`,
                }}
              />
              {/* 点2 */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 16,
                  height: 16,
                  background: C.secondary,
                  borderRadius: "50%",
                  transform: `translate(-50%, -50%) translate3d(${x2}px, ${y}px, ${z2}px) scale(${pointProgress * entryProgress})`,
                  boxShadow: `0 0 20px ${C.secondary}`,
                }}
              />
              {/* 接続線（簡略化） */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 160,
                  height: 2,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.secondary})`,
                  transform: `translate(-50%, -50%) translate3d(0, ${y}px, 0) rotateY(${angle * 57}deg) scaleX(${pointProgress * entryProgress})`,
                  opacity: 0.4,
                }}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* ラベル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 60,
          fontWeight: 700,
          color: C.white,
          opacity: entryProgress,
        }}
      >
        HELIX
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeHexGrid ──

/**
 * ShapeHexGrid - 六角形グリッド - ハニカム構造
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, random, spring } from "remotion";
import { C, lerp, font } from "../../common";

export const ShapeHexGrid = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hexagons: { id: string; x: number; y: number; delay: number }[] = [];
  const hexSize = 70;
  const rows = 6;
  const cols = 10;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * hexSize * 1.5 + (row % 2) * hexSize * 0.75;
      const y = row * hexSize * 0.866;
      hexagons.push({
        id: `hex-${row}-${col}`,
        x: x + 100,
        y: y + 150,
        delay: (row + col) * 2,
      });
    }
  }

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {hexagons.map((hex) => {
        const progress = spring({
          frame: frame - startDelay - hex.delay,
          fps,
          config: { damping: 15, stiffness: 200 },
        });

        const isHighlighted = random(`hex-hl-${hex.id}`) < 0.15;
        const pulse = isHighlighted
          ? 0.8 + Math.sin((frame - startDelay) * 0.1 + hex.x * 0.01) * 0.2
          : 1;

        return (
          <div
            key={hex.id}
            style={{
              position: "absolute",
              left: hex.x,
              top: hex.y,
              width: hexSize,
              height: hexSize * 1.15,
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              background: isHighlighted
                ? `linear-gradient(135deg, ${C.accent}, ${C.secondary})`
                : C.gray[800],
              transform: `scale(${progress * pulse})`,
              opacity: progress * 0.9,
            }}
          />
        );
      })}

      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 80,
          fontFamily: font,
          fontSize: 48,
          fontWeight: 700,
          color: C.white,
          textAlign: "right",
          opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
        }}
      >
        HEXAGONAL
        <div style={{ fontSize: 18, color: C.gray[500], marginTop: 10, letterSpacing: 4 }}>
          GRID PATTERN
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeMandala ──

/**
 * ShapeMandala - 幾何学パターン - マンダラ風
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, font } from "../../common";

export const ShapeMandala = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const rotation = (frame - startDelay) * 0.3;
  const layers = [
    { count: 12, radius: 80, size: 20, color: C.accent },
    { count: 8, radius: 140, size: 30, color: C.secondary },
    { count: 16, radius: 200, size: 15, color: C.tertiary },
    { count: 6, radius: 260, size: 40, color: C.orange },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {layers.map((layer, layerIndex) => (
          <div
            key={`mandala-layer-${layerIndex}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `
                translate(-50%, -50%)
                rotate(${rotation * (layerIndex % 2 === 0 ? 1 : -1)}deg)
                scale(${entryProgress})
              `,
            }}
          >
            {Array.from({ length: layer.count }).map((_, i) => {
              const angle = (i / layer.count) * Math.PI * 2;
              const x = Math.cos(angle) * layer.radius;
              const y = Math.sin(angle) * layer.radius;

              return (
                <div
                  key={`mandala-${layerIndex}-${i}`}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: layer.size,
                    height: layer.size,
                    background: layer.color,
                    borderRadius: layerIndex % 2 === 0 ? "50%" : "0",
                    transform: `
                      translate(-50%, -50%)
                      translate(${x}px, ${y}px)
                      rotate(${angle * 57}deg)
                    `,
                    opacity: 0.8,
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* 中央 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 40,
            height: 40,
            background: C.white,
            borderRadius: "50%",
            transform: `translate(-50%, -50%) scale(${entryProgress})`,
          }}
        />
      </div>

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 14,
          color: C.gray[500],
          letterSpacing: 4,
          textAlign: "right",
          opacity: entryProgress,
        }}
      >
        GEOMETRIC
        <div style={{ marginTop: 5 }}>PATTERN</div>
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeMorphing ──

/**
 * ShapeMorphing - モーフィングシェイプ - 形が変化
 */

import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const ShapeMorphing = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  // 0-1の周期的な値
  const cycle = (frame - startDelay) % 120;
  const morphProgress = cycle < 60
    ? lerp(cycle, [0, 60], [0, 1], EASE.out)
    : lerp(cycle, [60, 120], [1, 0], EASE.out);

  // 形状間の補間
  const borderRadius = interpolate(morphProgress, [0, 0.5, 1], [50, 20, 0]);
  const rotation = (frame - startDelay) * 0.5;
  const scale = 1 + Math.sin((frame - startDelay) * 0.05) * 0.1;

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 影 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "55%",
          width: 250,
          height: 250,
          background: C.accent,
          borderRadius: `${borderRadius}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
          filter: "blur(60px)",
          opacity: 0.3,
        }}
      />

      {/* メインシェイプ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 250,
          height: 250,
          background: `linear-gradient(135deg, ${C.accent}, ${C.secondary})`,
          borderRadius: `${borderRadius}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
        }}
      />

      {/* ラベル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 80,
          fontFamily: font,
          fontSize: 60,
          fontWeight: 700,
          color: C.white,
        }}
      >
        MORPH
      </div>

      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 16,
          color: C.gray[500],
        }}
      >
        {morphProgress < 0.33 ? "CIRCLE" : morphProgress < 0.66 ? "ROUNDED" : "SQUARE"}
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeParticleField ──

/**
 * ShapeParticleField - パーティクルフィールド - 浮遊する点
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const ShapeParticleField = ({ particleCount = 60, startDelay = 0 }: {
  particleCount?: number;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      id: `particle-field-${i}`,
      x: random(`px-${i}`) * width,
      y: random(`py-${i}`) * height,
      size: random(`ps-${i}`) * 6 + 2,
      speed: random(`psp-${i}`) * 0.5 + 0.2,
      opacity: random(`po-${i}`) * 0.6 + 0.2,
    }));
  }, [particleCount, width, height]);

  const entryProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* パーティクル */}
      {particles.map((p) => {
        const y = (p.y + (frame - startDelay) * p.speed * 2) % height;
        const floatX = Math.sin((frame - startDelay) * 0.02 + p.x * 0.01) * 20;

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: p.x + floatX,
              top: y,
              width: p.size,
              height: p.size,
              background: C.white,
              borderRadius: "50%",
              opacity: p.opacity * entryProgress,
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
          transform: `translate(-50%, -50%) scale(${entryProgress})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 800,
          color: C.white,
          textShadow: `0 0 60px ${C.accent}`,
        }}
      >
        PARTICLES
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeRipples ──

/**
 * ShapeRipples - 波紋エフェクト - 水面の波紋
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const ShapeRipples = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const ripples = [0, 20, 40, 60, 80].map((delay) => {
    const localFrame = (frame - startDelay - delay + 100) % 100;
    const size = localFrame * 8;
    const opacity = 1 - localFrame / 100;
    return { size, opacity, delay };
  });

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 波紋 */}
      {ripples.map((ripple, i) => (
        <div
          key={`ripple-${i}-${ripple.delay}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: ripple.size,
            height: ripple.size,
            border: `2px solid ${C.accent}`,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            opacity: ripple.opacity * (frame > startDelay ? 1 : 0),
          }}
        />
      ))}

      {/* 中央のドット */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 16,
          height: 16,
          background: C.accent,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 30px ${C.accent}`,
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 150,
          fontFamily: font,
          fontSize: 80,
          fontWeight: 700,
          color: C.white,
          opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
        }}
      >
        RIPPLE
      </div>
    </AbsoluteFill>
  );
};

// ── ShapeSpinningRings ──

/**
 * ShapeSpinningRings - 回転する円環 - ローディング風
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, font } from "../../common";

export const ShapeSpinningRings = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const rotation = (frame - startDelay) * 2;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* 外側のリング */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 300,
            height: 300,
            border: `4px solid ${C.accent}`,
            borderRadius: "50%",
            borderTopColor: "transparent",
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${entryProgress})`,
          }}
        />

        {/* 中間のリング */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 220,
            height: 220,
            border: `3px solid ${C.secondary}`,
            borderRadius: "50%",
            borderBottomColor: "transparent",
            transform: `translate(-50%, -50%) rotate(${-rotation * 1.5}deg) scale(${entryProgress})`,
          }}
        />

        {/* 内側のリング */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 140,
            height: 140,
            border: `2px solid ${C.tertiary}`,
            borderRadius: "50%",
            borderLeftColor: "transparent",
            transform: `translate(-50%, -50%) rotate(${rotation * 2}deg) scale(${entryProgress})`,
          }}
        />

        {/* 中央のドット */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 20,
            height: 20,
            background: C.white,
            borderRadius: "50%",
            transform: `translate(-50%, -50%) scale(${entryProgress})`,
          }}
        />
      </div>

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 14,
          color: C.gray[500],
          letterSpacing: 4,
          opacity: entryProgress,
        }}
      >
        LOADING
      </div>
    </AbsoluteFill>
  );
};
