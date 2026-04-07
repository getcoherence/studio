// ── Remotion Root ────────────────────────────────────────────────────────
//
// Composition registration for Remotion. Used by @remotion/bundler for
// headless rendering and by the Player for preview.

import React, { useMemo } from "react";
import { AbsoluteFill, Composition } from "remotion";
import type { SceneProject } from "@/lib/scene-renderer/types";
import { compileCode, estimateAiDuration } from "./compileCode";
import { calculateProjectDuration, SceneProjectComposition } from "./SceneProjectComposition";

// Remotion requires Record<string, unknown> compatible props
// biome-ignore lint: Remotion requires Record<string, unknown> compatible component type
const SceneProjectComponent = SceneProjectComposition as unknown as React.FC<
	Record<string, unknown>
>;

const defaultProject: SceneProject = {
	id: "default",
	name: "Untitled",
	scenes: [],
	resolution: { width: 1920, height: 1080 },
	fps: 30,
};

// ── DynamicVideo Composition ────────────────────────────────────────────
// Used by the SSR export pipeline. Receives AI-generated code + screenshots
// as inputProps, compiles via compileCode(), and renders the result.

const DynamicVideoComposition: React.FC<{ code: string; screenshots: string[] }> = ({
	code,
	screenshots,
}) => {
	const { component: Component, error } = useMemo(() => {
		if (!code) {
			console.warn("[DynamicVideoComposition] No code provided");
			return { component: null, error: "No code provided to DynamicVideoComposition" };
		}
		console.log(
			`[DynamicVideoComposition] Compiling code (${code.length} chars), ${screenshots?.length ?? 0} screenshots`,
		);
		try {
			const comp = compileCode(code);
			console.log("[DynamicVideoComposition] Compilation succeeded");
			return { component: comp, error: null };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[DynamicVideoComposition] Compilation failed:", msg);
			return { component: null, error: msg };
		}
	}, [code]);

	if (error || !Component) {
		return (
			<AbsoluteFill
				style={{
					backgroundColor: "#0a0a0a",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: 80,
				}}
			>
				<div style={{ color: "#ef4444", fontSize: 28, fontFamily: "monospace", fontWeight: 600 }}>
					SSR Compilation Error
				</div>
				<div
					style={{
						color: "#ffffff80",
						fontSize: 14,
						fontFamily: "monospace",
						marginTop: 20,
						maxWidth: "80%",
						textAlign: "center",
						wordBreak: "break-word",
					}}
				>
					{error || "Unknown error"}
				</div>
			</AbsoluteFill>
		);
	}

	return <Component screenshots={screenshots} />;
};

// biome-ignore lint: Remotion requires Record<string, unknown> compatible component type
const DynamicVideoComponent = DynamicVideoComposition as unknown as React.FC<
	Record<string, unknown>
>;

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="SceneProject"
				component={SceneProjectComponent}
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
			<Composition
				id="DynamicVideo"
				component={DynamicVideoComponent}
				durationInFrames={900}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{ code: "", screenshots: [] as string[] }}
				calculateMetadata={({ props }) => {
					const { code } = props as { code: string };
					const duration = code ? estimateAiDuration(code, 30) : 900;
					return { durationInFrames: duration };
				}}
			/>
		</>
	);
};
