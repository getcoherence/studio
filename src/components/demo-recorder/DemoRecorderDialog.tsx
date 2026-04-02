/**
 * AI Demo Recorder Dialog — lets the user specify a URL and prompt,
 * then runs the DemoAgent in the main process to create a scene project.
 */

import { Bot, Loader2, Play } from "lucide-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface DemoRecorderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onStart: (config: { url: string; prompt: string; maxSteps: number; headless: boolean }) => void;
}

export function DemoRecorderDialog({ open, onOpenChange, onStart }: DemoRecorderDialogProps) {
	const [url, setUrl] = useState("https://");
	const [prompt, setPrompt] = useState("");
	const [maxSteps, setMaxSteps] = useState(12);
	const [headless, setHeadless] = useState(false);

	const isValid = url.startsWith("http") && url.length > 10 && prompt.trim().length > 5;

	function handleStart() {
		if (!isValid) return;
		onStart({ url: url.trim(), prompt: prompt.trim(), maxSteps, headless });
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#0f0f11] border-white/10 text-white max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-white">
						<Bot size={20} className="text-[#2563eb]" />
						AI Demo Recorder
					</DialogTitle>
					<DialogDescription className="text-white/50">
						Give Lucid a URL and a goal. The AI will navigate the site and capture a demo.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					{/* URL */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-white/60">URL</label>
						<input
							type="url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://example.com"
							className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#2563eb]/50 transition-colors"
							autoFocus
						/>
					</div>

					{/* Prompt */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-white/60">What should the demo show?</label>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Walk through the main features, show the dashboard, and end on the pricing page."
							rows={3}
							className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-[#2563eb]/50 transition-colors"
						/>
					</div>

					{/* Options */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<label className="text-xs text-white/60">Max steps</label>
							<select
								value={maxSteps}
								onChange={(e) => setMaxSteps(Number(e.target.value))}
								className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none"
							>
								<option value={8}>8 (short)</option>
								<option value={12}>12 (standard)</option>
								<option value={15}>15 (detailed)</option>
								<option value={20}>20 (thorough)</option>
							</select>
						</div>
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={headless}
								onChange={(e) => setHeadless(e.target.checked)}
								className="rounded bg-white/5 border-white/20"
							/>
							<span className="text-xs text-white/60">Run headless (no visible browser)</span>
						</label>
					</div>
				</div>

				<DialogFooter className="gap-2">
					<button
						onClick={() => onOpenChange(false)}
						className="px-4 py-2 rounded-md text-sm text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleStart}
						disabled={!isValid}
						className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#2563eb] hover:bg-[#2563eb]/90 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<Play size={14} />
						Start Demo
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface DemoProgressProps {
	currentStep: {
		action: {
			action: string;
			narration: string;
		};
		timestamp: number;
		screenshotDataUrl?: string;
	} | null;
	stepIndex: number;
	maxSteps: number;
	elapsedMs: number;
	onStop: () => void;
	onComplete: () => void;
	isComplete: boolean;
}

export function DemoProgress({
	currentStep,
	stepIndex,
	maxSteps,
	elapsedMs,
	onStop,
	onComplete,
	isComplete,
}: DemoProgressProps) {
	const elapsed = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(elapsed / 60);
	const seconds = elapsed % 60;
	const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

	return (
		<div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
			<div className="w-full max-w-2xl mx-4 flex flex-col gap-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{!isComplete && (
							<span className="flex items-center gap-2 text-sm text-white/60">
								<Loader2 size={14} className="animate-spin text-[#2563eb]" />
								Recording AI Demo...
							</span>
						)}
						{isComplete && <span className="text-sm text-emerald-400">Demo complete</span>}
					</div>
					<div className="flex items-center gap-2 text-sm text-white/50">
						<span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
						{timeStr}
					</div>
				</div>

				{/* Screenshot preview */}
				{currentStep?.screenshotDataUrl && (
					<div className="rounded-lg overflow-hidden border border-white/10 bg-black">
						<img src={currentStep.screenshotDataUrl} alt="Current page" className="w-full h-auto" />
					</div>
				)}

				{/* Narration */}
				{currentStep && (
					<div className="flex items-start gap-2 px-3 py-2 rounded-md bg-white/5 border border-white/10">
						<Bot size={16} className="text-[#2563eb] mt-0.5 flex-shrink-0" />
						<p className="text-sm text-white/80 leading-relaxed">{currentStep.action.narration}</p>
					</div>
				)}

				{/* Progress bar */}
				<div className="flex items-center gap-3">
					<div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
						<div
							className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
							style={{ width: `${Math.min(100, ((stepIndex + 1) / maxSteps) * 100)}%` }}
						/>
					</div>
					<span className="text-xs text-white/40 whitespace-nowrap">
						{stepIndex + 1} / ~{maxSteps}
					</span>
				</div>

				{/* Actions */}
				<div className="flex justify-end gap-2">
					{!isComplete && (
						<button
							onClick={onStop}
							className="px-4 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
						>
							Stop Early
						</button>
					)}
					{isComplete && (
						<button
							onClick={onComplete}
							className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#2563eb] hover:bg-[#2563eb]/90 text-white text-sm font-medium transition-colors"
						>
							Open in Editor
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
