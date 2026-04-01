import { Eye, Square } from "lucide-react";
import { useEffect, useState } from "react";

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RecordingBar() {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const startTime = Date.now();
		const timer = setInterval(() => {
			setElapsed(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	const handleStop = () => {
		window.electronAPI?.stopRecordingFromBar();
	};

	const handleHide = () => {
		window.electronAPI?.hideRecordingBar();
	};

	return (
		<div
			className="w-full h-full flex items-center justify-center bg-transparent"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			<div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[rgba(18,18,22,0.95)] border border-white/10 shadow-lg backdrop-blur-xl">
				{/* Recording indicator */}
				<div className="flex items-center gap-2">
					<div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
					<span className="text-white/70 text-xs font-medium tabular-nums">
						{formatTime(elapsed)}
					</span>
				</div>

				<div className="w-px h-4 bg-white/10" />

				{/* Stop button */}
				<button
					onClick={handleStop}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-medium transition-colors"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<Square size={10} fill="currentColor" />
					Stop
				</button>

				{/* Hide button */}
				<button
					onClick={handleHide}
					className="flex items-center gap-1 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
					title="Hide recording bar"
				>
					<Eye size={14} />
				</button>
			</div>
		</div>
	);
}
