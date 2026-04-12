# Animation Engine Spec - Coherence Studio

## Overview

Five-phase plan to transform Studio from a scene-type-based video generator into a
full animation engine with quality enforcement, visual richness, animation library
integrations, GPU-accelerated effects, and production intelligence.

Inspired by OpenMontage's architecture (quality gates, delivery promises, deterministic
particles, shot language) combined with best-in-class animation libraries (Lottie,
anime.js, PixiJS, Theatre.js).

---

## Phase 1: Quality Gates

**Goal:** Prevent the "animated PowerPoint" failure mode. Score every scene plan before
rendering and block/revise plans that would produce low-quality output.

### 1.1 Slideshow Risk Scorer

**File:** `src/lib/ai/qualityGates.ts`

Scores a `ScenePlan` across 6 dimensions (0-1 each, weighted):

| Dimension | Weight | What it catches |
|-----------|--------|-----------------|
| `repetition` | 0.20 | 3+ consecutive same-type scenes |
| `decorative_visuals` | 0.15 | Scenes with no content purpose (just pretty) |
| `weak_motion` | 0.20 | Over-reliance on zoom/pan on stills instead of real animation |
| `weak_shot_intent` | 0.15 | Scenes with no clear cinematography purpose |
| `typography_overreliance` | 0.20 | >60% of scenes are text-only (hero-text, impact-word, etc.) |
| `unsupported_cinematic` | 0.10 | Using "cinematic" types without supporting structure |

**Scoring thresholds:**
- `>= 4.0` total (weighted sum * 10) = BLOCK (do not render)
- `>= 3.0` total = REVISE (AI must address flagged issues)
- `< 3.0` = PASS

```typescript
interface SlideshowRiskResult {
  score: number;                          // 0-10 weighted total
  verdict: 'pass' | 'revise' | 'block';
  dimensions: Record<string, { score: number; details: string }>;
  suggestions: string[];                  // actionable fixes
}

function scoreSlideshowRisk(plan: ScenePlan): SlideshowRiskResult;
```

### 1.2 Variation Checker

**File:** `src/lib/ai/qualityGates.ts`

Rules:
- No 3+ consecutive scenes with the same `type`
- No 3+ consecutive scenes with the same `animation`
- No 3+ consecutive scenes with the same `background` (or same preset family)
- No 4+ consecutive scenes all lacking `backgroundEffect`
- At least 2 different transition types used across the plan
- Warn if all scenes use the same font

```typescript
interface VariationResult {
  passed: boolean;
  violations: Array<{
    rule: string;
    sceneIndices: number[];
    suggestion: string;
  }>;
}

function checkVariation(plan: ScenePlan): VariationResult;
```

### 1.3 Delivery Promise

**File:** `src/lib/ai/qualityGates.ts`

Classifies what the video promises to deliver, then enforces it:

```typescript
type DeliveryPromiseType =
  | 'motion_led'        // primarily animated/motion graphics
  | 'data_explainer'    // data visualization focused
  | 'source_led'        // relies on source video/screenshots
  | 'hybrid_motion'     // mix of motion + source material
  | 'text_narrative'    // text-driven storytelling (acceptable for some use cases)
  ;

interface DeliveryPromise {
  type: DeliveryPromiseType;
  minimumMotionRatio: number;     // % of scenes that must have real animation
  minimumEffectCoverage: number;  // % of scenes with backgroundEffect or particles
  minimumTypeVariety: number;     // minimum distinct scene types
}

function classifyPromise(plan: ScenePlan): DeliveryPromise;
function validatePromise(plan: ScenePlan, promise: DeliveryPromise): {
  honored: boolean;
  violations: string[];
};
```

### Integration Point

Called in the scene plan compilation pipeline — after AI generates a plan, before
compiling to Remotion code. The UI shows the risk score and any suggestions.

Add to `ScenePlan`:
```typescript
interface ScenePlan {
  // ... existing fields ...
  /** Quality assessment (populated after scoring) */
  qualityScore?: SlideshowRiskResult;
  /** What this video promises to deliver */
  deliveryPromise?: DeliveryPromiseType;
}
```

---

## Phase 2: Pure Remotion Visual Richness

**Goal:** More visual primitives using zero new dependencies. Pure Remotion + CSS.

### 2.1 New Deterministic Particle Types

**File:** `src/lib/remotion/helpers/ParticleEffects.tsx` (extend existing)

Add 5 new particle components using the same `random()` seeding pattern:

| Component | Description | Use case |
|-----------|-------------|----------|
| `Mist` | Slow-moving translucent cloud layers | Cinematic, moody backgrounds |
| `LightRays` | Diagonal light shafts with fade | Epic reveals, spiritual content |
| `Bubbles` | Rising translucent circles with wobble | Playful, tech, underwater |
| `Embers` | Rising glowing particles with drift | Energy, transformation |
| `Stars` | Twinkling static star field | Space, night, premium |

Each follows the existing pattern:
- Uses `random()` with unique seed prefixes for determinism
- `count`, `color`, `intensity` props
- `useMemo` for particle generation, `useCurrentFrame` for animation
- Registered as EffectPlugin in `src/lib/plugins/core/effects.ts`
- Added to MODULE_SCOPE in `compileCode.ts`

### 2.2 Multi-Image Crossfade Scene Type

**File:** `src/lib/plugins/core/sceneTypes.ts` (new registration)
**Helper:** `src/lib/remotion/helpers/CinematicHelpers.tsx` (new component)

New scene type: `image-crossfade`

```typescript
// New component in CinematicHelpers.tsx
interface ImageCrossfadeProps {
  images: string[];                    // 2-4 image URLs
  animation?: 'ken-burns' | 'pan' | 'drift-up' | 'drift-down' | 'parallax' | 'zoom-in' | 'zoom-out' | 'static';
  crossfadeDuration?: number;          // frames for each crossfade (default 15)
  particleOverlay?: 'fireflies' | 'petals' | 'sparkles' | 'mist' | 'light-rays' | 'none';
  particleColor?: string;
  vignette?: boolean;
  lightingFrom?: string;               // CSS gradient start color
  lightingTo?: string;                 // CSS gradient end color
}
```

Add to `ScenePlanItem`:
```typescript
interface ScenePlanItem {
  // ... existing ...
  /** For image-crossfade: 2-4 image URLs to crossfade between */
  crossfadeImages?: string[];
  /** For image-crossfade: camera animation type */
  crossfadeAnimation?: 'ken-burns' | 'pan' | 'drift-up' | 'drift-down' | 'parallax' | 'zoom-in' | 'zoom-out';
  /** For image-crossfade: particle overlay type */
  crossfadeParticles?: 'fireflies' | 'petals' | 'sparkles' | 'mist' | 'light-rays' | 'none';
}
```

### 2.3 Theme System (ThemeConfig)

**File:** `src/lib/ai/themeConfig.ts` (new)

Structured theme configuration that flows from brand settings to every Remotion component.

```typescript
export interface ThemeConfig {
  // Colors
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;

  // Typography
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  fontScale: 'compact' | 'default' | 'spacious';

  // Motion
  springConfig: { damping: number; stiffness: number; mass: number };
  transitionDuration: number;          // default frames for transitions
  pacing: 'fast' | 'normal' | 'cinematic';  // affects scene durations

  // Visual style
  chartColors: string[];
  particleStyle: 'warm' | 'cool' | 'neon' | 'minimal' | 'none';
  backgroundStyle: 'dark' | 'light' | 'gradient' | 'mesh';

  // Captions (for future use)
  captionHighlightColor: string;
  captionBackgroundColor: string;
}

/** Build a ThemeConfig from brand data */
function buildTheme(opts: {
  accentColor: string;
  logoUrl?: string;
  mood?: string;                       // 'professional' | 'playful' | 'cinematic' | 'minimal'
  darkMode?: boolean;
}): ThemeConfig;

/** Pre-built theme presets */
const THEME_PRESETS: Record<string, ThemeConfig>;
// 'clean-professional', 'bold-startup', 'cinematic-dark', 'minimal-light',
// 'neon-tech', 'warm-editorial', 'anime-pop'
```

Add to `ScenePlan`:
```typescript
interface ScenePlan {
  // ... existing ...
  /** Theme configuration — drives all visual decisions */
  theme?: ThemeConfig;
  /** Theme preset name (alternative to full theme object) */
  themePreset?: string;
}
```

### 2.4 Shot Language Schema

**File:** `src/lib/ai/scenePlan.ts` (extend `ScenePlanItem`)

Add structured cinematography fields for AI scene planning:

```typescript
interface ScenePlanItem {
  // ... existing ...

  /** Cinematography intent — guides visual treatment */
  shotIntent?: {
    /** Shot size hint for the AI code generator */
    shotSize?: 'extreme-wide' | 'wide' | 'medium-wide' | 'medium' | 'medium-close' | 'close' | 'extreme-close';
    /** Camera movement to simulate */
    cameraMovement?: 'static' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'zoom-in' | 'zoom-out' | 'dolly' | 'drift';
    /** Lighting style */
    lightingKey?: 'high' | 'low' | 'silhouette' | 'rim' | 'dramatic' | 'natural';
    /** Depth effect */
    depthOfField?: 'deep' | 'shallow';
    /** Narrative purpose of this scene */
    narrativeRole?: 'hook' | 'problem' | 'solution' | 'evidence' | 'transition' | 'climax' | 'cta';
    /** Information role */
    informationRole?: 'introduce' | 'explain' | 'demonstrate' | 'compare' | 'summarize' | 'persuade';
  };
}
```

---

## Phase 3: Animation Library Integrations

**Goal:** Integrate anime.js for rich CSS/property animations and expand the Lottie pipeline.

### 3.1 anime.js Integration

**File:** `src/lib/remotion/helpers/AnimeHelper.tsx` (new)

Core hook that bridges anime.js timeline to Remotion's frame system:

```typescript
import { useCurrentFrame, useVideoConfig } from 'remotion';
import anime from 'animejs';

/**
 * Hook that creates an anime.js timeline synced to Remotion frames.
 * The timeline is created once, then seeked to the current frame's time position.
 *
 * Usage:
 *   const containerRef = useAnimeTimeline((targets) => {
 *     return anime.timeline({ autoplay: false })
 *       .add({ targets: targets('.title'), translateY: [-50, 0], opacity: [0, 1], duration: 600 })
 *       .add({ targets: targets('.subtitle'), translateY: [30, 0], opacity: [0, 1], duration: 400 }, '-=200');
 *   });
 *
 *   return <div ref={containerRef}>
 *     <h1 className="title">Hello</h1>
 *     <p className="subtitle">World</p>
 *   </div>;
 */
function useAnimeTimeline(
  factory: (targets: (selector: string) => string) => anime.AnimeTimelineInstance,
  deps?: any[]
): React.RefObject<HTMLDivElement>;

/**
 * Pre-built anime.js animation presets for common patterns.
 * Each returns a factory function compatible with useAnimeTimeline.
 */
const ANIME_PRESETS = {
  /** Staggered text reveal with elastic easing */
  staggerReveal: (opts?: { stagger?: number; easing?: string }) => AnimationFactory,
  /** Counter animation for numbers */
  counterUp: (opts?: { duration?: number }) => AnimationFactory,
  /** Cards fanning in from a stack */
  cardFan: (opts?: { spread?: number }) => AnimationFactory,
  /** Elastic bounce entrance */
  elasticEntrance: (opts?: { scale?: number }) => AnimationFactory,
  /** SVG path draw */
  pathDraw: (opts?: { duration?: number }) => AnimationFactory,
  /** Staggered list items */
  listStagger: (opts?: { direction?: 'up' | 'down' | 'left' | 'right' }) => AnimationFactory,
  /** Morphing between values */
  morphValues: (opts?: { from: any; to: any }) => AnimationFactory,
};
```

Register in MODULE_SCOPE:
```typescript
// In compileCode.ts MODULE_SCOPE:
useAnimeTimeline,
ANIME_PRESETS,
```

### 3.2 Enhanced Lottie Pipeline

**File:** `src/lib/lottie/lottieCatalog.ts` (new)

Indexed catalog of Lottie animations with metadata for AI selection:

```typescript
interface LottieCatalogEntry {
  id: string;
  name: string;
  /** Category for browsing/filtering */
  category: 'transition' | 'text-effect' | 'overlay' | 'icon' | 'background' | 'decoration' | 'data-viz';
  /** Tags for AI search */
  tags: string[];
  /** When this animation fits best */
  bestFor: string[];
  /** Source: 'builtin' | 'lottiefiles' | 'user' | 'contributor' */
  source: string;
  /** Animation data (inline JSON) or URL */
  data: object | string;
  /** Duration in ms */
  durationMs: number;
  /** Can colors be parameterized? */
  colorizable: boolean;
  /** Default colors that can be swapped */
  defaultColors?: Record<string, string>;
}

/** Search the catalog by tags, category, or free text */
function searchLottieCatalog(query: string, opts?: {
  category?: string;
  limit?: number;
}): LottieCatalogEntry[];

/** Parameterize a Lottie animation — swap colors, text, timing */
function parameterizeLottie(
  animationData: object,
  params: {
    colorMap?: Record<string, string>;   // old hex → new hex
    textMap?: Record<string, string>;    // layer name → new text
    speedMultiplier?: number;
  }
): object;
```

### 3.3 Contributor Preset Format

**File:** `src/lib/plugins/contributorFormat.ts` (new)

Standardized format for community contributions:

```typescript
/** Community-contributed animation preset */
interface AnimationPreset {
  id: string;
  name: string;
  author: string;
  version: string;
  type: 'anime-timeline' | 'lottie' | 'particle-config' | 'theme' | 'scene-variant';
  tags: string[];
  license: 'MIT' | 'CC-BY' | 'CC0';
  /** The preset payload — varies by type */
  payload: AnimeTimelinePreset | LottieCatalogEntry | ParticleConfig | ThemeConfig | SceneVariantConfig;
}

/** anime.js timeline preset — JSON-serializable */
interface AnimeTimelinePreset {
  steps: Array<{
    targets: string;           // CSS selector relative to container
    properties: Record<string, [any, any]>;  // prop → [from, to]
    duration: number;
    easing: string;
    offset?: string;           // timeline offset (e.g. '-=200')
    stagger?: number;
  }>;
}

/** Particle effect configuration */
interface ParticleConfig {
  type: 'mist' | 'light-rays' | 'bubbles' | 'embers' | 'stars' | 'custom';
  count: number;
  colors: string[];
  intensity: number;
  /** For custom: inline component code (evaluated in sandbox) */
  customCode?: string;
}
```

---

## Phase 4: Advanced Visual Engine

**Goal:** GPU-accelerated effects via PixiJS for visual ceiling-raising.

### 4.1 PixiJS Overlay Component

**File:** `src/lib/remotion/helpers/PixiOverlay.tsx` (new)

```typescript
import { Application, Container } from 'pixi.js';

interface PixiOverlayProps {
  /** Effect descriptors to render */
  effects: PixiEffectDescriptor[];
  /** Opacity of the overlay (0-1) */
  opacity?: number;
}

type PixiEffectDescriptor =
  | { type: 'particles'; config: PixiParticleConfig }
  | { type: 'filter'; config: PixiFilterConfig }
  | { type: 'shader'; config: PixiShaderConfig }
  ;

interface PixiParticleConfig {
  preset: 'confetti-burst' | 'fire' | 'smoke' | 'rain' | 'dust' | 'custom';
  count: number;
  colors: string[];
  gravity: number;
  velocity: { min: number; max: number };
  lifetime: { min: number; max: number };
  /** Frame-seeded RNG for deterministic rendering */
  seed?: string;
}

interface PixiFilterConfig {
  preset: 'film-grain' | 'vhs-scanlines' | 'chromatic-aberration' | 'glitch' | 'heat-distortion' | 'crt';
  intensity: number;
  /** Custom uniforms to pass to the shader */
  uniforms?: Record<string, number>;
}

interface PixiShaderConfig {
  /** GLSL fragment shader source */
  fragmentShader: string;
  uniforms: Record<string, number | number[]>;
}

/**
 * The component:
 * 1. Creates a PixiJS Application with ticker stopped
 * 2. On each Remotion frame, updates all effects based on frame/fps
 * 3. Calls app.render() manually for deterministic output
 * 4. Renders on a transparent canvas overlaid on scene content
 */
const PixiOverlay: React.FC<PixiOverlayProps>;
```

Register in MODULE_SCOPE and as EffectPlugins.

### 4.2 Pre-built PixiJS Effect Presets

**File:** `src/lib/remotion/helpers/pixiPresets.ts` (new)

```typescript
const PIXI_PRESETS: Record<string, PixiEffectDescriptor[]> = {
  'film-grain-light': [{ type: 'filter', config: { preset: 'film-grain', intensity: 0.3 } }],
  'film-grain-heavy': [{ type: 'filter', config: { preset: 'film-grain', intensity: 0.7 } }],
  'vhs-retro': [
    { type: 'filter', config: { preset: 'vhs-scanlines', intensity: 0.5 } },
    { type: 'filter', config: { preset: 'chromatic-aberration', intensity: 0.3 } },
  ],
  'glitch-subtle': [{ type: 'filter', config: { preset: 'glitch', intensity: 0.2 } }],
  'cinematic-grain': [
    { type: 'filter', config: { preset: 'film-grain', intensity: 0.15 } },
    { type: 'particles', config: { preset: 'dust', count: 20, colors: ['#ffffff'], gravity: -0.02, velocity: { min: 0.1, max: 0.5 }, lifetime: { min: 30, max: 90 } } },
  ],
  'heat-wave': [{ type: 'filter', config: { preset: 'heat-distortion', intensity: 0.4 } }],
};
```

---

## Phase 5: Production Intelligence

**Goal:** Give Studio's AI better production knowledge and bridge to Nash.

### 5.1 Knowledge Layer (Studio-Local Skill Files)

**Directory:** `src/lib/ai/skills/` (new)

Markdown skill files that get injected into the AI's system prompt when generating
scene plans. These teach the AI production conventions:

```
src/lib/ai/skills/
  composition.md          — scene sequencing, pacing, narrative arc
  visual-variety.md       — variant selection, avoiding repetition
  cinematography.md       — shot language, when to use each shot type
  transitions.md          — transition selection based on energy/mood
  color-theory.md         — palette selection, contrast, brand adaptation
  typography.md           — font pairing, size hierarchy, readability
  data-visualization.md   — chart type selection, metric presentation
  effects.md              — when to use particles, overlays, filters
```

Each skill file follows a structure:
```markdown
# Skill: [Name]

## When to Apply
[Conditions that trigger this skill's advice]

## Rules
[Concrete, actionable rules the AI must follow]

## Examples
[Good and bad examples with explanations]

## Common Mistakes
[Anti-patterns to avoid]
```

### 5.2 Nash Video Brief Format

**File:** `packages/sdk/src/types/video-brief.ts` (in platform repo)

Defines the contract between Nash (creative director) and Studio (rendering engine):

```typescript
/** Video brief generated by Nash, consumed by Studio */
export interface VideoBrief {
  /** Brief ID for tracking */
  id: string;
  /** Account/workspace context */
  accountId: string;
  /** What the video should communicate */
  objective: string;
  /** Key messages to convey (ordered by priority) */
  keyMessages: string[];
  /** Target audience */
  audience: string;
  /** Tone/mood */
  mood: 'professional' | 'playful' | 'urgent' | 'cinematic' | 'minimal';
  /** Brand assets */
  brand: {
    name: string;
    accentColor: string;
    logoUrl?: string;
    websiteUrl?: string;
    tagline?: string;
  };
  /** Content to include */
  content: {
    /** Statistics/metrics to highlight */
    metrics?: Array<{ value: string; label: string; context?: string }>;
    /** Testimonials/quotes */
    quotes?: Array<{ text: string; author: string }>;
    /** Features/benefits to showcase */
    features?: Array<{ title: string; description: string; icon?: string }>;
    /** Before/after comparisons */
    comparisons?: Array<{ before: string; after: string }>;
    /** Screenshots/images */
    images?: string[];
  };
  /** Duration preference */
  targetDurationSeconds?: number;
  /** Format */
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
  /** Quality/delivery preferences */
  deliveryPromise?: DeliveryPromiseType;
  /** Theme preset preference */
  themePreset?: string;
}
```

### 5.3 Feedback Loop (Nash Memory Integration)

When a user edits an AI-generated video in Studio:
1. Studio tracks what was changed (scenes reordered, text edited, effects added/removed)
2. On export, Studio summarizes the delta as a "production note"
3. Production note is sent back to the platform via API
4. Nash stores it as a standing directive in the account's agent memory

Example production note:
```json
{
  "accountId": "...",
  "note": "User prefers faster pacing (reduced scene durations by 30%), always adds particle effects to CTA scenes, replaced default font with condensed, prefers dark backgrounds",
  "source": "studio-edit-delta",
  "timestamp": "2026-04-09T..."
}
```

This becomes a Nash memory entry that influences future video briefs.

---

## File Map

| Phase | New/Modified File | Purpose |
|-------|-------------------|---------|
| 1 | `src/lib/ai/qualityGates.ts` | Slideshow risk, variation, delivery promise |
| 1 | `src/lib/ai/scenePlan.ts` | Add qualityScore, deliveryPromise to ScenePlan |
| 2 | `src/lib/remotion/helpers/ParticleEffects.tsx` | 5 new particle types |
| 2 | `src/lib/remotion/helpers/CinematicHelpers.tsx` | ImageCrossfade component |
| 2 | `src/lib/ai/themeConfig.ts` | ThemeConfig system + presets |
| 2 | `src/lib/ai/scenePlan.ts` | Add theme, shotIntent to types |
| 2 | `src/lib/plugins/core/effects.ts` | Register new particles |
| 2 | `src/lib/plugins/core/sceneTypes.ts` | Register image-crossfade |
| 2 | `src/lib/remotion/compileCode.ts` | Add new components to MODULE_SCOPE |
| 3 | `src/lib/remotion/helpers/AnimeHelper.tsx` | useAnimeTimeline hook + presets |
| 3 | `src/lib/lottie/lottieCatalog.ts` | Lottie catalog + parameterization |
| 3 | `src/lib/plugins/contributorFormat.ts` | Contributor preset format |
| 4 | `src/lib/remotion/helpers/PixiOverlay.tsx` | PixiJS integration |
| 4 | `src/lib/remotion/helpers/pixiPresets.ts` | Pre-built PixiJS effects |
| 5 | `src/lib/ai/skills/*.md` | AI production knowledge |
| 5 | `packages/sdk/src/types/video-brief.ts` | Nash ↔ Studio contract (platform repo) |
