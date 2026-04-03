// ── Layer Animation Hook ─────────────────────────────────────────────────
//
// Maps LayerAnimation types from the SceneProject data model to Remotion's
// interpolate()/spring() calls, returning CSSProperties for each frame.

import type React from "react";
import { Easing, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { LayerAnimation } from "@/lib/scene-renderer/types";

interface AnimationResult {
	style: React.CSSProperties;
	/** For typewriter: how many characters to show (-1 = all) */
	visibleChars: number;
}

/**
 * Compute CSS styles for a layer's entrance or exit animation at the current frame.
 */
export function useLayerAnimation(
	animation: LayerAnimation,
	phase: "entrance" | "exit",
	layerDurationFrames: number,
	totalTextLength?: number,
): AnimationResult {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const delayFrames = Math.round((animation.delay / 1000) * fps);
	const durFrames = Math.max(1, Math.round((animation.durationMs / 1000) * fps));

	// For exit: animate at the end of the layer
	const animStart = phase === "entrance" ? delayFrames : layerDurationFrames - durFrames;
	const animEnd = animStart + durFrames;

	// Clamp frame to animation range
	const localFrame = Math.max(0, Math.min(durFrames, frame - animStart));

	// For exit, reverse progress (1→0)
	const rawProgress = durFrames > 0 ? localFrame / durFrames : 1;
	const progress = phase === "exit" ? 1 - rawProgress : rawProgress;

	// Apply easing
	const easedProgress = applyEasing(progress, animation.easing, localFrame, fps, durFrames);

	// Before entrance starts or after exit ends
	if (phase === "entrance" && frame < animStart) {
		return { style: { opacity: 0 }, visibleChars: 0 };
	}
	if (phase === "entrance" && frame >= animEnd) {
		return { style: {}, visibleChars: -1 };
	}
	if (phase === "exit" && frame < animStart) {
		return { style: {}, visibleChars: -1 };
	}
	if (phase === "exit" && frame >= animEnd) {
		return { style: { opacity: 0 }, visibleChars: 0 };
	}

	return computeAnimationStyle(animation.type, easedProgress, animation, totalTextLength);
}

function applyEasing(
	progress: number,
	easing: LayerAnimation["easing"],
	localFrame: number,
	fps: number,
	durFrames: number,
): number {
	switch (easing) {
		case "linear":
			return progress;
		case "ease-in":
			return Easing.in(Easing.cubic)(progress);
		case "ease-out":
			return Easing.out(Easing.cubic)(progress);
		case "ease-in-out":
			return Easing.inOut(Easing.cubic)(progress);
		case "spring": {
			const s = spring({
				frame: localFrame,
				fps,
				durationInFrames: durFrames,
				config: { damping: 12 },
			});
			return s;
		}
		default:
			return progress;
	}
}

function computeAnimationStyle(
	type: LayerAnimation["type"],
	progress: number,
	animation: LayerAnimation,
	totalTextLength?: number,
): AnimationResult {
	const noChars = -1; // Show all chars

	switch (type) {
		case "none":
			return { style: {}, visibleChars: noChars };

		case "fade":
			return { style: { opacity: progress }, visibleChars: noChars };

		case "slide-left":
			return {
				style: {
					opacity: progress,
					transform: `translateX(${(1 - progress) * -30}%)`,
				},
				visibleChars: noChars,
			};

		case "slide-right":
			return {
				style: {
					opacity: progress,
					transform: `translateX(${(1 - progress) * 30}%)`,
				},
				visibleChars: noChars,
			};

		case "slide-up":
			return {
				style: {
					opacity: progress,
					transform: `translateY(${(1 - progress) * 30}%)`,
				},
				visibleChars: noChars,
			};

		case "slide-down":
			return {
				style: {
					opacity: progress,
					transform: `translateY(${(1 - progress) * -30}%)`,
				},
				visibleChars: noChars,
			};

		case "typewriter": {
			const chars = totalTextLength ?? 100;
			const visible = Math.floor(progress * chars);
			return { style: { opacity: 1 }, visibleChars: visible };
		}

		case "bounce":
			return {
				style: {
					opacity: Math.min(1, progress * 2),
					transform: `scale(${progress})`,
				},
				visibleChars: noChars,
			};

		case "zoom-in":
			return {
				style: {
					opacity: progress,
					transform: `scale(${progress})`,
				},
				visibleChars: noChars,
			};

		case "zoom-out":
			return {
				style: {
					opacity: progress,
					transform: `scale(${2 - progress})`,
				},
				visibleChars: noChars,
			};

		case "blur-in":
			return {
				style: {
					opacity: progress,
					filter: `blur(${(1 - progress) * 20}px)`,
				},
				visibleChars: noChars,
			};

		case "wipe":
			return {
				style: {
					clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
				},
				visibleChars: noChars,
			};

		case "ken-burns": {
			const fp = animation.focusPoint ?? { x: 0.5, y: 0.5 };
			const scale = 1 + progress * 0.08;
			const tx = (fp.x - 0.5) * progress * 5;
			const ty = (fp.y - 0.5) * progress * 5;
			return {
				style: {
					transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
				},
				visibleChars: noChars,
			};
		}

		case "rotate-in":
			return {
				style: {
					opacity: progress,
					transform: `rotate(${(1 - progress) * -90}deg) scale(${progress})`,
				},
				visibleChars: noChars,
			};

		default:
			return { style: {}, visibleChars: noChars };
	}
}
