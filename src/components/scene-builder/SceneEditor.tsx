import {
	ArrowLeft,
	Clock,
	Download,
	Eye,
	ImagePlus,
	Loader2,
	Palette,
	Pause,
	Play,
	RotateCcw,
	Sparkles,
	Square,
	Trash2,
	Type,
	Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { AISettingsButton } from "@/components/ui/AISettingsDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { AnimatedBackgroundPicker } from "@/components/video-editor/AnimatedBackgroundPicker";
import { applyCritiqueMutations, critiqueSceneProject } from "@/lib/ai/designCritique";
import { DESIGN_STYLE_LIST, type DesignStyleId } from "@/lib/ai/designStyles";
import { generateSceneProject, SCENE_TEMPLATES } from "@/lib/ai/sceneGenerator";
import { aiPolishSceneProject, polishSceneProject } from "@/lib/ai/scenePolish";
import { consumePendingDemoProject } from "@/lib/demoProjectStore";
import { RemotionPreview } from "@/lib/remotion/RemotionPreview";
import {
	captureCanvas,
	DEFAULT_IMAGE_LAYER,
	DEFAULT_PROJECT,
	DEFAULT_SCENE,
	DEFAULT_SHAPE_LAYER,
	DEFAULT_TEXT_LAYER,
	type Scene,
	type SceneLayer,
	type SceneProject,
	type SceneTransition,
} from "@/lib/scene-renderer";
import { exportSceneProject, type SceneExportProgress } from "@/lib/scene-renderer/sceneExporter";
import { renderScene } from "@/lib/scene-renderer/sceneRenderer";
import { LayerPanel } from "./LayerPanel";
import { SceneCanvas } from "./SceneCanvas";
import { SceneTimeline } from "./SceneTimeline";

function getResolution(ratio: string): { width: number; height: number } {
	const [w, h] = ratio.split("/").map(Number);
	if (!w || !h) return { width: 1920, height: 1080 };
	if (w >= h) return { width: 1920, height: Math.round(1920 * (h / w)) };
	return { width: Math.round(1920 * (w / h)), height: 1920 };
}

function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

interface SceneEditorProps {
	onBack: () => void;
	initialProject?: SceneProject;
}

export function SceneEditor({ onBack, initialProject }: SceneEditorProps) {
	const [project, setProject] = useState<SceneProject>(() => {
		// Use prop first, then check shared store, then default
		if (initialProject) return initialProject;
		const demo = consumePendingDemoProject();
		if (demo) return demo;
		return DEFAULT_PROJECT();
	});
	const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<SceneExportProgress | null>(null);
	const [aspectRatio, setAspectRatio] = useState("16/9");
	const [previewMode, setPreviewMode] = useState<"canvas" | "remotion">("canvas");
	const [activeTransition, setActiveTransition] = useState<SceneTransition | null>(null);
	const [transitionFromCanvas, setTransitionFromCanvas] = useState<HTMLCanvasElement | null>(null);
	const [aiPrompt, setAiPrompt] = useState("");
	const [isAiGenerating, setIsAiGenerating] = useState(false);
	const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
	const [isPolishing, setIsPolishing] = useState(false);
	const [isCritiquing, setIsCritiquing] = useState(false);
	const [selectedStyle, setSelectedStyle] = useState<DesignStyleId | null>(null);
	const [projectPath, setProjectPath] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const canvasRefOut = useRef<HTMLCanvasElement | null>(null);

	const currentScene = project.scenes[selectedSceneIndex];
	const selectedLayer = currentScene?.layers.find((l) => l.id === selectedLayerId) ?? null;

	// ── Save project (responds to File > Save menu) ────────────────────

	const saveProject = useCallback(async () => {
		try {
			const result = await window.electronAPI?.saveProjectFile(
				project,
				project.name || "Scene Project",
				projectPath ?? undefined,
			);
			if (result?.success && result.path) {
				setProjectPath(result.path);
				toast.success("Project saved");
			}
		} catch (_err) {
			toast.error("Failed to save project");
		}
	}, [project, projectPath]);

	useEffect(() => {
		const cleanup = window.electronAPI?.onMenuSaveProject?.(() => {
			saveProject();
		});
		return () => cleanup?.();
	}, [saveProject]);

	// Mark unsaved changes
	useEffect(() => {
		window.electronAPI?.setHasUnsavedChanges?.(true);
		return () => {
			window.electronAPI?.setHasUnsavedChanges?.(false);
		};
	}, []);

	// ── Project mutation helpers ────────────────────────────────────────

	const updateScene = useCallback((sceneIndex: number, updates: Partial<Scene>) => {
		setProject((prev) => {
			const scenes = [...prev.scenes];
			scenes[sceneIndex] = { ...scenes[sceneIndex], ...updates };
			return { ...prev, scenes };
		});
	}, []);

	const updateCurrentScene = useCallback(
		(updates: Partial<Scene>) => {
			updateScene(selectedSceneIndex, updates);
		},
		[selectedSceneIndex, updateScene],
	);

	const updateLayer = useCallback(
		(layerId: string, updates: Partial<SceneLayer>) => {
			setProject((prev) => {
				const scenes = [...prev.scenes];
				const scene = { ...scenes[selectedSceneIndex] };
				scene.layers = scene.layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l));
				scenes[selectedSceneIndex] = scene;
				return { ...prev, scenes };
			});
		},
		[selectedSceneIndex],
	);

	// ── Scene management ───────────────────────────────────────────────

	const addScene = useCallback(() => {
		const newScene = DEFAULT_SCENE();
		setProject((prev) => ({
			...prev,
			scenes: [...prev.scenes, newScene],
		}));
		setSelectedSceneIndex(project.scenes.length);
		setSelectedLayerId(null);
		setCurrentTimeMs(0);
		setIsPlaying(false);
	}, [project.scenes.length]);

	const deleteScene = useCallback(
		(index: number) => {
			if (project.scenes.length <= 1) return;
			setProject((prev) => ({
				...prev,
				scenes: prev.scenes.filter((_, i) => i !== index),
			}));
			if (selectedSceneIndex >= index && selectedSceneIndex > 0) {
				setSelectedSceneIndex(selectedSceneIndex - 1);
			}
			setSelectedLayerId(null);
			setCurrentTimeMs(0);
			setIsPlaying(false);
		},
		[project.scenes.length, selectedSceneIndex],
	);

	const selectScene = useCallback((index: number) => {
		setSelectedSceneIndex(index);
		setSelectedLayerId(null);
		setCurrentTimeMs(0);
		setIsPlaying(false);
		setActiveTransition(null);
		setTransitionFromCanvas(null);
	}, []);

	// ── Layer management ───────────────────────────────────────────────

	const addTextLayer = useCallback(() => {
		const layer = DEFAULT_TEXT_LAYER({
			endMs: currentScene.durationMs,
			zIndex: currentScene.layers.length + 1,
		});
		updateCurrentScene({ layers: [...currentScene.layers, layer] });
		setSelectedLayerId(layer.id);
	}, [currentScene, updateCurrentScene]);

	const addImageLayer = useCallback(
		(src?: string) => {
			const layer = DEFAULT_IMAGE_LAYER({
				endMs: currentScene.durationMs,
				zIndex: currentScene.layers.length + 1,
				...(src ? { content: { src, fit: "contain", borderRadius: 8, shadow: true } } : {}),
			});
			updateCurrentScene({ layers: [...currentScene.layers, layer] });
			setSelectedLayerId(layer.id);
		},
		[currentScene, updateCurrentScene],
	);

	const addShapeLayer = useCallback(() => {
		const layer = DEFAULT_SHAPE_LAYER({
			endMs: currentScene.durationMs,
			zIndex: currentScene.layers.length + 1,
		});
		updateCurrentScene({ layers: [...currentScene.layers, layer] });
		setSelectedLayerId(layer.id);
	}, [currentScene, updateCurrentScene]);

	const deleteSelectedLayer = useCallback(() => {
		if (!selectedLayerId) return;
		updateCurrentScene({
			layers: currentScene.layers.filter((l) => l.id !== selectedLayerId),
		});
		setSelectedLayerId(null);
	}, [selectedLayerId, currentScene, updateCurrentScene]);

	const handleImageUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				addImageLayer(reader.result as string);
			};
			reader.readAsDataURL(file);
			// Reset so the same file can be selected again
			e.target.value = "";
		},
		[addImageLayer],
	);

	// ── Playback ───────────────────────────────────────────────────────

	const togglePlayback = useCallback(() => {
		if (isPlaying) {
			setIsPlaying(false);
		} else {
			// If at end of last scene, restart from beginning
			if (
				selectedSceneIndex === project.scenes.length - 1 &&
				currentTimeMs >= currentScene.durationMs
			) {
				setSelectedSceneIndex(0);
				setCurrentTimeMs(0);
			} else if (currentTimeMs >= currentScene.durationMs) {
				// At end of a non-last scene, reset time in current scene
				setCurrentTimeMs(0);
			}
			setIsPlaying(true);
		}
	}, [
		isPlaying,
		currentTimeMs,
		currentScene.durationMs,
		selectedSceneIndex,
		project.scenes.length,
	]);

	const handleSceneComplete = useCallback(() => {
		if (selectedSceneIndex < project.scenes.length - 1) {
			const nextIndex = selectedSceneIndex + 1;
			const nextScene = project.scenes[nextIndex];
			const trans = nextScene.transition;

			// Capture the last frame of the outgoing scene for transition
			if (trans.type !== "none" && trans.durationMs > 0 && canvasRefOut.current) {
				const canvas = canvasRefOut.current;
				const ctx = canvas.getContext("2d");
				if (ctx) {
					// Render the final frame of the current scene
					const res = getResolution(aspectRatio);
					renderScene(
						ctx,
						project.scenes[selectedSceneIndex],
						project.scenes[selectedSceneIndex].durationMs,
						res.width,
						res.height,
					);
					const captured = captureCanvas(ctx, res.width, res.height);
					setTransitionFromCanvas(captured);
					setActiveTransition(trans);
				}
			} else {
				setTransitionFromCanvas(null);
				setActiveTransition(null);
			}

			setSelectedSceneIndex(nextIndex);
			setCurrentTimeMs(0);
			// isPlaying stays true so next scene auto-plays
		} else {
			setIsPlaying(false);
			setActiveTransition(null);
			setTransitionFromCanvas(null);
			setCurrentTimeMs(project.scenes[selectedSceneIndex].durationMs);
		}
	}, [selectedSceneIndex, project.scenes, aspectRatio]);

	const handleTimeUpdate = useCallback((timeMs: number) => {
		setCurrentTimeMs(timeMs);
	}, []);

	const resetPlayback = useCallback(() => {
		setSelectedSceneIndex(0);
		setCurrentTimeMs(0);
		setIsPlaying(false);
		setActiveTransition(null);
		setTransitionFromCanvas(null);
	}, []);

	// ── Export ──────────────────────────────────────────────────────────

	const handleExport = useCallback(async () => {
		if (isExporting) return;
		setIsExporting(true);
		setExportProgress(null);
		setIsPlaying(false);

		try {
			const blob = await exportSceneProject(project, {
				fps: project.fps || 30,
				quality: "high",
				onProgress: setExportProgress,
			});

			const arrayBuffer = await blob.arrayBuffer();
			const fileName = `${project.name || "scene-export"}.webm`;
			const result = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

			if (result.success) {
				toast.success("Video exported successfully");
			} else if (!result.canceled) {
				toast.error(result.message || "Failed to save video");
			}
		} catch (err) {
			console.error("Export failed:", err);
			toast.error(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
		} finally {
			setIsExporting(false);
			setExportProgress(null);
		}
	}, [isExporting, project]);

	// ── Background ─────────────────────────────────────────────────────

	const handleBackgroundChange = useCallback(
		(bg: string) => {
			updateCurrentScene({ background: bg });
		},
		[updateCurrentScene],
	);

	const handleDurationChange = useCallback(
		(ms: number) => {
			updateCurrentScene({
				durationMs: ms,
				// Also clamp layer endMs
				layers: currentScene.layers.map((l) => ({
					...l,
					endMs: Math.min(l.endMs, ms),
					startMs: Math.min(l.startMs, ms - 100),
				})),
			});
		},
		[currentScene, updateCurrentScene],
	);

	// ── AI scene generation ───────────────────────────────────────────

	const handleAiGenerate = useCallback(async () => {
		if (!aiPrompt.trim() || isAiGenerating) return;

		setIsAiGenerating(true);
		try {
			const generated = await generateSceneProject(aiPrompt.trim(), selectedStyle ?? undefined);
			if (generated) {
				setProject(generated);
				setSelectedSceneIndex(0);
				setSelectedLayerId(null);
				setCurrentTimeMs(0);
				setIsPlaying(false);
				setActiveTransition(null);
				setTransitionFromCanvas(null);
				setAiPopoverOpen(false);
				setAiPrompt("");
				const styleName = selectedStyle
					? (DESIGN_STYLE_LIST.find((s) => s.id === selectedStyle)?.name ?? "")
					: "";
				toast.success(
					`Generated "${generated.name}" with ${generated.scenes.length} scenes${styleName ? ` (${styleName})` : ""}`,
				);
			} else {
				toast.error("AI generation failed. Check your AI provider settings.");
			}
		} catch (err) {
			console.error("AI scene generation failed:", err);
			toast.error(`Generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
		} finally {
			setIsAiGenerating(false);
		}
	}, [aiPrompt, isAiGenerating, selectedStyle]);

	// ── AI Polish ─────────────────────────────────────────────────────

	const handlePolish = useCallback(
		async (useAI = false) => {
			if (isPolishing || project.scenes.length === 0) return;
			setIsPolishing(true);
			try {
				let result: {
					project: typeof project;
					preview: {
						backgroundsChanged: number;
						transitionsAdded: number;
						animationsEnhanced: number;
						durationsAdjusted: number;
						totalScenes: number;
					};
				};

				if (useAI) {
					// Check if we have screenshots (image layers) to analyze
					const hasImages = project.scenes.some((s) =>
						s.layers.some(
							(l) =>
								l.type === "image" && (l.content as { src?: string }).src?.startsWith("data:image"),
						),
					);
					if (hasImages) {
						toast.info("Analyzing scenes with AI...");
						result = await aiPolishSceneProject(project, (i, total) => {
							toast.loading(`Analyzing scene ${i + 1} of ${total}...`, { id: "ai-polish" });
						});
						toast.dismiss("ai-polish");
					} else {
						result = polishSceneProject(project);
					}
				} else {
					result = polishSceneProject(project);
				}

				setProject(result.project);
				setSelectedSceneIndex(0);
				setSelectedLayerId(null);
				setCurrentTimeMs(0);
				setIsPlaying(false);

				const { preview } = result;
				const parts: string[] = [];
				if (preview.backgroundsChanged > 0) parts.push(`${preview.backgroundsChanged} backgrounds`);
				if (preview.transitionsAdded > 0) parts.push(`${preview.transitionsAdded} transitions`);
				if (preview.animationsEnhanced > 0) parts.push(`${preview.animationsEnhanced} animations`);
				if (preview.durationsAdjusted > 0) parts.push(`${preview.durationsAdjusted} timings`);
				toast.success(
					`${useAI ? "AI-" : ""}Polished ${preview.totalScenes} scenes: ${parts.join(", ") || "no changes needed"}`,
				);
			} catch (_err) {
				toast.error("Polish failed");
				console.error("Scene polish error:", _err);
			} finally {
				setIsPolishing(false);
			}
		},
		[project, isPolishing],
	);

	// ── AI Critique ───────────────────────────────────────────────────

	const handleCritique = useCallback(async () => {
		if (isCritiquing || project.scenes.length === 0) return;
		setIsCritiquing(true);
		try {
			toast.info("Critiquing scenes with AI...");
			const result = await critiqueSceneProject(project, (i, total) => {
				toast.loading(`Analyzing scene ${i + 1} of ${total}...`, { id: "critique" });
			});
			toast.dismiss("critique");

			// Count available mutations
			const totalMutations = result.sceneCritiques.reduce((sum, c) => sum + c.mutations.length, 0);

			if (totalMutations > 0) {
				// Auto-apply improvements
				const improved = applyCritiqueMutations(project, result.sceneCritiques);
				setProject(improved);
				setSelectedSceneIndex(0);
				setCurrentTimeMs(0);
				setIsPlaying(false);
				toast.success(
					`Score: ${result.projectScore}/10 — applied ${totalMutations} improvements. ${result.summary}`,
				);
			} else {
				toast.success(`Score: ${result.projectScore}/10 — ${result.summary}`);
			}
		} catch (err) {
			console.error("Critique failed:", err);
			toast.error("Critique failed — check your AI provider settings.");
		} finally {
			setIsCritiquing(false);
		}
	}, [project, isCritiquing]);

	// ── Keyboard shortcuts ─────────────────────────────────────────────

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (
				(e.key === " " && !e.target) ||
				((e.target as HTMLElement).tagName !== "TEXTAREA" &&
					(e.target as HTMLElement).tagName !== "INPUT")
			) {
				e.preventDefault();
				togglePlayback();
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (
					(e.target as HTMLElement).tagName !== "TEXTAREA" &&
					(e.target as HTMLElement).tagName !== "INPUT"
				) {
					deleteSelectedLayer();
				}
			}
			if (e.key === "Escape") {
				setSelectedLayerId(null);
			}
		},
		[togglePlayback, deleteSelectedLayer],
	);

	return (
		<div
			className="flex flex-col h-screen bg-[#09090b] text-slate-200 overflow-hidden selection:bg-[#2563eb]/30"
			onKeyDown={handleKeyDown}
			tabIndex={0}
		>
			{/* ── Top Toolbar ──────────────────────────────────────────── */}
			<div className="h-11 flex-shrink-0 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center gap-2 px-4 z-50">
				{/* Back button */}
				<button
					onClick={onBack}
					className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
				>
					<ArrowLeft size={14} />
					<span className="text-xs">Back</span>
				</button>

				<div className="w-px h-5 bg-white/10 mx-1" />

				{/* Add layer buttons */}
				<button
					onClick={addTextLayer}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs"
				>
					<Type size={14} />
					Text
				</button>
				<button
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs"
				>
					<ImagePlus size={14} />
					Image
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleImageUpload}
					className="hidden"
				/>
				<button
					onClick={addShapeLayer}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs"
				>
					<Square size={14} />
					Shape
				</button>

				<div className="w-px h-5 bg-white/10 mx-1" />

				{/* Scene duration */}
				<div className="flex items-center gap-2">
					<Clock size={12} className="text-white/40" />
					<span className="text-[10px] text-white/40">Duration</span>
					<div className="w-24">
						<Slider
							value={[currentScene.durationMs]}
							onValueChange={([v]) => handleDurationChange(v)}
							min={1000}
							max={30000}
							step={500}
						/>
					</div>
					<span className="text-[10px] text-white/50 w-8">
						{(currentScene.durationMs / 1000).toFixed(1)}s
					</span>
				</div>

				<div className="w-px h-5 bg-white/10 mx-1" />

				{/* Background picker */}
				<Popover>
					<PopoverTrigger asChild>
						<button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs">
							<Palette size={14} />
							Background
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-80 bg-[#141417] border-white/10" align="start">
						<div className="space-y-3">
							<div className="text-xs text-white/60 font-medium">Scene Background</div>

							{/* Solid color */}
							<div className="flex items-center gap-2">
								<span className="text-[10px] text-white/40">Solid Color</span>
								<input
									type="color"
									value={
										currentScene.background.startsWith("#") ? currentScene.background : "#09090b"
									}
									onChange={(e) => handleBackgroundChange(e.target.value)}
									className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent"
								/>
							</div>

							{/* Animated backgrounds */}
							<AnimatedBackgroundPicker
								selected={currentScene.background}
								onSelect={handleBackgroundChange}
							/>
						</div>
					</PopoverContent>
				</Popover>

				<div className="w-px h-5 bg-white/10 mx-1" />

				{/* AI Generate */}
				<Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
					<PopoverTrigger asChild>
						<button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-purple-400/70 hover:text-purple-300 hover:bg-purple-400/10 transition-colors text-xs">
							<Sparkles size={14} />
							AI Generate
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-[440px] bg-[#141417] border-white/10" align="start">
						<div className="space-y-3">
							<div className="text-xs text-white/60 font-medium">
								Generate Scene Project with AI
							</div>

							{/* Style selector grid */}
							<div>
								<div className="text-[10px] text-white/40 mb-1.5">Design Style</div>
								<div className="grid grid-cols-4 gap-1.5">
									{DESIGN_STYLE_LIST.map((style) => (
										<button
											key={style.id}
											onClick={() =>
												setSelectedStyle(
													selectedStyle === style.id ? null : (style.id as DesignStyleId),
												)
											}
											className={`flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-md border transition-colors ${
												selectedStyle === style.id
													? "border-purple-500/60 bg-purple-500/10 text-purple-300"
													: "border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 text-white/50 hover:text-white/70"
											}`}
											title={style.description}
										>
											<div
												className="w-full h-5 rounded-sm"
												style={{ background: style.previewGradient }}
											/>
											<span className="text-[9px] leading-tight text-center truncate w-full">
												{style.name}
											</span>
										</button>
									))}
								</div>
							</div>

							{/* Template chips */}
							<div className="flex flex-wrap gap-1.5">
								{SCENE_TEMPLATES.map((t) => (
									<button
										key={t.id}
										onClick={() => setAiPrompt(t.prompt)}
										className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[10px] text-white/60 hover:text-white/80 transition-colors"
										title={t.description}
									>
										<span>{t.thumbnail}</span>
										{t.name}
									</button>
								))}
							</div>

							<textarea
								value={aiPrompt}
								onChange={(e) => setAiPrompt(e.target.value)}
								placeholder="Describe your video, or pick a template above..."
								className="w-full h-20 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white/90 placeholder:text-white/25 resize-none focus:outline-none focus:border-[#2563eb]/50"
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										e.preventDefault();
										handleAiGenerate();
									}
									e.stopPropagation(); // prevent space from toggling playback
								}}
							/>
							<div className="flex items-center justify-between">
								<span className="text-[10px] text-white/30">
									{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to generate
								</span>
								<button
									onClick={handleAiGenerate}
									disabled={!aiPrompt.trim() || isAiGenerating}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isAiGenerating ? (
										<>
											<Loader2 size={12} className="animate-spin" />
											Generating...
										</>
									) : (
										<>
											<Sparkles size={12} />
											Generate
										</>
									)}
								</button>
							</div>
						</div>
					</PopoverContent>
				</Popover>

				{/* Polish buttons */}
				<button
					onClick={() => handlePolish(false)}
					disabled={isPolishing || project.scenes.length === 0}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-amber-400/70 hover:text-amber-300 hover:bg-amber-400/10 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
					title="Quick polish — instant heuristic enhancements"
				>
					{isPolishing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
					Polish
				</button>
				<button
					onClick={() => handlePolish(true)}
					disabled={isPolishing || project.scenes.length === 0}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-purple-400/70 hover:text-purple-300 hover:bg-purple-400/10 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
					title="AI polish — vision model analyzes each screenshot for smart enhancements"
				>
					<Sparkles size={14} />
					AI Polish
				</button>

				{/* AI Critique */}
				<button
					onClick={handleCritique}
					disabled={isCritiquing || project.scenes.length === 0}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-teal-400/70 hover:text-teal-300 hover:bg-teal-400/10 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
					title="AI critique — scores each scene against design principles and auto-applies improvements"
				>
					{isCritiquing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
					Critique
				</button>

				{/* AI Settings */}
				<AISettingsButton />

				{/* Spacer */}
				<div className="flex-1" />

				{/* Delete selected layer */}
				{selectedLayerId && (
					<button
						onClick={deleteSelectedLayer}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs"
					>
						<Trash2 size={14} />
						Delete Layer
					</button>
				)}

				{/* Export button */}
				<button
					onClick={handleExport}
					disabled={isExporting}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isExporting ? (
						<>
							<Loader2 size={14} className="animate-spin" />
							{exportProgress ? `${Math.round(exportProgress.progress * 100)}%` : "Exporting..."}
						</>
					) : (
						<>
							<Download size={14} />
							Export
						</>
					)}
				</button>
			</div>

			{/* ── Main Content Area ────────────────────────────────────── */}
			<div className="flex-1 flex overflow-hidden min-h-0">
				<PanelGroup direction="horizontal">
					{/* Center: Canvas + playback controls */}
					<Panel defaultSize={75} minSize={40}>
						<div className="flex flex-col h-full min-w-0 min-h-0">
							{/* Responsive size toolbar */}
							<div className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-1.5 border-b border-white/5">
								{/* Preview mode toggle */}
								<div className="flex gap-0.5 p-0.5 rounded bg-white/5 mr-3">
									{(["canvas", "remotion"] as const).map((mode) => (
										<button
											key={mode}
											onClick={() => setPreviewMode(mode)}
											className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
												previewMode === mode
													? "bg-[#2563eb]/20 text-[#2563eb]"
													: "text-white/40 hover:text-white/70"
											}`}
										>
											{mode === "canvas" ? "Canvas" : "Remotion"}
										</button>
									))}
								</div>

								{[
									{ label: "16:9", ratio: "16/9" },
									{ label: "9:16", ratio: "9/16" },
									{ label: "1:1", ratio: "1/1" },
									{ label: "4:3", ratio: "4/3" },
								].map((preset) => (
									<button
										key={preset.label}
										onClick={() => setAspectRatio(preset.ratio)}
										className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
											aspectRatio === preset.ratio
												? "text-[#2563eb] bg-[#2563eb]/10"
												: "text-white/40 hover:text-white/70 hover:bg-white/10"
										}`}
										title={preset.ratio}
									>
										{preset.label}
									</button>
								))}
							</div>
							{/* Preview area */}
							<div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
								{previewMode === "remotion" ? (
									<RemotionPreview project={project} isPlaying={isPlaying} />
								) : (
									<SceneCanvas
										scene={currentScene}
										currentTimeMs={currentTimeMs}
										isPlaying={isPlaying}
										selectedLayerId={selectedLayerId}
										aspectRatio={aspectRatio}
										transition={activeTransition ?? undefined}
										transitionFromCanvas={transitionFromCanvas}
										canvasRefOut={canvasRefOut}
										onSelectLayer={setSelectedLayerId}
										onTimeUpdate={handleTimeUpdate}
										onSceneComplete={handleSceneComplete}
										onLayerMove={(layerId, x, y) => {
											updateCurrentScene({
												layers: currentScene.layers.map((l) =>
													l.id === layerId ? { ...l, position: { x, y } } : l,
												),
											});
										}}
										onLayerResize={(layerId, width, height) => {
											updateCurrentScene({
												layers: currentScene.layers.map((l) =>
													l.id === layerId ? { ...l, size: { width, height } } : l,
												),
											});
										}}
									/>
								)}
							</div>

							{/* Playback controls bar */}
							<div className="flex-shrink-0 flex items-center justify-center gap-4 px-4 py-2 border-t border-white/5">
								<button
									onClick={resetPlayback}
									className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
								>
									<RotateCcw size={14} />
								</button>
								<button
									onClick={togglePlayback}
									className="p-2 rounded-full bg-[#2563eb] hover:bg-[#2563eb]/80 text-white transition-colors"
								>
									{isPlaying ? <Pause size={16} /> : <Play size={16} />}
								</button>
								{/* Time scrubber */}
								<div className="flex items-center gap-2 flex-1 max-w-md">
									<Slider
										value={[currentTimeMs]}
										onValueChange={([v]) => {
											setCurrentTimeMs(v);
											setIsPlaying(false);
										}}
										min={0}
										max={currentScene.durationMs}
										step={16}
									/>
									<span className="text-[10px] text-white/50 w-44 text-right font-mono">
										Scene {selectedSceneIndex + 1}/{project.scenes.length}
										{" · "}
										{formatTime(currentTimeMs)} / {formatTime(currentScene.durationMs)}
									</span>
								</div>
							</div>
						</div>
					</Panel>

					<PanelResizeHandle className="w-1 rounded-full bg-white/5 hover:bg-[#2563eb]/40 transition-colors" />

					{/* Right sidebar: Layer properties */}
					<Panel defaultSize={25} minSize={15} maxSize={40}>
						<LayerPanel
							layer={selectedLayer}
							sceneDurationMs={currentScene.durationMs}
							allLayers={currentScene.layers}
							onUpdateLayer={updateLayer}
							onSelectLayer={setSelectedLayerId}
						/>
					</Panel>
				</PanelGroup>
			</div>

			{/* ── Bottom: Scene Timeline ────────────────────────────────── */}
			<SceneTimeline
				scenes={project.scenes}
				selectedIndex={selectedSceneIndex}
				onSelectScene={selectScene}
				onAddScene={addScene}
				onDeleteScene={deleteScene}
				onUpdateTransition={(sceneIndex, transition) => updateScene(sceneIndex, { transition })}
			/>
		</div>
	);
}
