// ── Image Crossfade ─────────────────────────────────────────────────────
//
// Multi-image crossfade scene component. Takes 2-4 images and crossfades
// between them with camera motion, creating the illusion of video from
// still images. Inspired by OpenMontage's AnimeScene pattern.
//
// At ~$0.15 per "video" (a few AI-generated images), this is an
// extraordinary value alternative to actual AI video generation.

import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";

export type CrossfadeAnimation =
	| "ken-burns"
	| "pan"
	| "drift-up"
	| "drift-down"
	| "parallax"
	| "zoom-in"
	| "zoom-out"
	| "static";

export interface ImageCrossfadeProps {
	/** 2-4 image URLs to crossfade between */
	images: string[];
	/** Camera animation type applied to each image */
	animation?: CrossfadeAnimation;
	/** Duration of each crossfade transition in frames (default 15) */
	crossfadeDuration?: number;
	/** Whether to add a subtle vignette overlay */
	vignette?: boolean;
	/** CSS gradient color at start of scene */
	lightingFrom?: string;
	/** CSS gradient color at end of scene */
	lightingTo?: string;
}

/**
 * Calculate the camera transform for an image at a given progress (0-1).
 * Each image gets a unique seed so camera motion varies.
 */
function getCameraTransform(
	animation: CrossfadeAnimation,
	progress: number,
	imageIndex: number,
): string {
	const seed = `icf-cam-${imageIndex}`;
	const direction = random(seed) > 0.5 ? 1 : -1;

	switch (animation) {
		case "ken-burns": {
			const startScale = 1.0;
			const endScale = 1.15;
			const scale = startScale + (endScale - startScale) * progress;
			const tx = direction * progress * 3;
			const ty = (random(`${seed}-ty`) > 0.5 ? 1 : -1) * progress * 2;
			return `scale(${scale}) translate(${tx}%, ${ty}%)`;
		}
		case "pan": {
			const tx = direction * (progress - 0.5) * 8;
			return `scale(1.1) translateX(${tx}%)`;
		}
		case "drift-up": {
			const ty = (1 - progress) * 5;
			return `scale(1.08) translateY(${ty}%)`;
		}
		case "drift-down": {
			const ty = progress * 5 - 2.5;
			return `scale(1.08) translateY(${ty}%)`;
		}
		case "parallax": {
			const scale = 1.1 + progress * 0.05;
			const tx = Math.sin(progress * Math.PI) * direction * 3;
			return `scale(${scale}) translateX(${tx}%)`;
		}
		case "zoom-in": {
			const scale = 1.0 + progress * 0.2;
			return `scale(${scale})`;
		}
		case "zoom-out": {
			const scale = 1.2 - progress * 0.15;
			return `scale(${scale})`;
		}
		case "static":
		default:
			return "scale(1.02)";
	}
}

export const ImageCrossfade: React.FC<ImageCrossfadeProps> = ({
	images,
	animation = "ken-burns",
	crossfadeDuration = 15,
	vignette = true,
	lightingFrom,
	lightingTo,
}) => {
	const frame = useCurrentFrame();
	const { durationInFrames } = useVideoConfig();

	// Calculate how long each image is displayed
	const imageCount = Math.max(images.length, 1);
	const totalCrossfadeFrames = crossfadeDuration * Math.max(imageCount - 1, 0);
	const holdFramesPerImage = Math.max((durationInFrames - totalCrossfadeFrames) / imageCount, 10);

	// For each image, calculate its visibility window
	const imageWindows = useMemo(
		() =>
			images.map((_, i) => ({
				start: i * (holdFramesPerImage + crossfadeDuration) - (i > 0 ? crossfadeDuration : 0),
				fadeInEnd: i * (holdFramesPerImage + crossfadeDuration),
				fadeOutStart: i * (holdFramesPerImage + crossfadeDuration) + holdFramesPerImage,
				end: i * (holdFramesPerImage + crossfadeDuration) + holdFramesPerImage + crossfadeDuration,
			})),
		[images.length, holdFramesPerImage, crossfadeDuration],
	);

	// Lighting gradient progress
	const lightingProgress = durationInFrames > 0 ? frame / durationInFrames : 0;

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{images.map((src, i) => {
				const window = imageWindows[i];
				if (!window || frame < window.start || frame > window.end) return null;

				// Calculate opacity for crossfade
				let opacity = 1;
				if (i > 0 && frame < window.fadeInEnd) {
					// Fading in
					opacity = interpolate(frame, [window.start, window.fadeInEnd], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					});
				}
				if (i < images.length - 1 && frame > window.fadeOutStart) {
					// Fading out
					opacity = interpolate(frame, [window.fadeOutStart, window.end], [1, 0], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					});
				}

				// Calculate camera motion progress within this image's window
				const imageProgress = interpolate(frame, [Math.max(window.start, 0), window.end], [0, 1], {
					extrapolateLeft: "clamp",
					extrapolateRight: "clamp",
				});
				const transform = getCameraTransform(animation, imageProgress, i);

				return (
					<AbsoluteFill key={`img-${i}`} style={{ opacity }}>
						<Img
							src={src}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								transform,
								willChange: "transform",
							}}
						/>
					</AbsoluteFill>
				);
			})}

			{/* Lighting overlay */}
			{lightingFrom && lightingTo && (
				<AbsoluteFill
					style={{
						background: `linear-gradient(180deg, ${lightingFrom}, ${lightingTo})`,
						opacity: interpolate(lightingProgress, [0, 1], [0.2, 0.1]),
						mixBlendMode: "overlay",
						pointerEvents: "none",
					}}
				/>
			)}

			{/* Vignette */}
			{vignette && (
				<AbsoluteFill
					style={{
						background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
						pointerEvents: "none",
					}}
				/>
			)}
		</AbsoluteFill>
	);
};
