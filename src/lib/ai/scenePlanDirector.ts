// ── Scene Plan Director ─────────────────────────────────────────────────
//
// The "Creative Director" — takes the current scene plan + user feedback
// and returns a refined plan. Patches specific scenes while preserving
// the ones the user liked. Much faster than full regeneration.

import type { ScenePlan } from "./scenePlan";

export interface DirectorMessage {
	role: "user" | "director";
	content: string;
	/** If the director responded with a plan update, this is the updated plan */
	updatedPlan?: ScenePlan;
}

/**
 * Send user feedback to the Creative Director. Returns the director's
 * response text + an optional updated scene plan.
 */
export async function refineScenePlan(
	currentPlan: ScenePlan,
	userFeedback: string,
	conversationHistory: DirectorMessage[],
	opts?: {
		onStatus?: (msg: string) => void;
		/** Override the AI model for this request (lets users test different models) */
		modelOverride?: { provider: string; model: string };
		/** Optional base64 image (screenshot, reference design, etc.) */
		imageBase64?: string;
	},
): Promise<{ response: string; updatedPlan?: ScenePlan; error?: string }> {
	opts?.onStatus?.("Director is reviewing your feedback...");

	const planJson = JSON.stringify(currentPlan, null, 2);

	// Build conversation context (last 10 messages max)
	const historyBlock = conversationHistory
		.slice(-10)
		.map((m) => `${m.role === "user" ? "USER" : "DIRECTOR"}: ${m.content}`)
		.join("\n");

	const prompt = [
		"## Current Scene Plan",
		"```json",
		planJson,
		"```",
		"",
		...(historyBlock ? ["## Conversation History", historyBlock, ""] : []),
		"## User Feedback",
		userFeedback,
		"",
		"## Your Task",
		"You are the Creative Director reviewing this video scene plan. The user has given you feedback.",
		"",
		"Respond in TWO parts, separated by `---PLAN---`:",
		"",
		"1. FIRST: A short, conversational response (2-4 sentences) acknowledging what you changed and why.",
		"   Be opinionated — you're a creative director, not a yes-man. If the user's idea is good, say so.",
		"   If you'd suggest something different, offer it. Keep it human and direct.",
		"",
		"2. THEN: After the `---PLAN---` separator, output the COMPLETE updated JSON scene plan.",
		"   - Modify ONLY the scenes/fields the feedback asks about",
		"   - Preserve everything else exactly (don't regenerate scenes the user didn't mention)",
		"   - Keep the same scene count unless the user asked to add/remove scenes",
		"   - Maintain the narrative arc — if you change the hook, make sure the rest still flows",
		"   - If the user asks to cut scenes, remove them and adjust transitions",
		"   - If the user asks to add scenes, insert them at the right narrative position",
		"   - Output valid JSON matching the ScenePlan schema",
		"",
		"If the user's feedback is just a question or doesn't require plan changes,",
		"respond conversationally WITHOUT the ---PLAN--- section.",
		"",
		"## Scene Type Reference (for adding new scenes)",
		"Types: ghost-hook, camera-text, impact-word, stacked-hierarchy, before-after, metrics-dashboard,",
		"icon-showcase, data-flow-network, word-slot-machine, scrolling-list, notification-chaos,",
		"chat-narrative, browser-tabs-chaos, app-icon-cloud, avatar-constellation, echo-hero,",
		"outline-hero, radial-vortex, gradient-mesh-hero, dashboard-deconstructed, product-glow,",
		"typewriter-prompt, logo-reveal, cards, cta, hero-text.",
		"",
		"Backgrounds: white, cream, warm-gray, cool-gray, soft-blue, soft-green, soft-rose,",
		"black, charcoal, dark-slate, dark-teal, dark-wine, navy, brand-dark, deep-purple,",
		"midnight-teal, warm-night, steel-gradient, aurora-dark.",
		"",
		"Background effects: flowing-lines, drifting-orbs, mesh-shift, particle-field, grain,",
		"pulse-grid, aurora, spotlight, wave-grid, gradient-wipe, bokeh, liquid-glass, none.",
		"",
		"Variants: data-flow-network (circles/timeline-arrows/hex-grid/isometric-blocks/orbital-rings),",
		"before-after (split-card/swipe-reveal/stacked-morph/toggle-switch),",
		"metrics-dashboard (counter-row/bar-chart/pie-radial/ticker-tape),",
		"word-slot-machine (wheel/typewriter-swap/flip-cards/glitch-swap).",
	].join("\n");

	const systemPrompt = [
		"You are a Senior Creative Director at a top motion design agency.",
		"You're reviewing a cinematic product video scene plan and giving feedback.",
		"You're collaborative but opinionated — you have strong taste and aren't afraid to push back.",
		"When you modify the plan, you explain what you changed and why in plain language.",
		"Keep your responses concise — the user can see the changes in their editor immediately.",
		"Output ONLY your response text (and optionally the plan JSON after ---PLAN---). No markdown fences around the JSON.",
	].join("\n");

	try {
		// Use vision API if an image is attached, otherwise text-only
		const result = opts?.imageBase64
			? await window.electronAPI.aiAnalyzeImage(prompt, opts.imageBase64, systemPrompt)
			: await window.electronAPI.aiAnalyze(prompt, systemPrompt, opts?.modelOverride);
		if (!result?.success || !result.text) {
			return { response: "", error: result?.error || "AI returned empty response" };
		}

		const raw = result.text.trim();

		// Split on ---PLAN--- separator
		const separatorIdx = raw.indexOf("---PLAN---");
		if (separatorIdx === -1) {
			// No plan update — just a conversational response
			return { response: raw };
		}

		const responseText = raw.slice(0, separatorIdx).trim();
		let planJson2 = raw.slice(separatorIdx + "---PLAN---".length).trim();

		// Strip markdown fences if present
		const fenceMatch = planJson2.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
		if (fenceMatch) planJson2 = fenceMatch[1].trim();

		try {
			const updatedPlan = JSON.parse(planJson2) as ScenePlan;
			if (!updatedPlan.scenes || !Array.isArray(updatedPlan.scenes)) {
				return { response: responseText, error: "Director returned invalid plan (no scenes)" };
			}
			return { response: responseText, updatedPlan };
		} catch (parseErr) {
			return {
				response: responseText,
				error: `Director's plan update had invalid JSON: ${parseErr}`,
			};
		}
	} catch (err) {
		return { response: "", error: `Director request failed: ${err}` };
	}
}
