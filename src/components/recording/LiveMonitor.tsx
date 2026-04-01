import { Minimize2, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LiveMonitorProps {
	screenStream: MediaStream | null;
	webcamStream: MediaStream | null;
	onStop: () => void;
	onMinimize: () => void;
}

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function LiveMonitor({ screenStream, webcamStream, onStop, onMinimize }: LiveMonitorProps) {
	const screenVideoRef = useRef<HTMLVideoElement>(null);
	const webcamVideoRef = useRef<HTMLVideoElement>(null);
	const [elapsed, setElapsed] = useState(0);

	// Timer
	useEffect(() => {
		const start = Date.now();
		const timer = setInterval(() => {
			setElapsed(Math.floor((Date.now() - start) / 1000));
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	// Attach screen stream
	useEffect(() => {
		const video = screenVideoRef.current;
		if (video && screenStream) {
			video.srcObject = screenStream;
			video.play().catch(() => {});
		}
		return () => {
			if (video) video.srcObject = null;
		};
	}, [screenStream]);

	// Attach webcam stream
	useEffect(() => {
		const video = webcamVideoRef.current;
		if (video && webcamStream) {
			video.srcObject = webcamStream;
			video.play().catch(() => {});
		}
		return () => {
			if (video) video.srcObject = null;
		};
	}, [webcamStream]);

	return (
		<div className="flex flex-col items-center justify-center h-screen bg-[#09090b] gap-4 p-8">
			{/* Live preview */}
			<div className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden bg-black shadow-2xl border border-white/10">
				{screenStream ? (
					<video ref={screenVideoRef} muted playsInline className="w-full h-full object-contain" />
				) : (
					<div className="flex items-center justify-center h-full text-white/30">
						Waiting for screen capture...
					</div>
				)}

				{/* Webcam PiP */}
				{webcamStream && (
					<div className="absolute bottom-4 right-4 w-40 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
						<video
							ref={webcamVideoRef}
							muted
							playsInline
							className="w-full h-full object-cover scale-x-[-1]"
						/>
					</div>
				)}

				{/* Recording indicator overlay */}
				<div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
					<div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
					<span className="text-white text-xs font-semibold tabular-nums">
						REC {formatTime(elapsed)}
					</span>
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center gap-3">
				<button
					onClick={onStop}
					className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium transition-colors border border-red-500/20"
				>
					<Square size={14} fill="currentColor" />
					Stop Recording
				</button>
				<button
					onClick={onMinimize}
					className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 font-medium transition-colors border border-white/10"
					title="Minimize to recording bar"
				>
					<Minimize2 size={14} />
					Minimize
				</button>
			</div>

			<p className="text-xs text-white/30">
				Your screen is being recorded. Minimize to hide this window.
			</p>
		</div>
	);
}
