/**
 * useDemoAgent — Three-phase agent for the Demo Studio.
 *
 * Phase 1 (Recon):   Browse the entire site, build a site map.
 * Phase 2 (Script):  Send site map to AI, get a coherent storyboard.
 * Phase 3 (Execute): Follow the storyboard, capture screenshots.
 */

import { useCallback, useRef, useState } from "react";
import { type DemoModeId, getDemoMode } from "@/lib/ai/demoModes";
import type {
	DemoAction,
	DemoAgentStatus,
	DemoChatMessage,
	DemoConfig,
	DemoStep,
	PageInfo,
	SiteMapPage,
	Storyboard,
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

VIDEO MODE: ${demoMode.name}
${demoMode.scriptStyle}

NARRATION VOICE:
${demoMode.narrationVoice}

You will receive a site map — a complete list of all pages on a website with their content summaries. Using this map, write a storyboard that tells a coherent story.

Return ONLY valid JSON (no markdown):
{
  "title": "Short video title",
  "scenes": [
    {
      "url": "https://example.com/features",
      "scrollToY": 0,
      "narration": "One punchy sentence for voiceover.",
      "durationMs": 4000
    },
    {
      "url": "https://example.com/features",
      "scrollToY": 1200,
      "narration": "Scroll down to show the next section.",
      "durationMs": 5000
    }
  ]
}

RULES:
- 8-12 scenes total. Quality over quantity.
- Each scene's narration is ONE sentence, max 25 words. This will be the voiceover.
- The narrations must form a coherent story when read in sequence — like chapters.
- scrollToY: PIXEL position to scroll to on the page. Use 0 for the top. Each page's sections have specific Y positions listed in the site map — use those EXACT values.
- IMPORTANT: When showing multiple sections of the SAME page, scrollToY values must be AT LEAST 600px apart! Closer values show overlapping content, which looks terrible. Use the section Y positions from the site map and pick ones that are far apart.
- MAX 3 scenes per URL. If a page has many sections, pick the 2-3 BEST ones, not all of them.
- Prefer showing DIFFERENT PAGES over scrolling the same page. Each page visit tells a new chapter.
- durationMs: 3000-5000ms per scene. Longer for text-heavy narration.
- Order scenes to tell a logical story, not just page-by-page listing.
- Every scene MUST show something visually DIFFERENT from the previous scene.`;
}

// Vision-capable providers
const VISION_PROVIDERS = new Set(["openai", "anthropic"]);

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

	const stoppedRef = useRef(false);
	const resumeResolverRef = useRef<(() => void) | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef(0);
	const useVisionRef = useRef(false);

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

		const reconSystemPrompt = `${RECON_SYSTEM_PROMPT}\n\nADDITIONAL FOCUS:\n${mode.reconFocus}`;

		for (let i = 0; i < maxReconSteps; i++) {
			if (stoppedRef.current) break;

			const pageInfo = await driver.getPageInfo();

			onMessage(createMessage("thinking", `Exploring (${i + 1}/${maxReconSteps})...`));

			// Get next recon action from AI
			const visitedList = siteMap.map((p) => `- ${p.title}: ${p.url}`).join("\n");
			const elementsList = pageInfo.elements
				.slice(0, 30)
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

				// Execute the recon action
				if (action.action === "click" && action.target) {
					await driver.click(action.target);
					await new Promise((r) => setTimeout(r, 1500));
				} else if (action.action === "scroll") {
					await driver.scroll(action.value === "up" ? "up" : "down");
					await new Promise((r) => setTimeout(r, 500));
				} else if (action.action === "navigate" && action.target) {
					await driver.loadURL(action.target);
					await new Promise((r) => setTimeout(r, 1500));
				}

				// Check if we landed on a new page
				const newPageInfo = await driver.getPageInfo();
				const normalizedUrl = normalizeUrl(newPageInfo.url);
				if (!visitedUrls.has(normalizedUrl)) {
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
		if (!result?.success || !result.text) return null;

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
					narration: typeof s.narration === "string" ? s.narration : "",
					durationMs:
						typeof s.durationMs === "number" ? Math.max(2000, Math.min(8000, s.durationMs)) : 4000,
				};
			});

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
				// Wait generously for page to fully render (CSS, images, JS)
				await new Promise((r) => setTimeout(r, 3000));
				lastUrl = scene.url;
			}

			// Scroll to the exact pixel position
			await driver.scrollToPosition(scene.scrollToY ?? 0);
			// Wait for scroll animation + any lazy-loaded content
			await new Promise((r) => setTimeout(r, 1500));

			if (stoppedRef.current) break;

			// Take screenshot — retry once if we get a blank/fallback image
			let screenshot = await driver.screenshot();
			if (screenshot.length < 200) {
				// Got the 1px fallback — wait and retry
				await new Promise((r) => setTimeout(r, 2000));
				screenshot = await driver.screenshot();
			}
			const mainStep: DemoStep = {
				action: {
					action: "navigate",
					target: scene.url,
					narration: scene.narration,
				},
				timestamp: Date.now() - startTimeRef.current,
				screenshotDataUrl: screenshot,
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

			// Check vision support
			try {
				const aiConfig = await window.electronAPI.aiGetConfig();
				useVisionRef.current = VISION_PROVIDERS.has(aiConfig?.provider);
			} catch {
				useVisionRef.current = false;
			}

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

				const allSteps = await executeStoryboard(driver, storyboard);

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

	return { start, stop, resume, status, steps, currentStepIndex, elapsedMs };
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
