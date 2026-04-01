import { ChevronDown, Mic, MicOff, Monitor, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { MdCheck } from "react-icons/md";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DesktopSource {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
}

export interface RecordingConfig {
	source: ProcessedDesktopSource;
	microphoneEnabled: boolean;
	microphoneDeviceId?: string;
	systemAudioEnabled: boolean;
	webcamEnabled: boolean;
	webcamDeviceId?: string;
}

interface MediaDeviceInfo {
	deviceId: string;
	label: string;
	kind: string;
}

interface RecordingSetupDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onStartRecording: (config: RecordingConfig) => void;
}

export function RecordingSetupDialog({
	open,
	onOpenChange,
	onStartRecording,
}: RecordingSetupDialogProps) {
	const [sources, setSources] = useState<DesktopSource[]>([]);
	const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
	const [loading, setLoading] = useState(true);
	const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
	const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
	const [webcamEnabled, setWebcamEnabled] = useState(false);
	const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
	const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
	const [selectedMicId, setSelectedMicId] = useState<string>("");
	const [selectedWebcamId, setSelectedWebcamId] = useState<string>("");

	// Enumerate audio/video devices
	useEffect(() => {
		if (!open) return;
		async function loadDevices() {
			try {
				// Request permission first so labels are populated
				await navigator.mediaDevices
					.getUserMedia({ audio: true, video: true })
					.then((s) => {
						for (const track of s.getTracks()) track.stop();
					})
					.catch(() => {
						// Permission denied — we'll get devices without labels
					});
				const devices = await navigator.mediaDevices.enumerateDevices();
				const mics = devices
					.filter((d) => d.kind === "audioinput")
					.map((d) => ({
						deviceId: d.deviceId,
						label: d.label || `Microphone ${d.deviceId.slice(0, 4)}`,
						kind: d.kind,
					}));
				const cams = devices
					.filter((d) => d.kind === "videoinput")
					.map((d) => ({
						deviceId: d.deviceId,
						label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
						kind: d.kind,
					}));
				setMicDevices(mics);
				setWebcamDevices(cams);
				if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId);
				if (cams.length > 0 && !selectedWebcamId) setSelectedWebcamId(cams[0].deviceId);
			} catch (err) {
				console.error("Failed to enumerate devices:", err);
			}
		}
		loadDevices();
	}, [open]);

	useEffect(() => {
		if (!open) return;

		async function fetchSources() {
			setLoading(true);
			try {
				const rawSources = await window.electronAPI.getSources({
					types: ["screen", "window"],
					thumbnailSize: { width: 320, height: 180 },
					fetchWindowIcons: true,
				});
				const processed = rawSources.map((source) => ({
					id: source.id,
					name:
						source.id.startsWith("window:") && source.name.includes(" — ")
							? source.name.split(" — ")[1] || source.name
							: source.name,
					thumbnail: source.thumbnail,
					display_id: source.display_id,
					appIcon: source.appIcon,
				}));
				setSources(processed);
				// Auto-select first screen source
				const firstScreen = processed.find((s) => s.id.startsWith("screen:"));
				if (firstScreen && !selectedSource) {
					setSelectedSource(firstScreen);
				}
			} catch (error) {
				console.error("Error loading sources:", error);
			} finally {
				setLoading(false);
			}
		}
		fetchSources();
	}, [open]);

	const screenSources = sources.filter((s) => s.id.startsWith("screen:"));
	const windowSources = sources.filter((s) => s.id.startsWith("window:"));

	const handleRecord = () => {
		if (!selectedSource) return;
		onStartRecording({
			source: selectedSource,
			microphoneEnabled,
			microphoneDeviceId: selectedMicId || undefined,
			systemAudioEnabled,
			webcamEnabled,
			webcamDeviceId: selectedWebcamId || undefined,
		});
	};

	const renderSourceCard = (source: DesktopSource) => {
		const isSelected = selectedSource?.id === source.id;
		return (
			<div
				key={source.id}
				className={`p-2 rounded-xl cursor-pointer transition-all duration-200 ${
					isSelected
						? "border-2 border-[#34B27B] bg-[#34B27B]/5 shadow-[0_0_12px_rgba(52,178,123,0.15)]"
						: "border border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
				}`}
				onClick={() => setSelectedSource(source)}
			>
				<div className="relative mb-1.5">
					<img
						src={source.thumbnail || ""}
						alt={source.name}
						className="w-full aspect-video object-cover rounded-lg"
					/>
					{isSelected && (
						<div className="absolute -top-1.5 -right-1.5">
							<div className="w-[18px] h-[18px] bg-[#34B27B] rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(52,178,123,0.4)]">
								<MdCheck size={12} className="text-white" />
							</div>
						</div>
					)}
				</div>
				<div className="flex items-center gap-1.5">
					{source.appIcon && (
						<img src={source.appIcon} alt="" className="w-[13px] h-[13px] flex-shrink-0" />
					)}
					<div className="text-[0.8rem] text-[#e4e4e7] font-medium truncate">{source.name}</div>
				</div>
			</div>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl bg-[#18181b] border-white/10 text-white">
				<DialogHeader>
					<DialogTitle className="text-white">New Recording</DialogTitle>
					<DialogDescription className="text-white/40">
						Choose a screen or window to record
					</DialogDescription>
				</DialogHeader>

				{/* Source picker */}
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<div className="text-center">
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#34B27B] mx-auto mb-2" />
							<p className="text-xs text-zinc-400">Loading sources...</p>
						</div>
					</div>
				) : (
					<Tabs
						defaultValue={screenSources.length === 0 ? "windows" : "screens"}
						className="w-full"
					>
						<TabsList className="grid grid-cols-2 mb-3 bg-white/5 rounded-full">
							<TabsTrigger
								value="screens"
								className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-zinc-400 rounded-full text-xs py-1 transition-all"
							>
								Screens ({screenSources.length})
							</TabsTrigger>
							<TabsTrigger
								value="windows"
								className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-zinc-400 rounded-full text-xs py-1 transition-all"
							>
								Windows ({windowSources.length})
							</TabsTrigger>
						</TabsList>
						<TabsContent value="screens" className="mt-0">
							<div className="grid grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1">
								{screenSources.map(renderSourceCard)}
							</div>
						</TabsContent>
						<TabsContent value="windows" className="mt-0">
							<div className="grid grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1">
								{windowSources.map(renderSourceCard)}
							</div>
						</TabsContent>
					</Tabs>
				)}

				{/* Audio/video settings */}
				<div className="flex flex-col gap-3 pt-3 border-t border-white/5">
					<div className="flex items-center gap-3">
						{/* System Audio toggle */}
						<button
							className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
								systemAudioEnabled
									? "bg-[#34B27B]/15 text-[#34B27B] border border-[#34B27B]/30"
									: "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
							}`}
							onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
						>
							{systemAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
							System Audio
						</button>

						{/* Microphone toggle + device selector */}
						<div className="flex items-center gap-0">
							<button
								className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
									microphoneEnabled
										? "bg-[#34B27B]/15 text-[#34B27B] border border-[#34B27B]/30 rounded-l-lg border-r-0"
										: "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 rounded-lg"
								}`}
								onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
							>
								{microphoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
								{microphoneEnabled ? "Mic ON" : "Mic OFF"}
							</button>
							{microphoneEnabled && micDevices.length > 0 && (
								<div className="relative">
									<select
										value={selectedMicId}
										onChange={(e) => setSelectedMicId(e.target.value)}
										className="appearance-none bg-[#34B27B]/15 border border-[#34B27B]/30 border-l-0 rounded-r-lg text-[#34B27B] text-xs py-2 pl-2 pr-6 outline-none cursor-pointer max-w-[140px] truncate"
									>
										{micDevices.map((d) => (
											<option
												key={d.deviceId}
												value={d.deviceId}
												className="bg-[#18181b] text-white"
											>
												{d.label}
											</option>
										))}
									</select>
									<ChevronDown
										size={10}
										className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#34B27B] pointer-events-none"
									/>
								</div>
							)}
						</div>

						{/* Webcam toggle + device selector */}
						<div className="flex items-center gap-0">
							<button
								className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
									webcamEnabled
										? "bg-[#34B27B]/15 text-[#34B27B] border border-[#34B27B]/30 rounded-l-lg border-r-0"
										: "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 rounded-lg"
								}`}
								onClick={() => setWebcamEnabled(!webcamEnabled)}
							>
								{webcamEnabled ? <Video size={14} /> : <VideoOff size={14} />}
								{webcamEnabled ? "Cam ON" : "Cam OFF"}
							</button>
							{webcamEnabled && webcamDevices.length > 0 && (
								<div className="relative">
									<select
										value={selectedWebcamId}
										onChange={(e) => setSelectedWebcamId(e.target.value)}
										className="appearance-none bg-[#34B27B]/15 border border-[#34B27B]/30 border-l-0 rounded-r-lg text-[#34B27B] text-xs py-2 pl-2 pr-6 outline-none cursor-pointer max-w-[140px] truncate"
									>
										{webcamDevices.map((d) => (
											<option
												key={d.deviceId}
												value={d.deviceId}
												className="bg-[#18181b] text-white"
											>
												{d.label}
											</option>
										))}
									</select>
									<ChevronDown
										size={10}
										className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#34B27B] pointer-events-none"
									/>
								</div>
							)}
						</div>
					</div>

					{/* Record button */}
					<button
						onClick={handleRecord}
						disabled={!selectedSource}
						className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#34B27B] hover:bg-[#34B27B]/90 text-white text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
					>
						<Monitor size={16} />
						Record
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
