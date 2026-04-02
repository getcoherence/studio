/**
 * DemoStudioPage — full-page split-pane AI Demo Studio.
 * Left panel: chat with agent progress. Right panel: embedded browser.
 */

import { ArrowLeft, Bot } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import type { Scene, SceneLayer, SceneProject } from "@/lib/scene-renderer";
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

	const scenes: Scene[] = stepsWithScreenshots.map((step, i) => {
		const layers: SceneLayer[] = [];

		// Screenshot as image layer
		if (step.screenshotDataUrl) {
			layers.push({
				id: uid(),
				type: "image",
				startMs: 0,
				endMs: 4000,
				position: { x: 5, y: 5 },
				size: { width: 90, height: 70 },
				zIndex: 1,
				entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 0 },
				exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
				content: {
					src: step.screenshotDataUrl,
					fit: "contain",
					borderRadius: 8,
					shadow: true,
				},
			});
		}

		// Narration as text overlay
		if (step.action.narration) {
			layers.push({
				id: uid(),
				type: "text",
				startMs: 0,
				endMs: 4000,
				position: { x: 5, y: 80 },
				size: { width: 90, height: 15 },
				zIndex: 2,
				entrance: { type: "fade", durationMs: 400, easing: "ease-out", delay: 300 },
				exit: { type: "none", durationMs: 0, easing: "ease-out", delay: 0 },
				content: {
					text: step.action.narration,
					fontSize: 22,
					fontFamily: "Inter, system-ui, sans-serif",
					fontWeight: "500",
					color: "#ffffffcc",
					textAlign: "center" as const,
					lineHeight: 1.4,
				},
			});
		}

		return {
			id: uid(),
			durationMs: 4000,
			background: "#09090b",
			animatedBgSpeed: 1,
			transition:
				i === 0
					? { type: "none" as const, durationMs: 0 }
					: { type: "fade" as const, durationMs: 500 },
			layers,
		};
	});

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
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#0c0c0f]">
				<div className="flex items-center gap-3">
					<button
						onClick={() => {
							if (agent.steps.length > 0 && agent.status !== "idle") {
								if (!confirm("You have a demo in progress. Leave without saving?")) return;
								agent.stop();
							} else if (agent.steps.length > 0) {
								if (!confirm("Your demo hasn't been opened in the editor. Leave anyway?")) return;
							}
							onBack();
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
