/**
 * DemoStudioPage — full-page split-pane AI Demo Studio.
 * Left panel: chat with agent progress. Right panel: embedded browser.
 */

import { AlertTriangle, ArrowLeft, Bot, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import type { Scene, SceneProject } from "@/lib/scene-renderer";
import {
	heroReveal,
	simpleScreenshot,
	titleCard,
	typingSequence,
} from "@/lib/ai/compositionTemplates";
import { DemoBottomBar } from "./DemoBottomBar";
import { DemoBrowserPanel } from "./DemoBrowserPanel";
import { DemoChatPanel } from "./DemoChatPanel";
import { addToPromptHistory } from "./promptHistory";
import type { DemoChatMessage, DemoConfig, DemoStep } from "./types";
import { useDemoAgent } from "./useDemoAgent";

// ── Helpers ───────────────────────────────────────────────────────────

let _uid = 1;
function uid(): string {
	return `demo-${Date.now()}-${_uid++}`;
}

function buildSceneProject(steps: DemoStep[]): SceneProject {
	const stepsWithScreenshots = steps.filter((s) => s.screenshotDataUrl);
	const scenes: Scene[] = [];

	// Opening title card from the first narration
	const firstNarration = stepsWithScreenshots.find((s) => s.action.narration)?.action.narration;
	if (firstNarration) {
		scenes.push(titleCard({ title: firstNarration, background: "animated-midnight" }));
	}

	// Build scenes from steps using composition templates
	for (let i = 0; i < stepsWithScreenshots.length; i++) {
		const step = stepsWithScreenshots[i];
		if (!step.screenshotDataUrl) continue;

		const narration = step.action.narration || "";
		const isZoom = step.isZoomShot === true;

		if (isZoom) {
			// Zoom shots: isolated element with zoom-in entrance
			scenes.push(
				simpleScreenshot({
					screenshotSrc: step.screenshotDataUrl,
					narration,
					durationMs: 3500,
				}),
			);
		} else if (i === 0) {
			// First screenshot: hero reveal with ken-burns
			scenes.push(
				heroReveal({
					screenshotSrc: step.screenshotDataUrl,
					narration,
					focusPoint: { x: 0.5, y: 0.3 },
					durationMs: 3000,
				}),
			);
		} else if (i === stepsWithScreenshots.length - 1) {
			// Last screenshot: typing bridge + hero reveal finale
			scenes.push(typingSequence({ text: narration, durationMs: 2000 }));
			scenes.push(
				heroReveal({
					screenshotSrc: step.screenshotDataUrl,
					narration: "",
					focusPoint: { x: 0.5, y: 0.5 },
					durationMs: 2500,
				}),
			);
		} else {
			// Middle screenshots: alternate between hero-reveal and simple
			if (i % 3 === 0) {
				// Every 3rd scene: insert a typing bridge for rhythm
				scenes.push(typingSequence({ text: narration, durationMs: 2000 }));
				scenes.push(
					heroReveal({
						screenshotSrc: step.screenshotDataUrl,
						narration: "",
						focusPoint: { x: 0.3 + Math.random() * 0.4, y: 0.2 + Math.random() * 0.4 },
						durationMs: 2500,
					}),
				);
			} else {
				scenes.push(
					heroReveal({
						screenshotSrc: step.screenshotDataUrl,
						narration,
						focusPoint: { x: 0.3 + Math.random() * 0.4, y: 0.2 + Math.random() * 0.4 },
						durationMs: 2500,
					}),
				);
			}
		}
	}

	return {
		id: uid(),
		name: "AI Demo Recording",
		scenes,
		resolution: { width: 1920, height: 1080 },
		fps: 30,
	};
}

// ── Page component ────────────────────────────────────────────────────

interface DemoStudioPageProps {
	onBack: () => void;
	onOpenInEditor: (project: SceneProject) => void;
}

export function DemoStudioPage({ onBack, onOpenInEditor }: DemoStudioPageProps) {
	const [messages, setMessages] = useState<DemoChatMessage[]>([]);
	const [maxSteps, setMaxSteps] = useState(12);
	const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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

	const handleOpenInEditor = useCallback(() => {
		if (agent.steps.length === 0) return;
		const project = buildSceneProject(agent.steps);
		onOpenInEditor(project);
	}, [agent.steps, onOpenInEditor]);

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
						<span className="text-sm font-medium text-white">AI Demo Studio</span>
					</div>
				</div>
			</div>

			{/* Split panes */}
			<div className="flex-1 min-h-0">
				<PanelGroup direction="horizontal">
					<Panel defaultSize={38} minSize={25} maxSize={55}>
						<DemoChatPanel
							messages={messages}
							status={agent.status}
							onStart={handleStart}
							onOpenInEditor={handleOpenInEditor}
							onGenerateVoiceover={handleGenerateVoiceover}
							isGeneratingVoiceover={isGeneratingVoiceover}
						/>
					</Panel>
					<PanelResizeHandle className="w-1 bg-white/5 hover:bg-[#2563eb]/40 transition-colors" />
					<Panel defaultSize={62} minSize={40}>
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
