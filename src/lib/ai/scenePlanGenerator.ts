// ── Scene Plan Generator ────────────────────────────────────────────────
//
// Generates a structured ScenePlan from captured demo data using AI.
// The plan is editable in the UI, then compiled to Remotion code.

import type { DemoStep } from "@/components/demo-studio/types";
import type { BrandInfo } from "./cinematicCompositionEngine";
import type { ScenePlan } from "./scenePlan";

export async function generateScenePlan(
	steps: DemoStep[],
	opts?: {
		title?: string;
		brand?: BrandInfo;
		onStatus?: (msg: string) => void;
	},
): Promise<{ plan: ScenePlan | null; error?: string }> {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const title = opts?.title || "Product Demo";
	const brand = opts?.brand;
	const accentColor = brand?.primaryColor || "#2563eb";
	const productName = brand?.productName || title;

	opts?.onStatus?.("Planning your cinematic video...");

	// Only use first 10 steps — more data doesn't improve video quality
	const sceneDescriptions = stepsWithScreenshots.slice(0, 10).map((step, i) => {
		const headline = step.headline || "";
		const narration = step.action.narration || "";
		const uiEls = step.uiElements ?? [];
		const parts: string[] = [`Scene ${i + 1}:`];
		parts.push(`  Headline: "${headline}"`);
		if (narration) parts.push(`  Narration: "${narration}"`);
		if (uiEls.length > 0) {
			parts.push(
				`  UI Elements: ${uiEls
					.slice(0, 6)
					.map((e) => `${e.type}("${e.text.slice(0, 40)}")`)
					.join(", ")}`,
			);
		}
		return parts.join("\n");
	});

	const prompt = [
		`Create a cinematic video scene plan for "${productName}".`,
		"",
		"## Brand",
		`- Product: ${productName}`,
		`- Accent color: ${accentColor}`,
		"",
		`## Captured Data (${stepsWithScreenshots.length} scenes)`,
		"",
		sceneDescriptions.join("\n\n"),
		"",
		"## Output Format",
		"Return ONLY valid JSON matching this structure (no markdown, no explanation):",
		"",
		`{`,
		`  "title": "${productName}",`,
		`  "accentColor": "${accentColor}",`,
		`  "scenes": [`,
		`    {`,
		`      "type": "hero-text|split-layout|cards|screenshot|cta|glitch-intro",`,
		`      "headline": "short punchy headline",`,
		`      "subtitle": "optional subtitle",`,
		`      "background": "white|cream|black|charcoal|navy|brand-dark|deep-purple",`,
		`      "animation": "chars|words|scale|clip|gradient|glitch",`,
		`      "font": "serif|sans-serif",`,
		`      "fontSize": 100,`,
		`      "accentWord": "optional word to highlight",`,
		`      "durationFrames": 90,`,
		`      "effects": ["vignette", "light-streak", "clip-reveal"],`,
		`      "cards": [{"title": "Feature", "description": "Detail"}],`,
		`      "screenshotIndex": 0,`,
		`      "rightContent": "cards|pills|screenshot"`,
		`    }`,
		`  ]`,
		`}`,
		"",
		"## Creative Direction — TELL A STORY, NOT A FEATURE LIST",
		"",
		"CRITICAL: This video must have a NARRATIVE ARC, not just list features. Structure:",
		"",
		"1. HOOK (1-2 scenes): Bold statement that identifies the viewer's problem or desire. NOT the product name.",
		"   Example: 'Your tools work against each other.' or 'What if work organized itself?'",
		"2. PROMISE (1-2 scenes): What the product makes possible. Aspirational, not technical.",
		"   Example: 'One workspace. Every team. Total clarity.'",
		"3. PROOF (3-4 scenes): Show 2-3 key capabilities with short headlines. MAX 1 scene with cards (2-3 cards max).",
		"   Use 1 screenshot scene here — choose the MOST impressive product view.",
		"4. DIFFERENTIATION (1-2 scenes): What makes this unique. Price, openness, speed, AI.",
		"5. CTA (1 scene): Product name + call to action.",
		"",
		"## Design Rules",
		"",
		"- 10-11 scenes total. Each scene 90 frames (3 seconds).",
		"- ANIMATION VARIETY: Use 'gradient' for AT MOST 1 scene (the opening or closing). Use at least 4 DIFFERENT animation types across the video. Never repeat the same animation twice in a row.",
		"- CARDS: Maximum 1 scene with cards in the entire video. Max 3 cards per scene. Cards headline should be 80-100px.",
		"- BACKGROUNDS: Alternate between light (white, cream) and dark (black, charcoal, navy, brand-dark). Never use the same background twice in a row.",
		"- FONTS: serif on light backgrounds, sans-serif on dark backgrounds.",
		"- FONT SIZE: 120-160 for hero text, 100-120 for other headlines. MINIMUM 100.",
		"- SCREENSHOTS: AT MOST 1 scene. The screenshot should match what the headline describes.",
		"- EFFECTS: vignette on max 2 dark scenes. light-streak on max 1 scene. Less is more.",
		"- SUBTITLES: Short, punchy (under 12 words). Not every scene needs one.",
		"",
		"Return ONLY the JSON.",
	].join("\n");

	const systemPrompt =
		"You generate structured JSON scene plans for cinematic product videos. Output ONLY valid JSON, no explanation.";

	try {
		const result = await window.electronAPI.aiAnalyze(prompt, systemPrompt);
		if (!result?.success || !result.text) {
			return { plan: null, error: result?.error || "AI returned empty response" };
		}

		// Extract JSON from response
		let jsonStr = result.text.trim();
		// Strip markdown fences if present
		const fenceMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)```/);
		if (fenceMatch) jsonStr = fenceMatch[1].trim();

		const plan = JSON.parse(jsonStr) as ScenePlan;

		// Validate basic structure
		if (!plan.scenes || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
			return { plan: null, error: "Invalid scene plan: no scenes" };
		}

		return { plan };
	} catch (err) {
		return { plan: null, error: `Scene plan generation failed: ${err}` };
	}
}
