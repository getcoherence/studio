// ── Core Plugin Loader ──────────────────────────────────────────────────
//
// Loads all built-in plugins into the registry. This runs once at app start.
// Pro/community plugins are loaded separately after this.

import { pluginRegistry } from "../registry";
import { coreAnimationsPlugin } from "./animations";
import { coreEffectsPlugin } from "./effects";
import { coreSceneTypesPlugin } from "./sceneTypes";
import { coreTransitionsPlugin } from "./transitions";

export function loadCorePlugins(): void {
	pluginRegistry.loadPlugin(coreSceneTypesPlugin);
	pluginRegistry.loadPlugin(coreTransitionsPlugin);
	pluginRegistry.loadPlugin(coreEffectsPlugin);
	pluginRegistry.loadPlugin(coreAnimationsPlugin);

	console.log(
		`[Plugins] Core loaded: ${pluginRegistry.getSceneTypes().length} scene types, ` +
		`${pluginRegistry.getTransitions().length} transitions, ` +
		`${pluginRegistry.getEffects().length} effects, ` +
		`${pluginRegistry.getAnimations().length} animations`,
	);
}
