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

	const sceneDescriptions = stepsWithScreenshots.map((step, i) => {
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
		"## Creative Direction",
		"",
		"- 10-12 scenes total. Each scene 90 frames (3 seconds).",
		"- OPENING: Use 'glitch-intro' or 'hero-text' with 'gradient' animation. Make it dramatic.",
		"- BODY: Mix 'hero-text', 'split-layout', and 'cards' types. Vary backgrounds — alternate white/cream with dark/navy.",
		"- Use 'screenshot' type for AT MOST 1 scene.",
		"- CLOSING: Use 'cta' type with product name.",
		"- Effects: use 'clip-reveal' on the opening only. Use 'light-streak' on at most 1 scene. Use 'vignette' on 1-2 dark scenes.",
		"- Vary animation styles: never repeat the same animation twice in a row.",
		"- Font: use 'serif' on light backgrounds, 'sans-serif' on dark backgrounds.",
		"- fontSize: 120-160 for hero text, 100-120 for other scenes. MINIMUM 100. Text must be LARGE and impactful.",
		"- LESS IS MORE. Clean typography beats cluttered effects.",
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
