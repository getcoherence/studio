/**
 * Browser Driver — uses Electron's own BrowserWindow for demo recording.
 * No external Chrome spawning needed — Electron IS Chromium.
 */

import { BrowserWindow } from "electron";

// ── Types ────────────────────────────────────────────────────────────────

export interface PageInfo {
	url: string;
	title: string;
	visibleText: string;
	elements: PageElement[];
}

export interface PageElement {
	type: "button" | "link" | "input" | "select";
	text: string;
	selector: string;
	visible: boolean;
}

// ── BrowserDriver class ─────────────────────────────────────────────────

export class BrowserDriver {
	private win: BrowserWindow | null = null;

	async launch(options?: {
		headless?: boolean;
		viewport?: { width: number; height: number };
	}): Promise<void> {
		const viewport = options?.viewport ?? { width: 1280, height: 720 };

		this.win = new BrowserWindow({
			width: viewport.width,
			height: viewport.height,
			show: !options?.headless,
			title: "Lucid Demo Browser",
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: true,
			},
		});
	}

	async navigateTo(url: string): Promise<void> {
		if (!this.win) throw new Error("Browser not launched");
		await this.win.loadURL(url);
	}

	async click(selector: string): Promise<void> {
		if (!this.win) throw new Error("Browser not launched");
		const wc = this.win.webContents;

		await wc.executeJavaScript(`
			(function() {
				const sel = ${JSON.stringify(selector)};
				// Try CSS selector
				let el = document.querySelector(sel);
				// Try text match
				if (!el) {
					const all = [...document.querySelectorAll('a, button, [role="button"], input[type="submit"]')];
					el = all.find(e => e.innerText?.trim().toLowerCase().includes(sel.toLowerCase())
						|| e.getAttribute('aria-label')?.toLowerCase().includes(sel.toLowerCase()));
				}
				if (el) {
					el.scrollIntoView({ block: 'center' });
					el.click();
					return true;
				}
				return false;
			})()
		`);

		// Wait for any navigation triggered by the click
		await new Promise((r) => setTimeout(r, 1000));
	}

	async type(selector: string, text: string, _options?: { delay?: number }): Promise<void> {
		if (!this.win) throw new Error("Browser not launched");
		const wc = this.win.webContents;

		await wc.executeJavaScript(`
			(function() {
				const sel = ${JSON.stringify(selector)};
				let el = document.querySelector(sel);
				if (!el) {
					const all = [...document.querySelectorAll('input, textarea')];
					el = all.find(e => e.getAttribute('placeholder')?.toLowerCase().includes(sel.toLowerCase())
						|| e.getAttribute('name')?.toLowerCase().includes(sel.toLowerCase()));
				}
				if (el) {
					el.focus();
					el.value = ${JSON.stringify(text)};
					el.dispatchEvent(new Event('input', { bubbles: true }));
					el.dispatchEvent(new Event('change', { bubbles: true }));
				}
			})()
		`);
	}

	async scroll(direction: "up" | "down", amount?: number): Promise<void> {
		if (!this.win) throw new Error("Browser not launched");
		const delta = amount ?? 400;
		const scrollY = direction === "down" ? delta : -delta;
		await this.win.webContents.executeJavaScript(
			`window.scrollBy({ top: ${scrollY}, behavior: 'smooth' })`,
		);
		await new Promise((r) => setTimeout(r, 500));
	}

	async screenshot(): Promise<Buffer> {
		if (!this.win) throw new Error("Browser not launched");
		const image = await this.win.webContents.capturePage();
		return image.toPNG();
	}

	async waitForNavigation(timeout?: number): Promise<void> {
		if (!this.win) throw new Error("Browser not launched");
		await new Promise<void>((resolve) => {
			const t = setTimeout(resolve, timeout ?? 5000);
			this.win!.webContents.once("did-finish-load", () => {
				clearTimeout(t);
				resolve();
			});
		});
	}

	async getPageInfo(): Promise<PageInfo> {
		if (!this.win) throw new Error("Browser not launched");
		const wc = this.win.webContents;

		const url = wc.getURL();
		const title = wc.getTitle();

		const result = await wc.executeJavaScript(`
			(function() {
				const visibleText = (document.body?.innerText || '').slice(0, 2000);
				const elements = [];

				function isVisible(el) {
					const rect = el.getBoundingClientRect();
					if (rect.width === 0 || rect.height === 0) return false;
					const style = window.getComputedStyle(el);
					return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
				}

				function getText(el) {
					return (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim().slice(0, 80);
				}

				function buildSelector(el) {
					if (el.id) return '#' + el.id;
					const tag = el.tagName.toLowerCase();
					const text = getText(el);
					if (text) return text.slice(0, 40);
					return tag;
				}

				for (const el of document.querySelectorAll('button, [role="button"], input[type="submit"]')) {
					const text = getText(el);
					if (text && isVisible(el)) elements.push({ type: 'button', text, selector: buildSelector(el), visible: true });
				}
				for (const el of document.querySelectorAll('a[href]')) {
					const text = getText(el);
					if (text && isVisible(el)) elements.push({ type: 'link', text, selector: buildSelector(el), visible: true });
				}
				for (const el of document.querySelectorAll('input:not([type="hidden"]), textarea')) {
					const text = getText(el) || el.getAttribute('type') || 'text';
					if (isVisible(el)) elements.push({ type: 'input', text, selector: buildSelector(el), visible: true });
				}

				return { visibleText, elements: elements.slice(0, 50) };
			})()
		`);

		return { url, title, visibleText: result.visibleText, elements: result.elements };
	}

	/** Hide the demo browser (minimize) so the main window is accessible. */
	hide(): void {
		if (this.win && !this.win.isDestroyed()) {
			this.win.minimize();
		}
	}

	/** Show the demo browser again after it was hidden. */
	show(): void {
		if (this.win && !this.win.isDestroyed()) {
			this.win.restore();
			this.win.focus();
		}
	}

	async close(): Promise<void> {
		if (this.win && !this.win.isDestroyed()) {
			this.win.close();
		}
		this.win = null;
	}

	getWindow(): BrowserWindow | null {
		return this.win;
	}
}
