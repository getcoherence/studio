/**
 * Browser Driver — Playwright-core wrapper for AI demo recording.
 * Launches a system Chrome/Edge browser and provides high-level actions.
 */

import fs from "node:fs";
// Playwright is loaded via createRequire because it's a CJS package
// and dynamic import() fails with __dirname errors in ESM context
import { createRequire } from "node:module";
import path from "node:path";

type Browser = import("playwright-core").Browser;
type BrowserContext = import("playwright-core").BrowserContext;
type Page = import("playwright-core").Page;

async function getChromium() {
	const require = createRequire(import.meta.url);
	const pw = require("playwright-core") as typeof import("playwright-core");
	return pw.chromium;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface PageInfo {
	url: string;
	title: string;
	visibleText: string; // first ~2000 chars
	elements: PageElement[];
}

export interface PageElement {
	type: "button" | "link" | "input" | "select";
	text: string;
	selector: string;
	visible: boolean;
}

// ── Browser executable discovery ─────────────────────────────────────────

const CHROME_PATHS_WIN = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const EDGE_PATHS_WIN = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"];

const CHROME_PATHS_MAC = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

function findBrowserExecutable(): string | undefined {
	const candidates =
		process.platform === "darwin" ? CHROME_PATHS_MAC : [...CHROME_PATHS_WIN, ...EDGE_PATHS_WIN];

	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return undefined;
}

// ── BrowserDriver class ─────────────────────────────────────────────────

export class BrowserDriver {
	private browser: Browser | null = null;
	private context: BrowserContext | null = null;
	private page: Page | null = null;

	async launch(options?: {
		headless?: boolean;
		viewport?: { width: number; height: number };
	}): Promise<void> {
		const executablePath = findBrowserExecutable();
		if (!executablePath) {
			throw new Error(
				"Could not find Chrome or Edge on this system. Please install Google Chrome.",
			);
		}

		const viewport = options?.viewport ?? { width: 1280, height: 720 };

		// Playwright's chromium.launch() uses its own spawn which fails inside
		// Electron's main process. Instead, we manually spawn Chrome with a
		// remote debugging port and connect Playwright via CDP.
		const debugPort = 9222 + Math.floor(Math.random() * 1000);
		const userDataDir = path.join((await import("node:os")).tmpdir(), `lucid-demo-${Date.now()}`);

		const chromeArgs = [
			`--remote-debugging-port=${debugPort}`,
			`--window-size=${viewport.width},${viewport.height}`,
			`--user-data-dir=${userDataDir}`,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-default-apps",
			...(options?.headless ? ["--headless=new"] : []),
		];

		console.log("[DemoRecorder] Launching Chrome:", executablePath);

		// spawn UNKNOWN in Electron is caused by cwd being inside ASAR.
		// Fix: set cwd explicitly to a real directory (os.homedir or tmpdir).
		// See: https://github.com/electron/electron/issues/30983
		const os = await import("node:os");
		const { spawn } = await import("node:child_process");

		const chromeProcess = spawn(executablePath, chromeArgs, {
			cwd: os.homedir(), // CRITICAL: must be a real dir, not inside ASAR
			stdio: "ignore",
			detached: true,
		});
		chromeProcess.unref();

		// Wait for Chrome to start and open the debug port
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(
				() =>
					reject(new Error(`Chrome failed to start on port ${debugPort}. Path: ${executablePath}`)),
				15000,
			);
			const check = async () => {
				try {
					const resp = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
					if (resp.ok) {
						clearTimeout(timeout);
						resolve();
						return;
					}
				} catch {
					// Not ready yet
				}
				setTimeout(check, 200);
			};
			check();
			chromeProcess.on("error", (err) => {
				clearTimeout(timeout);
				reject(err);
			});
		});

		// Connect Playwright to the running Chrome via CDP
		const chromium = await getChromium();
		this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);

		// CDP connection uses the browser's default context
		const contexts = this.browser.contexts();
		this.context = contexts[0] ?? (await this.browser.newContext({ viewport }));

		const pages = this.context.pages();
		this.page = pages[0] ?? (await this.context.newPage());
		await this.page.setViewportSize(viewport);
	}

	async navigateTo(url: string): Promise<void> {
		if (!this.page) throw new Error("Browser not launched");
		await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
	}

	async click(selector: string): Promise<void> {
		if (!this.page) throw new Error("Browser not launched");

		try {
			// Try CSS selector first
			const el = this.page.locator(selector).first();
			await el.click({ timeout: 5_000 });
		} catch {
			// Fall back to text-based selector
			try {
				await this.page.getByText(selector, { exact: false }).first().click({ timeout: 5_000 });
			} catch {
				// Last resort: try as role button/link
				try {
					await this.page
						.getByRole("link", { name: selector })
						.or(this.page.getByRole("button", { name: selector }))
						.first()
						.click({ timeout: 5_000 });
				} catch {
					console.warn(`BrowserDriver: could not find element to click: "${selector}"`);
				}
			}
		}
	}

	async type(selector: string, text: string, options?: { delay?: number }): Promise<void> {
		if (!this.page) throw new Error("Browser not launched");
		const delay = options?.delay ?? 75;

		try {
			const el = this.page.locator(selector).first();
			await el.click({ timeout: 5_000 });
			await el.fill("");
			await el.pressSequentially(text, { delay });
		} catch {
			// Fall back to text-based selector for the input
			try {
				const el = this.page.getByPlaceholder(selector).first();
				await el.click({ timeout: 5_000 });
				await el.fill("");
				await el.pressSequentially(text, { delay });
			} catch {
				console.warn(`BrowserDriver: could not find element to type into: "${selector}"`);
			}
		}
	}

	async scroll(direction: "up" | "down", amount?: number): Promise<void> {
		if (!this.page) throw new Error("Browser not launched");
		const delta = amount ?? 400;
		await this.page.mouse.wheel(0, direction === "down" ? delta : -delta);
	}

	async screenshot(): Promise<Buffer> {
		if (!this.page) throw new Error("Browser not launched");
		const buffer = await this.page.screenshot({ type: "png" });
		return Buffer.from(buffer);
	}

	async waitForNavigation(timeout?: number): Promise<void> {
		if (!this.page) throw new Error("Browser not launched");
		try {
			await this.page.waitForLoadState("domcontentloaded", { timeout: timeout ?? 10_000 });
		} catch {
			// Timeout is acceptable — page may already be loaded
		}
	}

	async getPageInfo(): Promise<PageInfo> {
		if (!this.page) throw new Error("Browser not launched");

		const url = this.page.url();
		const title = await this.page.title();

		// Extract visible text (truncated)
		const visibleText = await this.page.evaluate(() => {
			const body = document.body;
			if (!body) return "";
			return (body.innerText || "").slice(0, 2000);
		});

		// Extract interactive elements
		const elements = await this.page.evaluate(() => {
			const results: Array<{
				type: "button" | "link" | "input" | "select";
				text: string;
				selector: string;
				visible: boolean;
			}> = [];

			function isVisible(el: HTMLElement): boolean {
				const rect = el.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return false;
				const style = window.getComputedStyle(el);
				return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
			}

			function getText(el: HTMLElement): string {
				return (
					el.getAttribute("aria-label") ||
					el.getAttribute("title") ||
					el.innerText ||
					el.getAttribute("placeholder") ||
					el.getAttribute("name") ||
					""
				)
					.trim()
					.slice(0, 80);
			}

			function buildSelector(el: HTMLElement): string {
				if (el.id) return `#${el.id}`;
				const tag = el.tagName.toLowerCase();
				const classes = Array.from(el.classList)
					.filter((c) => !c.startsWith("_") && c.length < 30)
					.slice(0, 2);
				if (classes.length > 0) return `${tag}.${classes.join(".")}`;
				const text = getText(el);
				if (text) return `${tag}:has-text("${text.slice(0, 40)}")`;
				return tag;
			}

			// Buttons
			for (const el of document.querySelectorAll<HTMLElement>(
				'button, [role="button"], input[type="submit"], input[type="button"]',
			)) {
				const text = getText(el);
				if (!text) continue;
				results.push({
					type: "button",
					text,
					selector: buildSelector(el),
					visible: isVisible(el),
				});
			}

			// Links
			for (const el of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
				const text = getText(el);
				if (!text) continue;
				results.push({
					type: "link",
					text,
					selector: buildSelector(el),
					visible: isVisible(el),
				});
			}

			// Inputs
			for (const el of document.querySelectorAll<HTMLInputElement>(
				'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea',
			)) {
				const text = getText(el);
				results.push({
					type: "input",
					text: text || el.getAttribute("type") || "text input",
					selector: buildSelector(el),
					visible: isVisible(el),
				});
			}

			// Selects
			for (const el of document.querySelectorAll<HTMLSelectElement>("select")) {
				const text = getText(el);
				results.push({
					type: "select",
					text: text || "dropdown",
					selector: buildSelector(el),
					visible: isVisible(el),
				});
			}

			// Only return visible elements, cap at 50
			return results.filter((r) => r.visible).slice(0, 50);
		});

		return { url, title, visibleText, elements };
	}

	async close(): Promise<void> {
		try {
			if (this.context) {
				await this.context.close();
				this.context = null;
			}
		} catch {
			// Ignore close errors
		}
		try {
			if (this.browser) {
				await this.browser.close();
				this.browser = null;
			}
		} catch {
			// Ignore close errors
		}
		this.page = null;
	}

	getPage(): Page | null {
		return this.page;
	}
}
