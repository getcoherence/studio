// ── Demo Modes ───────────────────────────────────────────────────────────
//
// Different use-case templates that change how the three-phase agent
// explores, scripts, and narrates a demo.

export type DemoModeId = "evangelist" | "product-tour" | "tutorial" | "teardown";

export interface DemoMode {
	id: DemoModeId;
	name: string;
	description: string;
	icon: string;
	/** Prompt fragment injected into the recon agent (Phase 1) */
	reconFocus: string;
	/** Prompt fragment injected into the script generator (Phase 2) */
	scriptStyle: string;
	/** Prompt fragment injected into narration voice (Phase 2) */
	narrationVoice: string;
}

const EVANGELIST: DemoMode = {
	id: "evangelist",
	name: "Evangelist Pitch",
	description: "Sell the product like a founder",
	icon: "🔥",
	reconFocus: `Focus on: hero/landing page value proposition, key feature pages, pricing/plans, social proof (testimonials, logos, metrics), CTAs. Skip: FAQ, legal, careers, blog index, help docs.`,
	scriptStyle: `Structure like a founder pitch: 1) Hook with the big value prop, 2-3) Show the killer features that make this special, 4) Social proof or key metric, 5) Pricing or CTA. Keep it punchy — max 10 scenes. Each scene should make the viewer think "I need this."`,
	narrationVoice: `Sound like a passionate founder who genuinely believes in their product. Confident, energetic, direct. Use "you" language. Short punchy sentences. Never corporate-speak. Example: "Record once. AI handles the rest. That's it."`,
};

const PRODUCT_TOUR: DemoMode = {
	id: "product-tour",
	name: "Product Tour",
	description: "Systematic walkthrough of features",
	icon: "🗺️",
	reconFocus: `Explore every feature section systematically. Look for: main navigation items, feature pages, settings, integrations, dashboard views, data views, any interactive demos. Cover ALL major sections.`,
	scriptStyle: `Structure like a guided tour: 1) Welcome/overview, 2-N) Visit each major feature in logical order, last) Summary or getting started. Be thorough — show every important section. 10-15 scenes. Each scene introduces one feature area and explains what it does.`,
	narrationVoice: `Sound like a friendly, knowledgeable guide showing someone around. Warm, clear, helpful. "Let me show you..." and "Here you can..." language. Explain what each feature does and why it's useful. Patient, not rushed.`,
};

const TUTORIAL: DemoMode = {
	id: "tutorial",
	name: "Tutorial",
	description: "Step-by-step task completion",
	icon: "📝",
	reconFocus: `Focus on interactive elements: forms, buttons, inputs, toggles, modals, wizards, step-by-step flows. Look for: signup/onboarding flows, creation workflows (create a project, write a post, configure settings), any multi-step processes.`,
	scriptStyle: `Structure like a how-to guide: 1) "Here's what we'll build/do", 2-N) Each step in the workflow with specific instructions, last) "You've completed X!" Show the actual workflow step by step. Zoom into form fields and buttons. 8-12 scenes.`,
	narrationVoice: `Sound like a clear, patient instructor. Step-by-step language: "First, click..." "Next, you'll see..." "Now enter..." Keep it factual and actionable. No hype — just clear instructions.`,
};

const TEARDOWN: DemoMode = {
	id: "teardown",
	name: "Teardown",
	description: "Analyze what makes this product tick",
	icon: "🔍",
	reconFocus: `Analyze everything with a critical eye: pricing model, unique features vs competitors, UX patterns, technical approach, target audience signals, integrations ecosystem. Look for what's genuinely differentiated vs table-stakes features.`,
	scriptStyle: `Structure like a product analysis: 1) What is this product? Who's it for? 2-3) What's genuinely unique/innovative? 4-5) How does the pricing work? 6) What's the UX quality like? 7) Final verdict. Be honest and analytical — praise what's good, note what's missing. 8-10 scenes.`,
	narrationVoice: `Sound like a thoughtful product analyst. Objective but opinionated. "What sets this apart is..." and "Notably, they've chosen to..." language. Informed, credible, not salesy. Point out both strengths and gaps.`,
};

export const DEMO_MODES: Record<DemoModeId, DemoMode> = {
	evangelist: EVANGELIST,
	"product-tour": PRODUCT_TOUR,
	tutorial: TUTORIAL,
	teardown: TEARDOWN,
};

export const DEMO_MODE_LIST: DemoMode[] = Object.values(DEMO_MODES);

export function getDemoMode(id: DemoModeId): DemoMode {
	return DEMO_MODES[id] ?? EVANGELIST;
}
