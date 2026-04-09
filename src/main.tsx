import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/I18nContext";
import { loadCorePlugins } from "./lib/plugins/core";
import { initSharedBridge } from "./lib/plugins/pro/sharedBridge";
import "./index.css";

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
