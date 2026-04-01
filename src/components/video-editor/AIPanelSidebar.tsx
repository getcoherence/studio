/**
 * AIPanelSidebar — collapsible sidebar panel for AI features.
 * Contains: Smart Trim, Magic Polish, Auto-Narrate, Extract Clips, AI Settings.
 */
import {
	AudioLines,
	Check,
	ChevronDown,
	ChevronRight,
	Film,
	Key,
	Scissors,
	Settings2,
	Sparkles,
	Wand2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { EditorState } from "@/hooks/useEditorHistory";
import { generateNarrationScript } from "@/lib/ai/autoNarration";
import { extractClips } from "@/lib/ai/clipExtractor";
import { generatePolishEdits } from "@/lib/ai/oneClickPolish";
import { analyzeRecording } from "@/lib/ai/recordingAnalyzer";
import type {
	AIAvailability,
	AIProvider,
	ExtractedClip,
	NarrationSegment,
	PolishPreview,
} from "@/lib/ai/types";
import { SmartTrimSuggestions } from "./SmartTrimSuggestions";
import type { CursorTelemetryPoint, TrimRegion } from "./types";

// ── Section collapse component ──

function Section({
	title,
	icon: Icon,
	defaultOpen = false,
	children,
}: {
	title: string;
	icon: React.ComponentType<{ size?: string | number }>;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="border-b border-white/5 last:border-b-0">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
			>
				<Icon size={14} />
				<span className="flex-1 text-left">{title}</span>
				{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
			</button>
			{open && <div className="px-3 pb-3">{children}</div>}
		</div>
	);
}

// ── Main component ──

interface AIPanelSidebarProps {
	cursorTelemetry: CursorTelemetryPoint[];
	videoDurationMs: number;
	editorState: EditorState;
	onApplyEdits: (edits: Partial<EditorState>) => void;
	onAcceptTrimSuggestions: (trims: TrimRegion[]) => void;
	onSeek?: (timeMs: number) => void;
}

export function AIPanelSidebar({
	cursorTelemetry,
	videoDurationMs,
	editorState,
	onApplyEdits,
	onAcceptTrimSuggestions,
	onSeek,
}: AIPanelSidebarProps) {
	// ── AI availability ──
	const [availability, setAvailability] = useState<AIAvailability | null>(null);

	useEffect(() => {
		window.electronAPI
			.aiCheckAvailability()
			.then(setAvailability)
			.catch(() => {
				setAvailability({ providers: [], activeProvider: null });
			});
	}, []);

	// ── Magic Polish ──
	const [polishPreview, setPolishPreview] = useState<PolishPreview | null>(null);
	const [polishEdits, setPolishEdits] = useState<Partial<EditorState> | null>(null);
	const [isPolishing, setIsPolishing] = useState(false);

	const handleRunPolish = useCallback(() => {
		if (cursorTelemetry.length === 0 || videoDurationMs <= 0) return;
		setIsPolishing(true);

		requestAnimationFrame(() => {
			const result = generatePolishEdits({
				cursorTelemetry,
				videoDurationMs,
				currentState: editorState,
			});
			setPolishPreview(result.preview);
			setPolishEdits(result.edits);
			setIsPolishing(false);
		});
	}, [cursorTelemetry, videoDurationMs, editorState]);

	const handleApplyPolish = useCallback(() => {
		if (!polishEdits) return;
		onApplyEdits(polishEdits);
		setPolishPreview(null);
		setPolishEdits(null);
	}, [polishEdits, onApplyEdits]);

	const handleCancelPolish = useCallback(() => {
		setPolishPreview(null);
		setPolishEdits(null);
	}, []);

	// ── Auto-Narrate ──
	const [narrationSegments, setNarrationSegments] = useState<NarrationSegment[]>([]);
	const [narrationText, setNarrationText] = useState("");
	const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);

	const handleGenerateNarration = useCallback(async () => {
		if (cursorTelemetry.length === 0 || videoDurationMs <= 0) return;
		setIsGeneratingNarration(true);

		try {
			const profile = analyzeRecording(cursorTelemetry, videoDurationMs);

			// Try AI-powered narration first
			const profileSummary =
				`Recording duration: ${Math.round(videoDurationMs / 1000)}s. ` +
				`Active segments: ${profile.activeSegments.length}. ` +
				`Click clusters: ${profile.clickClusters.length}. ` +
				`Idle segments: ${profile.idleSegments.length}.` +
				(profile.activeSegments.length > 0
					? ` Key activity at: ${profile.activeSegments
							.slice(0, 5)
							.map((s) => `${Math.round(s.startMs / 1000)}s-${Math.round(s.endMs / 1000)}s`)
							.join(", ")}.`
					: "");

			const aiResult = await window.electronAPI?.aiAnalyze?.(
				"Write a professional voiceover narration script for a screen recording demo. " +
					"You only have cursor activity data (not visual content), so DO NOT invent specific UI elements, " +
					"button names, or features you cannot see. Instead, write timing-based narration like: " +
					"'Here we begin the demo...', 'Notice the activity in this area...', 'The workflow picks up pace here...'. " +
					"Keep it natural and under 150 words. One paragraph per key moment.\n\n" +
					`Cursor activity data:\n${profileSummary}`,
			);

			console.log("[AI Narrate] Result:", aiResult);
			if (aiResult?.success && aiResult.text) {
				const lines = aiResult.text.split("\n\n").filter((l: string) => l.trim());
				const duration = videoDurationMs / 1000;
				const segmentDuration = duration / Math.max(lines.length, 1);
				const segments = lines.map((text: string, i: number) => ({
					id: `narr-${i}`,
					text: text.trim(),
					startMs: Math.round(i * segmentDuration * 1000),
					endMs: Math.round((i + 1) * segmentDuration * 1000),
				}));
				setNarrationSegments(segments);
				setNarrationText(segments.map((s) => s.text).join("\n\n"));
			} else {
				console.warn("[AI Narrate] Failed, falling back:", aiResult?.error);
				// Fallback to heuristic
				const segments = generateNarrationScript(profile);
				setNarrationSegments(segments);
				setNarrationText(segments.map((s) => s.text).join("\n\n"));
			}
		} catch (err) {
			console.error("[AI Narrate] Exception:", err);
			// Fallback to heuristic
			const profile = analyzeRecording(cursorTelemetry, videoDurationMs);
			const segments = generateNarrationScript(profile);
			setNarrationSegments(segments);
			setNarrationText(segments.map((s) => s.text).join("\n\n"));
		} finally {
			setIsGeneratingNarration(false);
		}
	}, [cursorTelemetry, videoDurationMs]);

	const handleApplyNarration = useCallback(() => {
		if (narrationSegments.length === 0) return;
		onApplyEdits({
			narrationTrack: { segments: narrationSegments, audioPath: null },
		});
	}, [narrationSegments, onApplyEdits]);

	// ── TTS Generate Audio ──
	const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

	const handleGenerateAudio = useCallback(async () => {
		if (!narrationText.trim()) return;
		setIsGeneratingAudio(true);
		try {
			const result = await window.electronAPI.aiTtsSynthesize(narrationText);
			if (result.success && result.audioPath) {
				toast.success("Narration audio generated", {
					description: result.audioPath,
				});
			} else {
				toast.error(result.error || "Failed to generate audio");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to generate audio");
		} finally {
			setIsGeneratingAudio(false);
		}
	}, [narrationText]);

	// ── Extract Clips ──
	const [clips, setClips] = useState<ExtractedClip[]>([]);
	const [isExtractingClips, setIsExtractingClips] = useState(false);

	const handleExtractClips = useCallback(async () => {
		if (cursorTelemetry.length === 0 || videoDurationMs <= 0) return;
		setIsExtractingClips(true);

		try {
			const profile = analyzeRecording(cursorTelemetry, videoDurationMs);
			const heuristicClips = extractClips(profile, videoDurationMs, 3);

			// Try to get AI-generated titles for the clips
			if (heuristicClips.length > 0) {
				const clipDescriptions = heuristicClips
					.map(
						(c) =>
							`Clip at ${Math.round(c.startMs / 1000)}s-${Math.round(c.endMs / 1000)}s (score: ${Math.round(c.score * 100)}%)`,
					)
					.join("\n");

				const aiResult = await window.electronAPI?.aiAnalyze?.(
					"For each clip timestamp below from a screen recording, suggest a short descriptive title (3-6 words). " +
						"Return one title per line, matching the order of clips.\n\n" +
						clipDescriptions,
				);

				if (aiResult?.success && aiResult.text) {
					const titles = aiResult.text.split("\n").filter((l: string) => l.trim());
					for (let i = 0; i < Math.min(titles.length, heuristicClips.length); i++) {
						heuristicClips[i].title = titles[i].replace(/^\d+[.)]\s*/, "").trim();
					}
				}
			}

			setClips(heuristicClips);
		} catch {
			const profile = analyzeRecording(cursorTelemetry, videoDurationMs);
			setClips(extractClips(profile, videoDurationMs, 3));
		} finally {
			setIsExtractingClips(false);
		}
	}, [cursorTelemetry, videoDurationMs]);

	// ── AI Settings ──
	const [provider, setProvider] = useState<AIProvider>("openai");
	const [apiKey, setApiKey] = useState("");
	const [isSavingSettings, setIsSavingSettings] = useState(false);

	useEffect(() => {
		window.electronAPI
			.aiGetConfig()
			.then((config) => {
				setProvider(config.provider);
				setApiKey(config.apiKey ?? "");
			})
			.catch(() => {
				// Ignore errors loading config
			});
	}, []);

	const handleSaveSettings = useCallback(async () => {
		setIsSavingSettings(true);
		try {
			await window.electronAPI.aiSaveConfig({ provider, apiKey: apiKey || undefined });
			const newAvailability = await window.electronAPI.aiCheckAvailability();
			setAvailability(newAvailability);
		} catch {
			// Ignore save errors
		} finally {
			setIsSavingSettings(false);
		}
	}, [provider, apiKey]);

	function formatDuration(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${String(seconds).padStart(2, "0")}`;
	}

	const hasTelemetry = cursorTelemetry.length > 0 && videoDurationMs > 0;

	return (
		<div className="h-full flex flex-col bg-[#09090b] rounded-2xl border border-white/5 shadow-lg overflow-hidden">
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
				<Sparkles size={14} className="text-[#2563eb]" />
				<span className="text-xs font-semibold text-white/90">AI Features</span>
				{availability && (
					<span
						className={`ml-auto text-[9px] px-1.5 py-0.5 rounded ${
							availability.activeProvider
								? "bg-[#2563eb]/20 text-[#2563eb]"
								: "bg-white/10 text-white/40"
						}`}
					>
						{availability.activeProvider ? availability.activeProvider : "Offline"}
					</span>
				)}
			</div>

			{/* Scrollable sections */}
			<div className="flex-1 overflow-y-auto">
				{/* Smart Trim */}
				<Section title="Smart Trim" icon={Scissors} defaultOpen>
					<SmartTrimSuggestions
						cursorTelemetry={cursorTelemetry}
						videoDurationMs={videoDurationMs}
						onAcceptSuggestions={onAcceptTrimSuggestions}
					/>
				</Section>

				{/* Magic Polish */}
				<Section title="Magic Polish" icon={Wand2}>
					<div className="flex flex-col gap-2">
						{!polishPreview ? (
							<button
								type="button"
								onClick={handleRunPolish}
								disabled={isPolishing || !hasTelemetry}
								className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#2563eb]/20 to-purple-500/20 hover:from-[#2563eb]/30 hover:to-purple-500/30 text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
							>
								<Wand2 size={14} />
								{isPolishing ? "Analyzing..." : "Run Magic Polish"}
							</button>
						) : (
							<>
								<div className="text-[10px] text-white/60 space-y-1">
									{polishPreview.zoomCount > 0 && (
										<div>+ {polishPreview.zoomCount} auto-zoom regions</div>
									)}
									{polishPreview.trimCount > 0 && <div>+ {polishPreview.trimCount} auto-trims</div>}
									{polishPreview.speedRampCount > 0 && (
										<div>+ {polishPreview.speedRampCount} speed ramps</div>
									)}
									{polishPreview.wallpaperChanged && <div>+ Set wallpaper</div>}
									{polishPreview.borderRadiusChanged && <div>+ Border radius: 12px</div>}
									{polishPreview.paddingChanged && <div>+ Padding: 8px</div>}
								</div>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={handleApplyPolish}
										className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-[#2563eb]/20 hover:bg-[#2563eb]/30 text-[#2563eb] transition-colors"
									>
										<Check size={10} />
										Apply
									</button>
									<button
										type="button"
										onClick={handleCancelPolish}
										className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white/60 transition-colors"
									>
										<X size={10} />
									</button>
								</div>
							</>
						)}
					</div>
				</Section>

				{/* Auto-Narrate */}
				<Section title="Auto-Narrate" icon={AudioLines}>
					<div className="flex flex-col gap-2">
						<button
							type="button"
							onClick={handleGenerateNarration}
							disabled={isGeneratingNarration || !hasTelemetry}
							className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							<AudioLines size={14} />
							{isGeneratingNarration ? "Generating..." : "Generate Script"}
						</button>

						{narrationText && (
							<>
								<textarea
									value={narrationText}
									onChange={(e) => setNarrationText(e.target.value)}
									className="w-full h-32 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/70 resize-none focus:outline-none focus:border-[#2563eb]/40"
									placeholder="Narration script..."
								/>
								<button
									type="button"
									onClick={handleApplyNarration}
									className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded text-[10px] font-medium bg-[#2563eb]/20 hover:bg-[#2563eb]/30 text-[#2563eb] transition-colors"
								>
									<Check size={10} />
									Save to Project
								</button>
								<button
									type="button"
									onClick={handleGenerateAudio}
									disabled={isGeneratingAudio}
									className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 rounded text-[10px] font-medium bg-white/10 hover:bg-white/15 text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
								>
									<AudioLines size={12} />
									{isGeneratingAudio ? "Generating audio..." : "Generate Audio"}
								</button>
							</>
						)}
					</div>
				</Section>

				{/* Extract Clips */}
				<Section title="Extract Clips" icon={Film}>
					<div className="flex flex-col gap-2">
						<button
							type="button"
							onClick={handleExtractClips}
							disabled={isExtractingClips || !hasTelemetry}
							className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							<Film size={14} />
							{isExtractingClips ? "Extracting..." : "Find Best Clips"}
						</button>

						{clips.length > 0 && (
							<div className="flex flex-col gap-1">
								{clips.map((clip) => (
									<button
										type="button"
										key={clip.id}
										className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#2563eb]/30 transition-colors cursor-pointer text-left w-full"
										onClick={() => onSeek?.(clip.startMs)}
										title="Click to jump to this clip"
									>
										<div className="flex-1 min-w-0">
											<div className="text-[10px] text-white/80 font-medium truncate">
												{clip.title}
											</div>
											<div className="text-[9px] text-white/40">
												{formatDuration(clip.startMs)} - {formatDuration(clip.endMs)} | Score:{" "}
												{Math.round(clip.score * 100)}%
											</div>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</Section>

				{/* AI Settings */}
				<Section title="AI Settings" icon={Settings2}>
					<div className="flex flex-col gap-2">
						<div>
							<label className="text-[10px] text-white/50 block mb-1">Provider</label>
							<select
								value={provider}
								onChange={(e) => setProvider(e.target.value as AIProvider)}
								className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/80 focus:outline-none focus:border-[#2563eb]/40"
							>
								<option value="openai" className="bg-[#09090b]">
									OpenAI
								</option>
								<option value="anthropic" className="bg-[#09090b]">
									Anthropic
								</option>
								<option value="groq" className="bg-[#09090b]">
									Groq
								</option>
								<option value="minimax" className="bg-[#09090b]">
									MiniMax
								</option>
								{availability?.providers.find((p) => p.id === "ollama" && p.available) && (
									<option value="ollama" className="bg-[#09090b]">
										Ollama (Local)
									</option>
								)}
							</select>
						</div>

						<div>
							<label className="text-[10px] text-white/50 block mb-1">
								<Key size={10} className="inline mr-1" />
								API Key
							</label>
							<input
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="sk-..."
								className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/80 placeholder-white/30 focus:outline-none focus:border-[#2563eb]/40"
							/>
						</div>

						<button
							type="button"
							onClick={handleSaveSettings}
							disabled={isSavingSettings}
							className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white/80 disabled:opacity-40 transition-colors"
						>
							{isSavingSettings ? "Saving..." : "Save Settings"}
						</button>

						{availability && (
							<div className="text-[9px] text-white/40 space-y-0.5">
								{availability.providers.map((p) => (
									<div key={p.id}>
										{p.id}:{" "}
										<span className={p.available ? "text-green-400" : "text-red-400"}>
											{p.available ? "Available" : p.reason || "Not configured"}
										</span>
									</div>
								))}
								{availability.activeProvider && (
									<div className="text-white/60 mt-1">Active: {availability.activeProvider}</div>
								)}
							</div>
						)}
					</div>
				</Section>
			</div>
		</div>
	);
}
