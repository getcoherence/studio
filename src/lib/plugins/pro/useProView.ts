// ── useProView Hook ─────────────────────────────────────────────────────
//
// Returns a registered view component from the plugin registry, or null
// if not yet loaded. Listens for the "studio-pro-loaded" event so it
// re-renders when the pro bundle arrives after initial mount.

import { useEffect, useState } from "react";
import { pluginRegistry } from "../registry";

/**
 * Returns the React component registered under `viewId`, or null if
 * the pro bundle hasn't loaded yet. Automatically re-renders when the
 * bundle arrives.
 */
export function useProView(viewId: string): React.FC<any> | null {
	const [component, setComponent] = useState<React.FC<any> | null>(() => {
		const view = pluginRegistry.getView(viewId);
		return view?.component ?? null;
	});

	useEffect(() => {
		// Check immediately in case it loaded between render and effect
		const existing = pluginRegistry.getView(viewId);
		if (existing) {
			setComponent(() => existing.component);
			return;
		}

		const handler = () => {
			const view = pluginRegistry.getView(viewId);
			if (view) {
				setComponent(() => view.component);
			}
		};

		window.addEventListener("studio-pro-loaded", handler);
		return () => window.removeEventListener("studio-pro-loaded", handler);
	}, [viewId]);

	return component;
}
