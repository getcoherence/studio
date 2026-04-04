import {
	ArrowLeft,
	Clock,
	Download,
	Eye,
	ImagePlus,
	Loader2,
	Music,
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
import { Slider } from "@/components/ui/slider";
import { AnimatedBackgroundPicker } from "@/components/video-editor/AnimatedBackgroundPicker";
import { generateAiComposition } from "@/lib/ai/aiCinematicEngine";
import { applyCritiqueMutations, critiqueSceneProject } from "@/lib/ai/designCritique";
import { DESIGN_STYLE_LIST, type DesignStyleId } from "@/lib/ai/designStyles";
import { generateSceneProject } from "@/lib/ai/sceneGenerator";
import type { ScenePlan, ScenePlanItem } from "@/lib/ai/scenePlan";
import { BACKGROUND_NAMES } from "@/lib/ai/scenePlan";
import { compileScenePlan, expandSceneToLayers } from "@/lib/ai/scenePlanCompiler";
import { reviewCompositionVisually } from "@/lib/ai/visionReview";
import { aiPolishSceneProject, polishSceneProject } from "@/lib/ai/scenePolish";
import { generateCustomMusic, type MusicMood } from "@/lib/audio/musicCatalog";
import { type AiCompositionData, consumePendingDemoProject } from "@/lib/demoProjectStore";
import { DynamicPreview } from "@/lib/remotion/DynamicPreview";
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
import { LottieBrowser } from "./LottieBrowser";
import { SceneLayerEditor } from "./SceneLayerEditor";
import { SceneLayerTimeline } from "./SceneLayerTimeline";
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

// ── Inline music preview player ──────────────────────────────────────

function MusicPreviewPlayer({ audioPath }: { audioPath: string }) {
	const [playing, setPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	function toggle() {
		if (!audioRef.current) {
			const cleaned = audioPath.replace(/^file:\/\//, "");
			const src = `lucid://file/${cleaned.replace(/\\/g, "/")}`;
			audioRef.current = new Audio(src);
			audioRef.current.onended = () => setPlaying(false);
			audioRef.current.onerror = () => {
				setPlaying(false);
				toast.error("Failed to play audio");
			};
		}
		if (playing) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
			setPlaying(false);
		} else {
			audioRef.current.play().catch(() => setPlaying(false));
			setPlaying(true);
		}
	}

	return (
		<button
			onClick={toggle}
			className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-400/5 transition-colors"
		>
			{playing ? <Square size={10} /> : <Play size={10} />}
			{playing ? "Stop preview" : "Preview music"}
		</button>
	);
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
	const [aiComposition, setAiComposition] = useState<AiCompositionData | null>(() => {
		const proj = project as any;
		if (project.styleId === "ai-cinematic" && proj._aiCode) {
			return { code: proj._aiCode, screenshots: proj._aiScreenshots || [] };
		}
		return null;
	});
	const [scenePlan, setScenePlan] = useState<ScenePlan | null>(() => {
		const plan: ScenePlan | null = (project as any)._aiPlan ?? null;
		if (plan) {
			const accent = plan.accentColor || "#2563eb";
			for (const scene of plan.scenes) {
				// Always re-expand if layers are empty or missing
				if (!scene.layers || scene.layers.length === 0) {
					const expanded = expandSceneToLayers(scene, accent);
					// If expansion produced nothing (no headline etc), create a default text layer
					scene.layers =
						expanded.length > 0
							? expanded
							: [
									{
										id: `default-${Date.now()}`,
										type: "text" as const,
										content: scene.headline || "Untitled",
										position: "center" as const,
										size: 80,
										startFrame: 0,
										endFrame: -1,
										settings: {
											fontSize: 120,
											color: ["white", "cream", "#fafafa", "#f5f0e8"].includes(scene.background)
												? "#050505"
												: "#ffffff",
											animation: "chars",
										},
									},
								];
				}
			}
		}
		return plan;
	});
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [previewMode, setPreviewMode] = useState<"canvas" | "remotion">(
		// Default to Remotion for cinematic/AI projects
		project.styleId === "cinematic" || project.styleId === "ai-cinematic" ? "remotion" : "canvas",
	);
	const [activeTransition, setActiveTransition] = useState<SceneTransition | null>(null);
	const [transitionFromCanvas, setTransitionFromCanvas] = useState<HTMLCanvasElement | null>(null);
	const [aiPrompt, setAiPrompt] = useState("");
	const [isAiGenerating, setIsAiGenerating] = useState(false);
	const [isPolishing, setIsPolishing] = useState(false);
	const [isCritiquing, setIsCritiquing] = useState(false);
	const [isVisionReviewing, setIsVisionReviewing] = useState(false);
	const [visionScore, setVisionScore] = useState<number | null>(null);
	const playerContainerRef = useRef<HTMLDivElement>(null);
	const [musicPath, _setMusicPath] = useState<string | null>(
		() => (project as any)._musicPath ?? null,
	);
	const [musicDataUrl, setMusicDataUrl] = useState<string | null>(null);
	const setMusicPath = useCallback((path: string | null) => {
		_setMusicPath(path);
		// Update project with new reference so auto-save triggers
		setProject((prev) => ({ ...prev, _musicPath: path }) as any);
		// Load the audio file as a data URL for Remotion (needs seekable media)
		if (path) {
			window.electronAPI
				?.readBinaryFile(path)
				.then((result: any) => {
					if (result?.success && result.data) {
						const base64 = btoa(
							new Uint8Array(result.data).reduce((s, b) => s + String.fromCharCode(b), ""),
						);
						setMusicDataUrl(`data:audio/mpeg;base64,${base64}`);
					}
				})
				.catch(() => setMusicDataUrl(null));
		} else {
			setMusicDataUrl(null);
		}
	}, []);

	// Load music data URL on mount if musicPath exists
	useEffect(() => {
		if (musicPath && !musicDataUrl) {
			setMusicPath(musicPath);
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps
	const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
	const [rightPanelTab, setRightPanelTab] = useState<
		"layers" | "tools" | "music" | "background" | "code" | "plan"
	>(project.styleId === "ai-cinematic" ? "plan" : "layers");
	const [selectedStyle, setSelectedStyle] = useState<DesignStyleId | null>(null);
	const [projectPath, setProjectPath] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const canvasRefOut = useRef<HTMLCanvasElement | null>(null);

	const currentScene = project.scenes[selectedSceneIndex];
	const selectedLayer = currentScene?.layers.find((l) => l.id === selectedLayerId) ?? null;

	// ── Auto-save ───────────────────────────────────────────────────────

	const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const doAutoSave = useCallback(async (proj: SceneProject, path: string | null) => {
		try {
			if (path) {
				await window.electronAPI?.saveProjectFile(proj, proj.name, path);
				console.log("[AutoSave] Saved to existing path:", path);
			} else {
				const baseName = (proj.name || "Untitled").replace(/[^a-zA-Z0-9-_ ]/g, "_");
				const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
				const fileName = `${baseName}_${timestamp}`;
				console.log("[AutoSave] First save, filename:", fileName);
				const result = await window.electronAPI?.autoSaveProject(proj, fileName);
				console.log("[AutoSave] Result:", result);
				if (result?.success && result.path) {
					setProjectPath(result.path);
				}
			}
		} catch (err) {
			console.error("[AutoSave] Failed:", err);
		}
	}, []);

	// Auto-save on mount (initial save)
	useEffect(() => {
		doAutoSave(project, projectPath);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounced auto-save on project changes (15s after last change)
	useEffect(() => {
		if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
		autoSaveTimerRef.current = setTimeout(() => {
			doAutoSave(project, projectPath);
		}, 15_000);
		return () => {
			if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
		};
	}, [project, projectPath, doAutoSave]);

	// ── Manual save (responds to File > Save menu) ──────────────────────

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

	const [resetSignal, setResetSignal] = useState(0);
	const [seekToFrame, setSeekToFrame] = useState<number | undefined>(undefined);

	const resetPlayback = useCallback(() => {
		setSelectedSceneIndex(0);
		setCurrentTimeMs(0);
		setIsPlaying(false);
		setActiveTransition(null);
		setTransitionFromCanvas(null);
		setResetSignal((s) => s + 1);
	}, []);

	// ── Export ──────────────────────────────────────────────────────────

	const handleExport = useCallback(async () => {
		if (isExporting) return;
		setIsExporting(true);
		setExportProgress(null);
		setIsPlaying(false);

		try {
			let blob: Blob;

			if (aiComposition && playerContainerRef.current) {
				// AI Cinematic: capture from Remotion Player
				toast.loading("Exporting AI Cinematic video... this may take a minute", { id: "export" });
				const { exportPlayerToVideo } = await import("@/lib/remotion/playerExport");
				const totalMs = project.scenes.reduce((s, sc) => s + sc.durationMs, 0) || 30000;
				blob = await exportPlayerToVideo({
					playerElement: playerContainerRef.current,
					durationMs: totalMs,
					fps: 30,
					seekToFrame: (f) => setSeekToFrame(f),
					onProgress: (p) =>
						setExportProgress({ phase: "rendering", progress: p, currentScene: 0, totalScenes: 1 }),
				});
				toast.dismiss("export");
			} else {
				// Standard: Canvas 2D export
				blob = await exportSceneProject(project, {
					fps: project.fps || 30,
					quality: "high",
					onProgress: setExportProgress,
				});
			}

			const arrayBuffer = await blob.arrayBuffer();
			const fileName = `${project.name || "scene-export"}.webm`;
			const result = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

			if (result.success && result.path && musicPath) {
				// Merge music with the exported video
				toast.loading("Adding background music...", { id: "merge" });
				const mergeResult = await window.electronAPI.mergeVideoAudio(result.path, musicPath);
				toast.dismiss("merge");
				if (mergeResult.success) {
					toast.success("Video exported with music!");
				} else {
					toast.success("Video exported (music merge failed — video saved without music)");
				}
			} else if (result.success) {
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
	}, [isExporting, project, musicPath]);

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

	// ── Vision Review ──────────────────────────────────────────────

	const handleVisionReview = useCallback(async () => {
		if (isVisionReviewing || !playerContainerRef.current) return;
		setIsVisionReviewing(true);
		try {
			const totalFrames = aiComposition
				? (() => {
						try {
							const m = aiComposition.code.match(/totalDuration\s*=\s*(\d+)/);
							return m ? parseInt(m[1], 10) : 600;
						} catch {
							return 600;
						}
					})()
				: project.scenes.reduce((s, sc) => s + Math.ceil(sc.durationMs / 33.3), 0);

			const result = await reviewCompositionVisually(
				playerContainerRef.current,
				(frame) => setSeekToFrame(frame),
				totalFrames,
				(msg) => toast.loading(msg, { id: "vision-review" }),
			);
			toast.dismiss("vision-review");

			setVisionScore(result.score);
			if (result.issues.length > 0) {
				toast.info(`Score: ${result.score}/10\n${result.issues.join("\n")}`, { duration: 10000 });
			} else {
				toast.success(`Score: ${result.score}/10 — looks great!`);
			}
		} catch (err) {
			toast.dismiss("vision-review");
			toast.error("Vision review failed");
		}
		setIsVisionReviewing(false);
	}, [isVisionReviewing, aiComposition, project.scenes]);

	// ── Scene Plan editing ──────────────────────────────────────────

	const addSceneToPlan = useCallback(
		(afterIndex: number) => {
			if (!scenePlan) return;
			const newScene: ScenePlanItem = {
				type: "hero-text",
				headline: "New Scene",
				background: "black",
				animation: "words",
				font: "sans-serif",
				fontSize: 120,
				durationFrames: 90,
				effects: [],
			};
			const newScenes = [...scenePlan.scenes];
			newScenes.splice(afterIndex + 1, 0, newScene);
			const newPlan = { ...scenePlan, scenes: newScenes };
			setScenePlan(newPlan);
			const newCode = compileScenePlan(newPlan);
			setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
			(project as any)._aiCode = newCode;
			(project as any)._aiPlan = newPlan;
		},
		[scenePlan, project],
	);

	const deleteSceneFromPlan = useCallback(
		(index: number) => {
			if (!scenePlan || scenePlan.scenes.length <= 1) return;
			const newPlan = { ...scenePlan, scenes: scenePlan.scenes.filter((_, i) => i !== index) };
			setScenePlan(newPlan);
			const newCode = compileScenePlan(newPlan);
			setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
			(project as any)._aiCode = newCode;
			(project as any)._aiPlan = newPlan;
		},
		[scenePlan, project],
	);

	const moveSceneInPlan = useCallback(
		(fromIndex: number, direction: "up" | "down") => {
			if (!scenePlan) return;
			const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
			if (toIndex < 0 || toIndex >= scenePlan.scenes.length) return;
			const newScenes = [...scenePlan.scenes];
			[newScenes[fromIndex], newScenes[toIndex]] = [newScenes[toIndex], newScenes[fromIndex]];
			const newPlan = { ...scenePlan, scenes: newScenes };
			setScenePlan(newPlan);
			const newCode = compileScenePlan(newPlan);
			setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
			(project as any)._aiCode = newCode;
			(project as any)._aiPlan = newPlan;
		},
		[scenePlan, project],
	);

	const recompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const updateScenePlan = useCallback(
		(sceneIndex: number, updates: Partial<ScenePlanItem>) => {
			if (!scenePlan) return;
			const newPlan = {
				...scenePlan,
				scenes: scenePlan.scenes.map((s, i) => (i === sceneIndex ? { ...s, ...updates } : s)),
			};
			setScenePlan(newPlan);
			(project as any)._aiPlan = newPlan;

			// Debounce recompile so typing doesn't steal focus
			if (recompileTimerRef.current) clearTimeout(recompileTimerRef.current);
			recompileTimerRef.current = setTimeout(() => {
				const newCode = compileScenePlan(newPlan);
				setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
				(project as any)._aiCode = newCode;
				// Seek player to the edited scene
				const startFrame = newPlan.scenes
					.slice(0, sceneIndex)
					.reduce((sum, s) => sum + (s.durationFrames || 90), 0);
				setSeekToFrame(startFrame);
			}, 500);
		},
		[scenePlan, project],
	);

	// ── Music ────────────────────────────────────────────────────────

	const handleGenerateMusic = useCallback(async (mood: MusicMood) => {
		setIsGeneratingMusic(true);
		toast.loading("Composing your soundtrack... this takes ~30 seconds", { id: "music" });
		try {
			// Calculate video duration from project scenes
			const totalMs = project.scenes.reduce((sum, s) => sum + s.durationMs, 0);
			const videoDurationSec = Math.round(totalMs / 1000);
			console.log("[Music] Requesting", mood, "music for", videoDurationSec, "second video");
			const result = await generateCustomMusic(mood, undefined, videoDurationSec);
			console.log("[Music] Result:", result);
			toast.dismiss("music");
			if (result.success && result.audioPath) {
				setMusicPath(result.audioPath);
				toast.success(`Music generated! (${mood})`);
			} else {
				console.error("[Music] Generation failed:", result.error);
				toast.error(result.error || "Music generation failed");
			}
		} catch (err) {
			console.error("[Music] Exception:", err);
			toast.dismiss("music");
			toast.error("Music generation failed");
		}
		setIsGeneratingMusic(false);
	}, []);

	// ── AI Regenerate ────────────────────────────────────────────────

	const [regenInput, setRegenInput] = useState("");

	const handleRegenerate = useCallback(
		async (instructions?: string) => {
			if (isRegenerating || !aiComposition) return;
			setIsRegenerating(true);
			const proj = project as any;

			// Use original steps if available, otherwise reconstruct from project scenes
			const steps =
				proj._aiSteps ??
				project.scenes.map((scene: Scene, i: number) => {
					const textLayer = scene.layers.find((l: SceneLayer) => l.type === "text");
					const headline = textLayer ? (textLayer.content as any).text : "";
					return {
						action: { action: "navigate" as const, narration: headline },
						timestamp: 0,
						screenshotDataUrl: aiComposition.screenshots[i],
						headline,
					};
				});

			try {
				const result = await generateAiComposition(steps, {
					title: project.name,
					brand: proj._aiBrand ?? { primaryColor: "#2563eb" },
					instructions: instructions || undefined,
					onStatus: (msg) => toast.loading(msg, { id: "regen" }),
				});

				toast.dismiss("regen");

				if (result.error) {
					toast.error(`Regeneration failed: ${result.error}`);
				} else {
					setAiComposition({ code: result.code, screenshots: result.screenshots });
					proj._aiCode = result.code;
					setRegenInput("");
					toast.success("Composition regenerated!");
				}
			} catch (_err) {
				toast.dismiss("regen");
				toast.error("Regeneration failed");
			}
			setIsRegenerating(false);
		},
		[isRegenerating, aiComposition, project],
	);

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
					<span className="text-[11px] text-white/40">Duration</span>
					<div className="w-24">
						<Slider
							value={[currentScene.durationMs]}
							onValueChange={([v]) => handleDurationChange(v)}
							min={1000}
							max={30000}
							step={500}
						/>
					</div>
					<span className="text-[11px] text-white/50 w-8">
						{(currentScene.durationMs / 1000).toFixed(1)}s
					</span>
				</div>

				<div className="w-px h-5 bg-white/10 mx-1" />

				<div className="w-px h-5 bg-white/10 mx-1" />

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
								{/* Preview mode toggle — hidden for AI Cinematic (always Motion) */}
								{!aiComposition && (
									<div className="flex gap-0.5 p-0.5 rounded bg-white/5 mr-3">
										{(["canvas", "remotion"] as const).map((mode) => (
											<button
												key={mode}
												onClick={() => setPreviewMode(mode)}
												className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
													previewMode === mode
														? "bg-[#2563eb]/20 text-[#2563eb]"
														: "text-white/40 hover:text-white/70"
												}`}
											>
												{mode === "canvas" ? "Canvas" : "Motion"}
											</button>
										))}
									</div>
								)}

								{previewMode === "canvas" &&
									[
										{ label: "16:9", ratio: "16/9" },
										{ label: "9:16", ratio: "9/16" },
										{ label: "1:1", ratio: "1/1" },
										{ label: "4:3", ratio: "4/3" },
									].map((preset) => (
										<button
											key={preset.label}
											onClick={() => setAspectRatio(preset.ratio)}
											className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
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
							<div
								ref={playerContainerRef}
								className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden"
							>
								{previewMode === "remotion" && aiComposition ? (
									<DynamicPreview
										code={aiComposition.code}
										screenshots={aiComposition.screenshots}
										isPlaying={isPlaying}
										musicSrc={musicDataUrl ?? undefined}
										resetSignal={resetSignal}
										seekToFrame={seekToFrame}
									/>
								) : previewMode === "remotion" ? (
									<RemotionPreview
										project={project}
										isPlaying={isPlaying}
										musicSrc={musicDataUrl ?? undefined}
										resetSignal={resetSignal}
									/>
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
									<span className="text-[11px] text-white/50 text-right font-mono whitespace-nowrap">
										Scene {selectedSceneIndex + 1}/{project.scenes.length} ·{" "}
										{formatTime(currentTimeMs)} / {formatTime(currentScene.durationMs)}
									</span>
								</div>
							</div>
						</div>
					</Panel>

					<PanelResizeHandle className="w-1 rounded-full bg-white/5 hover:bg-[#2563eb]/40 transition-colors" />

					{/* Right sidebar: tabbed panel */}
					<Panel defaultSize={25} minSize={15} maxSize={40}>
						<div className="flex flex-col h-full bg-[#0c0c0f]">
							{/* Tab bar */}
							<div className="flex border-b border-white/5 px-1 pt-1">
								{(
									[
										// Hide Layers + BG for AI Cinematic (not editable)
										...(!aiComposition ? [{ id: "layers" as const, label: "Layers" }] : []),
										{ id: "tools" as const, label: "Tools" },
										...(!aiComposition ? [{ id: "background" as const, label: "BG" }] : []),
										...(scenePlan ? [{ id: "plan" as const, label: "Scenes" }] : []),
										...(aiComposition ? [{ id: "code" as const, label: "Code" }] : []),
										{ id: "music" as const, label: "Music" },
									] as const
								).map((tab) => (
									<button
										key={tab.id}
										onClick={() => setRightPanelTab(tab.id)}
										className={`px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors ${
											rightPanelTab === tab.id
												? "text-white bg-white/5 border-b-2 border-[#2563eb]"
												: "text-white/40 hover:text-white/60"
										}`}
									>
										{tab.label}
									</button>
								))}
							</div>

							{/* Tab content */}
							<div className="flex-1 overflow-y-auto">
								{rightPanelTab === "layers" && (
									<LayerPanel
										layer={selectedLayer}
										sceneDurationMs={currentScene.durationMs}
										allLayers={currentScene.layers}
										onUpdateLayer={updateLayer}
										onSelectLayer={setSelectedLayerId}
									/>
								)}

								{rightPanelTab === "tools" && (
									<div className="p-3 space-y-4">
										{/* AI Generate */}
										<div className="space-y-2">
											<div className="text-xs text-white/60 font-medium">AI Generate</div>
											<div className="text-[11px] text-white/40 mb-1.5">Design Style</div>
											<div className="grid grid-cols-3 gap-1.5">
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
																: "border-white/5 bg-white/[0.03] hover:bg-white/[0.06] text-white/50"
														}`}
														title={style.description}
													>
														<div
															className="w-full h-4 rounded-sm"
															style={{ background: style.previewGradient }}
														/>
														<span className="text-[11px] truncate w-full text-center">
															{style.name}
														</span>
													</button>
												))}
											</div>
											<textarea
												value={aiPrompt}
												onChange={(e) => setAiPrompt(e.target.value)}
												placeholder="Describe your video..."
												className="w-full h-16 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white/90 placeholder:text-white/25 resize-none focus:outline-none focus:border-[#2563eb]/50"
												onKeyDown={(e) => {
													if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
														e.preventDefault();
														handleAiGenerate();
													}
													e.stopPropagation();
												}}
											/>
											<button
												onClick={handleAiGenerate}
												disabled={!aiPrompt.trim() || isAiGenerating}
												className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs disabled:opacity-50"
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

										{/* Regenerate (AI Cinematic only) */}
										{aiComposition && (
											<div className="space-y-2 pt-2 border-t border-white/5">
												<div className="text-xs text-white/60 font-medium">Regenerate</div>
												<input
													type="text"
													value={regenInput}
													onChange={(e) => setRegenInput(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === "Enter" && !isRegenerating) {
															e.preventDefault();
															handleRegenerate(regenInput);
														}
													}}
													placeholder="Make it more dramatic..."
													disabled={isRegenerating}
													className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50 disabled:opacity-40"
												/>
												<button
													onClick={() => handleRegenerate(regenInput)}
													disabled={isRegenerating}
													className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs disabled:opacity-40"
												>
													{isRegenerating ? (
														<Loader2 size={12} className="animate-spin" />
													) : (
														<RotateCcw size={12} />
													)}
													Regenerate
												</button>
											</div>
										)}

										{/* Polish & Critique */}
										<div className="space-y-2 pt-2 border-t border-white/5">
											<div className="text-xs text-white/60 font-medium">Enhance</div>
											<button
												onClick={() => handlePolish(false)}
												disabled={isPolishing || project.scenes.length === 0}
												className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-amber-400/70 hover:text-amber-300 hover:bg-amber-400/10 transition-colors text-xs disabled:opacity-40"
											>
												{isPolishing ? (
													<Loader2 size={12} className="animate-spin" />
												) : (
													<Wand2 size={12} />
												)}
												Quick Polish
											</button>
											<button
												onClick={() => handlePolish(true)}
												disabled={isPolishing || project.scenes.length === 0}
												className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-purple-400/70 hover:text-purple-300 hover:bg-purple-400/10 transition-colors text-xs disabled:opacity-40"
											>
												<Sparkles size={12} />
												AI Polish
											</button>
											<button
												onClick={handleCritique}
												disabled={isCritiquing || project.scenes.length === 0}
												className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-teal-400/70 hover:text-teal-300 hover:bg-teal-400/10 transition-colors text-xs disabled:opacity-40"
											>
												{isCritiquing ? (
													<Loader2 size={12} className="animate-spin" />
												) : (
													<Eye size={12} />
												)}
												Critique & Fix
											</button>
											{aiComposition && (
												<button
													onClick={handleVisionReview}
													disabled={isVisionReviewing}
													className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors text-xs disabled:opacity-40"
												>
													{isVisionReviewing ? (
														<Loader2 size={12} className="animate-spin" />
													) : (
														<Eye size={12} />
													)}
													Vision Review {visionScore !== null ? `(${visionScore}/10)` : ""}
												</button>
											)}
										</div>
										{/* Lottie Browser */}
										<div className="space-y-2 pt-2 border-t border-white/5">
											<div className="text-xs text-white/60 font-medium">LottieFiles Browser</div>
											<LottieBrowser
												onSelect={(filename) =>
													toast.success(
														`Lottie downloaded: ${filename}. Add it as a layer in the Scenes tab.`,
													)
												}
											/>
										</div>
									</div>
								)}

								{rightPanelTab === "background" && (
									<div className="p-3 space-y-3">
										<div className="text-xs text-white/60 font-medium">Scene Background</div>
										<div className="flex items-center gap-2">
											<span className="text-[11px] text-white/40">Solid Color</span>
											<input
												type="color"
												value={
													currentScene.background.startsWith("#")
														? currentScene.background
														: "#09090b"
												}
												onChange={(e) => handleBackgroundChange(e.target.value)}
												className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent"
											/>
										</div>
										<AnimatedBackgroundPicker
											selected={currentScene.background}
											onSelect={handleBackgroundChange}
										/>
									</div>
								)}

								{rightPanelTab === "plan" && scenePlan && (
									<div className="flex-1 overflow-y-auto p-3 space-y-3">
										<div className="text-xs text-white/60 font-medium">
											Scenes ({scenePlan.scenes.length})
										</div>
										{scenePlan.scenes.map((scene, i) => (
											<div
												key={i}
												className="p-3 rounded-lg bg-white/[0.03] border border-white/5 space-y-2"
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1">
														<span className="text-[11px] text-white/30 font-medium">
															Scene {i + 1}
														</span>
														<button
															onClick={() => moveSceneInPlan(i, "up")}
															disabled={i === 0}
															className="text-[11px] text-white/20 hover:text-white/50 disabled:opacity-20"
														>
															▲
														</button>
														<button
															onClick={() => moveSceneInPlan(i, "down")}
															disabled={i === scenePlan.scenes.length - 1}
															className="text-[11px] text-white/20 hover:text-white/50 disabled:opacity-20"
														>
															▼
														</button>
														<button
															onClick={() => deleteSceneFromPlan(i)}
															disabled={scenePlan.scenes.length <= 1}
															className="text-[11px] text-red-400/30 hover:text-red-400/70 disabled:opacity-20 ml-1"
														>
															✕
														</button>
													</div>
													<select
														value={scene.background}
														onChange={(e) => updateScenePlan(i, { background: e.target.value })}
														className="w-24 text-[11px] bg-[#141417] border border-white/10 rounded px-1 py-0.5 text-white/60 [&>option]:bg-[#141417] [&>option]:text-white"
													>
														{BACKGROUND_NAMES.map((bg) => (
															<option key={bg} value={bg}>
																{bg}
															</option>
														))}
													</select>
												</div>
												<SceneLayerEditor scene={scene} sceneIndex={i} onUpdate={updateScenePlan} />
											</div>
										))}
										{/* Add Scene button */}
										<button
											onClick={() => addSceneToPlan(scenePlan.scenes.length - 1)}
											className="w-full py-2 rounded-lg border-2 border-dashed border-white/10 hover:border-[#2563eb]/40 text-white/30 hover:text-white/50 text-xs transition-colors"
										>
											+ Add Scene
										</button>
									</div>
								)}

								{rightPanelTab === "code" && aiComposition && (
									<div className="flex flex-col h-full">
										<div className="flex items-center justify-between p-3 border-b border-white/5">
											<span className="text-xs text-white/60 font-medium">Composition Code</span>
											<button
												onClick={() => {
													const textarea = document.getElementById(
														"ai-code-editor",
													) as HTMLTextAreaElement;
													if (textarea && textarea.value !== aiComposition.code) {
														setAiComposition({ ...aiComposition, code: textarea.value });
														(project as any)._aiCode = textarea.value;
														toast.success("Code updated — preview refreshed");
													}
												}}
												className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
											>
												Apply Changes
											</button>
										</div>
										<textarea
											id="ai-code-editor"
											defaultValue={aiComposition.code}
											spellCheck={false}
											className="flex-1 w-full bg-[#0a0a0c] text-[11px] text-white/80 font-mono p-3 resize-none focus:outline-none leading-relaxed"
											style={{ tabSize: 2 }}
											onKeyDown={(e) => e.stopPropagation()}
										/>
									</div>
								)}

								{rightPanelTab === "music" && (
									<div className="p-3 space-y-3">
										<div className="text-xs text-white/60 font-medium">Background Music</div>
										{musicPath && (
											<div className="space-y-2">
												<div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
													<Music size={12} />
													Track loaded
												</div>
												<MusicPreviewPlayer audioPath={musicPath} />
												<button
													onClick={() => setMusicPath(null)}
													className="w-full text-left px-2 py-1.5 rounded text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors"
												>
													Remove music
												</button>
											</div>
										)}
										<div className="text-[11px] text-white/30 font-medium mt-2">
											AI Generate (MiniMax)
										</div>
										{(["energetic", "ambient", "dramatic", "minimal", "upbeat"] as MusicMood[]).map(
											(mood) => (
												<button
													key={mood}
													onClick={() => handleGenerateMusic(mood)}
													disabled={isGeneratingMusic}
													className="w-full text-left px-2 py-1.5 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors capitalize disabled:opacity-40"
												>
													{isGeneratingMusic ? (
														<span className="flex items-center gap-2">
															<Loader2 size={10} className="animate-spin" />
															Generating...
														</span>
													) : (
														mood
													)}
												</button>
											),
										)}
									</div>
								)}
							</div>
						</div>
					</Panel>
				</PanelGroup>
			</div>

			{/* ── Bottom: Scene Layer Timeline (AI Cinematic) or Scene Thumbnails */}
			{scenePlan ? (
				<SceneLayerTimeline
					plan={scenePlan}
					currentFrame={seekToFrame ?? 0}
					onSeekToFrame={setSeekToFrame}
					onAddLayer={(si) => {
						// Add a default text layer to the scene
						const newLayer = {
							id: `layer-${Date.now()}`,
							type: "text" as const,
							content: "New Text",
							position: "center" as const,
							size: 50,
							startFrame: 0,
							endFrame: -1,
						};
						const currentLayers = scenePlan.scenes[si]?.layers || [];
						updateScenePlan(si, { layers: [...currentLayers, newLayer] });
					}}
					onSelectLayer={(si, _li) => {
						const startFrame = scenePlan.scenes
							.slice(0, si)
							.reduce((sum, s) => sum + (s.durationFrames || 90), 0);
						setSeekToFrame(startFrame);
					}}
				/>
			) : (
				<SceneTimeline
					scenes={project.scenes}
					selectedIndex={selectedSceneIndex}
					onSelectScene={selectScene}
					onAddScene={addScene}
					onDeleteScene={deleteScene}
					onUpdateTransition={(sceneIndex, transition) => updateScene(sceneIndex, { transition })}
				/>
			)}
		</div>
	);
}
