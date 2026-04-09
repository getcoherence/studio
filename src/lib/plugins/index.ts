// ── Plugin System Entry Point ───────────────────────────────────────────
//
// Import this module to initialize the plugin registry with core plugins.
// Pro/community plugins are loaded separately.

export { pluginRegistry } from "./registry";
export type {
	AnimationPlugin,
	EffectPlugin,
	EnginePlugin,
	ExportTargetPlugin,
	LucidPlugin,
	PluginRegistry,
	SceneTypePlugin,
	TransitionPlugin,
	ViewPlugin,
} from "./types";
