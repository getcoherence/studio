import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

/**
 * Resolves the path to the FFmpeg binary.
 *
 * Priority:
 * 1. Bundled binary in app resources (for packaged app)
 * 2. System FFmpeg on PATH
 * 3. null if not found
 */
export async function getFfmpegPath(): Promise<string | null> {
	// Check bundled binary first (in extraResources)
	const bundledPath = getBundledFfmpegPath();
	if (bundledPath) {
		try {
			await fs.access(bundledPath);
			return bundledPath;
		} catch {
			// Bundled binary not found, fall through
		}
	}

	// Check system PATH
	const systemPath = await findSystemFfmpeg();
	if (systemPath) return systemPath;

	return null;
}

function getBundledFfmpegPath(): string | null {
	const platform = process.platform;
	const binaryName = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

	// In development
	if (!app.isPackaged) {
		return null; // Rely on system FFmpeg during development
	}

	// In packaged app — extraResources
	const resourcesPath = process.resourcesPath;
	return path.join(resourcesPath, "ffmpeg", binaryName);
}

async function findSystemFfmpeg(): Promise<string | null> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFileAsync = promisify(execFile);

	try {
		const cmd = process.platform === "win32" ? "where" : "which";
		const { stdout } = await execFileAsync(cmd, ["ffmpeg"]);
		const ffmpegPath = stdout.trim().split("\n")[0]?.trim();
		if (ffmpegPath) return ffmpegPath;
	} catch {
		// FFmpeg not on PATH
	}

	return null;
}
