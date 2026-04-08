// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── Roller3DCarousel ──

/**
 * Roller3DCarousel - 3Dカルーセル - 円筒状に回転するテキスト
 */


export const Roller3DCarousel = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Innovation", "Creation", "Evolution", "Revolution", "Transformation", "INSPIRATION"];
  const t = frame - startDelay;
  const finalIndex = words.length - 1;

  // 回転角度の計算
  const anglePerItem = 360 / words.length;
  const duration = 90;
  const progress = Math.min(t / duration, 1);

  // カスタムイージング：ゆっくり→高速→最後はゆっくり
  const carouselEasing = (x: number): number => {
    if (x < 0.2) {
      return 0.1 * Easing.in(Easing.quad)(x / 0.2);
    } else if (x < 0.7) {
      return 0.1 + 0.7 * ((x - 0.2) / 0.5);
    } else {
      return 0.8 + 0.2 * Easing.out(Easing.cubic)((x - 0.7) / 0.3);
    }
  };

  const easedProgress = carouselEasing(progress);
  const totalRotation = finalIndex * anglePerItem;
  let rotation = easedProgress * totalRotation;

  // 最終停止のバウンス
  const isStopping = t >= duration - 10;
  if (isStopping) {
    const bounceSpring = spring({
      frame: t - (duration - 10),
      fps,
      config: { damping: 12, stiffness: 200 },
    });
    rotation = totalRotation - (totalRotation - rotation) * (1 - bounceSpring);
  }

  const radius = 250;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          perspective: "1000px",
        }}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${-rotation}deg)`,
            width: 600,
            height: 100,
            position: "relative",
          }}
        >
          {words.map((word, i) => {
            const itemAngle = i * anglePerItem;
            const isActive = Math.abs((rotation % 360) - itemAngle) < anglePerItem / 2 ||
                           Math.abs((rotation % 360) - itemAngle - 360) < anglePerItem / 2;
            const isFinal = i === finalIndex && t >= duration;

            return (
              <div
                key={`carousel-${word}`}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: font,
                  fontSize: isFinal ? 72 : 56,
                  fontWeight: isFinal ? 900 : 600,
                  color: isFinal ? C.warning : isActive ? C.white : C.gray[600],
                  transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  backfaceVisibility: "hidden",
                  textShadow: isFinal ? `0 0 30px ${C.warning}99` : "none",
                }}
              >
                {word}
              </div>
            );
          })}
        </div>
      </div>

      {/* ラベル */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 80,
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 14,
          color: C.gray[600],
          letterSpacing: 3,
        }}
      >
        3D CAROUSEL
      </div>
    </AbsoluteFill>
  );
};

// ── RollerBlur ──

/**
 * RollerBlur - ブラー切り替え
 */


export const RollerBlur = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["Creative", "Innovative", "Powerful", "Elegant"];
  const cycleDuration = 30;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const enterBlur = lerp(cycleT, [0, 10], [20, 0], EASE.out);
  const exitBlur = currentIndex >= finalIndex ? 0 : lerp(cycleT, [cycleDuration - 10, cycleDuration], [0, 20], EASE.smooth);
  const blur = Math.max(enterBlur, exitBlur);

  const enterOpacity = lerp(cycleT, [0, 10], [0, 1], EASE.out);
  const exitOpacity = currentIndex >= finalIndex ? 1 : lerp(cycleT, [cycleDuration - 10, cycleDuration], [1, 0], EASE.smooth);
  const opacity = Math.min(enterOpacity, exitOpacity);

  return (
    <AbsoluteFill style={{ background: C.white }}>
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
            fontSize: 20,
            fontWeight: 500,
            color: C.gray[400],
            letterSpacing: 4,
            marginBottom: 20,
          }}
        >
          SOLUTIONS THAT ARE
        </div>

        {/* ブラーローラー */}
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 800,
            color: C.gray[900],
            filter: `blur(${blur}px)`,
            opacity,
          }}
        >
          {words[currentIndex]}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerCountdown ──

/**
 * RollerCountdown - カウントダウンリビール
 */


export const RollerCountdown = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numbers = ["5", "4", "3", "2", "1"];
  const finalWord = "LAUNCH";
  const wordHeight = 180;
  const t = frame - startDelay;

  // フェーズ分け
  // 0-60f: カウントダウン（各12f）
  // 60-75f: 高速回転
  // 75-90f: 減速→LAUNCH停止
  const countdownDuration = 60;
  const spinDuration = 15;

  const isCountdown = t < countdownDuration;
  const isSpinning = t >= countdownDuration && t < countdownDuration + spinDuration;
  const isStopping = t >= countdownDuration + spinDuration;

  // カウントダウンフェーズの計算
  let scrollY = 0;
  let displayIndex = 0;
  let showFinal = false;

  if (isCountdown) {
    // 各数字を順番に表示（スロット風に上から落ちてくる）
    const framePerNumber = countdownDuration / numbers.length;
    displayIndex = Math.floor(t / framePerNumber);
    const localT = t % framePerNumber;

    // スプリングで滑らかに次の数字へ
    const slideProgress = spring({
      frame: localT,
      fps,
      config: { damping: 15, stiffness: 200 },
    });

    scrollY = (displayIndex + (1 - slideProgress)) * wordHeight;
  } else if (isSpinning) {
    // 高速回転フェーズ
    const spinT = t - countdownDuration;
    // 加速しながら回転
    const speed = 15 + spinT * 2;
    scrollY = numbers.length * wordHeight + spinT * speed;
  } else {
    // 停止フェーズ：LAUNCHで止まる
    showFinal = true;
  }

  // 緊迫感演出：カウントダウンが進むにつれて
  const urgency = isCountdown ? displayIndex / (numbers.length - 1) : 1;

  // 背景色の変化
  const bgRed = Math.floor(10 + urgency * 20);
  const bgColor = isCountdown
    ? `rgb(${bgRed}, 10, 20)`
    : isStopping
      ? "#1a0a0a"
      : C.black;

  // パルス効果（カウントダウン中）
  const pulseScale = isCountdown
    ? 1 + 0.02 * Math.sin(t * 0.5) * (1 + urgency)
    : 1;

  // LAUNCH時の強調
  const launchProgress = isStopping
    ? spring({
        frame: t - (countdownDuration + spinDuration),
        fps,
        config: { damping: 8, stiffness: 150 },
      })
    : 0;

  // 回転中のブラー
  const blurAmount = isSpinning ? 8 : 0;

  return (
    <AbsoluteFill
      style={{
        background: isStopping
          ? `radial-gradient(circle, #2a1a2e 0%, ${C.black} 100%)`
          : bgColor,
        transform: `scale(${pulseScale})`,
      }}
    >
      {/* ビネット効果（緊迫感） */}
      {isCountdown && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle, transparent 30%, rgba(255,0,0,${urgency * 0.15}) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* メインコンテナ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        {showFinal ? (
          // LAUNCH表示
          <div
            style={{
              fontFamily: font,
              fontSize: 100 + launchProgress * 20,
              fontWeight: 900,
              color: "#ff6b6b",
              transform: `scale(${1 + launchProgress * 0.1})`,
              textShadow: `0 0 ${50 * launchProgress}px rgba(255, 107, 107, 0.8)`,
            }}
          >
            {finalWord}
          </div>
        ) : (
          // カウントダウン/回転表示
          <div
            style={{
              height: wordHeight,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* グラデーションマスク */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 40,
                background: `linear-gradient(${bgColor}, transparent)`,
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
                background: `linear-gradient(transparent, ${bgColor})`,
                zIndex: 1,
              }}
            />

            {/* スクロールコンテナ */}
            <div
              style={{
                filter: `blur(${blurAmount}px)`,
              }}
            >
              {isCountdown ? (
                // カウントダウン中：現在と次の数字を表示
                <>
                  <div
                    style={{
                      fontFamily: font,
                      fontSize: 180,
                      fontWeight: 900,
                      color: C.white,
                      height: wordHeight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `translateY(${-(scrollY % wordHeight)}px)`,
                    }}
                  >
                    {numbers[Math.min(displayIndex, numbers.length - 1)]}
                  </div>
                  {displayIndex < numbers.length - 1 && (
                    <div
                      style={{
                        fontFamily: font,
                        fontSize: 180,
                        fontWeight: 900,
                        color: C.white,
                        height: wordHeight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: `translateY(${-(scrollY % wordHeight)}px)`,
                      }}
                    >
                      {numbers[displayIndex + 1]}
                    </div>
                  )}
                </>
              ) : (
                // 高速回転中：数字がぐるぐる
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 180,
                    fontWeight: 900,
                    color: C.white,
                    height: wordHeight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {numbers[Math.floor(scrollY / wordHeight) % numbers.length]}
                </div>
              )}
            </div>
          </div>
        )}

        {/* サブテキスト */}
        {isStopping && (
          <div
            style={{
              fontFamily: font,
              fontSize: 20,
              color: C.gray[400],
              marginTop: 30,
              opacity: launchProgress,
              letterSpacing: 5,
            }}
          >
            YOUR JOURNEY BEGINS
          </div>
        )}
      </div>

      {/* パーティクル（LAUNCH時） */}
      {isStopping &&
        [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((deg, i) => {
          const angle = (deg / 360) * Math.PI * 2;
          const distance = 80 + launchProgress * 250;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          const size = 6 + (i % 3) * 3;

          return (
            <div
              key={`countdown-particle-${deg}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size,
                height: size,
                borderRadius: "50%",
                background: i % 2 === 0 ? "#ff6b6b" : "#ffaa6b",
                transform: `translate(${x}px, ${y}px)`,
                opacity: (1 - launchProgress) * 0.8,
              }}
            />
          );
        })}

      {/* 停止時のフラッシュ */}
      {isStopping && t < countdownDuration + spinDuration + 8 && (
        <AbsoluteFill
          style={{
            background: "#ff6b6b",
            opacity: lerp(
              t - (countdownDuration + spinDuration),
              [0, 8],
              [0.5, 0],
              EASE.out
            ),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ── RollerDramaticStop ──

/**
 * RollerDramaticStop - ドラマチックストップ - 一度止まりそうになってまた回る
 */


export const RollerDramaticStop = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = [
    "Good",
    "Better",
    "Great",
    "Amazing",
    "LEGENDARY", // 最終
  ];

  const wordHeight = 100;
  const t = frame - startDelay;
  const finalIndex = words.length - 1;
  const totalScrollDistance = finalIndex * wordHeight;

  // ドラマチックなイージング：
  // 0-20f: ゆっくり加速（0→15%位置）
  // 20-35f: フェイクストップ（15%付近で減速→ほぼ停止）
  // 35-45f: 「まだだ！」と再加速
  // 45-80f: 高速回転→減速→最終停止
  const duration = 80;
  const progress = Math.min(Math.max(t / duration, 0), 1);

  const dramaticEasing = (x: number): number => {
    if (x < 0.25) {
      // フェーズ1: ゆっくり加速（0→20%位置）
      return 0.2 * Easing.out(Easing.quad)(x / 0.25);
    } else if (x < 0.4375) {
      // フェーズ2: フェイクストップ（減速してほぼ停止、20%→25%でゆっくり）
      const fakeProgress = (x - 0.25) / 0.1875;
      return 0.2 + 0.05 * (1 - Math.pow(1 - fakeProgress, 3));
    } else if (x < 0.5625) {
      // フェーズ3: 再加速！（25%→35%）
      const reaccelProgress = (x - 0.4375) / 0.125;
      return 0.25 + 0.1 * Easing.in(Easing.quad)(reaccelProgress);
    } else {
      // フェーズ4: 高速→最終停止（35%→100%）
      const finalProgress = (x - 0.5625) / 0.4375;
      // 最初は速く、最後はゆっくり止まる
      return 0.35 + 0.65 * (1 - Math.pow(1 - finalProgress, 4));
    }
  };

  const easedProgress = dramaticEasing(progress);
  let scrollY = easedProgress * totalScrollDistance;

  // 最終停止時のバウンス効果
  const isStopping = t >= duration - 10;
  if (isStopping) {
    const bounceProgress = spring({
      frame: t - (duration - 10),
      fps,
      config: { damping: 12, stiffness: 200 },
    });
    const overshoot = 15 * (1 - bounceProgress);
    scrollY = totalScrollDistance + overshoot * Math.sin((t - (duration - 10)) * 0.5);
  }

  // 最終確定
  if (t >= duration) {
    scrollY = totalScrollDistance;
  }

  // 現在表示するワードとオフセット
  const displayIndex = Math.min(Math.floor(scrollY / wordHeight), finalIndex);
  const nextIndex = Math.min(displayIndex + 1, finalIndex);
  const offsetY = scrollY % wordHeight;

  // 最終停止時の強調
  const isFinal = t >= duration;
  const finalEmphasis = isFinal
    ? spring({
        frame: t - duration,
        fps,
        config: { damping: 8, stiffness: 150 },
      })
    : 0;

  // フェイクストップ時の「止まりそう」演出
  const isFakeStop = t >= 20 && t < 35;
  const fakeStopShake = isFakeStop ? Math.sin(t * 2) * 2 * (1 - (t - 20) / 15) : 0;

  return (
    <AbsoluteFill style={{ background: "#1a1a2e" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translateX(${fakeStopShake}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            color: C.gray[400],
            marginBottom: 15,
            opacity: lerp(t, [0, 15], [0, 1]),
          }}
        >
          Not just good, but...
        </div>

        {/* ローラー */}
        <div
          style={{
            height: wordHeight,
            overflow: "hidden",
            position: "relative",
            minWidth: 400,
          }}
        >
          {/* グラデーションマスク */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 25,
              background: "linear-gradient(#1a1a2e, transparent)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 25,
              background: "linear-gradient(transparent, #1a1a2e)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          {/* ワードコンテナ */}
          <div style={{ transform: `translateY(${-offsetY}px)` }}>
            {/* 現在のワード */}
            <div
              style={{
                fontFamily: font,
                fontSize: displayIndex === finalIndex && isFinal ? 72 : 64,
                fontWeight: displayIndex === finalIndex ? 900 : 600,
                color: displayIndex === finalIndex ? "#ffd700" : C.white,
                height: wordHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: displayIndex === finalIndex && isFinal
                  ? `scale(${1 + finalEmphasis * 0.1})`
                  : "none",
                textShadow: displayIndex === finalIndex && isFinal
                  ? `0 0 ${30 * finalEmphasis}px rgba(255, 215, 0, 0.8)`
                  : "none",
              }}
            >
              {words[displayIndex]}
            </div>

            {/* 次のワード */}
            {displayIndex < finalIndex && (
              <div
                style={{
                  fontFamily: font,
                  fontSize: nextIndex === finalIndex ? 72 : 64,
                  fontWeight: nextIndex === finalIndex ? 900 : 600,
                  color: nextIndex === finalIndex ? "#ffd700" : C.white,
                  height: wordHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {words[nextIndex]}
              </div>
            )}
          </div>
        </div>

        {/* サイドライン装飾 */}
        {isFinal && (
          <>
            <div
              style={{
                position: "absolute",
                left: -100,
                top: "50%",
                width: 60 * finalEmphasis,
                height: 3,
                background: "#ffd700",
                transform: "translateY(-50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: -100,
                top: "50%",
                width: 60 * finalEmphasis,
                height: 3,
                background: "#ffd700",
                transform: "translateY(-50%)",
              }}
            />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ── RollerDrum ──

/**
 * RollerDrum - 回転ドラム
 */


export const RollerDrum = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Today", "Tomorrow", "Forever", "Always"];
  const cycleDuration = 28;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const rotationProgress = spring({ frame: cycleT, fps, config: { damping: 15, stiffness: 150 } });

  const anglePerItem = 90;
  const baseRotation = currentIndex >= finalIndex
    ? finalIndex * anglePerItem
    : currentIndex * anglePerItem + rotationProgress * anglePerItem;

  return (
    <AbsoluteFill style={{ background: C.gray[900] }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 48,
            fontWeight: 300,
            color: C.gray[400],
          }}
        >
          Start
        </div>

        {/* 3Dドラム */}
        <div
          style={{
            perspective: "500px",
            height: 80,
            width: 300,
          }}
        >
          <div
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(-${baseRotation}deg)`,
              height: "100%",
              position: "relative",
            }}
          >
            {words.map((word, i) => {
              const angle = i * anglePerItem;
              const zOffset = 100;

              return (
                <div
                  key={`drum-${word}`}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: font,
                    fontSize: 56,
                    fontWeight: 700,
                    color: C.tertiary,
                    transform: `rotateX(${angle}deg) translateZ(${zOffset}px)`,
                    backfaceVisibility: "hidden",
                  }}
                >
                  {word}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerFadeSlide ──

/**
 * RollerFadeSlide - フェードスライド（上からフェードイン）
 */


export const RollerFadeSlide = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Faster", "Smarter", "Better", "Stronger"];
  const cycleDuration = 28;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const progress = spring({
    frame: cycleT,
    fps,
    config: { damping: 18, stiffness: 150 },
  });

  // 最後は退場しない
  const exitProgress = currentIndex >= finalIndex
    ? 0
    : lerp(cycleT, [cycleDuration - 8, cycleDuration], [0, 1], EASE.smooth);

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
        {/* 固定テキスト */}
        <div
          style={{
            fontFamily: font,
            fontSize: 48,
            fontWeight: 300,
            color: C.gray[400],
            marginBottom: 5,
          }}
        >
          Work
        </div>

        {/* ローラー部分 */}
        <div
          style={{
            height: 80,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 72,
              fontWeight: 800,
              color: C.white,
              transform: `translateY(${(1 - progress) * 40 - exitProgress * 40}px)`,
              opacity: progress * (1 - exitProgress),
            }}
          >
            {words[currentIndex]}
          </div>
        </div>

        {/* アンダーライン */}
        <div
          style={{
            width: 100,
            height: 4,
            background: C.accent,
            marginTop: 20,
            transform: `scaleX(${progress})`,
            transformOrigin: "left",
          }}
        />
      </div>

      {/* 右側の装飾 */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: font,
          fontSize: 200,
          fontWeight: 100,
          color: C.gray[900],
        }}
      >
        {String(currentIndex + 1).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

// ── RollerFlip ──

/**
 * RollerFlip - フリップ（カードめくり風）
 */


export const RollerFlip = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Ideas", "Dreams", "Goals", "Reality"];
  const cycleDuration = 30;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const nextIndex = Math.min(currentIndex + 1, finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const flipProgress = spring({
    frame: cycleT,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const rotation = currentIndex >= finalIndex ? 0 : flipProgress * 180;
  const showNext = rotation > 90;
  const displayWord = currentIndex >= finalIndex
    ? words[finalIndex]
    : showNext ? words[nextIndex] : words[currentIndex];

  return (
    <AbsoluteFill style={{ background: C.white }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: C.gray[600], marginBottom: 10 }}>
          Turn your
        </div>

        <div style={{ perspective: "1000px", height: 80 }}>
          <div
            style={{
              fontFamily: font,
              fontSize: 72,
              fontWeight: 800,
              color: C.black,
              transform: `rotateX(${showNext ? 180 - rotation : -rotation}deg)`,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
          >
            {displayWord}
          </div>
        </div>

        <div style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: C.gray[600], marginTop: 10 }}>
          into success
        </div>
      </div>

      <div style={{ position: "absolute", right: 60, bottom: 60, fontFamily: font, fontSize: 12, color: C.gray[400], letterSpacing: 2 }}>
        FLIP TRANSITION
      </div>
    </AbsoluteFill>
  );
};

// ── RollerGlitch ──

/**
 * RollerGlitch - グリッチ切り替え
 */


export const RollerGlitch = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["HACK", "CODE", "SHIP", "WIN"];
  const cycleDuration = 30;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  // グリッチ効果（切り替え時のみ、最終状態では無効）
  const isGlitching = currentIndex < finalIndex && cycleT < 8;
  const glitchIntensity = isGlitching ? Math.sin(cycleT * 2) * 5 : 0;

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
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 400,
            color: C.gray[600],
            marginBottom: 15,
          }}
        >
          READY TO
        </div>

        {/* グリッチローラー */}
        <div style={{ position: "relative" }}>
          {/* シアンレイヤー */}
          {isGlitching && (
            <div
              style={{
                position: "absolute",
                fontFamily: font,
                fontSize: 100,
                fontWeight: 900,
                color: "#00ffff",
                opacity: 0.7,
                transform: `translateX(${glitchIntensity}px)`,
                clipPath: "inset(0 0 50% 0)",
              }}
            >
              {words[currentIndex]}
            </div>
          )}
          {/* マゼンタレイヤー */}
          {isGlitching && (
            <div
              style={{
                position: "absolute",
                fontFamily: font,
                fontSize: 100,
                fontWeight: 900,
                color: "#ff00ff",
                opacity: 0.7,
                transform: `translateX(${-glitchIntensity}px)`,
                clipPath: "inset(50% 0 0 0)",
              }}
            >
              {words[currentIndex]}
            </div>
          )}
          {/* メインテキスト */}
          <div
            style={{
              fontFamily: font,
              fontSize: 100,
              fontWeight: 900,
              color: C.white,
            }}
          >
            {words[currentIndex]}
          </div>
        </div>
      </div>

      {/* スキャンライン */}
      {isGlitching && (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(255,255,255,0.03) 2px,
              rgba(255,255,255,0.03) 4px
            )`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ── RollerGradientWave ──

/**
 * RollerGradientWave - グラデーションウェーブ - 色が波のように流れながら変化
 */


export const RollerGradientWave = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["Dream", "Design", "Develop", "Deliver", "DOMINATE"];
  const t = frame - startDelay;

  const wordDuration = 25;
  const currentIndex = Math.min(
    Math.floor(t / wordDuration),
    words.length - 1
  );
  const currentWord = words[currentIndex];
  const isFinal = currentIndex === words.length - 1;

  const cycleFrame = t % wordDuration;

  // 波のオフセット
  const waveOffset = t * 0.1;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
      }}
    >
      {/* 背景のグラデーション波 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          background: `
            radial-gradient(
              ellipse at ${50 + Math.sin(waveOffset) * 20}% ${50 + Math.cos(waveOffset) * 20}%,
              ${C.accent}26 0%,
              transparent 50%
            )
          `,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        {/* メインワード */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {currentWord.split("").map((char, pos) => {
            // 各文字に波のような色変化
            const charWave = Math.sin(waveOffset * 2 + pos * 0.5);
            const hue = isFinal ? 45 : 250 + charWave * 20; // 最終は金色
            const lightness = 50 + charWave * 10;

            // 入場アニメーション
            const enterDelay = pos * 2;
            const enterProgress = lerp(cycleFrame - enterDelay, [0, 8], [0, 1], EASE.out);

            // currentWordとposで一意のキーを作成
            const uniqueKey = `${currentWord}-${char}${pos}`;

            return (
              <div
                key={`gradient-${uniqueKey}`}
                style={{
                  fontFamily: font,
                  fontSize: isFinal ? 100 : 80,
                  fontWeight: 800,
                  color: `hsl(${hue}, 80%, ${lightness}%)`,
                  transform: `translateY(${(1 - enterProgress) * 30}px)`,
                  opacity: enterProgress,
                  textShadow: isFinal
                    ? `0 0 30px ${C.warning}80`
                    : `0 0 20px hsla(${hue}, 80%, ${lightness}%, 0.3)`,
                }}
              >
                {char}
              </div>
            );
          })}
        </div>

        {/* 下のバー */}
        <div
          style={{
            width: 200,
            height: 4,
            background: C.gray[800],
            margin: "30px auto 0",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${((currentIndex + 1) / words.length) * 100}%`,
              height: "100%",
              background: isFinal
                ? `linear-gradient(90deg, ${C.warning}, ${C.gold})`
                : `linear-gradient(90deg, ${C.accent}, #8b5cf6)`,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerLiquid ──

/**
 * RollerLiquid - 流体モーフィング
 */


export const RollerLiquid = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["FLOW", "FORM", "FLUX", "FUSE"];
  const cycleDuration = 32;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const nextIndex = Math.min(currentIndex + 1, finalIndex);
  const cycleT = currentIndex >= finalIndex ? 0 : t % cycleDuration;

  const morphStart = cycleDuration - 12;
  const isMorphing = currentIndex < finalIndex && cycleT >= morphStart;

  const morphProgress = isMorphing
    ? lerp(cycleT, [morphStart, cycleDuration], [0, 1], EASE.smooth)
    : 0;

  // SVGフィルター用の乱れ
  const turbulence = isMorphing ? 0.02 + morphProgress * 0.05 : 0;
  const filterId = `liquidFilter-${startDelay}`;

  return (
    <AbsoluteFill style={{ background: C.white }}>
      {/* SVGフィルター定義 */}
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency={turbulence}
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={isMorphing ? 30 * morphProgress : 0}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

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
            fontSize: 18,
            fontWeight: 500,
            color: C.gray[400],
            letterSpacing: 6,
            marginBottom: 20,
          }}
        >
          IN CONSTANT
        </div>

        {/* 流体テキスト */}
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: C.gray[900],
            filter: isMorphing ? `url(#${filterId})` : "none",
            opacity: 1 - morphProgress * 0.5,
          }}
        >
          {words[currentIndex]}
        </div>

        {/* 次のテキスト（フェードイン） */}
        {isMorphing && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              fontFamily: font,
              fontSize: 120,
              fontWeight: 900,
              color: C.gray[900],
              opacity: morphProgress,
            }}
          >
            {words[nextIndex]}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ── RollerMaskSlide ──

/**
 * RollerMaskSlide - マスクスライド
 */


export const RollerMaskSlide = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["INSPIRE", "IMAGINE", "INNOVATE", "IMPACT"];
  const cycleDuration = 30;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const nextIndex = Math.min(currentIndex + 1, finalIndex);
  const cycleT = currentIndex >= finalIndex ? 0 : t % cycleDuration;

  const maskProgress = currentIndex >= finalIndex ? 0 : lerp(cycleT, [cycleDuration - 15, cycleDuration], [0, 100], EASE.smooth);
  const isTransitioning = currentIndex < finalIndex && cycleT >= cycleDuration - 15;

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
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            fontWeight: 500,
            color: C.gray[600],
            letterSpacing: 4,
            marginBottom: 20,
          }}
        >
          TIME TO
        </div>

        {/* マスクスライドコンテナ */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          {/* 現在のテキスト */}
          <div
            style={{
              fontFamily: font,
              fontSize: 100,
              fontWeight: 900,
              color: C.white,
              clipPath: isTransitioning
                ? `inset(0 ${maskProgress}% 0 0)`
                : "none",
            }}
          >
            {words[currentIndex]}
          </div>

          {/* 次のテキスト（マスクで徐々に表示） */}
          {isTransitioning && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                fontFamily: font,
                fontSize: 100,
                fontWeight: 900,
                color: C.accent,
                clipPath: `inset(0 0 0 ${100 - maskProgress}%)`,
              }}
            >
              {words[nextIndex]}
            </div>
          )}
        </div>

        {/* プログレスバー */}
        <div
          style={{
            width: 200,
            height: 2,
            background: C.gray[800],
            margin: "30px auto 0",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(cycleT / cycleDuration) * 100}%`,
              height: "100%",
              background: C.accent,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerMultiSlot ──

/**
 * RollerMultiSlot - マルチスロット - 複数列が順番に止まる
 */


export const RollerMultiSlot = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3列のスロット（最後のワードが最終結果）
  const slots = [
    { words: ["Make", "Build", "Create", "Design", "Craft", "CREATE"], stopFrame: 50 },
    { words: ["the", "a", "your", "our", "THE"], stopFrame: 65 },
    { words: ["magic", "future", "dream", "vision", "FUTURE"], stopFrame: 80 },
  ];

  const wordHeight = 60;
  const t = frame - startDelay;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 20,
          alignItems: "center",
        }}
      >
        {slots.map((slot, slotIndex) => {
          const finalIndex = slot.words.length - 1;
          const totalScroll = finalIndex * wordHeight;

          // スピン中か停止済みか
          const isSpinning = t < slot.stopFrame;

          // 連続スクロール位置を計算
          let scrollY = 0;

          if (isSpinning) {
            // 回転中：加速→高速
            // 開始を少しずらして各スロットの開始タイミングを変える
            const slotStart = slotIndex * 5;
            const localT = Math.max(0, t - slotStart);

            // 加速カーブ：最初ゆっくり→高速
            const accelDuration = 20;
            const maxSpeed = 8; // ピクセル/フレーム

            if (localT < accelDuration) {
              // 加速フェーズ
              const accelProgress = localT / accelDuration;
              const speed = maxSpeed * Easing.in(Easing.quad)(accelProgress);
              scrollY = (localT * speed * 0.5) % (slot.words.length * wordHeight);
            } else {
              // 高速回転フェーズ
              const baseScroll = accelDuration * maxSpeed * 0.5 * 0.5; // 加速中のスクロール量
              const highSpeedT = localT - accelDuration;
              scrollY = (baseScroll + highSpeedT * maxSpeed) % (slot.words.length * wordHeight);
            }
          } else {
            // 停止フェーズ：バウンス付きで最終位置へ
            const stopT = t - slot.stopFrame;
            const bounceSpring = spring({
              frame: stopT,
              fps,
              config: { damping: 10, stiffness: 250 },
            });

            // オーバーシュートしてバウンスバック
            const overshoot = 20 * Math.exp(-stopT * 0.15) * Math.sin(stopT * 0.8);
            scrollY = totalScroll + (1 - bounceSpring) * overshoot;
          }

          // 表示するワードとオフセット
          const wrappedScroll = ((scrollY % (slot.words.length * wordHeight)) + slot.words.length * wordHeight) % (slot.words.length * wordHeight);
          const displayIndex = Math.floor(wrappedScroll / wordHeight) % slot.words.length;
          const nextIndex = (displayIndex + 1) % slot.words.length;
          const offsetY = wrappedScroll % wordHeight;

          // 停止確定後
          const isFinal = !isSpinning && t >= slot.stopFrame + 15;
          const finalWord = slot.words[finalIndex];

          // 停止時の衝撃エフェクト
          const stopImpact = !isSpinning && t < slot.stopFrame + 8
            ? spring({
                frame: t - slot.stopFrame,
                fps,
                config: { damping: 15, stiffness: 400 },
              })
            : 1;

          // モーションブラー（回転中のみ）
          const blurAmount = isSpinning ? 3 : 0;

          return (
            <div
              key={`slot-col-${slot.stopFrame}`}
              style={{
                height: wordHeight + 20,
                minWidth: slotIndex === 0 ? 180 : slotIndex === 1 ? 100 : 180,
                overflow: "hidden",
                background: C.gray[900],
                borderRadius: 8,
                border: isFinal ? `2px solid ${C.accent}` : `2px solid ${C.gray[800]}`,
                position: "relative",
                transform: `scale(${stopImpact})`,
                boxShadow: isFinal ? `0 0 20px ${C.accent}66` : "none",
              }}
            >
              {/* 上下グラデーションマスク */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 15,
                  background: `linear-gradient(${C.gray[900]}, transparent)`,
                  zIndex: 2,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 15,
                  background: `linear-gradient(transparent, ${C.gray[900]})`,
                  zIndex: 2,
                }}
              />

              {/* スクロールコンテナ */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 0,
                  right: 0,
                  transform: `translateY(${-offsetY}px)`,
                  filter: `blur(${blurAmount}px)`,
                }}
              >
                {/* 停止後は最終ワードのみ表示 */}
                {isFinal ? (
                  <div
                    style={{
                      height: wordHeight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: font,
                      fontSize: 36,
                      fontWeight: 700,
                      color: C.accent,
                    }}
                  >
                    {finalWord}
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        height: wordHeight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: font,
                        fontSize: 32,
                        fontWeight: 500,
                        color: C.white,
                      }}
                    >
                      {slot.words[displayIndex]}
                    </div>
                    <div
                      style={{
                        height: wordHeight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: font,
                        fontSize: 32,
                        fontWeight: 500,
                        color: C.white,
                      }}
                    >
                      {slot.words[nextIndex]}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 完成時のフラッシュ */}
      {t >= 85 && (
        <AbsoluteFill
          style={{
            background: C.accent,
            opacity: lerp(t, [85, 92], [0.4, 0], EASE.out),
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 100,
          transform: "translateX(-50%)",
          fontFamily: font,
          fontSize: 14,
          color: C.gray[600],
          letterSpacing: 3,
          opacity: t >= 85 ? lerp(t, [85, 95], [0, 1]) : 0,
        }}
      >
        MULTI-SLOT REVEAL
      </div>
    </AbsoluteFill>
  );
};

// ── RollerOutlineHighlight ──

/**
 * RollerOutlineHighlight - アウトラインハイライト - 縦に並んだ同じワード、1つだけ塗りつぶし
 */


export const RollerOutlineHighlight = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const word = "Introducing";
  const rowCount = 7;
  const rowHeight = 120;
  const t = frame - startDelay;

  // ハイライト位置が上から下へ移動
  const duration = 90;
  const progress = Math.min(t / duration, 1);

  // イージング：ゆっくり→高速→ゆっくり止まる
  const easedProgress = Easing.inOut(Easing.cubic)(progress);
  const highlightPosition = easedProgress * (rowCount - 1);

  // スプリングで最終停止
  const isStopping = t >= duration - 15;
  const stopSpring = isStopping
    ? spring({
        frame: t - (duration - 15),
        fps,
        config: { damping: 15, stiffness: 200 },
      })
    : 0;

  const finalPosition = isStopping
    ? highlightPosition + (rowCount - 1 - highlightPosition) * stopSpring
    : highlightPosition;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6].slice(0, rowCount).map((rowIdx) => {
          const distance = Math.abs(rowIdx - finalPosition);
          const isHighlighted = distance < 0.5;

          // ハイライトに近いほど不透明度が上がる
          const opacity = isHighlighted ? 1 : Math.max(0.15, 0.4 - distance * 0.08);

          // ハイライト時のスケール
          const scale = isHighlighted
            ? 1 + 0.05 * (1 - distance * 2)
            : 1 - distance * 0.02;

          return (
            <div
              key={`outline-row-${rowIdx}`}
              style={{
                fontFamily: font,
                fontSize: 90,
                fontWeight: 800,
                height: rowHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${Math.max(0.8, scale)})`,
                color: isHighlighted ? C.white : "transparent",
                WebkitTextStroke: isHighlighted ? "none" : "1px rgba(255,255,255,0.3)",
                opacity,
                transition: "all 0.1s",
              }}
            >
              {word}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── RollerPerspectiveStripes ──

/**
 * RollerPerspectiveStripes - パースペクティブストライプ - 斜めに流れるテキスト帯
 */


export const RollerPerspectiveStripes = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const phrases = [
    { text: "Create your", color: C.white },
    { text: "own video", color: C.success },
  ];

  const t = frame - startDelay;
  const stripeCount = 9;
  const stripeHeight = 80;

  // 全体の流れる速度
  const scrollSpeed = 3;
  const scrollOffset = t * scrollSpeed;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* パースペクティブコンテナ */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "200%",
          height: "150%",
          transform: "translate(-50%, -50%) perspective(800px) rotateX(45deg) rotateZ(-15deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].slice(0, stripeCount).map((stripeIdx) => {
          // 各ストライプの位置（無限ループ）
          const baseY = stripeIdx * stripeHeight * 2 - scrollOffset;
          const wrappedY = ((baseY % (stripeCount * stripeHeight * 2)) + stripeCount * stripeHeight * 2) % (stripeCount * stripeHeight * 2);
          const y = wrappedY - stripeHeight * 2;

          // 交互にフレーズを切り替え
          const phraseIndex = stripeIdx % 2;
          const phrase = phrases[phraseIndex];

          // 横スクロール（各行で異なる速度）
          const xSpeed = 2 + (stripeIdx % 3);
          const xOffset = (t * xSpeed + stripeIdx * 100) % 2000 - 1000;

          // 奥行きに応じた不透明度
          const depthOpacity = lerp(wrappedY, [0, stripeCount * stripeHeight], [0.3, 1]);

          return (
            <div
              key={`stripe-row-${stripeIdx}`}
              style={{
                position: "absolute",
                top: y,
                left: 0,
                right: 0,
                height: stripeHeight,
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                transform: `translateX(${xOffset}px)`,
                opacity: depthOpacity,
              }}
            >
              {/* テキストを繰り返し表示 */}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((repeatIdx) => (
                <span
                  key={`text-${stripeIdx}-repeat-${repeatIdx}`}
                  style={{
                    fontFamily: font,
                    fontSize: 36,
                    fontWeight: 700,
                    color: phrase.color,
                    marginRight: 60,
                  }}
                >
                  {phrase.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* 中央のハイライト */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 800,
            color: C.white,
            textShadow: "0 0 40px rgba(0,0,0,0.8)",
            opacity: lerp(t, [20, 40], [0, 1]),
          }}
        >
          Create your
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 800,
            color: C.success,
            textShadow: "0 0 40px rgba(0,0,0,0.8)",
            opacity: lerp(t, [30, 50], [0, 1]),
          }}
        >
          own video
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerScaleBounce ──

/**
 * RollerScaleBounce - スケールバウンス
 */


export const RollerScaleBounce = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Build", "Ship", "Scale", "Grow"];
  const cycleDuration = 25;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const enterProgress = spring({
    frame: cycleT,
    fps,
    config: { damping: 10, stiffness: 200 },
  });

  const exitProgress = currentIndex >= finalIndex
    ? 1
    : lerp(cycleT, [cycleDuration - 6, cycleDuration], [1, 0], EASE.smooth);

  const scale = enterProgress * exitProgress;

  return (
    <AbsoluteFill style={{ background: C.accent }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "baseline",
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 60,
            fontWeight: 300,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Let&apos;s
        </div>

        {/* スケールローラー */}
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 800,
            color: C.white,
            transform: `scale(${scale})`,
            transformOrigin: "left bottom",
          }}
        >
          {words[currentIndex]}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerShuffle ──

/**
 * RollerShuffle - シャッフルリビール - 文字がシャッフルされて収束
 */


export const RollerShuffle = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const finalWord = "REVEALED";
  const shuffleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const t = frame - startDelay;

  // 各文字が順番に確定していく
  const duration = 60;
  const charsPerFrame = finalWord.length / duration;

  // 確定した文字数
  const confirmedCount = Math.min(
    Math.floor(t * charsPerFrame * 1.5),
    finalWord.length
  );

  // シードベースの擬似ランダム
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

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
        <div
          style={{
            fontFamily: font,
            fontSize: 18,
            fontWeight: 500,
            color: C.gray[600],
            letterSpacing: 4,
            marginBottom: 20,
            opacity: lerp(t, [0, 15], [0, 1]),
          }}
        >
          DECODING
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          {finalWord.split("").map((char, pos) => {
            const isConfirmed = pos < confirmedCount;

            // シャッフル中の文字
            let displayChar = char;
            if (!isConfirmed) {
              const randomIdx = Math.floor(
                pseudoRandom(t * 0.5 + pos * 100) * shuffleChars.length
              );
              displayChar = shuffleChars[randomIdx];
            }

            // 確定時のアニメーション
            const confirmFrame = pos / charsPerFrame / 1.5;
            const confirmProgress = isConfirmed
              ? spring({
                  frame: Math.max(0, t - confirmFrame),
                  fps,
                  config: { damping: 12, stiffness: 300 },
                })
              : 0;

            // finalWord="REVEALED"は固定なのでcharとposで一意
            const uniqueKey = `${char}${pos}`;

            return (
              <div
                key={`shuffle-${uniqueKey}`}
                style={{
                  fontFamily: font,
                  fontSize: 80,
                  fontWeight: 900,
                  color: isConfirmed ? C.accent : C.gray[800],
                  width: 60,
                  textAlign: "center",
                  transform: `scale(${1 + confirmProgress * 0.2}) translateY(${isConfirmed ? 0 : Math.sin(t * 0.3 + pos) * 3}px)`,
                  textShadow: isConfirmed
                    ? `0 0 ${20 * confirmProgress}px ${C.accent}99`
                    : "none",
                }}
              >
                {displayChar}
              </div>
            );
          })}
        </div>

        {/* プログレスバー */}
        <div
          style={{
            width: 300,
            height: 4,
            background: C.gray[800],
            margin: "30px auto 0",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(confirmedCount / finalWord.length) * 100}%`,
              height: "100%",
              background: C.accent,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerSlotMachine ──

/**
 * RollerSlotMachine - 高速縦ロール（スロットマシン風）
 */


export const RollerSlotMachine = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Feature", "Product", "Design", "Future"];
  const wordHeight = 80;
  const cycleDuration = 25;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const rawIndex = t / cycleDuration;
  // 最後で止める
  const currentIndex = Math.min(Math.floor(rawIndex), finalIndex);
  const nextIndex = Math.min(currentIndex + 1, finalIndex);

  // 最後のワードに完全に到達したらアニメーション停止
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const spinProgress = spring({
    frame: cycleT,
    fps,
    config: { damping: 15, stiffness: 300 },
  });

  const offsetY = currentIndex >= finalIndex ? 0 : (1 - spinProgress) * wordHeight;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 300,
            color: C.white,
          }}
        >
          New
        </div>

        <div
          style={{
            height: wordHeight,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 64,
              fontWeight: 700,
              color: C.accent,
              height: wordHeight,
              display: "flex",
              alignItems: "center",
              transform: `translateY(${offsetY}px)`,
            }}
          >
            {words[currentIndex]}
          </div>

          {currentIndex < finalIndex && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                fontFamily: font,
                fontSize: 64,
                fontWeight: 700,
                color: C.accent,
                height: wordHeight,
                display: "flex",
                alignItems: "center",
                transform: `translateY(${offsetY - wordHeight}px)`,
              }}
            >
              {words[nextIndex]}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 60,
          bottom: 60,
          fontFamily: font,
          fontSize: 12,
          color: C.gray[600],
          letterSpacing: 2,
        }}
      >
        SLOT MACHINE ROLL
      </div>
    </AbsoluteFill>
  );
};

// ── RollerSlotReveal ──

/**
 * RollerSlotReveal - スロットリビール - 「New [X]」形式でゆっくり→高速→キャッチコピー
 */


export const RollerSlotReveal = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const prefix = "New";
  const words = [
    "Feature",
    "Product",
    "Design",
    "Service",
    "Solution",
    "Platform",
    "Experience",
    "Vision",
    "Future",
    "Beginning",
  ];

  const wordHeight = 100;
  const t = frame - startDelay;
  const finalIndex = words.length - 1;

  // 連続的なスクロール位置を計算（ピクセル単位）
  // イージングカーブで滑らかに加速→減速
  const totalScrollDistance = finalIndex * wordHeight;

  // 全体の進行度を1つのイージングで管理
  // カスタムイージング：最初ゆっくり→中盤高速→最後ゆっくり
  // 85fでロール完了（最後をめちゃゆっくり）、残り5fは余韻
  const duration = 85;
  const progress = Math.min(Math.max(t / duration, 0), 1);

  // ベジェ曲線でS字カーブを作成（ゆっくり→速く→最後めちゃゆっくり）
  const easeInOutCustom = (x: number): number => {
    if (x < 0.15) {
      // 最初15%：ゆっくり加速
      return 0.02 * Math.pow(x / 0.15, 2);
    } else if (x < 0.3) {
      // 中盤15%：高速
      const mid = (x - 0.15) / 0.15;
      return 0.02 + 0.45 * mid;
    } else {
      // 最後70%：めちゃゆっくり減速（Beginningがゆ〜っくり上がってくる）
      const end = (x - 0.3) / 0.7;
      return 0.47 + 0.53 * (1 - Math.pow(1 - end, 7));
    }
  };

  const easedProgress = easeInOutCustom(progress);
  const scrollY = easedProgress * totalScrollDistance;

  // スプリングで最終停止を滑らかに
  const isStopping = t >= duration - 15;
  const springScroll = isStopping
    ? spring({
        frame: t - (duration - 15),
        fps,
        config: { damping: 20, stiffness: 150 },
      })
    : 0;

  // 最終スクロール位置
  const targetScroll = totalScrollDistance;
  const finalScroll = isStopping
    ? scrollY + (targetScroll - scrollY) * springScroll
    : scrollY;

  // 現在表示するワードとオフセット
  const currentIndex = Math.floor(finalScroll / wordHeight);
  const offsetY = finalScroll % wordHeight;

  const displayIndex = Math.min(currentIndex, finalIndex);
  const nextIndex = Math.min(displayIndex + 1, finalIndex);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* 固定テキスト */}
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 300,
            color: C.white,
            opacity: lerp(t, [0, 15], [0, 1]),
          }}
        >
          {prefix}
        </div>

        {/* ローラー */}
        <div
          style={{
            height: wordHeight,
            overflow: "hidden",
            position: "relative",
            minWidth: 500,
          }}
        >
          {/* グラデーションマスク */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 20,
              background: `linear-gradient(${C.black}, transparent)`,
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 20,
              background: `linear-gradient(transparent, ${C.black})`,
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          {/* ワードコンテナ */}
          <div
            style={{
              transform: `translateY(${-offsetY}px)`,
            }}
          >
            {/* 現在のワード */}
            <div
              style={{
                fontFamily: font,
                fontSize: displayIndex === finalIndex ? 80 : 64,
                fontWeight: displayIndex === finalIndex ? 800 : 700,
                color: displayIndex === finalIndex ? C.accent : C.white,
                height: wordHeight,
                display: "flex",
                alignItems: "center",
              }}
            >
              {words[displayIndex]}
            </div>

            {/* 次のワード */}
            {displayIndex < finalIndex && (
              <div
                style={{
                  fontFamily: font,
                  fontSize: nextIndex === finalIndex ? 80 : 64,
                  fontWeight: nextIndex === finalIndex ? 800 : 700,
                  color: nextIndex === finalIndex ? C.accent : C.white,
                  height: wordHeight,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {words[nextIndex]}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerSplitFlap ──

/**
 * RollerSplitFlap - スプリットフラップ（空港案内板風）
 */


export const RollerSplitFlap = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["PARIS", "LONDON", "TOKYO", "NEW YORK", "SYDNEY", "BERLIN"];
  const finalWord = "WELCOME";
  const allWords = [...words, finalWord];
  const t = frame - startDelay;

  // 各文字のフラップ
  const maxLength = Math.max(...allWords.map(w => w.length));
  const duration = 90;
  const wordDuration = duration / allWords.length;

  // 現在の単語インデックス
  const currentWordIndex = Math.min(
    Math.floor(t / wordDuration),
    allWords.length - 1
  );
  const currentWord = allWords[currentWordIndex].padEnd(maxLength, " ");
  const isFinal = currentWordIndex === allWords.length - 1;

  // 単語切り替え時のフラップアニメーション
  const wordProgress = (t % wordDuration) / wordDuration;
  const flapProgress = spring({
    frame: Math.floor(wordProgress * 15),
    fps,
    config: { damping: 20, stiffness: 400 },
  });

  return (
    <AbsoluteFill style={{ background: C.gray[900] }}>
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
            color: C.gray[600],
            letterSpacing: 4,
            marginBottom: 30,
          }}
        >
          DESTINATION
        </div>

        {/* フラップボード */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: C.black,
            padding: "20px 30px",
            borderRadius: 8,
          }}
        >
          {currentWord.split("").map((char, charIdx) => {
            // 各文字のフラップ遅延
            const charDelay = charIdx * 0.1;
            const charFlap = Math.max(0, flapProgress - charDelay);

            return (
              <div
                key={`flap-pos-${charIdx}-word-${currentWordIndex}`}
                style={{
                  width: 50,
                  height: 70,
                  background: C.gray[800],
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: font,
                  fontSize: 48,
                  fontWeight: 700,
                  color: isFinal ? C.warning : C.white,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {/* 中央の溝 */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 2,
                    background: C.black,
                    transform: "translateY(-50%)",
                    zIndex: 1,
                  }}
                />

                {/* 文字 */}
                <span
                  style={{
                    transform: `rotateX(${(1 - charFlap) * 90}deg)`,
                    transformOrigin: "center",
                  }}
                >
                  {char}
                </span>
              </div>
            );
          })}
        </div>

        {/* ステータス */}
        <div
          style={{
            marginTop: 30,
            fontFamily: font,
            fontSize: 16,
            color: isFinal ? C.success : C.gray[600],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {isFinal && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: C.success,
              }}
            />
          )}
          {isFinal ? "CONFIRMED" : "SEARCHING..."}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerTypewriter ──

/**
 * RollerTypewriter - タイプライター置換
 */


export const RollerTypewriter = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["amazing", "stunning", "powerful", "seamless"];
  const cycleDuration = 35;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const currentWord = words[currentIndex];
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const deleteEnd = 12;
  const typeStart = 15;

  let displayText = "";
  let showCursor = true;

  if (currentIndex >= finalIndex) {
    // 最終状態：全文字表示、カーソル点滅
    displayText = currentWord;
    showCursor = Math.floor(frame / 15) % 2 === 0;
  } else if (cycleT < deleteEnd) {
    const prevWord = words[Math.max(0, currentIndex - 1)];
    const charsToShow = Math.max(0, prevWord.length - Math.floor(cycleT * 1.2));
    displayText = prevWord.slice(0, charsToShow);
  } else if (cycleT >= typeStart) {
    const charsTyped = Math.min(currentWord.length, Math.floor((cycleT - typeStart) * 0.8));
    displayText = currentWord.slice(0, charsTyped);
    showCursor = charsTyped < currentWord.length || Math.floor(frame / 8) % 2 === 0;
  }

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
            fontFamily: font,
            fontSize: 48,
            fontWeight: 400,
            color: C.white,
          }}
        >
          Create something{" "}
          <span style={{ color: C.success }}>
            {displayText}
            {showCursor && (
              <span
                style={{
                  display: "inline-block",
                  width: 3,
                  height: 48,
                  background: C.success,
                  marginLeft: 2,
                  verticalAlign: "middle",
                }}
              />
            )}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerVerticalList ──

/**
 * RollerVerticalList - 縦スクロール（リスト風）
 */


export const RollerVerticalList = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Speed", "Quality", "Value", "Trust"];
  const itemHeight = 70;
  const cycleDuration = 25;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const scrollProgress = spring({ frame: t, fps, config: { damping: 20, stiffness: 80 } });

  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  const cycleProgress = spring({ frame: cycleT, fps, config: { damping: 15, stiffness: 200 } });

  const scrollY = currentIndex >= finalIndex
    ? finalIndex * itemHeight
    : currentIndex * itemHeight + cycleProgress * itemHeight;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 30,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 48,
            fontWeight: 300,
            color: C.gray[600],
          }}
        >
          We deliver
        </div>

        {/* スクロールウィンドウ */}
        <div
          style={{
            height: itemHeight,
            overflow: "hidden",
            position: "relative",
            opacity: scrollProgress,
          }}
        >
          {/* マスク（上下グラデーション） */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 15,
              background: `linear-gradient(${C.black}, transparent)`,
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 15,
              background: `linear-gradient(transparent, ${C.black})`,
              zIndex: 1,
            }}
          />

          {/* スクロールリスト */}
          <div
            style={{
              transform: `translateY(-${scrollY}px)`,
            }}
          >
            {[...words, ...words, ...words].map((word, i) => (
              <div
                key={`list-${i}-${word}`}
                style={{
                  height: itemHeight,
                  display: "flex",
                  alignItems: "center",
                  fontFamily: font,
                  fontSize: 48,
                  fontWeight: 700,
                  color: C.secondary,
                }}
              >
                {word}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── RollerWave ──

/**
 * RollerWave - 波形スライド
 */


export const RollerWave = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const words = ["Design", "Develop", "Deploy", "Delight"];
  const cycleDuration = 28;
  const finalIndex = words.length - 1;

  const t = frame - startDelay;
  const currentIndex = Math.min(Math.floor(t / cycleDuration), finalIndex);
  const currentWord = words[currentIndex];
  const cycleT = currentIndex >= finalIndex ? cycleDuration : t % cycleDuration;

  return (
    <AbsoluteFill style={{ background: "#1a1a2e" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: 15,
        }}
      >
        <div style={{ fontFamily: font, fontSize: 56, fontWeight: 300, color: C.gray[600] }}>
          We
        </div>

        <div style={{ display: "flex" }}>
          {currentWord.split("").map((char, i) => {
            const charDelay = i * 2;
            const enterY = lerp(cycleT - charDelay, [0, 10], [30, 0], EASE.out);
            const enterOpacity = lerp(cycleT - charDelay, [0, 10], [0, 1], EASE.out);

            const exitStart = cycleDuration - 10 + i * 1;
            const exitY = currentIndex >= finalIndex ? 0 : lerp(cycleT, [exitStart, cycleDuration], [0, -30], EASE.smooth);
            const exitOpacity = currentIndex >= finalIndex ? 1 : lerp(cycleT, [exitStart, cycleDuration], [1, 0], EASE.smooth);

            const y = currentIndex >= finalIndex ? 0 : (cycleT < cycleDuration - 10 ? enterY : exitY);
            const opacity = currentIndex >= finalIndex ? 1 : (cycleT < cycleDuration - 10 ? enterOpacity : exitOpacity);

            return (
              <div
                key={`wave-${currentIndex}-${i}-${char}`}
                style={{
                  fontFamily: font,
                  fontSize: 56,
                  fontWeight: 700,
                  color: "#8b5cf6",
                  transform: `translateY(${y}px)`,
                  opacity,
                }}
              >
                {char}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
