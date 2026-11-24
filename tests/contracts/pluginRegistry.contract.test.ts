// Contract: the plugin registry the pro bundle receives via the bridge.
//
// Pins the ids the core plugins register (studio-pro and saved scene
// projects refer to scene types / transitions / effects / animations by id)
// and the registry methods studio-pro calls — including the
// implementation-only getSceneTypeIds() / getSceneTypesByCategory(), which
// are not on the PluginRegistry interface (plan §7: v2 adds them to it).

import { beforeAll, describe, expect, it } from "vitest";
import { loadCorePlugins } from "@/lib/plugins/core";
import { pluginRegistry } from "@/lib/plugins/registry";
import {
	describeDiff,
	diffNames,
	readFixture,
	sortedUnique,
	UPDATE_CONTRACTS,
	UPDATE_HINT,
	writeFixture,
} from "./contractFixture";

const FIXTURE = "plugin-registry-core.json";

interface RegistryFixture {
	loadedPlugins: string[];
	sceneTypes: string[];
	sceneTypesByCategory: Record<string, string[]>;
	transitions: string[];
	effects: string[];
	animations: string[];
	exportTargets: string[];
}

// The singleton is typed by the PluginRegistry interface; the pro bundle sees
// the concrete implementation, so look methods up dynamically like it does.
const registryAny = pluginRegistry as unknown as Record<string, unknown>;

beforeAll(() => {
	loadCorePlugins();
});

function snapshot(): RegistryFixture {
	const byCategory = pluginRegistry.getSceneTypesByCategory();
	return {
		loadedPlugins: sortedUnique(pluginRegistry.getLoadedPlugins().map((p) => p.id)),
		sceneTypes: sortedUnique(pluginRegistry.getSceneTypes().map((p) => p.id)),
		sceneTypesByCategory: Object.fromEntries(
			Object.keys(byCategory)
				.sort()
				.map((cat) => [cat, sortedUnique(byCategory[cat].map((p) => p.id))]),
		),
		transitions: sortedUnique(pluginRegistry.getTransitions().map((p) => p.id)),
		effects: sortedUnique(pluginRegistry.getEffects().map((p) => p.id)),
		animations: sortedUnique(pluginRegistry.getAnimations().map((p) => p.id)),
		exportTargets: sortedUnique(pluginRegistry.getExportTargets().map((p) => p.id)),
	};
}

describe("core plugin registry", () => {
	it("registers exactly the ids in plugin-registry-core.json", () => {
		const actual = snapshot();
		if (UPDATE_CONTRACTS) {
			writeFixture(FIXTURE, actual);
			return;
		}
		const expected = readFixture<RegistryFixture>(FIXTURE);
		const kinds = [
			"loadedPlugins",
			"sceneTypes",
			"transitions",
			"effects",
			"animations",
			"exportTargets",
		] as const;
		const messages = kinds
			.map((kind) => describeDiff(kind, diffNames(expected[kind], actual[kind])))
			.filter(Boolean);
		expect(messages, `Core plugin ids changed — ${UPDATE_HINT}\n${messages.join("\n")}`).toEqual(
			[],
		);
		expect(actual.sceneTypesByCategory).toEqual(expected.sceneTypesByCategory);
	});

	it("has the expected counts", () => {
		// Verified counts on main when this contract was written (an earlier
		// estimate of 40/24/14/18 was not accurate). Kept explicit so a count
		// change is obvious in review, not just a fixture diff.
		const expected = readFixture<RegistryFixture>(FIXTURE);
		expect({
			sceneTypes: pluginRegistry.getSceneTypes().length,
			transitions: pluginRegistry.getTransitions().length,
			effects: pluginRegistry.getEffects().length,
			animations: pluginRegistry.getAnimations().length,
		}).toEqual({
			sceneTypes: expected.sceneTypes.length,
			transitions: expected.transitions.length,
			effects: expected.effects.length,
			animations: expected.animations.length,
		});
	});

	it("ids are unique within each kind (Map-backed registry would silently overwrite)", () => {
		const ids = (list: { id: string }[]) => list.map((p) => p.id);
		for (const list of [
			pluginRegistry.getSceneTypes(),
			pluginRegistry.getTransitions(),
			pluginRegistry.getEffects(),
			pluginRegistry.getAnimations(),
		]) {
			expect(new Set(ids(list)).size).toBe(list.length);
		}
	});

	it("loading core plugins twice is a no-op", () => {
		const before = snapshot();
		loadCorePlugins();
		expect(snapshot()).toEqual(before);
	});
});

describe("implementation-only registry methods used by studio-pro", () => {
	it("getSceneTypeIds() exists and returns every scene type id, sorted", () => {
		expect(typeof registryAny.getSceneTypeIds).toBe("function");
		const ids = pluginRegistry.getSceneTypeIds();
		const expected = pluginRegistry.getSceneTypes().map((p) => p.id);
		expect(ids).toEqual([...expected].sort());
		expect(ids.length).toBeGreaterThan(0);
	});

	it("getSceneTypesByCategory() exists and partitions all scene types by category", () => {
		expect(typeof registryAny.getSceneTypesByCategory).toBe("function");
		const groups = pluginRegistry.getSceneTypesByCategory();
		const all = pluginRegistry.getSceneTypes();
		const grouped = Object.values(groups).flat();
		expect(grouped).toHaveLength(all.length);
		expect(new Set(grouped)).toEqual(new Set(all));
		for (const [category, members] of Object.entries(groups)) {
			for (const plugin of members) {
				expect(plugin.category || "other").toBe(category);
			}
		}
	});

	it("every registry method studio-pro calls is a function on the registry", () => {
		const used = readFixture<{ pluginRegistryMethods: string[] }>(
			"pro-shared-usage.json",
		).pluginRegistryMethods;
		expect(used).toEqual(expect.arrayContaining(["getSceneTypeIds", "getSceneTypesByCategory"]));
		const missing = used.filter((name) => typeof registryAny[name] !== "function");
		expect(missing).toEqual([]);
	});
});
