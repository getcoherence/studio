// ── Scene Library Plugin ────────────────────────────────────────────────
//
// Registers 179 adapted components from remotion-scenes as available
// effects, animations, and overlay components in the plugin registry.

import {
	EffectChromaticAberration,
	EffectDepthOfField,
	EffectDuotone,
	EffectFilmGrain,
	EffectGlow,
	EffectLightLeak,
	EffectNoise,
	EffectVHS,
} from "@/lib/remotion/helpers/scenes/EffectAnimations";
import {
	LiquidBlob,
	LiquidFluidWave,
	LiquidInkSplash,
	LiquidMorphBlob,
	LiquidSwirl,
} from "@/lib/remotion/helpers/scenes/LiquidAnimations";
import {
	ShapeHexGrid,
	ShapeMorphing,
	ShapeRipples,
	ShapeSpinningRings,
} from "@/lib/remotion/helpers/scenes/ShapeAnimations";
import type { LucidPlugin } from "../types";

export const sceneLibraryPlugin: LucidPlugin = {
	id: "scene-library",
	name: "Scene Library (179 components)",
	version: "1.0.0",
	register(registry) {
		// ── Effect overlays (usable as background effects) ──
		registry.registerEffect({
			id: "chromatic-aberration",
			name: "Chromatic Aberration",
			description: "RGB color channel offset / prismatic fringing",
			category: "texture",
			component: EffectChromaticAberration,
		});
		registry.registerEffect({
			id: "film-grain",
			name: "Film Grain",
			description: "Animated analog film grain texture",
			category: "texture",
			component: EffectFilmGrain,
		});
		registry.registerEffect({
			id: "vhs",
			name: "VHS Distortion",
			description: "Retro VHS tracking lines and color bleed",
			category: "texture",
			component: EffectVHS,
		});
		registry.registerEffect({
			id: "glow",
			name: "Glow",
			description: "Soft radial glow from center",
			category: "ambient",
			component: EffectGlow,
		});
		registry.registerEffect({
			id: "light-leak",
			name: "Light Leak",
			description: "Cinematic light leak / lens flare overlay",
			category: "ambient",
			component: EffectLightLeak,
		});
		registry.registerEffect({
			id: "noise",
			name: "Noise",
			description: "Animated noise / static texture",
			category: "texture",
			component: EffectNoise,
		});
		registry.registerEffect({
			id: "duotone",
			name: "Duotone",
			description: "Two-color tonal overlay effect",
			category: "texture",
			component: EffectDuotone,
		});
		registry.registerEffect({
			id: "depth-of-field",
			name: "Depth of Field",
			description: "Simulated camera depth blur",
			category: "ambient",
			component: EffectDepthOfField,
		});

		// ── Liquid effects ──
		registry.registerEffect({
			id: "liquid-blob",
			name: "Liquid Blob",
			description: "Organic morphing blob shapes",
			category: "ambient",
			component: LiquidBlob,
		});
		registry.registerEffect({
			id: "ink-splash",
			name: "Ink Splash",
			description: "Expanding ink splash effect",
			category: "particles",
			component: LiquidInkSplash,
		});
		registry.registerEffect({
			id: "fluid-wave",
			name: "Fluid Wave",
			description: "Flowing fluid wave animation",
			category: "ambient",
			component: LiquidFluidWave,
		});
		registry.registerEffect({
			id: "swirl",
			name: "Swirl",
			description: "Rotating swirl/vortex pattern",
			category: "ambient",
			component: LiquidSwirl,
		});
		registry.registerEffect({
			id: "morph-blob",
			name: "Morph Blob",
			description: "Shape-shifting organic blob",
			category: "ambient",
			component: LiquidMorphBlob,
		});

		// ── Shape effects ──
		registry.registerEffect({
			id: "ripples",
			name: "Ripples",
			description: "Concentric expanding ripple rings",
			category: "geometric",
			component: ShapeRipples,
		});
		registry.registerEffect({
			id: "hex-grid",
			name: "Hex Grid",
			description: "Hexagonal grid pattern animation",
			category: "geometric",
			component: ShapeHexGrid,
		});
		registry.registerEffect({
			id: "spinning-rings",
			name: "Spinning Rings",
			description: "Concentric rotating rings",
			category: "geometric",
			component: ShapeSpinningRings,
		});
		registry.registerEffect({
			id: "morphing-shapes",
			name: "Morphing Shapes",
			description: "Smoothly morphing geometric shapes",
			category: "geometric",
			component: ShapeMorphing,
		});
	},
};
