import { useMemo } from "react";
import type { CaptionLine, CaptionStyle, CaptionTrack, CaptionWord } from "@/lib/ai/types";

interface CaptionOverlayProps {
	captionTrack: CaptionTrack | null;
	captionStyle: CaptionStyle;
	/** Current playback time in seconds */
	currentTime: number;
	containerWidth: number;
	containerHeight: number;
}

/** Find the active caption line for a given time (in ms) */
function findActiveLine(track: CaptionTrack, timeMs: number): CaptionLine | null {
	for (const line of track.lines) {
		if (timeMs >= line.startMs && timeMs <= line.endMs) {
			return line;
		}
	}
	return null;
}

/** Calculate position styles based on the caption position setting */
function getPositionStyles(position: CaptionStyle["position"]): React.CSSProperties {
	switch (position) {
		case "top":
			return { top: "8%", bottom: "auto" };
		case "center":
			return { top: "50%", transform: "translateX(-50%) translateY(-50%)" };
		case "bottom":
		default:
			return { bottom: "8%", top: "auto" };
	}
}

/** Render words with animation */
function renderWords(words: CaptionWord[], timeMs: number, style: CaptionStyle): React.ReactNode[] {
	return words.map((word, i) => {
		const isActive = timeMs >= word.startMs && timeMs <= word.endMs;
		const isPast = timeMs > word.endMs;

		let wordStyle: React.CSSProperties = {};

		if (style.animation === "word-highlight") {
			wordStyle = {
				color: isActive ? style.activeWordColor : style.fontColor,
				transition: "color 0.15s ease",
			};
		} else if (style.animation === "fade-in") {
			const isFuture = timeMs < word.startMs;
			wordStyle = {
				opacity: isFuture ? 0.3 : isPast || isActive ? 1 : 0.3,
				transition: "opacity 0.2s ease",
			};
		}

		return (
			<span key={`${word.startMs}-${i}`} style={wordStyle}>
				{word.text}
				{i < words.length - 1 ? " " : ""}
			</span>
		);
	});
}

export function CaptionOverlay({
	captionTrack,
	captionStyle,
	currentTime,
	containerWidth,
	containerHeight,
}: CaptionOverlayProps) {
	const timeMs = Math.round(currentTime * 1000);

	const activeLine = useMemo(() => {
		if (!captionTrack) return null;
		return findActiveLine(captionTrack, timeMs);
	}, [captionTrack, timeMs]);

	if (!captionTrack || !activeLine) {
		return null;
	}

	// Scale font size relative to container height (designed for 1080p)
	const scaleFactor = containerHeight / 1080;
	const scaledFontSize = Math.round(captionStyle.fontSize * scaleFactor);

	const positionStyles = getPositionStyles(captionStyle.position);

	const bgColor = captionStyle.backgroundColor;
	const bgOpacity = captionStyle.backgroundOpacity;
	// Parse hex color to rgba
	const r = Number.parseInt(bgColor.slice(1, 3), 16);
	const g = Number.parseInt(bgColor.slice(3, 5), 16);
	const b = Number.parseInt(bgColor.slice(5, 7), 16);
	const bgRgba = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;

	return (
		<div
			className="absolute left-1/2 z-40 pointer-events-none select-none"
			style={{
				...positionStyles,
				transform: positionStyles.transform || "translateX(-50%)",
				maxWidth: `${containerWidth * 0.85}px`,
			}}
		>
			<div
				style={{
					fontFamily: captionStyle.fontFamily,
					fontSize: `${scaledFontSize}px`,
					color: captionStyle.fontColor,
					backgroundColor: bgRgba,
					padding: `${Math.round(8 * scaleFactor)}px ${Math.round(16 * scaleFactor)}px`,
					borderRadius: `${Math.round(8 * scaleFactor)}px`,
					lineHeight: 1.4,
					textAlign: "center",
					fontWeight: 600,
					letterSpacing: "-0.01em",
					textShadow: "0 1px 4px rgba(0,0,0,0.5)",
				}}
			>
				{renderWords(activeLine.words, timeMs, captionStyle)}
			</div>
		</div>
	);
}
