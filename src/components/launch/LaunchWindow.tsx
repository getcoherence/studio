import { Clock, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { FaFolderOpen } from "react-icons/fa6";
import { FiMinus, FiX } from "react-icons/fi";
import {
	MdMic,
	MdMicOff,
	MdMonitor,
	MdRestartAlt,
	MdVideocam,
	MdVideocamOff,
	MdVideoFile,
	MdVolumeOff,
	MdVolumeUp,
} from "react-icons/md";
import { RxDragHandleDots2 } from "react-icons/rx";
import { ProjectBrowser } from "@/components/project-browser/ProjectBrowser";
import { useScopedT } from "@/contexts/I18nContext";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { requestCameraAccess } from "../../lib/requestCameraAccess";
import { formatTimePadded } from "../../utils/timeUtils";
import { Tooltip } from "../ui/tooltip";
import styles from "./LaunchWindow.module.css";

const ICON_SIZE = 20;

const ICON_CONFIG = {
	drag: { icon: RxDragHandleDots2, size: ICON_SIZE },
	monitor: { icon: MdMonitor, size: ICON_SIZE },
	volumeOn: { icon: MdVolumeUp, size: ICON_SIZE },
	volumeOff: { icon: MdVolumeOff, size: ICON_SIZE },
	micOn: { icon: MdMic, size: ICON_SIZE },
	micOff: { icon: MdMicOff, size: ICON_SIZE },
	webcamOn: { icon: MdVideocam, size: ICON_SIZE },
	webcamOff: { icon: MdVideocamOff, size: ICON_SIZE },
	stop: { icon: FaRegStopCircle, size: ICON_SIZE },
	restart: { icon: MdRestartAlt, size: ICON_SIZE },
	record: { icon: BsRecordCircle, size: ICON_SIZE },
	videoFile: { icon: MdVideoFile, size: ICON_SIZE },
	folder: { icon: FaFolderOpen, size: ICON_SIZE },
	minimize: { icon: FiMinus, size: ICON_SIZE },
	close: { icon: FiX, size: ICON_SIZE },
} as const;

type IconName = keyof typeof ICON_CONFIG;

function getIcon(name: IconName, className?: string) {
	const { icon: Icon, size } = ICON_CONFIG[name];
	return <Icon size={size} className={className} />;
}

const hudGroupClasses =
	"flex items-center gap-0.5 bg-white/5 rounded-full transition-colors duration-150 hover:bg-white/[0.08]";

const hudIconBtnClasses =
	"flex items-center justify-center p-2 rounded-full transition-all duration-150 cursor-pointer text-white hover:bg-white/10 hover:scale-[1.08] active:scale-95";

const windowBtnClasses =
	"flex items-center justify-center p-2 rounded-full transition-all duration-150 cursor-pointer opacity-50 hover:opacity-90 hover:bg-white/[0.08]";

export function LaunchWindow() {
	const t = useScopedT("launch");

	const {
		recording,
		toggleRecording,
		restartRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		systemAudioEnabled,
		setSystemAudioEnabled,
		webcamEnabled,
		setWebcamEnabled,
	} = useScreenRecorder();
	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (recording) {
			if (!recordingStart) setRecordingStart(Date.now());
			timer = setInterval(() => {
				if (recordingStart) {
					setElapsed(Math.floor((Date.now() - recordingStart) / 1000));
				}
			}, 1000);
		} else {
			setRecordingStart(null);
			setElapsed(0);
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [recording, recordingStart]);

	useEffect(() => {
		if (!import.meta.env.DEV) {
			return;
		}

		void requestCameraAccess().catch((error) => {
			console.warn("Failed to trigger camera access request during development:", error);
		});
	}, []);

	const [countdownActive, setCountdownActive] = useState(false);
	const [showProjectBrowser, setShowProjectBrowser] = useState(false);
	const [selectedSource, setSelectedSource] = useState("Screen");
	const [hasSelectedSource, setHasSelectedSource] = useState(false);

	useEffect(() => {
		const checkSelectedSource = async () => {
			if (window.electronAPI) {
				const source = await window.electronAPI.getSelectedSource();
				if (source) {
					setSelectedSource(source.name);
					setHasSelectedSource(true);
				} else {
					setSelectedSource("Screen");
					setHasSelectedSource(false);
				}
			}
		};

		checkSelectedSource();

		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, []);

	// Open project browser from File menu
	useEffect(() => {
		if (!window.electronAPI?.onMenuRecentProjects) return;
		const cleanup = window.electronAPI.onMenuRecentProjects(() => {
			setShowProjectBrowser(true);
		});
		return cleanup;
	}, []);

	// When countdown finishes, start recording
	useEffect(() => {
		if (!window.electronAPI?.onCountdownFinished) return;
		const cleanup = window.electronAPI.onCountdownFinished(() => {
			setCountdownActive(false);
			toggleRecording();
		});
		return cleanup;
	}, [toggleRecording]);

	const startWithCountdown = async () => {
		if (!hasSelectedSource || recording || countdownActive) return;
		setCountdownActive(true);
		await window.electronAPI.showCountdown?.();
	};

	const openSourceSelector = () => {
		if (window.electronAPI) {
			window.electronAPI.openSourceSelector();
		}
	};

	const openVideoFile = async () => {
		const result = await window.electronAPI.openVideoFilePicker();

		if (result.canceled) {
			return;
		}

		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	};

	const openProjectFile = async () => {
		const result = await window.electronAPI.loadProjectFile();
		if (result.canceled || !result.success) return;
		await window.electronAPI.switchToEditor();
	};

	const sendHudOverlayHide = () => {
		if (window.electronAPI && window.electronAPI.hudOverlayHide) {
			window.electronAPI.hudOverlayHide();
		}
	};
	const sendHudOverlayClose = () => {
		if (window.electronAPI && window.electronAPI.hudOverlayClose) {
			window.electronAPI.hudOverlayClose();
		}
	};

	const toggleMicrophone = () => {
		if (!recording) {
			setMicrophoneEnabled(!microphoneEnabled);
		}
	};

	const handleProjectOpened = async () => {
		await window.electronAPI.switchToEditor?.();
	};

	return (
		<>
			<div className="w-full h-full flex items-end justify-center bg-transparent relative">
				<div className={`flex flex-col items-center gap-2 mx-auto ${styles.electronDrag}`}>
					{/* Main pill bar */}
					<div className="flex items-center gap-1 px-2 py-1.5 isolate rounded-full shadow-hud-bar bg-gradient-to-br from-[rgba(28,28,36,0.97)] to-[rgba(18,18,26,0.96)] backdrop-blur-[16px] backdrop-saturate-[140%] border border-[rgba(80,80,120,0.25)] max-w-[490px]">
						{/* Drag handle */}
						<div className={`flex items-center px-1 ${styles.electronDrag}`}>
							{getIcon("drag", "text-white/30")}
						</div>

						{/* Source indicator (click to change) */}
						{hasSelectedSource && (
							<button
								className={`${hudGroupClasses} p-2 ${styles.electronNoDrag}`}
								onClick={openSourceSelector}
								disabled={recording}
								title={`Recording: ${selectedSource} (click to change)`}
							>
								{getIcon("monitor", "text-white/80")}
								<span className="text-white/70 text-[11px] max-w-[72px] truncate">
									{selectedSource}
								</span>
							</button>
						)}

						{/* Audio controls group */}
						<div className={`${hudGroupClasses} ${styles.electronNoDrag}`}>
							<button
								className={`${hudIconBtnClasses} ${systemAudioEnabled ? "drop-shadow-[0_0_4px_rgba(74,222,128,0.4)]" : ""}`}
								onClick={() => !recording && setSystemAudioEnabled(!systemAudioEnabled)}
								disabled={recording}
								title={
									systemAudioEnabled ? t("audio.disableSystemAudio") : t("audio.enableSystemAudio")
								}
							>
								{systemAudioEnabled
									? getIcon("volumeOn", "text-green-400")
									: getIcon("volumeOff", "text-white/40")}
							</button>
							<button
								className={`${hudIconBtnClasses} ${microphoneEnabled ? "drop-shadow-[0_0_4px_rgba(74,222,128,0.4)]" : ""}`}
								onClick={toggleMicrophone}
								disabled={recording}
								title={
									microphoneEnabled ? t("audio.disableMicrophone") : t("audio.enableMicrophone")
								}
							>
								{microphoneEnabled
									? getIcon("micOn", "text-green-400")
									: getIcon("micOff", "text-white/40")}
							</button>
							<button
								className={`${hudIconBtnClasses} ${webcamEnabled ? "drop-shadow-[0_0_4px_rgba(74,222,128,0.4)]" : ""}`}
								onClick={async () => {
									await setWebcamEnabled(!webcamEnabled);
								}}
								title={webcamEnabled ? t("webcam.disableWebcam") : t("webcam.enableWebcam")}
							>
								{webcamEnabled
									? getIcon("webcamOn", "text-green-400")
									: getIcon("webcamOff", "text-white/40")}
							</button>
						</div>

						{/* Record/Stop button */}
						<Tooltip
							content={
								recording
									? t("tooltips.stopRecording")
									: hasSelectedSource
										? t("tooltips.startRecording")
										: t("tooltips.selectSource")
							}
						>
							<button
								className={`flex items-center gap-1 rounded-full px-2.5 py-2 transition-colors duration-150 ${styles.electronNoDrag} ${
									recording
										? "bg-red-500/10"
										: hasSelectedSource
											? "bg-[#34B27B]/15 hover:bg-[#34B27B]/25"
											: "bg-white/5 hover:bg-white/[0.08]"
								}`}
								onClick={
									recording
										? toggleRecording
										: hasSelectedSource
											? startWithCountdown
											: openSourceSelector
								}
								disabled={countdownActive}
								style={{ flex: "0 0 auto" }}
							>
								{recording ? (
									<>
										<Square size={12} className="text-red-400" fill="currentColor" />
										<span className="text-red-400 text-[11px] font-semibold tabular-nums">
											{formatTimePadded(elapsed)}
										</span>
									</>
								) : (
									<>
										<Play
											size={14}
											className={hasSelectedSource ? "text-[#34B27B]" : "text-white/30"}
											fill="currentColor"
										/>
										{!hasSelectedSource && (
											<span className="text-white/40 text-[11px]">Record</span>
										)}
									</>
								)}
							</button>
						</Tooltip>

						{/* Restart recording */}
						{recording && (
							<Tooltip content={t("tooltips.restartRecording")}>
								<button
									className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
									onClick={restartRecording}
								>
									{getIcon("restart", "text-white/60")}
								</button>
							</Tooltip>
						)}

						{/* Open video file */}
						<Tooltip content={t("tooltips.openVideoFile")}>
							<button
								className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
								onClick={openVideoFile}
								disabled={recording}
							>
								{getIcon("videoFile", "text-white/60")}
							</button>
						</Tooltip>

						{/* Open project */}
						<Tooltip content={t("tooltips.openProject")}>
							<button
								className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
								onClick={openProjectFile}
								disabled={recording}
							>
								{getIcon("folder", "text-white/60")}
							</button>
						</Tooltip>

						{/* Recent projects */}
						<Tooltip content="Recent Projects">
							<button
								className={`${hudIconBtnClasses} ${styles.electronNoDrag}`}
								onClick={() => setShowProjectBrowser(true)}
								disabled={recording}
							>
								<Clock size={ICON_SIZE} className="text-white/60" />
							</button>
						</Tooltip>

						{/* Window controls */}
						<div className={`flex items-center gap-0.5 ${styles.electronNoDrag}`}>
							<button
								className={windowBtnClasses}
								title={t("tooltips.hideHUD")}
								onClick={sendHudOverlayHide}
							>
								{getIcon("minimize", "text-white")}
							</button>
							<button
								className={windowBtnClasses}
								title={t("tooltips.closeApp")}
								onClick={sendHudOverlayClose}
							>
								{getIcon("close", "text-white")}
							</button>
						</div>
					</div>
				</div>
			</div>
			<ProjectBrowser
				open={showProjectBrowser}
				onOpenChange={setShowProjectBrowser}
				onProjectOpened={handleProjectOpened}
			/>
		</>
	);
}
