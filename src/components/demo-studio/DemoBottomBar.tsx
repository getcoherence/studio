/**
 * DemoBottomBar — progress bar, elapsed time, stop/resume controls.
 */

import { Play, Square } from "lucide-react";
import type { DemoAgentStatus } from "./types";

interface DemoBottomBarProps {
	status: DemoAgentStatus;
	stepIndex: number;
	maxSteps: number;
	elapsedMs: number;
	onStop: () => void;
	onResume: () => void;
}

export function DemoBottomBar({
	status,
	stepIndex,
	maxSteps,
	elapsedMs,
	onStop,
	onResume,
}: DemoBottomBarProps) {
	if (status === "idle") return null;

	const elapsed = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(elapsed / 60);
	const seconds = elapsed % 60;
	const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	const progress = maxSteps > 0 ? Math.min(100, ((stepIndex + 1) / maxSteps) * 100) : 0;

	return (
		<div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/8 bg-[#111114]">
			{/* Progress bar */}
			<div className="flex items-center gap-3 flex-1">
				<div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
					<div
						className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<span className="text-xs text-white/40 whitespace-nowrap tabular-nums">
					Step {stepIndex + 1} / {maxSteps}
				</span>
			</div>

			{/* Timer */}
			<div className="flex items-center gap-1.5 text-xs text-white/40 tabular-nums">
				{status === "running" && (
					<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
				)}
				{timeStr}
			</div>

			{/* Controls */}
			<div className="flex items-center gap-1.5">
				{status === "paused" && (
					<button
						onClick={onResume}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2563eb] hover:bg-[#2563eb]/90 text-white text-xs font-medium transition-colors"
					>
						<Play size={12} />
						Continue
					</button>
				)}
				{(status === "running" || status === "paused") && (
					<button
						onClick={onStop}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/8 border border-white/10 text-xs transition-colors"
					>
						<Square size={10} />
						Stop
					</button>
				)}
				{status === "complete" && (
					<span className="text-xs text-emerald-400 font-medium">Complete</span>
				)}
			</div>
		</div>
	);
}
