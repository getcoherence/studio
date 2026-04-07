// ── Pre-bundle Remotion for production ───────────────────────────────────
//
// Runs @remotion/bundler's bundle() with the same webpack config used at
// dev time, outputting to dist-remotion/. The production Electron app
// ships this directory as an extraResource so renderMedia() can use it
// directly — no on-the-fly webpack bundling needed at runtime.
//
// Usage:  node scripts/bundle-remotion.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function main() {
	const { bundle } = await import("@remotion/bundler");

	const entryPoint = path.resolve(projectRoot, "src/lib/remotion/index.ts");
	const outDir = path.resolve(projectRoot, "dist-remotion");

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
}

main().catch((err) => {
	console.error("[bundle-remotion] Failed:", err);
	process.exit(1);
});
