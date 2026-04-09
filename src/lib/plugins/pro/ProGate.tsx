// ── Pro Feature Gate ────────────────────────────────────────────────────
//
// Wraps a pro feature. Shows the feature if pro is active, otherwise
// shows an upgrade prompt. Use this around any pro-only UI.
//
// Usage:
//   <ProGate feature="AI Generator">
//     <AIGeneratorPanel />
//   </ProGate>

import React from "react";
import { useProStatus } from "./useProStatus";

export const ProGate: React.FC<{
	children: React.ReactNode;
	feature: string;
	/** Render a minimal badge instead of replacing the entire content */
	mode?: "replace" | "badge";
}> = ({ children, feature, mode = "replace" }) => {
	const { isPro, loading, upgrade } = useProStatus();

	if (isPro) return <>{children}</>;

	if (mode === "badge") {
		return (
			<div className="relative">
				{children}
				<div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center">
					<button
						onClick={upgrade}
						disabled={loading}
						className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-50"
					>
						{loading ? "Checking..." : `Upgrade to Pro`}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border border-white/10 bg-white/[0.02]">
			<div className="text-xs text-violet-400 font-medium uppercase tracking-wider">
				Pro Feature
			</div>
			<div className="text-sm text-white/60 text-center">{feature}</div>
			<button
				onClick={upgrade}
				disabled={loading}
				className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-50"
			>
				{loading ? "Checking..." : "Upgrade to Pro"}
			</button>
			<div className="text-[10px] text-white/25">Upgrade at getcoherence.io</div>
		</div>
	);
};
