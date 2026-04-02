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

import { analyze } from "../ai/aiService";
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

const AGENT_SYSTEM_PROMPT = `You are an AI demo recorder. You control a web browser to create professional product demo videos.

For each step, you receive:
- Current page URL and title
- Visible text content (summarized)
- List of interactive elements (buttons, links, inputs)

Your goal is provided by the user.

Respond with ONE JSON action at a time. No markdown, no explanation outside the JSON:
{
  "action": "click|type|scroll|navigate|wait|pause|done",
  "target": "CSS selector or element text description",
  "value": "text for type action, or 'up'/'down' for scroll",
  "narration": "Describe what is CURRENTLY VISIBLE on screen (not what you're about to do). Write as a voiceover for what the viewer sees RIGHT NOW.",
  "waitMs": 1500,
  "reasoning": "Why this action moves the demo forward"
}

CRITICAL RULES:
- You MUST perform at least 8 actions before using "done". Do NOT stop early.
- Move slowly and deliberately (users need to see what's happening)
- Add 1-2 second pauses between actions (use waitMs: 1500-2000)
- IMPORTANT: The narration must describe what is CURRENTLY ON SCREEN, not what you're about to click. The screenshot is taken AFTER your action, so narrate what the viewer will SEE, not what you plan to do next.
- Write narration as if presenting to an audience — clear, professional, engaging
- Explore the site thoroughly: click navigation links, scroll to see content, visit 3-4 pages minimum
- A good demo shows: homepage → features/product page → pricing → signup/CTA
- Use "scroll" with value "down" to reveal content below the fold on each page
- When the demo goal is fully achieved AND you have at least 8 steps, use action "done"
- For click: use the element's EXACT text content from the elements list. Only click elements that appear in the list.
- If a menu item has a dropdown arrow (▾ or ▸) or is a group header, click a SPECIFIC subpage link instead, not the group.
- If clicking didn't navigate to a new page, try scrolling down or clicking a different link.
- For type: set target to the input selector and value to the text to type
- For scroll: set value to "up" or "down"
- For navigate: set target to the URL
- For pause: use when you detect a login page, OAuth prompt, or any screen requiring user input you can't handle. The user will complete the action manually, then the demo resumes.
- If you see "Sign In", "Log In", "OAuth", SSO buttons, or any authentication form, use action "pause" with narration explaining what the user should do.
- NEVER say "done" before step 8`;

// ── DemoAgent class ──────────────────────────────────────────────────────

export class DemoAgent {
	private driver: BrowserDriver;
	private steps: DemoStep[] = [];
	private startTime: number = 0;
	private stopped: boolean = false;
	private onProgress?: (step: DemoStep, stepIndex: number) => void;
	private resumeResolver: (() => void) | null = null;

	constructor(onProgress?: (step: DemoStep, stepIndex: number) => void) {
		this.driver = new BrowserDriver();
		this.onProgress = onProgress;
	}

	async run(config: DemoConfig): Promise<DemoResult> {
		this.stopped = false;
		this.steps = [];

		await this.driver.launch({
			headless: config.headless ?? false,
			viewport: config.viewport,
		});
		await this.driver.navigateTo(config.url);

		// Wait for the page to fully settle after initial navigation
		await this.driver.waitForNavigation();
		await new Promise((r) => setTimeout(r, 2000));

		this.startTime = Date.now();

		// Take initial screenshot
		const initialScreenshot = await this.driver.screenshot();
		const initialStep: DemoStep = {
			action: {
				action: "navigate",
				target: config.url,
				narration: `Let's take a look at ${new URL(config.url).hostname}.`,
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

			// 2. Ask AI what to do next
			const action = await this.getNextAction(config.prompt, pageInfo, i, maxSteps);

			// 3. If pause, wait for user to resume (e.g., after manual login)
			if (action.action === "pause") {
				const screenshot = await this.driver.screenshot();
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

				// After resume, wait for page to settle (user may have navigated)
				await new Promise((r) => setTimeout(r, 2000));
				continue;
			}

			// 4. If done, capture final screenshot and break
			if (action.action === "done") {
				const finalScreenshot = await this.driver.screenshot();
				const doneStep: DemoStep = {
					action,
					timestamp: Date.now() - this.startTime,
					screenshot: finalScreenshot,
				};
				this.steps.push(doneStep);
				this.onProgress?.(doneStep, this.steps.length - 1);
				break;
			}

			// 4. Execute the action
			await this.executeAction(action);

			// 5. Wait for page to settle
			await new Promise((r) => setTimeout(r, action.waitMs ?? 1500));

			// 6. Take a screenshot after the action
			const screenshot = await this.driver.screenshot();
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
			return { action: "done", narration: "Demo complete." };
		}

		// Parse JSON from response
		try {
			let json = result.text.trim();
			const match = json.match(/\{[\s\S]*\}/);
			if (match) json = match[0];
			return JSON.parse(json) as DemoAction;
		} catch {
			console.warn("DemoAgent: failed to parse AI response:", result.text);
			return { action: "done", narration: "Demo complete." };
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
