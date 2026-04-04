// ── SceneProject Composition ─────────────────────────────────────────────
//
// Top-level Remotion composition that renders a full SceneProject.
// Maps the scene timeline to Remotion <Sequence> elements.

import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { SceneProject } from "@/lib/scene-renderer/types";
import { RemotionScene } from "./RemotionScene";

interface SceneProjectCompositionProps {
	project: SceneProject;
}

export const SceneProjectComposition: React.FC<SceneProjectCompositionProps> = ({ project }) => {
	const { fps } = useVideoConfig();

	if (!project || !project.scenes || project.scenes.length === 0) {
		return (
			<AbsoluteFill
				style={{
					backgroundColor: "#000",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#fff",
					fontSize: 32,
					fontFamily: "Inter, system-ui, sans-serif",
				}}
			>
				No scenes
			</AbsoluteFill>
		);
	}

	// Build timeline: compute the frame offset for each scene
	const segments: Array<{
		type: "scene" | "transition";
		sceneIndex: number;
		startFrame: number;
		durationFrames: number;
	}> = [];

	let currentFrame = 0;

	for (let i = 0; i < project.scenes.length; i++) {
		const scene = project.scenes[i];
		const sceneDurationFrames = Math.ceil((scene.durationMs / 1000) * fps);

		segments.push({
			type: "scene",
			sceneIndex: i,
			startFrame: currentFrame,
			durationFrames: sceneDurationFrames,
		});

		currentFrame += sceneDurationFrames;

		// Add transition gap (if next scene has a transition)
		if (i < project.scenes.length - 1) {
			const nextTransition = project.scenes[i + 1].transition;
			if (nextTransition.type !== "none" && nextTransition.durationMs > 0) {
				const transFrames = Math.ceil((nextTransition.durationMs / 1000) * fps);
				// Transitions overlap — subtract from current frame
				currentFrame -= Math.floor(transFrames / 2);
			}
		}
	}

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{segments.map((seg) => {
				if (seg.type !== "scene") return null;
				const scene = project.scenes[seg.sceneIndex];

				return (
					<Sequence
						key={`scene-${seg.sceneIndex}`}
						from={seg.startFrame}
						durationInFrames={seg.durationFrames}
						layout="none"
					>
						<RemotionScene scene={scene} styleId={project.styleId} />
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

/**
 * Calculate total duration in frames from a SceneProject.
 * Used by both the Player and the Composition registration.
 */
export function calculateProjectDuration(project: SceneProject): number {
	if (!project?.scenes?.length) return 30;
	const fps = project.fps || 30;
	let totalMs = 0;
	for (const scene of project.scenes) {
		totalMs += scene.durationMs;
	}
	return Math.max(1, Math.ceil((totalMs / 1000) * fps));
}
