# Lucid Studio — Agent Handoff

## Context
Lucid Studio is an AI-powered video creation tool built with Electron + React + Remotion.
It records websites via a demo agent, generates cinematic promotional videos with AI,
and lets users edit scenes, transitions, effects, music, and export to MP4/YouTube.

**Repo:** `C:\Users\Keith\Documents\lucid` (also at `getcoherence/lucid` on GitHub)
**Tech:** Electron, React 18, Remotion 4.0.443, TypeScript, Vite, TailwindCSS

## Architecture

### Key directories
- `src/components/scene-builder/SceneEditor.tsx` — main editor (3000+ lines)
- `src/components/scene-builder/SceneLayerEditor.tsx` — layer editing panel
- `src/lib/ai/scenePlanCompiler.ts` — compiles scene plans to Remotion JSX code
- `src/lib/ai/scenePlanGenerator.ts` — AI prompt for generating scene plans
- `src/lib/ai/sceneLayerSync.ts` — declarative layer↔data field sync registry
- `src/lib/ai/aiCinematicEngine.ts` — main AI generation pipeline
- `src/lib/remotion/compileCode.ts` — JIT compiles TSX via MODULE_SCOPE + new Function()
- `src/lib/remotion/helpers/CinematicHelpers.tsx` — 40+ scene components
- `src/lib/remotion/helpers/ParticleEffects.tsx` — particle overlay components
- `src/lib/remotion/helpers/CustomTransitions.tsx` — 6 custom transitions
- `src/lib/remotion/helpers/scenes/*.tsx` — 179 adapted components from remotion-scenes
- `src/lib/plugins/` — plugin system (types, registry, core plugins, pro loader)
- `electron/export/remotionExport.ts` — SSR export pipeline

### Critical patterns
- `MODULE_SCOPE` in compileCode.ts is the dependency injection for JIT-compiled AI code
- `useCurrentFrame()` in IIFEs returns GLOBAL frame — use `React.createElement(() => { ... })` pattern instead
- `resolveTextColor(scene)` checks headline layer's color picker, falls back to auto-contrast
- All UI dropdowns read from `pluginRegistry` (animations, transitions, effects, scene types)
- DebouncedInput is uncontrolled (uses ref + defaultValue) to prevent cursor loss
- Scene seeking uses `computeSceneOffsets()` to account for transition overlaps
- Playhead preserved across recompiles via `currentPlayerFrameRef`

## Immediate priorities (see project_lucid_next_session.md)

1. **Register more scene library components** — 179 adapted but only ~25 registered as plugins
2. **Test AI generator** with deep content extraction on real sites
3. **Ghost-hook bug** — AI repeats same sentence 3x instead of incrementing activeIndex
4. **CTA button contrast** — light accent colors make white button text invisible
5. **Layer unification** — eliminate primary/extra distinction (see project_lucid_layer_unification.md)
6. **Coherence pro endpoints** — OAuth, subscription check, bundle CDN (see project_lucid_pro_subscription.md)
7. **Before/after** — panel color pickers are wired but need testing
8. **Mobile aspect ratios** — 9:16, 1:1, 4:5 for TikTok/Reels

## Running the app
```bash
cd ~/Documents/lucid
npm run dev
```

## Building
```bash
npm run build  # includes tsc + vite + bundle-remotion.mjs + electron-builder
```
