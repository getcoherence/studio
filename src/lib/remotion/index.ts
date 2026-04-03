// ── Remotion Entry Point ─────────────────────────────────────────────────
//
// Entry point for @remotion/bundler. Used for headless MP4 rendering.
// NOT imported by the main app — only consumed by the bundler.

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
