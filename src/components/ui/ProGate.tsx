/**
 * Pro feature gate components.
 *
 * - ProBadge: Small "PRO" pill shown next to feature labels
 * - ProGateDialog: Modal shown when a free user tries to use a Pro feature
 * - useProGate: Hook to check + gate features with a dialog
 */

import { Crown, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	getFeatureLabel,
	initLicense,
	isFeatureAvailableSync,
	type LicenseTier,
	type ProFeature,
	validateLicenseKey,
} from "@/lib/license";

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

interface ProGateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	feature: ProFeature;
	onUpgrade?: () => void;
}

export function ProGateDialog({ open, onOpenChange, feature, onUpgrade }: ProGateDialogProps) {
	const [licenseKey, setLicenseKey] = useState("");
	const [validating, setValidating] = useState(false);
	const [error, setError] = useState("");

	if (!open) return null;

	async function handleActivate() {
		if (!licenseKey.trim()) return;
		setValidating(true);
		setError("");
		const valid = await validateLicenseKey(licenseKey.trim());
		setValidating(false);
		if (valid) {
			onOpenChange(false);
			onUpgrade?.();
		} else {
			setError("Invalid license key. Please check and try again.");
		}
	}

	return (
		<div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
			<div className="w-full max-w-sm mx-4 bg-[#141417] border border-white/10 rounded-xl p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Crown size={18} className="text-amber-400" />
						<span className="text-sm font-semibold text-white">Pro Feature</span>
					</div>
					<button
						onClick={() => onOpenChange(false)}
						className="text-white/40 hover:text-white/60 transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				<p className="text-sm text-white/60">
					<span className="text-white font-medium">{getFeatureLabel(feature)}</span> requires Lucid
					Studio Pro.
				</p>

				<div className="space-y-2">
					<label className="text-xs text-white/40 font-medium">License Key</label>
					<input
						type="text"
						value={licenseKey}
						onChange={(e) => setLicenseKey(e.target.value)}
						placeholder="LUCID-PRO-XXXX-XXXX-XXXX"
						className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50"
						onKeyDown={(e) => {
							if (e.key === "Enter") handleActivate();
						}}
					/>
					{error && <p className="text-xs text-red-400">{error}</p>}
				</div>

				<button
					onClick={handleActivate}
					disabled={!licenseKey.trim() || validating}
					className="w-full px-4 py-2.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					{validating ? "Validating..." : "Activate Pro"}
				</button>
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
