// ── Remotion Preview Component ───────────────────────────────────────────
//
// Wraps @remotion/player for embedding in the Scene Editor.
// Consumes SceneProject and provides playback controls.

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef } from "react";
import type { SceneProject } from "@/lib/scene-renderer/types";
import { calculateProjectDuration, SceneProjectComposition } from "./SceneProjectComposition";

interface RemotionPreviewProps {
	project: SceneProject;
	isPlaying?: boolean;
}

export const RemotionPreview: React.FC<RemotionPreviewProps> = ({ project, isPlaying }) => {
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
				component={SceneProjectComposition}
				inputProps={{ project }}
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
