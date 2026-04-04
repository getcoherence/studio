// ── Floating Card ───────────────────────────────────────────────────────
//
// Renders a cropped UI element floating on a dark background with
// perspective transform, shadow, and subtle entrance animation.
// Used in cinematic mode to isolate a single card/button/feature
// from a full-page screenshot.

import React from "react";
import { Img, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface FloatingCardProps {
	/** Full screenshot source (data URL or path) */
	src: string;
	/** Crop region within the source image (0-1 normalized) */
	cropRegion: { x: number; y: number; width: number; height: number };
	/** Optional subtle 3D perspective rotation (degrees, default: 2) */
	perspectiveDeg?: number;
	/** Shadow intensity (default: "heavy") */
	shadowIntensity?: "light" | "medium" | "heavy";
	/** Border radius in px (default: 16) */
	borderRadius?: number;
	/** Delay in frames before entrance (default: 0) */
	delayFrames?: number;
	/** Optional accent border color */
	accentColor?: string;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({
	src,
	cropRegion,
	perspectiveDeg = 2,
	shadowIntensity = "heavy",
	borderRadius = 16,
	delayFrames = 0,
	accentColor,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const localFrame = Math.max(0, frame - delayFrames);
	const progress = spring({
		frame: localFrame,
		fps,
		config: { damping: 14, stiffness: 120, mass: 1 },
	});

	const shadowMap = {
		light: "0 4px 16px rgba(0,0,0,0.3)",
		medium: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
		heavy:
			"0 16px 64px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
	};

	const crop = cropRegion;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				perspective: 1200,
			}}
		>
			<div
				style={{
					width: "90%",
					height: "85%",
					position: "relative",
					overflow: "hidden",
					borderRadius,
					boxShadow: shadowMap[shadowIntensity],
					border: accentColor ? `1px solid ${accentColor}` : "1px solid rgba(255,255,255,0.08)",
					// Entrance animation
					opacity: progress,
					transform: [
						`scale(${0.92 + progress * 0.08})`,
						`rotateY(${(1 - progress) * perspectiveDeg}deg)`,
						`translateY(${(1 - progress) * 20}px)`,
					].join(" "),
				}}
			>
				<Img
					src={src}
					style={{
						position: "absolute",
						left: `${-crop.x * 100}%`,
						top: `${-crop.y * 100}%`,
						width: `${100 / crop.width}%`,
						height: `${100 / crop.height}%`,
						objectFit: "cover",
					}}
				/>
			</div>
		</div>
	);
};
