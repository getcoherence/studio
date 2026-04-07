// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── EffectChromaticAberration ──

/**
 * EffectChromaticAberration - 色収差 - クロマティックアベレーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const EffectChromaticAberration = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const aberrationAmount = Math.sin((frame - startDelay) * 0.1) * 8 + 8;
  const textOpacity = lerp(frame, [startDelay, startDelay + 20], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 赤チャンネル */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateX(${aberrationAmount}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: "rgba(255, 0, 0, 0.7)",
            mixBlendMode: "screen",
            opacity: textOpacity,
          }}
        >
          CHROMATIC
        </div>
      </AbsoluteFill>

      {/* 緑チャンネル */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: "rgba(0, 255, 0, 0.7)",
            mixBlendMode: "screen",
            opacity: textOpacity,
          }}
        >
          CHROMATIC
        </div>
      </AbsoluteFill>

      {/* 青チャンネル */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateX(${-aberrationAmount}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: "rgba(0, 0, 255, 0.7)",
            mixBlendMode: "screen",
            opacity: textOpacity,
          }}
        >
          CHROMATIC
        </div>
      </AbsoluteFill>

      {/* サブテキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 150,
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 18,
          color: C.gray[500],
          letterSpacing: 6,
          opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
        }}
      >
        ABERRATION EFFECT
      </div>
    </AbsoluteFill>
  );
};

// ── EffectDepthOfField ──

/**
 * EffectDepthOfField - ぼかし深度 - デプスオブフィールド
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const EffectDepthOfField = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const focusPoint = lerp(frame, [startDelay, startDelay + 60], [0, 2], EASE.inOut);
  const layer1Blur = Math.abs(focusPoint - 0) * 8;
  const layer2Blur = Math.abs(focusPoint - 1) * 8;
  const layer3Blur = Math.abs(focusPoint - 2) * 8;

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 背景レイヤー（遠い） */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: `blur(${layer3Blur}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 200,
            fontWeight: 900,
            color: C.gray[800],
            opacity: 0.5,
          }}
        >
          FAR
        </div>
      </AbsoluteFill>

      {/* 中間レイヤー */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: `blur(${layer2Blur}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 100,
            fontWeight: 700,
            color: C.accent,
            marginTop: -50,
          }}
        >
          MIDDLE
        </div>
      </AbsoluteFill>

      {/* 前景レイヤー（近い） */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 100,
          filter: `blur(${layer1Blur}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 60,
            fontWeight: 600,
            color: C.white,
          }}
        >
          NEAR
        </div>
      </AbsoluteFill>

      {/* フォーカスインジケーター */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        {["FAR", "MID", "NEAR"].map((label, i) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: Math.round(focusPoint) === 2 - i ? C.accent : C.gray[700],
                borderRadius: "50%",
              }}
            />
            <span
              style={{
                fontFamily: font,
                fontSize: 12,
                color: Math.round(focusPoint) === 2 - i ? C.white : C.gray[600],
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── EffectDuotone ──

/**
 * EffectDuotone - デュオトーン効果
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const EffectDuotone = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const hueShift = (frame - startDelay) * 2;
  const textOpacity = lerp(frame, [startDelay, startDelay + 30], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, 
          hsl(${hueShift % 360}, 70%, 30%),
          hsl(${(hueShift + 60) % 360}, 70%, 50%)
        )`,
      }}
    >
      {/* パターン */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 30%),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 40%)
          `,
        }}
      />

      {/* グリッドオーバーレイ */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* テキスト */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: C.white,
            opacity: textOpacity,
            mixBlendMode: "overlay",
          }}
        >
          DUOTONE
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            color: C.white,
            letterSpacing: 8,
            marginTop: 20,
            opacity: textOpacity * 0.7,
          }}
        >
          COLOR EFFECT
        </div>
      </AbsoluteFill>

      {/* コーナーデコレーション */}
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 40,
          width: 60,
          height: 60,
          borderLeft: `3px solid ${C.white}50`,
          borderTop: `3px solid ${C.white}50`,
          opacity: textOpacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 40,
          width: 60,
          height: 60,
          borderRight: `3px solid ${C.white}50`,
          borderBottom: `3px solid ${C.white}50`,
          opacity: textOpacity,
        }}
      />
    </AbsoluteFill>
  );
};

// ── EffectFilmGrain ──

/**
 * EffectFilmGrain - フィルムグレイン - 映画風ノイズ
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const EffectFilmGrain = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  // グレイン生成
  const grainSeed = Math.floor(frame * 2);
  const grainPatterns = Array.from({ length: 100 }).map((_, i) => ({
    id: `grain-${i}`,
    x: random(`grain-x-${grainSeed}-${i}`) * 100,
    y: random(`grain-y-${grainSeed}-${i}`) * 100,
    opacity: random(`grain-o-${grainSeed}-${i}`) * 0.15,
    size: random(`grain-s-${grainSeed}-${i}`) * 3 + 1,
  }));

  const textOpacity = lerp(frame, [startDelay, startDelay + 30], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* コンテンツ */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 100,
            fontWeight: 800,
            color: C.white,
            opacity: textOpacity,
          }}
        >
          CINEMATIC
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            color: C.gray[500],
            letterSpacing: 8,
            marginTop: 20,
            opacity: textOpacity,
          }}
        >
          FILM GRAIN EFFECT
        </div>
      </AbsoluteFill>

      {/* グレインオーバーレイ */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {grainPatterns.map((grain) => (
          <div
            key={grain.id}
            style={{
              position: "absolute",
              left: `${grain.x}%`,
              top: `${grain.y}%`,
              width: grain.size,
              height: grain.size,
              background: C.white,
              borderRadius: "50%",
              opacity: grain.opacity,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* スキャンライン */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          )`,
          pointerEvents: "none",
        }}
      />

      {/* ビネット */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ── EffectGlow ──

/**
 * EffectGlow - グロー効果 - 発光
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, font } from "../../common";

export const EffectGlow = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const pulseIntensity = 0.8 + Math.sin((frame - startDelay) * 0.1) * 0.2;
  const glowSize = 40 + Math.sin((frame - startDelay) * 0.15) * 20;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景グロー */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 600,
          height: 200,
          background: C.accent,
          borderRadius: 100,
          transform: `translate(-50%, -50%) scale(${entryProgress})`,
          filter: `blur(${glowSize}px)`,
          opacity: 0.4 * pulseIntensity,
        }}
      />

      {/* テキスト */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 800,
            color: C.white,
            transform: `scale(${entryProgress})`,
            textShadow: `
              0 0 20px ${C.accent},
              0 0 40px ${C.accent},
              0 0 60px ${C.accent}80
            `,
          }}
        >
          GLOW
        </div>
      </AbsoluteFill>

      {/* パーティクル */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const distance = 200 + Math.sin((frame - startDelay) * 0.05 + i) * 50;
        const x = Math.cos(angle + (frame - startDelay) * 0.01) * distance;
        const y = Math.sin(angle + (frame - startDelay) * 0.01) * distance;

        return (
          <div
            key={`glow-particle-${i}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 8,
              height: 8,
              background: C.accent,
              borderRadius: "50%",
              transform: `translate(${x}px, ${y}px)`,
              opacity: 0.6 * entryProgress,
              boxShadow: `0 0 10px ${C.accent}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── EffectKaleidoscope ──

/**
 * EffectKaleidoscope - 万華鏡エフェクト
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C, font } from "../../common";

export const EffectKaleidoscope = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const rotation = (frame - startDelay) * 0.5;
  const segments = 6;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${entryProgress})`,
        }}
      >
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={`kaleidoscope-segment-${i}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 400,
              height: 400,
              transform: `
                translate(-50%, -50%)
                rotate(${(i * 360) / segments + rotation}deg)
              `,
              clipPath: `polygon(50% 50%, 100% 0%, 100% ${100 / segments}%)`,
            }}
          >
            {/* 内部のパターン */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `
                  conic-gradient(
                    from ${rotation * 2}deg,
                    ${C.accent},
                    ${C.secondary},
                    ${C.tertiary},
                    ${C.accent}
                  )
                `,
                opacity: 0.8,
              }}
            />

            {/* 形状 */}
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={`shape-${i}-${j}`}
                style={{
                  position: "absolute",
                  left: `${50 + j * 15}%`,
                  top: `${30 + j * 10}%`,
                  width: 30 - j * 8,
                  height: 30 - j * 8,
                  background: j % 2 === 0 ? C.white : C.accent,
                  borderRadius: j % 2 === 0 ? "50%" : "0",
                  transform: `rotate(${rotation * (j + 1)}deg)`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 中央のテキスト */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 40,
            fontWeight: 700,
            color: C.white,
            textShadow: "0 0 20px rgba(0,0,0,0.8)",
            opacity: entryProgress,
          }}
        >
          KALEIDOSCOPE
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── EffectLightLeak ──

/**
 * EffectLightLeak - ライトリーク - 光漏れ効果
 */

import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C, lerp, font } from "../../common";

export const EffectLightLeak = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const leak1X = lerp(frame, [startDelay, startDelay + 80], [-20, 120]);
  const leak2X = lerp(frame, [startDelay + 20, startDelay + 100], [120, -20]);
  const leak1Opacity = interpolate(
    frame,
    [startDelay, startDelay + 30, startDelay + 60, startDelay + 80],
    [0, 0.6, 0.6, 0]
  );
  const leak2Opacity = interpolate(
    frame,
    [startDelay + 20, startDelay + 50, startDelay + 80, startDelay + 100],
    [0, 0.5, 0.5, 0]
  );

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* コンテンツ */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 700,
            color: C.white,
            opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
          }}
        >
          LIGHT LEAKS
        </div>
      </AbsoluteFill>

      {/* ライトリーク1（オレンジ） */}
      <div
        style={{
          position: "absolute",
          left: `${leak1X}%`,
          top: "20%",
          width: 400,
          height: 600,
          background: `radial-gradient(ellipse, rgba(255, 150, 50, 0.8) 0%, transparent 70%)`,
          transform: "rotate(-20deg)",
          opacity: leak1Opacity,
          mixBlendMode: "screen",
          filter: "blur(40px)",
        }}
      />

      {/* ライトリーク2（マゼンタ） */}
      <div
        style={{
          position: "absolute",
          left: `${leak2X}%`,
          bottom: "10%",
          width: 500,
          height: 500,
          background: `radial-gradient(ellipse, rgba(255, 50, 150, 0.7) 0%, transparent 70%)`,
          transform: "rotate(30deg)",
          opacity: leak2Opacity,
          mixBlendMode: "screen",
          filter: "blur(60px)",
        }}
      />

      {/* フレア */}
      <div
        style={{
          position: "absolute",
          left: `${leak1X + 10}%`,
          top: "40%",
          width: 200,
          height: 200,
          background: `radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 60%)`,
          opacity: leak1Opacity * 0.5,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

// ── EffectMatrix ──

/**
 * EffectMatrix - マトリックス風
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";
import { lerp, font } from "../../common";

export const EffectMatrix = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const columnCount = 30;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";

  const columns = React.useMemo(() => {
    return Array.from({ length: columnCount }).map((_, i) => ({
      x: (i / columnCount) * 100,
      speed: random(`matrix-speed-${i}`) * 3 + 2,
      offset: random(`matrix-offset-${i}`) * 100,
      chars: Array.from({ length: 20 }).map((_, j) => ({
        char: chars[Math.floor(random(`matrix-char-${i}-${j}`) * chars.length)],
        opacity: 1 - j * 0.05,
      })),
    }));
  }, []);

  const textOpacity = lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "#001100" }}>
      {/* マトリックスレイン */}
      {columns.map((col, colIndex) => {
        const y = ((frame - startDelay) * col.speed + col.offset) % (height + 500) - 250;

        return (
          <div
            key={`matrix-col-${colIndex}`}
            style={{
              position: "absolute",
              left: `${col.x}%`,
              top: y,
            }}
          >
            {col.chars.map((c, charIndex) => (
              <div
                key={`matrix-char-${colIndex}-${charIndex}`}
                style={{
                  fontFamily: "monospace",
                  fontSize: 20,
                  color: charIndex === 0 ? "#ffffff" : "#00ff00",
                  opacity: c.opacity * lerp(frame, [startDelay, startDelay + 30], [0, 1]),
                  textShadow: charIndex === 0 ? "0 0 10px #00ff00" : "none",
                  height: 25,
                }}
              >
                {charIndex === 0 || random(`matrix-show-${frame}-${colIndex}-${charIndex}`) > 0.02
                  ? c.char
                  : chars[Math.floor(random(`matrix-change-${frame}-${colIndex}-${charIndex}`) * chars.length)]}
              </div>
            ))}
          </div>
        );
      })}

      {/* オーバーレイテキスト */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 700,
            color: "#00ff00",
            textShadow: "0 0 30px #00ff00",
            opacity: textOpacity,
          }}
        >
          THE MATRIX
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── EffectNoise ──

/**
 * EffectNoise - ノイズテクスチャ - TVノイズ
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const EffectNoise = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const noiseSeed = frame;
  const noiseIntensity = lerp(frame, [startDelay, startDelay + 20], [1, 0.3]);

  // ノイズパターン生成
  const noiseLines = Array.from({ length: 50 }).map((_, i) => ({
    y: random(`noise-y-${noiseSeed}-${i}`) * 100,
    opacity: random(`noise-o-${noiseSeed}-${i}`) * 0.3,
    width: random(`noise-w-${noiseSeed}-${i}`) * 100,
  }));

  const textOpacity = lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* ノイズオーバーレイ */}
      <AbsoluteFill
        style={{
          opacity: noiseIntensity,
        }}
      >
        {noiseLines.map((line, i) => (
          <div
            key={`noise-${i}`}
            style={{
              position: "absolute",
              left: 0,
              top: `${line.y}%`,
              width: `${line.width}%`,
              height: 2,
              background: C.white,
              opacity: line.opacity,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* コンテンツ */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 100,
            fontWeight: 800,
            color: C.white,
            opacity: textOpacity,
            textShadow: `
              ${random(`shadow-x-${frame}`) * 4 - 2}px 0 0 ${C.secondary},
              ${random(`shadow-x2-${frame}`) * -4 + 2}px 0 0 ${C.accent}
            `,
          }}
        >
          STATIC
        </div>
      </AbsoluteFill>

      {/* スキャンライン */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `${((frame * 3) % 100)}%`,
          width: "100%",
          height: 4,
          background: `linear-gradient(to right, transparent, ${C.white}20, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ── EffectVHS ──

/**
 * EffectVHS - VHSエフェクト
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, font } from "../../common";

export const EffectVHS = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const tracking = Math.sin((frame - startDelay) * 0.05) * 5;
  const jitter = random(`vhs-${frame}`) > 0.95;
  const jitterAmount = jitter ? random(`vhs-jitter-${frame}`) * 20 - 10 : 0;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* メインコンテンツ */}
      <AbsoluteFill
        style={{
          transform: `translateX(${jitterAmount}px) skewX(${jitter ? 2 : 0}deg)`,
        }}
      >
        {/* 赤チャンネルずれ */}
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translateX(${tracking}px)`,
            mixBlendMode: "screen",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 100,
              fontWeight: 800,
              color: "rgba(255, 0, 0, 0.7)",
            }}
          >
            VHS
          </div>
        </AbsoluteFill>

        {/* シアンチャンネルずれ */}
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translateX(${-tracking}px)`,
            mixBlendMode: "screen",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 100,
              fontWeight: 800,
              color: "rgba(0, 255, 255, 0.7)",
            }}
          >
            VHS
          </div>
        </AbsoluteFill>

        {/* メインテキスト */}
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 100,
              fontWeight: 800,
              color: C.white,
            }}
          >
            VHS
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* スキャンライン */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 1px,
            rgba(0, 0, 0, 0.2) 1px,
            rgba(0, 0, 0, 0.2) 2px
          )`,
          pointerEvents: "none",
        }}
      />

      {/* ノイズバー */}
      {jitter && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: `${random(`noise-bar-${frame}`) * 80 + 10}%`,
            width: "100%",
            height: random(`noise-bar-h-${frame}`) * 30 + 10,
            background: `linear-gradient(to bottom, transparent, ${C.white}30, transparent)`,
          }}
        />
      )}

      {/* 日付スタンプ */}
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 40,
          fontFamily: "monospace",
          fontSize: 18,
          color: C.white,
          textShadow: "2px 2px 0 rgba(0, 0, 0, 0.8)",
        }}
      >
        PLAY ▶ 02:26:25
      </div>
    </AbsoluteFill>
  );
};
