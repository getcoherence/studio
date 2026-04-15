/**
 * electron-builder custom sign hook — Azure Trusted Signing.
 *
 * Wired in electron-builder.json5 as `win.signtoolOptions.sign:
 * "./signing/sign.cjs"`. Extension must be .cjs because the repo is
 * `"type": "module"` and electron-builder loads this hook via require().
 * Runs once per Windows binary electron-builder produces (the app .exe, the
 * NSIS installer .exe, any other code-signed artifacts).
 *
 * Auth: DefaultAzureCredential in the Trusted Signing dlib reads these
 * environment variables at sign time:
 *   AZURE_TENANT_ID    — Entra tenant (Directory) ID
 *   AZURE_CLIENT_ID    — App registration (Client) ID
 *   AZURE_CLIENT_SECRET — the app's client secret VALUE (not its ID)
 *
 * Tool locations — set these env vars once per dev machine / CI runner:
 *   SIGNTOOL_PATH             — full path to signtool.exe from the Windows SDK
 *   TRUSTED_SIGNING_DLIB_PATH — full path to Azure.CodeSigning.Dlib.dll
 *
 * If SIGNTOOL_PATH isn't set the hook tries the default Windows SDK install
 * path. If TRUSTED_SIGNING_DLIB_PATH isn't set the build fails loudly —
 * there's no sensible default for where the user extracted the NuGet.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const WINDOWS_KITS_BIN = "C:/Program Files (x86)/Windows Kits/10/bin";

function resolveSigntool() {
	if (process.env.SIGNTOOL_PATH && fs.existsSync(process.env.SIGNTOOL_PATH)) {
		return process.env.SIGNTOOL_PATH;
	}
	// Scan the Windows Kits bin/ directory for the newest SDK that ships
	// signtool.exe — GitHub's windows-latest runner and dev machines move
	// through SDK versions (10.0.22000, 22621, 26100, …) so a hardcoded
	// list goes stale. Sort descending so we pick the newest available.
	if (fs.existsSync(WINDOWS_KITS_BIN)) {
		const versioned = fs
			.readdirSync(WINDOWS_KITS_BIN)
			.filter((entry) => /^\d+\.\d+\.\d+\.\d+$/.test(entry))
			.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
		for (const version of versioned) {
			const candidate = path.join(WINDOWS_KITS_BIN, version, "x64", "signtool.exe");
			if (fs.existsSync(candidate)) return candidate;
		}
		const bare = path.join(WINDOWS_KITS_BIN, "x64", "signtool.exe");
		if (fs.existsSync(bare)) return bare;
	}
	throw new Error("signtool.exe not found. Set SIGNTOOL_PATH or install the Windows SDK.");
}

function resolveDlib() {
	const dlib = process.env.TRUSTED_SIGNING_DLIB_PATH;
	if (!dlib) {
		throw new Error(
			"TRUSTED_SIGNING_DLIB_PATH not set. Install the Microsoft.Trusted.Signing.Client " +
				"NuGet package and point this env var at Azure.CodeSigning.Dlib.dll, e.g. " +
				"C:/Tools/TrustedSigning/bin/x64/Azure.CodeSigning.Dlib.dll",
		);
	}
	if (!fs.existsSync(dlib)) {
		throw new Error(`TRUSTED_SIGNING_DLIB_PATH points at a file that doesn't exist: ${dlib}`);
	}
	return dlib;
}

function assertAuthEnv() {
	const missing = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"].filter(
		(k) => !process.env[k],
	);
	if (missing.length > 0) {
		throw new Error(
			`Trusted Signing auth env vars missing: ${missing.join(", ")}. ` +
				"Set them from the Coherence Studio Code Signing app registration.",
		);
	}
}

exports.default = async function sign(configuration) {
	const signtool = resolveSigntool();
	const dlib = resolveDlib();
	assertAuthEnv();

	const metadata = path.resolve(__dirname, "metadata.json");
	const target = configuration.path;

	console.log(`[TrustedSigning] signing ${path.basename(target)}`);

	execFileSync(
		signtool,
		[
			"sign",
			"/v",
			"/debug",
			"/fd",
			"SHA256",
			"/tr",
			"http://timestamp.acs.microsoft.com",
			"/td",
			"SHA256",
			"/dlib",
			dlib,
			"/dmdf",
			metadata,
			target,
		],
		{ stdio: "inherit" },
	);
};
