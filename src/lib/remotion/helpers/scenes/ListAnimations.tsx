// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random, Easing } from "remotion";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── ListAsymmetric3 ──

/**
 * ListAsymmetric3 - 非対称3要素（1大+2小）- 最重要を大きく
 */


export const ListAsymmetric3 = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const sub1Progress = spring({
    frame: frame - startDelay - 20,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const sub2Progress = spring({
    frame: frame - startDelay - 30,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* メイン要素（大きく、左寄り） */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 100,
          width: 600,
          transform: `translateX(${(1 - mainProgress) * -80}px)`,
          opacity: mainProgress,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 14,
            color: C.accent,
            letterSpacing: 3,
            marginBottom: 20,
          }}
        >
          01 — PRIMARY
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 700,
            color: C.white,
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          Speed &amp;
          <br />
          Performance
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            color: C.gray[400],
            lineHeight: 1.7,
            maxWidth: 400,
          }}
        >
          10x faster than traditional solutions with optimized algorithms.
        </div>
      </div>

      {/* サブ要素1（右上、小さめ） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 120,
          width: 280,
          borderLeft: `2px solid ${C.gray[800]}`,
          paddingLeft: 25,
          transform: `translateY(${(1 - sub1Progress) * 30}px)`,
          opacity: sub1Progress,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 11,
            color: C.gray[600],
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          02
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            fontWeight: 600,
            color: C.white,
            marginBottom: 8,
          }}
        >
          Security
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 13,
            color: C.gray[500],
            lineHeight: 1.6,
          }}
        >
          Enterprise-grade encryption and compliance.
        </div>
      </div>

      {/* サブ要素2（右下、小さめ） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 320,
          width: 280,
          borderLeft: `2px solid ${C.gray[800]}`,
          paddingLeft: 25,
          transform: `translateY(${(1 - sub2Progress) * 30}px)`,
          opacity: sub2Progress,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 11,
            color: C.gray[600],
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          03
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 20,
            fontWeight: 600,
            color: C.white,
            marginBottom: 8,
          }}
        >
          Scalability
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 13,
            color: C.gray[500],
            lineHeight: 1.6,
          }}
        >
          From startup to enterprise, grow without limits.
        </div>
      </div>

      {/* 下部装飾ライン */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          width: lerp(frame, [startDelay + 40, startDelay + 70], [0, 500], EASE.out),
          height: 1,
          background: C.gray[800],
        }}
      />
    </AbsoluteFill>
  );
};

// ── ListFullscreenSequence ──

/**
 * ListFullscreenSequence - フルスクリーン順次表示（1要素ずつ）
 */


export const ListFullscreenSequence = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const items = [
    { num: "01", text: "INNOVATE", color: C.accent },
    { num: "02", text: "CREATE", color: C.secondary },
    { num: "03", text: "DELIVER", color: C.tertiary },
  ];

  // 各シーンの時間
  const sceneDuration = 30;

  // 現在のシーン
  const sceneIndex = Math.min(
    Math.floor((frame - startDelay) / sceneDuration),
    items.length - 1
  );

  const sceneFrame = (frame - startDelay) % sceneDuration;
  const currentItem = items[Math.max(0, sceneIndex)];

  const enterProgress = lerp(sceneFrame, [0, 15], [0, 1], EASE.out);
  const exitProgress = lerp(sceneFrame, [20, 30], [1, 0], EASE.out);
  const progress = Math.min(enterProgress, exitProgress);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* メインテキスト */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: "50%",
          transform: `translateY(-50%) translateX(${(1 - progress) * -100}px)`,
          opacity: progress,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 14,
            color: C.gray[600],
            letterSpacing: 4,
            marginBottom: 20,
          }}
        >
          STEP {currentItem.num}
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 140,
            fontWeight: 900,
            color: currentItem.color,
            lineHeight: 0.9,
            letterSpacing: -5,
          }}
        >
          {currentItem.text}
        </div>
      </div>

      {/* 進捗インジケーター */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          display: "flex",
          gap: 8,
        }}
      >
        {items.map((item, i) => (
          <div
            key={`indicator-${item.num}`}
            style={{
              width: i === sceneIndex ? 40 : 20,
              height: 4,
              background: i === sceneIndex ? currentItem.color : C.gray[800],
              borderRadius: 2,
              transition: "width 0.3s, background 0.3s",
            }}
          />
        ))}
      </div>

      {/* 右側の番号（大きく薄く） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 200,
          fontWeight: 100,
          color: C.gray[900],
          opacity: progress,
        }}
      >
        {currentItem.num}
      </div>
    </AbsoluteFill>
  );
};

// ── ListHeroWithList ──

/**
 * ListHeroWithList - 強調1つ + リスト
 */


export const ListHeroWithList = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heroProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const listItems = ["Fast", "Secure", "Reliable"];

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* ヒーロー（メイン強調） */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 100,
          transform: `translateX(${(1 - heroProgress) * -80}px)`,
          opacity: heroProgress,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: C.white,
            lineHeight: 0.9,
            letterSpacing: -5,
          }}
        >
          BUILD
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 900,
            color: C.accent,
            lineHeight: 0.9,
            letterSpacing: -5,
          }}
        >
          BETTER
        </div>
      </div>

      {/* サブリスト（右下に小さく） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 120,
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 11,
            color: C.gray[600],
            letterSpacing: 3,
            marginBottom: 20,
            opacity: lerp(frame, [startDelay + 30, startDelay + 45], [0, 1]),
          }}
        >
          WHAT WE OFFER
        </div>

        {listItems.map((item, i) => {
          const delay = startDelay + 35 + i * 10;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`hero-list-${item}`}
              style={{
                fontFamily: font,
                fontSize: 20,
                color: i === 0 ? C.white : C.gray[500],
                marginBottom: 12,
                transform: `translateX(${(1 - progress) * 30}px)`,
                opacity: progress,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* 装飾ライン */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 80,
          width: lerp(frame, [startDelay + 20, startDelay + 50], [0, 300], EASE.out),
          height: 1,
          background: C.gray[800],
        }}
      />
    </AbsoluteFill>
  );
};

// ── ListHorizontalPeek ──

/**
 * ListHorizontalPeek - 横スクロール風（見切れ表現）
 */


export const ListHorizontalPeek = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { num: "01", title: "Design", highlighted: true },
    { num: "02", title: "Develop", highlighted: false },
    { num: "03", title: "Deploy", highlighted: false },
  ];

  // 横スライド
  const slideX = lerp(frame, [startDelay + 30, startDelay + 70], [0, -100], EASE.smooth);

  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 100,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 14,
            color: C.gray[600],
            letterSpacing: 3,
          }}
        >
          WORKFLOW
        </div>
      </div>

      {/* 横並びカード（一部見切れ） */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 180,
          display: "flex",
          gap: 30,
          transform: `translateX(${slideX}px)`,
        }}
      >
        {items.map((item, i) => {
          const delay = startDelay + i * 10;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`horiz-${item.num}`}
              style={{
                width: 350,
                height: 400,
                background: item.highlighted ? C.accent : C.gray[900],
                borderRadius: 16,
                padding: 40,
                flexShrink: 0,
                transform: `translateY(${(1 - progress) * 50}px)`,
                opacity: progress,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: font,
                  fontSize: 80,
                  fontWeight: 200,
                  color: item.highlighted ? C.white : C.gray[700],
                }}
              >
                {item.num}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 36,
                    fontWeight: 700,
                    color: C.white,
                    marginBottom: 15,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 14,
                    color: item.highlighted ? `${C.white}aa` : C.gray[500],
                    lineHeight: 1.6,
                  }}
                >
                  Professional {item.title.toLowerCase()} services tailored to your needs.
                </div>
              </div>
            </div>
          );
        })}

        {/* 見切れ用の4枚目（薄く） */}
        <div
          style={{
            width: 350,
            height: 400,
            background: C.gray[900],
            borderRadius: 16,
            opacity: 0.5,
            flexShrink: 0,
          }}
        />
      </div>

      {/* スクロールヒント */}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 0.5]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            color: C.gray[600],
          }}
        >
          →
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── ListMinimalLeft ──

/**
 * ListMinimalLeft - 左寄せミニマルリスト
 */


export const ListMinimalLeft = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    "Faster development cycles",
    "Reduced operational costs",
    "Improved team collaboration",
  ];

  return (
    <AbsoluteFill style={{ background: C.white }}>
      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 100,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 48,
            fontWeight: 700,
            color: C.black,
            marginBottom: 10,
          }}
        >
          Benefits
        </div>
        <div
          style={{
            width: 60,
            height: 4,
            background: C.accent,
          }}
        />
      </div>

      {/* リスト */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 220,
        }}
      >
        {items.map((item, i) => {
          const delay = startDelay + 20 + i * 12;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`minimal-${i}-${item.slice(0, 10)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 25,
                marginBottom: 35,
                transform: `translateX(${(1 - progress) * -40}px)`,
                opacity: progress,
              }}
            >
              {/* ダッシュ */}
              <div
                style={{
                  width: 30,
                  height: 2,
                  background: i === 0 ? C.accent : C.gray[300],
                }}
              />

              {/* テキスト */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 24,
                  fontWeight: i === 0 ? 600 : 400,
                  color: i === 0 ? C.black : C.gray[600],
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>

      {/* 右下の装飾 */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 150,
          fontWeight: 100,
          color: C.gray[200],
          opacity: lerp(frame, [startDelay + 40, startDelay + 60], [0, 1]),
        }}
      >
        3
      </div>
    </AbsoluteFill>
  );
};

// ── ListNumberedVertical ──

/**
 * ListNumberedVertical - 縦積み番号リスト（左揃え、番号強調）
 */


export const ListNumberedVertical = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { num: "01", text: "Understand your needs" },
    { num: "02", text: "Design the solution" },
    { num: "03", text: "Build and iterate" },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 80,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 11,
            color: C.gray[600],
            letterSpacing: 3,
            marginBottom: 15,
          }}
        >
          OUR PROCESS
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 700,
            color: C.white,
          }}
        >
          Three Steps
        </div>
      </div>

      {/* リスト */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 220,
          display: "flex",
          flexDirection: "column",
          gap: 50,
        }}
      >
        {items.map((item, i) => {
          const delay = startDelay + 25 + i * 15;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`numbered-${item.num}`}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 40,
                transform: `translateX(${(1 - progress) * -50}px)`,
                opacity: progress,
              }}
            >
              {/* 番号（大きく薄く） */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 80,
                  fontWeight: 200,
                  color: i === 0 ? C.accent : C.gray[800],
                  lineHeight: 1,
                  width: 120,
                }}
              >
                {item.num}
              </div>

              {/* テキスト */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 28,
                  fontWeight: i === 0 ? 600 : 400,
                  color: i === 0 ? C.white : C.gray[400],
                }}
              >
                {item.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* 右側の縦線装飾 */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: 100,
          width: 1,
          height: lerp(frame, [startDelay + 50, startDelay + 90], [0, 400], EASE.out),
          background: C.gray[800],
        }}
      />
    </AbsoluteFill>
  );
};

// ── ListSimpleText ──

/**
 * ListSimpleText - アイコンなしシンプルリスト
 */


export const ListSimpleText = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    "Intuitive interface",
    "Powerful automation",
    "Seamless integration",
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        {items.map((item, i) => {
          const delay = startDelay + i * 20;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 18, stiffness: 120 },
          });

          return (
            <div
              key={`simple-${i}-${item.slice(0, 8)}`}
              style={{
                marginBottom: i < items.length - 1 ? 25 : 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: font,
                  fontSize: i === 0 ? 60 : 48,
                  fontWeight: i === 0 ? 700 : 400,
                  color: i === 0 ? C.white : C.gray[600],
                  transform: `translateY(${(1 - progress) * 100}%)`,
                }}
              >
                {item}
              </div>
            </div>
          );
        })}

        {/* アクセントライン */}
        <div
          style={{
            width: lerp(frame, [startDelay + 50, startDelay + 70], [0, 80], EASE.out),
            height: 4,
            background: C.accent,
            marginTop: 40,
          }}
        />
      </div>

      {/* 右側の番号表示 */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: "50%",
          transform: "translateY(-50%)",
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 200,
            fontWeight: 100,
            color: C.gray[900],
            lineHeight: 0.8,
            opacity: lerp(frame, [startDelay, startDelay + 40], [0, 1]),
          }}
        >
          03
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 12,
            color: C.gray[700],
            letterSpacing: 3,
            marginTop: 20,
            opacity: lerp(frame, [startDelay + 20, startDelay + 40], [0, 1]),
          }}
        >
          KEY FEATURES
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── ListStaggered ──

/**
 * ListStaggered - ジグザグ/スタッガード配置
 */


export const ListStaggered = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { title: "Research", desc: "Deep market analysis", align: "left", top: 100 },
    { title: "Strategy", desc: "Data-driven planning", align: "right", top: 220 },
    { title: "Execute", desc: "Rapid implementation", align: "left", top: 340 },
  ];

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {items.map((item, i) => {
        const delay = startDelay + i * 20;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 18, stiffness: 120 },
        });

        const isLeft = item.align === "left";

        return (
          <div
            key={`stagger-${item.title}`}
            style={{
              position: "absolute",
              [isLeft ? "left" : "right"]: 100,
              top: item.top,
              textAlign: isLeft ? "left" : "right",
              transform: `translateX(${(1 - progress) * (isLeft ? -60 : 60)}px)`,
              opacity: progress,
            }}
          >
            {/* 番号 */}
            <div
              style={{
                fontFamily: font,
                fontSize: 12,
                color: C.gray[600],
                letterSpacing: 2,
                marginBottom: 10,
              }}
            >
              0{i + 1}
            </div>

            {/* タイトル */}
            <div
              style={{
                fontFamily: font,
                fontSize: 48,
                fontWeight: 700,
                color: C.white,
                marginBottom: 10,
              }}
            >
              {item.title}
            </div>

            {/* 説明 */}
            <div
              style={{
                fontFamily: font,
                fontSize: 16,
                color: C.gray[500],
              }}
            >
              {item.desc}
            </div>

            {/* アンダーライン */}
            <div
              style={{
                width: lerp(frame, [delay + 10, delay + 30], [0, 150], EASE.out),
                height: 2,
                background: i === 0 ? C.accent : C.gray[700],
                marginTop: 20,
                [isLeft ? "marginLeft" : "marginRight"]: 0,
                [isLeft ? "marginRight" : "marginLeft"]: "auto",
              }}
            />
          </div>
        );
      })}

      {/* 中央縦線 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 80,
          width: 1,
          height: lerp(frame, [startDelay, startDelay + 60], [0, 400], EASE.out),
          background: C.gray[900],
          transform: "translateX(-50%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ── ListStatsFocused ──

/**
 * ListStatsFocused - 数字強調型（統計リスト）
 */


export const ListStatsFocused = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stats = [
    { value: "99.9", unit: "%", label: "Uptime" },
    { value: "50", unit: "ms", label: "Latency" },
    { value: "10", unit: "x", label: "Faster" },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 最初の統計（大きく左に） */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 120,
          opacity: lerp(frame, [startDelay, startDelay + 25], [0, 1], EASE.out),
          transform: `translateX(${lerp(frame, [startDelay, startDelay + 25], [-50, 0], EASE.out)}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span
            style={{
              fontFamily: font,
              fontSize: 150,
              fontWeight: 800,
              color: C.white,
              lineHeight: 1,
            }}
          >
            {stats[0].value}
          </span>
          <span
            style={{
              fontFamily: font,
              fontSize: 60,
              fontWeight: 300,
              color: C.accent,
              marginLeft: 10,
            }}
          >
            {stats[0].unit}
          </span>
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 18,
            color: C.gray[500],
            marginTop: 10,
            letterSpacing: 2,
          }}
        >
          {stats[0].label}
        </div>
      </div>

      {/* 残りの統計（右側に小さく縦並び） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 150,
          display: "flex",
          flexDirection: "column",
          gap: 60,
        }}
      >
        {stats.slice(1).map((stat, i) => {
          const delay = startDelay + 30 + i * 15;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`stat-${stat.label}`}
              style={{
                textAlign: "right",
                borderRight: `2px solid ${C.gray[800]}`,
                paddingRight: 25,
                transform: `translateY(${(1 - progress) * 30}px)`,
                opacity: progress,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end" }}>
                <span
                  style={{
                    fontFamily: font,
                    fontSize: 56,
                    fontWeight: 700,
                    color: C.white,
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontFamily: font,
                    fontSize: 24,
                    fontWeight: 300,
                    color: C.gray[500],
                    marginLeft: 5,
                  }}
                >
                  {stat.unit}
                </span>
              </div>
              <div
                style={{
                  fontFamily: font,
                  fontSize: 13,
                  color: C.gray[600],
                  letterSpacing: 1,
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* 下部ライン */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 100,
          width: lerp(frame, [startDelay + 50, startDelay + 80], [0, 600], EASE.out),
          height: 1,
          background: C.gray[800],
        }}
      />
    </AbsoluteFill>
  );
};

// ── ListTimeline ──

/**
 * ListTimeline - タイムライン風縦リスト
 */


export const ListTimeline = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { year: "2022", title: "Foundation", desc: "Company established" },
    { year: "2023", title: "Growth", desc: "Series A funding" },
    { year: "2024", title: "Scale", desc: "Global expansion" },
  ];

  // タイムラインの線のアニメーション
  const lineProgress = lerp(frame, [startDelay, startDelay + 80], [0, 100], EASE.out);

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 80,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 12,
            color: C.gray[600],
            letterSpacing: 3,
            marginBottom: 10,
          }}
        >
          OUR JOURNEY
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 32,
            fontWeight: 700,
            color: C.white,
          }}
        >
          Timeline
        </div>
      </div>

      {/* タイムライン */}
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 200,
        }}
      >
        {/* 縦線 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 2,
            height: `${lineProgress}%`,
            maxHeight: 350,
            background: C.gray[800],
          }}
        />

        {items.map((item, i) => {
          const delay = startDelay + 20 + i * 25;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`timeline-${item.year}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: 80,
                opacity: progress,
                transform: `translateX(${(1 - progress) * 30}px)`,
              }}
            >
              {/* ドット */}
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: i === items.length - 1 ? C.accent : C.gray[700],
                  border: `2px solid ${C.black}`,
                  marginLeft: -5,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />

              {/* コンテンツ */}
              <div style={{ marginLeft: 40 }}>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 14,
                    color: i === items.length - 1 ? C.accent : C.gray[600],
                    marginBottom: 8,
                  }}
                >
                  {item.year}
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 24,
                    fontWeight: 600,
                    color: C.white,
                    marginBottom: 6,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 14,
                    color: C.gray[500],
                  }}
                >
                  {item.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 右側の年（大きく） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 80,
          fontFamily: font,
          fontSize: 180,
          fontWeight: 100,
          color: C.gray[900],
          opacity: lerp(frame, [startDelay + 60, startDelay + 80], [0, 1]),
        }}
      >
        24
      </div>
    </AbsoluteFill>
  );
};

// ── ListTwoColumnCompare ──

/**
 * ListTwoColumnCompare - 特徴比較（2カラム）
 */


export const ListTwoColumnCompare = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftItems = ["Speed", "Security", "Support"];
  const rightValues = ["10x faster", "Enterprise-grade", "24/7 available"];

  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* タイトル */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 40,
            fontWeight: 700,
            color: C.white,
          }}
        >
          Why Choose Us
        </div>
      </div>

      {/* 2カラムリスト */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 200,
          right: 100,
        }}
      >
        {leftItems.map((item, i) => {
          const delay = startDelay + 25 + i * 15;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`compare-${item}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "30px 0",
                borderBottom: i < leftItems.length - 1 ? `1px solid ${C.gray[800]}` : "none",
                transform: `translateY(${(1 - progress) * 20}px)`,
                opacity: progress,
              }}
            >
              {/* 左カラム（ラベル） */}
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 14,
                    color: C.gray[600],
                  }}
                >
                  0{i + 1}
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 22,
                    fontWeight: 500,
                    color: C.gray[400],
                  }}
                >
                  {item}
                </div>
              </div>

              {/* 右カラム（値） */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 22,
                  fontWeight: 600,
                  color: i === 0 ? C.accent : C.white,
                }}
              >
                {rightValues[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* 下部装飾 */}
      <div
        style={{
          position: "absolute",
          left: 100,
          bottom: 80,
          width: lerp(frame, [startDelay + 60, startDelay + 90], [0, 200], EASE.out),
          height: 4,
          background: C.accent,
        }}
      />
    </AbsoluteFill>
  );
};

// ── ListUnevenGrid ──

/**
 * ListUnevenGrid - 非均等グリッド（1大+2小）
 */


export const ListUnevenGrid = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const sub1Progress = spring({
    frame: frame - startDelay - 15,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const sub2Progress = spring({
    frame: frame - startDelay - 25,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 60,
          right: 60,
          bottom: 60,
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 20,
        }}
      >
        {/* メインカード（2行占有） */}
        <div
          style={{
            gridRow: "1 / 3",
            background: C.gray[900],
            borderRadius: 12,
            padding: 40,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transform: `scale(${mainProgress})`,
            opacity: mainProgress,
            transformOrigin: "left center",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: font,
                fontSize: 12,
                color: C.accent,
                letterSpacing: 3,
                marginBottom: 20,
              }}
            >
              FEATURED
            </div>
            <div
              style={{
                fontFamily: font,
                fontSize: 48,
                fontWeight: 700,
                color: C.white,
                lineHeight: 1.1,
              }}
            >
              Enterprise
              <br />
              Solutions
            </div>
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 16,
              color: C.gray[400],
              maxWidth: 400,
              lineHeight: 1.7,
            }}
          >
            Comprehensive platform designed for large-scale operations and complex workflows.
          </div>
        </div>

        {/* サブカード1 */}
        <div
          style={{
            background: C.gray[900],
            borderRadius: 12,
            padding: 30,
            transform: `translateY(${(1 - sub1Progress) * 30}px)`,
            opacity: sub1Progress,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              color: C.gray[600],
              letterSpacing: 2,
              marginBottom: 15,
            }}
          >
            OPTION 02
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 24,
              fontWeight: 600,
              color: C.white,
              marginBottom: 10,
            }}
          >
            Startup
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 14,
              color: C.gray[500],
            }}
          >
            Perfect for growing teams
          </div>
        </div>

        {/* サブカード2 */}
        <div
          style={{
            background: C.gray[900],
            borderRadius: 12,
            padding: 30,
            transform: `translateY(${(1 - sub2Progress) * 30}px)`,
            opacity: sub2Progress,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              color: C.gray[600],
              letterSpacing: 2,
              marginBottom: 15,
            }}
          >
            OPTION 03
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 24,
              fontWeight: 600,
              color: C.white,
              marginBottom: 10,
            }}
          >
            Individual
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 14,
              color: C.gray[500],
            }}
          >
            For solo professionals
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
