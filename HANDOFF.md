# Lucid Studio — Agent Handoff

## Context
Lucid Studio is an AI-powered video creation tool built with Electron + React + Remotion.
It records websites via a demo agent, generates cinematic promotional videos with AI,
and lets users edit scenes, transitions, effects, music, and export to MP4/YouTube.

**Repo:** `C:\Users\Keith\Documents\lucid` (also at `getcoherence/lucid` on GitHub)
**Tech:** Electron, React 18, Remotion 4.0.443, TypeScript, Vite, TailwindCSS

## Current state (April 2026)

### Layer unification (complete)
All 40+ scene renderers now read from `scene.layers` first via resolve helpers
(`resolveHeadline`, `resolveStringArray`, `resolvePairedArray`, etc.), falling back to
data fields. `renderExtraLayers` is sunset to only user-added overlay layers (`l-` prefix).
Incompatible layers are marked (not deleted) when switching scene types.

### MiniMax video generation pipeline
- `electron/ai/videoService.ts` — 3-step async API (submit → poll → download)
- "AI Video Scenes" toggle in demo chat + per-scene "+ AI Video Clip" button
- `BackgroundVideo` component — plays on mount, seeks only on large drift (>1.5s)
- Videos converted to blob URLs for Remotion playback
- **Known issue:** Playback still needs work — cuts off or flickers in some cases

### Scene type picker
- `src/components/scene-builder/SceneTypePicker.tsx` — rich popover with categories,
  search (including tags), best-fit matching, ASCII layout previews, layer count estimates

### Scene editor improvements
- Collapsible scenes with "Collapse All / Expand All"
- Director model persistence across tab switches
- Per-layer spacing (`spacingAfter`) and scene gap control (`layerGap`)
- Color picker popover with brand swatches (replaces native `<input type="color">`)
- Transition color picker for vertical-shutter, striped-slam, diagonal-reveal, color-burst
- Text carry-over between compatible scene types when switching

### New scene types & layers
- `contrast-pairs` — statement/counter pairs with staggered reveals
- `button` layer type with `ButtonPill` component (racing-border, pulse, glow-pulse, slide-in animations)
- `MoneyRain` background particle effect
- CTA fully layer-driven: logo (`cta-logo`), URL (`cta-url`), button (`cta-pill`) as editable layers
- Plugin registry fallback in compiler — pro/third-party scene types can provide render functions

### Mobile & export
- Aspect ratios: 16:9, 9:16, 1:1, 4:5, 4:3 — persists on project, flows to export
- Export pipeline passes width/height through IPC → Remotion renderer
- Export target buttons: TikTok, Instagram, LinkedIn (open upload pages in browser)

### AI generation
- Creative seed system (8 moods × 7 openers × 4 closings) for variety
- Loosened prompt structure — principles not recipes
- Ghost-hook auto-increment, max 3 video clips, CTA variants
- Director strips layers from prompts to prevent duplicates

### Pro subscription
- Lucid side: `src/lib/plugins/pro/` — proLoader, ProGate, useProStatus (complete)
- Coherence side: `services/auth/src/routes/lucid.routes.ts` — OAuth, subscription check, bundle CDN
- Login page: `redirect=lucid-desktop` sends postMessage with JWT to Electron popup
- Pro bundle: 7 premium scene types, 3 transitions, 3 effects, 3 animations
- Kinetic Typography and Testimonial Card have working renderers; others are stubs

## Architecture

### Key directories
- `src/components/scene-builder/SceneEditor.tsx` — main editor
- `src/components/scene-builder/SceneLayerEditor.tsx` — layer editing panel
- `src/components/scene-builder/SceneTypePicker.tsx` — type picker with categories/search
- `src/components/scene-builder/DirectorChat.tsx` — AI director conversation
- `src/lib/ai/scenePlanCompiler.ts` — compiles scene plans to Remotion JSX code
- `src/lib/ai/scenePlanGenerator.ts` — AI prompt for generating scene plans
- `src/lib/ai/scenePlanDirector.ts` — director refinement prompts
- `src/lib/ai/sceneLayerSync.ts` — declarative layer↔data field sync registry
- `src/lib/ai/aiCinematicEngine.ts` — main AI generation pipeline
- `src/lib/remotion/compileCode.ts` — JIT compiles TSX via MODULE_SCOPE + new Function()
- `src/lib/remotion/helpers/CinematicHelpers.tsx` — 40+ components (BackgroundVideo, ButtonPill, etc.)
- `src/lib/remotion/helpers/ParticleEffects.tsx` — particle overlays (MoneyRain, etc.)
- `src/lib/remotion/helpers/CustomTransitions.tsx` — 6 custom transitions
- `src/lib/remotion/helpers/scenes/*.tsx` — 179 adapted components from remotion-scenes
- `src/lib/plugins/` — plugin system (types, registry, core plugins, pro loader)
- `electron/ai/videoService.ts` — MiniMax video generation
- `electron/export/remotionExport.ts` — SSR export pipeline

### Critical patterns
- `MODULE_SCOPE` in compileCode.ts is the dependency injection for JIT-compiled AI code
- `resolveHeadline(scene)` / `resolveStringArray(scene, prefix, field, fallback)` — layer-first content resolution
- `resolveTextColor(scene)` checks headline layer's color, falls back to auto-contrast
- All UI dropdowns read from `pluginRegistry` (animations, transitions, effects, scene types)
- Plugin `render()` functions are checked as fallback in `renderSceneByTypeInner` default case
- DebouncedInput is uncontrolled (uses ref + defaultValue) to prevent cursor loss
- Scene seeking uses `computeSceneOffsets()` to account for transition overlaps
- `renderExtraLayers` only renders `l-` / `layer-` prefixed user-added overlays
- `LEGACY_SCENE_TYPES` render ALL layers via `compileCenterLayer`/`compileLayer`

## Immediate priorities

1. **Build remaining pro renderers** — 5 of 7 premium scene types are stubs
2. **Video clip playback** — BackgroundVideo needs more robust Remotion integration
3. **Lint cleanup** — Biome errors from this session
4. **Coherence pro endpoints** — test the full OAuth + subscription + bundle flow end-to-end

## Running the app
```bash
cd ~/Documents/lucid
npm run dev
```

## Building
```bash
npm run build  # includes tsc + vite + bundle-remotion.mjs + electron-builder
```
