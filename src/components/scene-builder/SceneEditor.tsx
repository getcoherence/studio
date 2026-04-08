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
	Redo2,
	RotateCcw,
	Sparkles,
	Square,
	Trash2,
	Type,
	Undo2,
	Wand2,
} from "lucide-react";
import { Fragment, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { AISettingsButton } from "@/components/ui/AISettingsDialog";
import { Slider } from "@/components/ui/slider";
import { AnimatedBackgroundPicker } from "@/components/video-editor/AnimatedBackgroundPicker";
import {
	generateAiComposition,
	patchHeadline,
	patchSceneBackground,
	patchSceneDuration,
} from "@/lib/ai/aiCinematicEngine";
import { applyCritiqueMutations, critiqueSceneProject } from "@/lib/ai/designCritique";
import { DESIGN_STYLE_LIST, type DesignStyleId } from "@/lib/ai/designStyles";
import { generateSceneProject } from "@/lib/ai/sceneGenerator";
import type { ScenePlan, ScenePlanItem } from "@/lib/ai/scenePlan";
import { BACKGROUND_NAMES, BACKGROUND_PRESETS } from "@/lib/ai/scenePlan";

/** All scene-type template names, in the order the scenes panel should show
 * them. Each one maps to a renderer in scenePlanCompiler (impact-word →
 * renderImpactWord, ghost-hook → renderGhostHook, etc.). */
const BG_EFFECT_OPTIONS = [
	"none",
	// Ambient
	"flowing-lines",
	"drifting-orbs",
	"mesh-shift",
	"aurora",
	"bokeh",
	"liquid-glass",
	// Particles
	"confetti",
	"snow",
	"fireflies",
	"sakura",
	"sparks",
	"money-rain",
	// Grid/geometric
	"pulse-grid",
	"wave-grid",
	"perspective-grid",
	// Texture
	"grain",
	"particle-field",
	"spotlight",
	"gradient-wipe",
	// Gradient
	"flowing-gradient",
] as const;

// Scene types, transitions, effects, and animations are now loaded from
// the plugin registry (see src/lib/plugins/). Adding a plugin automatically
// adds its features to all dropdowns and the template browser.

/** Visual variant options per scene type. Types not listed here have no variants. */
const SCENE_VARIANT_OPTIONS: Partial<Record<ScenePlanItem["type"], string[]>> = {
	"data-flow-network": [
		"circles",
		"timeline-arrows",
		"hex-grid",
		"isometric-blocks",
		"orbital-rings",
	],
	"before-after": ["split-card", "swipe-reveal", "stacked-morph", "toggle-switch"],
	"metrics-dashboard": ["counter-row", "bar-chart", "pie-radial", "ticker-tape"],
	"device-showcase": ["laptop", "phone"],
	"word-slot-machine": ["wheel", "typewriter-swap", "flip-cards", "glitch-swap"],
};

import { pruneLayersForType, seedFieldsForType, syncLayersToData } from "@/lib/ai/sceneLayerSync";
import { pluginRegistry } from "@/lib/plugins";
import {
	compileScenePlan,
	computeSceneOffsets,
	expandSceneToLayers,
} from "@/lib/ai/scenePlanCompiler";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

/** Lazy-loaded Monaco code editor with JSX/TSX syntax highlighting */
function CodeEditor({
	value,
	onChange,
}: {
	value: string;
	onChange: (val: string | undefined) => void;
}) {
	return (
		<Suspense
			fallback={
				<div className="flex-1 bg-[#0a0a0c] p-3 text-[11px] text-white/30 font-mono">
					Loading editor...
				</div>
			}
		>
			{/* Stop keyboard events from bubbling to SceneEditor's handler.
			    Also handle clipboard manually for Electron compatibility. */}
			<div
				onKeyDown={(e) => {
					e.stopPropagation();
					// Electron's Monaco doesn't always handle clipboard via the
					// browser API. Manually bridge Ctrl+C/V/X to the clipboard.
					if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
						if (e.key === "c") {
							document.execCommand("copy");
						} else if (e.key === "v") {
							document.execCommand("paste");
						} else if (e.key === "x") {
							document.execCommand("cut");
						} else if (e.key === "a") {
							document.execCommand("selectAll");
						}
					}
				}}
				style={{ height: "100%" }}
			>
				<MonacoEditor
					height="100%"
					language="typescript"
					theme="vs-dark"
					value={value}
					onChange={onChange}
					options={{
						fontSize: 12,
						minimap: { enabled: false },
						lineNumbers: "on",
						scrollBeyondLastLine: false,
						wordWrap: "on",
						tabSize: 2,
						automaticLayout: true,
						padding: { top: 8 },
						contextmenu: true,
					}}
				/>
			</div>
		</Suspense>
	);
}

import { aiPolishSceneProject, polishSceneProject } from "@/lib/ai/scenePolish";
import { reviewCompositionVisually } from "@/lib/ai/visionReview";
import {
	buildMusicPrompt,
	generateCustomMusic,
	generateLyrics,
	MUSIC_MOOD_PRESETS,
	type MusicMood,
	type PromptIngredients,
	type VocalMode,
} from "@/lib/audio/musicCatalog";
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
import { DirectorChat } from "./DirectorChat";
import { LayerPanel } from "./LayerPanel";
import { LottieBrowser } from "./LottieBrowser";
import { SceneCanvas } from "./SceneCanvas";
import { SceneLayerEditor } from "./SceneLayerEditor";
import { SceneTypePicker } from "./SceneTypePicker";
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
	const [collapsedScenes, setCollapsedScenes] = useState<Set<number>>(new Set());
	const [videoPromptScene, setVideoPromptScene] = useState<number | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [isExporting, setIsExporting] = useState(false);
	const [lastExportPath, setLastExportPath] = useState<string | null>(null);
	const [isUploadingYT, setIsUploadingYT] = useState(false);
	const [exportProgress, setExportProgress] = useState<SceneExportProgress | null>(null);
	const [aspectRatio, _setAspectRatio] = useState(() => (project as any)._aspectRatio || "16/9");
	const setAspectRatio = useCallback((ratio: string) => {
		_setAspectRatio(ratio);
		(project as any)._aspectRatio = ratio;
		const res = getResolution(ratio);
		setProject((prev) => ({ ...prev, resolution: res }));
	}, [project]);
	const [aiComposition, setAiComposition] = useState<AiCompositionData | null>(() => {
		const proj = project as any;
		if (project.styleId === "ai-cinematic" && proj._aiCode) {
			return { code: proj._aiCode, screenshots: proj._aiScreenshots || [] };
		}
		return null;
	});
	// ── Undo/Redo refs (functions defined after scenePlan state) ────
	const undoStackRef = useRef<ScenePlan[]>([]);
	const redoStackRef = useRef<ScenePlan[]>([]);
	const lastPushTimeRef = useRef(0);

	const [scenePlan, setScenePlanRaw] = useState<ScenePlan | null>(() => {
		const plan: ScenePlan | null = (project as any)._aiPlan ?? null;
		if (plan) {
			// Ensure every scene has a stable _id for React keys
			for (const scene of plan.scenes) {
				if (!scene._id) scene._id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			}
			// Migration: fix content-dependent headline/subtitle layer IDs
			// (old code used headline-${text.slice(0,10)}, now uses headline-0)
			for (const scene of plan.scenes) {
				if (!scene.layers) continue;
				for (const layer of scene.layers) {
					if (layer.id.startsWith("headline-") && layer.id !== "headline-0") {
						layer.id = "headline-0";
					}
					if (layer.id.startsWith("subtitle-") && layer.id !== "subtitle-0") {
						layer.id = "subtitle-0";
					}
				}
			}
			const accent = plan.accentColor || "#2563eb";
			for (const scene of plan.scenes) {
				// Stamp plan-level assets onto CTA scenes so expandSceneToLayers can generate logo/URL layers
				if (scene.type === "cta") {
					(scene as any)._logoUrl = (scene as any)._logoUrl || plan.logoUrl || null;
					(scene as any)._websiteUrl = (scene as any)._websiteUrl || plan.websiteUrl || null;
				}
				// Always re-expand if layers are empty or missing.
				// Note: we NO LONGER create a "default text layer" fallback when
				// expansion returns empty. For scene types like word-slot-machine
				// that render their own content (slotMachineWords, iconItems, etc.)
				// the fallback layer was getting rendered as an extras overlay and
				// colliding with the primary content on screen. An empty layers
				// array is fine — the renderer picks up data from scene fields.
				if (!scene.layers || scene.layers.length === 0) {
					scene.layers = expandSceneToLayers(scene, accent);
				} else {
					// Quick check: if none of the existing layers match what
					// expandSceneToLayers would produce, the layers are entirely
					// stale (e.g. from a different scene type). Re-expand from scratch.
					const quickFresh = expandSceneToLayers(scene, accent);
					const freshIdSet = new Set(quickFresh.map((l) => l.id));
					const userPrefixes = ["layer-", "l-"];
					const hasAnyValidLayer = scene.layers.some(
						(l) => freshIdSet.has(l.id) || userPrefixes.some((p) => l.id.startsWith(p)),
					);
					if (!hasAnyValidLayer && quickFresh.length > 0) {
						scene.layers = quickFresh;
					} else {
						// Migration: bring older saved projects up to date with the current
						// expandSceneToLayers logic. Two passes:
						//
						//   1. ADD any scene-type-specific layers that are missing
						//      (camera-text words, ghost words, stacked lines, before/after
						//      lines).
						//   2. REMOVE stale layers that shouldn't exist for this scene type
						//      (e.g. headline/subtitle/vignette layers on ghost-hook scenes,
						//      whose renderer only reads scene.ghostWords). Without this,
						//      older projects show ghost rows in the panel that don't
						//      correspond to anything on screen.
						const hasLayerWithPrefix = (prefix: string) =>
							scene.layers!.some((l) => l.id.startsWith(prefix));
						const fresh = expandSceneToLayers(scene, accent);
						const migrationPrefixes: Array<[keyof ScenePlanItem, string]> = [
							["cameraTextWords", "camera-word-"],
							["ghostWords", "ghost-word-"],
							["stackedLines", "stacked-line-"],
							["beforeLines", "before-"],
							["afterLines", "after-"],
							["networkNodes", "network-node-"],
							["metrics", "metric-"],
							["iconItems", "icon-item-"],
							["slotMachineWords", "slot-word-"],
							["scrollingListLines", "scroll-line-"],
							["notifications", "notif-"],
							["chatMessages", "chat-msg-"],
							["browserTabs", "browser-tab-"],
							["appIcons", "app-icon-"],
						];
						// Also check single-value fields that produce fixed-id layers
						const singleFieldIds: Array<[keyof ScenePlanItem, string]> = [
							["slotMachinePrefix", "slot-prefix"],
							["typewriterText", "typewriter-text"],
							["chatChannel", "chat-channel"],
						];
						for (const [field, layerId] of singleFieldIds) {
							const fieldVal = (scene as any)[field];
							if (fieldVal && !scene.layers!.some((l) => l.id === layerId)) {
								const match = fresh.find((l) => l.id === layerId);
								if (match) scene.layers!.push(match);
							}
						}
						for (const [field, prefix] of migrationPrefixes) {
							const fieldVal = (scene as any)[field];
							if (Array.isArray(fieldVal) && fieldVal.length > 0 && !hasLayerWithPrefix(prefix)) {
								const toAdd = fresh.filter((l) => l.id.startsWith(prefix));
								scene.layers.push(...toAdd);
							}
						}

						// Fix icon-item layers: ensure type is "text" (not "icon-grid")
						// and content has "emoji label" format (not just label).
						if (scene.type === "icon-showcase" && scene.iconItems) {
							for (const l of scene.layers) {
								const m = l.id.match(/^icon-item-(\d+)$/);
								if (m) {
									// Fix type if user accidentally changed it
									if (l.type !== "text") l.type = "text";
									const idx = Number.parseInt(m[1], 10);
									const item = scene.iconItems[idx];
									if (item) {
										// Backfill emoji prefix if content is just the label
										const content = (l.content || "").trim();
										if (content === item.label || !content.includes(" ")) {
											l.content = `${item.icon} ${item.label}`;
										}
									}
								}
							}
						}

						// Backfill CTA layers: logo, button, URL (added post-launch)
						// Only backfill if the scene has NEVER had a cta-pill button layer —
						// meaning it's from before the CTA layer unification. If pill exists,
						// any missing logo/URL was deliberately deleted by the user.
						if (scene.type === "cta") {
							const hasPill = scene.layers!.some((l) => l.id === "cta-pill");
							if (!hasPill) {
								// First time through new system — add all CTA layers
								const logoSrc = plan.logoUrl;
								const urlText = plan.websiteUrl;
								if (logoSrc) {
									scene.layers!.push({ id: "cta-logo", type: "image", content: logoSrc, position: "center", size: 20, startFrame: 0, endFrame: -1, settings: { fontSize: 60 } });
								}
								scene.layers!.push({ id: "cta-pill", type: "button" as any, content: "Get Started", position: "center", size: 30, startFrame: 15, endFrame: -1, settings: { fontSize: 26 } });
								if (urlText) {
									scene.layers!.push({ id: "cta-url", type: "text", content: urlText, position: "center", size: 30, startFrame: 10, endFrame: -1, settings: { fontSize: 24, color: "rgba(255,255,255,0.4)", animation: "none" } });
								}
							}
						}

						// Prune layers whose id doesn't appear in the freshly-expanded set
						// AND aren't user-added (user-added layers have ids like `layer-...`
						// or `l-...` which the expansion never produces). This drops stale
						// headline/subtitle/vignette rows on scene types whose renderer
						// ignores those fields, without touching the user's custom layers.
						const freshIds = new Set(fresh.map((l) => l.id));
						const USER_ADDED_PREFIXES = ["layer-", "l-"];
						const HEADLINE_SKIP_TYPES = new Set([
							"ghost-hook",
							"camera-text",
							"stacked-hierarchy",
							"word-slot-machine",
						]);
						scene.layers = scene.layers.filter((l) => {
							if (freshIds.has(l.id)) return true;
							if (USER_ADDED_PREFIXES.some((p) => l.id.startsWith(p))) return true;
							// Extra safety: drop any text layer whose content matches the
							// scene headline on types that don't render it — catches stale
							// default-* or other ghost layers regardless of id prefix.
							if (
								HEADLINE_SKIP_TYPES.has(scene.type) &&
								l.type === "text" &&
								l.content === scene.headline
							) {
								return false;
							}
							return false;
						});
					}
				} // end hasAnyValidLayer else
			}
		}
		return plan;
	});
	// ── Undo/Redo functions ──
	const MAX_UNDO = 50;

	const setScenePlan = useCallback(
		(newPlan: ScenePlan) => {
			if (scenePlan && newPlan) {
				const now = Date.now();
				if (now - lastPushTimeRef.current > 500) {
					undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), scenePlan];
					redoStackRef.current = [];
					lastPushTimeRef.current = now;
				}
			}
			setScenePlanRaw(newPlan);
		},
		[scenePlan],
	);

	const undo = useCallback(() => {
		const stack = undoStackRef.current;
		if (stack.length === 0 || !scenePlan) return;
		const prev = stack[stack.length - 1];
		undoStackRef.current = stack.slice(0, -1);
		redoStackRef.current = [...redoStackRef.current, scenePlan];
		setScenePlanRaw(prev);
		(project as any)._aiPlan = prev;
		if (!prev.readonly) {
			try {
				const newCode = compileScenePlan(prev);
				setAiComposition((p) => (p ? { ...p, code: newCode } : p));
				(project as any)._aiCode = newCode;
			} catch {
				/* ignore compile errors during undo */
			}
		}
		toast("Undo", { duration: 1500 });
	}, [scenePlan, project]);

	const redo = useCallback(() => {
		const stack = redoStackRef.current;
		if (stack.length === 0 || !scenePlan) return;
		const next = stack[stack.length - 1];
		redoStackRef.current = stack.slice(0, -1);
		undoStackRef.current = [...undoStackRef.current, scenePlan];
		setScenePlanRaw(next);
		(project as any)._aiPlan = next;
		if (!next.readonly) {
			try {
				const newCode = compileScenePlan(next);
				setAiComposition((p) => (p ? { ...p, code: newCode } : p));
				(project as any)._aiCode = newCode;
			} catch {
				/* ignore compile errors during redo */
			}
		}
		toast("Redo", { duration: 1500 });
	}, [scenePlan, project]);
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
	const codeEditorRef = useRef<string>("");
	const [musicPath, _setMusicPath] = useState<string | null>(
		() => (project as any)._musicPath ?? null,
	);
	const [musicVolume, _setMusicVolume] = useState<number>(
		() => (project as any)._musicVolume ?? 0.25,
	);
	const setMusicVolume = useCallback((vol: number) => {
		_setMusicVolume(vol);
		setProject((prev) => ({ ...prev, _musicVolume: vol }) as any);
	}, []);
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
	const [generatingMusicMood, setGeneratingMusicMood] = useState<string | null>(null);
	type MusicLibraryEntry = {
		path: string;
		name: string;
		createdAt: number;
		sizeBytes: number;
		label?: string;
		mood?: string;
		prompt?: string;
	};
	const [musicLibrary, setMusicLibrary] = useState<MusicLibraryEntry[]>([]);
	const [showPromptBuilder, setShowPromptBuilder] = useState(false);
	const [promptIngredients, setPromptIngredients] = useState<PromptIngredients>({});
	const [vocalMode, setVocalMode] = useState<VocalMode>("instrumental");
	const refreshMusicLibrary = useCallback(async () => {
		try {
			const list = await window.electronAPI?.musicLibraryList();
			if (Array.isArray(list)) setMusicLibrary(list);
		} catch (err) {
			console.error("[Music] Failed to list library:", err);
		}
	}, []);
	const [rightPanelTab, setRightPanelTab] = useState<
		"layers" | "tools" | "music" | "background" | "code" | "plan" | "director"
	>(project.styleId === "ai-cinematic" ? "plan" : "layers");
	const [selectedStyle, setSelectedStyle] = useState<DesignStyleId | null>(null);
	const [projectPath, _setProjectPath] = useState<string | null>(
		() => (project as any)._projectPath ?? null,
	);
	const setProjectPath = useCallback(
		(path: string | null) => {
			_setProjectPath(path);
			(project as any)._projectPath = path;
		},
		[project],
	);
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
			// Clear the unsaved changes flag after a successful save
			window.electronAPI?.setHasUnsavedChanges?.(false);
		} catch (err) {
			console.error("[AutoSave] Failed:", err);
		}
	}, []);

	// Auto-save on mount (initial save)
	useEffect(() => {
		doAutoSave(project, projectPath);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounced auto-save on project / plan / composition changes. Plan edits
	// mutate `(project as any)._aiPlan` directly without calling setProject,
	// so we must also watch scenePlan + aiComposition here — otherwise layer
	// edits, headline changes, scene type switches, etc. never trigger a save
	// and get lost on reload. 3s debounce (was 15s) so edits flush quickly
	// during dev iteration.
	useEffect(() => {
		if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
		autoSaveTimerRef.current = setTimeout(() => {
			doAutoSave(project, projectPath);
		}, 3_000);
		return () => {
			if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
		};
	}, [project, projectPath, scenePlan, aiComposition, doAutoSave]);

	// Flush a save on unmount so closing the editor preserves any pending
	// changes that hadn't hit the 3s debounce yet. Uses refs to capture the
	// latest values without re-running the effect on every edit.
	const latestProjectRef = useRef(project);
	const latestPathRef = useRef(projectPath);
	latestProjectRef.current = project;
	latestPathRef.current = projectPath;
	useEffect(() => {
		return () => {
			doAutoSave(latestProjectRef.current, latestPathRef.current);
		};
	}, [doAutoSave]);

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
				window.electronAPI?.setHasUnsavedChanges?.(false);
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

	// Track unsaved changes: mark dirty whenever project/plan/composition
	// changes, and clear after every successful auto-save or manual save.
	useEffect(() => {
		window.electronAPI?.setHasUnsavedChanges?.(true);
	}, [project, scenePlan, aiComposition]);

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
	const [currentPlayerFrame, setCurrentPlayerFrame] = useState(0);
	const currentPlayerFrameRef = useRef(0);
	// Keep ref in sync with state so closures can read the latest frame
	currentPlayerFrameRef.current = currentPlayerFrame;
	const [seekToFrame, setSeekToFrame] = useState<number | undefined>(undefined);

	/** Seek to a scene by index. Uses computeSceneOffsets to account for
	 *  transition overlaps, then adds a small offset so the player lands
	 *  solidly inside the scene (past the incoming transition). */
	const seekToScene = useCallback((plan: ScenePlan, si: number) => {
		const offsets = computeSceneOffsets(plan.scenes);
		const start = offsets[si] ?? 0;
		// Offset a few frames past the transition so the scene's own content is visible
		const nudge = si > 0 ? 12 : 0;
		setSeekToFrame(start + nudge + Math.random() * 0.001);
	}, []);

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
			if (aiComposition) {
				// AI Cinematic: Remotion SSR → H.264 MP4 (background, no UI impact)
				toast.loading("Rendering video... this runs in the background", { id: "export" });

				// Listen for progress updates from the main process
				const unsubProgress = window.electronAPI.onExportRemotionProgress((percent) => {
					setExportProgress({
						phase: "rendering",
						progress: percent,
						currentScene: 0,
						totalScenes: 1,
					});
				});

				try {
					const { estimateAiDuration } = await import("@/lib/remotion/compileCode");
					const durationInFrames = estimateAiDuration(aiComposition.code, 30);

					const exportRes = getResolution(aspectRatio);
					const result = await window.electronAPI.exportRemotion({
						code: aiComposition.code,
						screenshots: aiComposition.screenshots,
						fps: 30,
						durationInFrames,
						fileName: project.name || "export",
						musicPath: musicPath || undefined,
						musicVolume,
						width: exportRes.width,
						height: exportRes.height,
					});

					toast.dismiss("export");

					// Log main-process diagnostics to renderer console
					if (result.logs?.length) {
						console.group("[Remotion Export Diagnostics]");
						for (const line of result.logs) console.log(line);
						console.groupEnd();
					}

					if (result.success) {
						setLastExportPath(result.path || null);
						toast.success(musicPath ? "Video exported with music!" : "Video exported successfully");
					} else if (!result.canceled) {
						toast.error(result.error || "Failed to export video");
					}
				} finally {
					unsubProgress();
				}
			} else {
				// Standard: Canvas 2D export → WebM
				const blob = await exportSceneProject(project, {
					fps: project.fps || 30,
					quality: "high",
					onProgress: setExportProgress,
				});

				const arrayBuffer = await blob.arrayBuffer();
				const fileName = `${project.name || "scene-export"}.webm`;
				const result = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

				if (result.success && result.path && musicPath) {
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
			}
		} catch (err) {
			console.error("Export failed:", err);
			toast.dismiss("export");
			toast.error(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
		} finally {
			setIsExporting(false);
			setExportProgress(null);
		}
	}, [isExporting, aiComposition, project, musicPath]);

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
				_id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				type: "hero-text",
				headline: "",
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
			(project as any)._aiPlan = newPlan;
			if (scenePlan.readonly) return;
			const newCode = compileScenePlan(newPlan);
			setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
			(project as any)._aiCode = newCode;
		},
		[scenePlan, project],
	);

	const deleteSceneFromPlan = useCallback(
		(index: number) => {
			if (!scenePlan || scenePlan.scenes.length <= 1) return;
			const newPlan = { ...scenePlan, scenes: scenePlan.scenes.filter((_, i) => i !== index) };
			setScenePlan(newPlan);
			(project as any)._aiPlan = newPlan;
			if (scenePlan.readonly) return;
			const newCode = compileScenePlan(newPlan);
			setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
			(project as any)._aiCode = newCode;
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
			(project as any)._aiPlan = newPlan;
			if (scenePlan.readonly) return;
			const newCode = compileScenePlan(newPlan);
			setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
			(project as any)._aiCode = newCode;
		},
		[scenePlan, project],
	);

	const recompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ── Readonly-plan code sync ref ──────────────────────────────────
	// For readonly plans (synthesized from AI code), we patch targeted strings
	// in the generated code on each edit instead of recompiling. Problem: the
	// prior implementation captured the "old" value from React state via a
	// useCallback closure, which went stale every keystroke because setScenePlan
	// kept rewriting scenePlan, so by the time the debounce fired the captured
	// "old" value matched the new value and patchHeadline couldn't find its
	// target string in _aiCode.
	//
	// Fix: keep a ref that mirrors the fields currently present in _aiCode,
	// re-sync it when scenePlan identity changes (new generation), and patch
	// synchronously on every updateScenePlan call so the ref + _aiCode stay
	// in lockstep regardless of keystroke rate.
	const syncedAiScenesRef = useRef<ScenePlanItem[] | null>(null);
	const lastSyncedPlanObjRef = useRef<ScenePlan | null>(null);
	if (scenePlan && scenePlan !== lastSyncedPlanObjRef.current) {
		syncedAiScenesRef.current = scenePlan.scenes.map((s) => ({
			...s,
			layers: s.layers?.map((l) => ({
				...l,
				settings: l.settings ? { ...l.settings } : undefined,
			})),
		}));
		lastSyncedPlanObjRef.current = scenePlan;
	}

	const updateScenePlan = useCallback(
		(sceneIndex: number, updates: Partial<ScenePlanItem>) => {
			if (!scenePlan) return;

			const currentScene = scenePlan.scenes[sceneIndex];
			const accent = scenePlan.accentColor || "#2563eb";
			const isTypeSwitch = !!(updates.type && updates.type !== currentScene.type);
			let mergedUpdates: Partial<ScenePlanItem> = { ...updates };

			// 1. Type switch: seed new type's fields, clear stale fields, re-expand layers
			if (isTypeSwitch && updates.type) {
				// Carry text content from current layers to the new type's data fields,
				// but ONLY between types with compatible content shapes (multi-line text).
				// Types like word-slot-machine, notifications, chat need short/structured
				// data that doesn't map from paragraph text.
				const MULTI_LINE_TEXT_TYPES = new Set([
					"scrolling-list", "stacked-hierarchy", "ghost-hook",
					"contrast-pairs", "before-after", "stacked-text",
				]);
				const textFromLayers = (currentScene.layers || [])
					.filter((l) => l.type === "text" && !l._incompatible && l.content)
					.map((l) => l.content);
				const carriedFields: Partial<ScenePlanItem> = {};
				const t = updates.type;
				if (textFromLayers.length > 1 && MULTI_LINE_TEXT_TYPES.has(t)) {
					if (t === "scrolling-list") {
						carriedFields.scrollingListLines = textFromLayers.map((text) => ({ text }));
					} else if (t === "stacked-hierarchy") {
						carriedFields.stackedLines = textFromLayers.map((text) => ({ text, size: 120 }));
					} else if (t === "ghost-hook") {
						carriedFields.ghostWords = textFromLayers.slice(0, 3);
					} else if (t === "contrast-pairs") {
						const pairs: Array<{ statement: string; counter: string }> = [];
						for (let j = 0; j < textFromLayers.length; j += 2) {
							pairs.push({ statement: textFromLayers[j], counter: textFromLayers[j + 1] || "" });
						}
						carriedFields.contrastPairs = pairs;
					} else if (t === "before-after") {
						const half = Math.ceil(textFromLayers.length / 2);
						carriedFields.beforeLines = textFromLayers.slice(0, half);
						carriedFields.afterLines = textFromLayers.slice(half);
					}
				}
				// Smart carry-over for word-slot-machine: first layer → headline,
				// second layer → try to split into words (detect →, |, comma separators)
				if (t === "word-slot-machine" && textFromLayers.length >= 2) {
					carriedFields.headline = textFromLayers[0];
					const listText = textFromLayers[1];
					const delimiters = /\s*[→|,/]\s*/;
					if (delimiters.test(listText)) {
						const words = listText.split(delimiters).map((w) => w.trim()).filter(Boolean);
						if (words.length >= 2) {
							carriedFields.slotMachineWords = words;
							carriedFields.slotMachineSelectedIndex = words.length - 1;
							carriedFields.slotMachinePrefix = "";
						}
					}
				}
				// Smart carry-over for icon-showcase: each text layer → icon item
				if (t === "icon-showcase" && textFromLayers.length >= 2) {
					carriedFields.headline = textFromLayers[0];
					carriedFields.iconItems = textFromLayers.slice(1).map((text) => ({ icon: "✦", label: text }));
				}
				// Always carry first text as headline for simple types
				if (!carriedFields.headline && !currentScene.headline && textFromLayers[0]) {
					carriedFields.headline = textFromLayers[0];
				}
				// Merge carried fields first, then let seedFieldsForType fill any remaining gaps
				mergedUpdates = { ...mergedUpdates, ...carriedFields };
				const sceneForSeed = { ...currentScene, ...mergedUpdates };
				const seeded = seedFieldsForType(updates.type, sceneForSeed);
				mergedUpdates = { ...mergedUpdates, ...seeded };

				const newScene = { ...currentScene, ...mergedUpdates };
				const freshLayers = expandSceneToLayers(newScene, accent);
				// Keep ALL old layers — pruneLayersForType will mark incompatible ones
				// instead of deleting them, so users don't lose content when switching types
				const freshIds = new Set(freshLayers.map((l) => l.id));
				const oldLayers = (currentScene.layers || []).filter(
					(l) => !freshIds.has(l.id), // don't duplicate layers that the new type also generates
				);
				mergedUpdates.layers = [...freshLayers, ...oldLayers];

				const { clearedFields } = pruneLayersForType(
					mergedUpdates.layers,
					updates.type,
					{ ...newScene, layers: mergedUpdates.layers },
					accent,
				);
				mergedUpdates = { ...mergedUpdates, ...clearedFields };
			}

			// 2. Sync layer edits back to scene data fields + trim/re-index
			if (mergedUpdates.layers) {
				const sceneForSync = { ...currentScene, ...mergedUpdates };
				const { fieldUpdates, layers: syncedLayers } = syncLayersToData(
					sceneForSync,
					mergedUpdates.layers,
					scenePlan.scenes[sceneIndex],
				);
				mergedUpdates = { ...mergedUpdates, ...fieldUpdates };
				mergedUpdates.layers = syncedLayers;

				// 3. Prune cross-type layers + clear orphaned data fields
				const effectiveType = mergedUpdates.type || currentScene.type;
				const { layers: prunedLayers, clearedFields } = pruneLayersForType(
					syncedLayers,
					effectiveType,
					{ ...currentScene, ...mergedUpdates } as ScenePlanItem,
					accent,
				);
				mergedUpdates.layers = prunedLayers;
				mergedUpdates = { ...mergedUpdates, ...clearedFields };
			}

			const newPlan = {
				...scenePlan,
				scenes: scenePlan.scenes.map((s, i) => (i === sceneIndex ? { ...s, ...mergedUpdates } : s)),
			};
			setScenePlan(newPlan);
			(project as any)._aiPlan = newPlan;

			// Readonly plans are synthesized from AI code. Instead of recompiling the whole
			// plan (which would clobber the AI's custom components), apply targeted string
			// patches to the generated code for the specific fields the user changed.
			if (scenePlan.readonly) {
				const syncedScene = syncedAiScenesRef.current?.[sceneIndex];
				let currentCode = (project as any)._aiCode as string | undefined;
				if (!syncedScene || !currentCode) return;

				let anyPatch = false;

				// Use mergedUpdates so synced-field changes (headline synced from
				// a headline-layer edit) also get patched into the code.
				if (
					mergedUpdates.headline !== undefined &&
					syncedScene.headline &&
					mergedUpdates.headline !== syncedScene.headline
				) {
					const next = patchHeadline(currentCode, syncedScene.headline, mergedUpdates.headline);
					if (next !== currentCode) {
						currentCode = next;
						anyPatch = true;
					}
					syncedScene.headline = mergedUpdates.headline;
				}
				if (
					mergedUpdates.durationFrames !== undefined &&
					mergedUpdates.durationFrames !== syncedScene.durationFrames
				) {
					const next = patchSceneDuration(currentCode, sceneIndex, mergedUpdates.durationFrames);
					if (next !== currentCode) {
						currentCode = next;
						anyPatch = true;
					}
					syncedScene.durationFrames = mergedUpdates.durationFrames;
				}
				if (
					mergedUpdates.background !== undefined &&
					mergedUpdates.background !== syncedScene.background
				) {
					const next = patchSceneBackground(currentCode, sceneIndex, mergedUpdates.background);
					if (next !== currentCode) {
						currentCode = next;
						anyPatch = true;
					}
					syncedScene.background = mergedUpdates.background;
				}
				// Layer text content edits: diff each text layer against the synced ref.
				if (updates.layers && syncedScene.layers) {
					for (const newLayer of updates.layers) {
						if (newLayer.type !== "text") continue;
						const syncedLayer = syncedScene.layers.find((l) => l.id === newLayer.id);
						if (syncedLayer && syncedLayer.content && syncedLayer.content !== newLayer.content) {
							const next = patchHeadline(currentCode, syncedLayer.content, newLayer.content);
							if (next !== currentCode) {
								currentCode = next;
								anyPatch = true;
							}
							syncedLayer.content = newLayer.content;
						}
					}
				}

				(project as any)._aiCode = currentCode;

				if (anyPatch) {
					if (recompileTimerRef.current) clearTimeout(recompileTimerRef.current);
					recompileTimerRef.current = setTimeout(() => {
						const latestCode = (project as any)._aiCode as string;
						const activeEl = document.activeElement as HTMLElement | null;
						setSeekToFrame(currentPlayerFrameRef.current + Math.random() * 0.001);
						setAiComposition((prev) => (prev ? { ...prev, code: latestCode } : prev));
						requestAnimationFrame(() => {
							if (activeEl && activeEl !== document.activeElement && activeEl.isConnected) {
								activeEl.focus();
							}
						});
					}, 300);
				}
				return;
			}

			// Plan-based path: debounce recompile so typing doesn't steal focus.
			if (recompileTimerRef.current) clearTimeout(recompileTimerRef.current);
			const shouldSeek = isTypeSwitch || updates.durationFrames !== undefined;
			recompileTimerRef.current = setTimeout(() => {
				let newCode: string;
				try {
					newCode = compileScenePlan(newPlan);
				} catch (err) {
					console.error("[compileScenePlan] failed:", err);
					toast.error(`Compile failed: ${err instanceof Error ? err.message : String(err)}`);
					return;
				}
				(project as any)._aiCode = newCode;

				// Save focused element before recompile — the Player remount steals focus
				const activeEl = document.activeElement as HTMLElement | null;
				console.log("[recompile] active element before:", activeEl?.tagName, activeEl?.className?.slice(0, 40));

				if (shouldSeek) {
					const offsets = computeSceneOffsets(newPlan.scenes);
					const start = offsets[sceneIndex] ?? 0;
					const nudge = sceneIndex > 0 ? 12 : 0;
					setSeekToFrame(start + nudge + Math.random() * 0.001);
				} else {
					setSeekToFrame(currentPlayerFrameRef.current + Math.random() * 0.001);
				}
				setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));

				// Restore focus after React processes the state updates
				requestAnimationFrame(() => {
					const nowActive = document.activeElement as HTMLElement | null;
					console.log("[recompile] active element after:", nowActive?.tagName, nowActive?.className?.slice(0, 40));
					if (activeEl && activeEl !== nowActive && activeEl.isConnected) {
						console.log("[recompile] restoring focus to:", activeEl.tagName);
						activeEl.focus();
					}
				});
			}, 500);
		},
		[scenePlan, project],
	);

	// ── Music ────────────────────────────────────────────────────────

	// Refresh the music library whenever the Music tab becomes active so newly
	// generated tracks appear without the user having to reload.
	useEffect(() => {
		if (rightPanelTab === "music") refreshMusicLibrary();
	}, [rightPanelTab, refreshMusicLibrary]);

	const handleGenerateMusic = useCallback(
		async (mood: MusicMood) => {
			setGeneratingMusicMood(mood);
			toast.loading("Composing your soundtrack... this takes ~30 seconds", { id: "music" });
			try {
				// Calculate video duration from project scenes
				const totalMs = project.scenes.reduce((sum, s) => sum + s.durationMs, 0);
				const videoDurationSec = Math.round(totalMs / 1000);
				console.log(
					"[Music] Requesting",
					mood,
					"music for",
					videoDurationSec,
					"second video, vocal:",
					vocalMode,
				);
				// If custom-lyrics mode, read the lyrics textarea
				let lyrics: string | undefined;
				if (vocalMode === "custom-lyrics") {
					const ta = document.getElementById("custom-lyrics-input") as HTMLTextAreaElement;
					lyrics = ta?.value?.trim() || undefined;
				}
				const result = await generateCustomMusic(
					mood,
					undefined,
					videoDurationSec,
					vocalMode,
					lyrics,
				);
				console.log("[Music] Result:", result);
				toast.dismiss("music");
				if (result.success && result.audioPath) {
					setMusicPath(result.audioPath);
					toast.success(`Music generated! (${mood})`);
					refreshMusicLibrary();
					// Auto beat-sync: snap scene durations to detected beats
					if (scenePlan && !scenePlan.readonly) {
						try {
							const { detectBeats, snapScenesToBeats } = await import("@/lib/audio/beatDetection");
							const { bpm, beats } = await detectBeats(result.audioPath);
							const durations = scenePlan.scenes.map((s) => s.durationFrames || 90);
							const snapped = snapScenesToBeats(durations, beats, 30);
							const syncedPlan = {
								...scenePlan,
								scenes: scenePlan.scenes.map((s, i) => ({ ...s, durationFrames: snapped[i] })),
							};
							setScenePlan(syncedPlan);
							(project as any)._aiPlan = syncedPlan;
							const newCode = compileScenePlan(syncedPlan);
							setAiComposition((prev) => prev ? { ...prev, code: newCode } : prev);
							(project as any)._aiCode = newCode;
							console.log(`[AutoBeatSync] Synced to ${bpm} BPM`);
						} catch (err) {
							console.warn("[AutoBeatSync] Beat detection failed, skipping:", err);
						}
					}
				} else {
					console.error("[Music] Generation failed:", result.error);
					toast.error(result.error || "Music generation failed");
				}
			} catch (err) {
				console.error("[Music] Exception:", err);
				toast.dismiss("music");
				toast.error("Music generation failed");
			}
			setGeneratingMusicMood(null);
		},
		[refreshMusicLibrary],
	);

	// ── Auto-music: generate background music on first load ──────────
	// If the scene plan includes a musicMood suggestion from the AI but no
	// music track is loaded yet, automatically generate music in the
	// background. This gives the user a fully-featured video on first open
	// without requiring manual music selection.
	const autoMusicTriggered = useRef(false);
	useEffect(() => {
		if (scenePlan?.musicMood && !musicPath && !autoMusicTriggered.current && !generatingMusicMood) {
			autoMusicTriggered.current = true;
			const mood = scenePlan.musicMood as MusicMood;
			console.log("[AutoMusic] Plan suggests music mood:", mood, "— auto-generating...");
			toast.loading("Generating background music...", { id: "automusic", duration: 60_000 });
			handleGenerateMusic(mood).then(() => {
				toast.dismiss("automusic");
			});
		}
	}, [scenePlan?.musicMood, musicPath, generatingMusicMood, handleGenerateMusic]);

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
			const tag = (e.target as HTMLElement).tagName;
			const isInput = tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
			const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

			// Ctrl+Z / Cmd+Z → undo (works even in inputs)
			if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
				e.preventDefault();
				undo();
				return;
			}
			// Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y → redo
			if (
				(e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
				(e.key === "y" && (e.ctrlKey || e.metaKey))
			) {
				e.preventDefault();
				redo();
				return;
			}
			// Space (no modifiers, not in an input) → toggle playback
			if (e.key === " " && !isInput && !hasModifier) {
				e.preventDefault();
				togglePlayback();
			}
			// Delete/Backspace (not in an input) → delete selected layer
			if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
				deleteSelectedLayer();
			}
			// Escape → deselect layer
			if (e.key === "Escape") {
				setSelectedLayerId(null);
			}
		},
		[togglePlayback, deleteSelectedLayer, undo, redo],
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

				{!aiComposition && (
					<>
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
					</>
				)}

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
				{lastExportPath && (
					<button
						onClick={async () => {
							if (isUploadingYT) return;
							const connected = await window.electronAPI.youtubeIsConnected();
							if (!connected) {
								toast.loading("Connecting to YouTube...", { id: "yt" });
								const auth = await window.electronAPI.youtubeConnect();
								toast.dismiss("yt");
								if (!auth.success) {
									toast.error(auth.error || "YouTube connection failed");
									return;
								}
								toast.success("YouTube connected!");
							}
							const title = project.name || scenePlan?.title || "Untitled Video";
							const privacy = await new Promise<"public" | "unlisted" | "private" | null>((resolve) => {
								// Simple prompt for privacy — could be a proper modal later
								const choice = window.prompt(
									"YouTube upload privacy:\n1 = Public\n2 = Unlisted\n3 = Private\n\nEnter 1, 2, or 3:",
									"2"
								);
								if (!choice) return resolve(null);
								resolve(choice === "1" ? "public" : choice === "3" ? "private" : "unlisted");
							});
							if (!privacy) return;

							setIsUploadingYT(true);
							toast.loading("Uploading to YouTube...", { id: "yt-upload" });
							const unsub = window.electronAPI.onYoutubeUploadProgress((pct) => {
								toast.loading(`Uploading... ${Math.round(pct * 100)}%`, { id: "yt-upload" });
							});
							try {
								const result = await window.electronAPI.youtubeUpload({
									filePath: lastExportPath,
									title,
									description: `Created with Lucid Studio`,
									privacy,
								});
								toast.dismiss("yt-upload");
								if (result.success && result.url) {
									toast.success(`Uploaded! ${result.url}`, { duration: 10000 });
								} else {
									toast.error(result.error || "Upload failed");
								}
							} finally {
								unsub();
								setIsUploadingYT(false);
							}
						}}
						disabled={isUploadingYT}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs disabled:opacity-50"
						title="Upload last export to YouTube"
					>
						{isUploadingYT ? <Loader2 size={14} className="animate-spin" /> : "▶"}
						YouTube
					</button>
				)}
				{lastExportPath && (
					<button
						type="button"
						onClick={async () => {
							// Open file location so user can drag to TikTok/Instagram/LinkedIn
							await window.electronAPI.openExternalUrl(
								`https://www.tiktok.com/upload`
							);
							toast.success("TikTok upload page opened — drag your exported video there", { duration: 5000 });
						}}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-xs"
						title="Open TikTok upload page"
					>
						TikTok
					</button>
				)}
				{lastExportPath && (
					<button
						type="button"
						onClick={async () => {
							await window.electronAPI.openExternalUrl(
								`https://www.instagram.com/reels/create/`
							);
							toast.success("Instagram Reels page opened — upload your exported video", { duration: 5000 });
						}}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-xs"
						title="Open Instagram Reels upload"
					>
						Instagram
					</button>
				)}
				{lastExportPath && (
					<button
						type="button"
						onClick={async () => {
							await window.electronAPI.openExternalUrl(
								`https://www.linkedin.com/video/upload/`
							);
							toast.success("LinkedIn video page opened — upload your exported video", { duration: 5000 });
						}}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-xs"
						title="Open LinkedIn video upload"
					>
						LinkedIn
					</button>
				)}
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

								{[
										{ label: "16:9", ratio: "16/9" },
										{ label: "9:16", ratio: "9/16" },
										{ label: "1:1", ratio: "1/1" },
										{ label: "4:5", ratio: "4/5" },
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
								className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden relative"
							>
								{isExporting && !aiComposition && (
									<div className="absolute inset-0 z-50 bg-[#09090b]/95 flex flex-col items-center justify-center gap-4 rounded-lg">
										<Loader2 size={32} className="animate-spin text-[#2563eb]" />
										<div className="text-white/70 text-sm font-medium">Exporting video...</div>
										{exportProgress && (
											<div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
												<div
													className="h-full bg-[#2563eb] transition-all"
													style={{ width: `${Math.round(exportProgress.progress * 100)}%` }}
												/>
											</div>
										)}
										<div className="text-white/30 text-[10px]">
											Capturing frames — this may take a minute
										</div>
									</div>
								)}
								{previewMode === "remotion" && aiComposition ? (
									<DynamicPreview
										code={aiComposition.code}
										screenshots={aiComposition.screenshots}
										isPlaying={isPlaying}
										musicSrc={musicDataUrl ?? undefined}
										resetSignal={resetSignal}
										seekToFrame={seekToFrame}
										onFrameUpdate={setCurrentPlayerFrame}
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

							{/* Playback controls bar — hidden in Motion mode (Remotion Player has its own) */}
							<div
								className={`flex-shrink-0 flex items-center justify-center gap-4 px-4 py-2 border-t border-white/5 ${previewMode === "remotion" ? "hidden" : ""}`}
							>
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
										...(scenePlan ? [{ id: "director" as const, label: "Director" }] : []),
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

							{/* Undo/Redo toolbar — visible on Scenes tab */}
							{rightPanelTab === "plan" && scenePlan && (
								<div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
									<div className="flex items-center gap-2">
										<span className="text-[11px] text-white/30">
											Scenes ({scenePlan.scenes.length})
										</span>
										{/* Global accent color */}
										<label className="flex items-center gap-1 cursor-pointer" title="Brand accent color — used across all scenes">
											<div className="w-4 h-4 rounded-sm" style={{ background: scenePlan.accentColor || "#2563eb", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)" }} />
											<span className="text-[9px] text-white/25">Brand</span>
											<input
												type="color"
												value={scenePlan.accentColor || "#2563eb"}
												onChange={(e) => {
													const newPlan = { ...scenePlan, accentColor: e.target.value };
													setScenePlan(newPlan);
													(project as any)._aiPlan = newPlan;
													if (!scenePlan.readonly) {
														const newCode = compileScenePlan(newPlan);
														setSeekToFrame(currentPlayerFrameRef.current + Math.random() * 0.001);
														setAiComposition((prev) => prev ? { ...prev, code: newCode } : prev);
														(project as any)._aiCode = newCode;
													}
												}}
												className="w-0 h-0 opacity-0 absolute"
											/>
										</label>
									</div>
									<div className="flex items-center gap-0.5">
										<button
											onClick={undo}
											disabled={undoStackRef.current.length === 0}
											title="Undo (Ctrl+Z)"
											className="p-1 rounded text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
										>
											<Undo2 size={14} />
										</button>
										<button
											onClick={redo}
											disabled={redoStackRef.current.length === 0}
											title="Redo (Ctrl+Shift+Z)"
											className="p-1 rounded text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
										>
											<Redo2 size={14} />
										</button>
									</div>
								</div>
							)}
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
										{/* Scene Templates */}
										{scenePlan && (
											<div className="space-y-2 pt-2 border-t border-white/5">
												<div className="text-xs text-white/60 font-medium">Scene Templates</div>
												<div className="text-[10px] text-white/25 mb-1">Click to add a scene</div>
												<div className="grid grid-cols-2 gap-1.5">
													{pluginRegistry.getSceneTypes().filter(t => t.category !== "legacy").map((t) => (
														<button
															key={t.id}
															onClick={() => {
																addSceneToPlan(scenePlan.scenes.length - 1);
																setTimeout(() => {
																	const idx = scenePlan.scenes.length;
																	updateScenePlan(idx, { type: t.id as any, headline: t.defaultHeadline || "" });
																}, 50);
															}}
															className="flex flex-col items-start gap-1 px-2 py-2 rounded-md border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-colors text-left"
															title={t.description}
														>
															<div className="flex items-center gap-1.5 w-full">
																<span className="text-[14px]">{t.icon}</span>
																<span className="text-[10px] text-white/60 font-medium truncate">{t.name}</span>
															</div>
															<span className="text-[9px] text-white/25 line-clamp-2">{t.description}</span>
														</button>
													))}
												</div>
											</div>
										)}

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
										<div className="flex items-center justify-between mb-1">
											<span className="text-[10px] text-white/20">Scenes ({scenePlan.scenes.length})</span>
											<button
												type="button"
												onClick={() => {
													if (collapsedScenes.size === scenePlan.scenes.length) {
														setCollapsedScenes(new Set());
													} else {
														setCollapsedScenes(new Set(scenePlan.scenes.map((_, idx) => idx)));
													}
												}}
												className="text-[9px] text-white/25 hover:text-white/50"
											>
												{collapsedScenes.size === scenePlan.scenes.length ? "Expand All" : "Collapse All"}
											</button>
										</div>
										{scenePlan.scenes.map((scene, i) => (
											<Fragment key={scene._id || i}>
												<div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 space-y-2">
													{/* Row 1: Scene header with action buttons */}
													<div className="flex items-center justify-between">
														<button
															type="button"
															onClick={() => setCollapsedScenes((prev) => {
																const next = new Set(prev);
																if (next.has(i)) next.delete(i); else next.add(i);
																return next;
															})}
															className="text-[11px] text-white/30 font-medium hover:text-white/50 flex items-center gap-1 cursor-pointer"
															title="Click to collapse/expand this scene"
														>
															<span className="text-[8px] text-white/20">{collapsedScenes.has(i) ? "▶" : "▼"}</span>
															Scene {i + 1}
															{collapsedScenes.has(i) && <span className="text-[9px] text-white/15 ml-1 truncate max-w-[80px]">{scene.type}</span>}
														</button>
														<div className="flex items-center gap-1.5">
															<button
																onClick={() => moveSceneInPlan(i, "up")}
																disabled={i === 0}
																title="Move this scene earlier in the sequence"
																className="text-[13px] text-white/25 hover:text-white/60 disabled:opacity-20 px-0.5"
															>
																▲
															</button>
															<button
																onClick={() => moveSceneInPlan(i, "down")}
																disabled={i === scenePlan.scenes.length - 1}
																title="Move this scene later in the sequence"
																className="text-[13px] text-white/25 hover:text-white/60 disabled:opacity-20 px-0.5"
															>
																▼
															</button>
															<button
																onClick={() => addSceneToPlan(i)}
																title="Insert a new scene after this one"
																className="text-[13px] text-emerald-400/40 hover:text-emerald-400/80 px-0.5"
															>
																+
															</button>
															<button
																onClick={() => deleteSceneFromPlan(i)}
																disabled={scenePlan.scenes.length <= 1}
																title="Delete this scene (can't delete the last remaining scene)"
																className="text-[13px] text-red-400/40 hover:text-red-400/80 disabled:opacity-20 px-0.5"
															>
																✕
															</button>
														</div>
													</div>
													{!collapsedScenes.has(i) && (<>
													{/* Row 2: Scene type, theme, frames */}
													<div className="flex items-center gap-1 flex-wrap">
														<SceneTypePicker
															currentType={scene.type}
															scene={scene}
															accent={scenePlan.accentColor || "#2563eb"}
															onSelect={(typeId) => updateScenePlan(i, { type: typeId as ScenePlanItem["type"] })}
														/>
														{SCENE_VARIANT_OPTIONS[scene.type] && (
															<select
																value={scene.variant || SCENE_VARIANT_OPTIONS[scene.type]![0]}
																onChange={(e) => updateScenePlan(i, { variant: e.target.value })}
																title="Visual variant"
																className="text-[10px] bg-[#141417] border border-white/10 rounded px-1 py-0.5 text-cyan-400/60 [&>option]:bg-[#141417] [&>option]:text-white max-w-[100px] truncate"
															>
																{SCENE_VARIANT_OPTIONS[scene.type]!.map((v) => (
																	<option key={v} value={v}>
																		{v}
																	</option>
																))}
															</select>
														)}
														<input
															type="number"
															value={scene.durationFrames || 90}
															onChange={(e) =>
																updateScenePlan(i, { durationFrames: Number(e.target.value) })
															}
															className="w-12 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/40 focus:outline-none"
															title="Duration in frames (30 = 1 second)"
															step={15}
														/>
														<span
															className="text-[9px] text-white/20"
															title="Frames (30 per second)"
														>
															f
														</span>
													</div>
													{/* Row 3: Background color swatches + custom picker */}
													<div className="space-y-1.5">
														<div className="flex items-center gap-1 flex-wrap">
															{scenePlan.accentColor && (
																<button
																	onClick={() => updateScenePlan(i, { background: scenePlan.accentColor! })}
																	title={`Brand: ${scenePlan.accentColor}`}
																	className={`w-7 h-7 rounded transition-all shrink-0 relative ${scene.background === scenePlan.accentColor ? "ring-2 ring-white ring-offset-1 ring-offset-[#0c0c0f] scale-110" : "hover:scale-105"}`}
																	style={{ background: scenePlan.accentColor, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.5)" }}
																>
																	<span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold drop-shadow-sm">B</span>
																</button>
															)}
															{BACKGROUND_NAMES.map((name) => {
																const css = BACKGROUND_PRESETS[name];
																const active = scene.background === name;
																return (
																	<button
																		key={name}
																		onClick={() => updateScenePlan(i, { background: name })}
																		title={name}
																		className={`w-7 h-7 rounded transition-all shrink-0 ${active ? "ring-2 ring-[#2563eb] ring-offset-1 ring-offset-[#0c0c0f] scale-110" : "hover:scale-105"}`}
																		style={{ background: css, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.5)" }}
																	/>
																);
															})}
															<label title="Custom color" className="relative w-5 h-5 shrink-0">
																<div
																	className={`w-6 h-6 rounded border-2 border-white/20 cursor-pointer flex items-center justify-center text-[9px] text-white/40 hover:border-white/40 ${!BACKGROUND_PRESETS[scene.background] ? "ring-1 ring-[#2563eb]/50" : ""}`}
																	style={{
																		background:
																			scene.background?.startsWith("#") &&
																			!BACKGROUND_PRESETS[scene.background]
																				? scene.background
																				: "transparent",
																	}}
																>
																	+
																</div>
																<input
																	type="color"
																	value={
																		BACKGROUND_PRESETS[scene.background]?.startsWith("#")
																			? BACKGROUND_PRESETS[scene.background]
																			: scene.background?.startsWith("#")
																				? scene.background
																				: "#050505"
																	}
																	onChange={(e) =>
																		updateScenePlan(i, { background: e.target.value })
																	}
																	className="absolute inset-0 opacity-0 cursor-pointer"
																/>
															</label>
														</div>
														{/* Background effect picker */}
														<div className="flex items-center gap-1 flex-wrap">
															<span className="text-[9px] text-white/25 shrink-0">Effect</span>
															{BG_EFFECT_OPTIONS.map((fx) => {
																const active = (scene.backgroundEffect || "none") === fx;
																return (
																	<button
																		key={fx}
																		onClick={() =>
																			updateScenePlan(i, { backgroundEffect: fx as any })
																		}
																		title={fx}
																		className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${active ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/5 text-white/30 hover:text-white/50 hover:border-white/15"}`}
																	>
																		{fx === "none" ? "none" : fx.replace(/-/g, " ")}
																	</button>
																);
															})}
															{scene.backgroundEffect && scene.backgroundEffect !== "none" && (
																<div className="flex items-center gap-1 w-full mt-1">
																	<span className="text-[9px] text-white/20 shrink-0">Opacity</span>
																	<input
																		type="range"
																		min={0}
																		max={100}
																		value={Math.round((scene.backgroundEffectIntensity ?? 0.7) * 100)}
																		onChange={(e) => updateScenePlan(i, { backgroundEffectIntensity: Number(e.target.value) / 100 })}
																		className="flex-1 h-1 accent-violet-500 cursor-pointer"
																	/>
																	<span className="text-[9px] text-white/25 w-7 text-right">{Math.round((scene.backgroundEffectIntensity ?? 0.7) * 100)}%</span>
																</div>
															)}
														</div>
													</div>
													{/* Before/After panel color controls */}
													{scene.type === "before-after" && (
														<div className="flex items-center gap-2 flex-wrap">
															<span className="text-[9px] text-white/25 shrink-0">Panels</span>
															<label className="flex items-center gap-1 cursor-pointer">
																<input
																	type="color"
																	value={scene.beforeBgColor?.startsWith("#") ? scene.beforeBgColor : "#1e1b4b"}
																	onChange={(e) => updateScenePlan(i, { beforeBgColor: e.target.value })}
																	className="w-5 h-5 rounded border border-white/10 bg-transparent p-0 cursor-pointer"
																/>
																<span className="text-[9px] text-white/30">Before</span>
															</label>
															<label className="flex items-center gap-1 cursor-pointer">
																<input
																	type="color"
																	value={scene.afterBgColor?.startsWith("#") ? scene.afterBgColor : "#f0f9ff"}
																	onChange={(e) => updateScenePlan(i, { afterBgColor: e.target.value })}
																	className="w-5 h-5 rounded border border-white/10 bg-transparent p-0 cursor-pointer"
																/>
																<span className="text-[9px] text-white/30">After</span>
															</label>
															<label className="flex items-center gap-1 cursor-pointer">
																<input
																	type="color"
																	value={scene.afterAccentColor || scenePlan.accentColor || "#2563eb"}
																	onChange={(e) => updateScenePlan(i, { afterAccentColor: e.target.value })}
																	className="w-5 h-5 rounded border border-white/10 bg-transparent p-0 cursor-pointer"
																/>
																<span className="text-[9px] text-white/30">Accent</span>
															</label>
														</div>
													)}
													{/* Layer gap control */}
													<div className="flex items-center gap-1">
														<span className="text-[9px] text-white/20 shrink-0">Gap</span>
														<input
															type="range"
															min={0}
															max={80}
															value={scene.layerGap ?? 16}
															onChange={(e) => updateScenePlan(i, { layerGap: Number(e.target.value) })}
															className="flex-1 h-1 accent-violet-500 cursor-pointer"
														/>
														<span className="text-[9px] text-white/25 w-5 text-right">{scene.layerGap ?? 16}</span>
													</div>
													{/* AI Video Clip controls */}
													<div className="flex items-center gap-2 flex-wrap">
														{scene.videoClipPath ? (
															<div className="flex items-center gap-2 w-full">
																<span className="text-[9px] text-emerald-400/70">Video clip attached</span>
																<button
																	type="button"
																	className="text-[9px] text-red-400/50 hover:text-red-400 cursor-pointer"
																	onClick={() => updateScenePlan(i, { videoClipPath: undefined, videoPrompt: undefined })}
																>remove</button>
															</div>
														) : videoPromptScene === i ? (
															<div className="flex flex-col gap-1 w-full">
																<input
																	type="text"
																	defaultValue={scene.videoPrompt || "Smooth tracking shot, cinematic lighting, shallow depth of field"}
																	onKeyDown={async (e) => {
																		if (e.key === "Enter") {
																			const prompt = (e.target as HTMLInputElement).value.trim();
																			if (!prompt) return;
																			setVideoPromptScene(null);
																			updateScenePlan(i, { videoPrompt: prompt });
																			toast.loading("Generating AI video clip... this may take a few minutes", { id: `video-${i}` });
																			try {
																				const result = await window.electronAPI.aiGenerateVideo(prompt, { durationSec: 6 });
																				if (result.success && result.videoPath) {
																					const fileResult = await window.electronAPI.readBinaryFile(result.videoPath);
																					let clipPath = result.videoPath;
																					if (fileResult?.success && fileResult.data) {
																						const blob = new Blob([new Uint8Array(fileResult.data)], { type: "video/mp4" });
																						clipPath = URL.createObjectURL(blob);
																					}
																					updateScenePlan(i, { videoClipPath: clipPath, videoPrompt: prompt, durationFrames: 180 });
																					toast.success("Video clip generated!", { id: `video-${i}` });
																				} else {
																					toast.error(result.error || "Video generation failed", { id: `video-${i}` });
																				}
																			} catch (err) {
																				toast.error(`Video generation error: ${err}`, { id: `video-${i}` });
																			}
																		} else if (e.key === "Escape") {
																			setVideoPromptScene(null);
																		}
																	}}
																	placeholder="Describe the cinematic video clip..."
																	autoFocus
																	className="w-full text-[10px] bg-white/5 border border-violet-500/30 rounded px-2 py-1 text-white/70 placeholder:text-white/20 outline-none focus:border-violet-500/50"
																/>
																<span className="text-[8px] text-white/20">Press Enter to generate, Escape to cancel</span>
															</div>
														) : (
															<button
																type="button"
																className="text-[9px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-300/60 hover:text-violet-300 hover:bg-violet-500/20 cursor-pointer transition-colors"
																onClick={() => setVideoPromptScene(i)}
															>+ AI Video Clip</button>
														)}
													</div>
													<SceneLayerEditor
														scene={scene}
														sceneIndex={i}
														onUpdate={updateScenePlan}
														readonly={!!scenePlan.readonly}
														accentColor={scenePlan.accentColor}
													/>
													</>)}
												</div>
												{/* Transition control between this scene and the next */}
												{i < scenePlan.scenes.length - 1 && (
													<div
														className="flex items-center gap-2 py-1.5 px-3 mx-3 rounded bg-white/[0.02] border border-dashed border-white/5"
														title="Transition between this scene and the next. Type controls the animation, duration controls overlap with the next scene."
													>
														<span className="text-[9px] text-white/20 shrink-0">Transition</span>
														<select
															value={scene.transitionOut || ""}
															onChange={(e) =>
																updateScenePlan(i, {
																	transitionOut: (e.target.value ||
																		undefined) as ScenePlanItem["transitionOut"],
																})
															}
															title="Transition animation to the next scene. Empty = smart auto-pick based on scene types."
															className="text-[10px] bg-[#141417] border border-white/10 rounded px-1 py-0.5 text-amber-400/60 [&>option]:bg-[#141417] [&>option]:text-white flex-1"
														>
															<option value="">Auto</option>
															{pluginRegistry.getTransitions().map((t) => (
																<option key={t.id} value={t.id}>{t.name}</option>
															))}
														</select>
														{["vertical-shutter", "striped-slam", "diagonal-reveal", "color-burst"].includes(scene.transitionOut || "") && (
															<input
																type="color"
																value={scene.transitionColor || scenePlan.accentColor || "#2563eb"}
																onChange={(e) => updateScenePlan(i, { transitionColor: e.target.value })}
																title="Transition color"
																className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent"
															/>
														)}
														<input
															type="number"
															value={scene.transitionDurationFrames || ""}
															onChange={(e) => {
																const v = e.target.value ? Number(e.target.value) : undefined;
																updateScenePlan(i, { transitionDurationFrames: v });
															}}
															placeholder="auto"
															title="Transition overlap in frames (30 = 1 second). This is how many frames the next scene starts before this one ends. More overlap = faster cut. Leave empty for auto."
															className="w-10 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-amber-400/40 focus:outline-none placeholder:text-white/15"
														/>
														<span className="text-[9px] text-white/15">f</span>
													</div>
												)}
											</Fragment>
										))}
										{/* Add Scene button */}
										<button
											onClick={() => addSceneToPlan(scenePlan.scenes.length - 1)}
											title="Insert a new hero-text scene at the end of the sequence. You can change its type, background, duration, and layers after adding."
											className="w-full py-2 rounded-lg border-2 border-dashed border-white/10 hover:border-[#2563eb]/40 text-white/30 hover:text-white/50 text-xs transition-colors"
										>
											+ Add Scene
										</button>
									</div>
								)}

								{rightPanelTab === "director" && (
									<DirectorChat
										scenePlan={scenePlan}
										onMessagesChange={(msgs) => {
											if (scenePlan) {
												const history = msgs.map((m) => ({ role: m.role, content: m.content }));
												const updated = { ...scenePlan, directorHistory: history };
												setScenePlan(updated);
												(project as any)._aiPlan = updated;
											}
										}}
										onPlanUpdate={(updatedPlan) => {
											// Apply the director's updated plan: normalize, expand layers, compile.
											// The director may return scenes with stale auto-generated layers.
											// We must strip ALL auto layers and re-expand from the data fields
											// to avoid duplicates. Only truly user-added layers are preserved.
											const accent = updatedPlan.accentColor || "#2563eb";
											for (const scene of updatedPlan.scenes) {
												const userLayers = (scene.layers || []).filter(
													(l) => l.id.startsWith("l-"),
												);
												scene.layers = undefined as any;
												scene.layers = [...expandSceneToLayers(scene, accent), ...userLayers];
											}
											setScenePlan(updatedPlan);
											(project as any)._aiPlan = updatedPlan;
											try {
												const newCode = compileScenePlan(updatedPlan);
												setAiComposition((prev) => (prev ? { ...prev, code: newCode } : prev));
												(project as any)._aiCode = newCode;
											} catch (err) {
												toast.error(
													`Compile failed: ${err instanceof Error ? err.message : String(err)}`,
												);
											}
										}}
									/>
								)}

								{rightPanelTab === "code" && aiComposition && (
									<div className="flex flex-col h-full">
										<div className="flex items-center justify-between p-3 border-b border-white/5">
											<span className="text-xs text-white/60 font-medium">Composition Code</span>
											<button
												onClick={() => {
													const val = codeEditorRef.current;
													if (val && val !== aiComposition.code) {
														setAiComposition({ ...aiComposition, code: val });
														(project as any)._aiCode = val;
														toast.success("Code updated — preview refreshed");
													}
												}}
												className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
											>
												Apply Changes
											</button>
										</div>
										<CodeEditor
											value={aiComposition.code}
											onChange={(val) => {
												codeEditorRef.current = val || "";
											}}
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
												<div className="flex items-center gap-2 px-1">
													<span className="text-[10px] text-white/30 w-12 shrink-0">Volume</span>
													<input
														type="range"
														min={0}
														max={100}
														value={Math.round(musicVolume * 100)}
														onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
														className="flex-1 h-1 accent-[#2563eb] cursor-pointer"
													/>
													<span className="text-[10px] text-white/40 w-8 text-right">
														{Math.round(musicVolume * 100)}%
													</span>
												</div>
												{scenePlan && (
													<button
														onClick={async () => {
															if (!musicPath || !scenePlan) return;
															toast.loading("Detecting beats...", { id: "beats" });
															try {
																const { detectBeats, snapScenesToBeats } = await import("@/lib/audio/beatDetection");
																const { bpm, beats } = await detectBeats(musicPath);
																const durations = scenePlan.scenes.map((s) => s.durationFrames || 90);
																const snapped = snapScenesToBeats(durations, beats, 30);
																const newPlan = {
																	...scenePlan,
																	scenes: scenePlan.scenes.map((s, i) => ({
																		...s,
																		durationFrames: snapped[i],
																	})),
																};
																setScenePlan(newPlan);
																(project as any)._aiPlan = newPlan;
																if (!scenePlan.readonly) {
																	const newCode = compileScenePlan(newPlan);
																	setAiComposition((prev) => prev ? { ...prev, code: newCode } : prev);
																	(project as any)._aiCode = newCode;
																}
																toast.dismiss("beats");
																toast.success(`Synced to ${bpm} BPM (${beats.length} beats)`);
															} catch (err) {
																toast.dismiss("beats");
																toast.error(`Beat detection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
															}
														}}
														className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
													>
														<Music size={12} />
														Snap Scenes to Beats
													</button>
												)}
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
										<div className="flex items-center gap-1 mb-1">
											<span className="text-[9px] text-white/25">Vocals:</span>
											{(
												[
													["instrumental", "None"],
													["auto-lyrics", "Auto"],
													["custom-lyrics", "Custom"],
												] as const
											).map(([mode, label]) => (
												<button
													key={mode}
													onClick={() => setVocalMode(mode)}
													title={
														mode === "instrumental"
															? "Pure instrumental — no vocals"
															: mode === "auto-lyrics"
																? "MiniMax auto-generates lyrics from the mood prompt"
																: "Write or generate lyrics first, then create music with them"
													}
													className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
														vocalMode === mode
															? "bg-[#2563eb]/20 border-[#2563eb]/50 text-[#60a5fa]"
															: "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
													}`}
												>
													{label}
												</button>
											))}
										</div>
										{vocalMode === "custom-lyrics" && (
											<div className="space-y-1 mb-2 p-2 rounded bg-white/[0.03] border border-white/5">
												<div className="text-[9px] text-white/30 uppercase tracking-wider">
													Lyrics
												</div>
												<textarea
													id="custom-lyrics-input"
													placeholder={
														"[Verse]\nRecord once, let it flow\n\n[Chorus]\nLucid makes it go"
													}
													onKeyDown={(e) => e.stopPropagation()}
													className="w-full h-24 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-[#2563eb]/50 resize-y font-mono"
												/>
												<div className="flex gap-1">
													<button
														onClick={async () => {
															const desc = scenePlan?.title || "SaaS product teaser";
															toast.loading("Generating lyrics...", { id: "lyrics" });
															const r = await generateLyrics(
																`Short catchy lyrics for a ${desc} promotional video. Keep it under 8 lines. Upbeat and memorable.`,
																desc,
															);
															toast.dismiss("lyrics");
															if (r.success && r.lyrics) {
																const ta = document.getElementById(
																	"custom-lyrics-input",
																) as HTMLTextAreaElement;
																if (ta) ta.value = r.lyrics;
																toast.success(`Lyrics generated: "${r.title || desc}"`);
															} else {
																toast.error(r.error || "Lyrics generation failed");
															}
														}}
														className="flex-1 px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-[10px]"
													>
														AI Generate Lyrics
													</button>
													<button
														onClick={() => {
															const ta = document.getElementById(
																"custom-lyrics-input",
															) as HTMLTextAreaElement;
															if (ta) ta.value = "";
														}}
														className="px-2 py-1 rounded bg-white/5 text-white/30 hover:text-white/60 text-[10px]"
													>
														Clear
													</button>
												</div>
												<div className="text-[9px] text-white/20">
													Use [Verse], [Chorus], [Bridge], [Outro] tags. Then pick a preset below to
													generate music with these lyrics.
												</div>
											</div>
										)}
										<div className="text-[9px] text-white/20 uppercase tracking-wider mt-1 mb-0.5">
											Classic
										</div>
										{MUSIC_MOOD_PRESETS.filter((p) => p.group === "classic").map((preset) => (
											<button
												key={preset.id}
												onClick={() => handleGenerateMusic(preset.id)}
												disabled={generatingMusicMood !== null}
												title={preset.description}
												className="w-full text-left px-2 py-1.5 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
											>
												{generatingMusicMood === preset.id ? (
													<span className="flex items-center gap-2">
														<Loader2 size={10} className="animate-spin" />
														Generating...
													</span>
												) : (
													<div className="flex items-center justify-between gap-2">
														<span>{preset.label}</span>
														<span className="text-[9px] text-white/25 truncate max-w-[170px]">
															{preset.description}
														</span>
													</div>
												)}
											</button>
										))}
										<div className="text-[9px] text-[#60a5fa]/60 uppercase tracking-wider mt-2 mb-0.5">
											SaaS Teaser Styles
										</div>
										{MUSIC_MOOD_PRESETS.filter((p) => p.group === "saas").map((preset) => (
											<button
												key={preset.id}
												onClick={() => handleGenerateMusic(preset.id)}
												disabled={generatingMusicMood !== null}
												title={preset.description}
												className="w-full text-left px-2 py-1.5 rounded text-xs text-white/60 hover:text-white hover:bg-[#2563eb]/10 transition-colors disabled:opacity-40"
											>
												{generatingMusicMood === preset.id ? (
													<span className="flex items-center gap-2">
														<Loader2 size={10} className="animate-spin" />
														Generating...
													</span>
												) : (
													<div className="flex items-center justify-between gap-2">
														<span>{preset.label}</span>
														<span className="text-[9px] text-white/25 truncate max-w-[170px]">
															{preset.description}
														</span>
													</div>
												)}
											</button>
										))}
										<div className="text-[9px] text-pink-400/60 uppercase tracking-wider mt-2 mb-0.5">
											Viral / Catchy Ad Styles
										</div>
										{MUSIC_MOOD_PRESETS.filter((p) => p.group === "viral").map((preset) => (
											<button
												key={preset.id}
												onClick={() => handleGenerateMusic(preset.id)}
												disabled={generatingMusicMood !== null}
												title={preset.description}
												className="w-full text-left px-2 py-1.5 rounded text-xs text-white/60 hover:text-white hover:bg-pink-500/10 transition-colors disabled:opacity-40"
											>
												{generatingMusicMood === preset.id ? (
													<span className="flex items-center gap-2">
														<Loader2 size={10} className="animate-spin" />
														Generating...
													</span>
												) : (
													<div className="flex items-center justify-between gap-2">
														<span>{preset.label}</span>
														<span className="text-[9px] text-white/25 truncate max-w-[170px]">
															{preset.description}
														</span>
													</div>
												)}
											</button>
										))}
										{/* Mix & match prompt builder */}
										<div className="mt-3 pt-2 border-t border-white/5">
											<button
												onClick={() => setShowPromptBuilder((v) => !v)}
												className="w-full flex items-center justify-between text-[11px] text-white/30 hover:text-white/60 transition-colors"
											>
												<span>Mix & Match Builder</span>
												<span className="text-[9px]">{showPromptBuilder ? "▲" : "▼"}</span>
											</button>
											{showPromptBuilder && (
												<div className="mt-2 space-y-2">
													<div>
														<div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
															Genre
														</div>
														<select
															value={promptIngredients.genre || ""}
															onChange={(e) =>
																setPromptIngredients((p) => ({
																	...p,
																	genre: (e.target.value ||
																		undefined) as PromptIngredients["genre"],
																}))
															}
															className="w-full text-[11px] bg-[#141417] border border-white/10 rounded px-1.5 py-1 text-white/70 [&>option]:bg-[#141417]"
														>
															<option value="">— Any —</option>
															<option value="electronic">Electronic</option>
															<option value="pop">Pop</option>
															<option value="indie">Indie</option>
															<option value="hip-hop">Hip-Hop</option>
															<option value="funk">Funk</option>
															<option value="rock">Rock</option>
															<option value="acoustic">Acoustic</option>
															<option value="cinematic">Cinematic</option>
															<option value="ambient">Ambient</option>
															<option value="world">World / Afrobeat</option>
														</select>
													</div>
													<div className="flex gap-1">
														<div className="flex-1">
															<div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
																Tempo
															</div>
															<select
																value={promptIngredients.tempo || ""}
																onChange={(e) =>
																	setPromptIngredients((p) => ({
																		...p,
																		tempo: (e.target.value ||
																			undefined) as PromptIngredients["tempo"],
																	}))
																}
																className="w-full text-[11px] bg-[#141417] border border-white/10 rounded px-1.5 py-1 text-white/70 [&>option]:bg-[#141417]"
															>
																<option value="">— Any —</option>
																<option value="chill">Chill (~85)</option>
																<option value="mid">Mid (~105)</option>
																<option value="driving">Driving (~120)</option>
																<option value="fast">Fast (~135)</option>
															</select>
														</div>
														<div className="flex-1">
															<div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
																Energy
															</div>
															<select
																value={promptIngredients.energy || ""}
																onChange={(e) =>
																	setPromptIngredients((p) => ({
																		...p,
																		energy: (e.target.value ||
																			undefined) as PromptIngredients["energy"],
																	}))
																}
																className="w-full text-[11px] bg-[#141417] border border-white/10 rounded px-1.5 py-1 text-white/70 [&>option]:bg-[#141417]"
															>
																<option value="">— Any —</option>
																<option value="calm">Calm</option>
																<option value="building">Building</option>
																<option value="high">High</option>
																<option value="explosive">Explosive</option>
															</select>
														</div>
													</div>
													<div>
														<div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
															Vibe
														</div>
														<select
															value={promptIngredients.vibe || ""}
															onChange={(e) =>
																setPromptIngredients((p) => ({
																	...p,
																	vibe: (e.target.value || undefined) as PromptIngredients["vibe"],
																}))
															}
															className="w-full text-[11px] bg-[#141417] border border-white/10 rounded px-1.5 py-1 text-white/70 [&>option]:bg-[#141417]"
														>
															<option value="">— Any —</option>
															<option value="confident">Confident</option>
															<option value="playful">Playful</option>
															<option value="nostalgic">Nostalgic</option>
															<option value="edgy">Edgy</option>
															<option value="warm">Warm</option>
															<option value="mysterious">Mysterious</option>
															<option value="euphoric">Euphoric</option>
														</select>
													</div>
													<div>
														<div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
															Instruments (click to toggle)
														</div>
														<div className="flex flex-wrap gap-1">
															{(
																[
																	["synth-lead", "Synth"],
																	["piano", "Piano"],
																	["electric-guitar", "E-Guitar"],
																	["acoustic-guitar", "Acoustic"],
																	["bass", "Bass"],
																	["drums", "Drums"],
																	["strings", "Strings"],
																	["horns", "Horns"],
																	["whistle", "Whistle"],
																	["hand-claps", "Claps"],
																	["vocal-chops", "Vox Chops"],
																	["marimba", "Marimba"],
																	["glockenspiel", "Glockenspiel"],
																] as const
															).map(([key, label]) => {
																const active = (promptIngredients.instruments || []).includes(key);
																return (
																	<button
																		key={key}
																		onClick={() =>
																			setPromptIngredients((p) => {
																				const cur = p.instruments || [];
																				const next = cur.includes(key)
																					? cur.filter((x) => x !== key)
																					: [...cur, key];
																				return { ...p, instruments: next };
																			})
																		}
																		className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
																			active
																				? "bg-[#2563eb]/20 border-[#2563eb]/50 text-[#60a5fa]"
																				: "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
																		}`}
																	>
																		{label}
																	</button>
																);
															})}
														</div>
													</div>
													<div>
														<div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
															Reference (optional)
														</div>
														<input
															type="text"
															value={promptIngredients.reference || ""}
															onChange={(e) =>
																setPromptIngredients((p) => ({
																	...p,
																	reference: e.target.value || undefined,
																}))
															}
															onKeyDown={(e) => e.stopPropagation()}
															placeholder="e.g. Bruno Mars Uptown Funk"
															className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#2563eb]/50"
														/>
													</div>
													<button
														onClick={async () => {
															const videoDurationSec = Math.round(
																project.scenes.reduce((s, sc) => s + sc.durationMs, 0) / 1000,
															);
															const prompt = buildMusicPrompt(
																promptIngredients,
																videoDurationSec || 20,
															);
															toast.loading("Generating from your mix...", { id: "mixmusic" });
															const r = await generateCustomMusic(
																"custom" as any,
																prompt,
																videoDurationSec,
															);
															toast.dismiss("mixmusic");
															if (r.success && r.audioPath) {
																setMusicPath(r.audioPath);
																toast.success("Mix generated!");
																refreshMusicLibrary();
															} else {
																toast.error(r.error || "Failed");
															}
														}}
														disabled={generatingMusicMood !== null}
														className="w-full px-2 py-1.5 rounded bg-[#2563eb]/20 text-[#60a5fa] hover:bg-[#2563eb]/30 text-[11px] font-medium disabled:opacity-40"
													>
														Generate from Mix
													</button>
												</div>
											)}
										</div>
										{/* Custom music prompt */}
										<div className="mt-3 pt-2 border-t border-white/5">
											<div className="text-[11px] text-white/30 mb-1">Custom Prompt</div>
											<div className="flex gap-1">
												<input
													type="text"
													id="custom-music-prompt"
													placeholder="Upbeat tech video with synths..."
													onKeyDown={(e) => e.stopPropagation()}
													className="flex-1 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#2563eb]/50"
												/>
												<button
													onClick={async () => {
														const input = document.getElementById(
															"custom-music-prompt",
														) as HTMLInputElement;
														if (!input?.value.trim()) return;
														toast.loading("Generating...", { id: "cmusic" });
														const r = await generateCustomMusic(
															"custom" as any,
															input.value.trim(),
															Math.round(
																project.scenes.reduce((s, sc) => s + sc.durationMs, 0) / 1000,
															),
														);
														toast.dismiss("cmusic");
														if (r.success && r.audioPath) {
															setMusicPath(r.audioPath);
															toast.success("Custom music generated!");
															refreshMusicLibrary();
														} else {
															toast.error(r.error || "Failed");
														}
													}}
													className="px-2 py-1.5 rounded bg-[#2563eb]/20 text-[#60a5fa] hover:bg-[#2563eb]/30 text-[11px] whitespace-nowrap"
												>
													Go
												</button>
											</div>
										</div>
										{/* Library of previously generated tracks */}
										{musicLibrary.length > 0 && (
											<div className="mt-3 pt-2 border-t border-white/5">
												<div className="flex items-center justify-between mb-1">
													<div className="text-[11px] text-white/30 font-medium">
														Library ({musicLibrary.length})
													</div>
													<button
														onClick={refreshMusicLibrary}
														className="text-[10px] text-white/20 hover:text-white/50"
														title="Refresh library"
													>
														⟳
													</button>
												</div>
												<div className="space-y-1 max-h-64 overflow-y-auto">
													{musicLibrary.map((entry) => {
														const isCurrent = musicPath === entry.path;
														const displayLabel = entry.label || entry.mood || entry.name;
														const when = new Date(entry.createdAt).toLocaleDateString(undefined, {
															month: "short",
															day: "numeric",
															hour: "numeric",
															minute: "2-digit",
														});
														return (
															<div
																key={entry.path}
																className={`group flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors ${
																	isCurrent
																		? "bg-emerald-500/10 border border-emerald-500/30"
																		: "bg-white/[0.02] border border-white/5 hover:border-white/15"
																}`}
															>
																<button
																	onClick={() => setMusicPath(entry.path)}
																	title={entry.prompt || displayLabel}
																	className="flex-1 text-left min-w-0"
																>
																	<div className="text-white/70 truncate capitalize">
																		{displayLabel}
																	</div>
																	<div className="text-[9px] text-white/25">{when}</div>
																</button>
																<button
																	onClick={async () => {
																		const r = await window.electronAPI?.musicLibraryDelete(
																			entry.path,
																		);
																		if (r?.success) {
																			if (musicPath === entry.path) setMusicPath(null);
																			refreshMusicLibrary();
																		} else {
																			toast.error(r?.error || "Failed to delete");
																		}
																	}}
																	title="Delete from library"
																	className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400/50 hover:text-red-400 px-1 transition-opacity"
																>
																	✕
																</button>
															</div>
														);
													})}
												</div>
											</div>
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
					currentFrame={currentPlayerFrame}
					musicLabel={
						musicPath
							? musicPath
									.split(/[\\/]/)
									.pop()
									?.replace(/\.[^.]+$/, "") || "Music"
							: undefined
					}
					onSeekToFrame={(f) => setSeekToFrame(f + Math.random() * 0.001)}
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
					onSelectLayer={(si, li) => {
						seekToScene(scenePlan, si);
						// Switch the right panel to the plan tab if it isn't already,
						// then scroll the matching layer row into view + highlight it
						// briefly so the user can see where it landed.
						setRightPanelTab("plan");
						// Delay until after the panel renders (especially if we just
						// switched tabs), then find and scroll the layer row.
						setTimeout(() => {
							const el = document.querySelector<HTMLElement>(`[data-layer-row="${si}-${li}"]`);
							if (!el) return;
							el.scrollIntoView({ behavior: "smooth", block: "center" });
							// Brief highlight
							el.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
							const prevBoxShadow = el.style.boxShadow;
							const prevBorder = el.style.borderColor;
							el.style.boxShadow = "0 0 0 2px rgba(37,99,235,0.6)";
							el.style.borderColor = "rgba(37,99,235,0.6)";
							setTimeout(() => {
								el.style.boxShadow = prevBoxShadow;
								el.style.borderColor = prevBorder;
							}, 900);
						}, 60);
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
