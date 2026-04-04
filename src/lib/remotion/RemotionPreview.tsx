// ── Remotion Preview Component ───────────────────────────────────────────
//
// Wraps @remotion/player for embedding in the Scene Editor.
// Consumes SceneProject and provides playback controls.

import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useRef } from "react";
import { AbsoluteFill, Audio } from "remotion";
import type { SceneProject } from "@/lib/scene-renderer/types";
import { calculateProjectDuration, SceneProjectComposition } from "./SceneProjectComposition";

/** Wrapper that adds background music to the scene composition */
const SceneProjectWithMusic: React.FC<{ project: SceneProject; musicSrc: string }> = ({
	project,
	musicSrc,
}) => (
	<AbsoluteFill>
		<SceneProjectComposition project={project} />
		<Audio src={musicSrc} volume={0.25} />
	</AbsoluteFill>
);

interface RemotionPreviewProps {
	project: SceneProject;
	isPlaying?: boolean;
	/** Optional background music URL */
	musicSrc?: string;
	/** Increment to reset playback to frame 0 */
	resetSignal?: number;
}

export const RemotionPreview: React.FC<RemotionPreviewProps> = ({
	project,
	isPlaying,
	musicSrc,
	resetSignal,
}) => {
	const playerRef = useRef<PlayerRef>(null);
	const fps = project.fps || 30;
	const durationInFrames = calculateProjectDuration(project);

	// Sync play/pause state from parent
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
				component={(musicSrc ? SceneProjectWithMusic : SceneProjectComposition) as React.FC<any>}
				inputProps={musicSrc ? { project, musicSrc } : { project }}
				durationInFrames={Math.max(1, durationInFrames)}
				compositionWidth={project.resolution?.width || 1920}
				compositionHeight={project.resolution?.height || 1080}
				fps={fps}
				style={{
					width: "100%",
					maxHeight: "100%",
					aspectRatio: `${project.resolution?.width || 1920} / ${project.resolution?.height || 1080}`,
				}}
				controls
				autoPlay={false}
				loop
			/>
		</div>
	);
};
