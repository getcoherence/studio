// Contract: everything the deployed studio-pro bundle actually uses is still
// provided by this host.
//
// pro-electron-api-usage.json / pro-shared-usage.json are generated from the
// private studio-pro source by scripts/contracts/extract-pro-usage.mjs (API
// names only). This test checks them against:
//   - the object passed to contextBridge.exposeInMainWorld("electronAPI", …)
//     in electron/preload.ts (parsed statically — preload needs Electron), and
//   - the bridge v1 fixture (shared-bridge-v1.json), which
//     sharedBridge.contract.test.ts keeps in sync with the real installer.

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, readFixture, sortedUnique } from "./contractFixture";

interface ElectronApiUsage {
	methods: string[];
}
interface SharedUsage {
	names: string[];
	nested: Record<string, string[]>;
	pluginRegistryMethods: string[];
}
interface BridgeFixture {
	names: string[];
	nested: Record<string, string[]>;
}

/**
 * Names studio-pro reads that the host has never provided. Each entry is a
 * LIVE BUG in the pro bundle, listed so the suite is green on main while the
 * bug is tracked. The test below fails if an entry becomes stale (the host
 * starts providing it, or studio-pro stops reading it) — then delete it.
 */
const KNOWN_MISSING_SHARED_NAMES: Record<string, string> = {
	beatDetection:
		"studio-pro SceneEditor 'auto beat-sync' after music generation does " +
		"`const { detectBeats, snapScenesToBeats } = Promise.resolve(window.__STUDIO_SHARED__?.beatDetection || {})`. " +
		"The host bridge has no `beatDetection` (and destructuring a Promise yields undefined anyway), " +
		"so `detectBeats` is undefined, the call throws, and the surrounding try/catch logs " +
		"'[AutoBeatSync] Beat detection failed, skipping' — beat sync silently never runs.",
};

/** Top-level property names of the object literal exposed as `electronAPI`. */
function exposedElectronApiMethods(): string[] {
	const file = path.join(REPO_ROOT, "electron/preload.ts");
	const source = ts.createSourceFile(
		file,
		fs.readFileSync(file, "utf-8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const names: string[] = [];
	let found = 0;
	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === "exposeInMainWorld" &&
			node.arguments.length >= 2 &&
			ts.isStringLiteralLike(node.arguments[0]) &&
			node.arguments[0].text === "electronAPI"
		) {
			const api = node.arguments[1];
			if (!ts.isObjectLiteralExpression(api)) {
				throw new Error("exposeInMainWorld('electronAPI', …) is no longer an object literal");
			}
			found++;
			for (const prop of api.properties) {
				if (ts.isSpreadAssignment(prop)) {
					throw new Error("electronAPI uses a spread — update this parser to resolve it");
				}
				const name = prop.name;
				if (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))) {
					names.push(name.text);
				}
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	if (found !== 1) throw new Error(`expected one exposeInMainWorld("electronAPI"), found ${found}`);
	return sortedUnique(names);
}

describe("studio-pro electronAPI usage", () => {
	const used = readFixture<ElectronApiUsage>("pro-electron-api-usage.json").methods;
	const exposed = new Set(exposedElectronApiMethods());

	it("parses a plausible preload surface", () => {
		expect(exposed.size).toBeGreaterThan(100);
		expect(used.length).toBeGreaterThan(0);
	});

	it("every electronAPI method studio-pro calls is exposed by electron/preload.ts", () => {
		const missing = used.filter((name) => !exposed.has(name));
		expect(
			missing,
			"studio-pro calls electronAPI methods that preload no longer exposes — the deployed " +
				"bundle will hit undefined (or skip the feature) on this app version",
		).toEqual([]);
	});
});

describe("studio-pro __STUDIO_SHARED__ usage", () => {
	const usage = readFixture<SharedUsage>("pro-shared-usage.json");
	const bridge = readFixture<BridgeFixture>("shared-bridge-v1.json");
	const provided = new Set(bridge.names);

	it("every bridge name studio-pro reads exists in bridge v1 (except known live bugs)", () => {
		const missing = usage.names.filter((name) => !provided.has(name));
		const unexpected = missing.filter((name) => !(name in KNOWN_MISSING_SHARED_NAMES));
		expect(
			unexpected,
			"studio-pro reads __STUDIO_SHARED__ names the host does not provide",
		).toEqual([]);
	});

	it("the known-missing list is not stale", () => {
		const stillMissing = Object.keys(KNOWN_MISSING_SHARED_NAMES).filter(
			(name) => usage.names.includes(name) && !provided.has(name),
		);
		expect(
			stillMissing,
			"a KNOWN_MISSING_SHARED_NAMES entry is fixed (host provides it or pro no longer reads it) — delete it",
		).toEqual(Object.keys(KNOWN_MISSING_SHARED_NAMES));
	});

	it("every key studio-pro reads from nested bridge maps exists", () => {
		const missing = Object.entries(usage.nested).flatMap(([map, keys]) => {
			const hostKeys = new Set(bridge.nested[map] ?? []);
			return keys.filter((key) => !hostKeys.has(key)).map((key) => `${map}.${key}`);
		});
		expect(missing).toEqual([]);
	});
});
