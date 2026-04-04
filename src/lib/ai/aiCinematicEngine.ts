// ── AI Cinematic Engine ─────────────────────────────────────────────────
//
// Sends captured website data to an AI model with Remotion skills,
// gets back React/TypeScript code for a cinematic video composition.
// The generated code is JIT-compiled and rendered by DynamicComposition.
//
// This is the "let the AI create it" approach — unlimited visual
// possibilities instead of predefined templates.

import type { DemoStep } from "@/components/demo-studio/types";
import type { BrandInfo } from "./cinematicCompositionEngine";

// ── Types ────────────────────────────────────────────────────────────────

export interface AiCompositionResult {
	/** The generated React/TSX code */
	code: string;
	/** Screenshot data URLs to pass as props */
	screenshots: string[];
	/** Any error during generation */
	error?: string;
}

// ── Main entry point ─────────────────────────────────────────────────────

/**
 * Generate a Remotion composition using AI.
 * Sends captured demo data to the AI with Remotion skills and gets back
 * React code that creates a cinematic video.
 */
export async function generateAiComposition(
	steps: DemoStep[],
	opts?: {
		title?: string;
		brand?: BrandInfo;
		onStatus?: (msg: string) => void;
		/** User instructions for refinement (e.g. "make it more dramatic", "fewer screenshots") */
		instructions?: string;
	},
): Promise<AiCompositionResult> {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const title = opts?.title || "Product Demo";
	const brand = opts?.brand;

	opts?.onStatus?.("Building prompt from captured data...");

	const systemPrompt = buildSystemPrompt();
	let userPrompt = buildUserPrompt(stepsWithScreenshots, title, brand);

	if (opts?.instructions) {
		userPrompt += `\n\n## User Refinement Instructions\n\nThe user has specifically requested: "${opts.instructions}"\n\nPrioritize these instructions above the default creative direction.`;
	}

	const waitMessages = [
		"Brewing something cinematic... grab a coffee, this takes ~60 seconds",
		"Directing your video... the AI is basically Spielberg right now",
		"Crafting motion graphics... go stretch, this will be worth the wait",
		"Writing 18,000 characters of React code for you... no big deal",
		"Generating your masterpiece... patience, Picasso took longer",
	];
	const waitMsg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
	opts?.onStatus?.(waitMsg);

	try {
		const result = await window.electronAPI.aiAnalyze(userPrompt, systemPrompt);

		if (!result?.success || !result.text) {
			return {
				code: "",
				screenshots: stepsWithScreenshots.map((s) => s.screenshotDataUrl!),
				error: result?.error || "AI returned empty response",
			};
		}

		// Extract code from the response (may be wrapped in ```tsx ... ```)
		const code = extractCode(result.text);

		if (!code) {
			return {
				code: "",
				screenshots: stepsWithScreenshots.map((s) => s.screenshotDataUrl!),
				error: "Could not extract valid code from AI response",
			};
		}

		opts?.onStatus?.("Composition generated successfully");

		return {
			code,
			screenshots: stepsWithScreenshots.map((s) => s.screenshotDataUrl!),
		};
	} catch (err) {
		return {
			code: "",
			screenshots: [],
			error: `AI generation failed: ${err}`,
		};
	}
}

// ── System Prompt ───────────────────────────────────────────────────────

function buildSystemPrompt(): string {
	return [
		"You are a world-class cinematic motion graphics director. You create React code that produces stunning, fast-paced product videos using the Remotion framework. Your videos look like they were made by a top creative agency — NOT like slideshows or presentations.",
		"",
		"## Remotion API",
		"",
		"Imports available from 'remotion':",
		"- useCurrentFrame() — current frame (starts at 0)",
		"- useVideoConfig() — { fps, durationInFrames, width, height }",
		"- interpolate(frame, inputRange, outputRange, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) — ALWAYS include both clamp options",
		"- spring({ frame, fps, config: { damping, stiffness, mass } }) — organic spring (0→1)",
		"- Sequence — from (frame start) + durationInFrames. useCurrentFrame() resets to 0 inside each Sequence.",
		"- AbsoluteFill — full-size absolute positioned container",
		"- Img — image component (NEVER use <img>)",
		"",
		"## Pre-Built Helper Components (USE THESE — they handle layout/animation safely)",
		"",
		"These are available in scope. USE THEM instead of writing raw divs with manual CSS:",
		"",
		"### Scene — full-screen wrapper with safe padding",
		"<Scene bg='#050505' align='center' padding={80}>...children...</Scene>",
		"- bg: any CSS background (color, gradient, etc.)",
		"- align: 'center' | 'left' | 'split' (split = flexDirection row for side-by-side layouts)",
		"",
		"### AnimatedText — animated text with safe word-wrapping (NO mid-word breaks)",
		"<AnimatedText text='Your headline' fontSize={120} color='#fff' animation='chars' />",
		"- animation: 'chars' (per-character spring) | 'words' (word-by-word slam) | 'scale' (scale up from center) | 'clip' (clip-path reveal) | 'none'",
		"- accentWord: string — one word gets colored with accentColor",
		"- accentColor: string — color for the accent word",
		"- fontFamily: defaults to serif for cinematic feel",
		"- delay: frames before animation starts",
		"- maxWidth: prevents overflow (default 1400px)",
		"",
		"### Card — dark animated card with safe overflow",
		"<Card width={420} delay={10} borderColor='rgba(37,99,235,0.3)'>...children...</Card>",
		"- Handles: overflow hidden, border radius, shadow, entrance animation (slide up + fade)",
		"",
		"### Pill — animated pill button with typewriter text",
		"<Pill text='Get Started' delay={20} color='#fff' />",
		"",
		"### Underline — animated accent underline that scales from left",
		"<Underline color='#2563eb' width={200} delay={10} />",
		"",
		"## IMPORTANT: Prefer helpers over raw HTML",
		"USE Scene + AnimatedText + Card + Pill for 90% of scenes. Only use raw divs for truly custom layouts.",
		"The helpers handle overflow, padding, word-wrapping, and animation automatically.",
		"",
		"## Critical Rules",
		"",
		"1. ALL animations MUST use useCurrentFrame(). CSS animations/transitions DO NOT render in Remotion.",
		"2. ALWAYS use interpolate() with both extrapolateLeft:'clamp' AND extrapolateRight:'clamp'.",
		"3. NEVER use Math.random().",
		"4. Export a component called VideoComposition accepting { screenshots: string[] } props.",
		"5. Canvas is 1920x1080 at 30fps.",
		"6. NEVER import external fonts or CSS files. Use system font stacks only.",
		"",
		"## Typography — THIS IS CRITICAL FOR QUALITY",
		"",
		"For maximum cinematic impact, use two contrasting font treatments:",
		"- WHITE backgrounds: SERIF font — fontFamily: \"Georgia, 'Times New Roman', serif\", fontWeight: 900, color '#050505'",
		"- BLACK backgrounds: SANS-SERIF font — fontFamily: \"'Inter', 'Helvetica Neue', 'Arial', sans-serif\", fontWeight: 800, color '#ffffff'",
		"- Font sizes: 100-160px for hero text. 60-80px for secondary headlines. NEVER below 48px for headlines.",
		"- Letter spacing: -0.04em to -0.06em for tight cinematic feel",
		"- Line height: 0.9-1.0 for large text (letters should nearly touch)",
		"",
		"## Layout Rules",
		"",
		"1. Use <Scene> for every scene — it handles padding and overflow automatically.",
		"2. Use <AnimatedText> for ALL headlines — it handles word-wrapping and animation.",
		"3. Use <Card> for feature cards — it handles overflow, shadow, and entrance animation.",
		"4. NEVER overlay text on top of screenshots. Put text ABOVE or BELOW images.",
		"5. For side-by-side layouts: <Scene align='split'> puts children in a row.",
		"6. ALWAYS define const SCENE_FRAMES = 60 (2 seconds per scene) and use it consistently.",
		"",
		"## TEXT ANIMATION — Use AnimatedText with VARIETY",
		"",
		"AnimatedText has 4 built-in animation modes. Use ALL of them across the video — never repeat the same one twice in a row:",
		"- animation='chars' — per-character spring entrance (hero headlines)",
		"- animation='words' — word-by-word slam with scale bounce (punchy statements)",
		"- animation='scale' — scale up from center (single powerful words/phrases)",
		"- animation='clip' — clip-path reveal from top (editorial/elegant)",
		"",
		"Mix these with different fontFamily, fontSize, and accentWord for maximum variety.",
		"Example scene: <Scene bg='#f5f0e8'><AnimatedText text='Stop reacting.' fontSize={140} color='#050505' animation='words' accentWord='reacting' accentColor={ACCENT} /></Scene>",
		"",
		"## Scene Type Catalog — USE VARIETY, MIX THESE",
		"",
		"### Type A: Text-focused scenes (use for ~40% of scenes)",
		"Pick a DIFFERENT text animation style (from the catalog above) for EACH text scene.",
		"White bg + serif for some, black bg + sans-serif for others.",
		"Accent one word by coloring it with the brand accent color. Add animated underline (scaleX spring) under that word.",
		"",
		"### Type B: Recreated UI elements (use for ~25% of scenes)",
		"NEVER crop screenshots. BUILD UI elements from scratch as styled divs:",
		"- Feature cards: dark bg, borderRadius 24, border 1px rgba(255,255,255,0.08). FIXED width (e.g. 420px). Icon circle + bold title + grey subtitle. Stagger entrance per card. overflow:'hidden' on each card.",
		"- Pill buttons: borderRadius 999, dark bg, typewriter text. FIXED width. Centered in container.",
		"- Toggle rows: blue circle indicator + bold white label + grey description. FIXED width (e.g. 600px). Stack vertically with stagger.",
		"",
		"### Type C: Headline + accent detail (use for ~15% of scenes)",
		"Massive centered text with ONE supporting element: animated underline, pulsing dot, or accent bar.",
		"",
		"### Type D: Split layout — text left, visual right (use for ~15% of scenes)",
		"Left half: large bold text (2-4 words). Right half: dark card with feature list or pill buttons. Clean separation.",
		"",
		"### Type E: Browser frame + screenshot (MAX 1 scene in entire video)",
		"Minimal browser chrome (3 dots + address bar) containing one Img screenshot. Use ONCE only.",
		"",
		"### Type F: CTA / closing (last scene)",
		"Product name centered. Styled pill button below. Spring entrance from below.",
		"",
		"## Background Variety — CRITICAL FOR VISUAL INTEREST",
		"",
		"Do NOT just alternate white/black. Use this palette across scenes:",
		"- Clean white: '#fafafa' with optional subtle radial gradient (light blue/purple tint at center)",
		"- Deep black: '#050505'",
		"- Dark navy: 'linear-gradient(180deg, #0a0f1e 0%, #050810 100%)'",
		"- Brand tint: dark background with subtle accent color wash, e.g. 'linear-gradient(135deg, #0a0a1a 0%, #0d1a2e 100%)'",
		"- Warm cream: '#f5f0e8' (pairs beautifully with serif text)",
		"- Dark charcoal: '#1a1a1a' (softer than pure black)",
		"Vary the backgrounds so no two consecutive scenes have the same one.",
		"",
		"## Pacing",
		"",
		"- Each scene: 55-70 frames (1.8-2.3 seconds). This gives animations time to complete.",
		"- Total: 10-14 scenes.",
		"- Hard cuts between scenes (no fade transitions).",
		"",
		"## Output",
		"",
		"Return ONLY valid React/TypeScript code. No markdown fences, no backtick wrappers, no explanations.",
		"- Self-contained: all helper components defined in the same code",
		"- Export VideoComposition as named export",
		"- Accept { screenshots: string[] } props",
		"- Define const SCENE_FRAMES = 60 at the top, then const totalDuration = numberOfScenes * SCENE_FRAMES",
		"- Use Sequence from/durationInFrames for timeline",
		"- Inline styles only",
	].join("\n");
}

// ── User Prompt ─────────────────────────────────────────────────────────

function buildUserPrompt(steps: DemoStep[], title: string, brand?: BrandInfo): string {
	const accentColor = brand?.primaryColor || "#2563eb";
	const productName = brand?.productName || title;

	// Build rich scene descriptions from captured data
	const sceneDescriptions = steps.map((step, i) => {
		const headline = step.headline || "";
		const narration = step.action.narration || "";
		const uiEls = step.uiElements ?? [];

		const parts: string[] = [`Scene ${i + 1}:`];
		parts.push(`  Headline: "${headline}"`);
		if (narration) parts.push(`  Narration: "${narration}"`);

		if (uiEls.length > 0) {
			// Give the AI rich detail about detected UI elements so it can recreate them
			const elDescs = uiEls.slice(0, 6).map((e) => {
				const label = e.text.slice(0, 50);
				return `${e.type}("${label}")`;
			});
			parts.push(`  UI Elements: ${elDescs.join(", ")}`);
		}

		// Only mention screenshot for 1 scene to discourage overuse
		if (i === 0 && step.screenshotDataUrl) {
			parts.push(`  Hero screenshot: props.screenshots[${i}]`);
		}

		return parts.join("\n");
	});

	return [
		`Create a cinematic product video for "${productName}".`,
		"",
		"## Brand",
		`- Product: ${productName}`,
		`- Accent color: ${accentColor}`,
		"",
		`## Captured Data (${steps.length} scenes)`,
		"",
		sceneDescriptions.join("\n\n"),
		"",
		"## Creative Direction",
		"",
		`1. OPENING (2 scenes): "${productName}" using Style 8 (massive edge-to-edge text) on cream bg. Then a tagline using Style 3 (word-by-word slam) on black.`,
		"",
		"2. BODY (6-8 scenes): Transform the captured data into motion graphics. CRITICAL: Use a DIFFERENT text animation style for EACH scene. Never use the same style twice in a row.",
		"   - Scene ideas: Style 2 (color sweep) for a key message, Style 4 (line reveal) for a quote, Style 5 (scale-up) for a single powerful word, Style 7 (split halves) for a two-line headline",
		"   - Scenes with detected UI elements → Type B (recreate as styled cards/pills/toggles with Style 6 typewriter text inside)",
		"   - Feature lists or benefits → Type B toggle rows with staggered entrance",
		"   - Stats or numbers → Rolling counter with accent color",
		`   - ONE hero moment → Type E browser frame with props.screenshots[0]`,
		"",
		`3. CLOSING: "${productName}" using Style 5 (scale-up) + CTA button on white bg.`,
		"",
		`4. IMPORTANT: Use screenshots for AT MOST 1 scene. Use at least 4 DIFFERENT text animation styles. The video should feel like a motion graphics piece, not a slideshow.`,
		"",
		`5. Accent color ${accentColor} on: underlines, one highlighted word per text scene, card borders, dot indicators.`,
		"",
		"Return ONLY the code.",
	].join("\n");
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Extract code from an AI response that may include markdown code fences.
 */
function extractCode(response: string): string | null {
	// Try to extract from code fences
	const fenceMatch = response.match(/```(?:tsx?|jsx?|javascript|react)?\s*\n([\s\S]*?)```/);
	if (fenceMatch) {
		return fenceMatch[1].trim();
	}

	// If the response looks like code (starts with import or export or const)
	const trimmed = response.trim();
	if (
		trimmed.startsWith("import ") ||
		trimmed.startsWith("export ") ||
		trimmed.startsWith("const ") ||
		trimmed.startsWith("function ")
	) {
		return trimmed;
	}

	// Try to find a code block anywhere
	const anyCodeMatch = response.match(/```\s*\n([\s\S]*?)```/);
	if (anyCodeMatch) {
		return anyCodeMatch[1].trim();
	}

	return null;
}
