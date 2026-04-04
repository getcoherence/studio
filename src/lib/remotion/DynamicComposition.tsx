// ── Dynamic Composition ─────────────────────────────────────────────────
//
// JIT-compiles AI-generated React/TSX code and renders it as a Remotion
// composition. Uses sucrase for TSX→JS transformation and new Function()
// to create the component with injected Remotion imports.
//
// This enables the "AI creates the video" approach where the AI writes
// actual React components instead of populating a data model.

import React, { useEffect, useState } from "react";
import {
	AbsoluteFill,
	Img,
	interpolate,
	random,
	Sequence,
	Series,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { transform } from "sucrase";

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

// ── Compilation ─────────────────────────────────────────────────────────

/**
 * The module scope provided to AI-generated code.
 * These are the imports available via destructuring.
 */
const MODULE_SCOPE = {
	React,
	useState: React.useState,
	useEffect: React.useEffect,
	useMemo: React.useMemo,
	useCallback: React.useCallback,
	useRef: React.useRef,
	// Remotion
	useCurrentFrame,
	useVideoConfig,
	interpolate,
	spring,
	random,
	Sequence,
	Series,
	AbsoluteFill,
	Img,
};

/**
 * Compile AI-generated TSX code into a React component.
 *
 * Steps:
 * 1. Strip import statements (we provide everything via module scope)
 * 2. Transform TSX → JS using sucrase
 * 3. Create a function that receives the module scope and returns the component
 */
function compileCode(tsxCode: string): React.FC<{ screenshots: string[] }> {
	// Step 1: Strip import statements — we inject everything via scope
	// Must handle multi-line destructured imports: import {\n  ...\n} from '...'
	let code = tsxCode
		.replace(/import\s+[\s\S]*?from\s*['"][^'"]*['"];?/g, "")
		.replace(/import\s+['"][^'"]+['"];?/g, "")
		.trim();

	// Step 2: Transform TSX → JS
	const result = transform(code, {
		transforms: ["jsx", "typescript"],
		jsxRuntime: "classic",
		production: false,
	});
	code = result.code;

	// Step 3: Find the component name and ensure it's returned
	// Look for: export const VideoComposition, export function VideoComposition,
	// export default function, const VideoComposition, etc.
	code = code.replace(/export\s+default\s+/g, "").replace(/export\s+/g, "");

	// Wrap in a function that returns the component
	const scopeKeys = Object.keys(MODULE_SCOPE);
	const scopeValues = Object.values(MODULE_SCOPE);

	const wrappedCode = `
		"use strict";
		${code}
		if (typeof VideoComposition !== 'undefined') return VideoComposition;
		if (typeof Composition !== 'undefined') return Composition;
		if (typeof App !== 'undefined') return App;
		throw new Error('No VideoComposition component found in generated code');
	`;

	// biome-ignore lint: new Function is intentional for JIT compilation
	const factory = new Function(...scopeKeys, wrappedCode);
	const component = factory(...scopeValues);

	if (typeof component !== "function") {
		throw new Error(
			`Generated code did not produce a valid React component (got ${typeof component})`,
		);
	}

	return component;
}

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

// ── Duration calculator ─────────────────────────────────────────────────

/**
 * Estimate duration in frames for an AI-generated composition.
 * Parses the code to find durationInFrames values or Sequence from/duration props.
 */
export function estimateAiDuration(code: string, fps = 30): number {
	// Try to find explicit total duration variable
	const totalMatch = code.match(/totalDuration\s*=\s*(\d+)/);
	if (totalMatch) return parseInt(totalMatch[1], 10);

	// Look for SCENE_FRAMES * count pattern (either order)
	const sceneFramesMatch = code.match(/SCENE_FRAMES\s*=\s*(\d+)/);
	if (sceneFramesMatch) {
		const perScene = parseInt(sceneFramesMatch[1], 10);
		const countA = code.match(/(\d+)\s*\*\s*SCENE_FRAMES/);
		const countB = code.match(/SCENE_FRAMES\s*\*\s*(\d+)/);
		const count = countA ? parseInt(countA[1], 10) : countB ? parseInt(countB[1], 10) : 0;
		if (count > 0) return count * perScene;
		// Fallback: count Sequence components × SCENE_FRAMES
		const seqs = (code.match(/<Sequence/g) || []).length;
		if (seqs > 0) return seqs * perScene;
	}

	// Look for totalDuration as an expression (e.g. 12 * 60)
	const totalExprMatch = code.match(/totalDuration\s*=\s*(\d+)\s*\*\s*(\d+)/);
	if (totalExprMatch) return parseInt(totalExprMatch[1], 10) * parseInt(totalExprMatch[2], 10);

	// Find the highest 'from' value in Sequence components
	const fromValues = [...code.matchAll(/from[=:]\s*{?\s*(\d+)/g)].map((m) => parseInt(m[1], 10));
	const durationValues = [...code.matchAll(/durationInFrames[=:]\s*{?\s*(\d+)/g)].map((m) =>
		parseInt(m[1], 10),
	);
	if (fromValues.length > 0 && durationValues.length > 0) {
		const maxFrom = Math.max(...fromValues);
		const lastDuration = durationValues[durationValues.length - 1] || 60;
		return maxFrom + lastDuration;
	}

	// Count Sequence components and estimate
	const sequenceCount = (code.match(/<Sequence/g) || []).length;
	if (sequenceCount > 0) return sequenceCount * 60; // ~2s per sequence

	// Default: 20 seconds
	return fps * 20;
}
