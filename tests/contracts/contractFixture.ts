// Helpers for the phase-0 contract tests (docs/V3-REPLATFORM-PLAN.md §6/§7).
//
// Fixtures are plain, reviewable JSON files next to the tests rather than
// opaque .snap files, so a contract change shows up as a readable diff.
//
// To regenerate the host-side fixtures after an INTENTIONAL change:
//   UPDATE_CONTRACTS=1 npx vitest --run tests/contracts
// The studio-pro usage fixtures come from a script instead:
//   node scripts/contracts/extract-pro-usage.mjs <path-to-studio-pro>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONTRACTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(CONTRACTS_DIR, "..", "..");

export const UPDATE_CONTRACTS = process.env.UPDATE_CONTRACTS === "1";

export const UPDATE_HINT =
	"update the fixture if intentional: UPDATE_CONTRACTS=1 npx vitest --run tests/contracts";

export function fixturePath(name: string): string {
	return path.join(CONTRACTS_DIR, name);
}

export function readFixture<T>(name: string): T {
	return JSON.parse(fs.readFileSync(fixturePath(name), "utf-8")) as T;
}

/** Same layout biome produces for these files (tabs, LF, `expand: "always"` via biome.json). */
export function writeFixture(name: string, data: unknown): void {
	fs.writeFileSync(fixturePath(name), `${JSON.stringify(data, null, "\t")}\n`, "utf-8");
}

export function sortedUnique(names: Iterable<string>): string[] {
	return Array.from(new Set(names)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export interface NameDiff {
	added: string[];
	removed: string[];
}

export function diffNames(expected: readonly string[], actual: readonly string[]): NameDiff {
	const exp = new Set(expected);
	const act = new Set(actual);
	return {
		added: sortedUnique(actual.filter((n) => !exp.has(n))),
		removed: sortedUnique(expected.filter((n) => !act.has(n))),
	};
}

export function describeDiff(label: string, diff: NameDiff): string {
	const parts: string[] = [];
	if (diff.removed.length) parts.push(`${label} REMOVED: ${diff.removed.join(", ")}`);
	if (diff.added.length) parts.push(`${label} added: ${diff.added.join(", ")}`);
	return parts.join("\n");
}
