/**
 * AI Demo Agent — drives a browser to create product demo recordings.
 *
 * The agent loop:
 * 1. Gets page context (title, elements, visible text)
 * 2. Asks the LLM for the next action
 * 3. Executes the action via BrowserDriver
 * 4. Collects screenshots + narration at each step
 * 5. Repeats until the LLM says "done" or max steps reached
 */

import { analyze, analyzeImage, loadAIConfig, supportsVision } from "../ai/aiService";
import { BrowserDriver, type PageInfo } from "./browserDriver";

// ── Types ────────────────────────────────────────────────────────────────

export interface DemoAction {
	action: "click" | "type" | "scroll" | "navigate" | "wait" | "pause" | "done";
	target?: string;
	value?: string;
	narration: string;
	waitMs?: number;
	reasoning?: string;
}

export interface DemoStep {
	action: DemoAction;
	timestamp: number; // ms from start
	screenshot?: Buffer;
	clickPosition?: { x: number; y: number };
}

export interface DemoConfig {
	url: string;
	prompt: string;
	maxSteps?: number;
	viewport?: { width: number; height: number };
	headless?: boolean;
}

export interface DemoResult {
	steps: DemoStep[];
	totalDurationMs: number;
	narrationText: string; // combined narration for captions
}

// ── System prompt ────────────────────────────────────────────────────────

// Action-decision prompt (text-only, no narration needed — vision handles that)
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

// Vision narration prompt — sent with the screenshot for multimodal description
const VISION_NARRATION_PROMPT = `You are a professional product demo narrator. You are looking at a screenshot from a live product walkthrough.

Describe what you SEE on screen in 1-2 sentences, as if you are presenting to an audience watching the demo video. Be specific about the UI elements, data, and layout visible. Use present tense.

Rules:
- Describe what IS on screen, not what was clicked or what will happen next
- Be professional and engaging, like a product launch presentation
- Reference specific UI elements: "the analytics dashboard shows three metric cards", not "the page has some content"
- If it's a landing page, mention the headline and key value proposition
- If it's an app UI, describe the layout and what data/features are visible
- Keep it concise — 1-2 sentences max, suitable for voiceover narration`;

// Fallback narration prompt for non-vision providers (text-only)
const TEXT_NARRATION_PROMPT = `Based on the following page context from a product demo, write 1-2 sentences of voiceover narration describing what the viewer would see on screen. Be specific and professional, like a product launch presentation.

Page URL: {url}
Page Title: {title}
Visible content (excerpt): {visibleText}

Write the narration only, no quotes or explanation:`;

// ── DemoAgent class ──────────────────────────────────────────────────────

export class DemoAgent {
	private driver: BrowserDriver;
	private steps: DemoStep[] = [];
	private startTime: number = 0;
	private stopped: boolean = false;
	private useVision: boolean = false;
	private onProgress?: (step: DemoStep, stepIndex: number) => void;
	private resumeResolver: (() => void) | null = null;

	constructor(onProgress?: (step: DemoStep, stepIndex: number) => void) {
		this.driver = new BrowserDriver();
		this.onProgress = onProgress;
	}

	async run(config: DemoConfig): Promise<DemoResult> {
		this.stopped = false;
		this.steps = [];

		// Check if vision is available for screenshot-based narration
		const aiConfig = await loadAIConfig();
		this.useVision = supportsVision(aiConfig.provider);
		console.log(`DemoAgent: provider=${aiConfig.provider}, vision=${this.useVision}`);

		await this.driver.launch({
			headless: config.headless ?? false,
			viewport: config.viewport,
		});
		await this.driver.navigateTo(config.url);

		// Wait for the page to fully settle after initial navigation
		await this.driver.waitForNavigation();
		await new Promise((r) => setTimeout(r, 2000));

		this.startTime = Date.now();

		// Take initial screenshot and narrate it with vision
		const initialScreenshot = await this.driver.screenshot();
		const initialNarration = await this.narrateScreenshot(
			initialScreenshot,
			await this.driver.getPageInfo(),
		);
		const initialStep: DemoStep = {
			action: {
				action: "navigate",
				target: config.url,
				narration: initialNarration,
			},
			timestamp: 0,
			screenshot: initialScreenshot,
		};
		this.steps.push(initialStep);
		this.onProgress?.(initialStep, 0);

		const maxSteps = config.maxSteps ?? 15;

		for (let i = 0; i < maxSteps; i++) {
			if (this.stopped) break;

			// 1. Get page context
			const pageInfo = await this.driver.getPageInfo();

			// 2. Ask AI what to do next (action only, no narration)
			const action = await this.getNextAction(config.prompt, pageInfo, i, maxSteps);

			// 3. If pause, hide browser and wait for user to resume
			if (action.action === "pause") {
				const screenshot = await this.driver.screenshot();
				action.narration =
					"The demo is paused — please complete the login or authentication, then click Continue.";

				// Hide the demo browser so the main window's Continue button is accessible
				this.driver.hide();

				const pauseStep: DemoStep = {
					action,
					timestamp: Date.now() - this.startTime,
					screenshot,
				};
				this.steps.push(pauseStep);
				this.onProgress?.(pauseStep, this.steps.length - 1);

				// Wait for resume() to be called
				await new Promise<void>((resolve) => {
					this.resumeResolver = resolve;
				});
				this.resumeResolver = null;

				// Restore the demo browser and wait for page to settle
				this.driver.show();
				await new Promise((r) => setTimeout(r, 2000));
				continue;
			}

			// 4. If done, capture final screenshot and narrate
			if (action.action === "done") {
				const finalScreenshot = await this.driver.screenshot();
				const finalPageInfo = await this.driver.getPageInfo();
				action.narration = await this.narrateScreenshot(finalScreenshot, finalPageInfo);
				const doneStep: DemoStep = {
					action,
					timestamp: Date.now() - this.startTime,
					screenshot: finalScreenshot,
				};
				this.steps.push(doneStep);
				this.onProgress?.(doneStep, this.steps.length - 1);
				break;
			}

			// 5. Execute the action
			await this.executeAction(action);

			// 6. Wait for page to settle
			await new Promise((r) => setTimeout(r, action.waitMs ?? 1500));

			// 7. Take screenshot AFTER action, then narrate what's visible
			const screenshot = await this.driver.screenshot();
			const postActionPageInfo = await this.driver.getPageInfo();
			action.narration = await this.narrateScreenshot(screenshot, postActionPageInfo);

			const step: DemoStep = {
				action,
				timestamp: Date.now() - this.startTime,
				screenshot,
			};

			this.steps.push(step);
			this.onProgress?.(step, this.steps.length - 1);
		}

		const narrationText = this.steps
			.map((s) => s.action.narration)
			.filter(Boolean)
			.join("\n\n");

		await this.driver.close();

		return {
			steps: this.steps,
			totalDurationMs: Date.now() - this.startTime,
			narrationText,
		};
	}

	/**
	 * Use vision model to narrate a screenshot, or fall back to text-based narration.
	 */
	private async narrateScreenshot(screenshot: Buffer, pageInfo: PageInfo): Promise<string> {
		try {
			if (this.useVision) {
				const imageBase64 = screenshot.toString("base64");
				const result = await analyzeImage(
					"Describe what you see on this screen for a product demo voiceover.",
					imageBase64,
					VISION_NARRATION_PROMPT,
				);
				if (result.success && result.text) {
					return result.text.replace(/^["']|["']$/g, "").trim();
				}
			}

			// Fallback: text-based narration from page context
			const textPrompt = TEXT_NARRATION_PROMPT.replace("{url}", pageInfo.url)
				.replace("{title}", pageInfo.title)
				.replace("{visibleText}", pageInfo.visibleText.slice(0, 500));
			const result = await analyze(textPrompt);
			if (result.success && result.text) {
				return result.text.replace(/^["']|["']$/g, "").trim();
			}
		} catch (err) {
			console.warn("DemoAgent: narration failed:", err);
		}
		return `Viewing ${pageInfo.title || pageInfo.url}.`;
	}

	private async getNextAction(
		goal: string,
		pageInfo: PageInfo,
		stepIndex: number,
		maxSteps: number = 12,
	): Promise<DemoAction> {
		const previousSteps = this.steps
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
${previousSteps || "(none — this is the first action)"}

What's the next action? Respond with JSON only.`;

		const result = await analyze(prompt, AGENT_SYSTEM_PROMPT);
		if (!result.success || !result.text) {
			return { action: "done", narration: "" };
		}

		// Parse JSON from response
		try {
			let json = result.text.trim();
			const match = json.match(/\{[\s\S]*\}/);
			if (match) json = match[0];
			const parsed = JSON.parse(json) as DemoAction;
			// Narration will be filled in after the screenshot is taken
			parsed.narration = "";
			return parsed;
		} catch {
			console.warn("DemoAgent: failed to parse AI response:", result.text);
			return { action: "done", narration: "" };
		}
	}

	private async executeAction(action: DemoAction): Promise<void> {
		switch (action.action) {
			case "click":
				if (action.target) await this.driver.click(action.target);
				break;
			case "type":
				if (action.target && action.value) {
					await this.driver.type(action.target, action.value);
				}
				break;
			case "scroll":
				await this.driver.scroll(action.value === "up" ? "up" : "down");
				break;
			case "navigate":
				if (action.target) await this.driver.navigateTo(action.target);
				break;
			case "wait":
				await new Promise((r) => setTimeout(r, action.waitMs ?? 2000));
				break;
		}
	}

	async stop(): Promise<void> {
		this.stopped = true;
		// Resolve any pending pause
		if (this.resumeResolver) {
			this.resumeResolver();
			this.resumeResolver = null;
		}
		await this.driver.close();
	}

	resume(): void {
		if (this.resumeResolver) {
			this.resumeResolver();
		}
	}

	get isPaused(): boolean {
		return this.resumeResolver !== null;
	}
}
