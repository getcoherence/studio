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
					toast.error(summarizeUpdateError(event.error));
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

/**
 * electron-updater on Windows sometimes dumps the entire PowerShell
 * Get-AuthenticodeSignature result (including full X509 cert chains) into
 * `Error.message` when the installer signature check walks the wrong
 * signer. That payload can be 10KB+ of JSON — a useless wall of text in
 * a toast. Recognize common shapes and show a friendly summary instead.
 *
 * The underlying publisher-name mismatch is still a bug (electron-builder
 * publisherName doesn't match our actual code-signing cert CN), but
 * surfacing it as a readable message is a better default either way.
 */
function summarizeUpdateError(raw: string | undefined): string {
	if (!raw) return "Couldn't check for updates";
	// Signature-verification dump: contains X509 + SubjectName + StatusMessage.
	if (raw.includes("X509") && raw.includes("StatusMessage")) {
		const verified = /"StatusMessage"\s*:\s*"Signature verified\.?"/.test(raw);
		if (verified) {
			return "Couldn't finish the update: installer signature published under a different publisher than expected. Please download the installer manually from GitHub Releases for now.";
		}
		return "Couldn't verify the update installer's signature. Please download manually from GitHub Releases.";
	}
	// Generic truncation — cap any other message so a future dump doesn't
	// paint the screen.
	const MAX_LEN = 240;
	if (raw.length <= MAX_LEN) return raw;
	return raw.slice(0, MAX_LEN).trim() + "…";
}
