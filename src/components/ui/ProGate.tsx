/**
 * Pro feature gate components.
 *
 * - ProBadge: Small "PRO" pill shown next to feature labels
 * - ProGateDialog: Modal shown when a free user tries to use a Pro feature
 * - useProGate: Hook to check + gate features with a dialog
 */

import { Check, CreditCard, Crown, ExternalLink, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	getFeatureLabel,
	initLicense,
	isFeatureAvailableSync,
	type LicenseTier,
	type ProFeature,
	setLicenseTier,
} from "@/lib/license";
import { activatePro, checkSubscription, disconnectPro, getProToken } from "@/lib/plugins/pro/proLoader";

// ── ProBadge ────────────────────────────────────────────────────────────

export function ProBadge() {
	return (
		<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/20">
			<Crown size={8} />
			Pro
		</span>
	);
}

// ── ProGateDialog ───────────────────────────────────────────────────────

type DialogStep = "connect" | "subscribe" | "verifying";

interface ProGateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	feature: ProFeature;
	onUpgrade?: () => void;
}

export function ProGateDialog({ open, onOpenChange, feature, onUpgrade }: ProGateDialogProps) {
	const [step, setStep] = useState<DialogStep>("connect");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	// If we already have a token, verify it's still valid then skip to subscribe
	useEffect(() => {
		if (!open || !getProToken()) return;
		// Quick subscription check to validate the token
		checkSubscription()
			.then((sub) => {
				if (sub.active) {
					// Already subscribed — just activate
					activatePro().then((result) => {
						if (result.success) {
							setLicenseTier("pro");
							onOpenChange(false);
							onUpgrade?.();
						}
					});
				} else {
					setStep("subscribe");
				}
			})
			.catch(() => {
				// Token invalid — clear it and stay on connect step
				localStorage.removeItem("studio-pro-token");
				setStep("connect");
			});
	}, [open, onOpenChange, onUpgrade]);

	if (!open) return null;

	async function handleConnect() {
		setLoading(true);
		setError("");
		try {
			const result = await activatePro();
			if (result.success) {
				await setLicenseTier("pro");
				onOpenChange(false);
				onUpgrade?.();
			} else if (result.code === "no_subscription") {
				// Auth worked but no subscription — show subscribe step
				setStep("subscribe");
			} else if (result.code === "auth_failed") {
				setError("Authentication failed — please try again");
			} else {
				setError(result.error || "Connection failed");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Connection failed");
		} finally {
			setLoading(false);
		}
	}

	async function handleSubscribe() {
		setError("");
		const token = getProToken();
		if (!token) {
			setStep("connect");
			setError("Not connected — please sign in first.");
			return;
		}

		// Get a Stripe Checkout URL from the auth service
		setLoading(true);
		try {
			const baseUrl =
				window.location.hostname === "localhost"
					? "http://localhost:4100"
					: "https://app.getcoherence.io/api/v1/auth";

			const res = await fetch(`${baseUrl}/studio/checkout`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					successUrl: `${baseUrl}/studio/checkout/success`,
					cancelUrl: `${baseUrl}/studio/checkout/cancel`,
				}),
			});

			if (res.status === 401) {
				// Token expired or invalidated — re-authenticate
				localStorage.removeItem("studio-pro-token");
				setStep("connect");
				setError("Session expired — please connect again.");
				setLoading(false);
				return;
			}

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || `Checkout failed (${res.status})`);
			}

			const { url } = await res.json();
			if (url) {
				window.electronAPI?.openExternalUrl?.(url);
				// Switch to verifying state — user completes checkout in browser
				setStep("verifying");
			} else {
				throw new Error("No checkout URL returned");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start checkout");
		} finally {
			setLoading(false);
		}
	}

	async function handleVerify() {
		setLoading(true);
		setError("");
		try {
			const sub = await checkSubscription();
			if (sub.active) {
				// Subscription confirmed — try loading the pro bundle
				const result = await activatePro();
				if (result.success) {
					await setLicenseTier("pro");
					onOpenChange(false);
					onUpgrade?.();
					return;
				}
			}
			setError("Subscription not found yet. If you just paid, wait a moment and try again.");
		} catch {
			setError("Could not verify subscription. Try again in a moment.");
		} finally {
			setLoading(false);
		}
	}

	function handleClose() {
		setStep("connect");
		setError("");
		setLoading(false);
		onOpenChange(false);
	}

	return (
		<div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
			<div className="w-full max-w-sm mx-4 bg-[#141417] border border-white/10 rounded-xl p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Crown size={18} className="text-amber-400" />
						<span className="text-sm font-semibold text-white">
							{step === "connect"
								? "Pro Feature"
								: step === "subscribe"
									? "Subscribe to Pro"
									: "Confirming..."}
						</span>
					</div>
					<button
						onClick={handleClose}
						className="text-white/40 hover:text-white/60 transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{/* ── Connect step ── */}
				{step === "connect" && (
					<>
						<p className="text-sm text-white/60">
							<span className="text-white font-medium">{getFeatureLabel(feature)}</span> requires
							Studio Pro.
						</p>
						<p className="text-xs text-white/40">
							Connect your Coherence account to unlock AI features, scene builder, animated
							backgrounds, demo recorder, and more.
						</p>

						{error && (
							<p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
								{error}
							</p>
						)}

						<button
							onClick={handleConnect}
							disabled={loading}
							className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{loading ? (
								<>
									<span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
									Connecting...
								</>
							) : (
								<>
									<ExternalLink size={14} />
									Connect to Coherence
								</>
							)}
						</button>

						<button
							type="button"
							onClick={() =>
								window.electronAPI?.openExternalUrl?.("https://getcoherence.io/pricing")
							}
							className="block w-full text-center text-[11px] text-white/30 hover:text-white/50 transition-colors"
						>
							Don't have an account? View plans
						</button>
					</>
				)}

				{/* ── Subscribe step ── */}
				{step === "subscribe" && (
					<>
						<div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
							<span className="flex items-center gap-2">
								<Check size={12} />
								Connected to Coherence
							</span>
							<button
								type="button"
								onClick={() => {
									disconnectPro();
									onOpenChange(false);
								}}
								className="text-[11px] text-emerald-400/60 hover:text-emerald-300 underline underline-offset-2"
								title="Sign out of your Coherence account"
							>
								Sign out
							</button>
						</div>

						<p className="text-sm text-white/60">
							Subscribe to <span className="text-white font-medium">Studio Pro</span> to unlock{" "}
							<span className="text-white">{getFeatureLabel(feature)}</span> and all pro features.
						</p>

						<div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-white">Studio Pro</span>
								<span className="text-sm text-white">
									$19<span className="text-white/40 text-xs">/mo</span>
								</span>
							</div>
							<p className="text-xs text-emerald-400">
								3-day free trial. Cancel anytime before it ends.
							</p>
							<ul className="text-[11px] text-white/40 space-y-1">
								<li>AI scene generation & demo recorder</li>
								<li>Scene builder & animated backgrounds</li>
								<li>AI captions, TTS & polish</li>
								<li>Premium scene types & effects</li>
							</ul>
						</div>

						{error && (
							<p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
								{error}
							</p>
						)}

						<button
							onClick={handleSubscribe}
							disabled={loading}
							className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{loading ? (
								<>
									<span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
									Opening checkout...
								</>
							) : (
								<>
									<CreditCard size={14} />
									Start 3-Day Free Trial
								</>
							)}
						</button>
					</>
				)}

				{/* ── Verifying step ── */}
				{step === "verifying" && (
					<>
						<p className="text-sm text-white/60">
							Complete the checkout in your browser, then click below to activate Pro.
						</p>

						{error && (
							<p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
								{error}
							</p>
						)}

						<button
							onClick={handleVerify}
							disabled={loading}
							className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{loading ? (
								<>
									<span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
									Checking...
								</>
							) : (
								<>
									<RefreshCw size={14} />
									I've subscribed — activate Pro
								</>
							)}
						</button>

						<button
							type="button"
							onClick={() => setStep("subscribe")}
							className="block w-full text-center text-[11px] text-white/30 hover:text-white/50 transition-colors"
						>
							Go back
						</button>
					</>
				)}
			</div>
		</div>
	);
}

// ── useProGate hook ─────────────────────────────────────────────────────

export function useProGate() {
	const [tier, setTier] = useState<LicenseTier>("free");
	const [gatedFeature, setGatedFeature] = useState<ProFeature | null>(null);

	useEffect(() => {
		initLicense().then(setTier);
	}, []);

	/** Call before executing a Pro feature. Returns true if allowed. */
	const checkFeature = useCallback(
		(feature: ProFeature): boolean => {
			if (tier === "pro" || isFeatureAvailableSync(feature)) return true;
			setGatedFeature(feature);
			return false;
		},
		[tier],
	);

	const gateDialog = gatedFeature ? (
		<ProGateDialog
			open
			onOpenChange={(open) => {
				if (!open) setGatedFeature(null);
			}}
			feature={gatedFeature}
			onUpgrade={() => {
				setTier("pro");
				setGatedFeature(null);
			}}
		/>
	) : null;

	return { tier, isPro: tier === "pro", checkFeature, gateDialog };
}
