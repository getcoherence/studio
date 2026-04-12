/**
 * MiniMax Image Generation Service.
 *
 * Generates reference/background images for scenes via the `image-01` model.
 * Used by the Story Writer agent to produce hero backgrounds, subject
 * references for line_drawn illustrations, or photographic accents.
 *
 * Returns absolute paths to PNG files on disk. Images are saved under the
 * `image-output` directory in the user's data folder so the studio://
 * protocol can serve them to Remotion at render time.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";

const IMAGE_OUTPUT_DIR = "image-output";

function getImageOutputDir(): string {
	return path.join(app.getPath("userData"), IMAGE_OUTPUT_DIR);
}

async function ensureImageDir(): Promise<string> {
	const dir = getImageOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

// ── Types ──────────────────────────────────────────────────────────────

export type ImageAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";

export interface ImageGenOptions {
	/** Aspect ratio for the output. Defaults to 16:9. */
	aspectRatio?: ImageAspectRatio;
	/** Number of images to generate (1-4). Default 1. */
	count?: number;
	/** Optional image URL to use as a subject reference (character consistency). */
	subjectReferenceUrl?: string;
}

export interface ImageGenResult {
	success: boolean;
	/** Absolute paths to the generated PNG files on disk. */
	imagePaths?: string[];
	error?: string;
}

// ── Core generation ────────────────────────────────────────────────────

export async function generateImage(
	prompt: string,
	options?: ImageGenOptions,
): Promise<ImageGenResult> {
	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_minimax;
	if (!apiKey) {
		return {
			success: false,
			error: "MiniMax API key not configured — cannot generate images.",
		};
	}

	const aspectRatio = options?.aspectRatio || "16:9";
	const count = Math.max(1, Math.min(4, options?.count || 1));

	console.log(
		`[ImageGen] Generating ${count}× ${aspectRatio} image for: "${prompt.slice(0, 80)}..."`,
	);

	const body: Record<string, unknown> = {
		model: "image-01",
		prompt,
		aspect_ratio: aspectRatio,
		response_format: "base64",
		n: count,
	};

	if (options?.subjectReferenceUrl) {
		body.subject_reference = [
			{
				type: "character",
				image_file: options.subjectReferenceUrl,
			},
		];
	}

	try {
		const response = await fetch("https://api.minimax.io/v1/image_generation", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(120_000),
		});

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			console.error(`[ImageGen] HTTP ${response.status}:`, errText.slice(0, 300));
			return {
				success: false,
				error: `Image gen HTTP ${response.status}: ${errText.slice(0, 200)}`,
			};
		}

		const data = (await response.json()) as {
			data?: { image_base64?: string[] };
			base_resp?: { status_code?: number; status_msg?: string };
		};

		if (data.base_resp?.status_code !== 0) {
			return {
				success: false,
				error: `Image gen: ${data.base_resp?.status_msg || "unknown error"}`,
			};
		}

		const b64Images = data.data?.image_base64;
		if (!Array.isArray(b64Images) || b64Images.length === 0) {
			return { success: false, error: "Image gen returned no images" };
		}

		// Save each base64 image to disk and collect paths
		const outputDir = await ensureImageDir();
		const imagePaths: string[] = [];
		for (let i = 0; i < b64Images.length; i++) {
			const b64 = b64Images[i];
			// The base64 may come as a raw string or a data URI. Strip the
			// data URI prefix if present.
			const cleanB64 = b64.replace(/^data:image\/\w+;base64,/, "");
			const buffer = Buffer.from(cleanB64, "base64");
			const fileName = `minimax-img-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.png`;
			const imagePath = path.join(outputDir, fileName);
			await fs.writeFile(imagePath, buffer);
			imagePaths.push(imagePath);
		}

		console.log(`[ImageGen] ✓ Saved ${imagePaths.length} image(s)`);
		return { success: true, imagePaths };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[ImageGen] Failed:", msg);
		return { success: false, error: `Image gen failed: ${msg}` };
	}
}
