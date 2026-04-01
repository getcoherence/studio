import { FolderOpen, PlayCircle, Video } from "lucide-react";

interface WelcomeScreenProps {
	onNewRecording: () => void;
	onOpenVideo: () => void;
	onOpenProject: () => void;
}

export function WelcomeScreen({ onNewRecording, onOpenVideo, onOpenProject }: WelcomeScreenProps) {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-8 bg-[#09090b]">
			<div className="flex flex-col items-center gap-2">
				<Video className="w-16 h-16 text-[#34B27B]/60" />
				<h1 className="text-2xl font-semibold text-white">Lucid Studio</h1>
				<p className="text-sm text-white/40">AI-powered screen recording and editing</p>
			</div>
			<div className="flex flex-col gap-3 w-64">
				<button
					onClick={onNewRecording}
					className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#34B27B] hover:bg-[#34B27B]/90 text-white font-medium transition-colors"
				>
					<PlayCircle size={18} />
					New Recording
				</button>
				<button
					onClick={onOpenVideo}
					className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors border border-white/10"
				>
					<Video size={18} />
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
		</div>
	);
}
