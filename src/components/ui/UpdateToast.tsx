import { useEffect } from "react";
import { toast } from "sonner";

const GITHUB_RELEASES_URL = "https://github.com/getcoherence/lucid/releases/latest";

export function UpdateToast() {
	useEffect(() => {
		if (!window.electronAPI?.onUpdateAvailable) return;

		const cleanup = window.electronAPI.onUpdateAvailable((version: string) => {
			toast(`Lucid Studio v${version} is available`, {
				duration: 15_000,
				action: {
					label: "Download",
					onClick: () => {
						window.electronAPI.openExternalUrl?.(GITHUB_RELEASES_URL);
					},
				},
				cancel: {
					label: "Later",
					onClick: () => {
						window.electronAPI.dismissUpdate?.();
					},
				},
			});
		});

		return cleanup;
	}, []);

	return null;
}
