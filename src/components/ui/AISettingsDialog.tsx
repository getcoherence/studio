/**
 * Global Settings Dialog — AI provider config + license management.
 * Can be opened from anywhere in the app (welcome screen, scene builder, demo recorder).
 */

import { Check, Crown, Loader2, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AI_PROVIDERS, type AIProvider, type AIServiceConfig } from "@/lib/ai/types";
import {
	getLicenseTier,
	type LicenseTier,
	setLicenseTier,
	validateLicenseKey,
} from "@/lib/license";

type SettingsTab = "ai" | "license";

interface AISettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialTab?: SettingsTab;
}

export function AISettingsDialog({ open, onOpenChange, initialTab = "ai" }: AISettingsDialogProps) {
	const [tab, setTab] = useState<SettingsTab>(initialTab);

	// AI state
	const [provider, setProvider] = useState<AIProvider>("openai");
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState("");
	const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

	// License state
	const [licenseTier, setLicenseTierLocal] = useState<LicenseTier>("free");
	const [licenseKey, setLicenseKeyInput] = useState("");
	const [licenseValidating, setLicenseValidating] = useState(false);
	const [licenseError, setLicenseError] = useState("");
	const [licenseSuccess, setLicenseSuccess] = useState(false);

	// Load current config when opening
	useEffect(() => {
		if (!open) return;
		setTab(initialTab);
		window.electronAPI?.aiGetConfig().then((config: AIServiceConfig) => {
			setProvider(config.provider ?? "openai");
			setApiKey(config.apiKey ?? "");
			setModel(config.model ?? "");
			setOllamaUrl(config.ollamaUrl ?? "http://localhost:11434");
			setSaved(false);
			setTestResult(null);
		});
		getLicenseTier().then(setLicenseTierLocal);
		setLicenseKeyInput("");
		setLicenseError("");
		setLicenseSuccess(false);
	}, [open, initialTab]);

	const providerInfo = AI_PROVIDERS.find((p) => p.id === provider);

	async function handleSave() {
		setSaving(true);
		await window.electronAPI?.aiSaveConfig({
			provider,
			apiKey: apiKey || undefined,
			model: model || undefined,
			ollamaUrl: provider === "ollama" ? ollamaUrl : undefined,
		});
		setSaving(false);
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	async function handleTest() {
		setTesting(true);
		setTestResult(null);
		await window.electronAPI?.aiSaveConfig({
			provider,
			apiKey: apiKey || undefined,
			model: model || undefined,
			ollamaUrl: provider === "ollama" ? ollamaUrl : undefined,
		});
		const result = await window.electronAPI?.aiAnalyze('Say "AI is connected" in exactly 3 words.');
		setTesting(false);
		setTestResult(result?.success ? "success" : "error");
	}

	async function handleActivateLicense() {
		if (!licenseKey.trim()) return;
		setLicenseValidating(true);
		setLicenseError("");
		setLicenseSuccess(false);
		const valid = await validateLicenseKey(licenseKey.trim());
		setLicenseValidating(false);
		if (valid) {
			setLicenseTierLocal("pro");
			setLicenseSuccess(true);
		} else {
			setLicenseError("Invalid license key. Please check and try again.");
		}
	}

	async function handleDeactivateLicense() {
		await setLicenseTier("free");
		setLicenseTierLocal("free");
		setLicenseSuccess(false);
		setLicenseKeyInput("");
	}

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
			<div className="w-full max-w-md mx-4 bg-[#141417] border border-white/10 rounded-xl p-6 space-y-5">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Settings size={18} className="text-[#2563eb]" />
						<span className="text-sm font-semibold text-white">Settings</span>
					</div>
					<button
						onClick={() => onOpenChange(false)}
						className="text-white/40 hover:text-white/60 transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 p-0.5 rounded-md bg-white/5">
					<button
						onClick={() => setTab("ai")}
						className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
							tab === "ai" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
						}`}
					>
						AI Provider
					</button>
					<button
						onClick={() => setTab("license")}
						className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
							tab === "license" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
						}`}
					>
						<Crown size={10} />
						License
					</button>
				</div>

				{/* ── AI Tab ── */}
				{tab === "ai" && (
					<>
						{/* Provider selector */}
						<div className="space-y-2">
							<label className="text-xs text-white/50 font-medium">Provider</label>
							<div className="grid grid-cols-2 gap-2">
								{AI_PROVIDERS.map((p) => (
									<button
										key={p.id}
										onClick={() => {
											setProvider(p.id);
											setModel("");
											setTestResult(null);
										}}
										className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-md border text-left transition-colors ${
											provider === p.id
												? "bg-[#2563eb]/10 border-[#2563eb]/40 text-white"
												: "bg-white/3 border-white/8 text-white/60 hover:border-white/15 hover:text-white/80"
										}`}
									>
										<span className="text-xs font-medium">{p.name}</span>
										<span className="text-[10px] text-white/30 leading-tight">{p.description}</span>
									</button>
								))}
							</div>
						</div>

						{/* API Key */}
						{providerInfo?.requiresApiKey && (
							<div className="space-y-1.5">
								<label className="text-xs text-white/50 font-medium">API Key</label>
								<input
									type="password"
									value={apiKey}
									onChange={(e) => {
										setApiKey(e.target.value);
										setTestResult(null);
									}}
									placeholder={`Enter your ${providerInfo.name} API key`}
									className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#2563eb]/50"
								/>
							</div>
						)}

						{/* Ollama URL */}
						{provider === "ollama" && (
							<div className="space-y-1.5">
								<label className="text-xs text-white/50 font-medium">Ollama URL</label>
								<input
									type="text"
									value={ollamaUrl}
									onChange={(e) => setOllamaUrl(e.target.value)}
									placeholder="http://localhost:11434"
									className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#2563eb]/50"
								/>
							</div>
						)}

						{/* Model selector */}
						{providerInfo && (
							<div className="space-y-1.5">
								<label className="text-xs text-white/50 font-medium">Model</label>
								<select
									value={model || providerInfo.defaultModel}
									onChange={(e) => setModel(e.target.value)}
									className="w-full px-3 py-2 rounded-md bg-[#18181b] border border-white/10 text-sm text-white focus:outline-none cursor-pointer"
								>
									{providerInfo.models.map((m) => (
										<option key={m} value={m} className="bg-[#18181b] text-white">
											{m}
											{m === providerInfo.defaultModel ? " (default)" : ""}
										</option>
									))}
								</select>
							</div>
						)}

						{/* Test result */}
						{testResult && (
							<div
								className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
									testResult === "success"
										? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
										: "bg-red-500/10 border border-red-500/20 text-red-400"
								}`}
							>
								{testResult === "success" ? (
									<>
										<Check size={12} />
										Connection successful
									</>
								) : (
									"Connection failed. Check your API key and provider."
								)}
							</div>
						)}

						{/* Actions */}
						<div className="flex items-center justify-between pt-1">
							<button
								onClick={handleTest}
								disabled={testing}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white/70 hover:bg-white/5 border border-white/10 transition-colors disabled:opacity-40"
							>
								{testing ? <Loader2 size={12} className="animate-spin" /> : null}
								{testing ? "Testing..." : "Test Connection"}
							</button>
							<button
								onClick={handleSave}
								disabled={saving}
								className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#2563eb] hover:bg-[#2563eb]/90 text-white text-sm font-medium transition-colors disabled:opacity-40"
							>
								{saving ? (
									<Loader2 size={12} className="animate-spin" />
								) : saved ? (
									<Check size={12} />
								) : null}
								{saved ? "Saved" : "Save"}
							</button>
						</div>
					</>
				)}

				{/* ── License Tab ── */}
				{tab === "license" && (
					<>
						{/* Current tier */}
						<div className="flex items-center justify-between px-3 py-3 rounded-md bg-white/5 border border-white/10">
							<div>
								<div className="text-xs text-white/40">Current plan</div>
								<div className="text-sm font-semibold text-white mt-0.5">
									{licenseTier === "pro" ? "Lucid Studio Pro" : "Lucid Studio Free"}
								</div>
							</div>
							{licenseTier === "pro" ? (
								<Crown size={20} className="text-amber-400" />
							) : (
								<span className="text-[10px] text-white/30 uppercase tracking-wider">Free</span>
							)}
						</div>

						{licenseTier === "pro" ? (
							<>
								<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
									<Check size={12} />
									All Pro features are unlocked
								</div>
								<button
									onClick={handleDeactivateLicense}
									className="w-full px-3 py-2 rounded-md text-xs text-white/30 hover:text-white/50 hover:bg-white/5 border border-white/8 transition-colors"
								>
									Deactivate License
								</button>
							</>
						) : (
							<>
								<div className="space-y-1">
									<p className="text-xs text-white/50">
										Upgrade to Pro to unlock AI features, scene builder, animated backgrounds, demo
										recorder, and more.
									</p>
								</div>

								<div className="space-y-2">
									<label className="text-xs text-white/40 font-medium">License Key</label>
									<input
										type="text"
										value={licenseKey}
										onChange={(e) => {
											setLicenseKeyInput(e.target.value);
											setLicenseError("");
											setLicenseSuccess(false);
										}}
										placeholder="LUCID-PRO-XXXX-XXXX-XXXX"
										className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50"
										onKeyDown={(e) => {
											if (e.key === "Enter") handleActivateLicense();
										}}
									/>
									{licenseError && <p className="text-xs text-red-400">{licenseError}</p>}
									{licenseSuccess && (
										<div className="flex items-center gap-2 text-xs text-emerald-400">
											<Check size={12} />
											Pro activated successfully!
										</div>
									)}
								</div>

								<button
									onClick={handleActivateLicense}
									disabled={!licenseKey.trim() || licenseValidating}
									className="w-full px-4 py-2.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{licenseValidating ? "Validating..." : "Activate Pro"}
								</button>
							</>
						)}
					</>
				)}
			</div>
		</div>
	);
}

// ── Trigger button (use anywhere) ──────────────────────────────────────

interface AISettingsButtonProps {
	className?: string;
	size?: number;
}

export function AISettingsButton({ className, size = 14 }: AISettingsButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className={
					className ??
					"p-1.5 text-white/30 hover:text-white/60 transition-colors rounded-md hover:bg-white/5"
				}
				title="AI Settings"
			>
				<Settings size={size} />
			</button>
			<AISettingsDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
