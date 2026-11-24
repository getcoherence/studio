// ── Pre-bundle Remotion for production ───────────────────────────────────
//
// Runs @remotion/bundler's bundle() with the same webpack config used at
// dev time, outputting to dist-remotion/. The production Electron app
// ships this directory as an extraResource so renderMedia() can use it
// directly — no on-the-fly webpack bundling needed at runtime.
//
// Usage:  node scripts/bundle-remotion.mjs
//
// The bundling itself lives in scripts/lib/bundleRemotion.mjs, which the
// Remotion smoke test (scripts/smoke/remotion-render.mjs) imports too.

import { bundleRemotion } from "./lib/bundleRemotion.mjs";

bundleRemotion().catch((err) => {
	console.error("[bundle-remotion] Failed:", err);
	process.exit(1);
});
