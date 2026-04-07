/**
 * Music Generation Service — generates instrumental background music.
 *
 * Uses MiniMax Music Generation API (requires MiniMax API key, independent of
 * active chat provider). Falls back to bundled tracks if no key is configured.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { loadSettings } from "../settings";

const MUSIC_OUTPUT_DIR = "music-output";

function getMusicOutputDir(): string {
	return path.join(app.getPath("userData"), MUSIC_OUTPUT_DIR);
}

async function ensureMusicDir(): Promise<string> {
	const dir = getMusicOutputDir();
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

// ── Library management ─────────────────────────────────────────────────

export interface MusicLibraryEntry {
	/** Absolute path on disk */
	path: string;
	/** Filename only */
	name: string;
	/** ms since epoch when the file was created */
	createdAt: number;
	/** File size in bytes */
	sizeBytes: number;
	/** Optional human-friendly label if a sidecar .json is present */
	label?: string;
	/** Optional mood tag from sidecar */
	mood?: string;
	/** Optional prompt snippet from sidecar */
	prompt?: string;
}

/** List all previously generated music files in the library directory,
 * newest first. Reads optional sidecar metadata (.json next to .mp3). */
export async function listMusicLibrary(): Promise<MusicLibraryEntry[]> {
	try {
		const dir = await ensureMusicDir();
		const names = await fs.readdir(dir);
		const entries: MusicLibraryEntry[] = [];
		for (const name of names) {
			if (!name.toLowerCase().endsWith(".mp3")) continue;
			const fullPath = path.join(dir, name);
			try {
				const stat = await fs.stat(fullPath);
				if (!stat.isFile()) continue;
				const entry: MusicLibraryEntry = {
					path: fullPath,
					name,
					createdAt: stat.birthtimeMs || stat.mtimeMs,
					sizeBytes: stat.size,
				};
				// Attempt to read sidecar metadata (.json next to .mp3)
				const sidecar = fullPath.replace(/\.mp3$/i, ".json");
				try {
					const meta = JSON.parse(await fs.readFile(sidecar, "utf-8"));
					if (meta && typeof meta === "object") {
						if (typeof meta.label === "string") entry.label = meta.label;
						if (typeof meta.mood === "string") entry.mood = meta.mood;
						if (typeof meta.prompt === "string") entry.prompt = meta.prompt;
					}
				} catch {
					/* no sidecar, that's fine */
				}
				entries.push(entry);
			} catch {
				/* skip files we can't stat */
			}
		}
		entries.sort((a, b) => b.createdAt - a.createdAt);
		return entries;
	} catch (err) {
		console.error("[Music] Failed to list library:", err);
		return [];
	}
}

/** Delete a music file from the library (and its sidecar if present). */
export async function deleteMusicLibraryEntry(
	filePath: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		// Safety: require the path to live under the music output dir so we
		// can't be tricked into deleting arbitrary files.
		const dir = getMusicOutputDir();
		const resolved = path.resolve(filePath);
		if (!resolved.startsWith(path.resolve(dir))) {
			return { success: false, error: "Refusing to delete file outside music library" };
		}
		await fs.unlink(resolved);
		// Best-effort sidecar cleanup
		try {
			await fs.unlink(resolved.replace(/\.mp3$/i, ".json"));
		} catch {
			/* no sidecar */
		}
		return { success: true };
	} catch (err) {
		return { success: false, error: `Delete failed: ${err}` };
	}
}

/** Save sidecar metadata (label/mood/prompt) next to a music file so the
 * library view can show friendly names. */
async function writeMusicSidecar(
	audioPath: string,
	meta: { label?: string; mood?: string; prompt?: string },
) {
	try {
		const sidecar = audioPath.replace(/\.mp3$/i, ".json");
		await fs.writeFile(sidecar, JSON.stringify(meta, null, 2), "utf-8");
	} catch (err) {
		console.warn("[Music] Failed to write sidecar:", err);
	}
}

// ── Mood presets ────────────────────────────────────────────────────────

export type MusicMood =
	| "energetic"
	| "ambient"
	| "dramatic"
	| "minimal"
	| "upbeat"
	| "saas-teaser"
	| "hype-launch"
	| "indie-bedroom"
	| "future-garage"
	| "synthwave-retro"
	| "lofi-hiphop"
	| "glitch-hop"
	| "tropical-house"
	| "phonk-trailer"
	| "anthem-build"
	// Viral / catchy ad styles — the kind of music that actually gets stuck
	// in your head from real TV/YouTube/social ads.
	| "whistle-hook"
	| "clap-stomp-anthem"
	| "feel-good-pop"
	| "tiktok-hook"
	| "funk-bass-horns"
	| "handclap-shuffle"
	| "surf-garage"
	| "afrobeat-pop"
	| "disney-magical"
	| "retro-funk"
	| "custom";

const MOOD_PROMPTS: Record<Exclude<MusicMood, "custom">, string> = {
	energetic:
		"Modern upbeat electronic background music for a tech product video. Energetic, confident, driving beat. Clean synths, subtle bass. Professional corporate energy without being cheesy. 20 seconds.",
	ambient:
		"Calm, atmospheric ambient background music for a software tutorial. Gentle pads, soft piano, minimal percussion. Warm and inviting. Professional and clean. 20 seconds.",
	dramatic:
		"Cinematic dramatic background music for a product launch video. Building tension, epic strings, powerful drums. Inspiring and bold. Modern film score feel. 20 seconds.",
	minimal:
		"Minimal, subtle background music for a clean product demo. Soft clicks, gentle tones, barely-there rhythm. Should enhance without distracting. Lo-fi meets corporate. 20 seconds.",
	upbeat:
		"Happy, upbeat acoustic background music for a friendly product walkthrough. Light guitar, gentle claps, positive vibes. Warm, approachable, not too fast. 20 seconds.",

	// ── SaaS-teaser-tuned moods ──
	// These are specifically tuned for the kind of fast-cut motion graphic
	// teaser videos this app produces — short cuts, punchy text, scene
	// transitions every 2-3 seconds. Each preset matches a distinct motion
	// design aesthetic from top agencies (Lovable, Vercel, Linear, Figma,
	// Framer, Stripe, etc.) so users can pick a vibe instead of writing a
	// custom prompt.
	"saas-teaser":
		"Catchy modern pop-electronic instrumental for a SaaS product teaser video. Clean 4/4 beat at 115 BPM, plucky lead synth hook, tasteful sub bass, airy reverb. Hook lands in the first 4 seconds, energy lifts at the midpoint, clean resolve at the end. Think Linear, Vercel, Lovable product reveal vibes — confident, modern, memorable. Instrumental. 20 seconds.",
	"hype-launch":
		"High-energy hybrid cinematic trailer music for a SaaS product launch. Punchy kick drum, risers and impacts at scene cuts, layered synth stabs, tight snare rolls, sub-bass drops. Building tension that climaxes with a bold drop in the final third. Think Apple keynote meets modern hip-hop trailer. Instrumental. 20 seconds.",
	"indie-bedroom":
		"Warm indie bedroom-pop instrumental for a friendly maker-product teaser. Tape-saturated lo-fi drums, dreamy electric guitar, soft pads, gentle bass. Approachable and human, like Notion or Linear's launch videos. Mid-tempo around 100 BPM. Instrumental. 20 seconds.",
	"future-garage":
		"Smooth future garage instrumental with crisp shuffled 2-step drums, deep sub bass, ethereal vocal chop textures (no lyrics), glassy atmospheric pads. Cool and futuristic, like Arc browser or Raycast product videos. 130 BPM with half-time feel. Instrumental. 20 seconds.",
	"synthwave-retro":
		"Retro synthwave instrumental with analog-style gated drums, wide stereo lead synth, arpeggiated sequences, juicy sub bass. Nostalgic 80s cyberpunk energy but clean enough for a modern product video. 110 BPM. Instrumental. 20 seconds.",
	"lofi-hiphop":
		"Chill lo-fi hip-hop instrumental for a relaxed product walkthrough. Warm dusty drums with vinyl crackle, mellow Rhodes piano chords, upright bass, soft jazz guitar licks. Easy listening, focused, calm confidence. 85 BPM. Instrumental. 20 seconds.",
	"glitch-hop":
		"Precision glitch-hop instrumental for a fast-paced app feature showcase. Chopped tight drums, granular synth textures, bit-crushed stabs, punchy sub bass, clever rhythmic edits. Tech-forward and playful like Figma Config videos. 105 BPM. Instrumental. 20 seconds.",
	"tropical-house":
		"Bright tropical house instrumental for an optimistic product teaser. Plucked marimba lead, airy vocal chops (no lyrics), warm sub bass, crisp snare, open hi-hats. Uplifting and summery without being cheesy. 118 BPM. Instrumental. 20 seconds.",
	"phonk-trailer":
		"Modern phonk-inspired trailer instrumental with deep 808s, cowbell accents, memphis rap textures (instrumental), distorted bass, aggressive kicks. Edgy and confident for a bold product reveal. 140 BPM with half-time feel. Instrumental. 20 seconds.",
	"anthem-build":
		"Epic anthemic build instrumental for a hero product moment. Starts minimal with piano/pad, layers in strings and percussion, crescendos with big drums and bright synths, then resolves to a clean final note. Cinematic but modern. 100 BPM. Instrumental. 20 seconds.",

	// ── Viral / catchy ad styles ─────────────────────────────────────
	// These are modeled after the kind of music used in actual memorable TV
	// and social ads — the sort of music that gets stuck in your head after
	// one listen. Each prompt leans on specific sonic signatures (whistled
	// hook, group claps, hand percussion, horn stabs, 8-bar loop hook) that
	// tend to go viral.
	"whistle-hook":
		"Catchy whistled instrumental hook for a product commercial. Clear whistled melody carrying the song, warm acoustic guitar strums, gentle hand claps, light tambourine, subtle bass. Think feel-good TV commercial you can't get out of your head — like the melody from Maroon 5 'Moves Like Jagger' or any whistled pop hook. Instrumental. 100 BPM. 20 seconds.",
	"clap-stomp-anthem":
		"Anthem stomp-and-clap instrumental for a bold product ad. Big group hand claps on 2 and 4, tribal foot stomps, bright anthem shout pattern (instrumental no lyrics), driving acoustic guitar, epic drum builds. Think Imagine Dragons 'Thunder', Gala's 'Freed From Desire', Queen 'We Will Rock You' energy adapted for a modern ad. Instrumental. 120 BPM. 20 seconds.",
	"feel-good-pop":
		"Sunny feel-good pop instrumental for a lifestyle ad. Bright ukulele plucks, cheerful hand claps, whistling lead, warm acoustic guitar, simple bass line, crisp drums. Happy and optimistic without being cheesy. Think Pharrell 'Happy', Twenty One Pilots 'Stressed Out' instrumental, Jason Mraz vibes. 112 BPM. Instrumental. 20 seconds.",
	"tiktok-hook":
		"Catchy 8-bar loopable hook instrumental designed to be memorable in 3 seconds. Punchy kick drum, pitched vocal chop (no lyrics, just 'oh oh' or 'ah ah' type), bright lead synth earworm melody, tight claps, tasteful sub bass. Built to get stuck in your head like a viral TikTok sound. 110 BPM. Instrumental. 20 seconds.",
	"funk-bass-horns":
		"Playful funk instrumental with a huge bass groove and stab horns for a bold product ad. Slap bass driving the song, punchy horn section stabs (trumpet, sax), tight funk drums with ghost notes, wah guitar accents. Think Bruno Mars '24K Magic', Mark Ronson 'Uptown Funk', Jamiroquai — but instrumental. 108 BPM. Instrumental. 20 seconds.",
	"handclap-shuffle":
		"Shuffling handclap indie instrumental for a friendly outdoor ad. Strong off-beat hand claps, whistled lead over strummed acoustic guitar, warm kick-snare shuffle, gentle tambourine, bright glockenspiel. Think Of Monsters and Men 'Little Talks', Edward Sharpe 'Home', or any indie pop commercial. 98 BPM. Instrumental. 20 seconds.",
	"surf-garage":
		"Reverby surf rock garage instrumental for a playful product ad. Spring reverb twangy guitar riffs, snappy snare with tambourine, upright bass walking lines, organ stabs. Retro cool and instantly recognizable from IKEA, Apple Watch, and Honda ads. 115 BPM. Instrumental. 20 seconds.",
	"afrobeat-pop":
		"Bright afrobeat-pop instrumental for an uplifting global ad. Polyrhythmic kick drum, talking drum accents, shekere shaker, warm bass, bright guitar riffs, marimba melody, optional horn stabs. Think modern Afrobeats crossover — Burna Boy, Davido instrumental style. 108 BPM. Instrumental. 20 seconds.",
	"disney-magical":
		"Whimsical magical instrumental for a delightful product reveal. Twinkling glockenspiel melody, playful plucked strings, airy harp, soft woodwinds, warm pizzicato bass, sparkly chime accents. Feels like wonder and discovery — think Disney, Pixar, or a premium kids' brand ad. 96 BPM. Instrumental. 20 seconds.",
	"retro-funk":
		"70s retro funk instrumental for a cool confident ad. Clav riffs, wah-wah guitar, tight funk drums with cowbell, warm Rhodes piano, deep funk bass, optional brass punches. Think 'Superstition' Stevie Wonder, Curtis Mayfield, or a vintage Volkswagen ad — but modern production. 104 BPM. Instrumental. 20 seconds.",
};

// ── Types ───────────────────────────────────────────────────────────────

export interface MusicResult {
	success: boolean;
	audioPath?: string;
	error?: string;
	/** Duration in seconds */
	durationSec?: number;
}

// ── Main entry point ────────────────────────────────────────────────────

/**
 * Generate instrumental background music.
 * Uses MiniMax music generation API with the MiniMax API key
 * (independent of which chat provider is active).
 */
export async function generateMusic(
	mood: MusicMood,
	customPrompt?: string,
	/** Video duration in seconds — music will match this length */
	videoDurationSec?: number,
	/** Vocal mode: instrumental (default), auto-lyrics, or custom-lyrics */
	vocalMode?: VocalMode,
	/** Custom lyrics with [Verse]/[Chorus] tags (only for custom-lyrics mode) */
	lyrics?: string,
): Promise<MusicResult> {
	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_minimax;

	if (!apiKey) {
		console.log("[Music] No MiniMax API key found. Checked aiApiKey_minimax in settings.");
		return {
			success: false,
			error: "MiniMax API key not configured. Add it in AI Settings to generate custom music.",
		};
	}

	console.log(
		`[Music] Generating ${mood} music, key present: ${apiKey.slice(0, 8)}..., duration: ${videoDurationSec ?? "default"}s`,
	);
	const duration = videoDurationSec ? Math.round(videoDurationSec) : 20;
	let prompt =
		mood === "custom" && customPrompt
			? customPrompt
			: MOOD_PROMPTS[mood as keyof typeof MOOD_PROMPTS] || MOOD_PROMPTS.energetic;

	// Replace duration placeholder and add structure guidance
	prompt = prompt.replace(/\d+ seconds\./, `${duration} seconds.`);
	prompt += ` The track should be exactly ${duration} seconds long. Build energy in the first third, sustain in the middle, and resolve cleanly in the final 3-4 seconds with a natural ending — not an abrupt cutoff.`;

	try {
		const result = await generateMiniMaxMusic(prompt, apiKey, { vocalMode, lyrics });
		if (result.success && result.audioPath) {
			// Write sidecar metadata so the library view can show a friendly label
			await writeMusicSidecar(result.audioPath, {
				label: mood === "custom" ? (customPrompt || "Custom").slice(0, 60) : mood,
				mood,
				prompt: prompt.slice(0, 500),
			});
		}
		return result;
	} catch (err) {
		console.error("Music generation failed:", err);
		return {
			success: false,
			error: `Music generation failed: ${err instanceof Error ? err.message : err}`,
		};
	}
}

// ── Lyrics generation ──────────────────────────────────────────────────

export interface LyricsResult {
	success: boolean;
	lyrics?: string;
	title?: string;
	styleTags?: string;
	error?: string;
}

/**
 * Generate structured lyrics via MiniMax Lyrics Generation API.
 * Returns lyrics with [Verse], [Chorus], etc. tags that can be fed directly
 * into the music generation `lyrics` field.
 */
export async function generateLyrics(themePrompt: string, title?: string): Promise<LyricsResult> {
	const settings = await loadSettings();
	const apiKey = settings.aiApiKey_minimax;
	if (!apiKey) {
		return { success: false, error: "MiniMax API key not configured." };
	}

	try {
		console.log("[Lyrics] Generating lyrics for:", themePrompt.slice(0, 100));
		const response = await fetch("https://api.minimax.io/v1/lyrics_generation", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "music-2.5+",
				mode: "write_full_song",
				prompt: themePrompt,
				...(title ? { title } : {}),
			}),
			signal: AbortSignal.timeout(60_000),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			console.error("[Lyrics] API error:", response.status, body.slice(0, 300));
			return { success: false, error: `Lyrics API ${response.status}: ${body.slice(0, 200)}` };
		}

		const data = (await response.json()) as {
			data?: { song_title?: string; style_tags?: string; lyrics?: string };
			base_resp?: { status_code?: number; status_msg?: string };
		};

		if (data.base_resp?.status_code !== 0) {
			return { success: false, error: data.base_resp?.status_msg || "Lyrics generation failed" };
		}

		return {
			success: true,
			lyrics: data.data?.lyrics || "",
			title: data.data?.song_title || title,
			styleTags: data.data?.style_tags,
		};
	} catch (err) {
		console.error("[Lyrics] Failed:", err);
		return { success: false, error: `Lyrics generation failed: ${err}` };
	}
}

// ── MiniMax Music API ──────────────────────────────────────────────────

export type VocalMode = "instrumental" | "auto-lyrics" | "custom-lyrics";

async function generateMiniMaxMusic(
	prompt: string,
	apiKey: string,
	options?: {
		vocalMode?: VocalMode;
		lyrics?: string;
	},
): Promise<MusicResult> {
	const vocalMode = options?.vocalMode || "instrumental";
	console.log("[Music] Calling MiniMax API... mode:", vocalMode);
	console.log("[Music] Prompt:", prompt.slice(0, 150));

	const body: Record<string, unknown> = {
		model: "music-2.5+",
		prompt,
		output_format: "url",
		audio_setting: {
			sample_rate: 44100,
			bitrate: 128000,
			format: "mp3",
		},
	};

	if (vocalMode === "instrumental") {
		body.is_instrumental = true;
	} else if (vocalMode === "auto-lyrics") {
		// Let MiniMax auto-generate lyrics from the prompt
		body.is_instrumental = false;
		body.lyrics_optimizer = true;
	} else if (vocalMode === "custom-lyrics" && options?.lyrics) {
		// Use explicit lyrics (with [Verse]/[Chorus] tags)
		body.is_instrumental = false;
		body.lyrics = options.lyrics;
	} else {
		body.is_instrumental = true;
	}

	// Retry once on timeout — MiniMax can be slow under load
	let response: Response | null = null;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			response = await fetch("https://api.minimax.io/v1/music_generation", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(240_000),
			});
			break;
		} catch (err: any) {
			if (attempt === 0 && err?.name === "TimeoutError") {
				console.warn("[Music] Attempt 1 timed out, retrying...");
				continue;
			}
			throw err;
		}
	}

	if (!response || !response.ok) {
		const errBody = await response?.text().catch(() => "") || "";
		console.error("[Music] API error:", response?.status, errBody.slice(0, 300));
		throw new Error(`MiniMax Music API ${response?.status}: ${errBody.slice(0, 200)}`);
	}

	const data = (await response.json()) as {
		data?: { audio?: string; status?: number };
		extra_info?: { music_duration?: number };
		base_resp?: { status_code?: number; status_msg?: string };
	};

	console.log("[Music] Response status:", data.base_resp?.status_code, data.base_resp?.status_msg);
	console.log("[Music] Audio URL present:", !!data.data?.audio);
	console.log("[Music] Duration:", data.extra_info?.music_duration);

	if (data.base_resp?.status_code !== 0) {
		throw new Error(`MiniMax error: ${data.base_resp?.status_msg || "Unknown error"}`);
	}

	if (!data.data?.audio) {
		throw new Error("MiniMax returned empty audio data");
	}

	// Download audio from URL and save as mp3
	const audioUrl = data.data.audio;
	console.log("[Music] Downloading from:", audioUrl.slice(0, 80));
	const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
	if (!audioResponse.ok) {
		throw new Error(`Failed to download audio: ${audioResponse.status}`);
	}
	const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
	const outputDir = await ensureMusicDir();
	const fileName = `music-${Date.now()}.mp3`;
	const audioPath = path.join(outputDir, fileName);
	await fs.writeFile(audioPath, audioBuffer);

	return {
		success: true,
		audioPath,
		durationSec: data.extra_info?.music_duration,
	};
}
