// ── Bench Render Page ───────────────────────────────────────────────────
//
// Hidden route used by the bench's Electron IPC to render a single AI-
// generated scene at a specific frame and capture it as a PNG. Reads
// `code` (base64-encoded customCode string) and `frame` (integer) from
// URL query params, mounts a Remotion Player locked to that frame, and
// signals readiness via `window.__benchRenderReady = true`.
//
// Lifecycle:
//   1. Electron main opens a hidden BrowserWindow at
//      `?windowType=bench-render&code=<b64>&frame=30`
//   2. React mounts, compiles the code, renders the Player
//   3. We set `window.__benchRenderReady = true` a tick after paint
//   4. Electron polls for that flag, calls webContents.capturePage(),
//      saves PNG, closes the window.
//
// The window is never shown to the user. If the code fails to compile or
// render, we surface a bright error plate so the captured PNG is obviously
// an error state (catches the class of "rendered but blank" failures).

import { Player } from "@remotion/player";
import { useEffect, useMemo, useState } from "react";
import { DynamicComposition } from "../lib/remotion/DynamicComposition";

const DEFAULT_DURATION = 180;

export function BenchRenderPage() {
	const [error] = useState<string | null>(null);

	// Code is injected by the Electron main process via executeJavaScript
	// AFTER the page loads (setting window.__benchCode). This avoids Vite's
	// 431 "Request Header Fields Too Large" error that hits when scenes have
	// >15K chars of customCode and the base64 URL exceeds the header limit.
	// The frame index is still URL-safe (short integer) so it stays as a param.
	const [code, setCode] = useState<string>("");
	const frame = useMemo(() => {
		const params = new URLSearchParams(window.location.search);
		return Math.max(0, Math.floor(Number(params.get("frame") ?? "30")));
	}, []);

	// Poll for window.__benchCode until it's set (main process injects it
	// shortly after page load). Also signal page-ready to main so it knows
	// when to inject.
	useEffect(() => {
		(window as any).__benchPageReady = true;
		let cancelled = false;
		const poll = () => {
			if (cancelled) return;
			const injected = (window as any).__benchCode;
			if (typeof injected === "string" && injected.length > 0) {
				setCode(injected);
				return;
			}
			setTimeout(poll, 100);
		};
		poll();
		return () => {
			cancelled = true;
			(window as any).__benchPageReady = false;
		};
	}, []);

	// Wrap the raw function-body customCode into a full VideoComposition
	// component the same way scenePlanCompiler does when assembling the real
	// project. DynamicComposition expects a full component, not a fragment.
	const wrappedCode = useMemo(() => {
		if (!code) return "";
		if (code.includes("VideoComposition")) return code; // already a full component
		return `function VideoComposition({ screenshots }) {\n${code}\n}`;
	}, [code]);

	// Mark the page ready only AFTER the full pipeline has settled:
	//   1. React mounts BenchRenderPage
	//   2. DynamicComposition's useEffect JIT-compiles the customCode
	//   3. Remotion Player mounts and seeks to initialFrame
	//   4. The scene's own useEffect chains fire (GSAP timelines, etc.)
	//   5. Compositor paints the first frame
	// Empirically a 2.5s delay is enough for step 1-5 on a modern machine.
	// Shorter delays produce blank PNGs because capturePage() fires before
	// the scene's initial render completes. We also wait for a canvas or
	// rendered content as a sanity check.
	useEffect(() => {
		if (!wrappedCode) return;
		let cancelled = false;
		const markReady = () => {
			if (cancelled) return;
			(window as any).__benchRenderReady = true;
		};
		// Poll for evidence the Player has rendered actual content.
		// Large customCode (>12000 chars) needs significantly more time to
		// JIT-compile, set up GSAP timelines, and paint the first frame —
		// empirically complex scenes need 5-7s before first paint completes.
		// We scale the minimum wait by code size and the safety timeout
		// generously so complex scenes don't produce blank PNGs.
		const codeSize = wrappedCode.length;
		// Scale wait times aggressively — scenes with large inline element
		// arrays (halftone-dot patterns with 3000+ elements, 50-item marble
		// arrays) have heavy first-paint costs. Empirically 15s covers the
		// worst cases.
		const minWaitMs =
			codeSize > 17_000 ? 12_000 : codeSize > 13_000 ? 9_000 : codeSize > 10_000 ? 6_000 : 3_500;
		const safetyTimeoutMs = Math.max(20_000, minWaitMs + 5_000);
		const pollStart = Date.now();
		const pollForContent = () => {
			if (cancelled) return;
			const bodyChildren = document.querySelectorAll("body *").length;
			const hasRemotionNode =
				document.querySelector(
					".remotion-player svg, .remotion-player canvas, [data-testid*='remotion'] svg, [data-testid*='remotion'] canvas",
				) != null;
			// Heuristic: a real scene produces 40+ DOM nodes. Complex scenes
			// produce 100+. Wait for a reasonable child count to stabilize.
			const hasContent = hasRemotionNode || bodyChildren > 60;
			const elapsed = Date.now() - pollStart;
			if (hasContent && elapsed >= minWaitMs) {
				markReady();
			} else if (elapsed > safetyTimeoutMs) {
				// Safety net — mark ready anyway; at worst we capture a
				// partial/blank frame which the bench can flag as suspect.
				markReady();
			} else {
				setTimeout(pollForContent, 250);
			}
		};
		const firstTick = setTimeout(pollForContent, 600);
		return () => {
			cancelled = true;
			clearTimeout(firstTick);
			(window as any).__benchRenderReady = false;
		};
	}, [wrappedCode]);

	if (error || !code) {
		return (
			<div
				style={{
					width: "100vw",
					height: "100vh",
					background: "#ef4444",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#fff",
					fontSize: 24,
					fontFamily: "monospace",
					padding: 40,
					textAlign: "center",
				}}
			>
				{error ?? "No code param"}
			</div>
		);
	}

	return (
		<div
			style={{
				width: "100vw",
				height: "100vh",
				background: "#000",
				overflow: "hidden",
				position: "relative",
			}}
		>
			<Player
				component={DynamicComposition as any}
				durationInFrames={DEFAULT_DURATION}
				compositionWidth={1920}
				compositionHeight={1080}
				fps={30}
				style={{ width: "100%", height: "100%" }}
				controls={false}
				loop={false}
				autoPlay={false}
				initialFrame={frame}
				inputProps={{ code: wrappedCode, screenshots: [] }}
				acknowledgeRemotionLicense
			/>
		</div>
	);
}
