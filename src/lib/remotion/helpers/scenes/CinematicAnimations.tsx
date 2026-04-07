// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── CinematicAction ──

/**
 * CinematicAction - アクションタイトル
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, random } from "remotion";
import { C, lerp, font } from "../../common";

export const CinematicAction = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const impactFrame = startDelay + 25;
  const hasImpact = frame >= impactFrame;

  const titleProgress = spring({
    frame: hasImpact ? frame - impactFrame : 0,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  const shake = hasImpact && frame < impactFrame + 10
    ? (random(`action-shake-${frame}`) - 0.5) * 20
    : 0;

  return (
    <AbsoluteFill
      style={{
        background: C.black,
        transform: `translateX(${shake}px)`,
      }}
    >
      {/* 衝撃波 */}
      {hasImpact && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: titleProgress * 1500,
            height: titleProgress * 1500,
            border: `4px solid ${C.accent}`,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 1 - titleProgress,
          }}
        />
      )}

      {/* フラッシュ */}
      {hasImpact && frame < impactFrame + 5 && (
        <AbsoluteFill
          style={{
            background: C.white,
            opacity: lerp(frame, [impactFrame, impactFrame + 5], [0.8, 0]),
          }}
        />
      )}

      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${hasImpact ? titleProgress : 0})`,
          fontFamily: font,
          fontSize: 140,
          fontWeight: 900,
          color: C.white,
          letterSpacing: 15,
          textShadow: `0 0 40px ${C.accent}`,
        }}
      >
        IMPACT
      </div>

      {/* 飛び散るデブリ */}
      {hasImpact &&
        Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          const distance = titleProgress * 400;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          const size = random(`debris-s-${i}`) * 10 + 5;

          return (
            <div
              key={`debris-${i}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size,
                height: size,
                background: C.accent,
                transform: `translate(${x}px, ${y}px)`,
                opacity: 1 - titleProgress,
              }}
            />
          );
        })}

      {/* レターボックス */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: C.black }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: C.black }} />
    </AbsoluteFill>
  );
};

// ── CinematicAnime ──

/**
 * CinematicAnime - アニメ風タイトル
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const CinematicAnime = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame: frame - startDelay - 10,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  const speedLines = Array.from({ length: 30 }).map((_, i) => ({
    y: random(`speed-y-${i}`) * 100,
    delay: random(`speed-d-${i}`) * 20,
    length: random(`speed-l-${i}`) * 200 + 100,
  }));

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%)",
      }}
    >
      {/* スピードライン */}
      {speedLines.map((line, i) => {
        const x = lerp(frame, [startDelay + line.delay, startDelay + line.delay + 15], [120, -20], EASE.out);

        return (
          <div
            key={`speed-line-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${line.y}%`,
              width: line.length,
              height: 2,
              background: `linear-gradient(90deg, ${C.white}, transparent)`,
              opacity: 0.3,
            }}
          />
        );
      })}

      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${titleProgress})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: C.white,
            letterSpacing: -4,
            textShadow: `4px 4px 0 ${C.secondary}, 8px 8px 0 ${C.accent}`,
          }}
        >
          HERO
        </div>
      </div>

      {/* サブタイトル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "25%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 20,
          color: C.secondary,
          letterSpacing: 8,
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
        }}
      >
        THE BEGINNING
      </div>

      {/* 装飾ライン */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "65%",
          transform: "translateX(-50%)",
          width: lerp(frame, [startDelay + 30, startDelay + 50], [0, 300], EASE.out),
          height: 4,
          background: `linear-gradient(90deg, transparent, ${C.secondary}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ── CinematicDocumentary ──

/**
 * CinematicDocumentary - ドキュメンタリー風
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const CinematicDocumentary = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const lineProgress = lerp(frame, [startDelay, startDelay + 30], [0, 100], EASE.out);
  const titleOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.white }}>
      {/* グリッドライン */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${C.gray[200]} 1px, transparent 1px),
            linear-gradient(90deg, ${C.gray[200]} 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
          opacity: 0.5,
        }}
      />

      {/* 横線 */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "50%",
          width: `${lineProgress * 0.8}%`,
          height: 2,
          background: C.black,
        }}
      />

      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "52%",
          fontFamily: font,
          fontSize: 60,
          fontWeight: 300,
          color: C.black,
          letterSpacing: 4,
          opacity: titleOpacity,
        }}
      >
        The Story
      </div>

      {/* サブタイトル */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "42%",
          fontFamily: font,
          fontSize: 14,
          fontWeight: 500,
          color: C.gray[500],
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]),
        }}
      >
        A Documentary Film
      </div>

      {/* 年号 */}
      <div
        style={{
          position: "absolute",
          right: "10%",
          bottom: "15%",
          fontFamily: font,
          fontSize: 100,
          fontWeight: 100,
          color: C.gray[300],
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
        }}
      >
        2024
      </div>
    </AbsoluteFill>
  );
};

// ── CinematicEpic ──

/**
 * CinematicEpic - エピックタイトル - 大作映画風
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const CinematicEpic = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const titleScale = lerp(frame, [startDelay, startDelay + 40], [0.5, 1], EASE.out);
  const titleOpacity = lerp(frame, [startDelay, startDelay + 30], [0, 1]);
  const subtitleOpacity = lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* パーティクル背景 */}
      {Array.from({ length: 50 }).map((_, i) => {
        const x = random(`epic-x-${i}`) * 100;
        const y = random(`epic-y-${i}`) * 100;
        const size = random(`epic-s-${i}`) * 3 + 1;
        const twinkle = Math.sin((frame - startDelay) * 0.1 + i) * 0.5 + 0.5;

        return (
          <div
            key={`epic-star-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: C.gold,
              borderRadius: "50%",
              opacity: twinkle * 0.5,
            }}
          />
        );
      })}

      {/* グラデーションオーバーレイ */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, ${C.black} 100%)`,
        }}
      />

      {/* メインタイトル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${titleScale})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: C.white,
            letterSpacing: 20,
            textShadow: `0 0 60px ${C.gold}60`,
            opacity: titleOpacity,
          }}
        >
          EPIC
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 300,
            color: C.gold,
            letterSpacing: 15,
            marginTop: 30,
            opacity: subtitleOpacity,
          }}
        >
          A CINEMATIC EXPERIENCE
        </div>
      </div>

      {/* レターボックス */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: C.black,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: C.black,
        }}
      />
    </AbsoluteFill>
  );
};

// ── CinematicHorror ──

/**
 * CinematicHorror - ホラータイトル
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const CinematicHorror = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const flickerSeed = Math.floor(frame / 3);
  const flicker = random(`horror-${flickerSeed}`) > 0.15 ? 1 : 0.2;

  const titleOpacity = lerp(frame, [startDelay, startDelay + 10], [0, 1]);
  const glitchOffset = random(`horror-g-${frame}`) > 0.9 ? random(`horror-go-${frame}`) * 10 - 5 : 0;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 血のようなドリップ */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = 10 + i * 12;
        const drip = lerp(frame, [startDelay + i * 5, startDelay + 60 + i * 5], [0, 200], EASE.out);

        return (
          <div
            key={`drip-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: 0,
              width: 8,
              height: drip,
              background: `linear-gradient(to bottom, ${C.danger}, ${C.danger}80)`,
              borderRadius: "0 0 4px 4px",
            }}
          />
        );
      })}

      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${glitchOffset}px), -50%)`,
          fontFamily: font,
          fontSize: 140,
          fontWeight: 900,
          color: C.danger,
          letterSpacing: 10,
          textShadow: `0 0 30px ${C.danger}, 0 0 60px ${C.danger}60`,
          opacity: titleOpacity * flicker,
        }}
      >
        FEAR
      </div>

      {/* サブテキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "25%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 16,
          color: C.gray[500],
          letterSpacing: 8,
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, flicker]),
        }}
      >
        COMING SOON
      </div>

      {/* ノイズオーバーレイ */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 255, 255, 0.02) 2px,
            rgba(255, 255, 255, 0.02) 4px
          )`,
        }}
      />
    </AbsoluteFill>
  );
};

// ── CinematicMinimalEnd ──

/**
 * CinematicMinimalEnd - ミニマリストエンディング
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const CinematicMinimalEnd = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const fadeInOut = (start: number, duration: number) => {
    const progress = frame - startDelay - start;
    if (progress < 0) return 0;
    if (progress < duration / 2) return progress / (duration / 2);
    if (progress < duration) return 1 - (progress - duration / 2) / (duration / 2);
    return 0;
  };

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* "Directed by" */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "35%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: fadeInOut(0, 50),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 14,
            color: C.gray[500],
            letterSpacing: 4,
            marginBottom: 15,
          }}
        >
          Directed by
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 300,
            color: C.white,
          }}
        >
          John Smith
        </div>
      </div>

      {/* "Written by" */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: fadeInOut(30, 50),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 14,
            color: C.gray[500],
            letterSpacing: 4,
            marginBottom: 15,
          }}
        >
          Written by
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 300,
            color: C.white,
          }}
        >
          Jane Doe
        </div>
      </div>

      {/* "The End" */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          opacity: lerp(frame, [startDelay + 70, startDelay + 90], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 48,
            fontWeight: 300,
            fontStyle: "italic",
            color: C.white,
          }}
        >
          The End
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── CinematicNoir ──

/**
 * CinematicNoir - ノワール風
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const CinematicNoir = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const blindsProgress = lerp(frame, [startDelay, startDelay + 40], [0, 1], EASE.out);
  const titleOpacity = lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* ブラインドの光 */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`blind-${i}`}
          style={{
            position: "absolute",
            left: 0,
            top: i * 90 + 40,
            width: "100%",
            height: 30,
            background: `linear-gradient(90deg, transparent, ${C.white}10, ${C.white}20, ${C.white}10, transparent)`,
            transform: `scaleX(${blindsProgress}) skewY(-5deg)`,
            transformOrigin: "left",
          }}
        />
      ))}

      {/* シルエット */}
      <div
        style={{
          position: "absolute",
          right: 100,
          bottom: 0,
          width: 200,
          height: 400,
          background: C.black,
          clipPath: "polygon(30% 100%, 70% 100%, 60% 0%, 40% 0%)",
          opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
        }}
      />

      {/* タイトル */}
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
            fontSize: 80,
            fontWeight: 300,
            fontStyle: "italic",
            color: C.white,
            opacity: titleOpacity,
          }}
        >
          Shadows
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            color: C.gray[500],
            letterSpacing: 6,
            marginTop: 20,
            opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
          }}
        >
          A NOIR THRILLER
        </div>
      </div>

      {/* フィルムグレイン */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.08,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};

// ── CinematicRomance ──

/**
 * CinematicRomance - ロマンスタイトル
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const CinematicRomance = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = lerp(frame, [startDelay + 20, startDelay + 50], [0, 1]);
  const heartScale = lerp(frame, [startDelay, startDelay + 30], [0, 1], EASE.out);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      {/* ボケ効果 */}
      {Array.from({ length: 20 }).map((_, i) => {
        const x = random(`romance-x-${i}`) * 100;
        const y = random(`romance-y-${i}`) * 100;
        const size = random(`romance-s-${i}`) * 100 + 50;
        const pulse = 0.5 + Math.sin((frame - startDelay) * 0.05 + i) * 0.3;

        return (
          <div
            key={`romance-bokeh-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: `radial-gradient(circle, ${C.secondary}40 0%, transparent 70%)`,
              borderRadius: "50%",
              opacity: pulse * lerp(frame, [startDelay, startDelay + 30], [0, 1]),
            }}
          />
        );
      })}

      {/* ハートアイコン */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "35%",
          transform: `translate(-50%, -50%) scale(${heartScale})`,
          fontSize: 80,
          opacity: heartScale,
        }}
      >
        ❤️
      </div>

      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "55%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 300,
            fontStyle: "italic",
            color: C.white,
            letterSpacing: 8,
            opacity: titleOpacity,
          }}
        >
          Forever
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            color: C.secondary,
            letterSpacing: 6,
            marginTop: 20,
            opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
          }}
        >
          A LOVE STORY
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── CinematicSciFi ──

/**
 * CinematicSciFi - SF/テック風
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const CinematicSciFi = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const scanlineY = ((frame - startDelay) * 5) % 720;
  const titleOpacity = lerp(frame, [startDelay + 30, startDelay + 50], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "#000510" }}>
      {/* グリッド */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${C.accent}20 1px, transparent 1px),
            linear-gradient(90deg, ${C.accent}20 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          perspective: 500,
          transform: "rotateX(60deg) translateY(-200px)",
          transformOrigin: "center center",
        }}
      />

      {/* スキャンライン */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: scanlineY,
          width: "100%",
          height: 4,
          background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          boxShadow: `0 0 20px ${C.accent}`,
        }}
      />

      {/* HUDフレーム */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 60,
          width: 100,
          height: 100,
          borderLeft: `2px solid ${C.accent}`,
          borderTop: `2px solid ${C.accent}`,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 0.6]),
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 60,
          bottom: 60,
          width: 100,
          height: 100,
          borderRight: `2px solid ${C.accent}`,
          borderBottom: `2px solid ${C.accent}`,
          opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 0.6]),
        }}
      />

      {/* タイトル */}
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
            fontFamily: "monospace",
            fontSize: 14,
            color: C.accent,
            letterSpacing: 8,
            marginBottom: 20,
            opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
          }}
        >
          INITIALIZING SYSTEM
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 100,
            fontWeight: 700,
            color: C.white,
            letterSpacing: 20,
            textShadow: `0 0 30px ${C.accent}`,
            opacity: titleOpacity,
          }}
        >
          NEXUS
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: C.accent,
            marginTop: 20,
            opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
          }}
        >
          [ SYSTEM ONLINE ]
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── CinematicVintage ──

/**
 * CinematicVintage - ヴィンテージ風
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { lerp, font } from "../../common";

export const CinematicVintage = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const flickerSeed = Math.floor(frame / 2);
  const flicker = 0.9 + random(`vintage-${flickerSeed}`) * 0.1;

  const titleOpacity = lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: "#1a1410",
      }}
    >
      {/* セピアオーバーレイ */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, #2a2015 0%, #0a0805 100%)`,
          opacity: flicker,
        }}
      />

      {/* フィルム傷 */}
      {Array.from({ length: 5 }).map((_, i) => {
        const x = random(`scratch-x-${flickerSeed}-${i}`) * 100;
        const show = random(`scratch-show-${flickerSeed}-${i}`) > 0.7;

        return show ? (
          <div
            key={`scratch-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: 0,
              width: 2,
              height: "100%",
              background: "rgba(255, 255, 255, 0.1)",
            }}
          />
        ) : null;
      })}

      {/* タイトル */}
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
            color: "#d4a574",
            letterSpacing: 10,
            marginBottom: 20,
            opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
          }}
        >
          PRESENTS
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 300,
            color: "#f5e6d3",
            letterSpacing: 8,
            opacity: titleOpacity * flicker,
          }}
        >
          Memories
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            color: "#8b7355",
            letterSpacing: 4,
            marginTop: 30,
            opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
          }}
        >
          — 1952 —
        </div>
      </div>

      {/* ビネット */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)`,
        }}
      />

      {/* フィルムグレイン */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${flickerSeed}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.15,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
