// ── Remotion production bundle (library) ────────────────────────────────
//
// bundleRemotion() runs @remotion/bundler's bundle() with the same webpack
// config used at dev time. Shared by scripts/bundle-remotion.mjs (the
// production build step) and scripts/smoke/remotion-render.mjs (the smoke
// test), so the smoke test renders from a bundle built exactly like
// production's.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

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
