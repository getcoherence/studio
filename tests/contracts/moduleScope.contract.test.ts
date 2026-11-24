// Contract: MODULE_SCOPE (src/lib/remotion/compileCode.ts).
//
// Saved Create projects embed compiled `_aiCode` that is evaluated with
// `new Function(...Object.keys(MODULE_SCOPE), code)`, so the code can only
// reference names in this scope. Removing a name breaks every saved project
// that used it, forever. docs/V3-REPLATFORM-PLAN.md §7: v2's scope must be a
// SUPERSET of v1's. Additions are fine but must be recorded in the fixture
// so a later removal of them is caught too.

import { describe, expect, it } from "vitest";
import { compileCode, MODULE_SCOPE } from "@/lib/remotion/compileCode";
import {
	diffNames,
	readFixture,
	sortedUnique,
	UPDATE_CONTRACTS,
	UPDATE_HINT,
	writeFixture,
} from "./contractFixture";

const FIXTURE = "module-scope-v1.json";

interface ModuleScopeFixture {
	names: string[];
}

const actualNames = sortedUnique(Object.keys(MODULE_SCOPE));

describe("MODULE_SCOPE v1", () => {
	if (UPDATE_CONTRACTS) {
		it("fixture regenerated", () => {
			writeFixture(FIXTURE, { names: actualNames } satisfies ModuleScopeFixture);
		});
		return;
	}

	const expected = readFixture<ModuleScopeFixture>(FIXTURE).names;
	const diff = diffNames(expected, actualNames);

	it("still provides every v1 name (removals break saved projects' _aiCode)", () => {
		expect(
			diff.removed,
			`MODULE_SCOPE names were REMOVED: ${diff.removed.join(", ")}. Saved Create projects embed ` +
				"compiled _aiCode that may reference them and would crash with 'X is not defined'. " +
				"Restore them (an alias/shim is fine); v2's scope must be a superset of v1's.",
		).toEqual([]);
	});

	it("has no unrecorded additions", () => {
		expect(
			diff.added,
			`MODULE_SCOPE gained names: ${diff.added.join(", ")} — ${UPDATE_HINT}`,
		).toEqual([]);
	});

	it("has no undefined values", () => {
		const undefinedNames = Object.entries(MODULE_SCOPE)
			.filter(([, value]) => value === undefined)
			.map(([name]) => name);
		expect(undefinedNames).toEqual([]);
	});

	it("compiles a trivial composition that only uses scope names", () => {
		const Component = compileCode(`
			const VideoComposition = ({ screenshots }) => {
				const frame = useCurrentFrame();
				const { fps } = useVideoConfig();
				const opacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" });
				return <AbsoluteFill style={{ backgroundColor: "#123456", opacity }} />;
			};
		`);
		expect(typeof Component).toBe("function");
	});
});
