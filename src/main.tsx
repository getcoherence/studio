import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { BenchRenderPage } from "./components/BenchRenderPage";
import { I18nProvider } from "./contexts/I18nContext";
import { loadCorePlugins } from "./lib/plugins/core";
import { initSharedBridge } from "./lib/plugins/pro/sharedBridge";
import "./index.css";

// Fast path for the bench render harness — a hidden Electron window loads
// /?windowType=bench-render to capture a single keyframe. Skip the full App
// mount (which drags in VideoEditor, i18n, providers, etc.) so the page is
// ready in under a second and capturePage returns actual pixels instead of
// a pre-hydration blank frame.
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("windowType") === "bench-render") {
	// SharedBridge/loadCorePlugins still needed — BenchRenderPage's
	// DynamicComposition uses MODULE_SCOPE which is initialized via
	// compileCode's own module-scope setup (doesn't require shared bridge),
	// but being defensive doesn't cost anything.
	initSharedBridge();
	loadCorePlugins();
	ReactDOM.createRoot(document.getElementById("root")!).render(<BenchRenderPage />);
} else {
	// Initialize shared bridge before anything else — pro bundle reads from it
	initSharedBridge();
	// Initialize plugin registry with core plugins before rendering
	loadCorePlugins();
	ReactDOM.createRoot(document.getElementById("root")!).render(
		<React.StrictMode>
			<I18nProvider>
				<App />
			</I18nProvider>
		</React.StrictMode>,
	);
}
