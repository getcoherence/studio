/**
 * useDemoAgent — renderer-side agent hook for the Demo Studio.
 * Ports the agent loop from electron/automation/demoAgent.ts to run
 * entirely in the renderer, controlling a <webview> element directly.
 */

import { useCallback, useRef, useState } from "react";
import type {
	DemoAction,
	DemoAgentStatus,
	DemoChatMessage,
	DemoConfig,
	DemoStep,
	PageInfo,
} from "./types";
import { WebviewDriver } from "./WebviewDriver";

// ── Prompts (copied from electron/automation/demoAgent.ts) ────────────

const AGENT_SYSTEM_PROMPT = `You are an expert product demo agent. You control a web browser to create compelling product demo videos.

You receive the current page context (URL, title, text, interactive elements) and decide the NEXT action.

Respond with ONE JSON action. No markdown, no explanation outside the JSON:
{
  "action": "click|type|scroll|navigate|wait|pause|done",
  "target": "CSS selector or element text description",
  "value": "text for type action, or 'up'/'down' for scroll",
  "waitMs": 1500,
  "reasoning": "Why this action moves the demo forward"
}

DEMO STRATEGY — Act like a product expert giving a live walkthrough:
1. START with the hero/landing — scroll down to reveal key messaging and visuals
2. INTERACT with the product — don't just read navigation. Open actual features, click into detail views, expand dropdowns, fill sample data into forms, toggle settings, open modals
3. SHOW the product working — if there's a dashboard, click into a specific item. If there's a list, open a record. If there's a form, fill it in. If there's a settings page, toggle something.
4. DEPTH over breadth — it's better to deeply explore 2-3 features than to superficially click 8 nav links
5. SCROLL to reveal content on EVERY page — most pages have below-the-fold content worth showing
6. End with a CTA, pricing page, or signup page if available

INTERACTION RULES:
- You MUST perform at least 8 actions before using "done". Do NOT stop early.
- Move slowly and deliberately (waitMs: 1500-2500)
- For click: use the element's EXACT text content from the elements list. Only click elements that appear in the list.
- If a menu item has a dropdown arrow (▾ or ▸) or is a group header, click a SPECIFIC subpage link instead.
- If clicking didn't navigate or change the page, try scrolling or a different element.
- For type: set target to input selector, value to sample text
- For scroll: set value to "up" or "down"
- For navigate: set target to URL
- For pause: use when you detect a login/OAuth/SSO screen the user must complete manually
- NEVER say "done" before step 8`;

const VISION_NARRATION_PROMPT = `You are a professional product demo narrator. You are looking at a screenshot from a live product walkthrough.

Describe what you SEE on screen in 1-2 sentences, as if you are presenting to an audience watching the demo video. Be specific about the UI elements, data, and layout visible. Use present tense.

Rules:
- Describe what IS on screen, not what was clicked or what will happen next
- Be professional and engaging, like a product launch presentation
- Reference specific UI elements: "the analytics dashboard shows three metric cards", not "the page has some content"
- If it's a landing page, mention the headline and key value proposition
- If it's an app UI, describe the layout and what data/features are visible
- Keep it concise — 1-2 sentences max, suitable for voiceover narration`;

const TEXT_NARRATION_PROMPT = `Based on the following page context from a product demo, write 1-2 sentences of voiceover narration describing what the viewer would see on screen. Be specific and professional, like a product launch presentation.

Page URL: {url}
Page Title: {title}
Visible content (excerpt): {visibleText}

Write the narration only, no quotes or explanation:`;

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

	// ── Narration helpers ──

	async function narrateScreenshot(screenshotDataUrl: string, pageInfo: PageInfo): Promise<string> {
		try {
			if (useVisionRef.current) {
				// Extract base64 from data URL
				const base64 = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, "");
				const result = await window.electronAPI.aiAnalyzeImage(
					"Describe what you see on this screen for a product demo voiceover.",
					base64,
					VISION_NARRATION_PROMPT,
				);
				if (result?.success && result.text) {
					return result.text.replace(/^["']|["']$/g, "").trim();
				}
			}

			// Fallback: text-based narration
			const textPrompt = TEXT_NARRATION_PROMPT.replace("{url}", pageInfo.url)
				.replace("{title}", pageInfo.title)
				.replace("{visibleText}", pageInfo.visibleText.slice(0, 500));
			const result = await window.electronAPI.aiAnalyze(textPrompt);
			if (result?.success && result.text) {
				return result.text.replace(/^["']|["']$/g, "").trim();
			}
		} catch (err) {
			console.warn("DemoAgent: narration failed:", err);
		}
		return `Viewing ${pageInfo.title || pageInfo.url}.`;
	}

	async function getNextAction(
		goal: string,
		pageInfo: PageInfo,
		stepIndex: number,
		maxSteps: number,
		previousSteps: DemoStep[],
	): Promise<DemoAction> {
		const prevSummary = previousSteps
			.map(
				(s, i) =>
					`Step ${i + 1}: ${s.action.action}${s.action.target ? ` → "${s.action.target}"` : ""}`,
			)
			.join("\n");

		const elementsList = pageInfo.elements
			.slice(0, 30)
			.map((e) => `- [${e.type}] "${e.text}" (${e.selector})`)
			.join("\n");

		const stepsRemaining = maxSteps - stepIndex - 1;
		const budgetNote =
			stepsRemaining <= 3
				? `⚠️ ONLY ${stepsRemaining} steps remaining! Start wrapping up — navigate to the most important remaining page, then use "done".`
				: stepsRemaining <= 5
					? `You have ${stepsRemaining} steps left. Make sure you cover the key pages before finishing.`
					: `You have ${stepsRemaining} steps remaining out of ${maxSteps} total. Take your time exploring.`;

		const prompt = `Goal: ${goal}

STEP BUDGET: Step ${stepIndex + 1} of ${maxSteps}. ${budgetNote}

Current page:
URL: ${pageInfo.url}
Title: ${pageInfo.title}

Visible text (first 500 chars):
${pageInfo.visibleText.slice(0, 500)}

Interactive elements:
${elementsList || "(no interactive elements found)"}

Previous steps:
${prevSummary || "(none — this is the first action)"}

What's the next action? Respond with JSON only.`;

		console.log(
			`[DemoAgent] Step ${stepIndex + 1}/${maxSteps} — sending prompt (${prompt.length} chars)`,
		);

		const result = await window.electronAPI.aiAnalyze(prompt, AGENT_SYSTEM_PROMPT);

		if (!result?.success || !result.text) {
			const rawErr = result?.error ?? "empty response";
			console.warn("[DemoAgent] AI call failed:", rawErr);

			// Translate common API errors to user-friendly messages
			let friendlyError = "AI unavailable";
			const lower = rawErr.toLowerCase();
			if (lower.includes("key") || lower.includes("auth") || lower.includes("login fail")) {
				friendlyError = "API key invalid or missing — check Settings";
			} else if (
				lower.includes("credit") ||
				lower.includes("quota") ||
				lower.includes("insufficient") ||
				lower.includes("billing") ||
				lower.includes("rate")
			) {
				friendlyError = "Out of API credits — check your provider billing";
			} else if (lower.includes("timeout") || lower.includes("timed out")) {
				friendlyError = "AI request timed out — retrying";
			} else if (lower.includes("model") || lower.includes("not found")) {
				friendlyError = "Model not available — try a different one";
			}

			return {
				action: "scroll",
				value: "down",
				narration: "",
				waitMs: 1500,
				reasoning: friendlyError,
			};
		}

		console.log("[DemoAgent] AI response:", result.text.slice(0, 300));

		try {
			let json = result.text.trim();
			// Strip thinking tags (MiniMax)
			json = json.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
			const match = json.match(/\{[\s\S]*\}/);
			if (match) json = match[0];
			const parsed = JSON.parse(json) as DemoAction;
			parsed.narration = "";

			// Guard: reject "done" before minimum steps (models often ignore the prompt rule)
			const MIN_STEPS = Math.min(8, maxSteps);
			if (parsed.action === "done" && stepIndex < MIN_STEPS - 1) {
				console.warn(
					`[DemoAgent] Model tried "done" at step ${stepIndex + 1}/${maxSteps}, forcing scroll`,
				);
				return {
					action: "scroll",
					value: "down",
					narration: "",
					waitMs: 1500,
					reasoning: "Forced: model tried to stop early",
				};
			}

			return parsed;
		} catch {
			console.warn("[DemoAgent] Failed to parse JSON from:", result.text.slice(0, 200));
			// Don't give up — scroll and let next iteration try again
			return {
				action: "scroll",
				value: "down",
				narration: "",
				waitMs: 1500,
				reasoning: "Parse error — scrolling instead",
			};
		}
	}

	async function executeAction(driver: WebviewDriver, action: DemoAction): Promise<void> {
		switch (action.action) {
			case "click":
				if (action.target) await driver.click(action.target);
				break;
			case "type":
				if (action.target && action.value) await driver.type(action.target, action.value);
				break;
			case "scroll":
				await driver.scroll(action.value === "up" ? "up" : "down");
				break;
			case "navigate":
				if (action.target) await driver.loadURL(action.target);
				break;
			case "wait":
				await new Promise((r) => setTimeout(r, action.waitMs ?? 2000));
				break;
		}
	}

	// ── Main agent loop ──

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

			// Start elapsed timer
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
			const allSteps: DemoStep[] = [];

			try {
				// Navigate to URL
				onMessage(createMessage("system", `Starting demo of ${config.url}...`));
				await driver.loadURL(config.url);
				await new Promise((r) => setTimeout(r, 2000));

				if (stoppedRef.current) return;

				// Initial screenshot + narration
				const initialScreenshot = await driver.screenshot();
				const initialPageInfo = await driver.getPageInfo();
				const initialNarration = await narrateScreenshot(initialScreenshot, initialPageInfo);

				const initialStep: DemoStep = {
					action: { action: "navigate", target: config.url, narration: initialNarration },
					timestamp: 0,
					screenshotDataUrl: initialScreenshot,
				};
				allSteps.push(initialStep);
				setSteps([...allSteps]);
				setCurrentStepIndex(0);

				onMessage(
					createMessage("narration", initialNarration, {
						screenshotDataUrl: initialScreenshot,
					}),
				);

				// Agent loop
				for (let i = 0; i < config.maxSteps; i++) {
					if (stoppedRef.current) break;

					try {
						// Wait a beat for any in-flight navigation to settle
						await new Promise((r) => setTimeout(r, 300));

						const pageInfo = await driver.getPageInfo();

						// Thinking
						onMessage(createMessage("thinking", "Analyzing page..."));

						const action = await getNextAction(
							config.prompt,
							pageInfo,
							i,
							config.maxSteps,
							allSteps,
						);

						if (stoppedRef.current) break;

						// Pause
						if (action.action === "pause") {
							setStatus("paused");
							const screenshot = await driver.screenshot();
							action.narration =
								"Demo paused — complete the login or authentication, then click Continue.";
							const pauseStep: DemoStep = {
								action,
								timestamp: Date.now() - startTimeRef.current,
								screenshotDataUrl: screenshot,
							};
							allSteps.push(pauseStep);
							setSteps([...allSteps]);

							onMessage(createMessage("pause", action.narration));

							await new Promise<void>((resolve) => {
								resumeResolverRef.current = resolve;
							});
							resumeResolverRef.current = null;
							setStatus("running");
							await new Promise((r) => setTimeout(r, 2000));
							continue;
						}

						// Done
						if (action.action === "done") {
							const finalScreenshot = await driver.screenshot();
							const finalPageInfo = await driver.getPageInfo();
							action.narration = await narrateScreenshot(finalScreenshot, finalPageInfo);
							const doneStep: DemoStep = {
								action,
								timestamp: Date.now() - startTimeRef.current,
								screenshotDataUrl: finalScreenshot,
							};
							allSteps.push(doneStep);
							setSteps([...allSteps]);

							onMessage(
								createMessage("narration", action.narration, {
									screenshotDataUrl: finalScreenshot,
								}),
							);
							break;
						}

						// Execute action
						let actionLabel =
							action.action === "click"
								? `Clicked: ${action.target}`
								: action.action === "scroll"
									? `Scrolled ${action.value ?? "down"}`
									: action.action === "type"
										? `Typed: "${action.value}" into ${action.target}`
										: action.action === "navigate"
											? `Navigated to ${action.target}`
											: `Waited ${action.waitMs ?? 2000}ms`;
						if (action.reasoning) {
							actionLabel += ` — ${action.reasoning}`;
						}

						onMessage(
							createMessage("action", actionLabel, {
								actionType: action.action,
								actionTarget: action.target,
							}),
						);

						await executeAction(driver, action);
						await new Promise((r) => setTimeout(r, action.waitMs ?? 1500));

						if (stoppedRef.current) break;

						// Screenshot + narrate
						const screenshot = await driver.screenshot();
						const postPageInfo = await driver.getPageInfo();
						action.narration = await narrateScreenshot(screenshot, postPageInfo);

						const step: DemoStep = {
							action,
							timestamp: Date.now() - startTimeRef.current,
							screenshotDataUrl: screenshot,
						};
						allSteps.push(step);
						setSteps([...allSteps]);
						setCurrentStepIndex(allSteps.length - 1);

						onMessage(
							createMessage("narration", action.narration, {
								screenshotDataUrl: screenshot,
							}),
						);
					} catch (stepErr) {
						// Log the error but continue to the next step
						console.warn(`DemoAgent: step ${i + 1} failed, continuing:`, stepErr);
						onMessage(createMessage("system", `Step recovered — retrying...`));
						// Wait for page to settle before retrying
						await new Promise((r) => setTimeout(r, 2000));
					}
				}

				// Complete
				if (!stoppedRef.current) {
					setStatus("complete");
					onMessage(
						createMessage("completion", `Demo complete! ${allSteps.length} steps captured.`),
					);
				}
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
		// eslint-disable-next-line -- agent helpers are stable within the hook scope
		[webviewRef, onMessage, executeAction, getNextAction, narrateScreenshot],
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
