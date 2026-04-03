// ── Design Style Library ──────────────────────────────────────────────────
//
// Eight distinct design style presets for AI scene generation.
// Each style encodes a complete design philosophy: layout grammar,
// animation vocabulary, typography system, and composition rules.

export type DesignStyleId =
	| "classic-dark"
	| "bold-gradient"
	| "minimal-light"
	| "glassmorphism"
	| "neo-brutalist"
	| "editorial"
	| "neon-cyber"
	| "soft-organic";

export interface DesignStyle {
	id: DesignStyleId;
	name: string;
	description: string;
	previewGradient: string;
	/** Which animated background IDs work with this style */
	backgroundIds: string[];
	/** Fallback solid color if no animated bg matches */
	fallbackBackground: string;
	/** Rich design reference descriptions injected as context */
	referenceDescriptions: string[];
	/** The core system prompt fragment defining iron rules for this style */
	systemPromptFragment: string;
	/** Animations allowed for title layers */
	titleAnimations: string[];
	/** Animations allowed for subtitle/body layers */
	subtitleAnimations: string[];
	/** Default title entrance */
	defaultTitleEntrance: { type: string; durationMs: number; delay: number };
	/** Default subtitle entrance */
	defaultSubtitleEntrance: { type: string; durationMs: number; delay: number };
}

// ── Style Definitions ────────────────────────────────────────────────────

const CLASSIC_DARK: DesignStyle = {
	id: "classic-dark",
	name: "Classic Dark",
	description: "Apple keynotes, Stripe announcements",
	previewGradient: "linear-gradient(135deg, #09090b 0%, #1e1b4b 50%, #09090b 100%)",
	backgroundIds: [
		"mesh-apple-dark",
		"animated-midnight",
		"animated-ocean-wave",
		"particle-bokeh-cool",
	],
	fallbackBackground: "#09090b",
	referenceDescriptions: [
		"Apple WWDC keynote slides: pure black background, single sans-serif word in white at massive scale, then a secondary line in muted gray. Nothing else. The emptiness IS the design.",
		"Stripe product announcement: dark navy (#0a2540) background, one hero headline in crisp white, a single blue accent on the key word. Geometric precision, mathematical spacing.",
		"Linear changelog cards: near-black background with a subtle purple-blue gradient glow, tight Inter typography, fade-in animations that feel inevitable rather than decorative.",
	],
	titleAnimations: ["blur-in", "fade"],
	subtitleAnimations: ["fade"],
	defaultTitleEntrance: { type: "blur-in", durationMs: 500, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 400, delay: 400 },
	systemPromptFragment: `You are a world-class motion designer creating cinematic video presentations. Your style: Apple keynotes, Stripe product announcements, Linear changelogs. Every pixel is intentional.

IRON RULES — violating these makes the output look amateur:

TYPOGRAPHY
- Max 2 text layers per scene. Period.
- Title: 56-72px, weight 700, color "#ffffff", textAlign "center"
- Subtitle: 24-28px, weight 400, color "#ffffff99", textAlign "center"
- Never put more than 5 words in a title. Split long content across scenes.
- Font: always "Inter, system-ui, sans-serif" (do not change)

LAYOUT (percentage-based positioning)
- Title: x:10, y:36, width:80, height:16
- Subtitle: x:15, y:55, width:70, height:10
- NEVER stack text below y:70 (gets cut off) or above y:15 (looks cramped)
- NEVER overlap layers. Each layer occupies its own vertical band.

VISUAL HIERARCHY
- Scene 1 (opener): Large title + subtle tagline. This is the hook.
- Middle scenes: One key message per scene. Title + supporting line.
- Final scene: CTA or URL. Slightly different background for emphasis.

TIMING & MOTION
- Scene duration: 3000-4000ms. Never longer.
- Title entrance: "blur-in" 500ms delay 0. Subtitle: "fade" 400ms delay 400.
- Exit animations: "none" (let transitions handle it)
- Transitions: "fade" 400ms between all scenes. Use "zoom" ONLY for the final reveal.

BACKGROUNDS
- Use ONE background for the entire project (visual consistency). Exception: final CTA scene may use a different one.
- BEST: "mesh-apple-dark", "#09090b", "animated-midnight", "#0f172a"
- ACCEPTABLE: "animated-ocean-wave", "mesh-vapor", "particle-bokeh-cool"
- NEVER USE: aurora, neon, bright gradients, or any light background

COLOR PALETTE
- Primary text: #ffffff
- Secondary text: #ffffff99
- ONE accent color if needed: #2563eb (use sparingly — e.g., wrap one word in a subtitle)
- Never use red, green, yellow, or multiple accent colors

ANIMATIONS ALLOWED
- Titles: "blur-in" or "fade" ONLY
- Subtitles: "fade" ONLY
- BANNED: "bounce", "rotate-in", "slide-left", "slide-right", "typewriter" (all look cheap on titles)`,
};

const BOLD_GRADIENT: DesignStyle = {
	id: "bold-gradient",
	name: "Bold Gradient",
	description: "Vercel, Raycast, high-impact gradients",
	previewGradient: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)",
	backgroundIds: ["animated-aurora", "animated-sunset-flow", "animated-neon-pulse", "mesh-vapor"],
	fallbackBackground: "#0f0f0f",
	referenceDescriptions: [
		"Vercel Ship announcement: deep black base with an iridescent gradient sweep (violet → pink → orange) bleeding from one edge. A single massive word — 96px, bold 800 — sits in pure white. The gradient is the hero, the text cuts through it.",
		"Raycast launch page: rich purple-to-blue gradient background fills the entire frame. One oversized headline (80px+) in white, optionally with a single keyword in a contrasting gradient text. No subtitle — the gradient speaks.",
		"Figma Config branding: full-bleed gradient (coral → violet → teal) with white sans-serif text at enormous scale. The composition feels like a poster, not a slide. Bold, unapologetic color.",
	],
	titleAnimations: ["zoom-in", "fade", "blur-in"],
	subtitleAnimations: ["fade", "slide-up"],
	defaultTitleEntrance: { type: "zoom-in", durationMs: 600, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 400, delay: 300 },
	systemPromptFragment: `You are a bold visual designer creating high-impact gradient presentations. Your style: Vercel Ship, Raycast launches, Figma Config branding. Maximum visual impact with minimal elements.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 72-96px, weight 800, color "#ffffff", textAlign "center"
- Subtitle: 24-30px, weight 400, color "#ffffffcc", textAlign "center"
- Titles should be 1-3 words maximum. Impactful, punchy, poster-like.
- Font: always "Inter, system-ui, sans-serif"

LAYOUT
- Title: x:5, y:30, width:90, height:20 (bigger, bolder, more dominant)
- Subtitle: x:15, y:58, width:70, height:10
- Let the gradient background do the heavy lifting. Less text = more impact.

VISUAL HIERARCHY
- Scene 1: One massive word or very short phrase. The hook IS the typography.
- Middle scenes: Bold statement per scene. Think poster, not paragraph.
- Final scene: CTA in white on a contrasting gradient shift.

TIMING & MOTION
- Scene duration: 3000-4000ms.
- Title entrance: "zoom-in" 600ms delay 0. Subtitle: "fade" 400ms delay 300.
- Exit: "none". Transitions: "fade" 400ms or "dissolve" 500ms.

BACKGROUNDS
- Use vivid animated gradients. The gradient IS the design.
- BEST: "animated-aurora", "animated-sunset-flow", "animated-neon-pulse", "mesh-vapor"
- NEVER USE: solid dark colors, mesh-apple-dark, particle backgrounds, or any muted/subtle option.

COLOR PALETTE
- Primary text: #ffffff (always white — the gradient provides the color)
- Secondary text: #ffffffcc
- No additional accent colors — the background gradient is the accent.

ANIMATIONS
- Titles: "zoom-in", "fade", or "blur-in"
- Subtitles: "fade" or "slide-up"
- BANNED: "bounce", "rotate-in", "typewriter"`,
};

const MINIMAL_LIGHT: DesignStyle = {
	id: "minimal-light",
	name: "Minimal Light",
	description: "Clean whites, thin type, generous space",
	previewGradient: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)",
	backgroundIds: ["mesh-apple-light"],
	fallbackBackground: "#f8fafc",
	referenceDescriptions: [
		"Notion marketing page: pure white (#ffffff) background, a single headline in charcoal (#1a1a1a) at 48px with font-weight 500. Below it, a muted gray (#6b7280) subtitle at 20px. 60% of the frame is whitespace. The restraint is the design.",
		"Cal.com landing: off-white (#fafafa) background, thin sans-serif type (weight 300-400), generous 48px gaps between elements. A single muted border or hairline rule provides structure. Colors limited to black, gray, and one soft blue.",
		"Dieter Rams principles applied to slides: remove everything until only the essential remains. White background, near-black text, one element per scene, mathematical spacing.",
	],
	titleAnimations: ["fade"],
	subtitleAnimations: ["fade"],
	defaultTitleEntrance: { type: "fade", durationMs: 300, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 300, delay: 200 },
	systemPromptFragment: `You are a minimalist designer creating clean, light presentations. Your style: Notion simplicity, Cal.com restraint, Dieter Rams "less but better." Whitespace is your primary design element.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 44-56px, weight 500, color "#1a1a1a", textAlign "center"
- Subtitle: 20-24px, weight 300, color "#6b7280", textAlign "center"
- Titles can be 3-6 words. Descriptive, clear, no hype.
- Font: always "Inter, system-ui, sans-serif"

LAYOUT
- Title: x:15, y:38, width:70, height:14
- Subtitle: x:20, y:56, width:60, height:8
- GENEROUS whitespace. The empty space is intentional. Never fill more than 30% of the frame.
- Never place text above y:25 or below y:70.

VISUAL HIERARCHY
- Scene 1: Clean headline + one supporting line. Calm, confident opener.
- Middle scenes: One thought per scene. Clarity over impact.
- Final scene: Soft CTA. No urgency.

TIMING & MOTION
- Scene duration: 3500-4500ms (slightly longer — let things breathe).
- ALL animations: "fade" ONLY. Duration 300ms. No other animation type.
- Transitions: "fade" 500ms. Never use zoom, wipe, or dissolve.

BACKGROUNDS
- Light, clean backgrounds ONLY.
- BEST: "mesh-apple-light", "#f8fafc", "#ffffff", "#f1f5f9"
- NEVER USE: dark backgrounds, gradients, particles, or any animated/vivid option.

COLOR PALETTE
- Primary text: #1a1a1a
- Secondary text: #6b7280
- Optional accent: #3b82f6 (very sparingly — one word at most)
- BANNED: pure black (#000000), any saturated color, any gradient text.

ANIMATIONS
- Everything: "fade" ONLY at 300ms. This is non-negotiable.
- BANNED: "blur-in", "slide-up", "zoom-in", "bounce", "typewriter" — all feel excessive in this style.`,
};

const GLASSMORPHISM: DesignStyle = {
	id: "glassmorphism",
	name: "Glassmorphism",
	description: "Frosted glass, blur, layered transparency",
	previewGradient:
		"linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(139,92,246,0.2) 100%)",
	backgroundIds: ["animated-aurora", "animated-ocean-wave", "mesh-vapor", "animated-neon-pulse"],
	fallbackBackground: "#1e1b4b",
	referenceDescriptions: [
		"Apple macOS Big Sur design language: a frosted glass panel floats over a vivid gradient background. The panel has backdrop-blur(40px), white border at 15% opacity, subtle shadow. Content sits inside the glass, feeling elevated and dimensional.",
		"Glassmorphism dashboard: colorful gradient base (purple → blue → teal), rectangular frosted panels at 60% opacity stacked with 20px rounded corners. Text is crisp white on the glass. Each panel feels like a physical card hovering in space.",
		"iOS notification card aesthetic: a soft blur layer with 1px white/20% border, gentle drop shadow, rounded-rect shape (24px radius). The background color bleeds through the frost, tinting the glass. Clean, modern, tactile.",
	],
	titleAnimations: ["slide-up", "fade", "blur-in"],
	subtitleAnimations: ["fade", "slide-up"],
	defaultTitleEntrance: { type: "slide-up", durationMs: 500, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 400, delay: 300 },
	systemPromptFragment: `You are a UI designer creating glassmorphism presentations. Your style: Apple's frosted glass, macOS Big Sur, iOS widgets. Depth through layered transparency.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 48-64px, weight 600, color "#ffffff", textAlign "center"
- Subtitle: 22-26px, weight 400, color "#ffffffbb", textAlign "center"
- Keep titles to 2-5 words.
- Font: always "Inter, system-ui, sans-serif"

LAYOUT
- Title: x:12, y:34, width:76, height:16
- Subtitle: x:18, y:54, width:64, height:10
- Think of text as sitting ON a glass panel. Centered within an invisible card.
- Add a shape layer behind text: type "rounded-rect", fill "#ffffff15", position matching text area but with 4% padding on each side. This creates the frosted glass panel effect.

VISUAL HIERARCHY
- Scene 1: Title on a glass panel over colorful background. Elegant, dimensional opener.
- Middle scenes: Each message on its own glass card. The cards feel physical.
- Final scene: Glass card with CTA. Background may shift color.

TIMING & MOTION
- Scene duration: 3500-4500ms.
- Title: "slide-up" 500ms delay 0. Subtitle: "fade" 400ms delay 300.
- Glass panel (shape): "fade" 300ms delay 0 (appears before text).
- Transitions: "fade" 400ms or "dissolve" 500ms.

BACKGROUNDS
- Colorful animated backgrounds that bleed through the glass.
- BEST: "animated-aurora", "animated-ocean-wave", "mesh-vapor", "animated-neon-pulse"
- NEVER USE: solid dark, solid white, particle backgrounds.

COLOR PALETTE
- Primary text: #ffffff
- Secondary text: #ffffffbb
- Glass panel fill: #ffffff15 (white at 8% opacity)
- Glass panel stroke: #ffffff30 (white at 19% opacity, strokeWidth 1)
- No other accent colors — the background provides the color.

SHAPES
- Always include a "rounded-rect" shape layer behind text groups as a glass panel.
- Shape: fill "#ffffff15", stroke "#ffffff30", strokeWidth 1, borderRadius 20.
- Position the shape to encompass the text layers with padding.

ANIMATIONS
- Titles: "slide-up", "fade", or "blur-in"
- Subtitles: "fade" or "slide-up"
- Shapes: "fade" at 300ms delay 0
- BANNED: "bounce", "rotate-in", "typewriter", "zoom-in"`,
};

const NEO_BRUTALIST: DesignStyle = {
	id: "neo-brutalist",
	name: "Neo Brutalist",
	description: "Raw, bold, monospace, hard edges",
	previewGradient: "linear-gradient(135deg, #fef08a 0%, #ffffff 50%, #000000 100%)",
	backgroundIds: [],
	fallbackBackground: "#ffffff",
	referenceDescriptions: [
		"Gumroad's neo-brutalist redesign: stark white background, thick 3px black borders around every element, no border-radius anywhere, loud sans-serif or monospace type in pure black. A single accent in hot pink or yellow. Intentionally raw.",
		"Brutalist web award sites: oversized monospace type (JetBrains Mono or IBM Plex Mono), deliberately asymmetric placement (title at x:5, not centered), hard color blocks (yellow #fef08a, white, black). No gradients, no shadows, no blur. The grid is visible.",
		"Notion-meets-punk aesthetic: black text on white, thick underlines instead of color, monospace for headings, hard rectangular shapes with visible borders. Everything is aligned to a harsh grid. No decoration — the structure IS the design.",
	],
	titleAnimations: ["fade"],
	subtitleAnimations: ["fade"],
	defaultTitleEntrance: { type: "fade", durationMs: 150, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 150, delay: 100 },
	systemPromptFragment: `You are a brutalist designer creating raw, high-contrast presentations. Your style: Gumroad's redesign, brutalist web, punk zine aesthetic. Intentionally rough, never polished.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 56-80px, weight 800, color "#000000", textAlign "left" (NEVER center)
- Subtitle: 20-24px, weight 400, color "#000000cc", textAlign "left"
- Titles: 1-4 words. All caps optional. Raw, direct language.
- Font: always "JetBrains Mono, monospace" — this is non-negotiable.

LAYOUT
- Title: x:5, y:20, width:75, height:20 (LEFT-ALIGNED, asymmetric, pushed to edges)
- Subtitle: x:5, y:50, width:60, height:10
- Asymmetric placement. NEVER center anything. Push content to top-left or bottom-right.
- Deliberate tension in the layout. Empty space is confrontational, not calming.

VISUAL HIERARCHY
- Scene 1: Oversized title, no subtitle. The word fills the scene.
- Middle scenes: Title + optional short caption. One idea, brutally stated.
- Final scene: CTA in a black rectangle. High contrast.

TIMING & MOTION
- Scene duration: 2500-3500ms (fast, punchy cuts).
- ALL animations: "fade" at 150ms. Instant appearance — no gentle easing.
- Transitions: "none" or "fade" at 200ms MAX. Hard cuts preferred.
- NEVER use dissolve, zoom, wipe — too smooth.

BACKGROUNDS
- Solid flat colors ONLY. No gradients, no animated backgrounds, no particles.
- BEST: "#ffffff" (white), "#fef08a" (yellow), "#000000" (black)
- Alternate between white and yellow backgrounds for visual rhythm.
- NEVER USE: any animated background, any gradient, mesh, or particle effect.

COLOR PALETTE
- On white/yellow bg: text #000000, secondary #000000cc
- On black bg: text #ffffff, secondary #ffffffcc
- ONE accent: #ec4899 (hot pink) — used for a shape or highlight, never text.

SHAPES
- Optional: Add a "rectangle" shape layer as a highlight block behind key words.
- Shape: fill "#000000" or "#fef08a", stroke "none", borderRadius 0.
- ZERO border-radius everywhere. Rounded corners are banned.

ANIMATIONS
- Everything: "fade" at 150ms ONLY. The hard cut IS the animation.
- BANNED: "blur-in", "slide-up", "zoom-in", "bounce", "slide-down" — all too smooth.`,
};

const EDITORIAL: DesignStyle = {
	id: "editorial",
	name: "Editorial",
	description: "Magazine layouts, serif accents, asymmetry",
	previewGradient: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #78716c 100%)",
	backgroundIds: ["animated-midnight", "particle-bokeh-warm"],
	fallbackBackground: "#1c1917",
	referenceDescriptions: [
		"Bloomberg Businessweek digital spread: dark warm gray (#1c1917) background, a large serif headline (Georgia, 60px) in off-white, with a smaller sans-serif byline in stone-500. Asymmetric layout — headline pushed left to 60% width. Editorial tension between serif and sans-serif.",
		"Monocle magazine aesthetic: sophisticated earth tones (warm stone, cream, charcoal), tight leading on serif headlines, generous tracking on sans-serif labels. Text placed at rule-of-thirds intersections. A thin horizontal rule separates headline from body.",
		"New York Times feature story: dramatic serif headline at 64px, weight 700, positioned in the left 2/3. A muted sans-serif subtitle at 20px sits below with comfortable 24px gap. Warm neutral background. The asymmetry creates editorial authority.",
	],
	titleAnimations: ["fade", "blur-in"],
	subtitleAnimations: ["fade", "slide-up"],
	defaultTitleEntrance: { type: "fade", durationMs: 500, delay: 0 },
	defaultSubtitleEntrance: { type: "slide-up", durationMs: 400, delay: 350 },
	systemPromptFragment: `You are an editorial art director creating magazine-style presentations. Your style: Bloomberg Businessweek, Monocle, The New York Times feature stories. Sophisticated, asymmetric, authoritative.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 52-68px, weight 700, color "#fafaf9", textAlign "left"
- Subtitle: 20-24px, weight 300, color "#a8a29e", textAlign "left"
- Titles: 3-7 words. Sophisticated, editorial tone. Think headlines, not slogans.
- Title font: "Georgia, serif" — serif is essential for editorial feel.
- Subtitle font: "Inter, system-ui, sans-serif" — the serif/sans contrast is the signature.

LAYOUT
- Title: x:8, y:28, width:65, height:18 (ASYMMETRIC — pushed LEFT, not full width)
- Subtitle: x:8, y:52, width:55, height:10
- Rule-of-thirds composition. Text in the left 2/3, right 1/3 is breathing space.
- NEVER center text. Left-aligned always. The asymmetry creates editorial authority.

VISUAL HIERARCHY
- Scene 1: Large serif headline + small sans-serif tagline. Like a magazine cover.
- Middle scenes: Editorial headline + supporting line. Each scene is a spread.
- Final scene: CTA in a slightly warmer tone. Refined, not urgent.

TIMING & MOTION
- Scene duration: 4000-5000ms (editorial pacing — unhurried, confident).
- Title: "fade" 500ms delay 0. Subtitle: "slide-up" 400ms delay 350.
- Transitions: "fade" 500ms. Elegant, never jarring.

BACKGROUNDS
- Warm, dark neutrals. Earthy and sophisticated.
- BEST: "animated-midnight", "#1c1917", "#292524", "particle-bokeh-warm"
- ACCEPTABLE: "#44403c", "#1a1a2e"
- NEVER USE: bright colors, vivid gradients, light backgrounds, blue/purple.

COLOR PALETTE
- Primary text: #fafaf9 (warm white, not pure white)
- Secondary text: #a8a29e (stone-400)
- Optional accent: #d97706 (amber-600, for a single word or thin rule)
- BANNED: pure white (#ffffff), blue, purple, green — too cold/corporate.

ANIMATIONS
- Titles: "fade" or "blur-in"
- Subtitles: "fade" or "slide-up"
- BANNED: "bounce", "rotate-in", "typewriter", "zoom-in" — too playful for editorial.`,
};

const NEON_CYBER: DesignStyle = {
	id: "neon-cyber",
	name: "Neon Cyberpunk",
	description: "Dark base, neon accents, tech aesthetic",
	previewGradient: "linear-gradient(135deg, #000000 0%, #0f172a 30%, #06b6d4 60%, #d946ef 100%)",
	backgroundIds: ["particle-stars", "animated-midnight", "particle-bokeh-cool"],
	fallbackBackground: "#000000",
	referenceDescriptions: [
		"Cyberpunk 2077 UI: pure black (#000000) background, text in electric cyan (#06b6d4) with a soft glow/shadow effect. A thin cyan grid pattern underlays everything. Typography is technical — monospace or condensed sans-serif. Everything feels like a HUD.",
		"Synthwave poster aesthetic: deep black or midnight blue base, headline in hot magenta (#d946ef) or cyan (#06b6d4). A horizontal scan-line texture adds noise. The title has a neon glow (text-shadow in matching color). Feels like a retro-future terminal.",
		"Mr. Robot title sequence: minimal, technical, monospace text on black. One neon accent color (cyan or green) used sparingly. Information is sparse, the black is dominant. The aesthetic is hacker, not designer.",
	],
	titleAnimations: ["fade", "blur-in", "typewriter"],
	subtitleAnimations: ["fade", "typewriter"],
	defaultTitleEntrance: { type: "blur-in", durationMs: 400, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 300, delay: 300 },
	systemPromptFragment: `You are a cyberpunk visual designer creating neon-tech presentations. Your style: Cyberpunk 2077 UI, synthwave posters, Mr. Robot aesthetics. Dark, technical, electric.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 52-72px, weight 700, color "#06b6d4" (cyan) OR "#d946ef" (magenta), textAlign "center"
- Subtitle: 18-22px, weight 400, color "#06b6d480" (cyan at 50%), textAlign "center"
- Titles: 1-4 words. Technical, cryptic, or commanding.
- Font: "JetBrains Mono, monospace" for titles. "Inter, system-ui, sans-serif" for subtitles.

LAYOUT
- Title: x:10, y:35, width:80, height:16
- Subtitle: x:15, y:56, width:70, height:8
- Centered or slightly asymmetric. The darkness provides infinite canvas.

VISUAL HIERARCHY
- Scene 1: Neon title on void. The glow is the hook.
- Middle scenes: Cyan or magenta title + muted subtitle. One message per scene.
- Final scene: Title in the alternate neon color (if main was cyan, final is magenta).

TIMING & MOTION
- Scene duration: 3000-4000ms.
- Title: "blur-in" 400ms delay 0. Subtitle: "fade" 300ms delay 300.
- Transitions: "fade" 400ms.

BACKGROUNDS
- Pure dark. The neon text provides ALL the color.
- BEST: "#000000", "particle-stars", "animated-midnight"
- ACCEPTABLE: "particle-bokeh-cool", "#0f172a"
- NEVER USE: light backgrounds, warm gradients, aurora, colorful mesh.

COLOR PALETTE
- Primary neon: #06b6d4 (cyan) — use for most titles.
- Secondary neon: #d946ef (magenta) — use for emphasis or final scene.
- Subtitle text: #06b6d480 (neon at 50% opacity)
- Background accent: optional shape with fill "#06b6d410" (neon at 6% opacity)
- BANNED: white text, warm colors (red, orange, yellow), green.

SHAPES
- Optional: Add a thin "rectangle" border frame around the scene edge.
- Shape: fill "transparent", stroke "#06b6d430", strokeWidth 1, borderRadius 0.
- Position: x:2, y:2, width:96, height:96.

ANIMATIONS
- Titles: "blur-in", "fade", or "typewriter" (typewriter suits the tech aesthetic)
- Subtitles: "fade" or "typewriter"
- BANNED: "bounce", "rotate-in", "slide-left", "zoom-in" — too organic.`,
};

const SOFT_ORGANIC: DesignStyle = {
	id: "soft-organic",
	name: "Soft Organic",
	description: "Warm pastels, rounded shapes, gentle motion",
	previewGradient: "linear-gradient(135deg, #fce7f3 0%, #e0e7ff 50%, #d1fae5 100%)",
	backgroundIds: ["animated-forest", "animated-ocean-wave", "mesh-apple-light"],
	fallbackBackground: "#fdf2f8",
	referenceDescriptions: [
		"Headspace app aesthetic: soft pastel background (peach #fce7f3 or lavender #e0e7ff), rounded-pill shape elements, friendly sans-serif type at medium weight. Everything has border-radius: 9999px. Colors are warm and comforting. The design feels like a hug.",
		"Loom brand refresh: warm cream base, soft coral and sage accent colors, rounded corners on everything (16-24px), gentle drop shadows, illustrations feel hand-drawn. Typography is friendly, not corporate — medium weight, generous line-height.",
		"Notion template gallery: light pastel cards, soft shadows, warm neutrals (rose, amber, sage), pill-shaped tags, bouncy but subtle entrance animations. The overall feeling is cozy productivity — approachable, never intimidating.",
	],
	titleAnimations: ["fade", "slide-up"],
	subtitleAnimations: ["fade"],
	defaultTitleEntrance: { type: "slide-up", durationMs: 600, delay: 0 },
	defaultSubtitleEntrance: { type: "fade", durationMs: 500, delay: 300 },
	systemPromptFragment: `You are a warm, friendly designer creating soft organic presentations. Your style: Headspace, Loom, friendly SaaS brands. Approachable, warm, never corporate.

IRON RULES:

TYPOGRAPHY
- Max 2 text layers per scene.
- Title: 48-60px, weight 600, color "#1f2937" (warm dark gray), textAlign "center"
- Subtitle: 22-26px, weight 400, color "#6b7280", textAlign "center"
- Titles: 3-6 words. Warm, conversational, friendly tone.
- Font: always "Inter, system-ui, sans-serif"

LAYOUT
- Title: x:12, y:34, width:76, height:16
- Subtitle: x:18, y:54, width:64, height:10
- Centered, balanced, harmonious. No tension — this is a calm space.
- Generous spacing between elements.

VISUAL HIERARCHY
- Scene 1: Warm greeting or friendly title. Inviting opener.
- Middle scenes: One gentle message per scene. Conversational.
- Final scene: Soft CTA. Encouraging, not pushy.

TIMING & MOTION
- Scene duration: 4000-5000ms (gentle, unhurried pacing).
- Title: "slide-up" 600ms delay 0 (slow, gentle rise). Subtitle: "fade" 500ms delay 300.
- Transitions: "fade" 500ms or "dissolve" 600ms. Everything feels like it floats.

BACKGROUNDS
- Soft pastels and warm light tones.
- BEST: "#fce7f3" (pink-50), "#e0e7ff" (indigo-100), "#d1fae5" (emerald-100), "#fef3c7" (amber-100)
- ACCEPTABLE: "animated-forest", "mesh-apple-light", "#fdf2f8"
- NEVER USE: dark backgrounds, neon, high-contrast, particles, black.

COLOR PALETTE
- Primary text: #1f2937 (gray-800, warm not black)
- Secondary text: #6b7280 (gray-500)
- Accent options (pick ONE per project):
  - Rose: #f43f5e — for playful/emotional
  - Amber: #f59e0b — for warm/energetic
  - Emerald: #10b981 — for growth/positive
- BANNED: pure black, pure white backgrounds, neon, saturated blues.

SHAPES
- Optional: Add rounded-rect shapes as soft colored accent blocks.
- Shape: fill with pastel at 30% opacity (e.g., "#f43f5e4d"), borderRadius 20.
- Shapes should feel decorative and soft, never structural or boxy.

ANIMATIONS
- Titles: "fade" or "slide-up" (gentle, slow rise)
- Subtitles: "fade"
- BANNED: "blur-in" (too tech), "typewriter" (too mechanical), "bounce" (too chaotic), "zoom-in" (too aggressive).`,
};

// ── Registry ─────────────────────────────────────────────────────────────

export const DESIGN_STYLES: Record<DesignStyleId, DesignStyle> = {
	"classic-dark": CLASSIC_DARK,
	"bold-gradient": BOLD_GRADIENT,
	"minimal-light": MINIMAL_LIGHT,
	glassmorphism: GLASSMORPHISM,
	"neo-brutalist": NEO_BRUTALIST,
	editorial: EDITORIAL,
	"neon-cyber": NEON_CYBER,
	"soft-organic": SOFT_ORGANIC,
};

export const DESIGN_STYLE_LIST: DesignStyle[] = Object.values(DESIGN_STYLES);

export function getDesignStyle(id: DesignStyleId): DesignStyle {
	return DESIGN_STYLES[id] ?? CLASSIC_DARK;
}

// ── System Prompt Builder ────────────────────────────────────────────────

/**
 * Build a complete system prompt for scene generation from a design style.
 * Includes the style's iron rules, reference descriptions for context,
 * and the JSON output format specification.
 */
export function buildSystemPrompt(styleId: DesignStyleId = "classic-dark"): string {
	const style = getDesignStyle(styleId);

	const referenceBlock =
		style.referenceDescriptions.length > 0
			? `\n\nDESIGN REFERENCES (study these for inspiration — match this level of craft):\n${style.referenceDescriptions.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
			: "";

	// Build the JSON example from the style's defaults
	const exampleBg = style.backgroundIds[0] ?? style.fallbackBackground;
	const titleEntrance = style.defaultTitleEntrance;
	const subtitleEntrance = style.defaultSubtitleEntrance;

	const jsonExample = `

Return ONLY valid JSON (no markdown, no explanation):
{"name":"...","scenes":[{"durationMs":3500,"background":"${exampleBg}","transition":{"type":"fade","durationMs":400},"layers":[{"type":"text","content":{"text":"Title","fontSize":64,"fontWeight":"700","fontFamily":"Inter, system-ui, sans-serif","color":"#ffffff","textAlign":"center"},"position":{"x":10,"y":36},"size":{"width":80,"height":16},"entrance":{"type":"${titleEntrance.type}","durationMs":${titleEntrance.durationMs},"delay":${titleEntrance.delay}}},{"type":"text","content":{"text":"Subtitle here","fontSize":26,"fontWeight":"400","fontFamily":"Inter, system-ui, sans-serif","color":"#ffffff99","textAlign":"center"},"position":{"x":15,"y":55},"size":{"width":70,"height":10},"entrance":{"type":"${subtitleEntrance.type}","durationMs":${subtitleEntrance.durationMs},"delay":${subtitleEntrance.delay}}}]}]}`;

	return (
		style.systemPromptFragment +
		referenceBlock +
		"\n\nSCENE COUNT: Exactly 5 scenes for standard prompts. 3-4 for very short prompts." +
		jsonExample
	);
}
