// ── Demo Modes / Video Templates ─────────────────────────────────────
//
// Video type templates that control how the three-phase agent explores,
// scripts, and narrates — AND how the scene plan generator structures
// the cinematic output. Users pick these as "what kind of video do I
// want to make?" rather than technical recording modes.

export type DemoModeId =
	| "saas-teaser"
	| "feature-spotlight"
	| "launch-announcement"
	| "competitor-comparison"
	| "customer-story"
	| "social-clip"
	// Legacy aliases (kept for backward compat with saved projects)
	| "evangelist"
	| "product-tour"
	| "tutorial"
	| "teardown";

export interface DemoMode {
	id: DemoModeId;
	name: string;
	description: string;
	icon: string;
	/** If true, show this in the primary video-type picker */
	primary?: boolean;
	/** Prompt fragment injected into the recon agent (Phase 1) */
	reconFocus: string;
	/** Prompt fragment injected into the script generator (Phase 2) */
	scriptStyle: string;
	/** Prompt fragment injected into narration voice (Phase 2) */
	narrationVoice: string;
	/** Narrative framework hint injected into generateScenePlan — tells the
	 * AI what story arc and scene type mix to use for the cinematic output. */
	scenePlanGuide: string;
	/** Suggested target duration in seconds (scene plan generator uses this
	 * to calibrate scene count and pacing). */
	targetDurationSec?: number;
}

// ── Primary video types (shown first in the picker) ──────────────────

const SAAS_TEASER: DemoMode = {
	id: "saas-teaser",
	name: "SaaS / Product Teaser",
	description: "High-energy overview video — sell the vision in 30 seconds",
	icon: "🚀",
	primary: true,
	reconFocus: `Focus on: hero/landing page value proposition, key feature pages, pricing/plans, social proof (testimonials, logos, metrics), CTAs. Skip: FAQ, legal, careers, blog index, help docs.`,
	scriptStyle: `Structure like a founder pitch: 1) Hook with the big value prop, 2-3) Show the killer features that make this special, 4) Social proof or key metric, 5) Pricing or CTA. Keep it punchy — max 10 scenes. Each scene should make the viewer think "I need this."`,
	narrationVoice: `Sound like a passionate founder who genuinely believes in their product. Confident, energetic, direct. Use "you" language. Short punchy sentences. Never corporate-speak. Example: "Record once. AI handles the rest. That's it."`,
	scenePlanGuide: `
## Video Type: SaaS / Product Teaser
Goal: Make viewers FEEL the product's value in under 30 seconds. This is a hype reel, not an explainer.

NARRATIVE ARC — Problem → Solution → Proof → CTA:
1. HOOK (2-3 scenes): Name the viewer's pain. Bold, confrontational, fast cuts.
2. BRAND REVEAL (1 scene): camera-text or logo-reveal. The product enters.
3. PROOF (3-5 scenes): Show capabilities with VISUAL-HEAVY types. Vary aggressively.
4. OUTCOME (1 scene): What life looks like after. Aspirational, clean.
5. CTA (1 scene): Product name + call to action.

FAVORED SCENE TYPES: ghost-hook (for hook), camera-text (for reveal), data-flow-network, metrics-dashboard, icon-showcase, app-icon-cloud, scrolling-list, word-slot-machine.
AVOID: Too many text-only scenes. This needs MOVEMENT and VISUALS.
PACING: Fast. 30-42 frame scenes. Total 16-20 scenes. Music video energy.`,
	targetDurationSec: 25,
};

const FEATURE_SPOTLIGHT: DemoMode = {
	id: "feature-spotlight",
	name: "Feature Spotlight",
	description: "Deep-dive on one feature — perfect for product pages & social",
	icon: "🎯",
	primary: true,
	reconFocus: `IMPORTANT: The user wants to spotlight a SPECIFIC feature. Only explore pages and sections directly related to that feature. Skip unrelated features, pricing, about pages, blog, etc. If the feature has sub-features or settings, explore those. Depth over breadth.`,
	scriptStyle: `Structure like a feature deep-dive: 1) Name the problem this feature solves, 2) Introduce the feature as the answer, 3-5) Show how it works (2-3 key capabilities), 6) The result/outcome. Max 8-10 scenes. Stay FOCUSED — every scene must relate to this ONE feature.`,
	narrationVoice: `Sound confident and specific. You're showing ONE feature, so go deep. Use precise language about what it does. "Nash handles your tasks autonomously" not "our platform has many features." Be concrete, not vague.`,
	scenePlanGuide: `
## Video Type: Feature Spotlight
Goal: Make ONE feature look incredible. This is NOT a product overview — it's a deep-dive on a single capability.

NARRATIVE ARC — Problem → Feature → How It Works → Outcome:
1. HOOK (1-2 scenes): The specific problem this feature solves. Tight, focused.
2. FEATURE INTRO (1 scene): Name the feature. camera-text or impact-word.
3. HOW IT WORKS (3-4 scenes): Show the feature's key capabilities. Use before-after, data-flow-network, scrolling-list, icon-showcase. Each scene = one aspect of the feature.
4. OUTCOME (1 scene): The result. Metrics or aspirational statement.
5. CTA (1 scene): Try it / learn more.

CRITICAL: Every single scene must relate to the ONE feature being spotlighted. Do NOT drift to other product areas. If the user mentions "Nash", every scene is about Nash.
PACING: Measured but energetic. 35-50 frame scenes. Total 10-14 scenes.
FAVORED SCENE TYPES: before-after (problem vs solution), icon-showcase (sub-features), metrics-dashboard (results), scrolling-list (capabilities), data-flow-network (how it works).`,
	targetDurationSec: 20,
};

const LAUNCH_ANNOUNCEMENT: DemoMode = {
	id: "launch-announcement",
	name: "Launch Announcement",
	description: '"We just shipped X" — hype, urgency, and social proof',
	icon: "🎉",
	primary: true,
	reconFocus: `Focus on: the NEW thing being launched. Look for: announcement banners, "new" badges, changelog/release notes, the feature page itself, any "what's new" sections. Also grab: social proof, pricing if relevant, and the main CTA. Skip everything that isn't related to the launch.`,
	scriptStyle: `Structure like a launch hype video: 1) "It's here." or "We built something new." — dramatic opener, 2) What it is in one line, 3-4) The 2-3 biggest capabilities, 5) Social proof or early results, 6) "Available now" CTA. Max 10 scenes. Every scene should build EXCITEMENT. This is a celebration.`,
	narrationVoice: `Sound like you're unveiling something the world has been waiting for. Excited but not breathless. Confident. "We've been working on this for months." "It's finally here." "And it changes everything." Mix hype with substance.`,
	scenePlanGuide: `
## Video Type: Launch Announcement
Goal: Generate EXCITEMENT about something new. This is a launch day hype reel.

NARRATIVE ARC — Tease → Reveal → Capabilities → Availability:
1. TEASE (1-2 scenes): Build anticipation. "Something new." "We've been building." Use stacked-hierarchy, impact-word, or ghost-hook. Dark backgrounds, dramatic.
2. REVEAL (1 scene): The big moment. camera-text with the product/feature name. THIS IS THE PEAK.
3. WHAT IT DOES (3-4 scenes): Key capabilities. FAST cuts, high energy. Use icon-showcase, data-flow-network, before-after, metrics-dashboard.
4. SOCIAL PROOF (1 scene): Early results, beta metrics, or "join X users." avatar-constellation or metrics-dashboard.
5. CTA (1 scene): "Available now" / "Try it today" / "Join the waitlist."

PACING: FAST. This is a launch. 28-40 frame scenes. Total 12-16 scenes. Build energy throughout.
MUSIC MOOD: hype-launch or anthem-build.
FAVORED SCENE TYPES: impact-word, ghost-hook, camera-text, stacked-hierarchy (for drama), then visual-heavy types for capabilities.
BACKGROUNDS: Dramatic. Lots of dark backgrounds with animated effects. Save light backgrounds for the reveal moment.`,
	targetDurationSec: 22,
};

const COMPETITOR_COMPARISON: DemoMode = {
	id: "competitor-comparison",
	name: "Competitor Comparison",
	description: '"Why us over them" — highlight your edge',
	icon: "⚔️",
	primary: true,
	reconFocus: `Focus on: differentiating features, unique capabilities the user's product has that competitors don't. Look for: comparison pages, "vs" pages, feature matrices, pricing advantages, testimonials that mention switching from competitors. Skip: generic features that every product has.`,
	scriptStyle: `Structure like a persuasion argument: 1) The status quo / what competitors offer, 2) What's missing or frustrating, 3-4) How THIS product is different (2-3 key differentiators), 5) Proof (metrics, testimonials, or case studies), 6) CTA. Max 10 scenes. Be confident, not petty — show why you're better without trash-talking.`,
	narrationVoice: `Sound confident and authoritative. You know the space. "Most tools do X. We do Y." Direct comparisons without being negative. Focus on what YOU offer, not what others lack. Factual, bold, credible.`,
	scenePlanGuide: `
## Video Type: Competitor Comparison
Goal: Convince viewers YOUR product is the better choice. Highlight differentiators, not feature lists.

NARRATIVE ARC — Status Quo → Gap → Your Edge → Proof → CTA:
1. STATUS QUO (1-2 scenes): "Most tools do X." or "You've tried the others." Establish the category. Use ghost-hook or stacked-hierarchy.
2. THE GAP (1-2 scenes): What's missing. What frustrates users. before-after (showing the "before" as the competitor experience), notification-chaos, or browser-tabs-chaos.
3. YOUR EDGE (3-4 scenes): The differentiators. SHOW, don't tell. Use icon-showcase (your unique features), data-flow-network (your architecture), scrolling-list (what you do differently).
4. PROOF (1 scene): Metrics, switching stats, or testimonial. metrics-dashboard or avatar-constellation.
5. CTA (1 scene): "Switch today" / "See the difference."

TONE: Confident, not combative. You're above the competition, not fighting them.
PACING: Measured confidence. 35-50 frame scenes. Total 12-16 scenes.
FAVORED SCENE TYPES: before-after (old way vs your way), metrics-dashboard (proof), icon-showcase (differentiators), scrolling-list (advantages).`,
	targetDurationSec: 25,
};

const CUSTOMER_STORY: DemoMode = {
	id: "customer-story",
	name: "Customer Story",
	description: "Metrics + quotes + transformation — let results speak",
	icon: "💬",
	primary: true,
	reconFocus: `Focus on: testimonials, case studies, customer logos, metrics/results, before/after stories, social proof sections, review quotes, success metrics. Skip: product features (this video is about RESULTS, not features), pricing, technical docs.`,
	scriptStyle: `Structure like a transformation story: 1) The challenge (what the customer faced), 2) The turning point (discovering/adopting the product), 3-4) The results (concrete metrics, quotes), 5) The transformation (life after), 6) CTA. Max 10 scenes. Make the CUSTOMER the hero, not the product.`,
	narrationVoice: `Sound like a storyteller sharing a success story. Warm, credible, human. Use real numbers: "40% faster." "3x more pipeline." "In just 12 weeks." Let the results do the talking. The product is the enabler, not the hero.`,
	scenePlanGuide: `
## Video Type: Customer Story
Goal: Show TRANSFORMATION through real results. The customer is the hero, the product is the tool.

NARRATIVE ARC — Challenge → Discovery → Results → Transformation → CTA:
1. CHALLENGE (1-2 scenes): The problem the customer faced. Make it relatable. ghost-hook or notification-chaos.
2. DISCOVERY (1 scene): "Then they found [product]." camera-text or logo-reveal. Brief — don't dwell.
3. RESULTS (3-4 scenes): THIS IS THE HEART. Concrete metrics, quotes, outcomes. Use metrics-dashboard (the numbers), before-after (the contrast), echo-hero (a standout stat like "40% faster"), scrolling-list (list of improvements).
4. TRANSFORMATION (1 scene): The "after" state. Clean, aspirational. gradient-mesh-hero or impact-word.
5. CTA (1 scene): "Join them" / "Start your story."

CRITICAL: Use REAL-FEELING numbers and quotes from the captured data. If no specific metrics exist, use plausible industry benchmarks.
PACING: Story pace — not rushed. 40-55 frame scenes. Total 10-14 scenes.
MUSIC MOOD: feel-good-pop or anthem-build.
FAVORED SCENE TYPES: metrics-dashboard, before-after, echo-hero (for standout stats), avatar-constellation (social proof), scrolling-list (improvements).`,
	targetDurationSec: 25,
};

const SOCIAL_CLIP: DemoMode = {
	id: "social-clip",
	name: "Social Clip",
	description: "15-second hook for social media — punchy and viral",
	icon: "📱",
	primary: true,
	reconFocus: `Focus on: the ONE most impressive or shareable thing about this product. The single best feature, the most striking metric, the boldest claim. Skip everything else — this is a 15-second clip, not a tour. Find the hook.`,
	scriptStyle: `Structure like a viral hook: 1) Attention-grab (1 bold statement), 2) The "wait, what?" moment (the impressive thing), 3) Quick proof or visual, 4) Product name + CTA. MAX 6-8 scenes. Every scene must EARN its place. If it doesn't make someone stop scrolling, cut it.`,
	narrationVoice: `Sound like a viral creator, not a marketer. Punchy. Bold. "This tool just..." "Wait until you see..." "No way this is real." Short fragments. No corporate language. Think TikTok energy with SaaS substance.`,
	scenePlanGuide: `
## Video Type: Social Clip
Goal: Stop the scroll. 15 seconds. One hook, one payoff, done.

NARRATIVE ARC — Hook → Wow → Name → CTA:
1. HOOK (1-2 scenes): ONE bold statement that makes someone stop scrolling. impact-word or stacked-hierarchy at MAXIMUM size. "This changes everything." or a shocking stat.
2. WOW (2-3 scenes): The impressive thing. FAST. Show it, don't explain it. Use the most visual scene types: data-flow-network, app-icon-cloud, before-after, metrics-dashboard.
3. NAME DROP (1 scene): Product name. camera-text or logo-reveal. Quick.
4. CTA (1 scene): "Link in bio" / "Try free" / website URL.

CRITICAL CONSTRAINTS:
- MAXIMUM 8 scenes total. Fewer is better.
- MAXIMUM 30 frames per scene (1 second). Most should be 24-28 frames.
- Total video: ~15 seconds (450 frames).
- NO subtitles. NO long text. Headlines are 1-4 words MAX.
- Font sizes: HUGE. 200px+ for impact scenes.
- Transitions: fast cuts and zoom-morphs only.

PACING: AGGRESSIVE. This is a social media clip. If the viewer blinks, they should miss a scene.
MUSIC MOOD: tiktok-hook or phonk-trailer.
BACKGROUNDS: High contrast. Dark with neon accents or stark white.`,
	targetDurationSec: 15,
};

// ── Advanced / legacy modes (shown in "More" section) ────────────────

const PRODUCT_TOUR: DemoMode = {
	id: "product-tour",
	name: "Product Tour",
	description: "Systematic walkthrough of features",
	icon: "🗺️",
	reconFocus: `Explore every feature section systematically. Look for: main navigation items, feature pages, settings, integrations, dashboard views, data views, any interactive demos. Cover ALL major sections.`,
	scriptStyle: `Structure like a guided tour: 1) Welcome/overview, 2-N) Visit each major feature in logical order, last) Summary or getting started. Be thorough — show every important section. 10-15 scenes. Each scene introduces one feature area and explains what it does.`,
	narrationVoice: `Sound like a friendly, knowledgeable guide showing someone around. Warm, clear, helpful. "Let me show you..." and "Here you can..." language. Explain what each feature does and why it's useful. Patient, not rushed.`,
	scenePlanGuide: `
## Video Type: Product Tour
Goal: Show everything the product does in an organized, friendly walkthrough.
Use Framework A (Problem → Solution → Outcome) or Framework D (Trust → Capability → Proof → Transformation).
PACING: Measured. 45-60 frame scenes. Total 14-18 scenes. Give viewers time to absorb each feature.`,
	targetDurationSec: 35,
};

const TUTORIAL: DemoMode = {
	id: "tutorial",
	name: "Tutorial",
	description: "Step-by-step task completion",
	icon: "📝",
	reconFocus: `Focus on interactive elements: forms, buttons, inputs, toggles, modals, wizards, step-by-step flows. Look for: signup/onboarding flows, creation workflows (create a project, write a post, configure settings), any multi-step processes.`,
	scriptStyle: `Structure like a how-to guide: 1) "Here's what we'll build/do", 2-N) Each step in the workflow with specific instructions, last) "You've completed X!" Show the actual workflow step by step. Zoom into form fields and buttons. 8-12 scenes.`,
	narrationVoice: `Sound like a clear, patient instructor. Step-by-step language: "First, click..." "Next, you'll see..." "Now enter..." Keep it factual and actionable. No hype — just clear instructions.`,
	scenePlanGuide: `
## Video Type: Tutorial
Goal: Walk the viewer through a specific task step-by-step.
Use scrolling-list for steps, before-after for results, icon-showcase for tools involved.
PACING: Slow and clear. 50-70 frame scenes. Total 10-14 scenes.`,
	targetDurationSec: 30,
};

const TEARDOWN: DemoMode = {
	id: "teardown",
	name: "Teardown / Analysis",
	description: "Analyze what makes this product tick",
	icon: "🔍",
	reconFocus: `Analyze everything with a critical eye: pricing model, unique features vs competitors, UX patterns, technical approach, target audience signals, integrations ecosystem. Look for what's genuinely differentiated vs table-stakes features.`,
	scriptStyle: `Structure like a product analysis: 1) What is this product? Who's it for? 2-3) What's genuinely unique/innovative? 4-5) How does the pricing work? 6) What's the UX quality like? 7) Final verdict. Be honest and analytical — praise what's good, note what's missing. 8-10 scenes.`,
	narrationVoice: `Sound like a thoughtful product analyst. Objective but opinionated. "What sets this apart is..." and "Notably, they've chosen to..." language. Informed, credible, not salesy. Point out both strengths and gaps.`,
	scenePlanGuide: `
## Video Type: Teardown / Analysis
Goal: Analyze a product objectively — what works, what doesn't, and why.
Use metrics-dashboard for comparisons, before-after for trade-offs, icon-showcase for feature breakdown.
PACING: Thoughtful. 45-60 frame scenes. Total 12-16 scenes.`,
	targetDurationSec: 30,
};

// ── Backward compat: "evangelist" maps to "saas-teaser" ──────────────

export const DEMO_MODES: Record<DemoModeId, DemoMode> = {
	"saas-teaser": SAAS_TEASER,
	"feature-spotlight": FEATURE_SPOTLIGHT,
	"launch-announcement": LAUNCH_ANNOUNCEMENT,
	"competitor-comparison": COMPETITOR_COMPARISON,
	"customer-story": CUSTOMER_STORY,
	"social-clip": SOCIAL_CLIP,
	"product-tour": PRODUCT_TOUR,
	tutorial: TUTORIAL,
	teardown: TEARDOWN,
	// Legacy alias
	evangelist: { ...SAAS_TEASER, id: "evangelist" },
};

export const DEMO_MODE_LIST: DemoMode[] = [
	SAAS_TEASER,
	FEATURE_SPOTLIGHT,
	LAUNCH_ANNOUNCEMENT,
	COMPETITOR_COMPARISON,
	CUSTOMER_STORY,
	SOCIAL_CLIP,
	PRODUCT_TOUR,
	TUTORIAL,
	TEARDOWN,
];

/** Primary modes shown prominently in the video type picker */
export const PRIMARY_MODES: DemoMode[] = DEMO_MODE_LIST.filter((m) => m.primary);

/** Advanced modes shown in a "More" section */
export const ADVANCED_MODES: DemoMode[] = DEMO_MODE_LIST.filter((m) => !m.primary);

export function getDemoMode(id: DemoModeId): DemoMode {
	return DEMO_MODES[id] ?? SAAS_TEASER;
}
