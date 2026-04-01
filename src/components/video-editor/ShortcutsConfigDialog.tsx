import { Keyboard, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	CATEGORY_LABELS,
	DEFAULT_SHORTCUTS,
	FIXED_SHORTCUTS,
	findConflict,
	formatBinding,
	SHORTCUT_CATEGORIES,
	type ShortcutAction,
	type ShortcutBinding,
	type ShortcutCategory,
	type ShortcutConflict,
	type ShortcutsConfig,
} from "@/lib/shortcuts";

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);
const CATEGORY_ORDER: ShortcutCategory[] = ["editor", "playback", "export", "view"];

export function ShortcutsConfigDialog() {
	const { shortcuts, isMac, isConfigOpen, closeConfig, setShortcuts, persistShortcuts } =
		useShortcuts();
	const t = useScopedT("shortcuts");
	const tc = useScopedT("common");

	const [draft, setDraft] = useState<ShortcutsConfig>(shortcuts);
	const [captureFor, setCaptureFor] = useState<ShortcutAction | null>(null);
	const [conflict, setConflict] = useState<{
		forAction: ShortcutAction;
		pending: ShortcutBinding;
		conflictWith: ShortcutConflict;
	} | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		if (isConfigOpen) {
			setDraft(shortcuts);
			setCaptureFor(null);
			setConflict(null);
			setSearchQuery("");
		}
	}, [isConfigOpen, shortcuts]);

	useEffect(() => {
		if (!captureFor) return;

		const handleCapture = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();

			if (e.key === "Escape") {
				setCaptureFor(null);
				return;
			}

			if (MODIFIER_KEYS.has(e.key)) return;

			const binding: ShortcutBinding = {
				key: e.key.toLowerCase(),
				...(e.ctrlKey || e.metaKey ? { ctrl: true } : {}),
				...(e.shiftKey ? { shift: true } : {}),
				...(e.altKey ? { alt: true } : {}),
			};

			const found = findConflict(binding, captureFor, draft);
			setCaptureFor(null);

			if (found?.type === "fixed") {
				toast.error(t("reservedShortcut", { label: found.label }));
				return;
			}

			if (found?.type === "configurable") {
				setConflict({ forAction: captureFor, pending: binding, conflictWith: found });
				return;
			}

			setDraft((prev: ShortcutsConfig) => ({ ...prev, [captureFor]: binding }));
		};

		window.addEventListener("keydown", handleCapture, { capture: true });
		return () => window.removeEventListener("keydown", handleCapture, { capture: true });
	}, [captureFor, draft, t]);

	const filteredCategories = useMemo(() => {
		const query = searchQuery.toLowerCase().trim();
		if (!query) return CATEGORY_ORDER;

		return CATEGORY_ORDER.filter((category) => {
			const actions = SHORTCUT_CATEGORIES[category];
			return actions.some((action) => {
				const label = t(`actions.${action}`);
				return label.toLowerCase().includes(query) || action.toLowerCase().includes(query);
			});
		});
	}, [searchQuery, t]);

	const filterAction = useCallback(
		(action: ShortcutAction): boolean => {
			const query = searchQuery.toLowerCase().trim();
			if (!query) return true;
			const label = t(`actions.${action}`);
			return label.toLowerCase().includes(query) || action.toLowerCase().includes(query);
		},
		[searchQuery, t],
	);

	const handleSwap = useCallback(() => {
		if (!conflict || conflict.conflictWith.type !== "configurable") return;
		const { forAction, pending, conflictWith } = conflict;
		setDraft((prev: ShortcutsConfig) => ({
			...prev,
			[forAction]: pending,
			[conflictWith.action]: prev[forAction],
		}));
		setConflict(null);
	}, [conflict]);

	const handleCancelConflict = useCallback(() => setConflict(null), []);

	const handleSave = useCallback(async () => {
		setShortcuts(draft);
		await persistShortcuts(draft);
		toast.success(t("savedToast"));
		closeConfig();
	}, [draft, setShortcuts, persistShortcuts, closeConfig, t]);

	const handleReset = useCallback(() => {
		setDraft({ ...DEFAULT_SHORTCUTS });
		toast.info(t("resetToast"));
	}, [t]);

	const handleClose = useCallback(() => {
		setCaptureFor(null);
		setConflict(null);
		closeConfig();
	}, [closeConfig]);

	const renderAction = (action: ShortcutAction) => {
		const isCapturing = captureFor === action;
		const hasConflict = conflict?.forAction === action;
		return (
			<div key={action}>
				<div className="flex items-center justify-between py-1.5 px-1 border-b border-white/5">
					<span className="text-sm text-slate-300">{t(`actions.${action}`)}</span>
					<button
						type="button"
						onClick={() => {
							setConflict(null);
							setCaptureFor(isCapturing ? null : action);
						}}
						title={isCapturing ? t("pressEscToCancel") : t("clickToChange")}
						className={[
							"px-2 py-1 rounded text-xs font-mono border transition-all min-w-[90px] text-center select-none",
							isCapturing
								? "bg-[#2563eb]/20 border-[#2563eb] text-[#2563eb] animate-pulse"
								: hasConflict
									? "bg-amber-500/10 border-amber-500/50 text-amber-400"
									: "bg-white/5 border-white/10 text-slate-200 hover:border-[#2563eb]/50 hover:text-[#2563eb] cursor-pointer",
						].join(" ")}
					>
						{isCapturing ? t("pressKey") : formatBinding(draft[action], isMac)}
					</button>
				</div>
				{hasConflict && conflict?.conflictWith.type === "configurable" && (
					<div className="flex items-center justify-between px-1 py-1.5 mb-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
						<span className="text-amber-400">
							{"⚠ "}
							{t("alreadyUsedBy", { action: t(`actions.${conflict.conflictWith.action}`) })}
						</span>
						<div className="flex gap-1.5">
							<button
								type="button"
								onClick={handleSwap}
								className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-300 font-medium transition-colors"
							>
								{t("swap")}
							</button>
							<button
								type="button"
								onClick={handleCancelConflict}
								className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-slate-400 transition-colors"
							>
								{tc("actions.cancel")}
							</button>
						</div>
					</div>
				)}
			</div>
		);
	};

	return (
		<Dialog
			open={isConfigOpen}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<DialogContent className="bg-[#09090b] border-white/10 text-white max-w-[420px] max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-sm">
						<Keyboard className="w-4 h-4 text-[#2563eb]" />
						{t("title")}
					</DialogTitle>
				</DialogHeader>

				{/* Search input */}
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Filter shortcuts..."
						className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-slate-200 placeholder:text-slate-500 outline-none focus:border-[#2563eb]/50 transition-colors"
					/>
				</div>

				<div className="flex-1 overflow-y-auto min-h-0 space-y-3">
					{/* Categorized configurable shortcuts */}
					{filteredCategories.map((category) => {
						const actions = SHORTCUT_CATEGORIES[category].filter(filterAction);
						if (actions.length === 0) return null;
						const categoryLabel =
							t(`categories.${category}`) !== `categories.${category}`
								? t(`categories.${category}`)
								: CATEGORY_LABELS[category];
						return (
							<div key={category} className="space-y-0.5">
								<p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide font-semibold">
									{categoryLabel}
								</p>
								{actions.map(renderAction)}
							</div>
						);
					})}

					{/* Fixed shortcuts (only show when no search or matching search) */}
					{(!searchQuery.trim() ||
						FIXED_SHORTCUTS.some(({ label }) =>
							label.toLowerCase().includes(searchQuery.toLowerCase().trim()),
						)) && (
						<div className="space-y-0.5 mt-2">
							<p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide font-semibold">
								{t("fixed")}
							</p>
							{FIXED_SHORTCUTS.filter(
								({ label }) =>
									!searchQuery.trim() ||
									label.toLowerCase().includes(searchQuery.toLowerCase().trim()),
							).map(({ label, display }) => (
								<div
									key={label}
									className="flex items-center justify-between py-1.5 px-1 border-b border-white/5 last:border-0"
								>
									<span className="text-sm text-slate-400">{label}</span>
									<kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-slate-400 min-w-[90px] text-center">
										{display}
									</kbd>
								</div>
							))}
						</div>
					)}
				</div>

				<p className="text-[10px] text-slate-500 mt-1">{t("helpText")}</p>

				<DialogFooter className="flex gap-2 sm:justify-between mt-2">
					<Button
						variant="ghost"
						size="sm"
						className="text-slate-400 hover:text-white gap-1.5"
						onClick={handleReset}
					>
						<RotateCcw className="w-3 h-3" />
						{t("resetToDefaults")}
					</Button>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={handleClose}>
							{tc("actions.cancel")}
						</Button>
						<Button
							size="sm"
							className="bg-[#2563eb] hover:bg-[#2d9e6c] text-white"
							onClick={handleSave}
						>
							{tc("actions.save")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
