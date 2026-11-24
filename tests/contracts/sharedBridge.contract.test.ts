// Contract: window.__STUDIO_SHARED__ bridge v1 (src/lib/plugins/pro/sharedBridge.ts).
//
// The separately-released studio-pro bundle reads every dependency from this
// object, so its name list IS the v1 API. This test runs the real installer
// (initSharedBridge) and pins the exact name list in shared-bridge-v1.json.
// Bridge v2 (docs/V3-REPLATFORM-PLAN.md §7) must either preserve these names
// or change them deliberately — never by accident.

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	describeDiff,
	diffNames,
	REPO_ROOT,
	readFixture,
	sortedUnique,
	UPDATE_CONTRACTS,
	UPDATE_HINT,
	writeFixture,
} from "./contractFixture";

const FIXTURE = "shared-bridge-v1.json";

interface BridgeFixture {
	__version: number;
	/** Every top-level key on window.__STUDIO_SHARED__ (including __version). */
	names: string[];
	/** Keys of the bridge's plain-object maps; studio-pro destructures from these. */
	nested: { lucide: string[]; sceneLibrary: string[] };
}

type FakeWindow = Record<string, unknown> & {
	__STUDIO_SHARED__?: Record<string, unknown>;
};

const g = globalThis as Record<string, unknown>;
let fakeWindow: FakeWindow;
let bridge: Record<string, unknown>;
let bridgeVersionExport: number;
let initSharedBridge: () => void;

beforeAll(async () => {
	// Import BEFORE `window` exists: html2canvas (and friends) probe the DOM at
	// import time when they see a `window`. The installer itself only needs a
	// `window` object to write to, so give it a fresh one.
	const mod = await import("@/lib/plugins/pro/sharedBridge");
	bridgeVersionExport = mod.BRIDGE_VERSION;
	initSharedBridge = mod.initSharedBridge;

	fakeWindow = {};
	g.window = fakeWindow;
	initSharedBridge();
	if (!fakeWindow.__STUDIO_SHARED__) throw new Error("initSharedBridge() did not install a bridge");
	bridge = fakeWindow.__STUDIO_SHARED__;
});

afterAll(() => {
	delete g.window;
});

function currentSnapshot(): BridgeFixture {
	return {
		__version: bridge.__version as number,
		names: sortedUnique(Object.keys(bridge)),
		nested: {
			lucide: sortedUnique(Object.keys(bridge.lucide as object)),
			sceneLibrary: sortedUnique(Object.keys(bridge.sceneLibrary as object)),
		},
	};
}

/** Member names of `interface SharedBridge` — the bridge's declared type. */
function sharedBridgeInterfaceMembers(): string[] {
	const file = path.join(REPO_ROOT, "src/lib/plugins/pro/sharedBridge.ts");
	const source = ts.createSourceFile(
		file,
		fs.readFileSync(file, "utf-8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const names: string[] = [];
	for (const stmt of source.statements) {
		if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === "SharedBridge") {
			for (const member of stmt.members) {
				if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
					names.push(member.name.text);
				}
			}
		}
	}
	return sortedUnique(names);
}

describe("window.__STUDIO_SHARED__ bridge v1", () => {
	it("is version 1", () => {
		expect(bridge.__version).toBe(1);
		expect(bridgeVersionExport).toBe(1);
	});

	it("exposes exactly the names in shared-bridge-v1.json", () => {
		const actual = currentSnapshot();
		if (UPDATE_CONTRACTS) {
			writeFixture(FIXTURE, actual);
			return;
		}
		const expected = readFixture<BridgeFixture>(FIXTURE);
		const messages = [
			describeDiff("bridge names", diffNames(expected.names, actual.names)),
			describeDiff("bridge.lucide keys", diffNames(expected.nested.lucide, actual.nested.lucide)),
			describeDiff(
				"bridge.sceneLibrary keys",
				diffNames(expected.nested.sceneLibrary, actual.nested.sceneLibrary),
			),
		].filter(Boolean);
		expect(
			messages,
			`The v1 bridge surface changed. The deployed studio-pro bundle depends on it, so removals ` +
				`break pro users on this app version. If intentional, ${UPDATE_HINT}\n${messages.join("\n")}`,
		).toEqual([]);
		expect(actual.__version).toBe(expected.__version);
	});

	it("has no undefined entries (a renamed/removed import would silently become undefined)", () => {
		const undefinedNames = Object.entries(bridge)
			.filter(([, value]) => value === undefined)
			.map(([name]) => name);
		const undefinedNested = (["lucide", "sceneLibrary"] as const).flatMap((map) =>
			Object.entries(bridge[map] as Record<string, unknown>)
				.filter(([, value]) => value === undefined)
				.map(([name]) => `${map}.${name}`),
		);
		expect([...undefinedNames, ...undefinedNested]).toEqual([]);
	});

	it("matches the SharedBridge interface declaration", () => {
		const declared = sharedBridgeInterfaceMembers();
		expect(declared.length).toBeGreaterThan(100);
		const diff = diffNames(declared, sortedUnique(Object.keys(bridge)));
		expect(
			diff,
			"initSharedBridge() and `interface SharedBridge` disagree — keep the type honest",
		).toEqual({ added: [], removed: [] });
	});

	it("installs window.React as the same React instance the bridge exposes", () => {
		// The pro bundle is compiled with jsxFactory "React.createElement" and
		// relies on this global (plan §7: v2 drops it, v1 must keep it).
		expect(fakeWindow.React).toBeDefined();
		expect(fakeWindow.React).toBe(bridge.React);
	});

	it("is idempotent (a second init does not replace the installed bridge)", () => {
		const before = fakeWindow.__STUDIO_SHARED__;
		initSharedBridge();
		expect(fakeWindow.__STUDIO_SHARED__).toBe(before);
	});
});
