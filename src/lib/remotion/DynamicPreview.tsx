// ── Dynamic Preview ─────────────────────────────────────────────────────
//
// Remotion Player wrapper for AI-generated compositions.
// Like RemotionPreview but renders DynamicComposition instead of SceneProjectComposition.
// Supports optional background music track.

import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, Audio } from "remotion";
import { DynamicComposition, estimateAiDuration } from "./DynamicComposition";
import { AudioPulseProvider } from "./helpers/AudioReactive";

interface DynamicPreviewProps {
	/** AI-generated TSX code */
	code: string;
	/** Screenshot data URLs */
	screenshots: string[];
	/** Sync play/pause from parent */
	isPlaying?: boolean;
	/** Optional background music URL (studio:// protocol) */
	musicSrc?: string;
	/** Increment to reset playback to frame 0 */
	resetSignal?: number;
	/** Seek to a specific frame */
	seekToFrame?: number;
	/** Callback with current frame during playback */
	onFrameUpdate?: (frame: number) => void;
	/** Composition width (defaults to 1920 for 16:9) */
	compositionWidth?: number;
	/** Composition height (defaults to 1080 for 16:9) */
	compositionHeight?: number;
}

/** Wrapper composition that layers DynamicComposition + background music + audio analysis */
const DynamicWithMusic: React.FC<{
	code: string;
	screenshots: string[];
	musicSrc?: string;
}> = ({ code, screenshots, musicSrc }) => {
	const content = (
		<AbsoluteFill>
			<DynamicComposition code={code} screenshots={screenshots} />
			{musicSrc && <Audio src={musicSrc} volume={0.25} />}
		</AbsoluteFill>
	);

	// Only wrap in AudioPulseProvider when the AI code actually uses useAudioPulse.
	// The provider runs an FFT (visualizeAudio) on every frame, which steals CPU
	// from scene rendering and causes audible jitter at scene boundaries on
	// heavy scenes (zoomMorph transitions, animated backgrounds, etc.) in
	// compositions that never consume the pulse data anyway.
	const needsPulse = musicSrc && /useAudioPulse|AudioPulse\b|BeatDot/.test(code);
	if (needsPulse) {
		return <AudioPulseProvider musicSrc={musicSrc!}>{content}</AudioPulseProvider>;
	}
	return content;
};

export const DynamicPreview: React.FC<DynamicPreviewProps> = ({
	code,
	screenshots,
	isPlaying,
	musicSrc,
	resetSignal,
	seekToFrame,
	onFrameUpdate,
	compositionWidth = 1920,
	compositionHeight = 1080,
}) => {
	const playerRef = useRef<PlayerRef>(null);
	const fps = 30;

	// Signal preview mode to child components (PixiOverlay, particles)
	useEffect(() => {
		(window as any).__STUDIO_PREVIEW_MODE__ = true;
		return () => {
			(window as any).__STUDIO_PREVIEW_MODE__ = false;
		};
	}, []);

	// Clean up persistent preview video elements when composition code changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: cleanup must re-run when code changes
	useEffect(() => {
		const registry = (window as any).__PREVIEW_VIDEOS__ as
			| Record<string, { vid: HTMLVideoElement; raf: number }>
			| undefined;
		if (!registry) return;
		return () => {
			for (const [key, entry] of Object.entries(registry)) {
				cancelAnimationFrame(entry.raf);
				entry.vid.pause();
				entry.vid.src = "";
				entry.vid.remove();
				delete registry[key];
			}
		};
	}, [code]);
	const estimated = estimateAiDuration(code, fps);
	const durationInFrames = Number.isFinite(estimated) && estimated > 0 ? estimated : fps * 20;

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

	// Sync frame position to parent for timeline playhead + expose globally
	// for PreviewVideo overlay to check frame bounds
	useEffect(() => {
		if (!playerRef.current) return;
		const interval = setInterval(() => {
			if (playerRef.current) {
				const f = playerRef.current.getCurrentFrame();
				(window as any).__REMOTION_CURRENT_FRAME__ = f;
				onFrameUpdate?.(f);
			}
		}, 50);
		return () => clearInterval(interval);
	}, [onFrameUpdate]);

	// Seek to specific frame when seekToFrame changes
	useEffect(() => {
		if (seekToFrame !== undefined && playerRef.current) {
			playerRef.current.seekTo(Math.round(seekToFrame));
		}
	}, [seekToFrame]);

	// Use the wrapper component when music is present. Memoize inputProps so the
	// object reference is stable across parent re-renders (e.g. the 100ms
	// setCurrentPlayerFrame loop during playback). Without this, Player sees a
	// "new" inputProps object every 100ms, which causes the Audio element to
	// re-sync and produces the audible jitter at scene boundaries.
	const CompositionComponent = musicSrc ? DynamicWithMusic : DynamicComposition;
	const inputProps = useMemo(
		() => (musicSrc ? { code, screenshots, musicSrc } : { code, screenshots }),
		[code, screenshots, musicSrc],
	);

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
				// Include music-presence in the key so when musicDataUrl finishes
				// its async fetch AFTER the Player already mounted without music,
				// the Player re-mounts with the DynamicWithMusic wrapper. Without
				// this, the composition tree is cached from initial render and
				// the Audio element never gets a chance to mount — the file
				// plays fine in the music tab's standalone player but is silent
				// inside the Remotion preview.
				key={`player-${code.length}-${durationInFrames}-${compositionWidth}x${compositionHeight}-${musicSrc ? "m" : "nm"}`}
				ref={playerRef}
				component={CompositionComponent as React.FC<any>}
				inputProps={inputProps}
				durationInFrames={Math.max(1, durationInFrames)}
				compositionWidth={compositionWidth}
				compositionHeight={compositionHeight}
				fps={fps}
				// Default is 5 simultaneous Audio tags. Narrated videos can mount
				// up to ~30 (one per scene narration + per SFX cue + 1 music track),
				// and Remotion pre-mounts all of them at scene seams. Bump well
				// above the worst case so the Player doesn't crash with
				// "Tried to simultaneously mount N <Html5Audio /> tags".
				numberOfSharedAudioTags={40}
				style={{
					width: "100%",
					maxHeight: "100%",
					aspectRatio: `${compositionWidth} / ${compositionHeight}`,
				}}
				controls
				autoPlay={false}
				loop
			/>
		</div>
	);
};
