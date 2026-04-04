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
		"## Layout Safety Rules — PREVENT VISUAL BUGS",
		"",
		"These rules are NON-NEGOTIABLE. Violating them creates ugly videos:",
		"1. EVERY container with text MUST have overflow:'hidden'. Text MUST NOT bleed outside its container.",
		"2. Cards and UI elements MUST use fixed pixel widths that fit within 1920px with padding. Max card width: 500px. Max container: 1600px.",
		"3. NEVER overlay text on top of screenshots or browser frames. Put text ABOVE or BELOW images, never on top.",
		"4. All text elements MUST have maxWidth set. Large headlines: maxWidth 1400px. Card text: maxWidth matches card.",
		"5. Use padding (40-80px) from canvas edges. NOTHING should touch the edges of the 1920x1080 frame.",
		"6. Feature card grids: use flexWrap:'wrap' with gap, maxWidth on the container, and fixed card sizes.",
		"7. ALWAYS define const SCENE_FRAMES = 60 (2 seconds per scene) and use it consistently.",
		"8. TEXT WRAPPING — CRITICAL: When animating per-character, you MUST split text into WORDS first, then characters within each word. Each word gets a wrapper span with style={{ display:'inline-block', whiteSpace:'nowrap' }}. This prevents mid-word line breaks. Pattern:",
		"   text.split(' ').map((word, wi) => <span key={wi} style={{ display:'inline-block', whiteSpace:'nowrap', marginRight:'0.3em' }}>{word.split('').map((char, ci) => <span key={ci} style={{ display:'inline-block', opacity: progress, transform: ... }}>{char}</span>)}</span>)",
		"9. For headlines that MUST fit on one line, use whiteSpace:'nowrap' on the container and reduce fontSize if needed. NEVER let a headline wrap mid-word.",
		"10. Cards and pill text that is longer than the container MUST be truncated with overflow:'hidden' and textOverflow:'ellipsis'.",
		"",
		"## TEXT ANIMATION CATALOG — USE DIFFERENT ONES, NEVER REPEAT THE SAME STYLE TWICE IN A ROW",
		"",
		"You MUST use at least 4 different text animation styles across the video. Here are 8 styles to choose from:",
		"",
		"### Style 1: Per-character spring entrance (classic)",
		"Split into WORDS first (each word in a nowrap inline-block span), then characters within each word. Each char: stagger delay, spring opacity 0→1 + translateY(28→0). This prevents mid-word line breaks.",
		"",
		"### Style 2: Per-character with color sweep",
		"Like Style 1, but each character transitions from the accent color to the final color during entrance.",
		"Use interpolate on the character's color: accent → final over the spring progress.",
		"Creates a wave of color flowing through the text.",
		"",
		"### Style 3: Word-by-word slam",
		"Split text into WORDS, not characters. Each word appears instantly (opacity 0→1) with scale(1.3→1) spring.",
		"Stagger delay between words: 6-8 frames. Creates a punchy, impactful rhythm.",
		"",
		"### Style 4: Line-by-line reveal with clip-path",
		"For multi-line text (2-3 lines). Each line uses clipPath: inset(0 0 (1-progress)*100% 0) to reveal from top.",
		"Stagger between lines: 10 frames. Clean, editorial feel.",
		"",
		"### Style 5: Scale-up from center",
		"Entire text block starts at scale(0.6) + opacity 0, springs to scale(1) + opacity 1.",
		"Simple but dramatic. Good for single powerful words.",
		"",
		"### Style 6: Typewriter with cursor",
		"Use interpolate to slice text from 0 to full length. Show a blinking cursor (opacity toggled every 15 frames).",
		"Works great inside dark pill shapes or card UI elements.",
		"",
		"### Style 7: Split halves — top slides down, bottom slides up",
		"Split text in half. Top half: translateY(-40→0). Bottom half: translateY(40→0). Both spring opacity.",
		"Creates a satisfying convergence effect.",
		"",
		"### Style 8: Massive edge-to-edge text",
		"Single word in ENORMOUS font (200-300px) that fills the entire 1920px width.",
		"Use overflow:'hidden' on the container. Spring from translateY(100%)→0 as a dramatic reveal.",
		"The text should be so large it nearly bleeds off the edges. Very cinematic.",
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
