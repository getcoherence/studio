import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { app } from "electron";
import {
	type ModelDownloadProgress,
	WHISPER_MODELS,
	type WhisperModelStatus,
} from "../../src/lib/ai/types";

const MODELS_DIR = path.join(app.getPath("userData"), "models");

async function ensureModelsDir(): Promise<void> {
	await fs.mkdir(MODELS_DIR, { recursive: true });
}

/**
 * Get the local file path for a model.
 */
export function getModelPath(modelId: string): string {
	return path.join(MODELS_DIR, `ggml-${modelId}.bin`);
}

/**
 * Check whether a model is downloaded and return its status.
 */
export async function getModelStatus(modelId: string): Promise<WhisperModelStatus> {
	const modelDef = WHISPER_MODELS.find((m) => m.id === modelId);
	if (!modelDef) {
		return { modelId, downloaded: false };
	}

	const filePath = getModelPath(modelId);
	try {
		const stat = await fs.stat(filePath);
		return {
			modelId,
			downloaded: true,
			path: filePath,
			sizeBytes: stat.size,
		};
	} catch {
		return { modelId, downloaded: false };
	}
}

/**
 * Download a whisper model from HuggingFace with progress callback.
 *
 * @param modelId     One of: tiny, base, small
 * @param onProgress  Called periodically with download progress
 * @returns           Local path to the downloaded model file
 */
export async function downloadModel(
	modelId: string,
	onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<string> {
	const modelDef = WHISPER_MODELS.find((m) => m.id === modelId);
	if (!modelDef) {
		throw new Error(
			`Unknown model: ${modelId}. Available: ${WHISPER_MODELS.map((m) => m.id).join(", ")}`,
		);
	}

	await ensureModelsDir();
	const filePath = getModelPath(modelId);
	const tmpPath = `${filePath}.download`;

	return new Promise<string>((resolve, reject) => {
		const get = modelDef.url.startsWith("https") ? https.get : http.get;

		const request = get(
			modelDef.url,
			{ headers: { "User-Agent": "OpenScreen/1.0" } },
			(response) => {
				// Follow redirects (HuggingFace often returns 302)
				if (
					response.statusCode &&
					response.statusCode >= 300 &&
					response.statusCode < 400 &&
					response.headers.location
				) {
					const redirectGet = response.headers.location.startsWith("https") ? https.get : http.get;
					redirectGet(
						response.headers.location,
						{ headers: { "User-Agent": "OpenScreen/1.0" } },
						(redirectedResponse) => {
							handleResponse(redirectedResponse);
						},
					).on("error", reject);
					response.destroy();
					return;
				}

				handleResponse(response);
			},
		);

		request.on("error", reject);

		async function handleResponse(response: http.IncomingMessage) {
			if (response.statusCode !== 200) {
				reject(new Error(`Download failed with status ${response.statusCode}`));
				return;
			}

			const totalBytes = Number(response.headers["content-length"]) || modelDef!.sizeBytes;
			let downloadedBytes = 0;

			const chunks: Buffer[] = [];

			response.on("data", (chunk: Buffer) => {
				chunks.push(chunk);
				downloadedBytes += chunk.length;
				onProgress?.({
					modelId,
					downloadedBytes,
					totalBytes,
					percent: Math.round((downloadedBytes / totalBytes) * 100),
				});
			});

			response.on("end", async () => {
				try {
					const fullBuffer = Buffer.concat(chunks);
					await fs.writeFile(tmpPath, fullBuffer);
					await fs.rename(tmpPath, filePath);
					resolve(filePath);
				} catch (err) {
					// Clean up partial download
					try {
						await fs.unlink(tmpPath);
					} catch {
						// ignore
					}
					reject(err);
				}
			});

			response.on("error", async (err) => {
				try {
					await fs.unlink(tmpPath);
				} catch {
					// ignore
				}
				reject(err);
			});
		}
	});
}

/**
 * Delete a downloaded model file.
 */
export async function deleteModel(modelId: string): Promise<void> {
	const filePath = getModelPath(modelId);
	try {
		await fs.unlink(filePath);
	} catch (err) {
		const nodeErr = err as NodeJS.ErrnoException;
		if (nodeErr.code !== "ENOENT") {
			throw err;
		}
		// File doesn't exist — nothing to delete
	}
}
