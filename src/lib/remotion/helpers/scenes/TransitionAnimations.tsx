// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── TransitionBlinds ──

/**
 * TransitionBlinds - ブラインドトランジション - 縦ブラインド
 */


export const TransitionBlinds = ({ startDelay = 0, direction = "vertical" }: {
  startDelay?: number;
  direction?: "vertical" | "horizontal";
}) => {
  const frame = useCurrentFrame();

  const blindCount = 12;
  const isVertical = direction === "vertical";

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 背景コンテンツ */}
      <AbsoluteFill
        style={{
          background: C.black,
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
            color: C.gray[800],
          }}
        >
          BEFORE
        </div>
      </AbsoluteFill>

      {/* ブラインド */}
      {Array.from({ length: blindCount }).map((_, i) => {
        const delay = i * 3;
        const progress = lerp(
          frame,
          [startDelay + delay, startDelay + delay + 20],
          [0, 100],
          EASE.out
        );

        return (
          <div
            key={`blind-${i}`}
            style={{
              position: "absolute",
              ...(isVertical
                ? {
                    left: `${(i / blindCount) * 100}%`,
                    top: 0,
                    width: `${100 / blindCount + 0.5}%`,
                    height: "100%",
                  }
                : {
                    left: 0,
                    top: `${(i / blindCount) * 100}%`,
                    width: "100%",
                    height: `${100 / blindCount + 0.5}%`,
                  }),
              background: C.accent,
              transform: isVertical
                ? `scaleX(${progress / 100})`
                : `scaleY(${progress / 100})`,
              transformOrigin: i % 2 === 0 ? "left" : "right",
            }}
          />
        );
      })}

      {/* 前景コンテンツ */}
      <AbsoluteFill
        style={{
          clipPath: `polygon(${Array.from({ length: blindCount })
            .map((_, i) => {
              const delay = i * 3;
              const progress = lerp(
                frame,
                [startDelay + delay, startDelay + delay + 20],
                [0, 100],
                EASE.out
              );
              const x1 = (i / blindCount) * 100;
              const x2 = ((i + 1) / blindCount) * 100;
              return `${x1}% ${progress}%, ${x2}% ${progress}%`;
            })
            .join(", ")}, 100% 100%, 0% 100%)`,
          background: C.white,
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
            color: C.black,
          }}
        >
          AFTER
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── TransitionBoxReveal ──

/**
 * TransitionBoxReveal - ボックスリビール - グリッド状に表示
 */


export const TransitionBoxReveal = ({ startDelay = 0, gridSize = 6 }: {
  startDelay?: number;
  gridSize?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const boxes: { row: number; col: number; delay: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const distance = Math.sqrt(
        Math.pow(row - gridSize / 2, 2) + Math.pow(col - gridSize / 2, 2)
      );
      boxes.push({ row, col, delay: distance * 3 });
    }
  }

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景コンテンツ */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 100, fontWeight: 800, color: C.white }}>
          GRID
        </div>
      </AbsoluteFill>

      {/* ボックスマスク */}
      {boxes.map((box) => {
        const progress = spring({
          frame: frame - startDelay - box.delay,
          fps,
          config: { damping: 15, stiffness: 200 },
        });

        const colors = [C.accent, C.secondary, C.tertiary];
        const color = colors[(box.row + box.col) % colors.length];

        return (
          <div
            key={`box-${box.row}-${box.col}`}
            style={{
              position: "absolute",
              left: `${(box.col / gridSize) * 100}%`,
              top: `${(box.row / gridSize) * 100}%`,
              width: `${100 / gridSize + 0.5}%`,
              height: `${100 / gridSize + 0.5}%`,
              background: color,
              transform: `scale(${progress})`,
              opacity: progress * 0.9,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── TransitionCircleWipe ──

/**
 * TransitionCircleWipe - サークルワイプ - 円形に広がる
 */


export const TransitionCircleWipe = ({ startDelay = 0, originX = 50, originY = 50 }: {
  startDelay?: number;
  originX?: number;
  originY?: number;
}) => {
  const frame = useCurrentFrame();

  const progress = lerp(frame, [startDelay, startDelay + 40], [0, 150], EASE.out);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景 */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 60, color: C.gray[700] }}>
          OLD CONTENT
        </div>
      </AbsoluteFill>

      {/* 新しいコンテンツ */}
      <AbsoluteFill
        style={{
          background: C.accent,
          clipPath: `circle(${progress}% at ${originX}% ${originY}%)`,
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
          REVEAL
        </div>
      </AbsoluteFill>

      {/* エッジのリング */}
      <div
        style={{
          position: "absolute",
          left: `${originX}%`,
          top: `${originY}%`,
          width: progress * 15,
          height: progress * 15,
          border: `4px solid ${C.white}`,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          opacity: progress < 100 ? 0.5 : 0,
        }}
      />
    </AbsoluteFill>
  );
};

// ── TransitionDiagonalSlice ──

/**
 * TransitionDiagonalSlice - 斜めスライス - 斜線で切り替え
 */


export const TransitionDiagonalSlice = ({ startDelay = 0, angle = 15 }: {
  startDelay?: number;
  angle?: number;
}) => {
  const frame = useCurrentFrame();

  const progress = lerp(frame, [startDelay, startDelay + 35], [0, 150], EASE.snap);

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 背景コンテンツ */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 80, fontWeight: 700, color: C.gray[700] }}>
          SCENE A
        </div>
      </AbsoluteFill>

      {/* 新しいコンテンツ */}
      <AbsoluteFill
        style={{
          background: C.black,
          clipPath: `polygon(
            ${progress - 30}% 0%,
            ${progress + 20}% 0%,
            ${progress - 10}% 100%,
            ${progress - 60}% 100%
          )`,
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
          }}
        >
          SCENE B
        </div>
      </AbsoluteFill>

      {/* エッジライン */}
      <div
        style={{
          position: "absolute",
          left: `${progress - 30}%`,
          top: "-10%",
          width: 6,
          height: "120%",
          background: C.accent,
          transform: `rotate(${angle}deg)`,
          transformOrigin: "top left",
        }}
      />
    </AbsoluteFill>
  );
};

// ── TransitionFlash ──

/**
 * TransitionFlash - フラッシュトランジション
 */


export const TransitionFlash = ({ startDelay = 0, flashColor = C.white }: {
  startDelay?: number;
  flashColor?: string;
}) => {
  const frame = useCurrentFrame();

  const phase1 = frame < startDelay + 15;
  const flashPhase = frame >= startDelay + 15 && frame < startDelay + 25;
  const phase2 = frame >= startDelay + 25;

  const flashIntensity = flashPhase
    ? interpolate(frame, [startDelay + 15, startDelay + 20, startDelay + 25], [0, 1, 0])
    : 0;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* シーン1 */}
      {phase1 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontFamily: font, fontSize: 80, fontWeight: 700, color: C.white }}>
            BEFORE
          </div>
        </AbsoluteFill>
      )}

      {/* シーン2 */}
      {phase2 && (
        <AbsoluteFill
          style={{
            background: C.gray[950],
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
            }}
          >
            AFTER
          </div>
        </AbsoluteFill>
      )}

      {/* フラッシュ */}
      <AbsoluteFill
        style={{
          background: flashColor,
          opacity: flashIntensity,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// ── TransitionGlitch ──

/**
 * TransitionGlitch - グリッチトランジション
 */


export const TransitionGlitch = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const glitchPhase = frame >= startDelay && frame < startDelay + 30;
  const transitionComplete = frame >= startDelay + 30;

  const slices = 15;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景シーン */}
      {!transitionComplete && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontFamily: font, fontSize: 80, fontWeight: 700, color: C.white }}>
            SCENE 1
          </div>
        </AbsoluteFill>
      )}

      {/* グリッチスライス */}
      {glitchPhase &&
        Array.from({ length: slices }).map((_, i) => {
          const sliceHeight = 100 / slices;
          const offsetX = (random(`glitch-x-${frame}-${i}`) - 0.5) * 100;
          const showSlice = random(`glitch-show-${frame}-${i}`) > 0.3;

          return (
            <div
              key={`glitch-slice-${i}`}
              style={{
                position: "absolute",
                left: 0,
                top: `${i * sliceHeight}%`,
                width: "100%",
                height: `${sliceHeight + 1}%`,
                background: random(`glitch-bg-${frame}-${i}`) > 0.5 ? C.accent : C.secondary,
                transform: `translateX(${offsetX}px)`,
                opacity: showSlice ? 0.8 : 0,
              }}
            />
          );
        })}

      {/* 新しいシーン */}
      {transitionComplete && (
        <AbsoluteFill
          style={{
            background: C.gray[950],
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
            }}
          >
            SCENE 2
          </div>
        </AbsoluteFill>
      )}

      {/* RGBずれ */}
      {glitchPhase && (
        <>
          <AbsoluteFill
            style={{
              background: "rgba(255, 0, 0, 0.3)",
              mixBlendMode: "screen",
              transform: `translateX(${(random(`rgb-r-${frame}`) - 0.5) * 20}px)`,
            }}
          />
          <AbsoluteFill
            style={{
              background: "rgba(0, 255, 255, 0.3)",
              mixBlendMode: "screen",
              transform: `translateX(${(random(`rgb-c-${frame}`) - 0.5) * -20}px)`,
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

// ── TransitionLineSweep ──

/**
 * TransitionLineSweep - ラインスイープ - 複数の線が横切る
 */


export const TransitionLineSweep = ({ startDelay = 0, lineCount = 5 }: {
  startDelay?: number;
  lineCount?: number;
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 背景 */}
      <AbsoluteFill style={{ background: C.black }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: font,
            fontSize: 60,
            color: C.gray[800],
          }}
        >
          SWEEPING
        </div>
      </AbsoluteFill>

      {/* ライン */}
      {Array.from({ length: lineCount }).map((_, i) => {
        const delay = i * 8;
        const progress = lerp(
          frame,
          [startDelay + delay, startDelay + delay + 25],
          [-20, 120],
          EASE.out
        );

        const thickness = 80 - i * 12;
        const colors = [C.accent, C.secondary, C.tertiary, C.white, C.gray[500]];

        return (
          <div
            key={`sweep-line-${i}`}
            style={{
              position: "absolute",
              left: `${progress}%`,
              top: 0,
              width: thickness,
              height: "100%",
              background: colors[i % colors.length],
              transform: "skewX(-15deg)",
              opacity: 0.9,
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
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          color: C.white,
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
        }}
      >
        LINES
      </div>
    </AbsoluteFill>
  );
};

// ── TransitionLiquidMorph ──

/**
 * TransitionLiquidMorph - リキッドモーフ - 液体状に変形
 */


export const TransitionLiquidMorph = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const morphProgress = lerp(frame, [startDelay, startDelay + 50], [0, 1], EASE.inOut);

  // 波形のパス生成
  const generateWavePath = (progress: number, amplitude: number) => {
    const points = 20;
    const yBase = 100 - progress * 100;

    let path = `M 0 100 L 0 ${yBase}`;

    for (let i = 0; i <= points; i++) {
      const x = (i / points) * 100;
      const wave = Math.sin((i / points) * Math.PI * 4 + frame * 0.1) * amplitude * (1 - progress);
      const y = yBase + wave;
      path += ` L ${x} ${y}`;
    }

    path += ` L 100 100 Z`;
    return path;
  };

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 古いシーン */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 80, fontWeight: 700, color: C.gray[800] }}>
          LIQUID
        </div>
      </AbsoluteFill>

      {/* 液体オーバーレイ */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={C.accent} />
            <stop offset="100%" stopColor={C.secondary} />
          </linearGradient>
        </defs>
        <path d={generateWavePath(morphProgress, 8)} fill="url(#liquidGrad)" />
      </svg>

      {/* 新しいシーン */}
      {morphProgress > 0.5 && (
        <AbsoluteFill
          style={{
            clipPath: `inset(${(1 - morphProgress) * 200}% 0 0 0)`,
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
            }}
          >
            MORPH
          </div>
        </AbsoluteFill>
      )}

      {/* 泡 */}
      {morphProgress > 0.2 && morphProgress < 0.8 && (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const x = random(`bubble-x-${i}`) * 80 + 10;
            const bubbleFrame = (frame - startDelay - 10 + i * 5) % 40;
            const y = 100 - bubbleFrame * 3;
            const size = random(`bubble-s-${i}`) * 20 + 10;

            return (
              <div
                key={`bubble-${i}`}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  border: `2px solid ${C.white}40`,
                  borderRadius: "50%",
                  opacity: y > 20 && y < 80 ? 0.6 : 0,
                }}
              />
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
};

// ── TransitionShutter ──

/**
 * TransitionShutter - シャッタートランジション - カメラシャッター風
 */


export const TransitionShutter = ({ startDelay = 0, bladeCount = 8 }: {
  startDelay?: number;
  bladeCount?: number;
}) => {
  const frame = useCurrentFrame();

  const closeProgress = lerp(frame, [startDelay, startDelay + 15], [0, 1], EASE.inFn);
  const openProgress = lerp(frame, [startDelay + 20, startDelay + 35], [0, 1], EASE.out);

  const isClosed = frame >= startDelay + 15 && frame < startDelay + 20;
  const isOpening = frame >= startDelay + 20;

  const apertureSize = isClosed
    ? 0
    : isOpening
    ? openProgress * 150
    : (1 - closeProgress) * 150;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 背景シーン */}
      {!isOpening && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontFamily: font, fontSize: 60, color: C.gray[700] }}>
            SCENE A
          </div>
        </AbsoluteFill>
      )}

      {/* 新しいシーン */}
      {isOpening && (
        <AbsoluteFill
          style={{
            background: C.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontFamily: font, fontSize: 80, fontWeight: 800, color: C.white }}>
            SCENE B
          </div>
        </AbsoluteFill>
      )}

      {/* シャッターブレード */}
      {Array.from({ length: bladeCount }).map((_, i) => {
        const angle = (i / bladeCount) * 360;
        const bladeLength = 800;

        return (
          <div
            key={`shutter-blade-${i}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: bladeLength,
              height: bladeLength / 2,
              background: C.gray[900],
              transformOrigin: "0 50%",
              transform: `
                rotate(${angle}deg)
                translateX(${apertureSize}px)
              `,
              borderRight: `2px solid ${C.gray[700]}`,
            }}
          />
        );
      })}

      {/* 中央の円（アパーチャー） */}
      {!isClosed && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: apertureSize * 2,
            height: apertureSize * 2,
            border: `2px solid ${C.gray[600]}`,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ── TransitionZoomBlur ──

/**
 * TransitionZoomBlur - ズームブラートランジション
 */


export const TransitionZoomBlur = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const zoomProgress = lerp(frame, [startDelay, startDelay + 20], [1, 3], EASE.inFn);
  const blurProgress = lerp(frame, [startDelay, startDelay + 20], [0, 30]);
  const opacityProgress = lerp(frame, [startDelay + 15, startDelay + 25], [1, 0]);
  const newSceneOpacity = lerp(frame, [startDelay + 20, startDelay + 35], [0, 1]);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* 古いシーン（ズーム＆ブラー） */}
      <AbsoluteFill
        style={{
          transform: `scale(${zoomProgress})`,
          filter: `blur(${blurProgress}px)`,
          opacity: opacityProgress,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 80, fontWeight: 700, color: C.white }}>
          ZOOM OUT
        </div>
      </AbsoluteFill>

      {/* 新しいシーン */}
      <AbsoluteFill
        style={{
          background: C.gray[950],
          opacity: newSceneOpacity,
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
            transform: `scale(${interpolate(newSceneOpacity, [0, 1], [0.8, 1])})`,
          }}
        >
          ZOOM IN
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
