// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── Text3DFlip ──

/**
 * Text3DFlip - 3Dフリップテキスト - Y軸回転で登場
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C, font } from "../../common";

export const Text3DFlip = ({ text = "FLIP", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = text.split("");

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
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 8,
          transformStyle: "preserve-3d",
        }}
      >
        {chars.map((char, i) => {
          const delay = startDelay + i * 5;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 100 },
          });

          const rotateY = interpolate(progress, [0, 1], [-90, 0]);
          const scale = interpolate(progress, [0, 0.5, 1], [0.5, 1.1, 1]);

          return (
            <span
              key={`flip-${i}-${char}`}
              style={{
                fontFamily: font,
                fontSize: 130,
                fontWeight: 800,
                color: C.white,
                display: "inline-block",
                transform: `rotateY(${rotateY}deg) scale(${scale})`,
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* 影 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "60%",
          transform: "translateX(-50%) rotateX(80deg)",
          fontFamily: font,
          fontSize: 130,
          fontWeight: 800,
          color: C.white,
          opacity: 0.1,
          filter: "blur(10px)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ── TextCounter ──

/**
 * TextCounter - カウンターテキスト - 数字がカウントアップ
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextCounter = ({
  targetNumber = 10000,
  prefix = "",
  suffix = "+",
  startDelay = 0,
}: {
  targetNumber?: number;
  prefix?: string;
  suffix?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const progress = lerp(frame, [startDelay, startDelay + 60], [0, 1], EASE.out);
  const currentNumber = Math.floor(targetNumber * progress);

  const formattedNumber = currentNumber.toLocaleString();

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        {/* メイン数字 */}
        <div
          style={{
            fontFamily: font,
            fontSize: 180,
            fontWeight: 800,
            color: C.white,
            letterSpacing: -8,
          }}
        >
          {prefix}
          {formattedNumber}
          <span style={{ color: C.accent }}>{suffix}</span>
        </div>

        {/* ラベル */}
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            color: C.gray[500],
            letterSpacing: 6,
            marginTop: 20,
            opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
          }}
        >
          ACTIVE USERS
        </div>
      </div>

      {/* 背景の大きな数字 */}
      <div
        style={{
          position: "absolute",
          right: -100,
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: font,
          fontSize: 400,
          fontWeight: 900,
          color: C.gray[900],
          opacity: 0.3,
        }}
      >
        {Math.floor(targetNumber / 1000)}K
      </div>
    </AbsoluteFill>
  );
};

// ── TextExplode ──

/**
 * TextExplode - 爆発テキスト - 中心から文字が散らばる
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextExplode = ({ text = "BOOM", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = text.split("");

  // 爆発前の集合フェーズ
  const gatherProgress = lerp(frame, [startDelay, startDelay + 25], [0, 1], EASE.out);
  // 爆発フェーズ
  const explodeFrame = startDelay + 30;
  const isExploding = frame >= explodeFrame;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* フラッシュ効果 */}
      {frame >= explodeFrame && frame < explodeFrame + 5 && (
        <AbsoluteFill
          style={{
            background: C.white,
            opacity: interpolate(frame, [explodeFrame, explodeFrame + 5], [0.8, 0]),
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {chars.map((char, i) => {
          const angle = (i / chars.length) * Math.PI * 2;
          const distance = isExploding
            ? spring({
                frame: frame - explodeFrame,
                fps,
                config: { damping: 20, stiffness: 100 },
              }) * 300
            : 0;

          const x = isExploding ? Math.cos(angle) * distance : 0;
          const y = isExploding ? Math.sin(angle) * distance : 0;
          const rotation = isExploding ? (frame - explodeFrame) * (i % 2 === 0 ? 5 : -5) : 0;
          const scale = isExploding
            ? interpolate(frame, [explodeFrame, explodeFrame + 40], [1.5, 0.8], {
                extrapolateRight: "clamp",
              })
            : gatherProgress;

          return (
            <span
              key={`explode-${i}-${char}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                fontFamily: font,
                fontSize: 120,
                fontWeight: 900,
                color: C.white,
                transform: `
                  translate(-50%, -50%)
                  translate(${x}px, ${y}px)
                  rotate(${rotation}deg)
                  scale(${scale})
                `,
                opacity: isExploding
                  ? interpolate(frame, [explodeFrame + 20, explodeFrame + 50], [1, 0], {
                      extrapolateRight: "clamp",
                    })
                  : gatherProgress,
              }}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* 衝撃波 */}
      {isExploding && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: spring({
              frame: frame - explodeFrame,
              fps,
              config: { damping: 30, stiffness: 80 },
            }) * 800,
            height: spring({
              frame: frame - explodeFrame,
              fps,
              config: { damping: 30, stiffness: 80 },
            }) * 800,
            borderRadius: "50%",
            border: `3px solid ${C.accent}`,
            transform: "translate(-50%, -50%)",
            opacity: interpolate(frame, [explodeFrame, explodeFrame + 30], [0.8, 0], {
              extrapolateRight: "clamp",
            }),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ── TextGlitch ──

/**
 * TextGlitch - グリッチテキスト - デジタルグリッチ効果
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextGlitch = ({ text = "GLITCH", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const entryProgress = lerp(frame, [startDelay, startDelay + 20], [0, 1], EASE.out);
  const glitchActive = frame > startDelay + 25 && random(`glitch-${frame}`) < 0.15;

  const offsetX = glitchActive ? (random(`gx-${frame}`) - 0.5) * 30 : 0;
  const offsetY = glitchActive ? (random(`gy-${frame}`) - 0.5) * 10 : 0;
  const skew = glitchActive ? (random(`gs-${frame}`) - 0.5) * 8 : 0;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 赤チャンネル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${offsetX + 3}px, ${offsetY}px)`,
          fontFamily: font,
          fontSize: 140,
          fontWeight: 900,
          color: "rgba(255, 0, 0, 0.8)",
          mixBlendMode: "screen",
          opacity: glitchActive ? 1 : 0,
        }}
      >
        {text}
      </div>

      {/* シアンチャンネル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${-offsetX - 3}px, ${-offsetY}px)`,
          fontFamily: font,
          fontSize: 140,
          fontWeight: 900,
          color: "rgba(0, 255, 255, 0.8)",
          mixBlendMode: "screen",
          opacity: glitchActive ? 1 : 0,
        }}
      >
        {text}
      </div>

      {/* メインテキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `
            translate(-50%, -50%)
            translate(${offsetX}px, ${offsetY}px)
            skewX(${skew}deg)
            scale(${entryProgress})
          `,
          fontFamily: font,
          fontSize: 140,
          fontWeight: 900,
          color: C.white,
        }}
      >
        {text}
      </div>

      {/* スキャンライン */}
      {glitchActive && (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.3) 2px,
              rgba(0, 0, 0, 0.3) 4px
            )`,
          }}
        />
      )}

      {/* ノイズバー */}
      {glitchActive && (
        <>
          {[10, 40, 70].map((offset) => (
            <div
              key={`noise-bar-${offset}`}
              style={{
                position: "absolute",
                left: 0,
                top: `${random(`nb-${frame}-${offset}`) * 100}%`,
                width: "100%",
                height: random(`nbh-${frame}-${offset}`) * 20 + 5,
                background: C.white,
                opacity: 0.1,
              }}
            />
          ))}
        </>
      )}
    </AbsoluteFill>
  );
};

// ── TextGradient ──

/**
 * TextGradient - グラデーションテキスト - 動くグラデーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextGradient = ({ text = "GRADIENT", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const entryProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);
  const gradientOffset = (frame - startDelay) * 2;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${0.8 + entryProgress * 0.2})`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: -4,
            background: `linear-gradient(
              ${90 + gradientOffset}deg,
              ${C.accent},
              ${C.secondary},
              ${C.tertiary},
              ${C.accent}
            )`,
            backgroundSize: "300% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            opacity: entryProgress,
          }}
        >
          {text}
        </div>
      </div>

      {/* 装飾ライン */}
      {[C.accent, C.secondary, C.tertiary].map((color, i) => (
        <div
          key={`grad-line-${color}`}
          style={{
            position: "absolute",
            left: 100 + i * 150,
            bottom: 150,
            width: 100,
            height: 4,
            background: color,
            opacity: lerp(frame, [startDelay + 30 + i * 10, startDelay + 50 + i * 10], [0, 0.6]),
            borderRadius: 2,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ── TextKinetic ──

/**
 * TextKinetic - キネティックタイポグラフィ - 文字が踊る
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextKinetic = ({ text = "KINETIC", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = text.split("");

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 8,
        }}
      >
        {chars.map((char, i) => {
          const delay = startDelay + i * 3;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 200, mass: 0.8 },
          });

          const bounce = Math.sin((frame - delay) * 0.15) * 5 * progress;
          const rotate = Math.sin((frame - delay) * 0.1 + i) * 3 * progress;

          return (
            <span
              key={`kinetic-${i}-${char}`}
              style={{
                fontFamily: font,
                fontSize: 120,
                fontWeight: 800,
                color: C.white,
                display: "inline-block",
                transform: `
                  translateY(${interpolate(progress, [0, 1], [80, 0]) + bounce}px)
                  rotate(${rotate}deg)
                  scale(${progress})
                `,
                opacity: progress,
              }}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* アンダーライン */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "35%",
          transform: "translateX(-50%)",
          width: lerp(frame, [startDelay + 30, startDelay + 50], [0, 400], EASE.out),
          height: 6,
          background: C.accent,
          borderRadius: 3,
        }}
      />
    </AbsoluteFill>
  );
};

// ── TextMaskReveal ──

/**
 * TextMaskReveal - マスクリビールテキスト - マスクで1文字ずつ表示
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextMaskReveal = ({ text = "MASKED", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const chars = text.split("");

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
        }}
      >
        {chars.map((char, i) => {
          const charDelay = startDelay + i * 6;
          const revealProgress = lerp(
            frame,
            [charDelay, charDelay + 15],
            [0, 100],
            EASE.out
          );

          return (
            <div
              key={`mask-${i}-${char}`}
              style={{
                overflow: "hidden",
                marginRight: 4,
              }}
            >
              <div
                style={{
                  fontFamily: font,
                  fontSize: 130,
                  fontWeight: 800,
                  color: C.white,
                  clipPath: `inset(0 ${100 - revealProgress}% 0 0)`,
                }}
              >
                {char}
              </div>
            </div>
          );
        })}
      </div>

      {/* 背景のグリッド */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${C.gray[900]} 1px, transparent 1px),
            linear-gradient(90deg, ${C.gray[900]} 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: 0.3,
        }}
      />
    </AbsoluteFill>
  );
};

// ── TextNeon ──

/**
 * TextNeon - ネオンテキスト - グロウ効果
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextNeon = ({ text = "NEON", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const entryProgress = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);
  const flicker = frame > startDelay + 30
    ? 0.8 + random(`neon-${Math.floor(frame / 3)}`) * 0.2
    : entryProgress;

  const glowIntensity = flicker * 40;

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
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse, ${C.accent}30 0%, transparent 70%)`,
          opacity: flicker,
          filter: `blur(${glowIntensity}px)`,
        }}
      />

      {/* メインテキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${0.8 + entryProgress * 0.2})`,
          fontFamily: font,
          fontSize: 140,
          fontWeight: 700,
          color: C.white,
          textShadow: `
            0 0 10px ${C.accent},
            0 0 20px ${C.accent},
            0 0 ${glowIntensity}px ${C.accent},
            0 0 ${glowIntensity * 2}px ${C.accent}
          `,
          opacity: flicker,
        }}
      >
        {text}
      </div>

      {/* サブテキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "30%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 20,
          color: C.secondary,
          letterSpacing: 8,
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, flicker]),
          textShadow: `0 0 10px ${C.secondary}`,
        }}
      >
        LIGHTS ON
      </div>
    </AbsoluteFill>
  );
};

// ── TextScramble ──

/**
 * TextScramble - スクランブルテキスト - ランダム文字から確定
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const TextScramble = ({ text = "SCRAMBLE", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  const targetChars = text.split("");

  const getDisplayChar = (index: number, targetChar: string) => {
    const charStartFrame = startDelay + index * 4;
    const progress = lerp(frame, [charStartFrame, charStartFrame + 20], [0, 1]);

    if (progress >= 1) return targetChar;
    if (frame < charStartFrame) return "";

    // ランダム文字を表示
    const randomIndex = Math.floor(
      random(`scramble-${frame}-${index}`) * chars.length
    );
    return chars[randomIndex];
  };

  return (
    <AbsoluteFill style={{ background: C.black }}>
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
            fontFamily: "monospace",
            fontSize: 100,
            fontWeight: 700,
            color: C.white,
            letterSpacing: 8,
          }}
        >
          {targetChars.map((char, i) => (
            <span
              key={`scramble-${i}`}
              style={{
                display: "inline-block",
                color: getDisplayChar(i, char) === char ? C.white : C.accent,
                textShadow:
                  getDisplayChar(i, char) === char
                    ? "none"
                    : `0 0 20px ${C.accent}`,
              }}
            >
              {getDisplayChar(i, char) || "\u00A0"}
            </span>
          ))}
        </div>

        {/* サブテキスト */}
        <div
          style={{
            fontFamily: font,
            fontSize: 18,
            color: C.gray[500],
            marginTop: 30,
            letterSpacing: 4,
            opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
          }}
        >
          DECODING COMPLETE
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── TextSplit ──

/**
 * TextSplit - スプリットテキスト - 上下に分割して登場
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const TextSplit = ({ textTop = "SPLIT", textBottom = "REVEAL", startDelay = 0 }: {
  textTop?: string;
  textBottom?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const topY = lerp(frame, [startDelay, startDelay + 30], [-100, 0], EASE.out);
  const bottomY = lerp(frame, [startDelay + 5, startDelay + 35], [100, 0], EASE.out);
  const topOpacity = lerp(frame, [startDelay, startDelay + 20], [0, 1]);
  const bottomOpacity = lerp(frame, [startDelay + 5, startDelay + 25], [0, 1]);

  // 中央の線
  const lineWidth = lerp(frame, [startDelay + 20, startDelay + 50], [0, 600], EASE.out);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 上部テキスト */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "35%",
          fontFamily: font,
          fontSize: 140,
          fontWeight: 800,
          color: C.white,
          letterSpacing: -4,
          transform: `translateY(${topY}px)`,
          opacity: topOpacity,
        }}
      >
        {textTop}
      </div>

      {/* 中央線 */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "50%",
          width: lineWidth,
          height: 4,
          background: `linear-gradient(90deg, ${C.accent}, ${C.secondary})`,
        }}
      />

      {/* 下部テキスト */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "55%",
          fontFamily: font,
          fontSize: 140,
          fontWeight: 800,
          color: C.white,
          letterSpacing: -4,
          transform: `translateY(${bottomY}px)`,
          opacity: bottomOpacity,
        }}
      >
        {textBottom}
      </div>

      {/* 装飾 - 右側の縦線 */}
      <div
        style={{
          position: "absolute",
          right: 150,
          top: "30%",
          width: 3,
          height: lerp(frame, [startDelay + 30, startDelay + 60], [0, 300], EASE.out),
          background: C.gray[700],
        }}
      />
    </AbsoluteFill>
  );
};

// ── TextTypewriter ──

/**
 * TextTypewriter - タイプライターテキスト - カーソル付き
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const TextTypewriter = ({ text = "TYPING EFFECT...", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const charsToShow = Math.floor(
    lerp(frame, [startDelay, startDelay + text.length * 3], [0, text.length])
  );

  const displayText = text.slice(0, charsToShow);
  const cursorVisible = Math.floor((frame - startDelay) / 15) % 2 === 0;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* ターミナル風ウィンドウ */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 150,
          width: 1000,
          background: C.gray[900],
          borderRadius: 12,
          padding: 24,
          border: `1px solid ${C.gray[700]}`,
        }}
      >
        {/* ウィンドウヘッダー */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27ca40" }} />
        </div>

        {/* テキスト */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 36,
            color: C.white,
          }}
        >
          <span style={{ color: C.accent }}>$ </span>
          {displayText}
          <span
            style={{
              display: "inline-block",
              width: 20,
              height: 36,
              background: C.accent,
              marginLeft: 4,
              opacity: cursorVisible ? 1 : 0,
            }}
          />
        </div>
      </div>

      {/* 装飾テキスト */}
      <div
        style={{
          position: "absolute",
          right: 100,
          bottom: 100,
          fontFamily: font,
          fontSize: 14,
          color: C.gray[600],
          textAlign: "right",
          opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
        }}
      >
        <div>TERMINAL</div>
        <div>v2.0.1</div>
      </div>
    </AbsoluteFill>
  );
};

// ── TextWave ──

/**
 * TextWave - 波形テキスト - 文字が波のように動く
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C, lerp, font } from "../../common";

export const TextWave = ({ text = "WAVE MOTION", startDelay = 0 }: {
  text?: string;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = text.split("");

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
        }}
      >
        {chars.map((char, i) => {
          const delay = startDelay + i * 2;
          const entryProgress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 180 },
          });

          // 波動
          const waveY = Math.sin((frame - startDelay) * 0.1 + i * 0.5) * 15;
          const waveRotate = Math.sin((frame - startDelay) * 0.08 + i * 0.3) * 5;

          return (
            <span
              key={`wave-${i}-${char}`}
              style={{
                fontFamily: font,
                fontSize: 100,
                fontWeight: 700,
                color: C.white,
                display: "inline-block",
                transform: `
                  translateY(${interpolate(entryProgress, [0, 1], [60, 0]) + waveY * entryProgress}px)
                  rotate(${waveRotate * entryProgress}deg)
                `,
                opacity: entryProgress,
                marginRight: char === " " ? 30 : 2,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })}
      </div>

      {/* 下部の波線 */}
      <svg
        style={{
          position: "absolute",
          bottom: 150,
          left: 0,
          width: "100%",
          height: 60,
        }}
        aria-hidden="true"
      >
        <path
          d={`M 0 30 ${Array.from({ length: 20 })
            .map((_, i) => {
              const x = i * 70;
              const y = 30 + Math.sin((frame * 0.1 + i) * 0.5) * 15;
              return `Q ${x + 35} ${y + (i % 2 === 0 ? 20 : -20)} ${x + 70} ${y}`;
            })
            .join(" ")}`}
          stroke={C.accent}
          strokeWidth="3"
          fill="none"
          opacity={lerp(frame, [startDelay + 20, startDelay + 40], [0, 0.6])}
        />
      </svg>
    </AbsoluteFill>
  );
};
