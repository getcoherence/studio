// ── Remotion Root ────────────────────────────────────────────────────────
//
// Composition registration for Remotion. Used by @remotion/bundler for
// headless rendering and by the Player for preview.

import { Composition } from "remotion";
import type { SceneProject } from "@/lib/scene-renderer/types";
import { calculateProjectDuration, SceneProjectComposition } from "./SceneProjectComposition";

// Remotion requires Record<string, unknown> compatible props
// biome-ignore lint: Remotion requires Record<string, unknown> compatible component type
const CompositionComponent = SceneProjectComposition as unknown as React.FC<
	Record<string, unknown>
>;

const defaultProject: SceneProject = {
	id: "default",
	name: "Untitled",
	scenes: [],
	resolution: { width: 1920, height: 1080 },
	fps: 30,
};

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="SceneProject"
			component={CompositionComponent}
			durationInFrames={150}
			fps={30}
			width={1920}
			height={1080}
			defaultProps={{ project: defaultProject }}
			calculateMetadata={({ props }) => {
				const p = (props as { project: SceneProject }).project;
				return {
					durationInFrames: calculateProjectDuration(p),
					fps: p.fps || 30,
					width: p.resolution?.width || 1920,
					height: p.resolution?.height || 1080,
				};
			}}
		/>
	);
};
