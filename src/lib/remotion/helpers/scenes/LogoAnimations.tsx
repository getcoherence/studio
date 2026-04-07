// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── Logo3DRotate ──

/**
 * Logo3DRotate - ロゴ3D回転
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, font } from "../../common";

export const Logo3DRotate = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotateProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const rotateY = interpolate(rotateProgress, [0, 1], [90, 0]);
  const scale = interpolate(rotateProgress, [0, 0.5, 1], [0.5, 1.1, 1]);

  return (
    <AbsoluteFill style={{ background: C.gray[950], perspective: 1000 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotateY(${rotateY}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 100,
            fontWeight: 900,
            color: C.white,
            textShadow: `0 0 60px ${C.accent}`,
          }}
        >
          BRAND
        </div>
      </div>

      {/* 反射 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "60%",
          transform: `translate(-50%, 0) rotateX(180deg) rotateY(${rotateY}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
          opacity: 0.2,
          filter: "blur(4px)",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 100,
            fontWeight: 900,
            color: C.white,
          }}
        >
          BRAND
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── LogoGlitch ──

/**
 * LogoGlitch - ロゴグリッチ
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, random } from "remotion";
import { C, font } from "../../common";

export const LogoGlitch = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const glitchActive = frame > startDelay + 30 && random(`glitch-${frame}`) < 0.2;
  const offsetX = glitchActive ? (random(`gx-${frame}`) - 0.5) * 20 : 0;
  const offsetY = glitchActive ? (random(`gy-${frame}`) - 0.5) * 10 : 0;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 赤チャンネル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${offsetX + 3}px), calc(-50% + ${offsetY}px))`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: "rgba(255, 0, 0, 0.7)",
          mixBlendMode: "screen",
          opacity: glitchActive ? 1 : 0,
        }}
      >
        GLITCH
      </div>

      {/* シアンチャンネル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${-offsetX - 3}px), calc(-50% + ${-offsetY}px))`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: "rgba(0, 255, 255, 0.7)",
          mixBlendMode: "screen",
          opacity: glitchActive ? 1 : 0,
        }}
      >
        GLITCH
      </div>

      {/* メインロゴ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${entryProgress})`,
          fontFamily: font,
          fontSize: 100,
          fontWeight: 900,
          color: C.white,
        }}
      >
        GLITCH
      </div>

      {/* スキャンライン */}
      {glitchActive && (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.2) 2px,
              rgba(0, 0, 0, 0.2) 4px
            )`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ── LogoLightTrail ──

/**
 * LogoLightTrail - ロゴライトトレイル
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const LogoLightTrail = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const logoOpacity = lerp(frame, [startDelay + 35, startDelay + 50], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* ライトトレイル */}
      {[0, 1, 2, 3, 4].map((i) => {
        const trailDelay = i * 5;
        const x = lerp(frame, [startDelay + trailDelay, startDelay + 40 + trailDelay], [-100, 50], EASE.out);
        const opacity = lerp(frame, [startDelay + 30 + trailDelay, startDelay + 50 + trailDelay], [0.8, 0]);

        return (
          <div
            key={`trail-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: "50%",
              width: 200 - i * 30,
              height: 4,
              background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? C.accent : C.secondary})`,
              transform: "translateY(-50%)",
              opacity: opacity,
              filter: "blur(2px)",
            }}
          />
        );
      })}

      {/* ロゴ */}
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
          opacity: logoOpacity,
          textShadow: `0 0 30px ${C.accent}`,
        }}
      >
        SPEED
      </div>

      {/* グロー */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 400,
          height: 150,
          background: C.accent,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          filter: "blur(60px)",
          opacity: logoOpacity * 0.3,
        }}
      />
    </AbsoluteFill>
  );
};

// ── LogoMaskReveal ──

/**
 * LogoMaskReveal - ロゴマスクリビール
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const LogoMaskReveal = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const maskProgress = lerp(frame, [startDelay, startDelay + 40], [0, 100], EASE.out);

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 背景パターン */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${C.gray[900]} 1px, transparent 1px),
            linear-gradient(90deg, ${C.gray[900]} 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          opacity: 0.5,
        }}
      />

      {/* マスクされたロゴ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          clipPath: `inset(0 ${100 - maskProgress}% 0 0)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            background: `linear-gradient(135deg, ${C.accent}, ${C.secondary})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          BRAND
        </div>
      </div>

      {/* リビールライン */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% - 200px + ${maskProgress * 4}px)`,
          top: "50%",
          width: 4,
          height: 150,
          background: C.white,
          transform: "translateY(-50%)",
          opacity: maskProgress < 100 ? 1 : 0,
          boxShadow: `0 0 20px ${C.white}`,
        }}
      />
    </AbsoluteFill>
  );
};

// ── LogoMorph ──

/**
 * LogoMorph - ロゴモーフィング
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const LogoMorph = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  // 文字変形
  const letters = ["L", "O", "G", "O"];
  const targetLetters = ["B", "R", "N", "D"];

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 10,
        }}
      >
        {letters.map((letter, i) => {
          const letterProgress = lerp(
            frame,
            [startDelay + i * 10, startDelay + i * 10 + 30],
            [0, 1],
            EASE.out
          );

          const displayLetter = letterProgress < 0.5 ? letter : targetLetters[i];
          const scale = letterProgress < 0.5
            ? 1 - letterProgress
            : letterProgress;
          const rotation = letterProgress * 360;

          return (
            <div
              key={`morph-letter-${i}-${letter}`}
              style={{
                fontFamily: font,
                fontSize: 100,
                fontWeight: 900,
                color: C.white,
                transform: `scale(${0.5 + scale * 0.5}) rotate(${rotation}deg)`,
                opacity: 0.5 + scale * 0.5,
              }}
            >
              {displayLetter}
            </div>
          );
        })}
      </div>

      {/* アンダーライン */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "65%",
          transform: "translateX(-50%)",
          width: lerp(frame, [startDelay + 50, startDelay + 70], [0, 350], EASE.out),
          height: 4,
          background: `linear-gradient(90deg, ${C.accent}, ${C.secondary})`,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};

// ── LogoNeonSign ──

/**
 * LogoNeonSign - ロゴネオンサイン
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const LogoNeonSign = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const flickerSeed = Math.floor(frame / 4);
  const flicker = random(`neon-${flickerSeed}`) > 0.1 ? 1 : 0.3;

  const letters = "NEON".split("");

  return (
    <AbsoluteFill style={{ background: "#0a0a15" }}>
      {/* 壁のテクスチャ */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse at center, #1a1a25 0%, #0a0a15 100%)
          `,
        }}
      />

      {/* ネオンサイン */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 20,
        }}
      >
        {letters.map((letter, i) => {
          const letterDelay = startDelay + i * 15;
          const isOn = frame >= letterDelay;
          const letterFlicker = isOn ? (random(`neon-letter-${flickerSeed}-${i}`) > 0.05 ? 1 : 0.2) : 0;

          return (
            <div
              key={`neon-${i}-${letter}`}
              style={{
                fontFamily: font,
                fontSize: 100,
                fontWeight: 700,
                color: isOn ? C.secondary : C.gray[800],
                textShadow: isOn
                  ? `
                    0 0 10px ${C.secondary},
                    0 0 20px ${C.secondary},
                    0 0 40px ${C.secondary},
                    0 0 80px ${C.secondary}
                  `
                  : "none",
                opacity: letterFlicker * flicker,
                transition: "color 0.1s",
              }}
            >
              {letter}
            </div>
          );
        })}
      </div>

      {/* 反射光 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "70%",
          width: 400,
          height: 100,
          background: C.secondary,
          borderRadius: "50%",
          transform: "translate(-50%, 0)",
          filter: "blur(60px)",
          opacity: 0.2 * flicker,
        }}
      />

      {/* "OPEN"サイン */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: 100,
          fontFamily: font,
          fontSize: 24,
          fontWeight: 600,
          color: C.tertiary,
          textShadow: `0 0 20px ${C.tertiary}`,
          opacity: lerp(frame, [startDelay + 60, startDelay + 80], [0, flicker]),
        }}
      >
        OPEN
      </div>
    </AbsoluteFill>
  );
};

// ── LogoParticles ──

/**
 * LogoParticles - ロゴパーティクル集合
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, random } from "remotion";
import { C, lerp, font } from "../../common";

export const LogoParticles = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const particleCount = 50;
  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      id: `logo-particle-${i}`,
      startX: (random(`px-${i}`) - 0.5) * 800,
      startY: (random(`py-${i}`) - 0.5) * 600,
      endX: (random(`ex-${i}`) - 0.5) * 100,
      endY: (random(`ey-${i}`) - 0.5) * 50,
      size: random(`ps-${i}`) * 8 + 4,
      delay: random(`pd-${i}`) * 20,
    }));
  }, []);

  const logoProgress = spring({
    frame: frame - startDelay - 40,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* パーティクル */}
      {particles.map((p) => {
        const progress = spring({
          frame: frame - startDelay - p.delay,
          fps,
          config: { damping: 20, stiffness: 80 },
        });

        const x = interpolate(progress, [0, 1], [p.startX, p.endX]);
        const y = interpolate(progress, [0, 1], [p.startY, p.endY]);
        const opacity = progress < 0.8 ? progress : lerp(progress, [0.8, 1], [1, 0]);

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: p.size,
              height: p.size,
              background: C.accent,
              borderRadius: "50%",
              transform: `translate(${x}px, ${y}px)`,
              opacity: opacity,
              boxShadow: `0 0 10px ${C.accent}`,
            }}
          />
        );
      })}

      {/* ロゴ */}
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
          opacity: logoProgress,
        }}
      >
        LOGO
      </div>
    </AbsoluteFill>
  );
};

// ── LogoSplitScreen ──

/**
 * LogoSplitScreen - ロゴスプリットスクリーン
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const LogoSplitScreen = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const splitProgress = lerp(frame, [startDelay, startDelay + 30], [50, 0], EASE.out);
  const logoOpacity = lerp(frame, [startDelay + 25, startDelay + 45], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      {/* 上半分 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          height: "50%",
          background: C.accent,
          transform: `translateY(-${splitProgress}%)`,
        }}
      />

      {/* 下半分 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          right: 0,
          height: "50%",
          background: C.secondary,
          transform: `translateY(${splitProgress}%)`,
        }}
      />

      {/* ロゴ */}
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
          opacity: logoOpacity,
          textShadow: "0 0 40px rgba(0,0,0,0.5)",
        }}
      >
        BRAND
      </div>

      {/* 境界線 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          right: 0,
          height: 2,
          background: C.white,
          transform: "translateY(-50%)",
          opacity: 1 - splitProgress / 50,
        }}
      />
    </AbsoluteFill>
  );
};

// ── LogoStamp ──

/**
 * LogoStamp - ロゴスタンプ
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, random } from "remotion";
import { C, font } from "../../common";

export const LogoStamp = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stampProgress = spring({
    frame: frame - startDelay - 10,
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.5 },
  });

  const scale = interpolate(stampProgress, [0, 0.5, 1], [3, 0.9, 1]);
  const rotation = interpolate(stampProgress, [0, 1], [-15, 0]);

  // インクスプラッシュ
  const showSplash = frame >= startDelay + 15 && frame < startDelay + 25;

  return (
    <AbsoluteFill style={{ background: C.gray[100] }}>
      {/* 紙のテクスチャ */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.05,
        }}
      />

      {/* スタンプ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
          opacity: stampProgress,
        }}
      >
        <div
          style={{
            border: `6px solid ${C.danger}`,
            borderRadius: 8,
            padding: "20px 40px",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 48,
              fontWeight: 900,
              color: C.danger,
              letterSpacing: 8,
            }}
          >
            APPROVED
          </div>
        </div>
      </div>

      {/* インクスプラッシュ */}
      {showSplash && (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 100 + random(`splash-${i}`) * 50;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            return (
              <div
                key={`splash-${i}`}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 10 + random(`splash-s-${i}`) * 15,
                  height: 10 + random(`splash-s-${i}`) * 15,
                  background: C.danger,
                  borderRadius: "50%",
                  transform: `translate(${x}px, ${y}px)`,
                  opacity: 0.3,
                }}
              />
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
};

// ── LogoStroke ──

/**
 * LogoStroke - ロゴストロークアニメーション
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, EASE, lerp, font } from "../../common";

export const LogoStroke = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const strokeProgress = lerp(frame, [startDelay, startDelay + 50], [0, 1], EASE.out);
  const fillProgress = lerp(frame, [startDelay + 40, startDelay + 60], [0, 1], EASE.out);

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
        <svg width="300" height="100" viewBox="0 0 300 100" aria-hidden="true">
          {/* ロゴパス */}
          <text
            x="150"
            y="70"
            textAnchor="middle"
            fontFamily={font}
            fontSize="72"
            fontWeight="800"
            fill="none"
            stroke={C.accent}
            strokeWidth="2"
            strokeDasharray="500"
            strokeDashoffset={500 - strokeProgress * 500}
          >
            LOGO
          </text>
          <text
            x="150"
            y="70"
            textAnchor="middle"
            fontFamily={font}
            fontSize="72"
            fontWeight="800"
            fill={C.white}
            opacity={fillProgress}
          >
            LOGO
          </text>
        </svg>

        {/* タグライン */}
        <div
          style={{
            textAlign: "center",
            fontFamily: font,
            fontSize: 16,
            color: C.gray[500],
            letterSpacing: 6,
            marginTop: 20,
            opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
          }}
        >
          BRAND TAGLINE
        </div>
      </div>
    </AbsoluteFill>
  );
};
