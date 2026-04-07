// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── ParticleBubbles ──

/**
 * ParticleBubbles - 泡エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, font } from "../../common";

export const ParticleBubbles = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const bubbleCount = 40;
  const bubbles = React.useMemo(() => {
    return Array.from({ length: bubbleCount }).map((_, i) => ({
      id: `bubble-${i}`,
      x: random(`b-x-${i}`) * 100,
      delay: random(`b-d-${i}`) * 60,
      speed: random(`b-sp-${i}`) * 1.5 + 0.5,
      size: random(`b-s-${i}`) * 40 + 20,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(to top, #0077b6 0%, #00b4d8 50%, #90e0ef 100%)",
        overflow: "hidden",
      }}
    >
      {bubbles.map((b) => {
        const startFrame = startDelay + b.delay;
        const riseProgress = (frame - startFrame) * b.speed;
        const y = 750 - riseProgress;
        const wobbleX = Math.sin(riseProgress * 0.05 + b.x) * 15;

        if (y < -b.size || frame < startFrame) return null;

        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: `${b.x}%`,
              top: y,
              width: b.size,
              height: b.size,
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.2))`,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.4)",
              transform: `translateX(${wobbleX}px)`,
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
          textShadow: "0 0 20px rgba(0,0,0,0.3)",
        }}
      >
        BUBBLES
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleConfetti ──

/**
 * ParticleConfetti - 紙吹雪エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";
import { C, font } from "../../common";

export const ParticleConfetti = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const confettiCount = 100;
  const confetti = React.useMemo(() => {
    return Array.from({ length: confettiCount }).map((_, i) => ({
      id: `confetti-${i}`,
      x: random(`c-x-${i}`) * 100,
      delay: random(`c-d-${i}`) * 30,
      speed: random(`c-sp-${i}`) * 3 + 2,
      rotation: random(`c-r-${i}`) * 360,
      rotationSpeed: (random(`c-rs-${i}`) - 0.5) * 20,
      size: random(`c-s-${i}`) * 15 + 8,
      color: [C.accent, C.secondary, C.tertiary, C.orange, C.yellow][i % 5],
      type: Math.floor(random(`c-t-${i}`) * 3),
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.gray[950], overflow: "hidden" }}>
      {confetti.map((c) => {
        const startFrame = startDelay + c.delay;
        const fallProgress = (frame - startFrame) * c.speed;
        const y = -50 + fallProgress;
        const wobbleX = Math.sin(fallProgress * 0.1 + c.x) * 30;
        const rotation = c.rotation + (frame - startFrame) * c.rotationSpeed;

        if (y > height + 50 || frame < startFrame) return null;

        return (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: y,
              width: c.type === 0 ? c.size : c.size * 0.5,
              height: c.type === 0 ? c.size * 0.5 : c.size,
              background: c.color,
              borderRadius: c.type === 2 ? "50%" : 2,
              transform: `translateX(${wobbleX}px) rotate(${rotation}deg)`,
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
          fontWeight: 800,
          color: C.white,
          textShadow: "0 0 40px rgba(0,0,0,0.5)",
        }}
      >
        CELEBRATE!
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleFireworks ──

/**
 * ParticleFireworks - ファイヤーワークス
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const ParticleFireworks = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const fireworks = [
    { x: 30, y: 40, delay: 0, color: C.danger },
    { x: 70, y: 35, delay: 15, color: C.yellow },
    { x: 50, y: 30, delay: 30, color: C.accent },
    { x: 20, y: 45, delay: 45, color: C.secondary },
    { x: 80, y: 40, delay: 55, color: C.tertiary },
  ];

  const particlesPerFirework = 30;

  return (
    <AbsoluteFill style={{ background: "#0a0a15" }}>
      {fireworks.map((fw, fwIndex) => {
        const explosionFrame = startDelay + fw.delay + 20;
        const isExploding = frame >= explosionFrame;

        // 打ち上げ
        if (!isExploding && frame >= startDelay + fw.delay) {
          const riseProgress = (frame - startDelay - fw.delay) / 20;
          const riseY = 100 - riseProgress * (100 - fw.y);

          return (
            <div
              key={`fw-rise-${fwIndex}`}
              style={{
                position: "absolute",
                left: `${fw.x}%`,
                top: `${riseY}%`,
                width: 4,
                height: 20,
                background: `linear-gradient(to top, ${fw.color}, transparent)`,
                transform: "translateX(-50%)",
              }}
            />
          );
        }

        // 爆発
        if (isExploding) {
          const explosionProgress = (frame - explosionFrame) / 40;
          if (explosionProgress > 1) return null;

          return (
            <React.Fragment key={`fw-explosion-${fwIndex}`}>
              {Array.from({ length: particlesPerFirework }).map((_, i) => {
                const angle = (i / particlesPerFirework) * Math.PI * 2;
                const distance = 150 * explosionProgress * (1 - explosionProgress * 0.3);
                const x = fw.x + (Math.cos(angle) * distance) / 10;
                const y = fw.y + (Math.sin(angle) * distance) / 10 + explosionProgress * 5;
                const opacity = 1 - explosionProgress;
                const size = 6 * (1 - explosionProgress * 0.5);

                return (
                  <div
                    key={`fw-p-${fwIndex}-${i}`}
                    style={{
                      position: "absolute",
                      left: `${x}%`,
                      top: `${y}%`,
                      width: size,
                      height: size,
                      background: fw.color,
                      borderRadius: "50%",
                      opacity: opacity,
                      boxShadow: `0 0 ${size * 2}px ${fw.color}`,
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        }

        return null;
      })}

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
          opacity: lerp(frame, [startDelay + 60, startDelay + 80], [0, 1]),
        }}
      >
        FIREWORKS
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleLightning ──

/**
 * ParticleLightning - 電気/雷エフェクト
 */

import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, font } from "../../common";

export const ParticleLightning = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const lightningActive = (frame - startDelay) % 40 < 5;
  const flashIntensity = lightningActive ? random(`lightning-${Math.floor(frame / 5)}`) : 0;

  // 雷の生成
  const generateLightningPath = () => {
    let path = "M 640 0";
    let x = 640;
    let y = 0;

    while (y < 720) {
      const newX = x + (random(`lx-${y}-${frame}`) - 0.5) * 100;
      const newY = y + random(`ly-${y}-${frame}`) * 50 + 30;
      path += ` L ${newX} ${newY}`;
      x = newX;
      y = newY;
    }

    return path;
  };

  return (
    <AbsoluteFill style={{ background: "#0a0a15" }}>
      {/* 雲 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(to bottom, ${C.gray[800]}, transparent)`,
        }}
      />

      {/* 雷 */}
      {lightningActive && (
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute" }}
          aria-hidden="true"
        >
          <path
            d={generateLightningPath()}
            stroke={C.white}
            strokeWidth={4}
            fill="none"
            opacity={flashIntensity}
            filter="url(#glow)"
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      )}

      {/* フラッシュ */}
      {lightningActive && (
        <AbsoluteFill
          style={{
            background: C.white,
            opacity: flashIntensity * 0.3,
          }}
        />
      )}

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "20%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          color: C.white,
          textShadow: lightningActive ? `0 0 30px ${C.white}` : "none",
        }}
      >
        THUNDER
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleMagneticField ──

/**
 * ParticleMagneticField - 磁気フィールド
 */

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, lerp, font } from "../../common";

export const ParticleMagneticField = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const lineCount = 15;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute" }}
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }).map((_, i) => {
          const yOffset = (i - lineCount / 2) * 40;
          const animOffset = (frame - startDelay) * 0.02;

          // 磁力線のパス生成
          let path = `M 0 ${360 + yOffset}`;
          for (let x = 0; x <= 1280; x += 20) {
            const distFromCenter = Math.abs(x - 640) / 640;
            const curve = Math.sin((x * 0.01 + animOffset + i * 0.3)) * 50 * (1 - distFromCenter);
            const y = 360 + yOffset + curve;
            path += ` L ${x} ${y}`;
          }

          const opacity = lerp(frame, [startDelay, startDelay + 30], [0, 0.6]);

          return (
            <path
              key={`field-line-${i}`}
              d={path}
              stroke={i % 2 === 0 ? C.accent : C.secondary}
              strokeWidth={2}
              fill="none"
              opacity={opacity}
            />
          );
        })}
      </svg>

      {/* 中央の磁石 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 0,
        }}
      >
        <div
          style={{
            width: 60,
            height: 120,
            background: C.danger,
            borderRadius: "30px 0 0 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 40,
            fontWeight: 800,
            color: C.white,
          }}
        >
          N
        </div>
        <div
          style={{
            width: 60,
            height: 120,
            background: C.accent,
            borderRadius: "0 30px 30px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 40,
            fontWeight: 800,
            color: C.white,
          }}
        >
          S
        </div>
      </div>

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "15%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 24,
          color: C.gray[500],
          letterSpacing: 4,
          opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
        }}
      >
        MAGNETIC FIELD
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleSakura ──

/**
 * ParticleSakura - 桜吹雪エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";
import { lerp, font } from "../../common";

export const ParticleSakura = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const petalCount = 60;
  const petals = React.useMemo(() => {
    return Array.from({ length: petalCount }).map((_, i) => ({
      id: `sakura-${i}`,
      x: random(`sk-x-${i}`) * 120 - 10,
      delay: random(`sk-d-${i}`) * 40,
      speed: random(`sk-sp-${i}`) * 1.5 + 1,
      size: random(`sk-s-${i}`) * 15 + 10,
      rotationSpeed: (random(`sk-rs-${i}`) - 0.5) * 10,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(to bottom, #fce4ec 0%, #f8bbd0 100%)",
        overflow: "hidden",
      }}
    >
      {petals.map((p) => {
        const startFrame = startDelay + p.delay;
        const fallProgress = (frame - startFrame) * p.speed;
        const y = -30 + fallProgress;
        const wobbleX = Math.sin(fallProgress * 0.03 + p.x) * 40;
        const rotation = (frame - startFrame) * p.rotationSpeed;

        if (y > height + 30 || frame < startFrame) return null;

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: y,
              width: p.size,
              height: p.size * 0.6,
              background: `radial-gradient(ellipse, #ffb6c1 30%, #ff69b4 100%)`,
              borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
              transform: `translateX(${wobbleX}px) rotate(${rotation}deg)`,
              opacity: 0.8,
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
          fontSize: 100,
          fontWeight: 300,
          color: "#880e4f",
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        桜
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleShootingStars ──

/**
 * ParticleShootingStars - 流れ星エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const ParticleShootingStars = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const starCount = 8;
  const shootingStars = React.useMemo(() => {
    return Array.from({ length: starCount }).map((_, i) => ({
      id: `shooting-${i}`,
      startX: random(`ss-x-${i}`) * 80 + 10,
      startY: random(`ss-y-${i}`) * 30,
      angle: random(`ss-a-${i}`) * 30 + 30,
      speed: random(`ss-sp-${i}`) * 15 + 10,
      delay: i * 12,
      length: random(`ss-l-${i}`) * 100 + 50,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: "#0a0a1a" }}>
      {/* 背景の星 */}
      {Array.from({ length: 50 }).map((_, i) => {
        const twinkle = Math.sin((frame - startDelay) * 0.1 + i * 0.5) * 0.5 + 0.5;
        return (
          <div
            key={`bg-star-${i}`}
            style={{
              position: "absolute",
              left: `${random(`bgst-x-${i}`) * 100}%`,
              top: `${random(`bgst-y-${i}`) * 100}%`,
              width: random(`bgst-s-${i}`) * 3 + 1,
              height: random(`bgst-s-${i}`) * 3 + 1,
              background: C.white,
              borderRadius: "50%",
              opacity: twinkle * 0.8,
            }}
          />
        );
      })}

      {/* 流れ星 */}
      {shootingStars.map((star) => {
        const starFrame = frame - startDelay - star.delay;
        if (starFrame < 0 || starFrame > 30) return null;

        const progress = starFrame / 30;
        const x = star.startX + Math.cos((star.angle * Math.PI) / 180) * star.speed * starFrame;
        const y = star.startY + Math.sin((star.angle * Math.PI) / 180) * star.speed * starFrame;
        const opacity = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

        return (
          <div
            key={star.id}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: star.length,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${C.white})`,
              transform: `rotate(${star.angle}deg)`,
              opacity: opacity,
              boxShadow: `0 0 10px ${C.white}`,
            }}
          />
        );
      })}

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "25%",
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 60,
          fontWeight: 700,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        SHOOTING STARS
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleSmoke ──

/**
 * ParticleSmoke - 煙エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const ParticleSmoke = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const smokeCount = 20;
  const smokeParticles = React.useMemo(() => {
    return Array.from({ length: smokeCount }).map((_, i) => ({
      id: `smoke-${i}`,
      delay: i * 5,
      offsetX: (random(`sm-x-${i}`) - 0.5) * 100,
      speed: random(`sm-sp-${i}`) * 0.5 + 0.3,
      size: random(`sm-s-${i}`) * 100 + 80,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {smokeParticles.map((s) => {
        const particleFrame = frame - startDelay - s.delay;
        if (particleFrame < 0) return null;

        const y = 600 - particleFrame * s.speed * 3;
        const x = 640 + s.offsetX + Math.sin(particleFrame * 0.05) * 30;
        const currentSize = s.size + particleFrame * 2;
        const opacity = Math.max(0, 1 - particleFrame / 100);

        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: currentSize,
              height: currentSize,
              background: `radial-gradient(circle, ${C.gray[500]}80 0%, transparent 70%)`,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              opacity: opacity * 0.6,
              filter: "blur(20px)",
            }}
          />
        );
      })}

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "30%",
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 700,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        SMOKE
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleSnow ──

/**
 * ParticleSnow - 雪エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";
import { C, lerp, font } from "../../common";

export const ParticleSnow = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const snowCount = 80;
  const snowflakes = React.useMemo(() => {
    return Array.from({ length: snowCount }).map((_, i) => ({
      id: `snow-${i}`,
      x: random(`s-x-${i}`) * 100,
      delay: random(`s-d-${i}`) * 50,
      speed: random(`s-sp-${i}`) * 1 + 0.5,
      size: random(`s-s-${i}`) * 6 + 2,
      opacity: random(`s-o-${i}`) * 0.6 + 0.3,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(to bottom, #1a1a2e 0%, #0f0f1a 100%)",
        overflow: "hidden",
      }}
    >
      {snowflakes.map((s) => {
        const startFrame = startDelay + s.delay;
        const fallProgress = (frame - startFrame) * s.speed;
        const y = -20 + fallProgress;
        const wobbleX = Math.sin(fallProgress * 0.02 + s.x) * 20;

        if (y > height + 20 || frame < startFrame) return null;

        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: y,
              width: s.size,
              height: s.size,
              background: C.white,
              borderRadius: "50%",
              transform: `translateX(${wobbleX}px)`,
              opacity: s.opacity,
              boxShadow: "0 0 10px rgba(255,255,255,0.5)",
            }}
          />
        );
      })}

      {/* 地面の雪 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
          background: "linear-gradient(to top, #e0e0e0 0%, transparent 100%)",
          opacity: lerp(frame, [startDelay + 40, startDelay + 80], [0, 0.3]),
        }}
      />

      {/* テキスト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          transform: "translate(-50%, -50%)",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 700,
          color: C.white,
          opacity: lerp(frame, [startDelay, startDelay + 30], [0, 1]),
        }}
      >
        WINTER
      </div>
    </AbsoluteFill>
  );
};

// ── ParticleSparks ──

/**
 * ParticleSparks - 火花エフェクト
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, random } from "remotion";
import { C, lerp, font } from "../../common";

export const ParticleSparks = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const sparkCount = 50;
  const sparks = React.useMemo(() => {
    return Array.from({ length: sparkCount }).map((_, i) => ({
      id: `spark-${i}`,
      angle: random(`sp-a-${i}`) * Math.PI * 2,
      speed: random(`sp-sp-${i}`) * 8 + 4,
      size: random(`sp-s-${i}`) * 4 + 2,
      life: random(`sp-l-${i}`) * 30 + 20,
      delay: random(`sp-d-${i}`) * 60,
    }));
  }, []);

  const burstFrame = startDelay + 20;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 火花 */}
      {sparks.map((s) => {
        const particleFrame = frame - burstFrame - s.delay;
        if (particleFrame < 0 || particleFrame > s.life) return null;

        const progress = particleFrame / s.life;
        const distance = s.speed * particleFrame * (1 - progress * 0.5);
        const x = Math.cos(s.angle) * distance;
        const y = Math.sin(s.angle) * distance + particleFrame * 0.5; // 重力
        const opacity = 1 - progress;
        const currentSize = s.size * (1 - progress * 0.5);

        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: currentSize,
              height: currentSize,
              background: progress < 0.3 ? C.yellow : progress < 0.6 ? C.orange : C.danger,
              borderRadius: "50%",
              transform: `translate(${x}px, ${y}px)`,
              opacity: opacity,
              boxShadow: `0 0 ${currentSize * 2}px ${progress < 0.5 ? C.yellow : C.orange}`,
            }}
          />
        );
      })}

      {/* 中心のフラッシュ */}
      {frame >= burstFrame && frame < burstFrame + 10 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 100,
            height: 100,
            background: C.white,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            opacity: lerp(frame, [burstFrame, burstFrame + 10], [1, 0]),
            filter: "blur(20px)",
          }}
        />
      )}

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
          color: C.orange,
          textShadow: `0 0 30px ${C.orange}`,
          opacity: lerp(frame, [startDelay + 50, startDelay + 70], [0, 1]),
        }}
      >
        SPARKS
      </div>
    </AbsoluteFill>
  );
};
