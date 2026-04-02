/**
 * WebviewDriver — renderer-side browser driver for Electron's <webview> tag.
 * Mirrors the BrowserDriver interface from electron/automation/browserDriver.ts
 * but operates on a DOM webview element instead of a BrowserWindow.
 *
 * All executeJavaScript calls are wrapped in try/catch to handle
 * navigation-induced failures (GUEST_VIEW_MANAGER_CALL errors).
 */

import type { PageInfo } from "./types";

/** Safe wrapper — if executeJavaScript fails (e.g. page navigating), returns fallback. */
async function safeExec<T>(wv: Electron.WebviewTag, code: string, fallback: T): Promise<T> {
	try {
		return await wv.executeJavaScript(code);
	} catch (err) {
		console.warn("WebviewDriver: executeJavaScript failed (page may be navigating):", err);
		return fallback;
	}
}

export class WebviewDriver {
	private wv: Electron.WebviewTag;

	constructor(webview: Electron.WebviewTag) {
		this.wv = webview;
	}

	async loadURL(url: string): Promise<void> {
		this.wv.loadURL(url);
		await this.waitForNavigation();
	}

	async click(selector: string): Promise<void> {
		await safeExec(
			this.wv,
			`(function() {
				const sel = ${JSON.stringify(selector)};
				let el = document.querySelector(sel);
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
			})()`,
			false,
		);

		// Wait for any navigation the click may have triggered
		await this.settleAfterAction();
	}

	async type(selector: string, text: string): Promise<void> {
		await safeExec(
			this.wv,
			`(function() {
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
			})()`,
			undefined,
		);
	}

	async scroll(direction: "up" | "down", amount?: number): Promise<void> {
		const delta = amount ?? 400;
		const scrollY = direction === "down" ? delta : -delta;
		await safeExec(this.wv, `window.scrollBy({ top: ${scrollY}, behavior: 'smooth' })`, undefined);
		await new Promise((r) => setTimeout(r, 500));
	}

	async screenshot(): Promise<string> {
		try {
			const image = await this.wv.capturePage();
			return image.toDataURL();
		} catch (err) {
			console.warn("WebviewDriver: capturePage failed:", err);
			// Return a 1px transparent PNG as fallback
			return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==";
		}
	}

	async waitForNavigation(timeout?: number): Promise<void> {
		await new Promise<void>((resolve) => {
			const t = setTimeout(resolve, timeout ?? 5000);
			const handler = () => {
				clearTimeout(t);
				this.wv.removeEventListener("did-finish-load", handler);
				resolve();
			};
			this.wv.addEventListener("did-finish-load", handler);
		});
	}

	/**
	 * Wait for page to settle after a click or navigation.
	 * Waits for either did-finish-load (if navigating) or a short timeout.
	 */
	private async settleAfterAction(): Promise<void> {
		await new Promise<void>((resolve) => {
			// Short race: if did-finish-load fires within 2s, great. Otherwise move on.
			const t = setTimeout(resolve, 2000);
			const handler = () => {
				clearTimeout(t);
				this.wv.removeEventListener("did-finish-load", handler);
				// Give the new page a moment to render
				setTimeout(resolve, 500);
			};
			this.wv.addEventListener("did-finish-load", handler);
		});
	}

	async getPageInfo(): Promise<PageInfo> {
		const url = this.wv.getURL();
		const title = this.wv.getTitle();

		const result = await safeExec(
			this.wv,
			`(function() {
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
			})()`,
			{ visibleText: "", elements: [] },
		);

		return { url, title, visibleText: result.visibleText, elements: result.elements };
	}

	getURL(): string {
		return this.wv.getURL();
	}

	getTitle(): string {
		return this.wv.getTitle();
	}
}
