import { Film, FolderOpen, PlayCircle } from "lucide-react";

interface WelcomeScreenProps {
	onNewRecording: () => void;
	onOpenVideo: () => void;
	onOpenProject: () => void;
}

export function WelcomeScreen({ onNewRecording, onOpenVideo, onOpenProject }: WelcomeScreenProps) {
	return (
		<div className="relative flex flex-col items-center justify-center h-screen gap-8 bg-[#09090b]">
			<div className="flex flex-col items-center gap-3">
				<img src="/lucidstudio-logo-noborder.png" alt="Lucid Studio" className="w-20 h-20" />
				<h1 className="text-2xl font-semibold text-white">Lucid Studio</h1>
				<p className="text-sm text-white/40">AI-powered screen recording and editing</p>
			</div>
			<div className="flex flex-col gap-3 w-64">
				<button
					onClick={onNewRecording}
					className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#2563eb] hover:bg-[#2563eb]/90 text-white font-medium transition-colors"
				>
					<PlayCircle size={18} />
					New Recording
				</button>
				<button
					onClick={onOpenVideo}
					className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors border border-white/10"
				>
					<Film size={18} />
					Open Video File
				</button>
				<button
					onClick={onOpenProject}
					className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors border border-white/10"
				>
					<FolderOpen size={18} />
					Open Project
				</button>
			</div>

			{/* Attribution */}
			<a
				href="#"
				onClick={(e) => {
					e.preventDefault();
					window.electronAPI?.openExternalUrl("https://getcoherence.io");
				}}
				className="absolute bottom-6 right-6 px-3 py-1 text-[10px] text-white/50 hover:text-white/70 border border-[#2563eb]/30 hover:border-[#2563eb]/50 rounded-full transition-colors"
			>
				Made by Coherence
			</a>
		</div>
	);
}
