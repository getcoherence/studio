// ── Music Catalog ───────────────────────────────────────────────────────
//
// Bundled royalty-free background music tracks and AI music generation.
// Provides mood-based auto-selection for cinematic videos.

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
	| "whistle-hook"
	| "clap-stomp-anthem"
	| "feel-good-pop"
	| "tiktok-hook"
	| "funk-bass-horns"
	| "handclap-shuffle"
	| "surf-garage"
	| "afrobeat-pop"
	| "disney-magical"
	| "retro-funk";

/** Human-friendly label + one-line vibe description for each mood. Shown in
 * the music panel button list so users can pick a style at a glance. */
export const MUSIC_MOOD_PRESETS: Array<{
	id: MusicMood;
	label: string;
	description: string;
	group: "classic" | "saas" | "viral";
}> = [
	// Classic general-purpose moods
	{ id: "energetic", label: "Energetic", description: "Modern tech product energy — clean synths, driving beat", group: "classic" },
	{ id: "upbeat", label: "Upbeat", description: "Friendly acoustic walkthrough vibes — light guitar, positive", group: "classic" },
	{ id: "ambient", label: "Ambient", description: "Calm tutorial mood — gentle pads, soft piano", group: "classic" },
	{ id: "dramatic", label: "Dramatic", description: "Cinematic launch — epic strings, building tension", group: "classic" },
	{ id: "minimal", label: "Minimal", description: "Subtle, barely-there — enhances without distracting", group: "classic" },

	// SaaS teaser / motion-graphic styles
	{ id: "saas-teaser", label: "SaaS Teaser", description: "Linear/Vercel/Lovable vibes — plucky hook, clean 4/4, modern", group: "saas" },
	{ id: "hype-launch", label: "Hype Launch", description: "Apple-keynote-meets-trailer — risers, impacts, bold drop", group: "saas" },
	{ id: "indie-bedroom", label: "Indie Bedroom", description: "Maker-friendly lo-fi indie — dreamy guitar, warm drums", group: "saas" },
	{ id: "future-garage", label: "Future Garage", description: "Arc/Raycast cool — crisp 2-step, deep sub, glassy pads", group: "saas" },
	{ id: "synthwave-retro", label: "Synthwave", description: "80s cyberpunk — gated drums, wide leads, arpeggios", group: "saas" },
	{ id: "lofi-hiphop", label: "Lo-Fi Hip-Hop", description: "Chill focus — vinyl crackle, Rhodes, upright bass", group: "saas" },
	{ id: "glitch-hop", label: "Glitch Hop", description: "Figma Config energy — chopped drums, granular textures", group: "saas" },
	{ id: "tropical-house", label: "Tropical House", description: "Bright and optimistic — plucked marimba, airy chops", group: "saas" },
	{ id: "phonk-trailer", label: "Phonk Trailer", description: "Edgy bold reveal — deep 808s, cowbell, aggressive kicks", group: "saas" },
	{ id: "anthem-build", label: "Anthem Build", description: "Hero moment — piano → strings → big drums crescendo", group: "saas" },

	// Viral / catchy ad styles — the kind of music that actually gets stuck in your head
	{ id: "whistle-hook", label: "Whistle Hook", description: "Earworm whistled melody + claps — feel-good TV ad", group: "viral" },
	{ id: "clap-stomp-anthem", label: "Clap + Stomp Anthem", description: "Stadium stomp-clap anthem — Imagine Dragons / Queen energy", group: "viral" },
	{ id: "feel-good-pop", label: "Feel-Good Pop", description: "Sunny uke + claps + whistle — Pharrell 'Happy' vibes", group: "viral" },
	{ id: "tiktok-hook", label: "TikTok Hook", description: "8-bar loopable earworm — pitched chops, punchy kick", group: "viral" },
	{ id: "funk-bass-horns", label: "Funk Bass + Horns", description: "Slap bass + horn stabs — Bruno Mars / Uptown Funk", group: "viral" },
	{ id: "handclap-shuffle", label: "Handclap Shuffle", description: "Off-beat claps + whistled indie — Of Monsters & Men", group: "viral" },
	{ id: "surf-garage", label: "Surf Garage", description: "Twangy reverb guitar — IKEA / Apple Watch ad vibe", group: "viral" },
	{ id: "afrobeat-pop", label: "Afrobeat Pop", description: "Polyrhythmic drums, marimba — Burna Boy style", group: "viral" },
	{ id: "disney-magical", label: "Disney Magical", description: "Twinkling glockenspiel, plucked strings — wonder & delight", group: "viral" },
	{ id: "retro-funk", label: "Retro Funk", description: "70s clav + wah — Stevie Wonder / vintage VW ad", group: "viral" },
];

// ── Prompt builder (mix-and-match) ──────────────────────────────────────
// Lets users assemble a custom prompt from orthogonal sliders/dropdowns
// without having to write the whole thing from scratch.

export interface PromptIngredients {
	/** Base genre/style */
	genre?:
		| "electronic"
		| "pop"
		| "indie"
		| "hip-hop"
		| "funk"
		| "rock"
		| "acoustic"
		| "cinematic"
		| "ambient"
		| "world";
	/** Tempo feel */
	tempo?: "chill" | "mid" | "driving" | "fast";
	/** Energy curve */
	energy?: "calm" | "building" | "high" | "explosive";
	/** Emotional tone */
	vibe?: "confident" | "playful" | "nostalgic" | "edgy" | "warm" | "mysterious" | "euphoric";
	/** Prominent instruments (multi-select) */
	instruments?: Array<
		| "synth-lead"
		| "piano"
		| "electric-guitar"
		| "acoustic-guitar"
		| "bass"
		| "drums"
		| "strings"
		| "horns"
		| "whistle"
		| "hand-claps"
		| "vocal-chops"
		| "marimba"
		| "glockenspiel"
	>;
	/** Optional reference artist / brand to emulate (one-liner) */
	reference?: string;
}

const GENRE_PHRASES: Record<NonNullable<PromptIngredients["genre"]>, string> = {
	electronic: "modern electronic instrumental",
	pop: "catchy pop instrumental",
	indie: "indie bedroom-pop instrumental",
	"hip-hop": "hip-hop instrumental",
	funk: "funk instrumental",
	rock: "driving rock instrumental",
	acoustic: "warm acoustic instrumental",
	cinematic: "cinematic instrumental",
	ambient: "atmospheric ambient instrumental",
	world: "world-music-influenced instrumental",
};

const TEMPO_PHRASES: Record<NonNullable<PromptIngredients["tempo"]>, string> = {
	chill: "around 85 BPM, laid-back groove",
	mid: "around 105 BPM, steady mid-tempo",
	driving: "around 120 BPM, driving four-on-the-floor",
	fast: "around 135 BPM, fast and energetic",
};

const ENERGY_PHRASES: Record<NonNullable<PromptIngredients["energy"]>, string> = {
	calm: "consistently calm energy, no big drops or builds",
	building: "starts minimal, steadily builds energy toward the end",
	high: "high-energy throughout with clear momentum",
	explosive: "explosive drops, big impacts, bold dynamic swings",
};

const VIBE_PHRASES: Record<NonNullable<PromptIngredients["vibe"]>, string> = {
	confident: "confident and bold",
	playful: "playful and fun",
	nostalgic: "nostalgic and warm",
	edgy: "edgy and modern",
	warm: "warm and inviting",
	mysterious: "mysterious and cinematic",
	euphoric: "euphoric and uplifting",
};

const INSTRUMENT_LABELS: Record<NonNullable<PromptIngredients["instruments"]>[number], string> = {
	"synth-lead": "bright synth lead",
	piano: "piano",
	"electric-guitar": "electric guitar",
	"acoustic-guitar": "acoustic guitar",
	bass: "deep bass",
	drums: "punchy drums",
	strings: "cinematic strings",
	horns: "horn stabs",
	whistle: "whistled melody",
	"hand-claps": "hand claps",
	"vocal-chops": "pitched vocal chops (no lyrics)",
	marimba: "plucked marimba",
	glockenspiel: "twinkling glockenspiel",
};

/** Assemble a MiniMax-ready prompt from orthogonal ingredient selections. */
export function buildMusicPrompt(ingredients: PromptIngredients, durationSec = 20): string {
	const parts: string[] = [];
	if (ingredients.genre) parts.push(GENRE_PHRASES[ingredients.genre]);
	else parts.push("instrumental");
	if (ingredients.vibe) parts.push(VIBE_PHRASES[ingredients.vibe]);
	if (ingredients.tempo) parts.push(TEMPO_PHRASES[ingredients.tempo]);
	if (ingredients.energy) parts.push(ENERGY_PHRASES[ingredients.energy]);
	if (ingredients.instruments && ingredients.instruments.length > 0) {
		parts.push(
			`Prominent instruments: ${ingredients.instruments.map((i) => INSTRUMENT_LABELS[i]).join(", ")}`,
		);
	}
	if (ingredients.reference) {
		parts.push(`Reference feel: ${ingredients.reference}`);
	}
	parts.push(`For a modern SaaS product teaser video. Instrumental only, no lyrics. ${durationSec} seconds.`);
	return parts.join(". ");
}

export interface MusicTrack {
	id: string;
	name: string;
	mood: MusicMood;
	/** File name in public/music/ (bundled) or absolute path (generated) */
	file: string;
	durationSec: number;
	/** true = bundled in app, false = AI-generated */
	bundled: boolean;
}

// ── Bundled tracks ──────────────────────────────────────────────────────
// These are placeholder entries. Replace 'file' with actual royalty-free
// audio files placed in public/music/.

export const BUNDLED_TRACKS: MusicTrack[] = [
	{
		id: "energetic-1",
		name: "Drive Forward",
		mood: "energetic",
		file: "music/drive-forward.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "ambient-1",
		name: "Soft Focus",
		mood: "ambient",
		file: "music/soft-focus.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "dramatic-1",
		name: "Launch Day",
		mood: "dramatic",
		file: "music/launch-day.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "minimal-1",
		name: "Clean Slate",
		mood: "minimal",
		file: "music/clean-slate.mp3",
		durationSec: 30,
		bundled: true,
	},
	{
		id: "upbeat-1",
		name: "Good Vibes",
		mood: "upbeat",
		file: "music/good-vibes.mp3",
		durationSec: 30,
		bundled: true,
	},
];

// ── Mood auto-selection based on demo mode ──────────────────────────────

const MODE_TO_MOOD: Record<string, MusicMood> = {
	evangelist: "energetic",
	"product-tour": "upbeat",
	tutorial: "ambient",
	teardown: "dramatic",
};

export function getMoodForMode(demoMode: string): MusicMood {
	return MODE_TO_MOOD[demoMode] || "energetic";
}

export function getTrackForMood(mood: MusicMood): MusicTrack | undefined {
	return BUNDLED_TRACKS.find((t) => t.mood === mood);
}

// ── AI music generation via MiniMax ─────────────────────────────────────

export type VocalMode = "instrumental" | "auto-lyrics" | "custom-lyrics";

export async function generateCustomMusic(
	mood: MusicMood | "custom",
	customPrompt?: string,
	videoDurationSec?: number,
	vocalMode?: VocalMode,
	lyrics?: string,
): Promise<{ success: boolean; audioPath?: string; error?: string }> {
	try {
		const result = await window.electronAPI.aiGenerateMusic(
			mood,
			customPrompt,
			videoDurationSec,
			vocalMode,
			lyrics,
		);
		return result;
	} catch (err) {
		return {
			success: false,
			error: `Music generation failed: ${err}`,
		};
	}
}

export async function generateLyrics(
	themePrompt: string,
	title?: string,
): Promise<{ success: boolean; lyrics?: string; title?: string; styleTags?: string; error?: string }> {
	try {
		return await window.electronAPI.aiGenerateLyrics(themePrompt, title);
	} catch (err) {
		return { success: false, error: `Lyrics generation failed: ${err}` };
	}
}
