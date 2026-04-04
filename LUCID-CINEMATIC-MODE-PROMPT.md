# Lucid Studio — Cinematic Composition Mode

## What is Lucid?
Electron + React + Vite screen recorder and AI video creation tool at `C:\Users\Keith\Documents\lucid\`. The "AI Demo Studio" feature browses a website autonomously (Phase 1: recon, Phase 2: AI storyboard, Phase 3: screenshot capture), then generates a SceneProject (JSON data model) that gets rendered in a Scene Editor.

## What exists already

### Two renderers (both work):
- **Canvas 2D** — existing, renders SceneProject to canvas with 14 animation types. Good for screenshot-heavy product demos.
- **Remotion** — just added (`src/lib/remotion/`). `@remotion/player` preview works in Scene Editor via Canvas/Remotion toggle. Maps SceneProject layers to React/HTML/CSS components. All animations ported.

### Key files:
- `src/lib/scene-renderer/types.ts` — SceneProject data model (Scene, SceneLayer, animations)
- `src/lib/ai/compositionEngine.ts` — converts DemoSteps → SceneProject using template scoring
- `src/lib/ai/compositionTemplates.ts` — 10 templates (titleCard, heroReveal, deviceMockup, featureSpotlight, splitReveal, offsetCard, statsBanner, typingSequence, simpleScreenshot + textOnly via titleCard)
- `src/lib/remotion/` — RemotionLayer.tsx, RemotionScene.tsx, SceneProjectComposition.tsx, useLayerAnimation.ts, RemotionPreview.tsx
- `src/components/demo-studio/useDemoAgent.ts` — three-phase agent with storyboard generation
- `src/components/demo-studio/types.ts` — DemoStep with headline, narration, screenshots, UI elements, analysis
- `src/components/scene-builder/SceneEditor.tsx` — editor with Canvas/Remotion toggle

### What the agent captures during Phase 3:
- Screenshots (data URLs) per storyboard scene
- `headline` (3-6 word visual text) and `narration` (voiceover sentence)
- `focusPoint` (saliency peak from canvas analysis)
- `cropRegion` (section bounds from DOM)
- `uiElements[]` (cards, sections, heading groups with bounding boxes from live DOM)
- `analysis` (dominant colors, complexity score, isDarkTheme)

## What needs to be built

### The Problem
Remotion currently renders the SAME SceneProject as canvas — same screenshots dumped into layouts. This looks no better than the canvas version. We need a **Cinematic composition mode** that generates fundamentally different content optimized for Remotion's capabilities.

### North Star (reference: Adaptive.ai product video)
See `C:\Users\Keith\.claude\projects\C--Users-Keith-Documents-brightyard-platform\memory\project_lucid_video_north_star.md` for full analysis. Key patterns:
- **Bold text-only slides**: massive serif font, dead center, clean black/white bg. "Stop reacting", "Let an agent handle it"
- **Per-character text animations**: each letter fades in with color gradient + stagger
- **Rolling number counters**: $0 → $465 odometer effect
- **Tight UI element crops**: single card/button floating on dark bg with shadow — NOT full page screenshots
- **Fast cuts**: 1-2 seconds per scene
- **Minimal screenshots**: most scenes are pure typography. Screenshots only for 2-3 key product moments.
- **Notification storytelling**: animated cards appearing one by one

### Implementation Plan

1. **Output Style selector in Demo Studio** — add next to Evangelist/Product Tour modes: "Product Demo" (canvas) vs "Cinematic" (Remotion). This controls both composition strategy AND default renderer.

2. **`src/lib/ai/cinematicCompositionEngine.ts`** (NEW) — generates SceneProject optimized for Remotion:
   - ~70% text-only scenes (bold headline on black, blur-in or per-character entrance)
   - ~20% tight UI element crops (single card/feature on dark bg with shadow)
   - ~10% full page in device mockup (hero + closing)
   - Uses headline for visual text, narration stays for TTS voiceover
   - Fast pacing: 1.5-2.5s per scene
   - Extracts brand colors from screenshot analysis for accent elements

3. **New Remotion-specific components**:
   - `src/lib/remotion/text/PerCharacterText.tsx` — split text into `<span>` per character, staggered spring animation on opacity + translateY
   - `src/lib/remotion/text/RollingNumber.tsx` — digit-by-digit odometer counter
   - `src/lib/remotion/components/FloatingCard.tsx` — UI element crop floating on dark bg with perspective transform + shadow

4. **Brand extraction during recon** — during Phase 1, extract the product's primary colors, font families, and logo from the DOM. Store on the site map. The cinematic engine uses these for accent colors and typography matching.

5. **Wire "Open in Editor"** — when Cinematic mode was used, default to Remotion preview (not canvas). Pass the mode choice through to the SceneProject metadata.

### How to test
1. `npm run dev` in `C:\Users\Keith\Documents\lucid\`
2. Open AI Demo Studio → select "Cinematic" output style
3. Enter URL (e.g., http://localhost:3000), run Evangelist Pitch
4. Click "Open in Editor" → should show Remotion preview with cinematic composition
5. Play back → bold text slides, fast cuts, tight element crops, clean backgrounds
6. Compare with "Product Demo" mode which uses canvas + screenshot-heavy templates
