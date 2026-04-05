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
			const fullDataUrl = image.toDataURL();

			// Downscale for performance — large data URLs kill canvas rendering speed
			return await this.downscaleImage(fullDataUrl, 1280);
		} catch (err) {
			console.warn("WebviewDriver: capturePage failed:", err);
			return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==";
		}
	}

	private downscaleImage(dataUrl: string, maxWidth: number): Promise<string> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				if (img.width <= maxWidth) {
					resolve(dataUrl);
					return;
				}
				const scale = maxWidth / img.width;
				const canvas = document.createElement("canvas");
				canvas.width = maxWidth;
				canvas.height = Math.round(img.height * scale);
				const ctx = canvas.getContext("2d")!;
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/jpeg", 0.85));
			};
			img.onerror = () => resolve(dataUrl);
			img.src = dataUrl;
		});
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

	/**
	 * Scroll to a specific element on the page, centering it in the viewport.
	 * Accepts a CSS selector, element text, or "top"/"bottom".
	 */
	async scrollToElement(target: string): Promise<void> {
		if (target === "top") {
			await safeExec(this.wv, `window.scrollTo({ top: 0, behavior: 'smooth' })`, undefined);
		} else if (target === "bottom") {
			await safeExec(
				this.wv,
				`window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })`,
				undefined,
			);
		} else {
			await safeExec(
				this.wv,
				`(function() {
					const sel = ${JSON.stringify(target)};
					let el = document.querySelector(sel);
					if (!el) {
						const all = [...document.querySelectorAll('*')];
						el = all.find(e => e.innerText?.trim().toLowerCase().includes(sel.toLowerCase()));
					}
					if (el) {
						// Place heading near top of viewport (not center) so content below is visible
						var rect = el.getBoundingClientRect();
						var targetY = window.scrollY + rect.top - window.innerHeight * 0.15;
						window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
					}
				})()`,
				undefined,
			);
		}
		await new Promise((r) => setTimeout(r, 800));
	}

	/**
	 * Get the bounding rectangle of an element for zoom cropping.
	 * Returns null if the element is not found or not visible.
	 */
	async getElementBounds(
		selector: string,
	): Promise<{ x: number; y: number; width: number; height: number } | null> {
		return safeExec(
			this.wv,
			`(function() {
				const sel = ${JSON.stringify(selector)};
				let el = document.querySelector(sel);
				if (!el) {
					const all = [...document.querySelectorAll('*')];
					el = all.find(e => e.innerText?.trim().toLowerCase().includes(sel.toLowerCase()));
				}
				if (!el) return null;
				const rect = el.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return null;
				return {
					x: Math.round(rect.x),
					y: Math.round(rect.y),
					width: Math.round(rect.width),
					height: Math.round(rect.height)
				};
			})()`,
			null,
		);
	}

	/**
	 * Get all navigation links on the page (for recon phase site discovery).
	 */
	async getNavLinks(): Promise<{ text: string; href: string }[]> {
		return safeExec(
			this.wv,
			`(function() {
				const links = [];
				const seen = new Set();
				for (const el of document.querySelectorAll('a[href]')) {
					const href = el.href;
					const text = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 60);
					if (!text || !href || seen.has(href)) continue;
					if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
					if (href.includes('#') && href.split('#')[0] === location.href.split('#')[0]) continue;
					seen.add(href);
					links.push({ text, href });
				}
				return links.slice(0, 50);
			})()`,
			[],
		);
	}

	/**
	 * Get all section headings on the page with their scroll positions.
	 * Returns headings (h1-h3) with text and approximate Y position in pixels.
	 */
	async getSectionHeadings(): Promise<{ text: string; tag: string; yPosition: number }[]> {
		return safeExec(
			this.wv,
			`(function() {
				const headings = [];
				for (const el of document.querySelectorAll('h1, h2, h3, [class*="heading"], [class*="title"], section > *:first-child')) {
					const text = (el.innerText || '').trim().slice(0, 80);
					if (!text || text.length < 3) continue;
					const rect = el.getBoundingClientRect();
					const yPosition = Math.round(rect.top + window.scrollY);
					const tag = el.tagName.toLowerCase();
					headings.push({ text, tag, yPosition });
				}
				// Deduplicate by text
				const seen = new Set();
				return headings.filter(h => {
					if (seen.has(h.text)) return false;
					seen.add(h.text);
					return true;
				}).slice(0, 20);
			})()`,
			[],
		);
	}

	/**
	 * Scroll to a specific Y pixel position on the page,
	 * clamped so we never scroll past the content.
	 */
	async scrollToPosition(y: number): Promise<void> {
		await safeExec(
			this.wv,
			`(function() {
				var maxY = Math.max(0, document.body.scrollHeight - window.innerHeight);
				window.scrollTo({ top: Math.min(${y}, maxY), behavior: 'smooth' });
			})()`,
			undefined,
		);
		await new Promise((r) => setTimeout(r, 800));
	}

	/**
	 * Get the page's scroll bounds — useful for clamping storyboard scroll positions.
	 */
	async getScrollBounds(): Promise<{ scrollHeight: number; viewportHeight: number }> {
		return safeExec(
			this.wv,
			`({ scrollHeight: document.body.scrollHeight, viewportHeight: window.innerHeight })`,
			{ scrollHeight: 2000, viewportHeight: 800 },
		);
	}

	/**
	 * Find the most prominent visible element (heading, hero image, CTA) and
	 * return its center as a 0-1 normalized focus point for ken-burns.
	 */
	async getProminentElementPosition(): Promise<{ x: number; y: number }> {
		return safeExec(
			this.wv,
			`(function() {
				var vw = window.innerWidth, vh = window.innerHeight;
				var best = null, bestScore = 0;

				// Headings — h1 is most prominent
				document.querySelectorAll('h1, h2, h3').forEach(function(el) {
					var r = el.getBoundingClientRect();
					if (r.top < 0 || r.bottom > vh || r.width < 50) return;
					var w = el.tagName === 'H1' ? 3 : el.tagName === 'H2' ? 2 : 1;
					var s = w * r.width;
					if (s > bestScore) { bestScore = s; best = r; }
				});

				// Large images / videos
				document.querySelectorAll('img, video, [class*="hero"]').forEach(function(el) {
					var r = el.getBoundingClientRect();
					if (r.top < 0 || r.bottom > vh || r.width < 200 || r.height < 100) return;
					var s = r.width * r.height * 0.001;
					if (s > bestScore) { bestScore = s; best = r; }
				});

				// CTA buttons
				document.querySelectorAll('button, [role="button"], a[class*="cta"], a[class*="btn"]').forEach(function(el) {
					var r = el.getBoundingClientRect();
					if (r.top < 0 || r.bottom > vh || r.width < 40) return;
					var s = r.width * 2;
					if (s > bestScore) { bestScore = s; best = r; }
				});

				if (!best) return { x: 0.5, y: 0.4 };
				return {
					x: Math.max(0.1, Math.min(0.9, (best.left + best.width / 2) / vw)),
					y: Math.max(0.1, Math.min(0.9, (best.top + best.height / 2) / vh))
				};
			})()`,
			{ x: 0.5, y: 0.4 },
		);
	}

	/**
	 * Find the section container for a heading and return its viewport-relative
	 * bounds normalized to 0-1. Used for cropping screenshots to specific sections.
	 */
	async getSectionBounds(
		headingText: string,
	): Promise<{ x: number; y: number; width: number; height: number } | null> {
		return safeExec(
			this.wv,
			`(function() {
				var target = ${JSON.stringify(headingText.toLowerCase())};
				var vw = window.innerWidth, vh = window.innerHeight;
				var heading = null;

				// Find the heading element
				var candidates = document.querySelectorAll('h1, h2, h3, h4, [class*="heading"], [class*="title"]');
				for (var i = 0; i < candidates.length; i++) {
					var t = (candidates[i].innerText || '').trim().toLowerCase();
					if (t.includes(target) || target.includes(t.slice(0, 20))) {
						heading = candidates[i];
						break;
					}
				}
				if (!heading) return null;

				// Walk up to find section container
				var section = heading.parentElement;
				while (section && section !== document.body) {
					var tag = section.tagName.toLowerCase();
					var r = section.getBoundingClientRect();
					if ((tag === 'section' || tag === 'article' || section.classList.toString().match(/section|block|container|wrapper|card/i)) &&
						r.height > 80 && r.height < vh * 3 && r.width > vw * 0.4) {
						break;
					}
					section = section.parentElement;
				}

				var rect;
				if (section && section !== document.body) {
					rect = section.getBoundingClientRect();
				} else {
					// Fallback: heading rect with generous padding below
					var hr = heading.getBoundingClientRect();
					rect = { left: 0, top: hr.top - 20, width: vw, height: Math.min(vh * 0.6, vh - hr.top + 20) };
				}

				// Clamp to viewport
				var x = Math.max(0, rect.left / vw);
				var y = Math.max(0, rect.top / vh);
				var w = Math.min(1 - x, rect.width / vw);
				var h = Math.min(1 - y, rect.height / vh);

				// Ensure minimum size
				if (w < 0.2 || h < 0.15) return null;

				return { x: x, y: y, width: w, height: h };
			})()`,
			null,
		);
	}

	/**
	 * Detect individual UI elements visible in the current viewport.
	 * Returns normalized 0-1 bounding boxes for cards, headings, images, CTAs.
	 */
	async getVisibleUIElements(): Promise<
		Array<{
			type: string;
			text: string;
			bounds: { x: number; y: number; width: number; height: number };
		}>
	> {
		return safeExec(
			this.wv,
			`(function() {
				var vw = window.innerWidth, vh = window.innerHeight;
				var elements = [];
				var seen = new Set();

				function addEl(el, type) {
					var r = el.getBoundingClientRect();
					if (r.top >= vh || r.bottom <= 0 || r.width < 100 || r.height < 60) return;
					if (r.width > vw * 0.95 && r.height > vh * 0.8) return;
					var key = Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width);
					if (seen.has(key)) return;
					seen.add(key);
					var text = (el.querySelector('h1,h2,h3,h4,strong') || el).innerText || '';
					text = text.trim().slice(0, 60);
					elements.push({
						type: type,
						text: text,
						bounds: {
							x: Math.max(0, r.left / vw),
							y: Math.max(0, r.top / vh),
							width: Math.min(1 - r.left / vw, r.width / vw),
							height: Math.min(1 - r.top / vh, r.height / vh)
						}
					});
				}

				document.querySelectorAll('[class*="card"], [class*="Card"], [class*="feature"], [class*="Feature"], [class*="pricing"], [class*="plan"], [class*="tier"]').forEach(function(el) {
					addEl(el, 'card');
				});

				document.querySelectorAll('section, [class*="section"], [class*="block"], [class*="hero"], [class*="cta"]').forEach(function(el) {
					var r = el.getBoundingClientRect();
					if (r.height > 60 && r.height < vh * 0.7 && r.top < vh && r.bottom > 0) {
						addEl(el, 'section');
					}
				});

				document.querySelectorAll('h1, h2').forEach(function(el) {
					var r = el.getBoundingClientRect();
					if (r.top >= 0 && r.bottom <= vh) {
						var parent = el.parentElement;
						if (parent) addEl(parent, 'heading-group');
					}
				});

				elements.sort(function(a, b) {
					return (b.bounds.width * b.bounds.height) - (a.bounds.width * a.bounds.height);
				});
				return elements.slice(0, 8);
			})()`,
			[],
		);
	}

	/**
	 * Extract brand identity from the current page: primary colors, fonts, product name.
	 * Inspects computed styles of key elements (headings, buttons, links, logo).
	 */
	async getBrandInfo(): Promise<{
		primaryColor: string | null;
		accentColor: string | null;
		fontFamily: string | null;
		productName: string | null;
		logoUrl: string | null;
	}> {
		return safeExec(
			this.wv,
			`(function() {
				var colors = {};
				var fonts = {};

				function addColor(c) {
					if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return;
					// Parse to rgb
					var m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
					if (!m) return;
					var r = +m[1], g = +m[2], b = +m[3];
					// Skip near-black, near-white, grey
					if (r < 30 && g < 30 && b < 30) return;
					if (r > 225 && g > 225 && b > 225) return;
					var diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
					if (diff < 20) return;
					var hex = '#' + [r, g, b].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
					colors[hex] = (colors[hex] || 0) + 1;
				}

				function addFont(f) {
					if (!f) return;
					var name = f.split(',')[0].trim().replace(/['"]/g, '');
					if (['system-ui', 'serif', 'sans-serif', 'monospace', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI'].includes(name)) return;
					fonts[name] = (fonts[name] || 0) + 1;
				}

				// Sample key elements
				var selectors = ['a', 'button', '[role="button"]', 'h1', 'h2', '.btn', '[class*="cta"]', '[class*="primary"]', 'nav a'];
				selectors.forEach(function(sel) {
					document.querySelectorAll(sel).forEach(function(el) {
						var s = getComputedStyle(el);
						addColor(s.backgroundColor);
						addColor(s.color);
						addColor(s.borderColor);
						addFont(s.fontFamily);
					});
				});

				// Heading fonts specifically
				document.querySelectorAll('h1, h2, h3').forEach(function(el) {
					addFont(getComputedStyle(el).fontFamily);
				});

				// Sort by frequency
				var sortedColors = Object.entries(colors).sort(function(a, b) { return b[1] - a[1]; });
				var sortedFonts = Object.entries(fonts).sort(function(a, b) { return b[1] - a[1]; });

				// Product name: try og:site_name, then title tag, then h1
				var productName = null;
				var ogName = document.querySelector('meta[property="og:site_name"]');
				if (ogName) productName = ogName.getAttribute('content');
				if (!productName) {
					var h1 = document.querySelector('h1');
					if (h1) {
						var t = h1.innerText.trim();
						if (t.length < 30) productName = t;
					}
				}
				if (!productName) {
					var title = document.title.split(/[|\\-–—]/)[0].trim();
					if (title.length < 30) productName = title;
				}

				// Find logo
				var logoUrl = null;
				var logoSels = ['a[class*="logo"] img','[class*="logo"] img','header img[src*="logo"]','a[href="/"] img','header img:first-of-type','img[alt*="logo"]','img[alt*="Logo"]'];
				for (var si = 0; si < logoSels.length && !logoUrl; si++) {
					var logoEl = document.querySelector(logoSels[si]);
					if (logoEl && logoEl.src && logoEl.naturalWidth > 20) logoUrl = logoEl.src;
				}
				if (!logoUrl) {
					var svgLogo = document.querySelector('a[class*="logo"] svg, [class*="logo"] svg, header svg:first-of-type');
					if (svgLogo) logoUrl = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svgLogo));
				}

				return {
					primaryColor: sortedColors[0] ? sortedColors[0][0] : null,
					accentColor: sortedColors[1] ? sortedColors[1][0] : null,
					fontFamily: sortedFonts[0] ? sortedFonts[0][0] : null,
					productName: productName,
					logoUrl: logoUrl
				};
			})()`,
			{ primaryColor: null, accentColor: null, fontFamily: null, productName: null, logoUrl: null },
		);
	}

	getURL(): string {
		return this.wv.getURL();
	}

	getTitle(): string {
		return this.wv.getTitle();
	}
}
