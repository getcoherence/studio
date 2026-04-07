/**
 * DemoStudioPage — full-page split-pane AI Demo Studio.
 * Left panel: chat with agent progress. Right panel: embedded browser.
 */

import { AlertTriangle, ArrowLeft, Bot, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { generateAiComposition } from "@/lib/ai/aiCinematicEngine";
import { composeCinematicProject } from "@/lib/ai/cinematicCompositionEngine";
import { composeProject } from "@/lib/ai/compositionEngine";
import type { SceneProject } from "@/lib/scene-renderer";
import { DemoBottomBar } from "./DemoBottomBar";
import { DemoBrowserPanel } from "./DemoBrowserPanel";
import { DemoChatPanel } from "./DemoChatPanel";
import { addToPromptHistory } from "./promptHistory";
import type { DemoChatMessage, DemoConfig, OutputStyle } from "./types";
import { useDemoAgent } from "./useDemoAgent";

// ── Helpers ───────────────────────────────────────────────────────────

// ── Page component ────────────────────────────────────────────────────

interface DemoStudioPageProps {
	onBack: () => void;
	onOpenInEditor: (project: SceneProject) => void;
}

export function DemoStudioPage({ onBack, onOpenInEditor }: DemoStudioPageProps) {
	const [messages, setMessages] = useState<DemoChatMessage[]>([]);
	const [maxSteps, setMaxSteps] = useState(12);
	const [outputStyle, setOutputStyle] = useState<OutputStyle>("cinematic");
	const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
	const lastConfigRef = useRef<DemoConfig | null>(null);
	const webviewRef = useRef<Electron.WebviewTag>(null);

	const handleMessage = useCallback((msg: DemoChatMessage) => {
		setMessages((prev) => {
			// Replace the last "thinking" message instead of stacking them
			if (msg.type !== "thinking") {
				return [...prev.filter((m) => m.type !== "thinking"), msg];
			}
			// Keep only the latest thinking message
			return [...prev.filter((m) => m.type !== "thinking"), msg];
		});
	}, []);

	const agent = useDemoAgent(webviewRef, handleMessage);

	// Mark window as having unsaved changes when demo has captured steps
	useEffect(() => {
		const hasData = agent.steps.length > 0;
		window.electronAPI?.setHasUnsavedChanges?.(hasData);
		return () => {
			window.electronAPI?.setHasUnsavedChanges?.(false);
		};
	}, [agent.steps.length]);

	const handleStart = useCallback(
		(config: DemoConfig) => {
			setMaxSteps(config.maxSteps);
			setOutputStyle(config.outputStyle);
			lastConfigRef.current = config;
			aiGenerationStartedRef.current = false; // Reset for new demo
			setMessages([]);
			addToPromptHistory({ url: config.url, prompt: config.prompt });

			// Add user message showing what they typed
			setMessages([
				{
					id: `user-${Date.now()}`,
					type: "user-prompt",
					content: `${config.url} — ${config.prompt}`,
					timestamp: Date.now(),
				},
			]);

			agent.start(config);
		},
		[agent],
	);

	const [isGeneratingAi, setIsGeneratingAi] = useState(false);
	const aiGenerationStartedRef = useRef(false);

	// ── Auto-generate AI cinematic when demo completes ──
	const generateAndOpenAiCinematic = useCallback(async () => {
		if (agent.steps.length === 0 || isGeneratingAi) return;
		const title = agent.storyboardTitle;
		const brand = {
			primaryColor: agent.brandInfo?.primaryColor || "#2563eb",
			accentColor: agent.brandInfo?.accentColor ?? undefined,
			fontFamily: agent.brandInfo?.fontFamily ?? undefined,
			productName: agent.brandInfo?.productName ?? undefined,
			logoUrl: agent.brandInfo?.logoUrl ?? undefined,
		};

		setIsGeneratingAi(true);

		const result = await generateAiComposition(agent.steps, {
			title,
			brand,
			videoType: lastConfigRef.current?.mode,
			userBrief: lastConfigRef.current?.prompt,
			websiteUrl: lastConfigRef.current?.url,
			onStatus: (msg) => {
				handleMessage({
					id: `ai-status-${Date.now()}`,
					type: "thinking",
					content: msg,
					timestamp: Date.now(),
				});
			},
		});

		setIsGeneratingAi(false);

		if (result.error) {
			toast.error(`AI generation failed: ${result.error}`);
			handleMessage({
				id: `ai-err-${Date.now()}`,
				type: "error",
				content: `AI composition failed: ${result.error}. Try "Cinematic" mode as fallback.`,
				timestamp: Date.now(),
			});
			return;
		}

		const fallbackProject = composeCinematicProject(agent.steps, { title, brand });
		fallbackProject.styleId = "ai-cinematic";
		// biome-ignore lint/suspicious/noExplicitAny: AI cinematic extends SceneProject with runtime fields
		const proj = fallbackProject as Record<string, any>;
		proj._aiCode = result.code;
		proj._aiScreenshots = result.screenshots;
		proj._aiPlan = result.plan ?? null;
		proj._aiSteps = agent.steps.map((s) => ({
			action: s.action,
			headline: s.headline,
			screenshotDataUrl: s.screenshotDataUrl,
			uiElements: s.uiElements,
			timestamp: s.timestamp,
		}));
		proj._aiBrand = brand;
		onOpenInEditor(fallbackProject);
	}, [
		agent.steps,
		agent.storyboardTitle,
		agent.brandInfo,
		isGeneratingAi,
		handleMessage,
		onOpenInEditor,
	]);

	// Auto-trigger when demo completes in AI Cinematic mode
	useEffect(() => {
		if (
			outputStyle === "ai-cinematic" &&
			agent.status === "complete" &&
			agent.steps.length > 0 &&
			!aiGenerationStartedRef.current
		) {
			aiGenerationStartedRef.current = true;
			generateAndOpenAiCinematic();
		}
	}, [agent.status, outputStyle, agent.steps.length, generateAndOpenAiCinematic]);

	const handleOpenInEditor = useCallback(async () => {
		if (agent.steps.length === 0) return;
		const title = agent.storyboardTitle;
		const brand = {
			primaryColor: agent.brandInfo?.primaryColor || "#2563eb",
			accentColor: agent.brandInfo?.accentColor ?? undefined,
			fontFamily: agent.brandInfo?.fontFamily ?? undefined,
			productName: agent.brandInfo?.productName ?? undefined,
			logoUrl: agent.brandInfo?.logoUrl ?? undefined,
		};

		if (outputStyle === "ai-cinematic") {
			// Already auto-generating or done — trigger manually if needed
			if (!isGeneratingAi) {
				aiGenerationStartedRef.current = true;
				generateAndOpenAiCinematic();
			}
			return;
		}

		const project =
			outputStyle === "cinematic"
				? composeCinematicProject(agent.steps, { title, brand })
				: composeProject(agent.steps, { title });
		onOpenInEditor(project);
	}, [
		agent.steps,
		agent.storyboardTitle,
		agent.brandInfo,
		outputStyle,
		onOpenInEditor,
		handleMessage,
	]);

	// ── Voiceover generation ──

	const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);

	const handleGenerateVoiceover = useCallback(async () => {
		const narrationSteps = agent.steps.filter(
			(s) => s.action.narration && s.action.narration.length > 5,
		);
		if (narrationSteps.length === 0) return;

		setIsGeneratingVoiceover(true);
		let successCount = 0;

		for (const step of narrationSteps) {
			if (step.audioPath) {
				successCount++;
				continue; // Already generated
			}
			try {
				const result = await window.electronAPI?.aiTtsSynthesize(step.action.narration, "nova");
				if (result?.success && result.audioPath) {
					step.audioPath = result.audioPath;
					successCount++;

					// Update the corresponding chat message with the audio path
					setMessages((prev) =>
						prev.map((m) =>
							m.type === "narration" && m.content === step.action.narration
								? { ...m, audioPath: result.audioPath }
								: m,
						),
					);
				}
			} catch (err) {
				console.warn("TTS failed for step:", err);
			}
		}

		setIsGeneratingVoiceover(false);
		if (successCount > 0) {
			toast.success(
				`Generated voiceover for ${successCount} narration${successCount > 1 ? "s" : ""}`,
			);
		} else {
			toast.error("Voiceover generation failed — check your OpenAI API key");
		}
	}, [agent.steps]);

	return (
		<div className="flex flex-col h-screen bg-[#09090b]">
			{/* Leave confirmation dialog */}
			{showLeaveConfirm && (
				<div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center">
					<div className="w-full max-w-sm mx-4 bg-[#141417] border border-white/10 rounded-xl p-5 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-amber-400">
								<AlertTriangle size={18} />
								<span className="text-sm font-semibold text-white">Leave Demo Studio?</span>
							</div>
							<button
								onClick={() => setShowLeaveConfirm(false)}
								className="text-white/40 hover:text-white/60 transition-colors"
							>
								<X size={16} />
							</button>
						</div>
						<p className="text-sm text-white/50">
							{agent.status === "running" || agent.status === "paused"
								? "A demo is still in progress. Leaving will stop it and discard all captured steps."
								: "Your demo hasn't been opened in the editor yet. Leaving will discard all captured steps."}
						</p>
						<div className="flex justify-end gap-2">
							<button
								onClick={() => setShowLeaveConfirm(false)}
								className="px-4 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									agent.stop();
									setShowLeaveConfirm(false);
									onBack();
								}}
								className="px-4 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium transition-colors"
							>
								Leave
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#0c0c0f]">
				<div className="flex items-center gap-3">
					<button
						onClick={() => {
							// Check if there's any demo data worth keeping
							const hasData =
								messages.length > 1 ||
								agent.status === "running" ||
								agent.status === "paused" ||
								agent.status === "complete";
							if (hasData) {
								setShowLeaveConfirm(true);
							} else {
								onBack();
							}
						}}
						className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
					>
						<ArrowLeft size={14} />
						Back
					</button>
					<div className="w-px h-4 bg-white/10" />
					<div className="flex items-center gap-2">
						<Bot size={16} className="text-[#2563eb]" />
						<span className="text-sm font-medium text-white">AI Video Studio</span>
					</div>
				</div>
			</div>

			{/* Split panes */}
			<div className="flex-1 min-h-0">
				<PanelGroup direction="horizontal">
					<Panel defaultSize={38} minSize={18} maxSize={55}>
						<DemoChatPanel
							messages={messages}
							status={agent.status}
							onStart={handleStart}
							onOpenInEditor={outputStyle === "ai-cinematic" ? undefined : handleOpenInEditor}
							onGenerateVoiceover={handleGenerateVoiceover}
							isGeneratingVoiceover={isGeneratingVoiceover || isGeneratingAi}
						/>
					</Panel>
					<PanelResizeHandle className="w-1 bg-white/5 hover:bg-[#2563eb]/40 transition-colors" />
					<Panel defaultSize={62} minSize={35}>
						<DemoBrowserPanel webviewRef={webviewRef} isRunning={agent.status !== "idle"} />
					</Panel>
				</PanelGroup>
			</div>

			{/* Bottom bar */}
			<DemoBottomBar
				status={agent.status}
				stepIndex={agent.currentStepIndex}
				maxSteps={maxSteps}
				elapsedMs={agent.elapsedMs}
				onStop={agent.stop}
				onResume={agent.resume}
			/>
		</div>
	);
}
