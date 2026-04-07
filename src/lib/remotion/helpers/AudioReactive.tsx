// ── Audio-Reactive Hooks & Components ────────────────────────────────────
//
// Provides audio analysis data to AI-generated compositions so animations
// can react to the music beat. Uses @remotion/media-utils for FFT analysis.
//
// Architecture:
//   AudioPulseProvider (wraps composition, fetches audio data)
//     → AudioPulseContext (React context)
//       → useAudioPulse() hook (returns bass/mid/high per frame)
//         → AI-generated code uses it for beat-reactive springs

import React, { useContext } from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

// Lazy-load @remotion/media-utils to avoid errors if not installed
let _useAudioData: ((src: string) => any) | null = null;
let _visualizeAudio: ((opts: any) => number[]) | null = null;

try {
	const mediaUtils = require("@remotion/media-utils");
	_useAudioData = mediaUtils.useAudioData;
	_visualizeAudio = mediaUtils.visualizeAudio;
} catch {
	// @remotion/media-utils not available — hooks will return defaults
}

// ── Context ────────────────────────────────────────────────────────────

interface AudioPulseData {
	/** Raw frequency bands from visualizeAudio (0-1 each) */
	bands: number[];
}

const AudioPulseContext = React.createContext<AudioPulseData | null>(null);

// ── Provider ───────────────────────────────────────────────────────────

/** Wraps a composition to provide audio analysis data via context */
export const AudioPulseProvider: React.FC<{
	musicSrc: string;
	children: React.ReactNode;
}> = ({ musicSrc, children }) => {
	if (!_useAudioData || !_visualizeAudio) {
		return <>{children}</>;
	}

	return <AudioPulseProviderInner musicSrc={musicSrc}>{children}</AudioPulseProviderInner>;
};

/** Inner provider that calls hooks (separated to avoid conditional hook calls) */
const AudioPulseProviderInner: React.FC<{
	musicSrc: string;
	children: React.ReactNode;
}> = ({ musicSrc, children }) => {
	const audioData = _useAudioData!(musicSrc);
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	let pulseData: AudioPulseData = { bands: [] };

	if (audioData) {
		try {
			const bands = _visualizeAudio!({
				audioData,
				frame,
				fps,
				numberOfSamples: 32,
				smoothing: true,
			});
			pulseData = { bands };
		} catch {
			// Visualization failed — use empty bands
		}
	}

	return <AudioPulseContext.Provider value={pulseData}>{children}</AudioPulseContext.Provider>;
};

// ── Hook ───────────────────────────────────────────────────────────────

export interface AudioPulseValues {
	/** Bass energy (0-1) — kick drums, low rumble */
	bass: number;
	/** Mid energy (0-1) — vocals, instruments */
	mid: number;
	/** High energy (0-1) — hi-hats, cymbals, shimmer */
	high: number;
	/** Overall energy (0-1) — weighted average */
	overall: number;
	/** Whether audio data is available */
	active: boolean;
}

/**
 * Returns audio energy per frame, broken into frequency bands.
 * If no music is playing, returns zeros (safe to always call).
 */
export function useAudioPulse(): AudioPulseValues {
	const ctx = useContext(AudioPulseContext);

	if (!ctx || ctx.bands.length === 0) {
		return { bass: 0, mid: 0, high: 0, overall: 0, active: false };
	}

	const { bands } = ctx;
	const len = bands.length; // 32

	// Bass: first 4 bands (0-3)
	const bass = avg(bands, 0, Math.min(4, len));
	// Mid: bands 8-15
	const mid = avg(bands, Math.min(8, len), Math.min(16, len));
	// High: bands 24-31
	const high = avg(bands, Math.min(24, len), len);
	// Overall: weighted — bass is most perceptible
	const overall = bass * 0.5 + mid * 0.3 + high * 0.2;

	return { bass, mid, high, overall, active: true };
}

function avg(arr: number[], from: number, to: number): number {
	if (from >= to || from >= arr.length) return 0;
	let sum = 0;
	const end = Math.min(to, arr.length);
	for (let i = from; i < end; i++) sum += arr[i];
	return sum / (end - from);
}

// ── AudioPulse Component ───────────────────────────────────────────────

/**
 * Wrapper that scales/pulses children based on bass energy.
 * Drop it around any element to make it react to the music.
 */
export const AudioPulse: React.FC<{
	children: React.ReactNode;
	/** How much to scale on beat (0 = none, 1 = double size). Default 0.08 */
	intensity?: number;
	/** Which frequency band to react to. Default 'bass' */
	band?: "bass" | "mid" | "high" | "overall";
	/** Additional spring smoothing. Default true */
	smooth?: boolean;
}> = ({ children, intensity = 0.08, band = "bass", smooth = true }) => {
	const pulse = useAudioPulse();
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const energy = pulse[band];

	// Smooth the pulse with a light spring to avoid jitter
	const smoothedEnergy = smooth
		? spring({
				frame,
				fps,
				config: { damping: 30, stiffness: 200 },
				durationInFrames: 8,
			}) *
				energy +
			(1 -
				spring({
					frame,
					fps,
					config: { damping: 30, stiffness: 200 },
					durationInFrames: 8,
				})) *
				energy
		: energy;

	const scale = 1 + smoothedEnergy * intensity;

	return (
		<div
			style={{
				transform: `scale(${scale})`,
				transformOrigin: "center",
				willChange: "transform",
			}}
		>
			{children}
		</div>
	);
};

// ── BeatCounter ────────────────────────────────────────────────────────

/**
 * Renders a pulsing glow dot that reacts to the beat.
 * Great as a visual indicator that audio is reactive.
 */
export const BeatDot: React.FC<{
	color?: string;
	size?: number;
	position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}> = ({ color = "#2563eb", size = 12, position = "bottom-right" }) => {
	const pulse = useAudioPulse();
	const scale = 1 + pulse.bass * 0.8;
	const opacity = 0.3 + pulse.bass * 0.7;

	const posStyle: React.CSSProperties = {
		position: "absolute",
		...(position.includes("top") ? { top: 20 } : { bottom: 20 }),
		...(position.includes("right") ? { right: 20 } : { left: 20 }),
	};

	return (
		<div
			style={{
				...posStyle,
				width: size,
				height: size,
				borderRadius: "50%",
				backgroundColor: color,
				opacity,
				transform: `scale(${scale})`,
				boxShadow: `0 0 ${20 * pulse.bass}px ${color}`,
				pointerEvents: "none",
			}}
		/>
	);
};
