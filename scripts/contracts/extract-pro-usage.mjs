#!/usr/bin/env node
// ── Extract which host APIs the studio-pro bundle actually uses ─────────
//
// Usage:  node scripts/contracts/extract-pro-usage.mjs <path-to-studio-pro> [--out-dir <dir>]
//
// Scans studio-pro's bundled source (<root>/src) with the TypeScript parser
// and writes two fixtures (API names only — no source, paths or code):
//
//   tests/contracts/pro-electron-api-usage.json
//     every `window.electronAPI.<method>` the bundle references
//   tests/contracts/pro-shared-usage.json
//     every `window.__STUDIO_SHARED__` name it reads, the keys it
//     destructures out of nested bridge maps (e.g. `lucide`), and the
//     plugin-registry methods it calls
//
// The contract tests in tests/contracts/ then check that the host still
// provides all of them. Re-run this whenever studio-pro changes.
//
// Access patterns handled (all seen in studio-pro today):
//   window.electronAPI.foo(...) / window.electronAPI?.foo?.(...)
//   (window as any).electronAPI?.foo
//   (window.electronAPI as { foo?: ... })?.foo
//   const api = (window as any).electronAPI; api?.foo / api.foo(...)
//   const S = (window as any).__STUDIO_SHARED__; export const X = S.X;
//   export const { A, B } = S.lucide;          → nested lucide.A, lucide.B
//   const { a, b } = window.electronAPI         → a, b
//   window.electronAPI["foo"], "foo" in window.electronAPI
// Anything else that lets the root object escape (passed to a function,
// spread, computed access) is reported as a warning so it can be reviewed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const ROOTS = {
	electronAPI: "electronAPI",
	shared: "__STUDIO_SHARED__",
};
const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);
/** Bridge entries that are plain name→component maps built by the host
 *  (sharedBridge.ts), so the keys read from them are part of the contract.
 *  Members of other entries (React.createElement, toast.success, ...) belong
 *  to third-party APIs and are not tracked. */
const SHARED_NESTED_MAPS = new Set(["lucide", "sceneLibrary"]);
/** Identifiers whose member calls count as plugin-registry usage. `registry`
 *  is the parameter studio-pro's `register(registry)` callback receives. */
const REGISTRY_IDENTIFIERS = new Set(["pluginRegistry", "registry"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "__generated", ".git"]);

function parseArgs(argv) {
	const args = { proRoot: null, outDir: path.join(repoRoot, "tests", "contracts") };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--out-dir") {
			args.outDir = path.resolve(argv[++i]);
		} else if (arg === "-h" || arg === "--help") {
			args.help = true;
		} else if (!args.proRoot) {
			args.proRoot = path.resolve(arg);
		} else {
			throw new Error(`Unexpected argument: ${arg}`);
		}
	}
	return args;
}

function listSourceFiles(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) out.push(...listSourceFiles(path.join(dir, entry.name)));
		} else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
			out.push(path.join(dir, entry.name));
		}
	}
	return out;
}

function scriptKindFor(file) {
	switch (path.extname(file)) {
		case ".tsx":
			return ts.ScriptKind.TSX;
		case ".jsx":
			return ts.ScriptKind.JSX;
		case ".js":
		case ".mjs":
		case ".cjs":
			return ts.ScriptKind.JS;
		default:
			return ts.ScriptKind.TS;
	}
}

/** Strip expression wrappers that don't change the value: (x), x as T, <T>x, x!, x satisfies T. */
function isTransparentWrapper(node) {
	return (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isTypeAssertionExpression(node) ||
		ts.isNonNullExpression(node) ||
		(ts.isSatisfiesExpression?.(node) ?? false)
	);
}

function unwrap(node) {
	let current = node;
	while (isTransparentWrapper(current)) current = current.expression;
	return current;
}

/** Climb from `node` through transparent wrappers; returns the outermost wrapper. */
function climb(node) {
	let current = node;
	while (current.parent && isTransparentWrapper(current.parent)) current = current.parent;
	return current;
}

/** `window.<root>` / `(window as any).<root>` / `globalThis.<root>` */
function isGlobalRootAccess(node, rootName) {
	if (!ts.isPropertyAccessExpression(node) || node.name.text !== rootName) return false;
	const target = unwrap(node.expression);
	return ts.isIdentifier(target) && GLOBAL_OBJECTS.has(target.text);
}

function propertyNameText(name) {
	if (!name) return null;
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
		return name.text;
	}
	return null;
}

/** Nearest enclosing scope node for a variable declaration. */
function scopeOf(node) {
	let current = node.parent;
	while (current) {
		if (
			ts.isSourceFile(current) ||
			ts.isBlock(current) ||
			ts.isFunctionLike(current) ||
			ts.isModuleBlock(current) ||
			ts.isCaseClause(current) ||
			ts.isForStatement(current) ||
			ts.isForOfStatement(current) ||
			ts.isForInStatement(current)
		) {
			return current;
		}
		current = current.parent;
	}
	return node.getSourceFile();
}

/**
 * Is this identifier a *reference* (as opposed to a declaration name, a
 * property name in `a.name`, an object-literal key, etc.)?
 */
function isReferenceIdentifier(id) {
	const parent = id.parent;
	if (!parent) return false;
	if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
	if (ts.isQualifiedName(parent)) return false;
	if (ts.isVariableDeclaration(parent) && parent.name === id) return false;
	if (ts.isBindingElement(parent) && (parent.name === id || parent.propertyName === id))
		return false;
	if (ts.isParameter(parent) && parent.name === id) return false;
	if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
	if (ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent)) return false;
	if (ts.isMethodDeclaration(parent) && parent.name === id) return false;
	if (ts.isFunctionDeclaration(parent) && parent.name === id) return false;
	if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent)) {
		return false;
	}
	if (ts.isTypeReferenceNode(parent)) return false;
	return true;
}

class UsageCollector {
	constructor(proRoot) {
		this.proRoot = proRoot;
		this.electronApi = new Set();
		this.shared = new Set();
		this.sharedNested = new Map(); // bridge key → Set(member)
		this.registryMethods = new Set();
		this.warnings = [];
	}

	warn(node, message) {
		const sf = node.getSourceFile();
		const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
		const rel = path.relative(this.proRoot, sf.fileName).replace(/\\/g, "/");
		this.warnings.push(`${rel}:${line + 1}: ${message}`);
	}

	/**
	 * Record what is read from `expr`, a value equal to a tracked object.
	 * `record(name, memberExpr)` is called for each member name read; it may
	 * return a new handler to keep tracking the member's value (one level of
	 * nesting, used for bridge maps like `lucide`).
	 */
	trackValueUses(expr, label, record) {
		const outer = climb(expr);
		const parent = outer.parent;
		if (!parent) return;

		// obj.name / obj?.name
		if (ts.isPropertyAccessExpression(parent) && parent.expression === outer) {
			const next = record(parent.name.text, parent);
			if (next) this.trackValueUses(parent, `${label}.${parent.name.text}`, next);
			return;
		}
		// obj["name"]
		if (ts.isElementAccessExpression(parent) && parent.expression === outer) {
			const key = parent.argumentExpression;
			if (key && ts.isStringLiteralLike(key)) {
				const next = record(key.text, parent);
				if (next) this.trackValueUses(parent, `${label}.${key.text}`, next);
			} else {
				this.warn(parent, `dynamic element access on ${label} — not statically resolvable`);
			}
			return;
		}
		// "name" in obj
		if (
			ts.isBinaryExpression(parent) &&
			parent.operatorToken.kind === ts.SyntaxKind.InKeyword &&
			parent.right === outer &&
			ts.isStringLiteralLike(parent.left)
		) {
			record(parent.left.text, parent);
			return;
		}
		// const { a, b: c } = obj  /  const alias = obj
		if (ts.isVariableDeclaration(parent) && parent.initializer === outer) {
			if (ts.isObjectBindingPattern(parent.name)) {
				for (const element of parent.name.elements) {
					if (element.dotDotDotToken) {
						this.warn(element, `rest destructuring of ${label} — names not statically resolvable`);
						continue;
					}
					const key = propertyNameText(element.propertyName ?? element.name);
					if (key) record(key, element);
					else this.warn(element, `computed destructuring key on ${label}`);
				}
				return;
			}
			if (ts.isIdentifier(parent.name)) {
				this.trackAlias(parent, label, record);
				return;
			}
		}
		// Truthiness / typeof / comparisons don't read members.
		if (
			ts.isPrefixUnaryExpression(parent) ||
			ts.isTypeOfExpression(parent) ||
			(ts.isBinaryExpression(parent) &&
				[
					ts.SyntaxKind.EqualsEqualsEqualsToken,
					ts.SyntaxKind.ExclamationEqualsEqualsToken,
					ts.SyntaxKind.EqualsEqualsToken,
					ts.SyntaxKind.ExclamationEqualsToken,
					ts.SyntaxKind.AmpersandAmpersandToken,
					ts.SyntaxKind.BarBarToken,
					ts.SyntaxKind.QuestionQuestionToken,
				].includes(parent.operatorToken.kind)) ||
			ts.isIfStatement(parent) ||
			ts.isConditionalExpression(parent)
		) {
			if (
				ts.isBinaryExpression(parent) &&
				[ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
					parent.operatorToken.kind,
				) &&
				parent.left === outer
			) {
				// `obj || fallback` — the result is (maybe) obj; keep tracking it.
				this.trackValueUses(parent, label, record);
			}
			return;
		}
		this.warn(parent, `${label} escapes (${ts.SyntaxKind[parent.kind]}) — review manually`);
	}

	/** `const alias = <tracked>` — follow references to `alias` in its scope. */
	trackAlias(declaration, label, record) {
		const name = declaration.name.text;
		const scope = scopeOf(declaration);
		const visit = (node) => {
			if (
				ts.isIdentifier(node) &&
				node.text === name &&
				node !== declaration.name &&
				isReferenceIdentifier(node)
			) {
				this.trackValueUses(node, `${label} (via ${name})`, record);
			}
			ts.forEachChild(node, visit);
		};
		visit(scope);
		// An exported alias of a tracked object (e.g. studio-pro's
		// `export const lucide = S.lucide` / `const api = window.electronAPI`
		// exported) is reachable from other modules too: remember it so
		// importers get scanned.
		const statement = declaration.parent?.parent;
		if (
			statement &&
			ts.isVariableStatement(statement) &&
			statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
		) {
			this.exportedAliases.push({ name, label, record });
		}
	}

	exportedAliases = [];

	recordElectronApi = (name) => {
		this.electronApi.add(name);
		return null;
	};

	recordShared = (name) => {
		this.shared.add(name);
		if (!SHARED_NESTED_MAPS.has(name)) return null;
		// Track one level into the bridge's plain-object maps.
		return (member) => {
			if (!this.sharedNested.has(name)) this.sharedNested.set(name, new Set());
			this.sharedNested.get(name).add(member);
			return null;
		};
	};

	scanFile(file) {
		const text = fs.readFileSync(file, "utf-8");
		const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
		const visit = (node) => {
			if (isGlobalRootAccess(node, ROOTS.electronAPI)) {
				this.trackValueUses(node, "window.electronAPI", this.recordElectronApi);
			} else if (isGlobalRootAccess(node, ROOTS.shared)) {
				this.trackValueUses(node, "window.__STUDIO_SHARED__", this.recordShared);
			} else if (
				ts.isPropertyAccessExpression(node) &&
				ts.isIdentifier(unwrap(node.expression)) &&
				REGISTRY_IDENTIFIERS.has(unwrap(node.expression).text)
			) {
				this.registryMethods.add(node.name.text);
			}
			ts.forEachChild(node, visit);
		};
		visit(sf);
	}

	/**
	 * Exported aliases (e.g. `lucide` from studio-pro's shared.ts) can be
	 * imported elsewhere and read as `lucide.X`. Scan importers by name.
	 * (Matching on the imported binding name rather than resolving module
	 * paths is deliberately loose: it can only over-report.)
	 */
	scanExportedAliasImports(files) {
		for (const { name, label, record } of this.exportedAliases) {
			for (const file of files) {
				const text = fs.readFileSync(file, "utf-8");
				if (!text.includes(name)) continue;
				const sf = ts.createSourceFile(
					file,
					text,
					ts.ScriptTarget.Latest,
					true,
					scriptKindFor(file),
				);
				for (const stmt of sf.statements) {
					if (!ts.isImportDeclaration(stmt)) continue;
					const bindings = stmt.importClause?.namedBindings;
					if (!bindings || !ts.isNamedImports(bindings)) continue;
					for (const spec of bindings.elements) {
						const imported = (spec.propertyName ?? spec.name).text;
						if (imported !== name) continue;
						const local = spec.name.text;
						const visit = (node) => {
							if (ts.isIdentifier(node) && node.text === local && isReferenceIdentifier(node)) {
								this.trackValueUses(node, label, record);
							}
							ts.forEachChild(node, visit);
						};
						for (const s of sf.statements) if (s !== stmt) visit(s);
					}
				}
			}
		}
	}
}

function sorted(set) {
	return Array.from(set).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function writeJson(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `${JSON.stringify(data, null, "\t")}\n`, "utf-8");
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || !args.proRoot) {
		console.log(
			"Usage: node scripts/contracts/extract-pro-usage.mjs <path-to-studio-pro> [--out-dir <dir>]",
		);
		process.exit(args.help ? 0 : 2);
	}
	const srcDir = path.join(args.proRoot, "src");
	if (!fs.existsSync(srcDir)) {
		console.error(`[extract-pro-usage] ${srcDir} not found — is this a studio-pro checkout?`);
		process.exit(2);
	}

	const files = listSourceFiles(srcDir);
	const collector = new UsageCollector(args.proRoot);
	for (const file of files) collector.scanFile(file);
	collector.scanExportedAliasImports(files);

	const header =
		"Generated by scripts/contracts/extract-pro-usage.mjs from the studio-pro source. " +
		"API names only. Do not hand-edit; re-run the script when studio-pro changes.";

	const electronOut = path.join(args.outDir, "pro-electron-api-usage.json");
	writeJson(electronOut, {
		$comment: header,
		methods: sorted(collector.electronApi),
	});

	const nested = {};
	for (const key of sorted(collector.sharedNested.keys())) {
		nested[key] = sorted(collector.sharedNested.get(key));
	}
	const sharedOut = path.join(args.outDir, "pro-shared-usage.json");
	writeJson(sharedOut, {
		$comment: header,
		names: sorted(collector.shared),
		nested,
		pluginRegistryMethods: sorted(collector.registryMethods),
	});

	console.log(`[extract-pro-usage] scanned ${files.length} files under ${srcDir}`);
	console.log(`  electronAPI methods: ${collector.electronApi.size} → ${electronOut}`);
	console.log(`  __STUDIO_SHARED__ names: ${collector.shared.size} → ${sharedOut}`);
	for (const [key, members] of Object.entries(nested)) {
		console.log(`    nested ${key}: ${members.length}`);
	}
	console.log(`  plugin registry methods: ${collector.registryMethods.size}`);
	if (collector.warnings.length) {
		console.log(`  ${collector.warnings.length} warning(s) — review these by hand:`);
		for (const w of collector.warnings) console.log(`    ${w}`);
	}
}

main();
