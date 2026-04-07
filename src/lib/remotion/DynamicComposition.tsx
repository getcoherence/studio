// ── Dynamic Composition ─────────────────────────────────────────────────
//
// JIT-compiles AI-generated React/TSX code and renders it as a Remotion
// composition. Uses the shared compileCode() module for TSX→JS compilation
// with injected Remotion imports.
//
// This enables the "AI creates the video" approach where the AI writes
// actual React components instead of populating a data model.

import React, { useEffect, useState } from "react";
import { AbsoluteFill } from "remotion";
import { compileCode } from "./compileCode";

// Re-export for consumers that import from this file
export { compileCode, estimateAiDuration } from "./compileCode";

interface DynamicCompositionProps {
	/** AI-generated TSX code string */
	code: string;
	/** Screenshot data URLs passed as props.screenshots to the generated component */
	screenshots: string[];
}

/**
 * Compiles and renders AI-generated Remotion code.
 * The generated code must export a VideoComposition component.
 */
export const DynamicComposition: React.FC<DynamicCompositionProps> = ({ code, screenshots }) => {
	const [Component, setComponent] = useState<React.FC<{ screenshots: string[] }> | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		try {
			const compiled = compileCode(code);
			setComponent(() => compiled);
			setError(null);
		} catch (err) {
			console.error("[DynamicComposition] Compilation failed:", err);
			setError(err instanceof Error ? err.message : String(err));
			setComponent(null);
		}
	}, [code]);

	if (error) {
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
				<div
					style={{
						color: "#ef4444",
						fontSize: 28,
						fontFamily: "Inter, system-ui, monospace",
						fontWeight: 600,
						marginBottom: 20,
					}}
				>
					Compilation Error
				</div>
				<div
					style={{
						color: "#ffffff80",
						fontSize: 14,
						fontFamily: "monospace",
						maxWidth: "80%",
						textAlign: "center",
						lineHeight: 1.6,
						wordBreak: "break-word",
					}}
				>
					{error}
				</div>
			</AbsoluteFill>
		);
	}

	if (!Component) {
		return (
			<AbsoluteFill
				style={{
					backgroundColor: "#0a0a0a",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{ color: "#ffffff60", fontSize: 24, fontFamily: "Inter, system-ui, sans-serif" }}
				>
					Compiling...
				</div>
			</AbsoluteFill>
		);
	}

	return (
		<ErrorBoundary fallback={<CompilationErrorFallback />}>
			<Component screenshots={screenshots} />
		</ErrorBoundary>
	);
};

// ── Error Boundary ──────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
	{ children: React.ReactNode; fallback: React.ReactNode },
	{ hasError: boolean; error: Error | null }
> {
	constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	render() {
		if (this.state.hasError) {
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
					<div
						style={{
							color: "#ef4444",
							fontSize: 28,
							fontFamily: "Inter, system-ui",
							fontWeight: 600,
							marginBottom: 20,
						}}
					>
						Runtime Error
					</div>
					<div
						style={{
							color: "#ffffff80",
							fontSize: 14,
							fontFamily: "monospace",
							maxWidth: "80%",
							textAlign: "center",
							lineHeight: 1.6,
						}}
					>
						{this.state.error?.message || "Unknown error during rendering"}
					</div>
				</AbsoluteFill>
			);
		}
		return this.props.children;
	}
}

function CompilationErrorFallback() {
	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#0a0a0a",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div style={{ color: "#ef4444", fontSize: 24, fontFamily: "Inter, system-ui" }}>
				Component crashed during rendering
			</div>
		</AbsoluteFill>
	);
}
