import {
	ArrowLeft,
	Clock,
	ImagePlus,
	Palette,
	Pause,
	Play,
	RotateCcw,
	Square,
	Trash2,
	Type,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { AnimatedBackgroundPicker } from "@/components/video-editor/AnimatedBackgroundPicker";
import {
	DEFAULT_IMAGE_LAYER,
	DEFAULT_PROJECT,
	DEFAULT_SCENE,
	DEFAULT_SHAPE_LAYER,
	DEFAULT_TEXT_LAYER,
	type Scene,
	type SceneLayer,
	type SceneProject,
} from "@/lib/scene-renderer";
import { LayerPanel } from "./LayerPanel";
import { SceneCanvas } from "./SceneCanvas";
import { SceneTimeline } from "./SceneTimeline";

interface SceneEditorProps {
	onBack: () => void;
}

export function SceneEditor({ onBack }: SceneEditorProps) {
	const [project, setProject] = useState<SceneProject>(DEFAULT_PROJECT);
	const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const currentScene = project.scenes[selectedSceneIndex];
	const selectedLayer = currentScene?.layers.find((l) => l.id === selectedLayerId) ?? null;

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
			// If at end, restart
			if (currentTimeMs >= currentScene.durationMs) {
				setCurrentTimeMs(0);
			}
			setIsPlaying(true);
		}
	}, [isPlaying, currentTimeMs, currentScene.durationMs]);

	const handleTimeUpdate = useCallback(
		(timeMs: number) => {
			if (timeMs >= currentScene.durationMs) {
				setIsPlaying(false);
				setCurrentTimeMs(currentScene.durationMs);
			} else {
				setCurrentTimeMs(timeMs);
			}
		},
		[currentScene.durationMs],
	);

	const resetPlayback = useCallback(() => {
		setCurrentTimeMs(0);
		setIsPlaying(false);
	}, []);

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
			</div>

			{/* ── Main Content Area ────────────────────────────────────── */}
			<div className="flex-1 flex overflow-hidden">
				{/* Center: Canvas + playback controls */}
				<div className="flex-1 flex flex-col min-w-0">
					{/* Canvas */}
					<div className="flex-1 p-4 flex flex-col">
						<SceneCanvas
							scene={currentScene}
							currentTimeMs={currentTimeMs}
							isPlaying={isPlaying}
							selectedLayerId={selectedLayerId}
							onSelectLayer={setSelectedLayerId}
							onTimeUpdate={handleTimeUpdate}
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
							<span className="text-[10px] text-white/50 w-16 text-right font-mono">
								{(currentTimeMs / 1000).toFixed(2)}s / {(currentScene.durationMs / 1000).toFixed(1)}
								s
							</span>
						</div>
					</div>
				</div>

				{/* Right sidebar: Layer properties */}
				<LayerPanel
					layer={selectedLayer}
					sceneDurationMs={currentScene.durationMs}
					allLayers={currentScene.layers}
					onUpdateLayer={updateLayer}
					onSelectLayer={setSelectedLayerId}
				/>
			</div>

			{/* ── Bottom: Scene Timeline ────────────────────────────────── */}
			<SceneTimeline
				scenes={project.scenes}
				selectedIndex={selectedSceneIndex}
				onSelectScene={selectScene}
				onAddScene={addScene}
				onDeleteScene={deleteScene}
			/>
		</div>
	);
}
