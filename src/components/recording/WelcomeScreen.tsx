import { Bot, Clapperboard, Film, FolderOpen, Key, PlayCircle, Settings } from "lucide-react";
import { useState } from "react";
import { AISettingsDialog } from "@/components/ui/AISettingsDialog";
import { ProBadge, useProGate } from "@/components/ui/ProGate";
import { useAIPreflight } from "@/hooks/useAIPreflight";
import studioLogo from "/coherence-studio-logo.png";

interface WelcomeScreenProps {
	onNewRecording: () => void;
	onOpenVideo: () => void;
	onOpenProject: () => void;
	onCreateVideo?: () => void;
	onAiDemo?: () => void;
}

export function WelcomeScreen({
	onNewRecording,
	onOpenVideo,
	onOpenProject,
	onCreateVideo,
	onAiDemo,
}: WelcomeScreenProps) {
	const { isPro, checkFeature, gateDialog } = useProGate();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const { availability, requireChatProvider, dialogOpen, dialogMessage, closeDialog } =
		useAIPreflight();
	const hasAnyProvider = availability?.activeProvider != null;

	return (
		<div className="relative flex flex-col items-center justify-center h-screen gap-8 bg-[#09090b]">
			{gateDialog}

			<div className="flex flex-col items-center gap-3">
				<img src={studioLogo} alt="Studio" className="w-20 h-20" />
				<h1 className="text-2xl font-semibold text-white">Studio</h1>
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
				{onCreateVideo && (
					<button
						onClick={() => {
							if (checkFeature("scene-builder")) onCreateVideo();
						}}
						className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors border border-[#2563eb]/30 hover:border-[#2563eb]/50"
					>
						<Clapperboard size={18} />
						Create Video
						{!isPro && <ProBadge />}
					</button>
				)}
				{onAiDemo && (
					<button
						onClick={async () => {
							if (!checkFeature("ai-demo-recorder")) return;
							if (!(await requireChatProvider("Generate AI Video"))) return;
							onAiDemo();
						}}
						className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors border border-[#2563eb]/30 hover:border-[#2563eb]/50"
					>
						<Bot size={18} />
						Generate AI Video
						{!isPro && <ProBadge />}
					</button>
				)}
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

			{/* "Connect AI providers" nudge — shown only if no provider has a key
			    configured. Gives new users an obvious first step so they don't
			    click AI features blind and hit the preflight dialog. */}
			{availability && !hasAnyProvider && (
				<button
					onClick={() => setSettingsOpen(true)}
					className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563eb]/10 hover:bg-[#2563eb]/20 border border-[#2563eb]/30 hover:border-[#2563eb]/50 text-xs text-white/80 transition-colors"
				>
					<Key size={12} className="text-[#2563eb]" />
					Connect an AI provider to unlock AI features
				</button>
			)}

			{/* Settings gear */}
			<button
				onClick={() => setSettingsOpen(true)}
				className="absolute bottom-6 left-6 p-2 text-white/30 hover:text-white/60 transition-colors rounded-md hover:bg-white/5"
				title="Settings"
			>
				<Settings size={16} />
			</button>
			<AISettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
			{/* Preflight dialog — opened when an AI action is invoked without a
			    configured provider. Reuses AISettingsDialog with a banner. */}
			<AISettingsDialog
				open={dialogOpen}
				onOpenChange={(o) => {
					if (!o) closeDialog();
				}}
				preflightMessage={dialogMessage}
			/>

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
