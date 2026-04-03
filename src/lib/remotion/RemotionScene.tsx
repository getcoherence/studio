// ── Remotion Scene Component ─────────────────────────────────────────────
//
// Renders a single Scene as a Remotion composition with background + layers.

import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { Scene } from "@/lib/scene-renderer/types";
import { RemotionLayer } from "./RemotionLayer";

interface RemotionSceneProps {
	scene: Scene;
}

export const RemotionScene: React.FC<RemotionSceneProps> = ({ scene }) => {
	const { fps, width, height } = useVideoConfig();

	// Sort layers by zIndex
	const sortedLayers = [...scene.layers].sort((a, b) => a.zIndex - b.zIndex);

	// Determine background style
	const bgStyle = getBackgroundStyle(scene.background);

	return (
		<AbsoluteFill style={bgStyle}>
			{sortedLayers.map((layer) => {
				const startFrame = Math.round((layer.startMs / 1000) * fps);
				const endFrame = Math.round((layer.endMs / 1000) * fps);
				const layerDuration = Math.max(1, endFrame - startFrame);

				return (
					<Sequence key={layer.id} from={startFrame} durationInFrames={layerDuration} layout="none">
						<RemotionLayer
							layer={layer}
							compositionWidth={width}
							compositionHeight={height}
							sceneDurationFrames={layerDuration}
						/>
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

// ── Background styling ───────────────────────────────────────────────────

function getBackgroundStyle(background: string): React.CSSProperties {
	// Solid colors
	if (background.startsWith("#") || background.startsWith("rgb")) {
		return { backgroundColor: background };
	}

	// Animated backgrounds → CSS gradient approximations
	switch (background) {
		case "animated-midnight":
			return {
				background: "linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 40%, #1a1a3e 70%, #0a0a1a 100%)",
			};
		case "animated-aurora":
			return {
				background: "linear-gradient(135deg, #0a1628 0%, #0d2818 30%, #1a3040 60%, #0a1628 100%)",
			};
		case "animated-ocean-wave":
			return {
				background: "linear-gradient(135deg, #0a1a2e 0%, #0d2a3e 40%, #1a3a4e 70%, #0a1a2e 100%)",
			};
		case "animated-sunset-flow":
			return {
				background: "linear-gradient(135deg, #2a1a0a 0%, #3e2a0d 30%, #4e3a1a 60%, #2a1a0a 100%)",
			};
		case "animated-neon-pulse":
			return {
				background: "linear-gradient(135deg, #1a0a2a 0%, #2a0d3e 40%, #3a1a4e 70%, #1a0a2a 100%)",
			};
		case "animated-forest":
			return {
				background: "linear-gradient(135deg, #0a1a0a 0%, #0d2a0d 40%, #1a3a1a 70%, #0a1a0a 100%)",
			};
		case "mesh-apple-dark":
			return {
				background: "linear-gradient(135deg, #1a0a2a 0%, #0d1a3e 50%, #2a0a1a 100%)",
			};
		case "mesh-apple-light":
			return {
				background: "linear-gradient(135deg, #e8dff0 0%, #d0e0f0 50%, #f0d8e8 100%)",
			};
		default:
			return { backgroundColor: "#09090b" };
	}
}
