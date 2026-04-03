/**
 * useDemoAgent — Three-phase agent for the Demo Studio.
 *
 * Phase 1 (Recon):   Browse the entire site, build a site map.
 * Phase 2 (Script):  Send site map to AI, get a coherent storyboard.
 * Phase 3 (Execute): Follow the storyboard, capture screenshots.
 */

import { useCallback, useRef, useState } from "react";
import { type DemoModeId, getDemoMode } from "@/lib/ai/demoModes";
import { analyzeScreenshot } from "@/lib/cv/screenshotAnalyzer";
import type { ScreenshotAnalysis } from "@/lib/cv/types";
import type {
	DemoAction,
	DemoAgentStatus,
	DemoChatMessage,
	DemoConfig,
	DemoStep,
	PageInfo,
	SiteMapPage,
	Storyboard,
	StoryboardScene,
} from "./types";
import { WebviewDriver } from "./WebviewDriver";

// ── Prompts ──────────────────────────────────────────────────────────

const RECON_SYSTEM_PROMPT = `You are a site explorer agent. You are browsing a website to build a complete map of its pages and features BEFORE creating a demo video.

Your job: systematically visit every important page and report what you find. Do NOT create narration or take demo screenshots — just explore and discover.

Respond with ONE JSON action:
{
  "action": "click|scroll|navigate|done",
  "target": "element text or URL",
  "value": "up/down for scroll",
  "reasoning": "What you expect to find"
}

EXPLORATION STRATEGY:
1. Start at the landing page — note the main value prop and navigation structure
2. Click through EVERY main navigation item to discover all pages — this is your TOP priority
3. Prioritize: feature pages, product pages, pricing, integrations, use cases, about, how it works
4. Skip: FAQ, legal, privacy, terms, careers, blog index, help docs, login/signup forms
5. You MUST visit at least 4 DIFFERENT URLs before using "done". Scrolling the same page does NOT count.
6. If you've only visited 1-2 pages, click more navigation links — there are always more pages.
7. Use "done" ONLY when you've clicked every relevant navigation link

INTERACTION RULES:
- Only click links/buttons from the interactive elements list
- If clicking doesn't change the page, scroll or try a different link
- Move quickly — waitMs is not needed during recon`;

function buildScriptPrompt(mode: DemoModeId): string {
	const demoMode = getDemoMode(mode);
	return `You are a video storyboard writer creating a script for a product demo video.

<mode>
<name>${demoMode.name}</name>
<style>${demoMode.scriptStyle}</style>
<voice>${demoMode.narrationVoice}</voice>
</mode>

<task>
You will receive a site map with all pages and their section headings with Y positions.
Write a storyboard with 8-12 scenes that tells a compelling story about this product.
Each scene maps to a specific section of a specific page.
</task>

<output_format>
Return ONLY valid JSON. No markdown fences. No explanation.
{
  "title": "Short Video Title (3-6 words)",
  "scenes": [
    {
      "url": "https://example.com/features",
      "scrollToY": 800,
      "headline": "AI Does the Heavy Lifting",
      "narration": "One punchy sentence for voiceover, max 20 words.",
      "durationMs": 4000
    }
  ]
}

Field definitions:
- url: Page URL from the site map. MUST be an exact URL from the site map.
- scrollToY: EXACT Y position from the site map's section list. Use section Y values, not guesses.
- headline: 3-6 word visual headline for the slide. Punchy, not a full sentence. Think billboard.
- narration: One sentence voiceover script. Max 20 words. Conversational tone.
- durationMs: 3000-5000ms. Longer for complex narration.
</output_format>

<rules>
<rule priority="critical">Use scrollToY 0 for AT MOST ONE scene in the entire video. Never repeat the hero.</rule>
<rule priority="critical">Each scene MUST use a scrollToY value from the site map's section list. Do not invent Y values.</rule>
<rule priority="critical">Every scene must show visually DIFFERENT content. If same URL, scrollToY must differ by 600px+.</rule>
<rule priority="high">Spread scenes across ALL pages in the site map. Every page gets at least one scene.</rule>
<rule priority="high">8-12 scenes total. Quality over quantity.</rule>
<rule priority="high">Headlines are SHORT (3-6 words). Not sentences. Think: "AI-Powered Editing" not "The AI handles all the editing for you".</rule>
<rule priority="medium">Order scenes to tell a logical story arc, not just page-by-page.</rule>
<rule priority="medium">Narrations must flow as a coherent voiceover when read in sequence.</rule>
</rules>

<example>
{
  "title": "Ship Faster with Acme",
  "scenes": [
    {"url": "https://acme.com", "scrollToY": 0, "headline": "Ship Code, Not Bugs", "narration": "Acme catches bugs before your users do.", "durationMs": 3500},
    {"url": "https://acme.com", "scrollToY": 900, "headline": "Real-Time Monitoring", "narration": "Every deploy gets instant monitoring with zero setup.", "durationMs": 4000},
    {"url": "https://acme.com/pricing", "scrollToY": 0, "headline": "Free to Start", "narration": "Start free, scale when you're ready. No credit card required.", "durationMs": 3500}
  ]
}
</example>`;
}

let msgId = 0;
function createMessage(
	type: DemoChatMessage["type"],
	content: string,
	extra?: Partial<DemoChatMessage>,
): DemoChatMessage {
	return {
		id: `msg-${Date.now()}-${++msgId}`,
		type,
		content,
		timestamp: Date.now(),
		...extra,
	};
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useDemoAgent(
	webviewRef: React.RefObject<Electron.WebviewTag | null>,
	onMessage: (msg: DemoChatMessage) => void,
) {
	const [status, setStatus] = useState<DemoAgentStatus>("idle");
	const [steps, setSteps] = useState<DemoStep[]>([]);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [storyboardTitle, setStoryboardTitle] = useState("");

	const stoppedRef = useRef(false);
	const resumeResolverRef = useRef<(() => void) | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef(0);

	// ── Phase 1: Reconnaissance ──────────────────────────────────────

	async function runRecon(driver: WebviewDriver, config: DemoConfig): Promise<SiteMapPage[]> {
		const siteMap: SiteMapPage[] = [];
		const visitedUrls = new Set<string>();
		const maxReconSteps = Math.min(config.maxSteps, 30);
		const mode = getDemoMode(config.mode);

		// Capture the landing page first — scroll to bottom to discover all sections
		const landingInfo = await driver.getPageInfo();
		const landingHeadings = await driver.getSectionHeadings();
		visitedUrls.add(normalizeUrl(landingInfo.url));
		siteMap.push(pageInfoToSiteMapPage(landingInfo, landingHeadings));

		onMessage(createMessage("system", `📍 Discovered: ${landingInfo.title || landingInfo.url}`));

		// ── Auto-discover all nav links before AI-driven exploration ──
		// This guarantees we find pages like /pro, /features even if the AI gets stuck scrolling
		const navLinks = await driver.getNavLinks();
		const baseOrigin = new URL(config.url).origin;
		for (const link of navLinks) {
			if (stoppedRef.current) break;
			try {
				const linkUrl = new URL(link.href, config.url);
				const normalized = normalizeUrl(linkUrl.href);
				// Only visit same-origin, non-blocked, unvisited pages
				if (linkUrl.origin !== baseOrigin) continue;
				if (visitedUrls.has(normalized)) continue;
				if (isBlockedUrl(normalized)) continue;
				if (isBlockedLinkText(link.text)) continue;

				await driver.loadURL(linkUrl.href);
				await new Promise((r) => setTimeout(r, 2000));

				const pageInfo = await driver.getPageInfo();
				const pageNorm = normalizeUrl(pageInfo.url);
				if (!visitedUrls.has(pageNorm) && !isBlockedUrl(pageNorm)) {
					visitedUrls.add(pageNorm);
					// Scroll down to discover sections
					await driver.scroll("down");
					await new Promise((r) => setTimeout(r, 500));
					await driver.scroll("down");
					await new Promise((r) => setTimeout(r, 500));
					const headings = await driver.getSectionHeadings();
					await driver.scrollToElement("top");
					siteMap.push(pageInfoToSiteMapPage(pageInfo, headings));
					onMessage(
						createMessage(
							"system",
							`📍 Discovered: ${pageInfo.title || pageNorm} (${headings.length} sections)`,
						),
					);
				}
			} catch {
				// Skip failed nav links
			}
		}

		// Navigate back to landing page for AI-driven exploration
		if (siteMap.length > 1) {
			await driver.loadURL(config.url);
			await new Promise((r) => setTimeout(r, 2000));
		}

		const reconSystemPrompt = `${RECON_SYSTEM_PROMPT}\n\nADDITIONAL FOCUS:\n${mode.reconFocus}`;

		for (let i = 0; i < maxReconSteps; i++) {
			if (stoppedRef.current) break;

			const pageInfo = await driver.getPageInfo();

			onMessage(createMessage("thinking", `Exploring (${i + 1}/${maxReconSteps})...`));

			// Get next recon action from AI
			const visitedList = siteMap.map((p) => `- ${p.title}: ${p.url}`).join("\n");
			const elementsList = pageInfo.elements
				.slice(0, 30)
				.filter((e) => e.type !== "link" || !isBlockedLinkText(e.text))
				.map((e) => `- [${e.type}] "${e.text}" (${e.selector})`)
				.join("\n");

			const prompt = `PAGES VISITED SO FAR:\n${visitedList}\n\nCURRENT PAGE: ${pageInfo.url} — "${pageInfo.title}"\n\nVisible text:\n${pageInfo.visibleText.slice(0, 400)}\n\nInteractive elements:\n${elementsList || "(none)"}\n\nStep ${i + 1} of ${maxReconSteps}. ${maxReconSteps - i <= 3 ? "⚠️ WRAPPING UP — use 'done' soon." : ""}\n\nWhat next? JSON only.`;

			const result = await window.electronAPI.aiAnalyze(prompt, reconSystemPrompt);
			if (!result?.success || !result.text) {
				await driver.scroll("down");
				await new Promise((r) => setTimeout(r, 500));
				continue;
			}

			try {
				let json = result.text.trim();
				json = json.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
				const match = json.match(/\{[\s\S]*\}/);
				if (match) json = match[0];
				const action = JSON.parse(json) as DemoAction;

				// Guard: force continue if done too early — need at least 4 pages
				if (action.action === "done" && siteMap.length < 4) {
					await driver.scroll("down");
					continue;
				}
				if (action.action === "done") break;

				// Execute the recon action (with blocked-URL guard)
				if (action.action === "click" && action.target) {
					if (isBlockedLinkText(action.target)) {
						await driver.scroll("down");
						continue;
					}
					await driver.click(action.target);
					await new Promise((r) => setTimeout(r, 1500));
				} else if (action.action === "scroll") {
					await driver.scroll(action.value === "up" ? "up" : "down");
					await new Promise((r) => setTimeout(r, 500));
				} else if (action.action === "navigate" && action.target) {
					if (isBlockedUrl(action.target)) {
						continue;
					}
					await driver.loadURL(action.target);
					await new Promise((r) => setTimeout(r, 1500));
				}

				// Check if we landed on a new page
				const newPageInfo = await driver.getPageInfo();
				const normalizedUrl = normalizeUrl(newPageInfo.url);
				if (!visitedUrls.has(normalizedUrl)) {
					// Skip blocked pages (FAQ, legal, etc.)
					if (isBlockedUrl(normalizedUrl)) {
						visitedUrls.add(normalizedUrl); // Mark visited so we don't retry
						continue;
					}
					visitedUrls.add(normalizedUrl);
					// Scroll down to discover all sections before capturing
					await driver.scroll("down");
					await new Promise((r) => setTimeout(r, 500));
					await driver.scroll("down");
					await new Promise((r) => setTimeout(r, 500));
					const headings = await driver.getSectionHeadings();
					// Scroll back to top
					await driver.scrollToElement("top");
					siteMap.push(pageInfoToSiteMapPage(newPageInfo, headings));
					onMessage(
						createMessage(
							"system",
							`📍 Discovered: ${newPageInfo.title || normalizedUrl} (${headings.length} sections)`,
						),
					);
				}
			} catch {
				await driver.scroll("down");
				await new Promise((r) => setTimeout(r, 500));
			}
		}

		return siteMap;
	}

	// ── Phase 2: Script Generation ───────────────────────────────────

	async function generateStoryboard(
		siteMap: SiteMapPage[],
		config: DemoConfig,
	): Promise<Storyboard | null> {
		const scriptPrompt = buildScriptPrompt(config.mode);

		const siteMapText = siteMap
			.map((p, i) => {
				const sectionsText =
					p.sections.length > 0
						? `  Sections (with scroll Y positions):\n${p.sections.map((s) => `    - "${s.text}" at Y=${s.yPosition}px`).join("\n")}`
						: "  Sections: none found";
				return `Page ${i + 1}: ${p.url}\n  Title: ${p.title}\n  Summary: ${p.summary}\n  Features: ${p.features.join(", ") || "none identified"}\n${sectionsText}`;
			})
			.join("\n\n");

		const userPrompt = `USER'S GOAL: ${config.prompt}\n\nSITE MAP (${siteMap.length} pages discovered):\n\n${siteMapText}\n\nWrite the storyboard. JSON only.`;

		const result = await window.electronAPI.aiAnalyze(userPrompt, scriptPrompt);
		if (!result?.success || !result.text) {
			console.error("[Demo] Storyboard generation failed:", result?.error || "empty response");
			onMessage(
				createMessage("error", `Storyboard AI error: ${result?.error || "empty response"}`),
			);
			return null;
		}

		try {
			let json = result.text.trim();
			json = json.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
			if (json.startsWith("```")) {
				json = json.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
			}
			const match = json.match(/\{[\s\S]*\}/);
			if (match) json = match[0];
			const parsed = JSON.parse(json) as Storyboard;

			if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) return null;

			// Build a set of known URLs from the site map for validation
			const knownUrls = new Set(siteMap.map((p) => p.url));
			const baseOrigin = new URL(config.url).origin;

			// Validate and clamp
			parsed.scenes = parsed.scenes.slice(0, 15).map((s) => {
				let url = typeof s.url === "string" ? s.url : (siteMap[0]?.url ?? config.url);

				// Fix protocol mismatch — AI often upgrades http to https
				if (baseOrigin.startsWith("http://") && url.startsWith("https://")) {
					url = url.replace("https://", "http://");
				}

				// If URL isn't in our site map, find the closest match or use the base
				if (!knownUrls.has(url)) {
					const match = siteMap.find((p) => p.url.includes(new URL(url).pathname));
					url = match?.url ?? config.url;
				}

				return {
					url,
					scrollToY: typeof s.scrollToY === "number" ? Math.max(0, Math.round(s.scrollToY)) : 0,
					zoomTarget: typeof s.zoomTarget === "string" ? s.zoomTarget : undefined,
					headline: typeof s.headline === "string" ? s.headline : undefined,
					narration: typeof s.narration === "string" ? s.narration : "",
					durationMs:
						typeof s.durationMs === "number" ? Math.max(2000, Math.min(8000, s.durationMs)) : 4000,
				};
			});

			// Enforce scene diversity: dedup + max scenes per URL
			parsed.scenes = deduplicateStoryboard(parsed.scenes);
			parsed.scenes = enforcePageDiversity(parsed.scenes);

			return parsed;
		} catch (err) {
			console.error("Failed to parse storyboard:", err);
			return null;
		}
	}

	// ── Phase 3: Execution ───────────────────────────────────────────

	async function executeStoryboard(
		driver: WebviewDriver,
		storyboard: Storyboard,
		siteMap: SiteMapPage[],
	): Promise<DemoStep[]> {
		const allSteps: DemoStep[] = [];
		let lastUrl = "";

		for (let i = 0; i < storyboard.scenes.length; i++) {
			if (stoppedRef.current) break;

			const scene = storyboard.scenes[i];

			onMessage(
				createMessage("thinking", `Capturing scene ${i + 1}/${storyboard.scenes.length}...`),
			);

			// Navigate if URL changed
			if (scene.url !== lastUrl) {
				await driver.loadURL(scene.url);
				await new Promise((r) => setTimeout(r, 3000));
				lastUrl = scene.url;

				// 404 detection — skip scenes that navigate to broken pages
				const pageCheck = await driver.getPageInfo();
				if (is404Page(pageCheck)) {
					onMessage(createMessage("system", `⚠️ Skipping 404 page: ${scene.url}`));
					continue;
				}
			}

			// Smart scroll: try to find a section heading matching the narration
			const matchedHeading = findMatchingHeading(scene.narration, siteMap, scene.url);
			if (matchedHeading) {
				await driver.scrollToElement(matchedHeading);
				await new Promise((r) => setTimeout(r, 1200));
			} else {
				await driver.scrollToPosition(scene.scrollToY ?? 0);
				await new Promise((r) => setTimeout(r, 1500));
			}

			if (stoppedRef.current) break;

			// Take screenshot
			let screenshot = await driver.screenshot();
			if (screenshot.length < 200) {
				await new Promise((r) => setTimeout(r, 2000));
				screenshot = await driver.screenshot();
			}

			// Blank-image detection
			if (isLikelyBlank(screenshot)) {
				await driver.scrollToPosition(0);
				await new Promise((r) => setTimeout(r, 1200));
				screenshot = await driver.screenshot();
			}

			// Duplicate detection — skip if this screenshot is too similar to the previous one
			if (allSteps.length > 0) {
				const prevScreenshot = allSteps[allSteps.length - 1].screenshotDataUrl;
				if (prevScreenshot && areScreenshotsSimilar(screenshot, prevScreenshot)) {
					continue; // Skip duplicate
				}
			}

			// Detect prominent element for ken-burns focus
			const focusPoint = await driver.getProminentElementPosition();

			// Section-aware cropping: use the heading we already matched for scrolling
			// to get the section's bounds for tight cropping
			let cropRegion: DemoStep["cropRegion"] = undefined;
			if (matchedHeading) {
				const sectionBounds = await driver.getSectionBounds(matchedHeading);
				if (sectionBounds) {
					cropRegion = sectionBounds;
				}
			}

			// Detect individual UI elements in the viewport (cards, headings, CTAs)
			const uiElements = await driver.getVisibleUIElements();

			// Canvas analysis for color/complexity data
			let analysis: ScreenshotAnalysis | undefined;
			if (!isLikelyBlank(screenshot)) {
				try {
					analysis = await analyzeScreenshot(screenshot);
				} catch {
					// Analysis failed — composition engine handles undefined
				}
			}

			const mainStep: DemoStep = {
				action: {
					action: "navigate",
					target: scene.url,
					narration: scene.narration,
				},
				timestamp: Date.now() - startTimeRef.current,
				screenshotDataUrl: screenshot,
				focusPoint,
				headline: scene.headline,
				cropRegion,
				analysis,
				uiElements: uiElements.length > 0 ? uiElements : undefined,
			};
			allSteps.push(mainStep);
			setSteps([...allSteps]);
			setCurrentStepIndex(allSteps.length - 1);

			onMessage(
				createMessage("narration", scene.narration, {
					screenshotDataUrl: screenshot,
				}),
			);

			// Zoom shot if specified
			if (scene.zoomTarget) {
				const zoomScreenshot = await captureZoomShot(driver, screenshot, scene.zoomTarget);
				if (zoomScreenshot) {
					const zoomStep: DemoStep = {
						action: {
							action: "navigate",
							target: scene.url,
							narration: "", // Zoom shots share the parent narration
						},
						timestamp: Date.now() - startTimeRef.current,
						screenshotDataUrl: zoomScreenshot,
						isZoomShot: true,
					};
					allSteps.push(zoomStep);
					setSteps([...allSteps]);
					setCurrentStepIndex(allSteps.length - 1);
				}
			}
		}

		return allSteps;
	}

	// ── Zoom capture helper ──────────────────────────────────────────

	async function captureZoomShot(
		driver: WebviewDriver,
		_fullScreenshotDataUrl: string,
		zoomTarget: string,
	): Promise<string | null> {
		try {
			// First scroll to the element to make sure it's visible
			await driver.scrollToElement(zoomTarget);
			await new Promise((r) => setTimeout(r, 500));

			const bounds = await driver.getElementBounds(zoomTarget);
			if (!bounds || bounds.width < 10 || bounds.height < 10) return null;

			// Take a fresh screenshot with the element in view
			const freshScreenshot = await driver.screenshot();

			// Re-query bounds after scroll (position may have changed)
			const freshBounds = await driver.getElementBounds(zoomTarget);
			if (!freshBounds || freshBounds.width < 10 || freshBounds.height < 10) {
				return freshScreenshot; // Return full screenshot as fallback
			}

			// Crop the screenshot to the element bounds with padding
			return cropScreenshot(freshScreenshot, freshBounds);
		} catch (err) {
			console.warn("Zoom capture failed:", err);
			return null;
		}
	}

	function cropScreenshot(
		dataUrl: string,
		bounds: { x: number; y: number; width: number; height: number },
	): Promise<string> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				// Scale factor: webview may be at device pixel ratio
				const scaleX = img.width / window.innerWidth;
				const scaleY = img.height / window.innerHeight;

				// Add 20% padding around the element
				const pad = 0.2;
				const sx = Math.max(0, (bounds.x - bounds.width * pad) * scaleX);
				const sy = Math.max(0, (bounds.y - bounds.height * pad) * scaleY);
				const sw = Math.min(img.width - sx, bounds.width * (1 + pad * 2) * scaleX);
				const sh = Math.min(img.height - sy, bounds.height * (1 + pad * 2) * scaleY);

				const canvas = document.createElement("canvas");
				canvas.width = 1920;
				canvas.height = Math.round(1920 * (sh / sw));
				const ctx = canvas.getContext("2d")!;
				ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/png"));
			};
			img.onerror = () => resolve(dataUrl);
			img.src = dataUrl;
		});
	}

	// ── Main three-phase loop ────────────────────────────────────────

	const start = useCallback(
		async (config: DemoConfig) => {
			const wv = webviewRef.current;
			if (!wv) return;

			stoppedRef.current = false;
			setStatus("running");
			setSteps([]);
			setCurrentStepIndex(0);
			setElapsedMs(0);
			startTimeRef.current = Date.now();

			timerRef.current = setInterval(() => {
				setElapsedMs(Date.now() - startTimeRef.current);
			}, 500);

			const driver = new WebviewDriver(wv);

			try {
				// Navigate to starting URL
				onMessage(createMessage("system", `Starting demo of ${config.url}...`));
				await driver.loadURL(config.url);
				await new Promise((r) => setTimeout(r, 2000));

				if (stoppedRef.current) return;

				// ── PHASE 1: Reconnaissance ──────────────────────────
				onMessage(createMessage("system", "🔍 Phase 1: Exploring the site..."));

				const siteMap = await runRecon(driver, config);

				if (stoppedRef.current) return;

				onMessage(
					createMessage(
						"system",
						`✅ Recon complete — discovered ${siteMap.length} pages: ${siteMap.map((p) => p.title || "Untitled").join(", ")}`,
					),
				);

				// ── PHASE 2: Script Generation ───────────────────────
				onMessage(createMessage("system", "📝 Phase 2: Writing the storyboard..."));

				const storyboard = await generateStoryboard(siteMap, config);

				if (stoppedRef.current) return;

				if (!storyboard) {
					onMessage(createMessage("error", "Failed to generate storyboard. Check AI settings."));
					setStatus("idle");
					return;
				}

				setStoryboardTitle(storyboard.title);

				// Show the storyboard in chat
				const storyboardPreview = storyboard.scenes
					.map((s, i) => `${i + 1}. ${s.narration}`)
					.join("\n");
				onMessage(
					createMessage(
						"storyboard",
						`📋 **${storyboard.title}** (${storyboard.scenes.length} scenes)\n\n${storyboardPreview}`,
					),
				);

				// ── PHASE 3: Execution ───────────────────────────────
				onMessage(
					createMessage("system", `🎬 Phase 3: Capturing ${storyboard.scenes.length} scenes...`),
				);

				const allSteps = await executeStoryboard(driver, storyboard, siteMap);

				if (stoppedRef.current) return;

				setSteps([...allSteps]);

				// Complete
				setStatus("complete");
				onMessage(
					createMessage(
						"completion",
						`Demo complete! ${allSteps.length} screenshots captured from ${storyboard.scenes.length} scripted scenes.`,
					),
				);
			} catch (err) {
				console.error("DemoAgent error:", err);
				onMessage(
					createMessage(
						"error",
						`Demo failed: ${err instanceof Error ? err.message : String(err)}`,
					),
				);
				setStatus("idle");
			} finally {
				if (timerRef.current) {
					clearInterval(timerRef.current);
					timerRef.current = null;
				}
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: internal functions are stable
		[webviewRef, onMessage],
	);

	const stop = useCallback(() => {
		stoppedRef.current = true;
		if (resumeResolverRef.current) {
			resumeResolverRef.current();
			resumeResolverRef.current = null;
		}
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setStatus("idle");
	}, []);

	const resume = useCallback(() => {
		if (resumeResolverRef.current) {
			resumeResolverRef.current();
		}
	}, []);

	return { start, stop, resume, status, steps, currentStepIndex, elapsedMs, storyboardTitle };
}

// ── Utilities ────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
	try {
		const u = new URL(url);
		// Remove trailing slashes, hashes, and common query params
		return `${u.origin}${u.pathname.replace(/\/$/, "")}`;
	} catch {
		return url;
	}
}

function pageInfoToSiteMapPage(
	info: PageInfo,
	headings?: { text: string; tag: string; yPosition: number }[],
): SiteMapPage {
	return {
		url: info.url,
		title: info.title,
		summary: info.visibleText.slice(0, 300),
		features: extractFeatures(info.visibleText),
		interactiveElements: info.elements.slice(0, 10).map((e) => `${e.type}: ${e.text}`),
		sections: (headings ?? []).map((h) => ({ text: h.text, yPosition: h.yPosition })),
	};
}

function extractFeatures(text: string): string[] {
	// Simple heuristic: look for short capitalized phrases or bullet-like items
	const lines = text.split("\n").filter((l) => {
		const t = l.trim();
		return t.length > 3 && t.length < 80 && !t.includes("©") && !t.includes("privacy");
	});
	return lines.slice(0, 8);
}

// ── Smart scroll position matching ───────────────────────────────────

/**
 * Match narration keywords against site map section headings.
 * Returns the heading TEXT to scroll to in the live DOM (not a stale Y position).
 * Returns null if no confident match — caller falls back to storyboard scrollToY.
 */
function findMatchingHeading(
	narration: string,
	siteMap: SiteMapPage[],
	url: string,
): string | null {
	const lower = narration.toLowerCase();
	if (!lower || lower.length < 10) return null;

	const page = siteMap.find((p) => p.url === url);
	if (!page || page.sections.length === 0) return null;

	const stopWords = new Set([
		"the",
		"a",
		"an",
		"is",
		"are",
		"was",
		"were",
		"be",
		"been",
		"being",
		"have",
		"has",
		"had",
		"do",
		"does",
		"did",
		"will",
		"would",
		"could",
		"should",
		"may",
		"might",
		"can",
		"shall",
		"to",
		"of",
		"in",
		"for",
		"on",
		"with",
		"at",
		"by",
		"from",
		"as",
		"into",
		"through",
		"during",
		"before",
		"after",
		"and",
		"but",
		"or",
		"nor",
		"not",
		"so",
		"yet",
		"both",
		"either",
		"neither",
		"each",
		"every",
		"all",
		"any",
		"few",
		"more",
		"most",
		"other",
		"some",
		"such",
		"no",
		"only",
		"own",
		"same",
		"than",
		"too",
		"very",
		"just",
		"because",
		"if",
		"when",
		"where",
		"how",
		"what",
		"which",
		"who",
		"whom",
		"this",
		"that",
		"these",
		"those",
		"it",
		"its",
		"you",
		"your",
		"we",
		"our",
		"they",
		"their",
	]);

	const keywords = lower
		.replace(/[^a-z0-9\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 3 && !stopWords.has(w));

	if (keywords.length === 0) return null;

	let bestScore = 0;
	let bestHeading: string | null = null;

	for (const section of page.sections) {
		const headingLower = section.text.toLowerCase();
		let score = 0;
		for (const kw of keywords) {
			if (headingLower.includes(kw)) score += 2;
		}
		if (score > bestScore) {
			bestScore = score;
			bestHeading = section.text;
		}
	}

	// Only use if strong match (4+ points = 2+ keyword hits)
	return bestScore >= 4 ? bestHeading : null;
}

// ── Page and screenshot quality checks ────────────────────────────────

/** Detect 404 / error pages */
function is404Page(pageInfo: PageInfo): boolean {
	const title = pageInfo.title.toLowerCase();
	const text = pageInfo.visibleText.toLowerCase().slice(0, 500);
	return (
		title.includes("404") ||
		title.includes("not found") ||
		title.includes("page not found") ||
		text.includes("404") ||
		text.includes("page could not be found") ||
		text.includes("page not found") ||
		text.includes("this page doesn't exist")
	);
}

/**
 * Quick similarity check between two screenshot data URLs.
 * Compares data URL lengths as a proxy — identical viewport captures
 * at the same scroll position produce nearly identical file sizes.
 */
function areScreenshotsSimilar(a: string, b: string): boolean {
	// If both are very short, they're both blank
	if (a.length < 7000 && b.length < 7000) return true;
	// Only skip near-identical screenshots (same pixel content)
	// Different scroll positions on same page produce ~90-97% similar sizes,
	// so we need a very tight threshold to avoid false positives
	const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
	return ratio > 0.995;
}

// ── Screenshot quality checks (legacy) ───────────────────────────────

/**
 * Detect likely-blank screenshots. JPEG screenshots of actual page content
 * are typically 30KB+. Blank/near-empty pages compress to under ~5KB.
 */
function isLikelyBlank(dataUrl: string): boolean {
	// data:image/jpeg;base64, prefix is ~23 chars. Base64 is ~1.37x raw size.
	// A 5KB image ≈ 6850 base64 chars + 23 prefix ≈ 6873 total.
	return dataUrl.length < 7000;
}

// ── Blocked URL / link patterns for recon ────────────────────────────

const BLOCKED_PATH_PATTERNS = [
	"/faq",
	"/faqs",
	"/frequently-asked",
	"/privacy",
	"/privacy-policy",
	"/terms",
	"/terms-of-service",
	"/tos",
	"/legal",
	"/disclaimer",
	"/cookie",
	"/cookies",
	"/careers",
	"/jobs",
	"/hiring",
	"/help",
	"/support",
	"/docs",
	"/documentation",
	"/login",
	"/signin",
	"/sign-in",
	"/signup",
	"/sign-up",
	"/register",
	"/contact",
	"/contact-us",
	"/sitemap",
	"/accessibility",
];

const BLOCKED_LINK_TEXTS = [
	"faq",
	"frequently asked",
	"privacy",
	"privacy policy",
	"terms",
	"terms of service",
	"legal",
	"disclaimer",
	"careers",
	"jobs",
	"cookie",
	"cookies",
	"help center",
	"support",
	"documentation",
	"login",
	"log in",
	"sign in",
	"sign up",
	"register",
	"contact us",
	"contact",
	"sitemap",
	"accessibility",
];

function isBlockedUrl(url: string): boolean {
	try {
		const pathname = new URL(url).pathname.toLowerCase().replace(/\/$/, "");
		return BLOCKED_PATH_PATTERNS.some((p) => pathname === p || pathname.startsWith(p + "/"));
	} catch {
		return false;
	}
}

function isBlockedLinkText(text: string): boolean {
	const lower = text.toLowerCase().trim();
	return BLOCKED_LINK_TEXTS.some((b) => lower === b || lower.includes(b));
}

// ── Storyboard deduplication ─────────────────────────────────────────

function deduplicateStoryboard(scenes: StoryboardScene[]): StoryboardScene[] {
	const result: StoryboardScene[] = [];
	for (const scene of scenes) {
		const prev = result[result.length - 1];
		if (prev && prev.url === scene.url && Math.abs(prev.scrollToY - scene.scrollToY) < 400) {
			if (scene.narration.length > prev.narration.length) {
				result[result.length - 1] = scene;
			}
			continue;
		}
		result.push(scene);
	}
	return result;
}

/** Enforce hero (scrollToY < 100) only once per URL — allow many sections */
function enforcePageDiversity(scenes: StoryboardScene[]): StoryboardScene[] {
	const urlHeroUsed = new Set<string>();
	const result: StoryboardScene[] = [];

	for (const scene of scenes) {
		const isHero = scene.scrollToY < 100;

		// Skip duplicate hero shots for the same URL
		if (isHero && urlHeroUsed.has(scene.url)) continue;

		result.push(scene);
		if (isHero) urlHeroUsed.add(scene.url);
	}

	return result;
}
