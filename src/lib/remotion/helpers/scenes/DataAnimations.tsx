// @ts-nocheck
// Adapted from remotion-scenes (MIT licensed)
// https://github.com/lifeprompt-team/remotion-scenes

import React from "react";

const C = { black: "#0a0a0a", white: "#fafafa", gray: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#0c0c0d" }, accent: "#6366f1", secondary: "#ec4899", tertiary: "#14b8a6", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444", orange: "#f97316", yellow: "#eab308", gold: "#fbbf24", red: "#dc2626", cyan: "#06b6d4" };
const font = "Inter, system-ui, sans-serif";
const lerp = (frame: number, range: [number, number], output: [number, number], easing?: (t: number) => number) => interpolate(frame, range, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const EASE = { out: Easing.bezier(0.16, 1, 0.3, 1), inFn: Easing.bezier(0.7, 0, 0.84, 0), inOut: Easing.bezier(0.87, 0, 0.13, 1), overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), snap: Easing.bezier(0.075, 0.82, 0.165, 1) };

// ── DataBarChart ──

/**
 * DataBarChart - バーチャート - 棒グラフ
 */


export const DataBarChart = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = [
    { label: "Mon", value: 65, color: C.accent },
    { label: "Tue", value: 85, color: C.accent },
    { label: "Wed", value: 45, color: C.accent },
    { label: "Thu", value: 92, color: C.accent },
    { label: "Fri", value: 78, color: C.accent },
    { label: "Sat", value: 55, color: C.gray[600] },
    { label: "Sun", value: 40, color: C.gray[600] },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950], padding: 60 }}>
      {/* タイトル */}
      <div
        style={{
          fontFamily: font,
          fontSize: 40,
          fontWeight: 700,
          color: C.white,
          marginBottom: 20,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        Weekly Activity
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 16,
          color: C.gray[500],
          marginBottom: 50,
          opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
        }}
      >
        User engagement metrics
      </div>

      {/* チャートエリア */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: 350,
          paddingBottom: 50,
          borderBottom: `1px solid ${C.gray[800]}`,
        }}
      >
        {data.map((item, i) => {
          const delay = startDelay + 20 + i * 5;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 100 },
          });

          const barHeight = (item.value / 100) * 280 * progress;

          return (
            <div
              key={`bar-${item.label}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 80,
              }}
            >
              {/* 値 */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 18,
                  fontWeight: 600,
                  color: C.white,
                  marginBottom: 10,
                  opacity: progress,
                }}
              >
                {Math.round(item.value * progress)}
              </div>

              {/* バー */}
              <div
                style={{
                  width: 50,
                  height: barHeight,
                  background: `linear-gradient(to top, ${item.color}, ${item.color}cc)`,
                  borderRadius: "6px 6px 0 0",
                }}
              />

              {/* ラベル */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 14,
                  color: C.gray[500],
                  marginTop: 15,
                  opacity: progress,
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* 凡例 */}
      <div
        style={{
          display: "flex",
          gap: 30,
          marginTop: 30,
          opacity: lerp(frame, [startDelay + 60, startDelay + 80], [0, 1]),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: C.accent, borderRadius: 2 }} />
          <span style={{ fontFamily: font, fontSize: 14, color: C.gray[500] }}>Weekday</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: C.gray[600], borderRadius: 2 }} />
          <span style={{ fontFamily: font, fontSize: 14, color: C.gray[500] }}>Weekend</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── DataGauge ──

/**
 * DataGauge - ゲージメーター - スピードメーター風
 */


export const DataGauge = ({ value = 78, maxValue = 100, startDelay = 0 }: {
  value?: number;
  maxValue?: number;
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const progress = lerp(frame, [startDelay, startDelay + 50], [0, value / maxValue], EASE.out);
  const angle = -135 + progress * 270; // -135度から+135度

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
        {/* 背景アーク */}
        <svg width={400} height={300} style={{ overflow: "visible" }} aria-hidden="true">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={C.success} />
              <stop offset="50%" stopColor={C.warning} />
              <stop offset="100%" stopColor={C.danger} />
            </linearGradient>
          </defs>

          {/* 背景トラック */}
          <path
            d="M 50 250 A 150 150 0 1 1 350 250"
            fill="none"
            stroke={C.gray[800]}
            strokeWidth={20}
            strokeLinecap="round"
          />

          {/* 進捗アーク */}
          <path
            d="M 50 250 A 150 150 0 1 1 350 250"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth={20}
            strokeLinecap="round"
            strokeDasharray={`${progress * 471} 471`}
          />

          {/* 目盛り */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const tickAngle = -135 + (tick / 100) * 270;
            const rad = (tickAngle * Math.PI) / 180;
            const x1 = 200 + 130 * Math.cos(rad);
            const y1 = 250 + 130 * Math.sin(rad);
            const x2 = 200 + 160 * Math.cos(rad);
            const y2 = 250 + 160 * Math.sin(rad);

            return (
              <g key={`tick-${tick}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.gray[600]} strokeWidth={2} />
                <text
                  x={200 + 180 * Math.cos(rad)}
                  y={250 + 180 * Math.sin(rad)}
                  textAnchor="middle"
                  fill={C.gray[500]}
                  fontSize={14}
                  fontFamily={font}
                >
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 針 */}
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 250,
            width: 4,
            height: 120,
            background: C.white,
            transformOrigin: "bottom center",
            transform: `translateX(-50%) rotate(${angle}deg)`,
            borderRadius: 2,
          }}
        />

        {/* 中央ドット */}
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 250,
            width: 20,
            height: 20,
            background: C.white,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* 値表示 */}
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 320,
            transform: "translateX(-50%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 64,
              fontWeight: 800,
              color: C.white,
            }}
          >
            {Math.round(progress * maxValue)}
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 18,
              color: C.gray[500],
            }}
          >
            Performance Score
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── DataLineChart ──

/**
 * DataLineChart - ラインチャート - 折れ線グラフ
 */


export const DataLineChart = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const dataPoints = [20, 45, 35, 60, 55, 80, 70, 95, 85, 100];
  const chartWidth = 900;
  const chartHeight = 300;

  const drawProgress = lerp(frame, [startDelay, startDelay + 60], [0, 1], EASE.out);

  const pointsToShow = Math.floor(dataPoints.length * drawProgress);

  const getX = (index: number) => (index / (dataPoints.length - 1)) * chartWidth;
  const getY = (value: number) => chartHeight - (value / 100) * chartHeight;

  // パス生成
  const linePath = dataPoints
    .slice(0, pointsToShow + 1)
    .map((value, i) => {
      const x = getX(i);
      const y = getY(value);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(" ");

  // エリアパス
  const areaPath =
    linePath +
    ` L ${getX(pointsToShow)} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <AbsoluteFill style={{ background: C.black, padding: 60 }}>
      {/* タイトル */}
      <div
        style={{
          fontFamily: font,
          fontSize: 40,
          fontWeight: 700,
          color: C.white,
          marginBottom: 10,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        Growth Trend
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 16,
          color: C.gray[500],
          marginBottom: 40,
          opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
        }}
      >
        Performance over time
      </div>

      {/* チャート */}
      <div style={{ position: "relative", marginLeft: 50 }}>
        {/* グリッド */}
        <svg
          width={chartWidth}
          height={chartHeight}
          style={{ position: "absolute" }}
          aria-hidden="true"
        >
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={`grid-${value}`}>
              <line
                x1={0}
                y1={getY(value)}
                x2={chartWidth}
                y2={getY(value)}
                stroke={C.gray[800]}
                strokeDasharray="4 4"
              />
              <text
                x={-40}
                y={getY(value) + 5}
                fill={C.gray[500]}
                fontSize={12}
                fontFamily={font}
              >
                {value}
              </text>
            </g>
          ))}
        </svg>

        {/* ライン */}
        <svg
          width={chartWidth}
          height={chartHeight}
          style={{ position: "relative", zIndex: 1 }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={C.accent} />
              <stop offset="100%" stopColor={C.secondary} />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.accent} stopOpacity="0.3" />
              <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* エリア */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* ライン */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ポイント */}
          {dataPoints.slice(0, pointsToShow + 1).map((value, i) => (
            <circle
              key={`point-${i}`}
              cx={getX(i)}
              cy={getY(value)}
              r={6}
              fill={C.accent}
              stroke={C.white}
              strokeWidth={2}
            />
          ))}
        </svg>

        {/* 現在値表示 */}
        {pointsToShow > 0 && (
          <div
            style={{
              position: "absolute",
              left: getX(pointsToShow) + 15,
              top: getY(dataPoints[pointsToShow]) - 30,
              fontFamily: font,
              fontSize: 24,
              fontWeight: 700,
              color: C.white,
              background: C.accent,
              padding: "4px 12px",
              borderRadius: 6,
            }}
          >
            {dataPoints[pointsToShow]}%
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ── DataPieChart ──

/**
 * DataPieChart - パイチャート - 円グラフ
 */


export const DataPieChart = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = [
    { label: "Product A", value: 35, color: C.accent },
    { label: "Product B", value: 25, color: C.secondary },
    { label: "Product C", value: 20, color: C.tertiary },
    { label: "Others", value: 20, color: C.gray[600] },
  ];

  const radius = 140;
  const cx = 200;
  const cy = 200;

  const entryProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  let currentAngle = -90;

  return (
    <AbsoluteFill style={{ background: C.gray[950], padding: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 100 }}>
        {/* パイチャート */}
        <svg width={400} height={400} aria-hidden="true">
          {data.map((item) => {
            const angle = (item.value / 100) * 360 * entryProgress;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = cx + radius * Math.cos(startRad);
            const y1 = cy + radius * Math.sin(startRad);
            const x2 = cx + radius * Math.cos(endRad);
            const y2 = cy + radius * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;

            const path = `
              M ${cx} ${cy}
              L ${x1} ${y1}
              A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
              Z
            `;

            return (
              <path
                key={`pie-${item.label}`}
                d={path}
                fill={item.color}
                stroke={C.gray[950]}
                strokeWidth={3}
              />
            );
          })}

          {/* 中央の穴（ドーナツ風） */}
          <circle cx={cx} cy={cy} r={70} fill={C.gray[950]} />

          {/* 中央テキスト */}
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            fill={C.white}
            fontSize={28}
            fontWeight="bold"
            fontFamily={font}
          >
            100%
          </text>
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            fill={C.gray[500]}
            fontSize={14}
            fontFamily={font}
          >
            Total
          </text>
        </svg>

        {/* 凡例 */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: font,
              fontSize: 32,
              fontWeight: 700,
              color: C.white,
              marginBottom: 30,
              opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
            }}
          >
            Market Share
          </div>

          {data.map((item, i) => {
            const delay = startDelay + 20 + i * 8;
            const opacity = lerp(frame, [delay, delay + 15], [0, 1]);

            return (
              <div
                key={`legend-${item.label}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 20,
                  opacity,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    background: item.color,
                    borderRadius: 4,
                    marginRight: 15,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: font,
                      fontSize: 18,
                      color: C.white,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 24,
                    fontWeight: 700,
                    color: C.white,
                  }}
                >
                  {Math.round(item.value * entryProgress)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── DataProgressBars ──

/**
 * DataProgressBars - プログレスバー - 複数のプログレス
 */


export const DataProgressBars = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();

  const items = [
    { label: "JavaScript", value: 92, color: C.warning },
    { label: "TypeScript", value: 85, color: C.accent },
    { label: "React", value: 88, color: C.secondary },
    { label: "Node.js", value: 75, color: C.success },
    { label: "Python", value: 65, color: C.tertiary },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950], padding: 80 }}>
      {/* タイトル */}
      <div
        style={{
          fontFamily: font,
          fontSize: 48,
          fontWeight: 700,
          color: C.white,
          marginBottom: 60,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        Skills
      </div>

      {/* プログレスバー */}
      {items.map((item, i) => {
        const delay = startDelay + 20 + i * 10;
        const labelOpacity = lerp(frame, [delay, delay + 15], [0, 1]);
        const barProgress = lerp(frame, [delay + 5, delay + 45], [0, item.value], EASE.out);

        return (
          <div key={`progress-${item.label}`} style={{ marginBottom: 35 }}>
            {/* ラベル行 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                opacity: labelOpacity,
              }}
            >
              <div
                style={{
                  fontFamily: font,
                  fontSize: 20,
                  color: C.white,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: font,
                  fontSize: 20,
                  fontWeight: 600,
                  color: C.white,
                }}
              >
                {Math.round(barProgress)}%
              </div>
            </div>

            {/* バー */}
            <div
              style={{
                height: 12,
                background: C.gray[800],
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${barProgress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${item.color}, ${item.color}aa)`,
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── DataRanking ──

/**
 * DataRanking - ランキング - リストアニメーション
 */


export const DataRanking = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { rank: 1, name: "Tokyo", value: "37.4M", change: "up" },
    { rank: 2, name: "Delhi", value: "32.9M", change: "up" },
    { rank: 3, name: "Shanghai", value: "29.2M", change: "down" },
    { rank: 4, name: "São Paulo", value: "22.4M", change: "same" },
    { rank: 5, name: "Mexico City", value: "21.9M", change: "up" },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray[950], padding: 60 }}>
      {/* タイトル */}
      <div
        style={{
          fontFamily: font,
          fontSize: 40,
          fontWeight: 700,
          color: C.white,
          marginBottom: 15,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        Top Cities
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 16,
          color: C.gray[500],
          marginBottom: 40,
          opacity: lerp(frame, [startDelay + 10, startDelay + 30], [0, 1]),
        }}
      >
        By population (2024)
      </div>

      {/* リスト */}
      {items.map((item, i) => {
        const delay = startDelay + 25 + i * 8;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 15, stiffness: 150 },
        });

        const changeIcon =
          item.change === "up" ? "↑" : item.change === "down" ? "↓" : "→";
        const changeColor =
          item.change === "up"
            ? C.success
            : item.change === "down"
            ? C.danger
            : C.gray[500];

        return (
          <div
            key={`rank-${item.rank}`}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "20px 30px",
              marginBottom: 15,
              background: i === 0 ? C.accent : C.gray[900],
              borderRadius: 12,
              transform: `translateX(${(1 - progress) * 100}px)`,
              opacity: progress,
            }}
          >
            {/* 順位 */}
            <div
              style={{
                fontFamily: font,
                fontSize: 32,
                fontWeight: 800,
                color: i === 0 ? C.white : C.gray[500],
                width: 60,
              }}
            >
              #{item.rank}
            </div>

            {/* 名前 */}
            <div
              style={{
                flex: 1,
                fontFamily: font,
                fontSize: 24,
                fontWeight: 600,
                color: C.white,
              }}
            >
              {item.name}
            </div>

            {/* 変動 */}
            <div
              style={{
                fontFamily: font,
                fontSize: 20,
                color: changeColor,
                marginRight: 30,
              }}
            >
              {changeIcon}
            </div>

            {/* 値 */}
            <div
              style={{
                fontFamily: font,
                fontSize: 24,
                fontWeight: 700,
                color: C.white,
              }}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── DataStatsCards ──

/**
 * DataStatsCards - スタッツカード - 統計カード（非対称レイアウト）
 */


export const DataStatsCards = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // メイン数値のアニメーション
  const mainProgress = spring({
    frame: frame - startDelay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const subProgress = spring({
    frame: frame - startDelay - 15,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const countProgress = lerp(frame, [startDelay + 10, startDelay + 50], [0, 1], EASE.out);
  const mainValue = Math.floor(89420 * countProgress).toLocaleString();

  return (
    <AbsoluteFill style={{ background: C.gray[950] }}>
      {/* 左側：メイン統計（大きく表示） */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: "50%",
          transform: `translateY(-50%) translateX(${(1 - mainProgress) * -80}px)`,
          opacity: mainProgress,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 12,
            color: C.gray[600],
            letterSpacing: 3,
            marginBottom: 20,
          }}
        >
          TOTAL REVENUE
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 800,
            color: C.white,
            lineHeight: 0.9,
            letterSpacing: -5,
          }}
        >
          ${mainValue}
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            color: C.success,
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>↑</span>
          <span>12.5% from last quarter</span>
        </div>
      </div>

      {/* 右側：サブ統計（小さめ、縦積み） */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 120,
          width: 280,
          opacity: subProgress,
          transform: `translateY(${(1 - subProgress) * 40}px)`,
        }}
      >
        {/* サブ統計1 */}
        <div
          style={{
            borderLeft: `2px solid ${C.accent}`,
            paddingLeft: 20,
            marginBottom: 50,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              color: C.gray[600],
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            ACTIVE USERS
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 36,
              fontWeight: 700,
              color: C.white,
            }}
          >
            24,580
          </div>
        </div>

        {/* サブ統計2 */}
        <div
          style={{
            borderLeft: `2px solid ${C.secondary}`,
            paddingLeft: 20,
            marginBottom: 50,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              color: C.gray[600],
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            CONVERSION
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 36,
              fontWeight: 700,
              color: C.white,
            }}
          >
            4.8%
          </div>
        </div>

        {/* サブ統計3 */}
        <div
          style={{
            borderLeft: `2px solid ${C.tertiary}`,
            paddingLeft: 20,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              color: C.gray[600],
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            ONLINE NOW
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 36,
              fontWeight: 700,
              color: C.white,
            }}
          >
            1,847
          </div>
        </div>
      </div>

      {/* 下部の装飾ライン */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 60,
          width: lerp(frame, [startDelay + 30, startDelay + 60], [0, 400]),
          height: 1,
          background: C.gray[800],
        }}
      />

      {/* 右下の番号 */}
      <div
        style={{
          position: "absolute",
          right: 80,
          bottom: 60,
          fontFamily: font,
          fontSize: 11,
          color: C.gray[700],
          letterSpacing: 2,
          opacity: subProgress,
        }}
      >
        Q4 2024 — OVERVIEW
      </div>
    </AbsoluteFill>
  );
};

// ── DataTimeline ──

/**
 * DataTimeline - タイムライン - 時系列表示
 */


export const DataTimeline = ({ startDelay = 0 }: {
  startDelay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const events = [
    { year: "2020", title: "Founded", desc: "Company established" },
    { year: "2021", title: "Series A", desc: "$10M funding raised" },
    { year: "2022", title: "Global", desc: "Expanded to 20 countries" },
    { year: "2023", title: "IPO", desc: "Public listing" },
    { year: "2024", title: "100M Users", desc: "Major milestone" },
  ];

  return (
    <AbsoluteFill style={{ background: C.black, padding: 60 }}>
      {/* タイトル */}
      <div
        style={{
          fontFamily: font,
          fontSize: 40,
          fontWeight: 700,
          color: C.white,
          marginBottom: 60,
          opacity: lerp(frame, [startDelay, startDelay + 20], [0, 1]),
        }}
      >
        Our Journey
      </div>

      {/* タイムライン */}
      <div style={{ position: "relative", marginLeft: 100 }}>
        {/* 縦線 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 3,
            height: lerp(frame, [startDelay, startDelay + 80], [0, events.length * 100 - 20]),
            background: `linear-gradient(to bottom, ${C.accent}, ${C.secondary})`,
          }}
        />

        {/* イベント */}
        {events.map((event, i) => {
          const delay = startDelay + 15 + i * 12;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 150 },
          });

          return (
            <div
              key={`timeline-${event.year}`}
              style={{
                position: "relative",
                marginBottom: 60,
                paddingLeft: 50,
                transform: `translateX(${(1 - progress) * 50}px)`,
                opacity: progress,
              }}
            >
              {/* ドット */}
              <div
                style={{
                  position: "absolute",
                  left: -8,
                  top: 8,
                  width: 20,
                  height: 20,
                  background: C.accent,
                  borderRadius: "50%",
                  border: `3px solid ${C.black}`,
                  transform: `scale(${progress})`,
                }}
              />

              {/* 年 */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 14,
                  color: C.accent,
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                {event.year}
              </div>

              {/* タイトル */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 28,
                  fontWeight: 700,
                  color: C.white,
                  marginBottom: 8,
                }}
              >
                {event.title}
              </div>

              {/* 説明 */}
              <div
                style={{
                  fontFamily: font,
                  fontSize: 16,
                  color: C.gray[500],
                }}
              >
                {event.desc}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
