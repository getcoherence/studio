/**
 * Video Generation Service — generates AI video clips via MiniMax Hailuo API.
 *
 * Flow: submit task → poll for completion → download mp4
 * Uses the same MiniMax API key as the music service.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";

const VIDEO_OUTPUT_DIR = "video-output";
const POLL_INTERVAL_MS = 10_000; // MiniMax docs recommend 10s to avoid unnecessary load
const MAX_POLL_TIME_MS = 600_000; // 10 minutes max wait

function getVideoOutputDir(): string {
	return path.join(app.getPath("userData"), VIDEO_OUTPUT_DIR);
}

async function ensureVideoDir(): Promise<string> {
	const dir = getVideoOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

// ── Types ──────────────────────────────────────────────────────────────

export interface VideoGenerationResult {
	success: boolean;
	/** Absolute path to the downloaded mp4 */
	videoPath?: string;
	/** Width in pixels */
	width?: number;
	/** Height in pixels */
	height?: number;
	error?: string;
}

export interface VideoGenerationProgress {
	status: "Preparing" | "Queueing" | "Processing" | "Success" | "Fail";
	taskId: string;
}

type ProgressCallback = (progress: VideoGenerationProgress) => void;

// ── Main entry point ───────────────────────────────────────────────────

/**
 * Generate a video clip from a text prompt.
 * Returns the local file path to the downloaded mp4.
 */
export async function generateVideo(
	prompt: string,
	options?: {
		/** Model to use (default: T2V-01) */
		model?: string;
		/** Duration in seconds (default: 6) */
		durationSec?: number;
		/** Resolution (default: 1080P) */
		resolution?: "720P" | "768P" | "1080P";
		/** Progress callback for polling status */
		onProgress?: ProgressCallback;
	},
): Promise<VideoGenerationResult> {
	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_minimax;

	if (!apiKey) {
		return {
			success: false,
			error: "MiniMax API key not configured. Add it in AI Settings.",
		};
	}

	const model = options?.model || "MiniMax-Hailuo-2.3";
	// MiniMax Hailuo only supports 6s or 10s durations
	const rawDur = options?.durationSec || 6;
	const duration = rawDur >= 8 ? 10 : 6;
	const resolution = options?.resolution || "1080P";

	console.log(
		`[Video] Generating clip: model=${model}, duration=${duration}s, resolution=${resolution}`,
	);
	console.log(`[Video] Prompt: ${prompt.slice(0, 150)}`);

	try {
		// Step 1: Submit the generation task
		const taskId = await submitTask(apiKey, prompt, { model, duration, resolution });
		console.log(`[Video] Task submitted: ${taskId}`);

		// Step 2: Poll until completion
		const result = await pollForCompletion(apiKey, taskId, options?.onProgress);
		console.log(`[Video] Task complete: fileId=${result.fileId}, ${result.width}x${result.height}`);

		// Step 3: Get download URL
		const downloadUrl = await getDownloadUrl(apiKey, result.fileId);
		console.log(`[Video] Download URL obtained (1hr TTL)`);

		// Step 4: Download and save mp4
		const videoPath = await downloadVideo(downloadUrl, taskId);
		console.log(`[Video] Saved to: ${videoPath}`);

		return {
			success: true,
			videoPath,
			width: result.width,
			height: result.height,
		};
	} catch (err) {
		console.error("[Video] Generation failed:", err);
		return {
			success: false,
			error: `Video generation failed: ${err instanceof Error ? err.message : err}`,
		};
	}
}

/**
 * Generate multiple video clips in parallel.
 * Returns results in the same order as the input prompts.
 */
export async function generateVideoBatch(
	clips: Array<{
		prompt: string;
		sceneIndex: number;
		model?: string;
		durationSec?: number;
		resolution?: "720P" | "768P" | "1080P";
	}>,
	onProgress?: (sceneIndex: number, progress: VideoGenerationProgress) => void,
): Promise<Array<{ sceneIndex: number; result: VideoGenerationResult }>> {
	// Submit all tasks first, then poll in parallel
	const results = await Promise.all(
		clips.map(async (clip) => {
			const result = await generateVideo(clip.prompt, {
				model: clip.model,
				durationSec: clip.durationSec,
				resolution: clip.resolution,
				onProgress: onProgress ? (p) => onProgress(clip.sceneIndex, p) : undefined,
			});
			return { sceneIndex: clip.sceneIndex, result };
		}),
	);
	return results;
}

// ── MiniMax Video API ──────────────────────────────────────────────────

async function submitTask(
	apiKey: string,
	prompt: string,
	options: { model: string; duration: number; resolution: string },
): Promise<string> {
	const body: Record<string, unknown> = {
		model: options.model,
		prompt,
		duration: options.duration,
		resolution: options.resolution,
		prompt_optimizer: true,
	};

	const response = await fetch("https://api.minimax.io/v1/video_generation", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok) {
		const errBody = await response.text().catch(() => "");
		throw new Error(`Video API ${response.status}: ${errBody.slice(0, 300)}`);
	}

	const data = (await response.json()) as {
		task_id?: string;
		base_resp?: { status_code?: number; status_msg?: string };
	};

	if (data.base_resp?.status_code !== 0) {
		throw new Error(`Video API error: ${data.base_resp?.status_msg || "Unknown"}`);
	}

	if (!data.task_id) {
		throw new Error("Video API returned no task_id");
	}

	return data.task_id;
}

async function pollForCompletion(
	apiKey: string,
	taskId: string,
	onProgress?: ProgressCallback,
): Promise<{ fileId: string; width: number; height: number }> {
	const startTime = Date.now();

	while (Date.now() - startTime < MAX_POLL_TIME_MS) {
		const response = await fetch(
			`https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`,
			{
				method: "GET",
				headers: { Authorization: `Bearer ${apiKey}` },
				signal: AbortSignal.timeout(15_000),
			},
		);

		if (!response.ok) {
			const errBody = await response.text().catch(() => "");
			throw new Error(`Poll API ${response.status}: ${errBody.slice(0, 200)}`);
		}

		const data = (await response.json()) as {
			task_id?: string;
			status?: string;
			file_id?: string;
			video_width?: number;
			video_height?: number;
			base_resp?: { status_code?: number; status_msg?: string };
		};

		const status = data.status as VideoGenerationProgress["status"];
		console.log(
			`[Video] Poll: ${status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`,
		);

		if (onProgress) {
			onProgress({ status, taskId });
		}

		if (status === "Success") {
			if (!data.file_id) throw new Error("Task succeeded but no file_id returned");
			return {
				fileId: data.file_id,
				width: data.video_width || 1920,
				height: data.video_height || 1080,
			};
		}

		if (status === "Fail") {
			throw new Error(`Video generation failed: ${data.base_resp?.status_msg || "Unknown reason"}`);
		}

		// Wait before next poll
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error(`Video generation timed out after ${MAX_POLL_TIME_MS / 1000}s`);
}

async function getDownloadUrl(apiKey: string, fileId: string): Promise<string> {
	const response = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
		method: "GET",
		headers: { Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(15_000),
	});

	if (!response.ok) {
		const errBody = await response.text().catch(() => "");
		throw new Error(`File retrieve API ${response.status}: ${errBody.slice(0, 200)}`);
	}

	const data = (await response.json()) as {
		file?: {
			file_id?: number;
			download_url?: string;
			filename?: string;
			bytes?: number;
		};
		base_resp?: { status_code?: number; status_msg?: string };
	};

	if (!data.file?.download_url) {
		throw new Error("No download URL in file retrieve response");
	}

	return data.file.download_url;
}

async function downloadVideo(url: string, taskId: string): Promise<string> {
	const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
	if (!response.ok) {
		throw new Error(`Download failed: ${response.status}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	const outputDir = await ensureVideoDir();
	const fileName = `video-${taskId}-${Date.now()}.mp4`;
	const videoPath = path.join(outputDir, fileName);
	await fs.writeFile(videoPath, buffer);

	return videoPath;
}
