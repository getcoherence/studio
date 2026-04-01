import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { CaptionLine, CaptionTrack, CaptionWord } from "../../src/lib/ai/types";
import { getModelPath } from "./modelManager";

/** Whisper CLI JSON output segment (word-level) */
interface WhisperJsonToken {
	text: string;
	timestamps: { from: string; to: string };
	offsets: { from: number; to: number };
	p: number; // probability / confidence
}

interface WhisperJsonSegment {
	text: string;
	timestamps: { from: string; to: string };
	offsets: { from: number; to: number };
	tokens: WhisperJsonToken[];
}

interface WhisperJsonOutput {
	result: {
		language: string;
	};
	transcription: WhisperJsonSegment[];
}

export interface TranscribeOptions {
	/** Whisper model ID (tiny, base, small) */
	modelId?: string;
	/** Language code for transcription (auto-detect if omitted) */
	language?: string;
	/** Number of threads to use */
	threads?: number;
}

/**
 * Candidate binary names for whisper.cpp.
 * Recent releases (v1.6+) renamed the binary from "main" to "whisper-cli".
 * We also check "whisper" for custom-named builds.
 */
const WHISPER_BINARY_NAMES = ["whisper-cli", "whisper", "main"];

/**
 * Locate the whisper.cpp binary. Checks development and packaged locations.
 * Searches for multiple candidate binary names (whisper-cli, whisper, main)
 * since the project renamed the binary over time.
 * Returns null if not found (user needs to install it).
 */
function findWhisperBinary(): string | null {
	const platform = process.platform;
	const ext = platform === "win32" ? ".exe" : "";

	for (const name of WHISPER_BINARY_NAMES) {
		const binaryName = `${name}${ext}`;

		if (app.isPackaged) {
			const bundled = path.join(process.resourcesPath, "bin", binaryName);
			if (existsSync(bundled)) return bundled;
		} else {
			const devBin = path.join(app.getAppPath(), "native", "bin", platform, binaryName);
			if (existsSync(devBin)) return devBin;
		}
	}

	return null;
}

/**
 * Check whether the whisper binary is available.
 */
export async function isWhisperAvailable(): Promise<boolean> {
	const binaryPath = findWhisperBinary();
	if (!binaryPath) return false;

	try {
		await fs.access(binaryPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Group words into display lines. Whisper segments are already sentence-level,
 * but we further split long lines for readability (max ~8 words per line).
 */
function groupWordsIntoLines(words: CaptionWord[]): CaptionLine[] {
	const MAX_WORDS_PER_LINE = 8;
	const lines: CaptionLine[] = [];
	let currentLineWords: CaptionWord[] = [];

	for (const word of words) {
		currentLineWords.push(word);

		// Split on punctuation that ends a phrase, or when line is long enough
		const endsWithPunctuation = /[.!?,;:]$/.test(word.text.trim());
		if (currentLineWords.length >= MAX_WORDS_PER_LINE || endsWithPunctuation) {
			if (currentLineWords.length > 0) {
				lines.push({
					id: randomUUID(),
					words: [...currentLineWords],
					startMs: currentLineWords[0].startMs,
					endMs: currentLineWords[currentLineWords.length - 1].endMs,
				});
				currentLineWords = [];
			}
		}
	}

	// Flush remaining words
	if (currentLineWords.length > 0) {
		lines.push({
			id: randomUUID(),
			words: [...currentLineWords],
			startMs: currentLineWords[0].startMs,
			endMs: currentLineWords[currentLineWords.length - 1].endMs,
		});
	}

	return lines;
}

/**
 * Transcribe an audio file using whisper.cpp CLI.
 *
 * @param audioPath  Path to 16 kHz mono WAV file
 * @param options    Transcription options
 * @returns          Array of CaptionWord with word-level timestamps
 */
export async function transcribe(
	audioPath: string,
	options: TranscribeOptions = {},
): Promise<{ words: CaptionWord[]; language: string }> {
	const binaryPath = findWhisperBinary();
	if (!binaryPath) {
		throw new Error(
			"Whisper binary not found. Please install whisper.cpp and place the binary at native/bin/{platform}/whisper",
		);
	}

	// Verify binary exists
	try {
		await fs.access(binaryPath);
	} catch {
		throw new Error(`Whisper binary not found at ${binaryPath}. Please install whisper.cpp.`);
	}

	const modelId = options.modelId || "base";
	const modelPath = getModelPath(modelId);

	// Verify model exists
	try {
		await fs.access(modelPath);
	} catch {
		throw new Error(`Whisper model "${modelId}" not found. Please download it first.`);
	}

	// Use explicit output path to avoid whisper's filename guessing
	const outputBase = audioPath.replace(/\.[^.]+$/, "");
	const outputJsonPath = `${outputBase}.json`;

	const args = [
		"-m",
		modelPath,
		"-f",
		audioPath,
		"--output-json-full", // Full JSON with word-level timestamps
		"-of",
		outputBase, // Explicit output path (whisper adds .json)
		"--no-prints", // Suppress progress output
		"-t",
		String(options.threads || 4),
	];

	if (options.language) {
		args.push("-l", options.language);
	}

	return new Promise<{ words: CaptionWord[]; language: string }>((resolve, reject) => {
		execFile(
			binaryPath,
			args,
			{
				timeout: 600_000, // 10 minute timeout for long videos
				maxBuffer: 50 * 1024 * 1024, // 50 MB buffer for large outputs
			},
			async (error, _stdout, stderr) => {
				if (error) {
					const msg = stderr?.trim() || error.message;
					reject(new Error(`Whisper transcription failed: ${msg}`));
					return;
				}

				try {
					const jsonContent = await fs.readFile(outputJsonPath, "utf-8");
					const output: WhisperJsonOutput = JSON.parse(jsonContent);

					const words: CaptionWord[] = [];

					for (const segment of output.transcription) {
						if (segment.tokens) {
							for (const token of segment.tokens) {
								const text = token.text.trim();
								if (!text) continue;
								// Filter out whisper special tokens like [_TT_550], [BLANK_AUDIO], etc.
								if (/^\[.*\]$/.test(text)) continue;

								words.push({
									text,
									startMs: token.offsets.from,
									endMs: token.offsets.to,
									confidence: token.p,
								});
							}
						} else {
							// Fallback: use segment-level timing if no word tokens
							const text = segment.text.trim();
							if (!text) continue;

							words.push({
								text,
								startMs: segment.offsets.from,
								endMs: segment.offsets.to,
								confidence: 1,
							});
						}
					}

					// Clean up output file
					try {
						await fs.unlink(outputJsonPath);
					} catch {
						// ignore
					}

					resolve({
						words,
						language: output.result?.language || "en",
					});
				} catch (parseError) {
					reject(
						new Error(
							`Failed to parse Whisper output: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
						),
					);
				}
			},
		);
	});
}

/**
 * Run full transcription pipeline: transcribe audio and build a CaptionTrack.
 */
export async function createCaptionTrack(
	audioPath: string,
	options: TranscribeOptions = {},
): Promise<CaptionTrack> {
	const { words, language } = await transcribe(audioPath, options);
	const lines = groupWordsIntoLines(words);
	const modelId = options.modelId || "base";

	return {
		id: randomUUID(),
		language,
		lines,
		modelId,
		createdAt: Date.now(),
	};
}
