// ── Dynamic Preview ─────────────────────────────────────────────────────
//
// Remotion Player wrapper for AI-generated compositions.
// Like RemotionPreview but renders DynamicComposition instead of SceneProjectComposition.
// Supports optional background music track.

import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useRef } from "react";
import { AbsoluteFill, Audio } from "remotion";
import { DynamicComposition, estimateAiDuration } from "./DynamicComposition";

interface DynamicPreviewProps {
	/** AI-generated TSX code */
	code: string;
	/** Screenshot data URLs */
	screenshots: string[];
	/** Sync play/pause from parent */
	isPlaying?: boolean;
	/** Optional background music URL (lucid:// protocol) */
	musicSrc?: string;
	/** Increment to reset playback to frame 0 */
	resetSignal?: number;
}

/** Wrapper composition that layers DynamicComposition + background music */
const DynamicWithMusic: React.FC<{
	code: string;
	screenshots: string[];
	musicSrc?: string;
}> = ({ code, screenshots, musicSrc }) => {
	return (
		<AbsoluteFill>
			<DynamicComposition code={code} screenshots={screenshots} />
			{musicSrc && <Audio src={musicSrc} volume={0.25} />}
		</AbsoluteFill>
	);
};

export const DynamicPreview: React.FC<DynamicPreviewProps> = ({
	code,
	screenshots,
	isPlaying,
	musicSrc,
	resetSignal,
}) => {
	const playerRef = useRef<PlayerRef>(null);
	const fps = 30;
	const estimated = estimateAiDuration(code, fps);
	const durationInFrames = Number.isFinite(estimated) && estimated > 0 ? estimated : fps * 20;

	useEffect(() => {
		if (!playerRef.current) return;
		if (isPlaying) {
			playerRef.current.play();
		} else {
			playerRef.current.pause();
		}
	}, [isPlaying]);

	// Reset to frame 0 when resetSignal changes
	useEffect(() => {
		if (resetSignal && playerRef.current) {
			playerRef.current.seekTo(0);
		}
	}, [resetSignal]);

	// Use the wrapper component when music is present
	const CompositionComponent = musicSrc ? DynamicWithMusic : DynamicComposition;
	const inputProps = musicSrc ? { code, screenshots, musicSrc } : { code, screenshots };

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "#000",
			}}
		>
			<Player
				ref={playerRef}
				component={CompositionComponent as React.FC<any>}
				inputProps={inputProps}
				durationInFrames={Math.max(1, durationInFrames)}
				compositionWidth={1920}
				compositionHeight={1080}
				fps={fps}
				style={{
					width: "100%",
					maxHeight: "100%",
					aspectRatio: "1920 / 1080",
				}}
				controls
				autoPlay={false}
				loop
			/>
		</div>
	);
};
