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
import type { DemoModeId } from "./demoModes";
import type { ScenePlan, ScenePlanItem } from "./scenePlan";
import { compileScenePlan, expandSceneToLayers } from "./scenePlanCompiler";
import { generateScenePlan } from "./scenePlanGenerator";

// ── Types ────────────────────────────────────────────────────────────────

export interface AiCompositionResult {
	/** The generated React/TSX code */
	code: string;
	/** Screenshot data URLs to pass as props */
	screenshots: string[];
	/** The editable scene plan (if plan-based generation was used) */
	plan?: ScenePlan;
	/** Any error during generation */
	error?: string;
	/** Music path if early generation completed during the pipeline */
	earlyMusicPath?: string;
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
		/** Video type template — controls narrative arc, scene mix, and pacing */
		videoType?: DemoModeId;
		/** User's original prompt/brief describing what the video should focus on */
		userBrief?: string;
		/** Website URL being demoed */
		websiteUrl?: string;
		/** Full content extracted from the landing page */
		landingPageContent?: {
			headings?: Array<{ tag: string; text: string }>;
			stats?: string[];
			features?: string[];
			fullText?: string;
		};
		/** When true, generate AI video clips for hero scenes */
		includeVideoClips?: boolean;
	},
): Promise<AiCompositionResult> {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const title = opts?.title || "Product Demo";
	const brand = opts?.brand;

	// The plan-based path is RE-ENABLED because the compiler now dispatches to rich
	// scene-type templates (ghost-hook, notification-chaos, before-after, metrics-dashboard,
	// icon-showcase, logo-reveal, typewriter-prompt, product-glow, stacked-hierarchy, etc).
	// Each scene type emits a fully-realized JSX template using our component library,
	// AND every value (headlines, durations, backgrounds, metric values) is editable
	// via the structured plan UI. This gives us BOTH variety AND editability.
	const USE_PLAN_PATH = true;

	if (USE_PLAN_PATH && !opts?.instructions) {
		opts?.onStatus?.("Planning your cinematic video...");
		try {
			const planResult = await generateScenePlan(stepsWithScreenshots, {
				title,
				brand,
				onStatus: opts?.onStatus,
				videoType: opts?.videoType,
				userBrief: opts?.userBrief,
				websiteUrl: opts?.websiteUrl,
				landingPageContent: opts?.landingPageContent,
				includeVideoClips: opts?.includeVideoClips,
			});

			if (planResult.plan) {
				// Start music generation in parallel with review + compilation.
				// By the time the editor opens, music is ready or nearly done.
				let earlyMusicPath: string | undefined;
				if (planResult.plan.musicMood) {
					const totalMs = planResult.plan.scenes.reduce(
						(sum, s) => sum + ((s.durationFrames || 90) / 30) * 1000,
						0,
					);
					const durationSec = Math.round(totalMs / 1000);
					opts?.onStatus?.("Generating background music...");
					// Fire and forget — don't block the pipeline
					const musicPromise = window.electronAPI
						?.aiGenerateMusic(planResult.plan.musicMood, undefined, durationSec)
						.then((result) => {
							if (result.success && result.audioPath) {
								earlyMusicPath = result.audioPath;
								console.log("[AI] Early music ready:", result.audioPath);
							}
						})
						.catch(() => {
							// Music failed — no problem, user can generate later
						});
					// Don't await — let it run in parallel
					void musicPromise;
				}

				opts?.onStatus?.("Creative director reviewing the story arc...");
				const reviewedPlan = await reviewScenePlan(planResult.plan, opts?.onStatus);
				// ── AI Video Clip Generation (Phase 3: Hybrid) ──
				// If any scenes have videoPrompt, generate video clips via MiniMax
				// and set videoClipPath so the compiler renders <Video> elements.
				const allVideoScenes = reviewedPlan.scenes
					.map((s, i) => ({ scene: s, index: i }))
					.filter(({ scene }) => scene.videoPrompt);
				// Cap at 3 video clips max to control cost and generation time
				const videoScenes = allVideoScenes.slice(0, 3);
				// Clear videoPrompt on excess scenes so they render as motion graphics
				for (const { scene } of allVideoScenes.slice(3)) {
					scene.videoPrompt = undefined;
				}

				if (videoScenes.length > 0 && window.electronAPI?.aiGenerateVideoBatch) {
					opts?.onStatus?.(
						`Generating ${videoScenes.length} AI video clip${videoScenes.length > 1 ? "s" : ""}... this may take a few minutes`,
					);
					try {
						const clips = videoScenes.map(({ scene, index }) => ({
							prompt: scene.videoPrompt!,
							sceneIndex: index,
							durationSec: 6, // MiniMax supports 6s or 10s only
						}));
						const results = await window.electronAPI.aiGenerateVideoBatch(clips);
						for (const { sceneIndex, result } of results) {
							if (result.success && result.videoPath) {
								// Convert local file to blob URL so Remotion can seek through it
								// (Remotion needs seekable media — custom protocols don't support range requests)
								try {
									const fileResult = await window.electronAPI.readBinaryFile(result.videoPath);
									if (fileResult?.success && fileResult.data) {
										const blob = new Blob([new Uint8Array(fileResult.data)], { type: "video/mp4" });
										const blobUrl = URL.createObjectURL(blob);
										reviewedPlan.scenes[sceneIndex].videoClipPath = blobUrl;
									} else {
										// Fallback to lucid:// protocol
										reviewedPlan.scenes[sceneIndex].videoClipPath = result.videoPath;
									}
								} catch {
									reviewedPlan.scenes[sceneIndex].videoClipPath = result.videoPath;
								}
								// Ensure scene duration matches video clip (6s = 180 frames)
								reviewedPlan.scenes[sceneIndex].durationFrames = 180;
								console.log(`[AI] Video clip ready for scene ${sceneIndex}: ${result.videoPath}`);
							} else {
								console.warn(`[AI] Video clip failed for scene ${sceneIndex}: ${result.error}`);
								// Clear the prompt so compiler falls back to motion graphics
								reviewedPlan.scenes[sceneIndex].videoPrompt = undefined;
							}
						}
					} catch (err) {
						console.warn("[AI] Video batch generation failed, falling back to motion graphics:", err);
						// Clear all video prompts so compiler uses normal rendering
						for (const { scene } of videoScenes) {
							scene.videoPrompt = undefined;
						}
					}
				}

				opts?.onStatus?.("Compiling scene plan to video code...");
				normalizePlan(reviewedPlan);
				const code = compileScenePlan(reviewedPlan);
				return {
					code,
					screenshots: stepsWithScreenshots.map((s) => s.screenshotDataUrl!),
					plan: reviewedPlan,
					earlyMusicPath,
				};
			}
			opts?.onStatus?.("Plan generation failed, trying direct code generation...");
		} catch {
			// Fall through to direct code generation
		}
	}

	// ── Direct code generation (fallback or when instructions provided) ──
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

		// ── Creative Director Review: critique → gate → rewrite ──
		opts?.onStatus?.("Creative director critiquing your video...");

		// Step 1: Critique — get honest score + specific issues
		const critiquePrompt = [
			CRITIQUE_PROMPT,
			"",
			"## CODE TO CRITIQUE",
			"Extract the scene headlines, animations, backgrounds, and overall arc from this code.",
			"Then evaluate the story, design, and persuasion impact.",
			"",
			code,
		].join("\n");

		let finalCode = code;

		try {
			const critiqueResult = await window.electronAPI.aiAnalyze(
				critiquePrompt,
				"You are a creative director. Output ONLY valid JSON critique. No markdown.",
			);

			if (critiqueResult?.success && critiqueResult.text) {
				let critiqueJson = critiqueResult.text.trim();
				const fm = critiqueJson.match(/```(?:json)?\s*\n([\s\S]*?)```/);
				if (fm) critiqueJson = fm[1].trim();

				const critique = JSON.parse(critiqueJson) as CreativeCritique;
				opts?.onStatus?.(
					`Critique: ${critique.score}/10 — narrative: ${critique.narrative.score}, design: ${critique.design.score}`,
				);

				// Gate: only rewrite if score < 8
				if (critique.score < 8) {
					opts?.onStatus?.(`Score ${critique.score}/10 — rewriting for impact...`);

					const rewritePrompt = [
						"You are a creative director REWRITING Remotion React code based on a critique.",
						"Fix the specific problems identified. REWRITE headlines to be emotional and punchy.",
						"",
						"## CRITIQUE",
						`Overall: ${critique.score}/10`,
						`Narrative: ${critique.narrative.issues.join("; ")}`,
						`Design: ${critique.design.issues.join("; ")}`,
						`Persuasion: ${critique.persuasion.issues.join("; ")}`,
						"Scene fixes:",
						...critique.sceneNotes.map((n) => `- Scene ${n.scene}: ${n.issue} → ${n.fix}`),
						"",
						"## RULES",
						"- Rewrite headlines: emotional, 5-7 words, no corporate jargon",
						"- Opening must address VIEWER'S problem, not product name",
						"- Add emotional contrast: problem = dark/tense, solution = light/clean",
						"- Use 6+ different animation types across scenes",
						"- Ensure a transformation moment before CTA",
						"- Fix any technical issues (small text, repetitive animations, etc.)",
						"",
						"Output ONLY the fixed code. No explanations.",
						"",
						"CODE TO REWRITE:",
						code,
					].join("\n");

					const rewriteResult = await window.electronAPI.aiAnalyze(
						rewritePrompt,
						"You rewrite Remotion code to be more compelling. Output ONLY React code, no explanations.",
					);

					if (rewriteResult?.success && rewriteResult.text) {
						const rewritten = extractCode(rewriteResult.text);
						if (rewritten && rewritten.length > code.length * 0.5) {
							finalCode = rewritten;
							opts?.onStatus?.("Rewrite complete — story and design improved");
						}
					}
				} else {
					opts?.onStatus?.("Score 8+ — approved by creative director");
				}
			}
		} catch {
			opts?.onStatus?.("Creative review skipped — using original");
		}

		// Synthesize a read-only scene plan from the generated code so the
		// timeline and scenes tab in the editor have something to show.
		const syntheticPlan = synthesizePlanFromCode(
			finalCode,
			brand?.primaryColor || "#2563eb",
			title,
		);

		return {
			code: finalCode,
			screenshots: stepsWithScreenshots.map((s) => s.screenshotDataUrl!),
			plan: syntheticPlan,
		};
	} catch (err) {
		return {
			code: "",
			screenshots: [],
			error: `AI generation failed: ${err}`,
		};
	}
}

// ── Synthetic Plan Extraction ─────────────────────────────────────────
// Parses a generated Remotion composition and extracts scene boundaries
// (durationInFrames + visible text) into a read-only ScenePlan so the
// editor's timeline/scenes tab can display the structure.

function synthesizePlanFromCode(code: string, accentColor: string, title: string): ScenePlan {
	const scenes: ScenePlanItem[] = [];

	// Find all Sequence/TransitionSeries.Sequence blocks with durationInFrames
	// Matches: <Sequence from={X} durationInFrames={Y}>
	//          <TransitionSeries.Sequence durationInFrames={Y}>
	const seqRegex =
		/(?:TransitionSeries\.Sequence|Sequence)[^>]*durationInFrames=\{([^}]+)\}[^>]*>/g;

	// Extract all scene duration values (as expressions/numbers)
	const durations: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = seqRegex.exec(code)) !== null) {
		durations.push(match[1].trim());
	}

	if (durations.length === 0) {
		// No sequences found — create one scene for the entire video
		return {
			title,
			accentColor,
			scenes: [
				{
					type: "hero-text",
					headline: title,
					background: "black",
					animation: "chars",
					font: "sans-serif",
					fontSize: 120,
					durationFrames: 90,
					effects: [],
				},
			],
		};
	}

	// Try to resolve numeric durations via simple const extraction
	// e.g. const S1 = 52; const S2 = 54; etc.
	const constMap = new Map<string, number>();
	const constRegex = /const\s+(S\d+|[A-Z_][A-Z0-9_]*)\s*=\s*(\d+)\s*;/g;
	let constMatch: RegExpExecArray | null;
	while ((constMatch = constRegex.exec(code)) !== null) {
		constMap.set(constMatch[1], Number.parseInt(constMatch[2], 10));
	}

	const resolveDuration = (expr: string): number => {
		if (/^\d+$/.test(expr)) return Number.parseInt(expr, 10);
		if (constMap.has(expr)) return constMap.get(expr)!;
		// Fall back to average scene length
		return 60;
	};

	// Extract headlines from the code — look for text={...} props and string literals
	// that appear to be headlines (5-80 chars, not code identifiers)
	const headlines: string[] = [];
	// Match: text="..." or text={"..."} or text={`...`} in component props
	const textRegex = /text=(?:"([^"]{4,80})"|\{"([^"]{4,80})"\}|\{`([^`]{4,80})`\})/g;
	let textMatch: RegExpExecArray | null;
	while ((textMatch = textRegex.exec(code)) !== null) {
		const headline = textMatch[1] || textMatch[2] || textMatch[3];
		if (headline && !headline.includes("${") && !/^[a-z][A-Za-z]*$/.test(headline)) {
			headlines.push(headline);
		}
	}

	// Build a scene per Sequence, pairing with extracted headlines if available
	for (let i = 0; i < durations.length; i++) {
		const durationFrames = resolveDuration(durations[i]);
		const headline = headlines[i] || `Scene ${i + 1}`;
		const isLight = i % 2 === 0;
		scenes.push({
			type: "hero-text",
			headline,
			background: isLight ? "cream" : "black",
			animation: "chars",
			font: isLight ? "serif" : "sans-serif",
			fontSize: 120,
			durationFrames,
			effects: [],
		});
	}

	return { title, accentColor, scenes, readonly: true };
}

// ── Code Patching for In-Place Edits ────────────────────────────────────
//
// When the user edits a headline, duration, or background in the scenes
// panel for an AI-generated video, we do a targeted string replacement in
// the original code rather than recompile from a plan template. This keeps
// all the AI's custom components intact and only updates the specific value.

/**
 * Replace a headline string in generated code with a new value.
 * Searches for the old headline (wrapped in quotes) and replaces it verbatim.
 * Only replaces the first occurrence to avoid accidentally rewriting other
 * scenes that happen to share the same text.
 */
export function patchHeadline(code: string, oldHeadline: string, newHeadline: string): string {
	if (!oldHeadline || oldHeadline === newHeadline) return code;
	// Escape regex metacharacters in the old headline
	const escaped = oldHeadline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Escape single and double quotes + backslashes in the new headline
	const safeNew = newHeadline.replace(/[\\"']/g, "\\$&");
	// Try double-quoted first, then single-quoted, then backtick
	const doubleRe = new RegExp(`"${escaped}"`);
	const singleRe = new RegExp(`'${escaped}'`);
	const backtickRe = new RegExp(`\`${escaped}\``);
	if (doubleRe.test(code)) return code.replace(doubleRe, `"${safeNew}"`);
	if (singleRe.test(code)) return code.replace(singleRe, `'${safeNew}'`);
	if (backtickRe.test(code)) return code.replace(backtickRe, `\`${safeNew}\``);
	return code;
}

/**
 * Replace a scene's durationInFrames value in generated code.
 * Handles both literal numbers and named constants (S1, S2, etc.)
 */
export function patchSceneDuration(code: string, sceneIndex: number, newDuration: number): string {
	// Find the Nth TransitionSeries.Sequence or <Sequence with durationInFrames
	const seqRegex = /(?:TransitionSeries\.Sequence|<Sequence)[^>]*durationInFrames=\{([^}]+)\}/g;
	const matches: Array<{ full: string; expr: string; index: number }> = [];
	let m: RegExpExecArray | null;
	while ((m = seqRegex.exec(code)) !== null) {
		matches.push({ full: m[0], expr: m[1].trim(), index: m.index });
	}
	if (sceneIndex < 0 || sceneIndex >= matches.length) return code;
	const target = matches[sceneIndex];

	// If the duration is a named constant (like S1), patch the const declaration
	if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(target.expr)) {
		const constRe = new RegExp(`(const\\s+${target.expr}\\s*=\\s*)\\d+`);
		if (constRe.test(code)) {
			return code.replace(constRe, `$1${newDuration}`);
		}
	}

	// Otherwise patch the literal in the Sequence tag
	const replaced = target.full.replace(
		/durationInFrames=\{[^}]+\}/,
		`durationInFrames={${newDuration}}`,
	);
	return code.slice(0, target.index) + replaced + code.slice(target.index + target.full.length);
}

/**
 * Replace a scene's background by finding the Nth Scene component and
 * updating its bg prop. Supports "cream", "black", "navy", named constants,
 * or raw color strings.
 */
export function patchSceneBackground(code: string, sceneIndex: number, newBg: string): string {
	const presetMap: Record<string, string> = {
		white: "#fafafa",
		cream: "#fef5ed",
		black: "#050505",
		charcoal: "#1a1a1a",
		navy: "linear-gradient(180deg, #0a0f1e 0%, #050810 100%)",
		"brand-dark": "linear-gradient(135deg, #0a0a1a 0%, #0d1a2e 100%)",
		"deep-purple": "linear-gradient(180deg, #0f0520 0%, #050210 100%)",
	};
	const resolved = presetMap[newBg] || newBg;
	const safeNew = resolved.replace(/[\\"']/g, "\\$&");

	// Find all <Scene ... bg={...}> or <Scene ... bg="..."> occurrences in order
	const sceneRe =
		/<Scene\b[^>]*bg=(?:"([^"]*)"|\{'([^']*)'\}|\{"([^"]*)"\}|\{`([^`]*)`\}|\{([A-Za-z_][A-Za-z0-9_]*)\})[^>]*>/g;
	const matches: Array<{ full: string; index: number }> = [];
	let m: RegExpExecArray | null;
	while ((m = sceneRe.exec(code)) !== null) {
		matches.push({ full: m[0], index: m.index });
	}
	if (sceneIndex < 0 || sceneIndex >= matches.length) return code;
	const target = matches[sceneIndex];
	const replaced = target.full.replace(
		/bg=(?:"[^"]*"|\{'[^']*'\}|\{"[^"]*"\}|\{`[^`]*`\}|\{[A-Za-z_][A-Za-z0-9_]*\})/,
		`bg="${safeNew}"`,
	);
	return code.slice(0, target.index) + replaced + code.slice(target.index + target.full.length);
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
		"- TransitionSeries — like Series but with transitions between scenes",
		"- linearTiming({ durationInFrames }) — linear transition timing",
		"- springTiming({ config }) — spring-based transition timing",
		"- fade() — fade transition presentation",
		"- slide() — slide transition presentation",
		"- wipe() — wipe transition presentation",
		"",
		"## Scene Transitions (USE TransitionSeries for professional scene changes)",
		"",
		"Instead of hard cuts, use TransitionSeries with fade/slide/wipe between scenes:",
		"<TransitionSeries>",
		"  <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES}>",
		"    <Scene bg='#fff'>...</Scene>",
		"  </TransitionSeries.Sequence>",
		"  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />",
		"  <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES}>",
		"    <Scene bg='#050505'>...</Scene>",
		"  </TransitionSeries.Sequence>",
		"</TransitionSeries>",
		"",
		"Mix transition types: fade between similar scenes, slide for energy, wipe for reveals.",
		"Keep transitions short: 8-12 frames. Longer transitions feel sluggish.",
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
		"- animation: 'chars' (per-character spring) | 'words' (word-by-word slam) | 'scale' (scale up from center) | 'clip' (clip-path reveal) | 'typewriter' (character-by-character with cursor — great for tech/code feel) | 'staccato' (dopamine pop: 0→120%→100% per word — rhythmic, punchy) | 'split' (words fly in from edges to center — dramatic reveals) | 'drop' (letters drop from above with spring — playful) | 'scramble' (random chars resolve to text — hacker/tech aesthetic) | 'blur-in' (blur to focus) | 'bounce' (bouncy words) | 'wave' (sine wave motion) | 'none'",
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
		"### GradientText — animated shimmer/gradient text (Apple/Linear style)",
		"<GradientText text='Revolutionary' fontSize={140} colors={['#ff6b6b','#feca57','#48dbfb','#ff9ff3','#ff6b6b']} speed={4} />",
		"- Colors sweep across text with rotating gradient. High-impact for hero slides.",
		"",
		"### ClipReveal — reveal children through expanding shapes",
		"<ClipReveal shape='circle' delay={5}><Scene bg='#050505'>...</Scene></ClipReveal>",
		"- shape: 'circle' | 'wipe' | 'diamond' | 'iris'. Use on OPENING scene for dramatic reveal.",
		"",
		"### LightStreak — cinematic lens flare overlay",
		"<LightStreak startFrame={20} durationFrames={25} color='rgba(255,200,100,0.8)' />",
		"- Add inside any scene for a sweeping light effect. Great during transitions.",
		"",
		"### GlitchText — chromatic aberration glitch entrance",
		"<GlitchText text='Disrupting' fontSize={120} intensity={0.8} durationFrames={12} delay={5} />",
		"- Text appears through a glitch/distortion effect, then snaps clean. High-energy tech feel.",
		"",
		"### Vignette — cinematic edge darkening overlay",
		"<Vignette intensity={0.5} />",
		"",
		"### FloatingOrbs — premium depth background with slow-moving color blobs",
		"<FloatingOrbs colors={['#2563eb','#7c3aed','#06b6d4']} count={3} opacity={0.3} blurAmount={120} />",
		"- Place INSIDE a <Scene> as a background layer. Creates an Apple/Linear premium feel.",
		"- Pairs beautifully with dark backgrounds. Use on 1-2 key scenes.",
		"",
		"### IconGrid — sequential pop-in grid of feature icons/emoji",
		"<IconGrid items={[{icon:'⚡',label:'Fast'},{icon:'🔒',label:'Secure'},{icon:'🎯',label:'Precise'}]} columns={3} delay={10} />",
		"- Use for feature overview scenes instead of cards. Max 6-9 items. Icons pop in with staccato spring.",
		"",
		"### Divider — animated horizontal line reveal",
		"<Divider color='rgba(255,255,255,0.2)' width={200} delay={10} />",
		"- Use between headline and subtitle for visual separation. Scales from center.",
		"",
		"### GlowFrame — brand-gradient glow aura around children (Lovable/Vercel style)",
		"<GlowFrame colors={[ACCENT, '#ff6b35', '#a855f7']} intensity={1.2}><Img src={screenshots[0]} /></GlowFrame>",
		"- Wraps any element in a signature glowing aura with the brand gradient as a light source.",
		"- THIS is how to make screenshots look premium instead of flat. Use on ANY product shot.",
		"- Combine with transform:rotate(-3deg) for a tilted hero moment.",
		"",
		"### TypewriterInput — isolated hero prompt input with animated cursor (the 'magic moment')",
		"<TypewriterInput placeholder='Create a social shopping marketplace' width={900} glowColors={[ACCENT, '#ff6b35', '#a855f7']} />",
		"- Mirrors the Lovable/Cursor/v0 'prompt being typed' pattern.",
		"- Use ON A BLACK BACKGROUND for maximum contrast with the glow.",
		"- This is THE most effective product hero moment for AI/prompt-based tools.",
		"",
		"### GhostSentence — sentence fragmentation with 'ghost future words' (the Venture/Lovable signature)",
		"<GhostSentence words={['Let\\'s', 'make', 'it', 'happen']} activeIndex={2} fontSize={160} />",
		"- Future unrevealed words show in 15% opacity, then animate to 100% when activeIndex reaches them",
		"- Use 4-6 scenes in a row, incrementing activeIndex each scene — builds the sentence dramatically",
		"- This is THE pattern for hooks. Use it over isolated headlines whenever possible.",
		"",
		"### WordSlotMachine — vertical word list with one bolded ('Whatever your X is')",
		"<WordSlotMachine prefix='Your' checkmark={true} words={['Product','App','Agency','Story']} selectedIndex={1} fontSize={140} accentColor={ACCENT} />",
		"- Shows multiple audience/use-case options with ONE bolded, others faded",
		"- Great for 'speaks to everyone' messaging. Use once per video.",
		"",
		"### AvatarConstellation — scattered gradient avatar cards around a claim",
		"<AvatarConstellation avatarCount={8}><AnimatedText text='Trusted by thousands' fontSize={120} /></AvatarConstellation>",
		"- Social proof pattern. 8 floating gradient cards with emoji avatars orbit the text.",
		"- Dark background. Use ONCE per video for proof/social proof scenes.",
		"",
		"### ViewfinderFrame — camera viewfinder corner brackets",
		"<ViewfinderFrame color='#1a1a1a'><Scene bg='#fef5ed'>...</Scene></ViewfinderFrame>",
		"- Treats the scene like a camera shot. Adds editorial/premium weight.",
		"- Use on 1-2 key scenes (opening or product reveal) for dramatic framing.",
		"",
		"## Tier 1: Advanced Scene Patterns (from motion design agencies)",
		"",
		"### NotificationCloud — THE pattern for 'overwhelm' problem scenes",
		"<NotificationCloud notifications={[",
		"  {platform:'instagram', title:'Mike Stones', subtitle:'WoW!', time:'5m'},",
		"  {platform:'linkedin', title:'Unread notifications', subtitle:'You have 1 notification', time:'now'},",
		"  {platform:'youtube', title:'YouTube', subtitle:'New video from Matt', time:'5m'},",
		"  {platform:'twitter', title:'Tibo @tibo_maker', subtitle:'Just shipped...', time:'2h'}",
		"]}><AnimatedText text='Notifications everywhere.' fontSize={130} color='#fff' /></NotificationCloud>",
		"- 6-8 recreated notification cards scattered around central headline. Platforms: instagram|linkedin|twitter|youtube|email|slack|generic",
		"- USE THIS for any 'problem/overwhelm' scene. It's THE pattern from PostSyncer/top SaaS videos.",
		"",
		"### ChatMessageFlow — progressive chat UI showing problem escalation",
		"<ChatMessageFlow channel='dev-squad' channels={['general','marketing','dev-squad','sales']} users={['Alex','Maria','Tom']} messages={[",
		"  {user:'Sienna', time:'07:44 AM', text:'guys... users can\\'t sign up'},",
		"  {user:'Peter', time:'07:45 AM', text:'@Viktor is our prod down?'}",
		"]} />",
		"- Slack-like dark UI. Messages appear progressively. Great for narrative problem scenes.",
		"",
		"### StackedText — multi-line with dramatic size hierarchy",
		"<StackedText lines={[{text:'WHY SETTLE', size:90}, {text:'FOR', size:110}, {text:'LESS', size:280}]} color='#050505' />",
		"- Multi-line where key word is MASSIVE. Each line can have different size. Use for punch closings.",
		"- Example: 'With over' (80) / '60' (220) / 'page sections' (100)",
		"",
		"### GradientMesh — soft pastel mesh background with bokeh dots",
		"<AbsoluteFill><GradientMesh colors={['#ffd6e7','#e0d4ff','#d4fff1','#ffefd6']} /><Scene>...</Scene></AbsoluteFill>",
		"- Premium ethereal background. Pair with dark charcoal text for TriNet/Notion-level softness.",
		"- Great alternative to solid backgrounds for 'premium SaaS' feel.",
		"",
		"## Tier 2: Specialized scene patterns",
		"",
		"### FloatingAppIcon — massive 3D-style app icon for 'solution delivered' moments",
		"<FloatingAppIcon icon='PDF' color='#ef4444' size={300} rotation={-8} />",
		"- Use as an overlay on a chat/product scene when showing a file/deliverable appearing.",
		"",
		"### BlurredUI — animated blur for 'unclear/overwhelm' transition scenes",
		"<BlurredUI blurFrom={25} blurTo={0} duration={30}><ChatMessageFlow ... /></BlurredUI>",
		"- Wraps any UI with animated blur. Great for problem/confusion → clarity transitions.",
		"",
		"### DashboardGrid — deconstructed dashboard with floating metric cards",
		"<DashboardGrid metrics={[",
		"  {label:'Users', value:'16,891', delta:'+25%'},",
		"  {label:'Storage', value:'123 TB', delta:'+25% in 90 days'},",
		"  {label:'Revenue', value:'$2.4M', delta:'+12%'}",
		"]} showChart={true} />",
		"- NEVER show a flat dashboard screenshot. Use this to extract 3-4 key metrics as floating cards with a chart line connecting them. From Box Corporate.",
		"",
		"### CredibilityLogos — brand partner/customer logos row",
		"<CredibilityLogos logos={['MAYO CLINIC','STRIPE','LINEAR','VERCEL']} eyebrow='Trusted by' color='#888' />",
		"- Social proof row. Uses text for logo names (can be swapped for Img when real assets available).",
		"",
		"### CharacterCardRow — 4 uniform cards for variations/options",
		"<CharacterCardRow items={[",
		"  {emoji:'⚡', label:'Fast', bg:'linear-gradient(135deg,#fbbf24,#f59e0b)'},",
		"  {emoji:'🔒', label:'Secure', bg:'linear-gradient(135deg,#3b82f6,#1e40af)'},",
		"  {emoji:'🎯', label:'Precise', bg:'linear-gradient(135deg,#10b981,#059669)'},",
		"  {emoji:'✨', label:'Magic', bg:'linear-gradient(135deg,#ec4899,#be185d)'}",
		"]} />",
		"- Uniform vertical cards with emoji/image + label. For showing variations, pillars, or benefits.",
		"",
		"### CornerTriangleFrame — 4 brand-colored corner triangles",
		"<CornerTriangleFrame color='#e0d4ff' size={90}><Scene bg='#050505'>...</Scene></CornerTriangleFrame>",
		"- Alternative to ViewfinderFrame. Solid triangles in corners for 'branded frame' closing scenes.",
		"",
		"## Tier 3: Advanced typography (CSS-based)",
		"",
		"### OutlineText — stroke-only (hollow) typography",
		"<OutlineText text='AVERAGE' fontSize={280} strokeWidth={3} color='#ffffff' />",
		"- Hollow text with only a stroke, no fill. Editorial/architectural feel. Great for manifesto scenes.",
		"",
		"### RadialTextVortex — concentric rings of spiraling text",
		"<RadialTextVortex text='GOOD ENOUGH' rings={5} baseFontSize={80} color='#ffffff' />",
		"- Repeating text in concentric spiral rings creating a vortex/tunnel. Dramatic opening statement.",
		"",
		"### EchoText — text with motion-blur echo trail",
		"<EchoText text='33% time' fontSize={220} colors={['#4338ca','#a855f7','#ec4899']} echoCount={3} maxOffset={80} />",
		"- Text with blurred ghost copies at offsets creating a zoom-in motion trail. Use on impact stats.",
		"",
		"## Tilted Product UI (use for EVERY screenshot/recreated UI)",
		"",
		"<GlowFrame perspectiveX={15} perspectiveY={-5} colors={[ACCENT, '#ff6b35', '#a855f7']}>",
		"  <div style={{ width: 1200, padding: 40, background: '#fff', borderRadius: 16 }}>...mocked UI...</div>",
		"</GlowFrame>",
		"- perspectiveX: tilt forward (positive) or back (negative), -25 to 25 degrees",
		"- perspectiveY: tilt left/right, -25 to 25 degrees",
		"- NEVER show flat screenshots. Always wrap in GlowFrame with perspective.",
		"",
		"### WordCarousel — cycles through words with flip animation",
		"<WordCarousel words={['Fast','Smart','Easy']} prefix='Make it' fontSize={120} accentColor='#2563eb' />",
		"- Great for showing multiple product benefits in one scene.",
		"",
		"### MetricCounter — large animated number counting up",
		"<MetricCounter value={99} label='Uptime' suffix='%' fontSize={96} />",
		"- Use for stats, pricing, metrics. Number animates from 0 to target.",
		"",
		"### ProgressBar — animated horizontal bar with label",
		"<ProgressBar label='Performance' value={95} color='#2563eb' delay={10} />",
		"- Stack 2-3 vertically for a data visualization scene.",
		"",
		"## IMPORTANT: Quality principles",
		"- OPENING scene should be dramatic: use GradientText OR ClipReveal wrapping AnimatedText.",
		"- Use effects SPARINGLY — one GlitchText entrance, one LightStreak max. Overuse looks cheap.",
		"- Vignette only on 1-2 dark scenes. Not every scene needs an effect.",
		"- Mix AnimatedText animation modes (chars, words, scale, clip) — never repeat the same mode twice in a row.",
		"- LESS IS MORE. Clean, bold typography with breathing room beats cluttered effects.",
		"- DO NOT redefine any helper component — they are already provided in scope.",
		"",
		"## Audio-Reactive Animations (when music is playing)",
		"",
		"If music is present, you can make elements react to the beat:",
		"",
		"### useAudioPulse() — hook returning per-frame energy",
		"const { bass, mid, high, overall, active } = useAudioPulse();",
		"- bass/mid/high/overall: 0-1 values representing frequency band energy",
		"- active: true if audio data is available",
		"- Use bass to drive scale, opacity, or glow on key elements",
		"- Example: const scale = 1 + bass * 0.1; // subtle 10% pulse on beat",
		"",
		"### AudioPulse — wrapper that scales children on beat",
		"<AudioPulse intensity={0.08} band='bass'><AnimatedText ... /></AudioPulse>",
		"- Wrap ANY element to make it pulse with the music",
		"- intensity: 0-1 (0.05-0.1 is subtle, 0.2+ is dramatic)",
		"- band: 'bass' | 'mid' | 'high' | 'overall'",
		"",
		"### BeatDot — pulsing glow indicator",
		"<BeatDot color={ACCENT} position='bottom-right' />",
		"- Small dot that glows and scales with bass. Adds life to any scene.",
		"",
		"USAGE GUIDELINES:",
		"- Use AudioPulse on 2-3 key scenes, NOT every scene (subtlety is premium)",
		"- FloatingOrbs + AudioPulse is a great combo for dark hero scenes",
		"- BeatDot works well on CTA/closing scenes",
		"- If useAudioPulse().active is false, elements render normally (safe to always use)",
		"",
		"## Critical Rules",
		"",
		"1. ALL animations MUST use useCurrentFrame(). CSS animations/transitions DO NOT render in Remotion.",
		"2. ALWAYS use interpolate() with both extrapolateLeft:'clamp' AND extrapolateRight:'clamp'.",
		"3. NEVER use Math.random().",
		"4. Export a component called VideoComposition accepting { screenshots: string[] } props.",
		"5. Canvas is 1920x1080 at 30fps.",
		"6. NEVER use literal \\n in text strings. For multi-line text, use SEPARATE AnimatedText or div elements for each line.",
		"6b. NEVER destructure from window.Remotion or window.RemotionTransitions. All names (useCurrentFrame, interpolate, spring, Sequence, TransitionSeries, fade, slide, wipe, linearTiming, springTiming, Easing, etc.) are ALREADY available in scope. Just use them directly. Do NOT write `const { useCurrentFrame } = window.Remotion` — it doesn't exist.",
		"7. MINIMUM font size is 28px for ANY text in the video. No tiny labels, subtitles, or captions below 28px — they are unreadable at video scale. If text is not important enough to be 28px+, don't include it.",
		"6. NEVER import external fonts or CSS files. Use system font stacks only.",
		"",
		"## Typography — THIS IS CRITICAL FOR QUALITY",
		"",
		"For maximum cinematic impact, use two contrasting font treatments:",
		"- CREAM/WARM backgrounds (#fef5ed, #f5f0e8): dark charcoal text (#1a1a1a), BOLD SANS or modern serif",
		"- BLACK (#0a0a0a) or GRADIENT backgrounds: WHITE text (#ffffff), bold sans-serif",
		"- Avoid pure white (#fff) and pure black (#000). Cream + charcoal feels warmer and more premium.",
		"- Font sizes: 120-200px standard. For IMPACT scenes (1-2 words): 220-320px is GREAT.",
		"- EDGE-TO-EDGE typography: for impact words, let the text OVERFLOW the frame edges.",
		"  Set maxWidth to 2200+ or remove the cap entirely. A single word like 'day' or 'Finally' should nearly touch both edges.",
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
		"6. ALWAYS define const SCENE_FRAMES = 90 (2 seconds per scene) and use it consistently.",
		"",
		"## TEXT ANIMATION — 13 MODES, Use with MAXIMUM VARIETY",
		"",
		"AnimatedText has 13 animation modes. Use at least 6 DIFFERENT ones across the video — never repeat the same one twice in a row:",
		"- animation='chars' — per-character spring entrance (hero headlines, cinematic)",
		"- animation='words' — word-by-word slam with scale bounce (punchy statements)",
		"- animation='scale' — scale up from center with fade (single powerful words)",
		"- animation='clip' — clip-path reveal from top (editorial/elegant)",
		"- animation='typewriter' — character-by-character with blinking cursor (tech/code aesthetic, pairs with mono font)",
		"- animation='staccato' — rapid pop 0→120%→100% per word (dopamine rhythm, high energy)",
		"- animation='split' — words fly inward from edges (dramatic reveals, pattern interrupts)",
		"- animation='drop' — letters drop from above with spring bounce (playful, fun)",
		"- animation='scramble' — random characters resolve to text (hacker/cyberpunk aesthetic)",
		"- animation='blur-in' — blur to sharp focus (smooth, premium)",
		"- animation='bounce' — bouncy word entrance with gentle wave after (playful)",
		"- animation='wave' — sine wave motion per character (ambient, flowing)",
		"- animation='gradient' — USE ONLY via <GradientText> component, not AnimatedText",
		"",
		"Mix these with different fontFamily, fontSize, and accentWord for maximum variety.",
		"Example: <Scene bg='#050505'><AnimatedText text='Deploy in seconds.' fontSize={140} color='#fff' animation='staccato' accentWord='seconds' accentColor={ACCENT} /></Scene>",
		"Example: <Scene bg='#f5f0e8'><AnimatedText text='No more guessing.' fontSize={120} color='#050505' animation='typewriter' fontFamily=\"'SF Mono', monospace\" /></Scene>",
		"",
		"## Scene Type Catalog — USE VARIETY, MIX THESE",
		"",
		"### Type IMPACT: Single word or short phrase (use for 3-4 scenes — the MOST IMPORTANT type)",
		"Just 1-3 words. MASSIVE text (180-320px). No subtitle. 45-55 frames.",
		"Examples: 'Finally.' / 'One place.' / 'Zero friction.' / 'Done.' / 'Effortless.'",
		"These create RHYTHM. They're the beats in the music. Without them, the video drags.",
		"For extra impact: use StackedText with varying sizes ('WHY SETTLE / FOR / LESS') or EchoText with motion blur.",
		"",
		"### Type NOTIFICATION-CHAOS: Visualize overwhelm with NotificationCloud",
		"USE NotificationCloud as the problem scene — 6-8 recreated platform notifications scattered with central headline.",
		"This is THE pattern for 'tools overwhelm' / 'information overload' / 'context switching' messaging.",
		"",
		"### Type CHAT-NARRATIVE: Progressive chat UI telling a story",
		"Use ChatMessageFlow for scenes where you want to tell a problem narratively through a messaging interface.",
		"Great for 'team is panicking' / 'urgent request' / 'communication breakdown' scenes.",
		"",
		"### Type PREMIUM-SOFT: Pastel gradient mesh backgrounds",
		"Wrap Scene in GradientMesh for premium soft pastel backgrounds. Perfect for calm/aspirational moments.",
		"Pair with StackedText or AnimatedText for a TriNet/Notion-level feel.",
		"",
		"### Type HERO-COMPONENT: Isolated product element with glow (use for 1 scene — the 'magic moment')",
		"On a BLACK background, place ONE reconstructed UI component dramatized with brand gradient glow.",
		"For AI/prompt products: <TypewriterInput placeholder='...' /> — the input being typed.",
		"For dashboard products: <GlowFrame><div>...custom card...</div></GlowFrame>",
		"This is the 'Lovable moment' — NOT a full screenshot, just the hero element dramatized.",
		"Use ONCE per video, around scene 4-5 (right after the hook/logo reveal).",
		"",
		"### Type GLOW-SHOT: Tilted screenshot in brand glow (use for 1 scene when screenshots are needed)",
		"<div style={{ transform: 'rotate(-3deg)' }}><GlowFrame><Img src={screenshots[0]} /></GlowFrame></div>",
		"NEVER show a flat screenshot. Always tilt (-5 to +5 degrees) and wrap in GlowFrame.",
		"Black background. The screenshot + glow IS the whole scene.",
		"",
		"### Type A: Text-focused headline (use for ~30% of scenes)",
		"Short punchy headline (4-7 words). NO subtitle on most. 60-75 frames.",
		"Pick a DIFFERENT animation style for EACH. Accent one word with brand color.",
		"",
		"### Type B: Recreated UI elements (use for ~15% of scenes)",
		"NEVER crop screenshots. BUILD UI elements from scratch as styled divs:",
		"- Feature cards: dark bg, borderRadius 24, border 1px rgba(255,255,255,0.08). FIXED width (e.g. 420px). Icon circle + bold title + grey subtitle. Stagger entrance per card. overflow:'hidden' on each card.",
		"- Pill buttons: borderRadius 999, dark bg, typewriter text. FIXED width. Centered in container.",
		"- Toggle rows: blue circle indicator + bold white label + grey description. FIXED width (e.g. 600px). Stack vertically with stagger.",
		"",
		"### Type C: Headline + accent detail (use for ~10% of scenes)",
		"Massive centered text with ONE supporting element: animated underline, Divider, or accent bar.",
		"",
		"### Type D: Split layout — text left, visual right (use for ~10% of scenes)",
		"Left half: large bold text (2-4 words). Right half: dark card with feature list or pill buttons. Clean separation.",
		"",
		"### Type E: Browser frame + screenshot (MAX 1 scene in entire video)",
		"Minimal browser chrome (3 dots + address bar) containing one Img screenshot. Use ONCE only.",
		"",
		"### Type G: Data/metrics scene (use for 1 scene)",
		"Dark bg with FloatingOrbs. MetricCounter for a key stat (e.g. '99%' uptime, '10x' faster).",
		"Or stack 2-3 ProgressBars vertically for a comparison/benchmark feel.",
		"",
		"### Type H: Word carousel scene (use for 1 scene)",
		"WordCarousel cycling through key benefits with a shared prefix. Great for 'One platform for [X, Y, Z]' patterns.",
		"",
		"### Type I: Icon grid scene (use for 1 scene)",
		"IconGrid with 6-9 emoji+label items. Fast staggered pop-in. Great for feature overviews, integrations, or capabilities.",
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
		"## Pacing — THIS IS A MUSIC VIDEO, NOT A PRESENTATION",
		"",
		"The #1 problem with AI videos is BORING PACING. Fix it:",
		"",
		"- 14-18 scenes total. FAST CUTS create energy.",
		"- Scene durations MUST VARY — this is what separates agency work from slideshows:",
		"  - IMPACT scenes: 45-55 frames (1.5-1.8s) — 1-3 words, hit hard, cut",
		"  - STANDARD scenes: 60-75 frames (2-2.5s) — short headline with animation",
		"  - BREATHING scenes: 75-90 frames (2.5-3s) — ONLY for cards, data, complex visuals",
		"- NEVER make all scenes the same duration. Vary them.",
		"- At least 4 scenes should have ONLY a headline — NO subtitle. Just bold text, big space.",
		"- At least 2 scenes should be 1-3 WORDS only (e.g. 'Finally.' or 'One place.' or 'Zero friction.')",
		"- Subtitles on MAX 5 scenes total. Most scenes DON'T NEED THEM.",
		"- Rhythm: Short → Short → Standard → Short → Breathing → Short → Standard → Short → CTA",
		"",
		"## Output",
		"",
		"Return ONLY valid React/TypeScript code. No markdown fences, no backtick wrappers, no explanations.",
		"- Self-contained: all helper components defined in the same code",
		"- Export VideoComposition as named export",
		"- Accept { screenshots: string[] } props",
		"- Define scene durations as individual constants (const S1=50, S2=65, S3=50...) and totalDuration as their sum",
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
		"First, CLASSIFY this company and choose the best narrative framework:",
		"- **Problem → Solution → Outcome**: for SaaS, productivity, workflow tools",
		"- **Complexity → Clarity**: for infrastructure, AI, ops, data platforms",
		"- **Old Way → New Way**: for disruptive tools, new categories",
		"- **Trust → Capability → Proof**: for enterprise, security, fintech",
		"",
		"Then structure the video like a MUSIC VIDEO — fast cuts, emotional beats, sparse scenes:",
		"",
		"1. HOOK — use GhostSentence for the signature 'sentence building' pattern:",
		"   Break ONE powerful sentence into 4-6 words. Show 3-5 scenes, each with activeIndex incrementing.",
		"   The future words appear as GHOSTS before becoming bold — builds anticipation.",
		"   Each hook scene: 40-55 frames. Cream bg (#fef5ed), charcoal text (#1a1a1a).",
		"",
		"   Example sentence split: ['Less than', '1% of the world', 'writes software', 'That changes today.']",
		"   Scene 1 (50f): <GhostSentence words={[...]} activeIndex={0} />  // 'Less than' visible, rest ghost",
		"   Scene 2 (50f): <GhostSentence words={[...]} activeIndex={1} />  // 'Less than 1% of the world' visible",
		"   Scene 3 (50f): <GhostSentence words={[...]} activeIndex={2} />  // adds 'writes software'",
		"   Scene 4 (55f): <GhostSentence words={[...]} activeIndex={3} />  // 'That changes today.' punch",
		"",
		"   Other example sentences:",
		"   - ['You spend', '6 hours a day', 'on busywork.', 'Not anymore.']",
		"   - ['Every team', 'has 14 tabs open', 'and zero answers.', 'Until now.']",
		"",
		"   - The last fragment should SET UP the brand reveal that follows",
		"   - Put the PRODUCT LOGO REVEAL on a vibrant brand gradient right after the hook",
		"",
		"2. SHIFT (1-2 scenes, 60-75 frames):",
		"   - Transition from dark to light. The relief moment. 'blur-in' or 'scale'.",
		"   - Product enters. Aspirational, NOT technical. No subtitle needed.",
		"",
		"3. PROOF (3-5 scenes, MIXED durations):",
		"   - Alternate: IMPACT scene (1-2 words, 45 frames) → detail scene (cards/data, 75 frames)",
		"   - One scene with WordCarousel or IconGrid",
		"   - One scene with MetricCounter for a stat",
		"   - Scenes with detected UI elements → recreate as styled cards/pills",
		`   - AT MOST 1 scene with props.screenshots[0]`,
		"",
		"4. TRANSFORMATION (1-2 FAST scenes, 50-60 frames):",
		"   - Show what life looks like AFTER. 'Effortless.' 'Done.' Big word, cut.",
		"",
		`5. CTA (1 scene, 75 frames): "${productName}" + Pill button. Clean white bg. Calm.`,
		"",
		"## CRITICAL PACING RULES",
		"- At least 4 scenes must be IMPACT scenes: 1-3 words only, 45-55 frames, NO subtitle.",
		"- Never put subtitles on more than 5 scenes total.",
		"- Vary durations: SHORT SHORT STANDARD SHORT BREATHING SHORT SHORT CTA.",
		"- After a dense scene (cards), follow with a 1-word impact scene.",
		"- ONE focal point per scene. ONE animation. Don't stack headline + subtitle + cards.",
		"",
		`Accent color ${accentColor} on: underlines, one highlighted word per text scene, card borders, dot indicators.`,
		"",
		"IMPORTANT: Use at least 6 DIFFERENT animation types across the video. The video should feel like a premium motion graphics piece, not a slideshow.",
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

/**
 * Expand scene-level properties (headline, subtitle, cards, effects)
 * into explicit layers. After this, the UI only needs to show layers.
 */
function normalizePlan(plan: ScenePlan): void {
	const accent = plan.accentColor || "#2563eb";
	for (const scene of plan.scenes) {
		// Ensure video clip scenes are long enough for the clip (6s = 180 frames)
		if (scene.videoClipPath && (!scene.durationFrames || scene.durationFrames < 180)) {
			scene.durationFrames = 180;
		}
		// Stamp plan-level assets onto CTA scenes so expandSceneToLayers can create logo/URL layers
		if (scene.type === "cta") {
			(scene as any)._logoUrl = (scene as any)._logoUrl || plan.logoUrl || null;
			(scene as any)._websiteUrl = (scene as any)._websiteUrl || plan.websiteUrl || null;
			// Backfill CTA layers only if pill doesn't exist (first time through new system)
			if (scene.layers && scene.layers.length > 0 && !scene.layers.some((l) => l.id === "cta-pill")) {
				const logoSrc = (scene as any)._logoUrl;
				const urlText = (scene as any)._websiteUrl || plan.websiteUrl;
				if (logoSrc) {
					scene.layers.push({ id: "cta-logo", type: "image", content: logoSrc, position: "center", size: 20, startFrame: 0, endFrame: -1, settings: { fontSize: 60 } });
				}
				scene.layers.push({ id: "cta-pill", type: "button" as any, content: "Get Started", position: "center", size: 30, startFrame: 15, endFrame: -1, settings: { fontSize: 26 } });
				if (urlText) {
					scene.layers.push({ id: "cta-url", type: "text", content: urlText, position: "center", size: 30, startFrame: 10, endFrame: -1, settings: { fontSize: 24, color: "rgba(255,255,255,0.4)", animation: "none" } });
				}
			}
		}
		if (!scene.layers || scene.layers.length === 0) {
			scene.layers = expandSceneToLayers(scene, accent);
		}
	}
}

// ── Creative Director Critique + Rewrite Loop ─────────────────────────

interface CreativeCritique {
	score: number;
	narrative: { score: number; issues: string[] };
	design: { score: number; issues: string[] };
	persuasion: { score: number; issues: string[] };
	sceneNotes: Array<{ scene: number; issue: string; fix: string }>;
}

const CRITIQUE_PROMPT = [
	"You are a Senior Creative Director at Buck / Ordinary Folk / ManvsMachine.",
	"You are NOT checking for correctness. You are checking for SOUL, STORY, and CONVERSION INTENT.",
	"Be brutally honest. A score of 8+ means 'an agency would ship this.' Below 6 means 'this looks AI-generated.'",
	"",
	"## 1. NARRATIVE IMPACT (most important)",
	"- Does the opening create a 'pattern interrupt'? Or does it just say the product name?",
	"- Is there emotional progression? (tension → relief → desire → action)",
	"- Would a viewer think 'I need this' or 'ok, another SaaS tool'?",
	"- Is there a clear 'before vs after' transformation?",
	"- Are headlines emotional and punchy (5-7 words) or corporate jargon?",
	"  BAD: 'Comprehensive Analytics Dashboard' → GOOD: 'See everything. Miss nothing.'",
	"",
	"## 2. VISUAL DESIGN & PACING",
	"- Does each scene have ONE clear focal point?",
	"- Is there visual variety? (7+ animation types, alternating light/dark backgrounds)",
	"- Does pacing alternate? (dense → minimal → dense, never 3 similar scenes in a row)",
	"- Are there IMPACT scenes? (1-3 words, no subtitle, 45-55 frames). Need at least 3-4.",
	"- Are scene durations VARIED? All same duration = instant fail (score 4 or below).",
	"- Does it feel like a music video or a PowerPoint? If every scene is headline+subtitle, score ≤ 5.",
	"- Does it look intentional and composed, or generic?",
	"",
	"## 3. PERSUASION & CONVERSION",
	"- Would someone stop scrolling for this?",
	"- Does the product look desirable, not just functional?",
	"- Is there a clear call to action?",
	"- Does the Problem look 'heavy' and the Solution look 'light'? (emotional contrast)",
	"",
	"## OUTPUT FORMAT (JSON only, no markdown)",
	"{",
	'  "score": 7,',
	'  "narrative": { "score": 6, "issues": ["opening just names the product", "no transformation moment"] },',
	'  "design": { "score": 8, "issues": ["scenes 3 and 4 look too similar"] },',
	'  "persuasion": { "score": 5, "issues": ["feels like a feature list, not a story"] },',
	'  "sceneNotes": [',
	'    { "scene": 1, "issue": "opens with product name instead of viewer problem", "fix": "replace with a bold statement about the pain point" },',
	'    { "scene": 4, "issue": "headline is corporate jargon", "fix": "rewrite to: Your busywork, automated." }',
	"  ]",
	"}",
].join("\n");

async function critiqueScenePlan(plan: ScenePlan): Promise<CreativeCritique | null> {
	const planSummary = plan.scenes
		.map(
			(s, i) =>
				`Scene ${i + 1}: "${s.headline}" | bg: ${s.background} | anim: ${s.animation} | type: ${s.type}`,
		)
		.join("\n");

	const prompt = [
		CRITIQUE_PROMPT,
		"",
		"## SCENE PLAN TO CRITIQUE",
		`Title: ${plan.title}`,
		`Accent: ${plan.accentColor}`,
		"",
		planSummary,
	].join("\n");

	try {
		const result = await window.electronAPI.aiAnalyze(
			prompt,
			"You are a creative director. Output ONLY valid JSON critique. No markdown.",
		);
		if (!result?.success || !result.text) return null;

		let jsonStr = result.text.trim();
		const fenceMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)```/);
		if (fenceMatch) jsonStr = fenceMatch[1].trim();
		return JSON.parse(jsonStr) as CreativeCritique;
	} catch {
		return null;
	}
}

async function rewritePlanFromCritique(
	plan: ScenePlan,
	critique: CreativeCritique,
): Promise<ScenePlan> {
	const prompt = [
		"You are a creative director REWRITING a video scene plan based on a critique.",
		"The critique identified specific problems. Fix ALL of them.",
		"",
		"## CRITIQUE (what's wrong)",
		`Overall score: ${critique.score}/10`,
		`Narrative issues: ${critique.narrative.issues.join("; ")}`,
		`Design issues: ${critique.design.issues.join("; ")}`,
		`Persuasion issues: ${critique.persuasion.issues.join("; ")}`,
		"",
		"Scene-specific fixes needed:",
		...critique.sceneNotes.map((n) => `- Scene ${n.scene}: ${n.issue} → FIX: ${n.fix}`),
		"",
		"## REWRITE RULES",
		"- Rewrite headlines to be emotional, punchy, 5-7 words max",
		"- Ensure the opening addresses the VIEWER'S problem, not the product",
		"- Add emotional contrast: problem scenes = dark/tense, solution = light/clean",
		"- Use at least 6 DIFFERENT animation types, never same twice in a row",
		"- Alternate light/dark backgrounds",
		"- Ensure a transformation moment before the CTA",
		"- Available animations: chars, words, scale, clip, gradient, glitch, blur-in, bounce, wave, typewriter, staccato, split, drop, scramble",
		"",
		"Return the FIXED scene plan as JSON. Same structure, better content.",
		"Return ONLY valid JSON, no markdown.",
		"",
		"## ORIGINAL PLAN TO REWRITE",
		JSON.stringify(plan, null, 2),
	].join("\n");

	try {
		const result = await window.electronAPI.aiAnalyze(
			prompt,
			"You rewrite video scene plans to be more compelling. Output ONLY valid JSON.",
		);
		if (!result?.success || !result.text) return plan;

		let jsonStr = result.text.trim();
		const fenceMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)```/);
		if (fenceMatch) jsonStr = fenceMatch[1].trim();
		const rewritten = JSON.parse(jsonStr) as ScenePlan;

		if (!rewritten.scenes?.length) return plan;
		return rewritten;
	} catch {
		return plan;
	}
}

/** Critique → gate → conditional rewrite loop for scene plans */
async function reviewScenePlan(
	plan: ScenePlan,
	onStatus?: (msg: string) => void,
): Promise<ScenePlan> {
	// Pass 1: Critique
	onStatus?.("Creative director reviewing story arc...");
	const critique = await critiqueScenePlan(plan);

	if (!critique) {
		onStatus?.("Critique skipped — using original plan");
		return plan;
	}

	onStatus?.(
		`Critique: ${critique.score}/10 — narrative: ${critique.narrative.score}, design: ${critique.design.score}, persuasion: ${critique.persuasion.score}`,
	);

	// Gate: if score >= 8, ship it
	if (critique.score >= 8) {
		onStatus?.("Score 8+ — plan approved by creative director");
		return plan;
	}

	// Pass 2: Rewrite based on critique
	onStatus?.(`Score ${critique.score}/10 — rewriting story and headlines...`);
	const rewritten = await rewritePlanFromCritique(plan, critique);
	onStatus?.("Story rewritten — headlines and arc improved");
	return rewritten;
}
