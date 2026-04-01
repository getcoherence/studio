import { ANIMATED_GRADIENTS } from "./animatedGradients";
import { MESH_GRADIENTS } from "./meshGradients";
import { PARTICLE_BACKGROUNDS } from "./particleBackgrounds";
import type { AnimatedBackground } from "./types";
import { VIDEO_BACKGROUNDS } from "./videoBackgrounds";

export const ANIMATED_BACKGROUNDS: AnimatedBackground[] = [
	...ANIMATED_GRADIENTS,
	...PARTICLE_BACKGROUNDS,
	...MESH_GRADIENTS,
	...VIDEO_BACKGROUNDS,
];

export function getAnimatedBackground(id: string): AnimatedBackground | undefined {
	return ANIMATED_BACKGROUNDS.find((bg) => bg.id === id);
}

export function isAnimatedBackground(wallpaper: string): boolean {
	return ANIMATED_BACKGROUNDS.some((bg) => bg.id === wallpaper);
}

export type { AnimatedBackground } from "./types";
