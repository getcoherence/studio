/**
 * DemoBrowserPanel — right panel with embedded <webview> and URL bar.
 */

import { Globe, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface DemoBrowserPanelProps {
	webviewRef: React.RefObject<Electron.WebviewTag | null>;
	isRunning: boolean;
}

export function DemoBrowserPanel({ webviewRef, isRunning }: DemoBrowserPanelProps) {
	const [currentUrl, setCurrentUrl] = useState("about:blank");
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const wv = webviewRef.current;
		if (!wv) return;

		const onNavigate = () => {
			setCurrentUrl(wv.getURL());
		};
		const onLoadStart = () => setIsLoading(true);
		const onLoadStop = () => {
			setIsLoading(false);
			setCurrentUrl(wv.getURL());
			// Inject dark scrollbar styles into the webview's page
			wv.executeJavaScript(`
				(function() {
					if (document.getElementById('__lucid_dark_scrollbar')) return;
					const s = document.createElement('style');
					s.id = '__lucid_dark_scrollbar';
					s.textContent = \`
						::-webkit-scrollbar { width: 8px; height: 8px; }
						::-webkit-scrollbar-track { background: transparent; }
						::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
						::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
						* { scrollbar-color: rgba(255,255,255,0.15) transparent; scrollbar-width: thin; }
					\`;
					document.head.appendChild(s);
				})()
			`).catch(() => {
				/* page may block script injection */
			});
		};

		wv.addEventListener("did-navigate", onNavigate);
		wv.addEventListener("did-navigate-in-page", onNavigate);
		wv.addEventListener("did-start-loading", onLoadStart);
		wv.addEventListener("did-stop-loading", onLoadStop);

		return () => {
			wv.removeEventListener("did-navigate", onNavigate);
			wv.removeEventListener("did-navigate-in-page", onNavigate);
			wv.removeEventListener("did-start-loading", onLoadStart);
			wv.removeEventListener("did-stop-loading", onLoadStop);
		};
	}, [webviewRef]);

	function handleRefresh() {
		webviewRef.current?.reload();
	}

	const showPlaceholder = currentUrl === "about:blank" && !isRunning;

	return (
		<div className="flex flex-col h-full bg-[#0a0a0c]">
			{/* URL bar */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-[#111114]">
				<Globe size={14} className="text-white/30 flex-shrink-0" />
				<div className="flex-1 px-2 py-1 rounded bg-white/5 text-xs text-white/50 truncate font-mono">
					{currentUrl === "about:blank" ? "" : currentUrl}
				</div>
				<button
					onClick={handleRefresh}
					className="p-1 text-white/30 hover:text-white/60 transition-colors rounded hover:bg-white/5"
					title="Refresh"
				>
					<RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
				</button>
			</div>

			{/* Webview container */}
			<div className="flex-1 relative">
				{showPlaceholder && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
						<Globe size={40} className="text-white/10" />
						<p className="text-sm text-white/20">
							Enter a URL and start a demo to see the site here
						</p>
					</div>
				)}
				<webview
					ref={webviewRef}
					src="about:blank"
					style={{ width: "100%", height: "100%" }}
					webpreferences="contextIsolation=yes,nodeIntegration=no"
				/>
			</div>
		</div>
	);
}
