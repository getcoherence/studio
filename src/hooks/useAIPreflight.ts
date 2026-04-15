import { useCallback, useEffect, useState } from "react";
import type { AIAvailability } from "@/lib/ai/types";

// ── AI preflight ─────────────────────────────────────────────────────────
//
// Reusable guard for AI-powered features. Checks whether a chat provider is
// configured (has an API key); if not, captures a contextual message and
// surfaces state the caller can use to render AISettingsDialog as an
// onboarding modal. Consumers call `requireChatProvider("feature name")`
// before invoking an AI-dependent action — if it returns false, the
// feature MUST not proceed (no silent heuristic fallbacks for features
// that claim to be AI-powered).

export function useAIPreflight() {
	const [availability, setAvailability] = useState<AIAvailability | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMessage, setDialogMessage] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			const a = await window.electronAPI.aiCheckAvailability();
			setAvailability(a);
			return a;
		} catch {
			return null;
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const requireChatProvider = useCallback(
		async (featureLabel: string): Promise<boolean> => {
			const current = availability ?? (await refresh());
			if (current?.activeProvider) return true;
			setDialogMessage(
				`${featureLabel} needs an AI provider. Add your OpenAI, Anthropic, Groq, or MiniMax API key to continue.`,
			);
			setDialogOpen(true);
			return false;
		},
		[availability, refresh],
	);

	const closeDialog = useCallback(() => {
		setDialogOpen(false);
		setDialogMessage(null);
		// After the user closes, refresh so the UI reflects any keys they saved.
		refresh();
	}, [refresh]);

	return {
		availability,
		refresh,
		requireChatProvider,
		dialogOpen,
		dialogMessage,
		closeDialog,
	};
}
