// ── Plugin Registry ─────────────────────────────────────────────────────
//
// Central registry for all Lucid plugins. Scene types, transitions,
// effects, animations, and export targets all register here.
// The registry is a singleton — import it anywhere to access plugins.

import type {
	AnimationPlugin,
	EffectPlugin,
	ExportTargetPlugin,
	LucidPlugin,
	PluginRegistry,
	SceneTypePlugin,
	TransitionPlugin,
} from "./types";

class PluginRegistryImpl implements PluginRegistry {
	private sceneTypes = new Map<string, SceneTypePlugin>();
	private transitions = new Map<string, TransitionPlugin>();
	private effects = new Map<string, EffectPlugin>();
	private animations = new Map<string, AnimationPlugin>();
	private exportTargets = new Map<string, ExportTargetPlugin>();
	private plugins = new Map<string, LucidPlugin>();

	// ── Registration ────────────────────────────────────────────────────

	registerSceneType(plugin: SceneTypePlugin): void {
		this.sceneTypes.set(plugin.id, plugin);
	}

	registerTransition(plugin: TransitionPlugin): void {
		this.transitions.set(plugin.id, plugin);
	}

	registerEffect(plugin: EffectPlugin): void {
		this.effects.set(plugin.id, plugin);
	}

	registerAnimation(plugin: AnimationPlugin): void {
		this.animations.set(plugin.id, plugin);
	}

	registerExportTarget(plugin: ExportTargetPlugin): void {
		this.exportTargets.set(plugin.id, plugin);
	}

	/** Register a full plugin package (calls its register function) */
	loadPlugin(plugin: LucidPlugin): void {
		if (this.plugins.has(plugin.id)) {
			console.warn(`[PluginRegistry] Plugin "${plugin.id}" already loaded, skipping`);
			return;
		}
		this.plugins.set(plugin.id, plugin);
		plugin.register(this);
		console.log(`[PluginRegistry] Loaded: ${plugin.name} v${plugin.version}`);
	}

	// ── Getters ─────────────────────────────────────────────────────────

	getSceneTypes(): SceneTypePlugin[] {
		return Array.from(this.sceneTypes.values());
	}

	getSceneType(id: string): SceneTypePlugin | undefined {
		return this.sceneTypes.get(id);
	}

	getTransitions(): TransitionPlugin[] {
		return Array.from(this.transitions.values());
	}

	getTransition(id: string): TransitionPlugin | undefined {
		return this.transitions.get(id);
	}

	getEffects(): EffectPlugin[] {
		return Array.from(this.effects.values());
	}

	getEffect(id: string): EffectPlugin | undefined {
		return this.effects.get(id);
	}

	getAnimations(): AnimationPlugin[] {
		return Array.from(this.animations.values());
	}

	getExportTargets(): ExportTargetPlugin[] {
		return Array.from(this.exportTargets.values());
	}

	getLoadedPlugins(): LucidPlugin[] {
		return Array.from(this.plugins.values());
	}

	// ── Convenience ─────────────────────────────────────────────────────

	/** Get all scene type IDs sorted alphabetically */
	getSceneTypeIds(): string[] {
		return Array.from(this.sceneTypes.keys()).sort();
	}

	/** Get all transition IDs */
	getTransitionIds(): string[] {
		return Array.from(this.transitions.keys());
	}

	/** Get all effect IDs */
	getEffectIds(): string[] {
		return Array.from(this.effects.keys());
	}

	/** Get all animation IDs */
	getAnimationIds(): string[] {
		return Array.from(this.animations.keys());
	}

	/** Get scene types grouped by category */
	getSceneTypesByCategory(): Record<string, SceneTypePlugin[]> {
		const groups: Record<string, SceneTypePlugin[]> = {};
		for (const st of this.sceneTypes.values()) {
			const cat = st.category || "other";
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(st);
		}
		return groups;
	}

	/** Get effects grouped by category */
	getEffectsByCategory(): Record<string, EffectPlugin[]> {
		const groups: Record<string, EffectPlugin[]> = {};
		for (const eff of this.effects.values()) {
			const cat = eff.category || "other";
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(eff);
		}
		return groups;
	}
}

/** Global plugin registry singleton */
export const pluginRegistry = new PluginRegistryImpl();
