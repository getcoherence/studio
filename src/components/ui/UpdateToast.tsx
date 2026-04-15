import { useEffect, useRef } from "react";
import { toast } from "sonner";

// ── Auto-update UX ───────────────────────────────────────────────────────
//
// Listens for update state transitions from electron-updater (main process)
// and renders sonner toasts. Behavior matches what the user specified:
//   • Show "Install & Restart" toast exactly once per session when an
//     update finishes downloading — persistent, not dismissing itself.
//   • Confirm manual "Check for Updates" menu clicks even when no update
//     is available ("You're on the latest version").
//   • Surface errors only for manual checks, not background polls.
// Background polls and download progress stay silent.

export function UpdateToast() {
	// Guard: don't re-fire the downloaded toast if electron-updater re-emits
	// the event (e.g. on channel switch it may re-check and reuse the cached
	// download).
	const downloadedShown = useRef<string | null>(null);

	useEffect(() => {
		if (!window.electronAPI?.onUpdateEvent) return;

		const cleanup = window.electronAPI.onUpdateEvent((event) => {
			switch (event.state) {
				case "downloaded": {
					const version = event.latestVersion ?? "unknown";
					if (downloadedShown.current === version) return;
					downloadedShown.current = version;
					toast(`Coherence Studio ${version} is ready to install`, {
						duration: Number.POSITIVE_INFINITY,
						action: {
							label: "Install & Restart",
							onClick: () => {
								window.electronAPI.installUpdate?.();
							},
						},
						cancel: {
							label: "Later",
							onClick: () => {
								window.electronAPI.dismissUpdate?.();
							},
						},
					});
					return;
				}

				case "not-available": {
					if (!event.manual) return;
					toast.success(`You're on the latest version (${event.currentVersion})`);
					return;
				}

				case "error": {
					if (!event.manual) return;
					toast.error(event.error || "Couldn't check for updates");
					return;
				}

				// Silent: idle, checking, available (download proceeds automatically),
				// downloading (progress chatter would be noise).
				default:
					return;
			}
		});

		return cleanup;
	}, []);

	return null;
}
