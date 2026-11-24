import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: [
			"src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
			// Contract / snapshot tests that pin the host APIs the separately
			// released studio-pro bundle and saved projects depend on.
			// (tests/e2e/*.spec.ts is Playwright, not Vitest — keep it out.)
			"tests/contracts/**/*.test.{ts,tsx}",
		],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});
