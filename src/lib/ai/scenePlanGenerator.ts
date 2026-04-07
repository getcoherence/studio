// ── Scene Plan Generator ────────────────────────────────────────────────
//
// Generates a structured ScenePlan from captured demo data using AI.
// The plan is editable in the UI, then compiled to Remotion code.

import type { DemoStep } from "@/components/demo-studio/types";
import type { BrandInfo } from "./cinematicCompositionEngine";
import type { DemoModeId } from "./demoModes";
import { getDemoMode } from "./demoModes";
import type { ScenePlan } from "./scenePlan";

export async function generateScenePlan(
	steps: DemoStep[],
	opts?: {
		title?: string;
		brand?: BrandInfo;
		onStatus?: (msg: string) => void;
		/** Video type template — controls narrative arc, scene mix, and pacing */
		videoType?: DemoModeId;
		/** User's original prompt/brief describing what the video should focus on */
		userBrief?: string;
		/** Website URL being demoed — used for the CTA/outro scene */
		websiteUrl?: string;
	},
): Promise<{ plan: ScenePlan | null; error?: string }> {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const title = opts?.title || "Product Demo";
	const brand = opts?.brand;
	const accentColor = brand?.primaryColor || "#2563eb";
	const productName = brand?.productName || title;

	opts?.onStatus?.("Planning your cinematic video...");

	const sceneDescriptions = stepsWithScreenshots.slice(0, 15).map((step, i) => {
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

	// Inject video type template guide if specified
	const videoType = opts?.videoType ? getDemoMode(opts.videoType) : null;
	const videoTypeGuide = videoType?.scenePlanGuide || "";
	const targetDuration = videoType?.targetDurationSec;
	const userBrief = opts?.userBrief;

	const prompt = [
		`Create a cinematic video scene plan for "${productName}".`,
		"",
		"## Brand",
		`- Product: ${productName}`,
		`- Accent color: ${accentColor}`,
		"",
		...(userBrief
			? [
					"## User's Brief",
					userBrief,
					"IMPORTANT: The user wrote this brief to describe what the video should focus on. Follow their intent closely.",
					"",
				]
			: []),
		...(videoTypeGuide ? [videoTypeGuide, ""] : []),
		...(targetDuration
			? [
					`## Target Duration: ~${targetDuration} seconds (at 30fps = ~${targetDuration * 30} frames total)`,
					`Adjust scene count and individual scene durations to hit this target. Fewer scenes for shorter videos, more for longer.`,
					"",
				]
			: []),
		`## Captured Data (${stepsWithScreenshots.length} scenes)`,
		"",
		sceneDescriptions.join("\n\n"),
		"",
		"## Scene Types — Rich library of motion design patterns",
		"",
		"Each scene MUST have a `type` field. CHOOSE the type that best fits the content:",
		"",
		"### Narrative & Impact scenes",
		"- `impact-word`: Single massive word (200-320px). Use for beats like 'Finally.', 'Done.', 'One place.'",
		"- `ghost-hook`: Sentence fragmentation where future words are visible as ghosts. USE 3-4 of these in a row for the opening hook.",
		"  Data: `ghostWords: ['Your work', 'lives in 14 places.', 'Not anymore.']`, `ghostActiveIndex: 0` (increment in each scene)",
		"  CRITICAL: MAX 3 fragments in ghostWords array. Each fragment 2-5 words. Total sentence must fit on screen at fontSize 110-130.",
		"  BAD: ['You hit record.','Then the real work','begins.','It shouldn\\'t.'] — 4 fragments, too much text stacked vertically",
		"  GOOD: ['You hit record.','Then the chaos begins.','Not anymore.'] — 3 short fragments",
		"  Font size should stay at 110-130 for ghost-hook scenes — never 160+.",
		"- `stacked-hierarchy`: Multi-line with dramatic size hierarchy.",
		"  Data: `stackedLines: [{text:'WHY SETTLE', size:90}, {text:'FOR', size:110}, {text:'LESS', size:280}]`",
		"",
		"### Problem visualization scenes",
		"- `notification-chaos`: Platform notification cards scattered around a central headline. THE pattern for 'overwhelm' problems.",
		"  Data: `notifications: [{platform:'instagram',title:'Sarah',subtitle:'liked your post',time:'2m'}, ...]`",
		"  Platforms: instagram, linkedin, twitter, youtube, email, slack, generic",
		"- `chat-narrative`: Progressive Slack-like chat showing a problem unfolding.",
		"  Data: `chatMessages: [{user:'Sarah',text:'Anyone got the report?',time:'9:42 AM'}, ...]`, `chatChannel: 'general'`",
		"",
		"### Solution & transformation scenes",
		"- `before-after`: Animated split-screen comparing problem state vs solution state.",
		"  Data: `beforeLines: ['Flat.','Cluttered.','Forgettable.']`, `afterLines: ['Clean.','Branded.','Ready to ship.']`",
		"  **Variants** (set `variant` field): `split-card` (side-by-side dark/light card), `swipe-reveal` (animated wipe revealing after over before), `stacked-morph` (before list fades out, after list grows in), `toggle-switch` (UI toggle that flips between states)",
		"- `logo-reveal`: Brand moment with GradientText + FloatingOrbs + LightStreak.",
		"  Data: `headline: 'Lucid Studio'`, `subtitle: 'Record. Let AI work.'`",
		"",
		"### Proof & metrics scenes",
		"- `metrics-dashboard`: 2-3 animated counters with dividers.",
		"  Data: `metrics: [{value:10,label:'Times faster',suffix:'x'},{value:99,label:'Uptime',suffix:'%'}]`",
		"  **Variants** (set `variant` field): `counter-row` (horizontal counters with dividers), `bar-chart` (animated vertical bars), `pie-radial` (radial progress rings — best when values are percentages), `ticker-tape` (scrolling stock-ticker style cards)",
		"- `icon-showcase`: Grid of 3-9 feature icons with labels.",
		"  Data: `iconItems: [{icon:'⚡',label:'Fast'},{icon:'🔒',label:'Secure'},...]`",
		"- `product-glow`: Tilted screenshot wrapped in brand-gradient glow frame.",
		"  Data: `screenshotIndex: 0`, `perspectiveX: 12`, `perspectiveY: -4`, `headline: 'See it in action.'`",
		"- `typewriter-prompt`: Hero TypewriterInput being typed (for AI/prompt-based products).",
		"  Data: `typewriterText: 'Create a landing page for my startup'`",
		"",
		"### Typography-as-shape scenes",
		"- `radial-vortex`: Concentric rings of repeating text spiraling outward. Dramatic opening. Use for manifestos.",
		"  Data: just `headline` (the repeated word)",
		"- `outline-hero`: Hollow stroke-only typography at 240-300px. Editorial feel.",
		"  Data: just `headline`",
		"- `echo-hero`: Text with motion-blur zoom trails. Use for impact stats/numbers like '33% time'.",
		"  Data: just `headline`",
		"- `word-slot-machine`: Vertical word list with ONE bolded + checkmark. 'Your ✓ **App**' pattern.",
		"  Data: `slotMachinePrefix: 'Your'`, `slotMachineWords: ['Product','App','Agency','Story']`, `slotMachineSelectedIndex: 1`",
		"  NOTE: Only ONE word visible at the end (the selected one). Use when you want the AUDIENCE to feel 'it could be any of these, but YOU specifically'.",
		"  **Variants** (set `variant` field): `wheel` (vertical slot wheel), `typewriter-swap` (text types out, gets crossed out, retyped), `flip-cards` (cards flip in horizontally to reveal each word), `glitch-swap` (glitch/distortion effect between word transitions)",
		"- `scrolling-list`: 4-6 lines scrolling up sequentially, ALL staying visible at the end. The 'TRIM. CAPTION. EXPORT. POLISH.' pattern.",
		"  Data: `scrollingListLines: [{text:'Record.'},{text:'Edit.'},{text:'Caption.'},{text:'Polish.'},{text:'Ship.'}]`, optional `headline: 'Before Lucid'`",
		"  Use when all items in the list are INDIVIDUALLY RELEVANT (steps in a process, features, things the product handles). Last line gets the accent color automatically.",
		"  CHOOSE BETWEEN: `word-slot-machine` (audience matching — 1 winner) vs `scrolling-list` (enumerate relevant items — all visible).",
		"",
		"### Social proof & data scenes",
		"- `avatar-constellation`: Customer avatars orbit a central claim. Use for social proof.",
		"  Data: `headline: 'Trusted by thousands'`, `avatarCount: 8`",
		"- `dashboard-deconstructed`: 3-4 floating metric cards with a chart line connecting them.",
		"  Data: `dashboardMetrics: [{label:'Users',value:'16,891',delta:'+25%'}, ...]`",
		"- `data-flow-network`: 5 nodes connected by animated dashed lines. Visual metaphor for pipelines.",
		"  Data: `networkNodes: ['Input','Process','Analyze','Decide','Output']`",
		"  **Variants** (set `variant` field): `circles` (connected floating circles), `timeline-arrows` (horizontal timeline with arrow connectors), `hex-grid` (hexagonal staggered nodes), `isometric-blocks` (3D blocks with pipe connectors), `orbital-rings` (nodes orbiting a center point)",
		"",
		"### Cinematic camera-text scene (THE premium brand reveal)",
		"- `camera-text`: THE signature brand reveal from top-tier SaaS videos (Numtera, Lovable, Framer).",
		"  Text is treated as a 3D object the camera flies through. Words appear with typewriter effect,",
		"  camera zooms and shifts, motion blur during fast scale changes, inline logo injection.",
		"  This is ONE scene that replaces what would otherwise be 4-6 separate simple scenes.",
		"  USE THIS for your brand reveal (after the hook). Duration: 55-75 frames.",
		"  Data:",
		"    `cameraTextWords`: array of words with appearsAt timing",
		"      [{ text: 'Meet', appearsAt: 0 },",
		"       { text: 'N', appearsAt: 30, isLogo: true, logoContent: 'N', logoColor: '#2563eb' },",
		"       { text: 'Numtera', appearsAt: 18, color: '#2563eb' }]",
		"    `cameraTextCamera`: camera keyframes (scale + translate over time)",
		"      [{ frame: 0, scale: 3, translateY: 120 },",
		"       { frame: 12, scale: 2, translateY: 40 },",
		"       { frame: 22, scale: 1.5 },",
		"       { frame: 38, scale: 1.3 },",
		"       { frame: 58, scale: 0.3, translateY: -60 }]",
		"  CAMERA CHOREOGRAPHY RULES (CRITICAL — READABILITY):",
		"    - MAX scale is 2.5. NEVER use 3+ — text becomes unreadable and overflows frame.",
		"    - Start: scale 1.8-2.2 with translateY 60-100 (text slightly big, below center)",
		"    - Settle: scale 1.2-1.4 by frame 18-22 (text readable at normal size)",
		"    - HOLD: add a keyframe at same scale for 15-20 frames so viewer can READ the text",
		"    - Exit: scale 0.3-0.5 by the end (shrink away)",
		"    - ALWAYS include a hold period — don't zoom continuously end-to-end",
		"    - Example good curve: [{frame:0,scale:2,translateY:80},{frame:12,scale:1.4,translateY:20},{frame:22,scale:1.2},{frame:42,scale:1.2},{frame:58,scale:0.4,translateY:-40}]",
		"    - Logo word appearsAt 25-35 (after product name starts)",
		"",
		"### Premium & chaos scenes",
		"- `gradient-mesh-hero`: Soft pastel gradient mesh background with centered text. Premium/ethereal feel.",
		"  Data: `headline`, optional `subtitle`, optional `meshColors: ['#ffd6e7','#e0d4ff','#d4fff1','#ffefd6']`",
		"- `browser-tabs-chaos`: Recreated browser chrome with 10-15 tabs, huge headline below. 'Endless tabs' problem visualization.",
		"  Data: `headline: 'Endless tabs.'`, `browserTabs: ['linkedin.com','twitter.com','notion.so',...]`",
		"- `app-icon-cloud`: 3D app icons scattered across the frame with central headline. 'Everywhere at once' pattern.",
		"  Data: `headline: 'Every tool. One flow.'`, `appIcons: [{icon:'💬',color:'#4a154b'},{icon:'📧',color:'#ea4335'},...]`",
		"",
		"### Cinematic scenes (high production value)",
		"- `device-showcase`: Screenshot displayed inside a laptop or phone mockup with floating entrance animation.",
		"  Data: `screenshotIndex: 0`, `headline: 'See it in action.'`",
		"  **Variants**: `laptop` (browser chrome with traffic lights), `phone` (mobile frame). Set `variant` field.",
		"- `glass-stats`: Glassmorphism (frosted glass) cards with animated metric counters. Premium feel.",
		"  Data: `metrics: [{value:500,label:'Users',suffix:'+'},{value:99,label:'Uptime',suffix:'%'}]`, `headline: 'By the numbers.'`",
		"- `cinematic-title`: Oversized gradient-fill text with particle background. Use for dramatic statements.",
		"  Data: `headline: 'The future.'`, optional `subtitle`. Uses gradient animation + particles automatically.",
		"- `countdown`: Animated number counting up to a target with confetti burst on completion.",
		"  Data: `countdownTarget: 1000`, `headline: 'bugs eliminated'`. Number animates from 0 → target.",
		"",
		"### Legacy types (still supported)",
		"- `hero-text`: Centered headline with optional subtitle. Basic.",
		"- `cards`: 2-3 feature cards. Use MAX 1 per video.",
		"- `cta`: Product name + call to action.",
		"- `screenshot`: Browser frame with screenshot. Use MAX 1.",
		"",
		"## Output Format",
		"Return ONLY valid JSON matching this structure (no markdown, no explanation):",
		"",
		`{`,
		`  "title": "${productName}",`,
		`  "accentColor": "${accentColor}",`,
		`  "scenes": [`,
		`    {`,
		`      "type": "camera-text | ghost-hook | impact-word | notification-chaos | chat-narrative | before-after | metrics-dashboard | icon-showcase | logo-reveal | typewriter-prompt | product-glow | stacked-hierarchy | scrolling-list | radial-vortex | outline-hero | echo-hero | word-slot-machine | avatar-constellation | gradient-mesh-hero | dashboard-deconstructed | browser-tabs-chaos | app-icon-cloud | data-flow-network | device-showcase | glass-stats | cinematic-title | countdown | hero-text | cards | cta | screenshot",`,
		`      "variant": "optional — visual variant within the scene type (see Variants notes above). Only set for types that have variants.",`,
		`      "headline": "short punchy headline",`,
		`      "subtitle": "optional subtitle (skip for impact-word, ghost-hook, stacked-hierarchy)",`,
		`      "background": "white|cream|warm-gray|cool-gray|soft-blue|soft-green|soft-rose|black|charcoal|dark-slate|dark-teal|dark-wine|navy|brand-dark|deep-purple|midnight-teal|warm-night|steel-gradient|aurora-dark",`,
		`      "animation": "chars|words|scale|clip|gradient|glitch|blur-in|bounce|wave|typewriter|staccato|split|drop|scramble|matrix|rotate-3d|glitch-in",`,
		`      "font": "serif|sans-serif",`,
		`      "fontSize": 120,`,
		`      "accentWord": "optional word to highlight",`,
		`      "durationFrames": 60,`,
		`      "effects": ["vignette", "light-streak"],`,
		`      "ghostWords": ["for ghost-hook scenes"],`,
		`      "ghostActiveIndex": 0,`,
		`      "notifications": [{"platform":"instagram","title":"Sarah","subtitle":"liked your post","time":"2m"}],`,
		`      "chatMessages": [{"user":"Sarah","text":"urgent","time":"9:42 AM"}],`,
		`      "chatChannel": "general",`,
		`      "beforeLines": ["for before-after"],`,
		`      "afterLines": ["for before-after"],`,
		`      "metrics": [{"value":10,"label":"Faster","suffix":"x"}],`,
		`      "iconItems": [{"icon":"⚡","label":"Fast"}],`,
		`      "typewriterText": "for typewriter-prompt",`,
		`      "screenshotIndex": 0,  "countdownTarget": 1000,`,
		`      "stackedLines": [{"text":"WHY","size":90},{"text":"NOT?","size":280}],`,
		`      "scrollingListLines": [{"text":"Record."},{"text":"Edit."},{"text":"Caption."},{"text":"Polish."},{"text":"Ship."}],`,
		`      "slotMachinePrefix": "Your", "slotMachineWords": ["App","Product"], "slotMachineSelectedIndex": 0,`,
		`      "avatarCount": 8,`,
		`      "dashboardMetrics": [{"label":"Users","value":"16,891","delta":"+25%"}],`,
		`      "browserTabs": ["linkedin.com","twitter.com","notion.so"],`,
		`      "appIcons": [{"icon":"💬","color":"#4a154b","label":"Chat"}],`,
		`      "networkNodes": ["Input","Process","Output"],`,
		`      "meshColors": ["#ffd6e7","#e0d4ff","#d4fff1","#ffefd6"],`,
		`      "cameraTextWords": [{"text":"Meet","appearsAt":0},{"text":"N","appearsAt":30,"isLogo":true,"logoContent":"N","logoColor":"#2563eb"},{"text":"Numtera","appearsAt":15,"color":"#2563eb"}],`,
		`      "cameraTextCamera": [{"frame":0,"scale":3,"translateY":120},{"frame":12,"scale":2,"translateY":40},{"frame":22,"scale":1.5},{"frame":38,"scale":1.3},{"frame":58,"scale":0.3,"translateY":-60}],`,
		`      "backgroundEffect": "flowing-lines | drifting-orbs | mesh-shift | particle-field | grain | pulse-grid | aurora | spotlight | wave-grid | gradient-wipe | bokeh | liquid-glass | confetti | snow | fireflies | sakura | sparks | perspective-grid | flowing-gradient | none",`,
		`      "backgroundEffectColors": ["#2563eb","#7c3aed","#06b6d4"],`,
		`      "transitionOut": "fade | slide-left | slide-right | slide-up | slide-down | wipe-left | wipe-right | wipe-up | wipe-down | zoom-morph | striped-slam | zoom-punch | diagonal-reveal | color-burst | vertical-shutter | glitch-slam | cut",`,
		`      "transitionDurationFrames": 10`,
		`    }`,
		`  ],`,
		`  "musicMood": "saas-teaser | hype-launch | indie-bedroom | future-garage | synthwave-retro | lofi-hiphop | glitch-hop | tropical-house | phonk-trailer | anthem-build | whistle-hook | clap-stomp-anthem | feel-good-pop | tiktok-hook | funk-bass-horns | energetic | dramatic | upbeat | ambient | minimal"`,
		`}`,
		"",
		"## Music Selection",
		"Pick ONE musicMood from the list above that BEST matches the video's overall vibe.",
		"- Bold/fast narrative → 'hype-launch' or 'saas-teaser'",
		"- Friendly/approachable → 'feel-good-pop' or 'indie-bedroom'",
		"- Edgy/confident → 'phonk-trailer' or 'glitch-hop'",
		"- Cinematic reveal → 'anthem-build' or 'dramatic'",
		"- Catchy/viral → 'tiktok-hook' or 'whistle-hook'",
		"- Chill/minimal → 'lofi-hiphop' or 'minimal'",
		"",
		"## Creative Direction — TELL A STORY, NOT A FEATURE LIST",
		"",
		"CRITICAL: This video must have a NARRATIVE ARC, not just list features.",
		"",
		"First, CLASSIFY the company based on the captured data and choose the BEST narrative framework:",
		"",
		"### Framework A: Problem → Solution → Outcome (general SaaS, productivity tools)",
		"1. HOOK (1-2 scenes): Name the viewer's pain. 'Your tools work against each other.'",
		"2. TENSION (1 scene): Amplify the problem. Make it feel urgent or frustrating.",
		"3. SOLUTION (1-2 scenes): Introduce the product as the relief moment. Aspirational, not technical.",
		"4. PROOF (2-3 scenes): Show key capabilities. Vary visuals aggressively.",
		"5. OUTCOME (1 scene): Show what life looks like after. Confident, clean.",
		"6. CTA (1 scene): Product name + call to action.",
		"",
		"### Framework B: Complexity → Clarity (infrastructure, AI, ops, data platforms)",
		"1. HOOK (1-2 scenes): Show overwhelming complexity. 'Too many tools. Too many tabs.'",
		"2. CHAOS (1 scene): Visual density — fast motion, fragmentation, overload.",
		"3. SHIFT (1 scene): Transition to calm. One clean interface emerges.",
		"4. CLARITY (2-3 scenes): Show the simplified system. Modular, organized.",
		"5. OUTCOME (1 scene): Clean, unified result.",
		"6. CTA (1 scene): Product name + call to action.",
		"",
		"### Framework C: Old Way → New Way (disruptive tools, new categories)",
		"1. HOOK (1-2 scenes): 'The old way is broken.' Bold, confrontational.",
		"2. OLD WAY (1-2 scenes): Show the outdated approach. Friction, frustration.",
		"3. PIVOT (1 scene): 'There's a better way.' Sharp contrast moment.",
		"4. NEW WAY (2-3 scenes): Show the modern approach. Fast, elegant, powerful.",
		"5. CTA (1 scene): Product name + call to action.",
		"",
		"### Framework D: Trust → Capability → Proof → Transformation (enterprise, security, fintech)",
		"1. HOOK (1-2 scenes): Establish credibility. Scale, trust, reliability.",
		"2. CAPABILITY (2-3 scenes): Show what the platform does. Measured, confident tone.",
		"3. PROOF (1-2 scenes): Stats, social proof, outcomes. Use MetricCounter or data visuals.",
		"4. TRANSFORMATION (1 scene): The result. Premium, aspirational.",
		"5. CTA (1 scene): Product name + call to action.",
		"",
		"Choose the framework that best fits this company, then structure scenes accordingly.",
		"",
		"## Design Rules — THIS IS A MUSIC VIDEO, NOT A PRESENTATION",
		"",
		"Think of this as a motion graphics piece set to music — NOT a slideshow with animations.",
		"",
		"### PACING (critical — this is what makes it feel professional vs boring)",
		"- 12-16 scenes total. Quality over quantity. Each scene needs time to breathe and be read.",
		"- Scene durations — BE AGGRESSIVE. Default to SHORTER:",
		"  - IMPACT scenes: 40-55 frames (1.3-1.8 sec) — single word or short phrase, hit hard and CUT",
		"  - STANDARD scenes: 55-75 frames (1.8-2.5 sec) — headline with animation, viewer needs time to READ",
		"  - RICH scenes: 75-100 frames (2.5-3.3 sec) — before-after, metrics-dashboard, chat-narrative, icon-showcase, data-flow-network, scrolling-list (scenes with multiple elements that animate sequentially)",
		"  - GHOST-HOOK scenes: 45-60 frames each (viewers must read the full sentence fragment)",
		"- MAXIMUM duration for ANY scene is 120 frames (4 sec). Use this for very content-dense scenes.",
		"- RULE OF THUMB: if a scene has more than 5 words of text, it needs at least 60 frames. More than 15 words → at least 80 frames.",
		"- 4+ seconds per scene feels like a slideshow. 1.5-3 seconds is the sweet spot for most scenes.",
		"- NEVER make all scenes the same duration. That's what makes it feel robotic.",
		"- Ghost-hook scenes should each be 45-60 frames (viewers need time to read each fragment).",
		"",
		"### ANIMATED BACKGROUNDS (no more solid black/white!)",
		"Every scene should have a `backgroundEffect` field to get an animated backdrop. Options:",
		"- `flowing-lines`: Soft curved SVG lines sweeping across — clean/editorial scenes",
		"- `drifting-orbs`: Large blurred color orbs slowly moving — premium brand/hero moments",
		"- `mesh-shift`: Multi-color gradient mesh shifting hue — ethereal, ghost-hook or word-slot-machine",
		"- `particle-field`: Tiny bright particles drifting upward — magical, impact or outline scenes",
		"- `grain`: Subtle animated grain/noise overlay — editorial, impact-word and stacked-hierarchy",
		"- `pulse-grid`: Geometric grid pattern that pulses — tech/data feel, icon-showcase and data-flow",
		"- `aurora`: Flowing aurora-like color gradients — dreamy, key moments only",
		"- `spotlight`: Dramatic spotlight cone drifting across the frame — cinematic, perfect for reveals and CTA scenes",
		"- `wave-grid`: 3D-perspective animated wave grid (Tron/retro) — tech products, data platforms, modern SaaS",
		"- `gradient-wipe`: Smooth diagonal gradient band sweeping across — elegant transitions, launch announcements",
		"- `bokeh`: Soft out-of-focus circles drifting (cinematic bokeh) — premium, photography/video products",
		"- `liquid-glass`: Morphing organic blobs with frosted glass effect — creative tools, design products, modern feel",
		"- `confetti`: Colorful paper pieces raining down — celebration, milestones, launches",
		"- `snow`: Soft white snowflakes drifting — winter themes, calm/clean products",
		"- `fireflies`: Warm glowing dots that float and pulse — ambient, organic products",
		"- `sakura`: Pink cherry blossom petals falling — premium, creative, emotional scenes",
		"- `sparks`: Shooting star trails streaking across — tech, speed, innovation themes",
		"- `perspective-grid`: Synthwave scrolling grid with horizon line — retro-futurism, tech/data",
		"- `flowing-gradient`: Animated rainbow gradient shifting hue/angle — creative, design tools",
		"- `none`: No effect (plain background) — use SPARINGLY, only for before-after where you need clean contrast",
		"",
		"MIX background effects aggressively. Never use the same effect on 3+ consecutive scenes.",
		"",
		"Specify `backgroundEffectColors` as an array of 2-4 colors to theme the effect. Defaults to brand + complementary.",
		"",
		"Most scenes should have an animated background. Never leave more than 1 scene with backgroundEffect: none.",
		"",
		"### TRANSITIONS (specify transitionOut on every scene!)",
		"Every scene should have a `transitionOut` field. Available options:",
		"- `fade`: subtle crossfade — use for ghost-hook → ghost-hook, calm moments",
		"- `slide-left`: new scene slides in from the RIGHT, pushes old scene out left — use for reveals, proof",
		"- `slide-right`: new scene slides in from the LEFT — use sparingly, reverse direction",
		"- `slide-up`: new scene comes from the BOTTOM, pushes old scene UP — use for 'reveal' moments",
		"- `slide-down`: new scene drops from the TOP — rare, for dramatic reveals",
		"- `wipe-left`: bold wipe from right — use for chaos scenes being swept away",
		"- `wipe-right`: bold wipe from left",
		"- `wipe-up`: bold wipe from bottom",
		"- `zoom-morph`: CINEMATIC fly-through transition where you zoom through the text/object into the next scene. USE THIS after impact-word or echo-hero scenes for maximum drama.",
		"- `striped-slam`: Horizontal bars slam in from both sides, cover the scene, retract to reveal. HIGH ENERGY opening/closing transition.",
		"- `zoom-punch`: Old scene retreats, new scene punches in with cubic ease. Medium-high energy, camera-cut feel.",
		"- `diagonal-reveal`: Dark panel sweeps left→right with glowing accent line. Cinematic, great for reveals.",
		"- `color-burst`: Sharp radial flash peaks at the cut. High impact, use for emotional beats or product reveals.",
		"- `vertical-shutter`: Venetian blind panels snap shut then open. Graphic, stop-motion feel.",
		"- `glitch-slam`: Horizontal shake + RGB strip tears on exit, hard pop-in on enter. Maximum chaos, great before CTA.",
		"- `cut`: instant cut, no transition — use sparingly for shock cuts",
		"",
		"MIX transition types aggressively. Never use the same transition 3 times in a row.",
		"The AI that reviews this video WILL PENALIZE you if transitions are monotone.",
		"",
		"### CONTENT DENSITY (most scenes should be SPARSE, not dense)",
		"- At least 4 scenes should have ONLY a headline — NO subtitle. Just bold text, big space.",
		"- At least 2 scenes should be 1-3 WORDS only (e.g. 'Finally.' or 'One place.' or 'Zero friction.')",
		"- Subtitles on MAX 5 scenes. Most scenes don't need them.",
		"- Headlines: 2-5 words for impact scenes, max 7 words for standard scenes.",
		"- CARDS: Maximum 1 scene with cards. Max 3 cards. Use for proof, not story.",
		"",
		"### STATISTICS & CLAIMS (never fabricate!)",
		"- ONLY use statistics, numbers, and claims that appear in the captured narration or UI elements.",
		"- If the website says '50,000+ bugs eliminated' → use that exact stat.",
		"- If no stats are available, use qualitative claims ('Faster', 'Simpler', 'Unified') instead of made-up numbers.",
		"- NEVER invent metrics like '24 hours saved' or '42% faster' unless the source material says so.",
		"- For metrics-dashboard and glass-stats scenes: use REAL numbers from the website, or use descriptive text.",
		"- For countdown scenes: only use numbers that are verifiable from the captured content.",
		"",
		"### VISUAL VARIETY",
		"- ANIMATION VARIETY: Use at least 7 DIFFERENT animation types. Never repeat twice in a row.",
		"  Favor kinetic ones: staccato, split, drop, scramble, typewriter.",
		"- BACKGROUNDS: Alternate light/dark. Never same bg twice in a row.",
		"- FONTS: serif on light, sans-serif on dark.",
		"- FONT SIZE: 140-180 for impact scenes (1-3 words). 110-140 for standard. MINIMUM 100.",
		"- EFFECTS: vignette max 2x. light-streak max 1x. Less is more.",
		"- SCREENSHOTS: 0-1 total. This is motion graphics, not a product tour.",
		"",
		"### RHYTHM PATTERN (follow this beat structure)",
		"Short → Short → Standard → Short → Breathing → Short → Standard → Short → Short → CTA",
		"The video should feel like BURSTS of energy with brief pauses, not a steady march.",
		"",
		"## REQUIRED scene type mix (15-scene video)",
		"You MUST use AT LEAST 10 DIFFERENT scene types across the video. Here's the ideal distribution:",
		"",
		"### Hook phase (first 3-4 scenes)",
		"- 3-4x `ghost-hook` with incrementing ghostActiveIndex (same ghostWords array, different activeIndex 0,1,2,3)",
		"- OR: 1x `browser-tabs-chaos`, 1x `notification-chaos`, 1x `impact-word`, 1x `ghost-hook`",
		"",
		"### Brand reveal + relief (1-2 scenes)",
		"- 1x `camera-text` — THE signature cinematic brand reveal. THIS IS THE MONEY SHOT.",
		"  Use this instead of logo-reveal for premium feel. ONE camera-text scene replaces 4+ simple text scenes.",
		"  Duration: 55-75 frames. Put it after the hook.",
		"- OR: 1x `logo-reveal` (simpler, less cinematic)",
		"- Optional: 1x `gradient-mesh-hero` (soft premium bg with product name)",
		"",
		"### Proof & features (5-7 scenes — MAXIMUM variety here)",
		"Pick from these, using EACH TYPE AT MOST ONCE. PRIORITIZE VISUAL-HEAVY types:",
		"- **`app-icon-cloud`** ⭐ (3D scattered floating app icons with headline) — HIGHEST IMPACT",
		"- **`data-flow-network`** ⭐ (nodes connected by animated lines) — VERY VISUAL",
		"- **`dashboard-deconstructed`** ⭐ (floating metric cards with chart line) — VERY VISUAL",
		"- `metrics-dashboard` (counters with dividers)",
		"- `icon-showcase` (feature grid)",
		"- `word-slot-machine` ('Your ✓ App' pattern — 1 answer out of many)",
		"- **`scrolling-list`** ⭐ (4-6 steps scrolling up sequentially, all visible at end) — EXCELLENT for process/feature lists",
		"- `avatar-constellation` (social proof)",
		"- `before-after` (split-screen comparison)",
		"- `process-ladder` (3-step progression)",
		"- `product-glow` (tilted screenshot)",
		"- `typewriter-prompt` (hero product input)",
		"",
		"CRITICAL: At least 2 of your proof scenes MUST be visual-heavy (app-icon-cloud, data-flow-network, dashboard-deconstructed, metrics-dashboard, icon-showcase). Don't fill the middle with text-only scenes.",
		"",
		"### Impact beats (spread throughout, 2-4 scenes)",
		"- `impact-word` (1-3 words at 280px+)",
		"- `stacked-hierarchy` (multi-size text)",
		"- `outline-hero` (hollow stroke text)",
		"- `echo-hero` (motion blur text for stats)",
		"- `radial-vortex` (concentric text)",
		"",
		"### Closing (1 scene)",
		"- `cta` (product name + button)",
		"",
		"## ABSOLUTE RULES",
		"1. NEVER use `hero-text` for more than 2 scenes — it's the boring fallback",
		"2. NO TWO CONSECUTIVE SCENES with the same type",
		"3. Use AT LEAST 10 DIFFERENT scene types across the video",
		"4. For `ghost-hook` — you can use the SAME type multiple times in a row because it's building one sentence across scenes",
		"5. Every scene type has specific data fields — populate them properly, don't leave them empty",
		"6. VARIANTS: For scene types with variants (data-flow-network, before-after, metrics-dashboard, word-slot-machine), ALWAYS set a `variant` field. NEVER use the same variant twice in one video — pick DIFFERENT variants each time the type appears. This is critical for visual variety.",
		"",
		"Return ONLY the JSON.",
	].join("\n");

	const systemPrompt = [
		"You are a Senior Creative Director at a top motion design agency (Buck, Ordinary Folk, ManvsMachine).",
		"You write scene plans for cinematic product videos that TELL STORIES, not list features.",
		"",
		"Your videos make people FEEL something — curiosity, tension, relief, desire.",
		"Every headline you write is punchy, emotional, and under 7 words.",
		"BAD: 'Comprehensive Analytics Dashboard Solution'",
		"GOOD: 'See everything. Miss nothing.'",
		"",
		"You never open with the product name. You open with the VIEWER'S problem.",
		"You create emotional contrast: problem scenes feel heavy/dark, solution scenes feel light/clean.",
		"You ensure every scene has ONE clear purpose and ONE visual focal point.",
		"",
		"Output ONLY valid JSON, no explanation.",
	].join("\n");

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

		// Attach brand assets (not something the AI generates)
		if (brand?.logoUrl) {
			plan.logoUrl = brand.logoUrl;
		}

		// Capture website URL for the outro
		if (opts?.websiteUrl) {
			plan.websiteUrl = opts.websiteUrl.replace(/^https?:\/\//, "");
		}

		// ── Ensure the last scene is always a branded CTA/outro ──
		// If the AI didn't end with a CTA, append one. This guarantees every
		// video has a branded outro with the product name.
		const lastScene = plan.scenes[plan.scenes.length - 1];
		if (lastScene?.type !== "cta") {
			plan.scenes.push({
				type: "cta",
				headline: productName,
				subtitle: plan.websiteUrl || undefined,
				background: "brand-dark",
				animation: "blur-in",
				font: "sans-serif",
				fontSize: 120,
				durationFrames: 75,
				effects: [],
				backgroundEffect: "aurora",
				transitionOut: "fade",
			});
		}

		return { plan };
	} catch (err) {
		return { plan: null, error: `Scene plan generation failed: ${err}` };
	}
}
