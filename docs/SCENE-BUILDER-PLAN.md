# Scene Builder — Motion Design Video Creator

## Vision

A "Build" mode alongside the existing "Record" mode. Instead of recording your screen, you create polished product demos, explainers, and marketing videos by composing scenes with animated text, images, and transitions.

**Think:** Canva Video + After Effects lite + AI-powered generation

## User Flow

1. **Welcome Screen** → "New Recording" OR **"Create Video"** (new button)
2. **Scene Editor** opens — timeline of scenes, each with layers (text, images, shapes)
3. User adds/edits scenes:
   - Type text → pick animation (typewriter, fade, slide-in, wipe, bounce)
   - Drop screenshots/images → pick entrance animation (zoom, pan, Ken Burns)
   - Choose background (uses existing animated backgrounds)
   - Set scene duration
4. **AI mode**: "Create a 30-second product demo for [product]" → AI builds the scene sequence
5. **Preview** in real-time
6. **Export** as MP4/GIF using existing export pipeline

## Architecture

### Data Model

```typescript
interface SceneProject {
  id: string;
  name: string;
  scenes: Scene[];
  resolution: { width: number; height: number };
  fps: number;
}

interface Scene {
  id: string;
  durationMs: number;
  background: string; // wallpaper ID (static or animated)
  animatedBgSpeed: number;
  transition: SceneTransition;
  layers: SceneLayer[];
}

interface SceneTransition {
  type: 'none' | 'fade' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'dissolve' | 'zoom';
  durationMs: number;
}

interface SceneLayer {
  id: string;
  type: 'text' | 'image' | 'shape';
  startMs: number; // relative to scene start
  endMs: number;
  position: { x: number; y: number }; // percentage
  size: { width: number; height: number }; // percentage
  zIndex: number;
  entrance: LayerAnimation;
  exit: LayerAnimation;
  content: TextContent | ImageContent | ShapeContent;
}

// Text layer
interface TextContent {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
}

// Image layer
interface ImageContent {
  src: string; // data URL or file path
  fit: 'cover' | 'contain' | 'fill';
  borderRadius: number;
  shadow: boolean;
}

// Shape layer
interface ShapeContent {
  shape: 'rectangle' | 'circle' | 'rounded-rect';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

// Animations
interface LayerAnimation {
  type: 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down'
      | 'typewriter' | 'bounce' | 'zoom-in' | 'zoom-out' | 'wipe' | 'blur-in'
      | 'ken-burns';
  durationMs: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
  delay: number;
}
```

### New Components

#### `src/components/scene-builder/SceneEditor.tsx`
Main scene editor view — replaces VideoEditor when in "Create" mode:
- Scene timeline at bottom (horizontal strip of scene thumbnails)
- Canvas preview area (center)
- Layer properties panel (right)
- Scene/layer list (left sidebar)

#### `src/components/scene-builder/SceneTimeline.tsx`
Horizontal timeline showing scene cards:
- Drag to reorder scenes
- Click to select and edit
- + button to add new scene
- Duration handle to resize
- Transition indicator between scenes

#### `src/components/scene-builder/SceneCanvas.tsx`
Real-time preview canvas:
- Renders current scene with all layers and animations
- Click layers to select
- Drag to reposition layers
- Resize handles on selected layer
- Playback controls (play full sequence)

#### `src/components/scene-builder/LayerPanel.tsx`
Properties for selected layer:
- Text editor (content, font, size, color, alignment)
- Image picker (upload, screenshot, URL)
- Animation selector (entrance/exit, duration, easing)
- Position/size controls
- Timing (start/end within scene)

#### `src/components/scene-builder/SceneToolbar.tsx`
Top toolbar:
- Add Text / Add Image / Add Shape buttons
- Scene background picker
- Scene duration control
- AI Generate button

### Scene Renderer (for preview and export)

#### `src/lib/scene-renderer/sceneRenderer.ts`
Canvas-based renderer that draws a scene at any point in time:

```typescript
class SceneRenderer {
  render(ctx: CanvasRenderingContext2D, scene: Scene, timeMs: number, width: number, height: number): void {
    // 1. Draw background (static or animated)
    // 2. For each layer, calculate animation state at timeMs
    // 3. Draw layers in zIndex order with transforms
  }
}
```

Animation interpolation:
- Each animation type is a function `(progress: 0-1) → { opacity, x, y, scale, rotation, clipPath }`
- Typewriter: incrementally reveals characters based on progress
- Ken Burns: slowly zooms/pans an image
- Wipe: clipPath reveals content directionally

#### `src/lib/scene-renderer/sceneExporter.ts`
Exports a SceneProject as MP4:

```typescript
async function exportSceneProject(project: SceneProject, options: ExportOptions): Promise<Blob> {
  // 1. Calculate total duration from all scenes + transitions
  // 2. For each frame (at target FPS):
  //    a. Determine which scene is active
  //    b. If in transition, render both scenes and blend
  //    c. Render scene to canvas
  //    d. Encode frame via VideoEncoder (existing WebCodecs pipeline)
  // 3. Mux into MP4 (existing mediabunny muxer)
}
```

### AI Scene Generation

#### `src/lib/ai/sceneGenerator.ts`
Uses the AI service to generate scene sequences:

```typescript
async function generateSceneProject(prompt: string, assets?: string[]): Promise<SceneProject> {
  // Send prompt + available assets to LLM
  // LLM returns structured JSON with scenes, text content, timing, animations
  // Parse and validate into SceneProject
}
```

Example prompt result for "Create a 30-second Coherence product demo":
```json
{
  "scenes": [
    {
      "duration": 5000,
      "background": "animated-aurora",
      "layers": [
        { "type": "text", "content": "Coherence", "animation": "fade", "fontSize": 64 },
        { "type": "text", "content": "The AI-native work platform", "animation": "typewriter", "delay": 1000 }
      ],
      "transition": { "type": "fade", "duration": 500 }
    },
    {
      "duration": 8000,
      "layers": [
        { "type": "image", "src": "screenshot-1.png", "animation": "zoom-in" },
        { "type": "text", "content": "Manage your entire business", "animation": "slide-up" }
      ]
    }
  ]
}
```

### Integration Points

- **Welcome Screen**: Add "Create Video" button alongside "New Recording"
- **App.tsx**: Add `scene-editor` route
- **File menu**: "New Video Project" option
- **Export pipeline**: Reuse existing VideoEncoder/muxer
- **Backgrounds**: Reuse all animated backgrounds
- **AI chat**: Add scene-building tools
- **Project files**: `.lucid` can store either recording projects or scene projects

### Text Animation Library

Pre-built animation presets:

| Animation | Description |
|-----------|-------------|
| `fade` | Opacity 0→1 |
| `typewriter` | Characters appear one by one |
| `slide-left` | Slides in from left |
| `slide-right` | Slides in from right |
| `slide-up` | Slides in from bottom |
| `slide-down` | Slides in from top |
| `bounce` | Drops in with spring physics |
| `zoom-in` | Scales from 0→1 |
| `zoom-out` | Scales from 2→1 |
| `blur-in` | Blur dissolve |
| `wipe` | Horizontal reveal |
| `ken-burns` | Slow zoom+pan (for images) |
| `rotate-in` | Rotation + fade |
| `split-reveal` | Text splits from center |

## Implementation Phases

### Phase 1: Core Scene Model + Renderer (M)
- SceneProject data model
- SceneRenderer (canvas-based, renders one frame)
- Animation interpolation engine
- Basic preview (render current scene at current time)

### Phase 2: Scene Editor UI (L)
- SceneEditor component
- SceneTimeline (scene strip)
- SceneCanvas (interactive preview with layer selection)
- LayerPanel (text/image property editing)
- Add Text / Add Image / Add Shape toolbar

### Phase 3: Text Animations (M)
- All 14 animation presets
- Animation picker UI
- Entrance + exit animations per layer
- Easing functions

### Phase 4: Scene Transitions (S)
- Transition renderer (blend two scenes)
- Transition picker between scenes
- 6 transition types

### Phase 5: Export Pipeline (M)
- SceneExporter using existing WebCodecs + muxer
- Frame-by-frame rendering
- Progress tracking
- MP4 + GIF output

### Phase 6: AI Scene Generation (M)
- Prompt → SceneProject JSON via LLM
- Asset integration (user uploads screenshots)
- AI chat tools for scene editing
- "Generate demo for [product]" flow

### Phase 7: Integration (S)
- Welcome screen "Create Video" button
- File menu entries
- Project file format (.lucid scene projects)
- Scene editor ↔ recording editor switching

## Estimated Total: ~3-4 agent sessions
