/**
 * SmartTrimSuggestions — displays AI-generated trim suggestions
 * with accept/dismiss controls per suggestion and an "Accept All" button.
 */
import { Check, Scissors, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { analyzeRecording } from "@/lib/ai/recordingAnalyzer";
import { generateTrimSuggestions } from "@/lib/ai/smartTrim";
import type { TrimSuggestion } from "@/lib/ai/types";
import type { CursorTelemetryPoint, TrimRegion } from "./types";

interface SmartTrimSuggestionsProps {
	cursorTelemetry: CursorTelemetryPoint[];
	videoDurationMs: number;
	onAcceptSuggestions: (trims: TrimRegion[]) => void;
}

export function SmartTrimSuggestions({
	cursorTelemetry,
	videoDurationMs,
	onAcceptSuggestions,
}: SmartTrimSuggestionsProps) {
	const [suggestions, setSuggestions] = useState<TrimSuggestion[]>([]);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [hasAnalyzed, setHasAnalyzed] = useState(false);

	const runAnalysis = useCallback(() => {
		if (cursorTelemetry.length === 0 || videoDurationMs <= 0) return;

		setIsAnalyzing(true);

		// Use requestAnimationFrame to avoid blocking UI
		requestAnimationFrame(() => {
			const profile = analyzeRecording(cursorTelemetry, videoDurationMs);
			const trimSuggestions = generateTrimSuggestions(profile, videoDurationMs);
			setSuggestions(trimSuggestions);
			setHasAnalyzed(true);
			setIsAnalyzing(false);
		});
	}, [cursorTelemetry, videoDurationMs]);

	const handleAcceptAll = useCallback(() => {
		const trims: TrimRegion[] = suggestions.map((s) => ({
			id: s.id,
			startMs: s.startMs,
			endMs: s.endMs,
		}));
		onAcceptSuggestions(trims);
		setSuggestions([]);
		setHasAnalyzed(false);
	}, [suggestions, onAcceptSuggestions]);

	const handleAcceptOne = useCallback(
		(suggestion: TrimSuggestion) => {
			onAcceptSuggestions([
				{
					id: suggestion.id,
					startMs: suggestion.startMs,
					endMs: suggestion.endMs,
				},
			]);
			setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
		},
		[onAcceptSuggestions],
	);

	const handleDismissOne = useCallback((id: string) => {
		setSuggestions((prev) => prev.filter((s) => s.id !== id));
	}, []);

	const handleClearAll = useCallback(() => {
		setSuggestions([]);
		setHasAnalyzed(false);
	}, []);

	function formatDuration(ms: number): string {
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function confidenceColor(confidence: number): string {
		if (confidence >= 0.8) return "text-green-400";
		if (confidence >= 0.6) return "text-yellow-400";
		return "text-orange-400";
	}

	const totalTrimMs = suggestions.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-white/70">Smart Trim</span>
				{!hasAnalyzed ? (
					<button
						type="button"
						onClick={runAnalysis}
						disabled={isAnalyzing || cursorTelemetry.length === 0}
						className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						<Scissors size={12} />
						{isAnalyzing ? "Analyzing..." : "Analyze"}
					</button>
				) : suggestions.length > 0 ? (
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handleAcceptAll}
							className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[#2563eb]/20 hover:bg-[#2563eb]/30 text-[#2563eb] transition-colors"
						>
							<Check size={10} />
							Accept All
						</button>
						<button
							type="button"
							onClick={handleClearAll}
							className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white/60 transition-colors"
						>
							<Trash2 size={10} />
						</button>
					</div>
				) : (
					<span className="text-[10px] text-white/40">No suggestions</span>
				)}
			</div>

			{suggestions.length > 0 && (
				<>
					<div className="text-[10px] text-white/40">
						{suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} -{" "}
						{formatDuration(totalTrimMs)} total
					</div>

					<div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
						{suggestions.map((suggestion) => (
							<div
								key={suggestion.id}
								className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20"
							>
								<div className="flex-1 min-w-0">
									<div className="text-[10px] text-white/80 truncate">{suggestion.description}</div>
									<div className="flex items-center gap-2 text-[9px] text-white/40">
										<span>
											{formatDuration(suggestion.startMs)} - {formatDuration(suggestion.endMs)}
										</span>
										<span className={confidenceColor(suggestion.confidence)}>
											{Math.round(suggestion.confidence * 100)}%
										</span>
									</div>
								</div>
								<div className="flex items-center gap-0.5">
									<button
										type="button"
										onClick={() => handleAcceptOne(suggestion)}
										className="p-1 rounded hover:bg-[#2563eb]/20 text-[#2563eb]/70 hover:text-[#2563eb] transition-colors"
										title="Accept"
									>
										<Check size={12} />
									</button>
									<button
										type="button"
										onClick={() => handleDismissOne(suggestion.id)}
										className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
										title="Dismiss"
									>
										<X size={12} />
									</button>
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
