# Export Rework: Remotion Server-Side Rendering

## Problem
Current export uses html2canvas to capture the DOM frame-by-frame from the visible Player.
This blocks the UI, is slow, and produces low quality output.

## Solution: Use @remotion/renderer + @remotion/bundler

Remotion provides official server-side rendering that runs in headless Chromium with no UI.

### Step 1: Install packages
```bash
pnpm add @remotion/renderer @remotion/bundler
```
These are already externalized in vite.config.ts (rollupOptions.external).

### Step 2: Create a Remotion composition entry point

**File: `src/remotion/index.tsx`** (Remotion root — NOT loaded by Vite, only by the bundler)
```tsx
import { Composition } from "remotion";
import { DynamicVideoComposition } from "./DynamicVideoComposition";

export const RemotionRoot = () => (
  <Composition
    id="DynamicVideo"
    component={DynamicVideoComposition}
    durationInFrames={900}  // overridden at render time via inputProps
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ code: "", screenshots: [] }}
  />
);
```

**File: `src/remotion/DynamicVideoComposition.tsx`**
- Receives `code` and `screenshots` as inputProps
- Uses the same `compileCode()` function from DynamicComposition.tsx
- Renders the compiled component

### Step 3: Background export in Electron main process

**File: `electron/export/remotionExport.ts`**
```typescript
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

export async function exportWithRemotion(opts: {
  code: string;
  screenshots: string[];
  musicPath?: string;
  outputPath: string;
  fps?: number;
  durationInFrames: number;
  onProgress?: (percent: number) => void;
}) {
  // 1. Bundle the Remotion project
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, "../../src/remotion/index.tsx"),
    webpackOverride: (config) => config,
  });

  // 2. Select the composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "DynamicVideo",
    inputProps: {
      code: opts.code,
      screenshots: opts.screenshots,
    },
  });

  // 3. Override duration
  composition.durationInFrames = opts.durationInFrames;
  composition.fps = opts.fps || 30;

  // 4. Render to file
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",        // MP4 output — universally playable
    outputLocation: opts.outputPath,
    inputProps: {
      code: opts.code,
      screenshots: opts.screenshots,
    },
    // Mux music directly if provided
    ...(opts.musicPath ? {
      audioCodec: "aac",
      // Use Remotion's audio support or post-process with ffmpeg
    } : {}),
    onProgress: ({ progress }) => {
      opts.onProgress?.(progress);
    },
  });
}
```

### Step 4: IPC handler
**File: `electron/ipc/handlers.ts`** — new handler:
```typescript
ipcMain.handle("export-remotion", async (event, opts) => {
  const { exportWithRemotion } = await import("../export/remotionExport");
  await exportWithRemotion({
    ...opts,
    onProgress: (percent) => {
      event.sender.send("export-progress", percent);
    },
  });
  return { success: true };
});
```

### Step 5: Frontend
**File: `src/components/scene-builder/SceneEditor.tsx`** — update handleExport:
```typescript
// Instead of html2canvas capture:
const result = await window.electronAPI.exportRemotion({
  code: aiComposition.code,
  screenshots: aiComposition.screenshots,
  musicPath,
  durationInFrames: computeRealTotalFrames(scenePlan.scenes),
  fps: 30,
});
```

### Benefits
- **Background rendering** — no UI impact, user keeps editing
- **Production quality** — Remotion's renderer is battle-tested for video production
- **Direct MP4** — H.264 output, universally playable (no WebM/codec issues)
- **Music muxing** — can be done in the same render pass
- **Correct frame timing** — Remotion handles TransitionSeries timing correctly
- **No html2canvas** — eliminates the flaky DOM screenshot approach

### Considerations
- `@remotion/renderer` downloads a Chromium binary (~130MB) on first use
- Bundle step takes 5-10 seconds (can be cached)
- Need webpack config for the Remotion bundle (separate from Vite)
- The DynamicVideoComposition needs to replicate DynamicComposition's module scope

### Key Files
- `src/remotion/index.tsx` — NEW: Remotion root
- `src/remotion/DynamicVideoComposition.tsx` — NEW: composition wrapper
- `electron/export/remotionExport.ts` — NEW: render pipeline
- `electron/ipc/handlers.ts` — new IPC handler
- `electron/preload.ts` + `electron-env.d.ts` — IPC bridge
- `src/components/scene-builder/SceneEditor.tsx` — update handleExport
- `src/lib/remotion/playerExport.ts` — DEPRECATED
