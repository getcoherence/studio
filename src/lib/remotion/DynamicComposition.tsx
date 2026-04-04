// ── Dynamic Composition ─────────────────────────────────────────────────
//
// JIT-compiles AI-generated React/TSX code and renders it as a Remotion
// composition. Uses sucrase for TSX→JS transformation and new Function()
// to create the component with injected Remotion imports.
//
// This enables the "AI creates the video" approach where the AI writes
// actual React components instead of populating a data model.

import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
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
import { AnimatedText, Card, Pill, Scene, Underline } from "./helpers/CinematicHelpers";

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
	// Wrap Sequence to guard against durationInFrames <= 0 (AI sometimes generates 0)
	Sequence: (props: any) => {
		const dur = props.durationInFrames;
		if (typeof dur === "number" && dur <= 0) return null;
		return React.createElement(Sequence, props);
	},
	Series,
	AbsoluteFill,
	Img,
	// Transitions
	TransitionSeries,
	linearTiming,
	springTiming,
	fade,
	slide,
	wipe,
	// Pre-built cinematic helpers — safe, responsive, animated
	Scene,
	AnimatedText,
	Card,
	Pill,
	Underline,
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
	// Skip injecting scope keys that the AI already defines (prevents "already declared" errors)
	const allKeys = Object.keys(MODULE_SCOPE);
	const aiDefined = new Set<string>();
	for (const name of allKeys) {
		if (new RegExp(`\\b(const|let|var|function)\\s+${name}\\b`).test(code)) {
			aiDefined.add(name);
		}
	}
	const scopeKeys = allKeys.filter((k) => !aiDefined.has(k));
	const scopeValues = scopeKeys.map((k) => MODULE_SCOPE[k as keyof typeof MODULE_SCOPE]);

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
	// Strategy: try to extract totalDuration by evaluating the variable declarations
	// from the compiled code in a safe sandbox
	try {
		let strippedCode = code
			.replace(/import\s+[\s\S]*?from\s*['"][^'"]*['"];?/g, "")
			.replace(/import\s+['"][^'"]+['"];?/g, "")
			.trim();

		const jsCode = transform(strippedCode, {
			transforms: ["jsx", "typescript"],
			jsxRuntime: "classic",
			production: false,
		}).code;

		// Try to extract totalDuration by running just the const declarations
		// biome-ignore lint: eval is intentional for duration extraction
		const extractDuration = new Function(
			"React",
			`"use strict";
			// Stub out components so they don't error
			const AbsoluteFill = () => null;
			const Sequence = () => null;
			const Series = { Sequence: () => null };
			const Img = () => null;
			const Audio = () => null;
			const useCurrentFrame = () => 0;
			const useVideoConfig = () => ({ fps: 30, durationInFrames: 600, width: 1920, height: 1080 });
			const interpolate = (v) => v;
			const spring = () => 0;
			const random = () => 0;
			try {
				${jsCode}
				if (typeof totalDuration === 'number' && totalDuration > 0) return totalDuration;
			} catch(e) {}
			return 0;`,
		);
		const result = extractDuration(React);
		if (typeof result === "number" && result > 0) return result;
	} catch {
		// Extraction failed — fall through to heuristics
	}

	// Heuristic fallback: count Sequence components × 60 frames
	const sequenceCount = (code.match(/<Sequence/g) || []).length;
	if (sequenceCount > 0) return sequenceCount * 60;

	// Default: 20 seconds
	return fps * 20;
}
