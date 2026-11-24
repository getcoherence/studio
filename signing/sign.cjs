/**
 * STUDIO: electron-builder custom sign hook — Azure Trusted Signing.
 *
 * Carried over from Coherence Studio 0.3.x (signing/sign.cjs on main), with one
 * change for the v3 payload: files that already carry a VALID Authenticode
 * signature are left alone. electron-builder.studio.json5 widens signExts to
 * .node and .dll so the compositor addon, the LGPL ffmpeg DLLs and the ggml
 * backends get signed; without the skip, that would also strip Microsoft's
 * signature off redistributables such as vcomp140.dll and ONNX Runtime.
 *
 * Wired in electron-builder.studio.json5 as `win.signtoolOptions.sign`.
 * Extension must be .cjs because electron-builder loads this hook via require().
 *
 * Auth: DefaultAzureCredential in the Trusted Signing dlib reads these
 * environment variables at sign time:
 *   AZURE_TENANT_ID     — Entra tenant (Directory) ID
 *   AZURE_CLIENT_ID     — App registration (Client) ID
 *   AZURE_CLIENT_SECRET — the app's client secret VALUE (not its ID)
 *
 * Tool locations:
 *   SIGNTOOL_PATH             — full path to signtool.exe (optional; the newest
 *                               Windows SDK's x64 signtool is used otherwise —
 *                               it runs under emulation on Windows on Arm)
 *   TRUSTED_SIGNING_DLIB_PATH — full path to Azure.CodeSigning.Dlib.dll
 */
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const WINDOWS_KITS_BIN = "C:/Program Files (x86)/Windows Kits/10/bin";

function resolveSigntool() {
	if (process.env.SIGNTOOL_PATH && fs.existsSync(process.env.SIGNTOOL_PATH)) {
		return process.env.SIGNTOOL_PATH;
	}
	// Newest SDK that ships signtool.exe — runner images and dev machines move
	// through SDK versions, so a hardcoded list goes stale.
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

/** True when the file already has a signature that chains to a trusted root. */
function hasValidSignature(signtool, target) {
	const result = spawnSync(signtool, ["verify", "/pa", "/q", target], { stdio: "ignore" });
	return result.status === 0;
}

exports.default = async function sign(configuration) {
	const signtool = resolveSigntool();
	const target = configuration.path;

	if (hasValidSignature(signtool, target)) {
		console.log(`[TrustedSigning] already signed, leaving as is: ${path.basename(target)}`);
		return;
	}

	const dlib = resolveDlib();
	assertAuthEnv();
	const metadata = path.resolve(__dirname, "metadata.json");

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
