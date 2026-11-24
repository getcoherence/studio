// ── Pre-bundle Remotion for production ───────────────────────────────────
//
// Runs @remotion/bundler's bundle() with the same webpack config used at
// dev time, outputting to dist-remotion/. The production Electron app
// ships this directory as an extraResource so renderMedia() can use it
// directly — no on-the-fly webpack bundling needed at runtime.
//
// Usage:  node scripts/bundle-remotion.mjs
//
// bundleRemotion() is also imported by scripts/smoke/remotion-render.mjs so
// the smoke test renders from a bundle built exactly like production's.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

/**
 * Bundle src/lib/remotion/index.ts into `outDir` (cleaned first).
 * @param {{ outDir?: string }} [options]
 * @returns {Promise<string>} the bundle location (a serveUrl for renderMedia)
 */
export async function bundleRemotion({ outDir = path.resolve(projectRoot, "dist-remotion") } = {}) {
	const { bundle } = await import("@remotion/bundler");

	const entryPoint = path.resolve(projectRoot, "src/lib/remotion/index.ts");

	// Clean previous bundle
	if (fs.existsSync(outDir)) {
		fs.rmSync(outDir, { recursive: true });
	}

	console.log("[bundle-remotion] Bundling Remotion project...");
	console.log("  Entry:", entryPoint);
	console.log("  Output:", outDir);

	const bundleLocation = await bundle({
		entryPoint,
		outDir,
		webpackOverride: (config) => {
			config.resolve = config.resolve || {};
			config.resolve.alias = {
				...(config.resolve.alias || {}),
				"@": path.resolve(projectRoot, "src"),
			};
			return config;
		},
		// Enable caching for faster rebuilds during development
		enableCaching: false,
	});

	console.log("[bundle-remotion] Bundle ready at:", bundleLocation);
	return bundleLocation;
}

const invokedDirectly =
	process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
	bundleRemotion().catch((err) => {
		console.error("[bundle-remotion] Failed:", err);
		process.exit(1);
	});
}
