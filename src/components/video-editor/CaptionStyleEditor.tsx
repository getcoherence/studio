import { AlertTriangle, Captions, Download, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { CaptionAnimation, CaptionPosition, CaptionStyle, CaptionTrack } from "@/lib/ai/types";
import { WHISPER_MODELS } from "@/lib/ai/types";

const FONT_FAMILIES = [
	"Inter",
	"Arial",
	"Helvetica",
	"Georgia",
	"Verdana",
	"Courier New",
	"Times New Roman",
	"Comic Sans MS",
];

const POSITION_OPTIONS: Array<{ value: CaptionPosition; label: string }> = [
	{ value: "top", label: "Top" },
	{ value: "center", label: "Center" },
	{ value: "bottom", label: "Bottom" },
];

const ANIMATION_OPTIONS: Array<{ value: CaptionAnimation; label: string }> = [
	{ value: "none", label: "None" },
	{ value: "word-highlight", label: "Word Highlight" },
	{ value: "fade-in", label: "Fade In" },
];

interface CaptionStyleEditorProps {
	captionTrack: CaptionTrack | null;
	captionStyle: CaptionStyle;
	onStyleChange: (style: Partial<CaptionStyle>) => void;
	onCaptionTrackChange: (track: CaptionTrack | null) => void;
	videoPath: string | null;
}

export function CaptionStyleEditor({
	captionTrack,
	captionStyle,
	onStyleChange,
	onCaptionTrackChange,
	videoPath,
}: CaptionStyleEditorProps) {
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
	const [modelStatuses, setModelStatuses] = useState<
		Record<string, { downloaded: boolean; downloading?: boolean; percent?: number }>
	>({});

	// Check whisper availability on mount
	useEffect(() => {
		let mounted = true;
		window.electronAPI.whisperAvailable().then((available) => {
			if (mounted) setWhisperAvailable(available);
		});
		return () => {
			mounted = false;
		};
	}, []);

	// Check model statuses on mount
	useEffect(() => {
		let mounted = true;
		const checkStatuses = async () => {
			const statuses: Record<string, { downloaded: boolean }> = {};
			for (const model of WHISPER_MODELS) {
				const status = await window.electronAPI.whisperModelStatus(model.id);
				if (!mounted) return;
				statuses[model.id] = { downloaded: status.downloaded };
			}
			setModelStatuses(statuses);
		};
		checkStatuses();
		return () => {
			mounted = false;
		};
	}, []);

	// Listen for download progress
	useEffect(() => {
		const cleanup = window.electronAPI.onWhisperModelDownloadProgress((progress) => {
			setModelStatuses((prev) => ({
				...prev,
				[progress.modelId]: {
					downloaded: false,
					downloading: true,
					percent: progress.percent,
				},
			}));
		});
		return cleanup;
	}, []);

	const handleDownloadModel = useCallback(async (modelId: string) => {
		setModelStatuses((prev) => ({
			...prev,
			[modelId]: { downloaded: false, downloading: true, percent: 0 },
		}));

		const result = await window.electronAPI.whisperModelDownload(modelId);
		if (result.success) {
			setModelStatuses((prev) => ({
				...prev,
				[modelId]: { downloaded: true },
			}));
			toast.success(`Model "${modelId}" downloaded successfully`);
		} else {
			setModelStatuses((prev) => ({
				...prev,
				[modelId]: { downloaded: false },
			}));
			toast.error(`Failed to download model: ${result.error}`);
		}
	}, []);

	const handleDeleteModel = useCallback(async (modelId: string) => {
		const result = await window.electronAPI.whisperModelDelete(modelId);
		if (result.success) {
			setModelStatuses((prev) => ({
				...prev,
				[modelId]: { downloaded: false },
			}));
			toast.success(`Model "${modelId}" removed`);
		} else {
			toast.error(`Failed to delete model: ${result.error}`);
		}
	}, []);

	const handleTranscribe = useCallback(
		async (modelId: string) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			setIsTranscribing(true);
			try {
				const result = await window.electronAPI.whisperTranscribe(videoPath, { modelId });
				if (result.success && result.captionTrack) {
					onCaptionTrackChange(result.captionTrack);
					toast.success(
						`Transcription complete: ${result.captionTrack.lines.length} lines detected`,
					);
				} else {
					toast.error(result.error || "Transcription failed");
				}
			} catch (err) {
				toast.error(`Transcription error: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				setIsTranscribing(false);
			}
		},
		[videoPath, onCaptionTrackChange],
	);

	const handleRemoveCaptions = useCallback(() => {
		onCaptionTrackChange(null);
		toast.success("Captions removed");
	}, [onCaptionTrackChange]);

	return (
		<div className="space-y-4">
			{/* Whisper status / transcribe controls */}
			{whisperAvailable === false && (
				<div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
					<AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
					<span className="text-xs text-amber-300">
						Whisper not installed. Place the binary at native/bin/
					</span>
				</div>
			)}

			{/* Model management */}
			<div className="space-y-2">
				<span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Models</span>
				{WHISPER_MODELS.map((model) => {
					const status = modelStatuses[model.id];
					const isDownloaded = status?.downloaded ?? false;
					const isDownloading = status?.downloading ?? false;
					const downloadPercent = status?.percent ?? 0;

					return (
						<div
							key={model.id}
							className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5"
						>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="text-xs font-medium text-slate-200">{model.name}</span>
									<span className="text-[10px] text-slate-500">{model.sizeLabel}</span>
								</div>
								{isDownloading && (
									<div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
										<div
											className="h-full bg-[#34B27B] rounded-full transition-all duration-300"
											style={{ width: `${downloadPercent}%` }}
										/>
									</div>
								)}
							</div>
							<div className="flex items-center gap-1">
								{isDownloaded ? (
									<>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 text-[#34B27B] hover:text-white hover:bg-[#34B27B]/20"
											onClick={() => handleTranscribe(model.id)}
											disabled={isTranscribing || !videoPath || whisperAvailable === false}
											title="Auto-caption with this model"
										>
											{isTranscribing ? (
												<Loader2 className="w-3.5 h-3.5 animate-spin" />
											) : (
												<Captions className="w-3.5 h-3.5" />
											)}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
											onClick={() => handleDeleteModel(model.id)}
											title="Delete model"
										>
											<Trash2 className="w-3 h-3" />
										</Button>
									</>
								) : (
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 text-slate-400 hover:text-[#34B27B] hover:bg-[#34B27B]/10"
										onClick={() => handleDownloadModel(model.id)}
										disabled={isDownloading}
										title={`Download ${model.name} (${model.sizeLabel})`}
									>
										{isDownloading ? (
											<Loader2 className="w-3.5 h-3.5 animate-spin" />
										) : (
											<Download className="w-3.5 h-3.5" />
										)}
									</Button>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Caption info / remove */}
			{captionTrack && (
				<div className="flex items-center justify-between p-2 rounded-lg bg-[#34B27B]/10 border border-[#34B27B]/20">
					<div className="text-xs text-[#34B27B]">
						{captionTrack.lines.length} caption lines ({captionTrack.language.toUpperCase()})
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
						onClick={handleRemoveCaptions}
					>
						Remove
					</Button>
				</div>
			)}

			{/* Style controls (only shown when captions exist) */}
			{captionTrack && (
				<div className="space-y-3 pt-1">
					{/* Font family */}
					<div className="space-y-1">
						<span className="text-[11px] text-slate-400">Font</span>
						<Select
							value={captionStyle.fontFamily}
							onValueChange={(v) => onStyleChange({ fontFamily: v })}
						>
							<SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-[#1a1a1a] border-white/10">
								{FONT_FAMILIES.map((font) => (
									<SelectItem
										key={font}
										value={font}
										className="text-xs text-slate-300 hover:text-white"
									>
										<span style={{ fontFamily: font }}>{font}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Font size */}
					<div className="space-y-1">
						<div className="flex justify-between items-center">
							<span className="text-[11px] text-slate-400">Size</span>
							<span className="text-[10px] text-slate-500 tabular-nums">
								{captionStyle.fontSize}px
							</span>
						</div>
						<Slider
							value={[captionStyle.fontSize]}
							onValueChange={([v]) => onStyleChange({ fontSize: v })}
							min={16}
							max={96}
							step={2}
							className="w-full"
						/>
					</div>

					{/* Background opacity */}
					<div className="space-y-1">
						<div className="flex justify-between items-center">
							<span className="text-[11px] text-slate-400">Background</span>
							<span className="text-[10px] text-slate-500 tabular-nums">
								{Math.round(captionStyle.backgroundOpacity * 100)}%
							</span>
						</div>
						<Slider
							value={[captionStyle.backgroundOpacity]}
							onValueChange={([v]) => onStyleChange({ backgroundOpacity: v })}
							min={0}
							max={1}
							step={0.05}
							className="w-full"
						/>
					</div>

					{/* Position */}
					<div className="space-y-1">
						<span className="text-[11px] text-slate-400">Position</span>
						<Select
							value={captionStyle.position}
							onValueChange={(v) => onStyleChange({ position: v as CaptionPosition })}
						>
							<SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-[#1a1a1a] border-white/10">
								{POSITION_OPTIONS.map((opt) => (
									<SelectItem
										key={opt.value}
										value={opt.value}
										className="text-xs text-slate-300 hover:text-white"
									>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Animation */}
					<div className="space-y-1">
						<span className="text-[11px] text-slate-400">Animation</span>
						<Select
							value={captionStyle.animation}
							onValueChange={(v) => onStyleChange({ animation: v as CaptionAnimation })}
						>
							<SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-[#1a1a1a] border-white/10">
								{ANIMATION_OPTIONS.map((opt) => (
									<SelectItem
										key={opt.value}
										value={opt.value}
										className="text-xs text-slate-300 hover:text-white"
									>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			)}
		</div>
	);
}
