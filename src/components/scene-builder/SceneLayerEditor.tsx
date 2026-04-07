// ── Scene Layer Editor ──────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneLayer, ScenePlanItem } from "@/lib/ai/scenePlan";
import { pluginRegistry } from "@/lib/plugins";

/**
 * Text input that maintains local state during typing and only pushes
 * to the parent after a debounce or on blur. Prevents the full
 * sync/recompile pipeline from stealing focus on every keystroke.
 */
function DebouncedInput({
	value,
	onChange,
	debounceMs = 600,
	...props
}: {
	value: string;
	onChange: (val: string) => void;
	debounceMs?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
	// Use an uncontrolled input with a ref to completely avoid React
	// re-render cycles stealing the cursor. The parent's value prop only
	// sets the initial value and updates when the input isn't focused.
	const inputRef = useRef<HTMLInputElement>(null);
	const focusedRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>();
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const lastPushedRef = useRef(value);

	// Sync external value (undo/redo, parent changes) only when unfocused
	useEffect(() => {
		if (!focusedRef.current && inputRef.current && value !== lastPushedRef.current) {
			inputRef.current.value = value;
			lastPushedRef.current = value;
		}
	}, [value]);

	const handleInput = () => {
		const val = inputRef.current?.value ?? "";
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			lastPushedRef.current = val;
			onChangeRef.current(val);
		}, debounceMs);
	};

	const handleFocus = () => { focusedRef.current = true; };
	const handleBlur = () => {
		focusedRef.current = false;
		clearTimeout(timerRef.current);
		const val = inputRef.current?.value ?? "";
		if (val !== lastPushedRef.current) {
			lastPushedRef.current = val;
			onChangeRef.current(val);
		}
	};

	return (
		<input
			{...props}
			ref={inputRef}
			defaultValue={value}
			onInput={handleInput}
			onFocus={handleFocus}
			onBlur={handleBlur}
		/>
	);
}

/** Curated icon palette for icon-showcase / app-icon-cloud layers */
const ICON_PALETTE = [
	"⚡",
	"🎯",
	"🔒",
	"✨",
	"🚀",
	"💡",
	"📊",
	"📈",
	"🔄",
	"🏆",
	"💬",
	"📧",
	"🛡️",
	"⚙️",
	"🔔",
	"🌐",
	"📱",
	"💻",
	"🎨",
	"🤖",
	"📋",
	"🔍",
	"📦",
	"🧩",
	"💰",
	"❤️",
	"🕐",
	"📡",
	"🎥",
	"🧠",
	"✅",
	"⭐",
	"🔥",
	"💎",
	"🎓",
	"📝",
	"🔗",
	"👥",
	"🏗️",
	"📌",
];

// Timeline/editor run at fixed 30fps; convert between frames (stored) and
// seconds (user-facing).
const FPS = 30;
const framesToSeconds = (f: number) => (f < 0 ? f : f / FPS);
const secondsToFrames = (s: number) => (s < 0 ? -1 : Math.round(s * FPS));

interface SceneLayerEditorProps {
	scene: ScenePlanItem;
	sceneIndex: number;
	onUpdate: (sceneIndex: number, updates: Partial<ScenePlanItem>) => void;
	/** When true, the scene plan was synthesized from AI-generated code and
	 * only text content edits can be reliably patched back into the source.
	 * Non-patchable controls (animation, position, size, timing, color) are
	 * rendered disabled so users don't think their change will apply. */
	readonly?: boolean;
}

const POSITIONS = [
	{ value: "center", label: "Center" },
	{ value: "top-left", label: "Top-L" },
	{ value: "top-right", label: "Top-R" },
	{ value: "bottom-left", label: "Bot-L" },
	{ value: "bottom-right", label: "Bot-R" },
	{ value: "top", label: "Top" },
	{ value: "bottom", label: "Bottom" },
];

/** Coerce any CSS color (alpha-hex, rgba, named) to 6-digit hex for <input type="color"> */
function toColorInput(val: string | undefined, fallback: string): string {
	if (!val) return fallback;
	// Already a valid 6-digit hex
	if (/^#[0-9a-fA-F]{6}$/.test(val)) return val;
	// 8-digit hex (alpha) — strip alpha
	if (/^#[0-9a-fA-F]{8}$/.test(val)) return val.slice(0, 7);
	// 3-digit hex — expand
	if (/^#[0-9a-fA-F]{3}$/.test(val))
		return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
	return fallback;
}

export function SceneLayerEditor({ scene, sceneIndex, onUpdate, readonly }: SceneLayerEditorProps) {
	const layers = scene.layers || [];
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);
	const ro = !!readonly;
	const roTitle = ro ? "AI-generated — edit code tab for advanced changes" : undefined;

	const addLayer = () => {
		// Create the right kind of layer for the scene type so it integrates
		// with the renderer instead of being an independent overlay.
		const nextIdx = (prefix: string) => layers.filter((l) => l.id.startsWith(prefix)).length;

		const SCENE_TYPE_LAYER: Record<string, () => SceneLayer> = {
			"ghost-hook": () => ({
				id: `ghost-word-${nextIdx("ghost-word-")}`,
				type: "text",
				content: "New word",
				position: "center",
				size: 40,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 100, animation: "words" },
			}),
			"camera-text": () => ({
				id: `camera-word-${nextIdx("camera-word-")}`,
				type: "text",
				content: "New",
				position: "center",
				size: 30,
				startFrame: nextIdx("camera-word-") * 10,
				endFrame: -1,
				settings: { fontSize: 80, animation: "words" },
			}),
			"stacked-hierarchy": () => ({
				id: `stacked-line-${nextIdx("stacked-line-")}`,
				type: "text",
				content: "New line",
				position: "center",
				size: 60,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 120, animation: "drop" },
			}),
			"app-icon-cloud": () => ({
				id: `app-icon-${nextIdx("app-icon-")}`,
				type: "icon-grid" as any,
				content: "✨ New",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 28, animation: "words" },
			}),
			"icon-showcase": () => ({
				id: `icon-item-${nextIdx("icon-item-")}`,
				type: "icon-grid" as any,
				content: "✨ New",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 28, animation: "words" },
			}),
			"data-flow-network": () => ({
				id: `network-node-${nextIdx("network-node-")}`,
				type: "text",
				content: "Node",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 24, animation: "words" },
			}),
			"before-after": () => ({
				id: `after-${nextIdx("after-")}`,
				type: "text",
				content: "New line",
				position: "center",
				size: 30,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 58, animation: "words" },
			}),
			"scrolling-list": () => ({
				id: `scroll-line-${nextIdx("scroll-line-")}`,
				type: "text",
				content: "New step.",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 48, animation: "words" },
			}),
			"notification-chaos": () => ({
				id: `notif-${nextIdx("notif-")}`,
				type: "text",
				content: "New notification",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 16, animation: "words" },
			}),
			"browser-tabs-chaos": () => ({
				id: `browser-tab-${nextIdx("browser-tab-")}`,
				type: "text",
				content: "example.com",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 14, animation: "words" },
			}),
			"word-slot-machine": () => ({
				id: `slot-word-${nextIdx("slot-word-")}`,
				type: "text",
				content: "Option",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 100, animation: "words" },
			}),
			"chat-narrative": () => ({
				id: `chat-msg-${nextIdx("chat-msg-")}`,
				type: "text",
				content: "New message",
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 16, animation: "words" },
			}),
		};

		const factory = SCENE_TYPE_LAYER[scene.type];
		const newLayer: SceneLayer = factory
			? factory()
			: {
					id: `l-${Date.now()}`,
					type: "text",
					content: "New Layer",
					position: "center",
					size: 80,
					startFrame: 0,
					endFrame: -1,
					settings: { fontSize: 100, animation: "words" },
				};
		onUpdate(sceneIndex, { layers: [...layers, newLayer] });
	};

	const updateLayer = (li: number, updates: Partial<SceneLayer>) => {
		const newLayers = layers.map((l, i) => (i === li ? { ...l, ...updates } : l));
		onUpdate(sceneIndex, { layers: newLayers });
	};

	/** When the user changes a layer's type, reset its content to a sensible
	 * default for the new type so it actually renders in the video. */
	const changeLayerType = (li: number, newType: SceneLayer["type"]) => {
		const defaults: Record<string, string> = {
			text: "New Text",
			shape: "light-streak",
			lottie: "",
			image: "",
			card: JSON.stringify({ title: "New Card", description: "Description" }),
			"icon-grid": "✨ Feature",
			"word-carousel": JSON.stringify({
				prefix: "Looks like",
				words: ["A", "B", "C"],
				selectedIndex: 0,
			}),
			"metric-counter": JSON.stringify({ value: 100, label: "Users", suffix: "%" }),
			"progress-bar": JSON.stringify({ label: "Progress", value: 75 }),
			divider: "─",
		};
		updateLayer(li, {
			type: newType,
			content: defaults[newType] ?? "",
		});
	};

	const SHAPE_VARIANTS = [
		{ value: "light-streak", label: "Light streak" },
		{ value: "vignette", label: "Vignette" },
	];

	const deleteLayer = (li: number) => {
		onUpdate(sceneIndex, { layers: layers.filter((_, i) => i !== li) });
	};

	const moveLayer = useCallback(
		(from: number, to: number) => {
			if (from === to) return;
			const n = [...layers];
			const [moved] = n.splice(from, 1);
			n.splice(to, 0, moved);
			onUpdate(sceneIndex, { layers: n });
		},
		[layers, sceneIndex, onUpdate],
	);

	const handleDragStart = (e: React.DragEvent, i: number) => {
		setDragIndex(i);
		(e.currentTarget as HTMLElement).style.opacity = "0.5";
	};
	const handleDragEnd = (e: React.DragEvent) => {
		(e.currentTarget as HTMLElement).style.opacity = "1";
		setDragIndex(null);
		setDropIndex(null);
	};
	const handleDragOver = (e: React.DragEvent, i: number) => {
		e.preventDefault();
		setDropIndex(i);
	};
	const handleDrop = (e: React.DragEvent, to: number) => {
		e.preventDefault();
		if (dragIndex !== null) moveLayer(dragIndex, to);
		setDragIndex(null);
		setDropIndex(null);
	};

	// Parse card content
	const getCard = (layer: SceneLayer) => {
		try {
			return JSON.parse(layer.content);
		} catch {
			return { title: "", description: "" };
		}
	};

	return (
		<div className="space-y-2 pt-2 border-t border-white/5 mt-2">
			<div className="flex items-center justify-between">
				<span
					className="text-[11px] text-white/30"
					title="Editable elements that make up this scene. Primary layers (headline, ghost words, metric values, etc.) sync back to the scene data. Extra layers render as absolute-positioned overlays on top."
				>
					Layers ({layers.length})
				</span>
			</div>
			{ro && (
				<div className="text-[10px] text-white/30 leading-snug">
					AI-generated scene — only text content is editable here. Use the Code tab for advanced
					edits.
				</div>
			)}

			{layers.map((layer, li) => {
				const card = layer.type === "card" ? getCard(layer) : null;

				return (
					<div
						key={layer.id}
						data-layer-row={`${sceneIndex}-${li}`}
						draggable={!ro}
						onDragStart={(e) => !ro && handleDragStart(e, li)}
						onDragEnd={handleDragEnd}
						onDragOver={(e) => !ro && handleDragOver(e, li)}
						onDrop={(e) => !ro && handleDrop(e, li)}
						className={`rounded border p-1.5 space-y-1 transition-colors ${ro ? "" : "cursor-grab active:cursor-grabbing"} ${
							dropIndex === li && dragIndex !== null && dragIndex !== li
								? "border-[#2563eb]/30 bg-[#2563eb]/10"
								: "border-white/5 bg-white/[0.02]"
						}`}
					>
						{/* Row 1: Type + Content/Title + Delete */}
						<div className="flex gap-1 items-center">
							{!ro && (
								<span
									className="text-white/15 cursor-grab text-[11px] select-none"
									title="Drag to reorder"
								>
									⠿
								</span>
							)}
							<select
								value={layer.type}
								onChange={(e) => changeLayerType(li, e.target.value as SceneLayer["type"])}
								disabled={ro}
								title={
									roTitle ??
									"Layer kind. Text = animated string, Card = title+description block, Lottie = JSON animation, Image = URL or screenshots[N], Shape = light-streak/vignette. Changing type resets the content to a default for the new kind."
								}
								className={`w-12 text-[10px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/50 [&>option]:bg-[#141417] [&>option]:text-white ${ro ? "opacity-40 cursor-not-allowed" : ""}`}
							>
								<option value="text">Text</option>
								<option value="card">Card</option>
								<option value="word-carousel">Carousel</option>
								<option value="metric-counter">Counter</option>
								<option value="progress-bar">Progress</option>
								<option value="icon-grid">Icons</option>
								<option value="divider">Divider</option>
								<option value="lottie">Lottie</option>
								<option value="image">Image</option>
								<option value="shape">Shape</option>
							</select>

							{layer.type === "card" ? (
								<DebouncedInput
									value={card?.title || ""}
									onChange={(val) =>
										updateLayer(li, { content: JSON.stringify({ ...card, title: val }) })
									}
									onKeyDown={(e) => e.stopPropagation()}
									disabled={ro}
									title={roTitle ?? "Card title (the bold heading of the card)"}
									className={`flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/60 focus:outline-none ${ro ? "opacity-40 cursor-not-allowed" : ""}`}
									placeholder="Card title"
								/>
							) : layer.type === "shape" ? (
								<select
									value={
										SHAPE_VARIANTS.some((v) => v.value === layer.content)
											? layer.content
											: "light-streak"
									}
									onChange={(e) => updateLayer(li, { content: e.target.value })}
									title="Shape variant. Light streak = animated diagonal glow bar. Vignette = darkened corners for cinematic framing."
									className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/60 focus:outline-none [&>option]:bg-[#141417] [&>option]:text-white"
								>
									{SHAPE_VARIANTS.map((v) => (
										<option key={v.value} value={v.value}>
											{v.label}
										</option>
									))}
								</select>
							) : layer.type === "lottie" ? (
								<DebouncedInput
									value={layer.content}
									onChange={(val) => updateLayer(li, { content: val })}
									onKeyDown={(e) => e.stopPropagation()}
									placeholder="filename.json or https://…"
									title="Lottie JSON source: either a filename from public/lottie/ or a full https:// URL"
									className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/50 focus:outline-none"
								/>
							) : layer.type === "image" ? (
								<>
									<DebouncedInput
										value={layer.content}
										onChange={(val) => updateLayer(li, { content: val })}
										onKeyDown={(e) => e.stopPropagation()}
										placeholder="URL or screenshots[i]"
										title="Image source: an https:// URL, screenshots[N], or upload a file"
										className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/50 focus:outline-none min-w-0"
									/>
									<label
										title="Upload an image file"
										className="shrink-0 w-7 h-7 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[13px] text-white/40 hover:text-white/70 hover:bg-white/10 cursor-pointer transition-colors"
									>
										📁
										<input
											type="file"
											accept="image/*"
											className="hidden"
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (!file) return;
												const reader = new FileReader();
												reader.onload = () => {
													if (typeof reader.result === "string") {
														updateLayer(li, { content: reader.result });
													}
												};
												reader.readAsDataURL(file);
												e.target.value = "";
											}}
										/>
									</label>
								</>
							) : layer.type === "icon-grid" ||
								layer.id.startsWith("icon-item-") ||
								layer.id.startsWith("app-icon-") ? (
								/* Icon layers: emoji picker button + label input */
								<IconLayerInputs layer={layer} li={li} updateLayer={updateLayer} />
							) : (
								<DebouncedInput
									value={layer.content}
									onChange={(val) => updateLayer(li, { content: val })}
									onKeyDown={(e) => e.stopPropagation()}
									title="The text that will render. Primary layers (headline, ghost words, metric labels, etc.) sync this back to the underlying scene field."
									className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/50 focus:outline-none"
								/>
							)}

							{!ro && (
								<button
									onClick={() => deleteLayer(li)}
									title="Delete this layer"
									className="text-[11px] text-red-400/30 hover:text-red-400 px-0.5"
								>
									✕
								</button>
							)}
						</div>

						{/* Row 2: Card description */}
						{layer.type === "card" && (
							<div className="flex gap-1 items-center">
								<DebouncedInput
									value={card?.description || ""}
									onChange={(val) =>
										updateLayer(li, { content: JSON.stringify({ ...card, description: val }) })
									}
									onKeyDown={(e) => e.stopPropagation()}
									disabled={ro}
									title={roTitle}
									className={`flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/40 focus:outline-none ${ro ? "opacity-40 cursor-not-allowed" : ""}`}
									placeholder="Card description"
								/>
								<input
									type="color"
									value={toColorInput(layer.settings?.color, "#16181f")}
									onChange={(e) =>
										updateLayer(li, { settings: { ...layer.settings, color: e.target.value } })
									}
									disabled={ro}
									title={roTitle}
									className={`w-8 h-7 rounded border border-white/10 bg-transparent p-0 ${ro ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
								/>
							</div>
						)}

						{/* Row 2/3: Layout + Timing — hidden for readonly plans */}
						{!ro &&
							(() => {
								// Timing only matters for user-added layers and legacy scene types.
								// Rich scene types (ghost-hook, camera-text, etc.) handle their own
								// timing internally — showing In/Out for their primary layers is misleading.
								const isUserLayer = layer.id.startsWith("layer-") || layer.id.startsWith("l-");
								const LEGACY_TYPES = new Set([
									"hero-text",
									"full-bleed",
									"split-layout",
									"cards",
									"screenshot",
									"cta",
									"glitch-intro",
									"stacked-text",
								]);
								const showTiming = isUserLayer || LEGACY_TYPES.has(scene.type);
								return (
									<div className="flex gap-1 items-center text-[10px]">
										<select
											value={layer.position}
											onChange={(e) =>
												updateLayer(li, { position: e.target.value as SceneLayer["position"] })
											}
											title="Placement within the scene"
											className="text-[10px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-white/40 [&>option]:bg-[#141417] [&>option]:text-white"
										>
											{POSITIONS.map((p) => (
												<option key={p.value} value={p.value}>
													{p.label}
												</option>
											))}
										</select>

										<span className="text-white/20">W%</span>
										<input
											type="number"
											value={layer.size}
											onChange={(e) => updateLayer(li, { size: Number(e.target.value) })}
											title="Width as % of frame"
											className="w-8 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 focus:outline-none"
										/>

										{showTiming && (
											<>
												<span className="text-white/20 ml-1">In</span>
												<input
													type="number"
													step={0.1}
													value={framesToSeconds(layer.startFrame).toFixed(1)}
													onChange={(e) =>
														updateLayer(li, { startFrame: secondsToFrames(Number(e.target.value)) })
													}
													className="w-10 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-400/50 focus:outline-none"
													title="Start time (seconds from scene start)"
												/>
												<span className="text-white/15 text-[9px] -ml-0.5">s</span>

												<span className="text-white/20">Out</span>
												<input
													type="number"
													step={0.1}
													value={
														layer.endFrame === -1 ? -1 : framesToSeconds(layer.endFrame).toFixed(1)
													}
													onChange={(e) => {
														const v = Number(e.target.value);
														updateLayer(li, { endFrame: v < 0 ? -1 : secondsToFrames(v) });
													}}
													className="w-10 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-amber-400/50 focus:outline-none"
													title="End time in seconds (-1 = end of scene)"
												/>
												<span className="text-white/15 text-[9px] -ml-0.5">s</span>
											</>
										)}
									</div>
								);
							})()}

						{/* Row 3: Text animation settings — hidden for readonly plans */}
						{layer.type === "text" && !ro && (
							<div className="flex gap-1 items-center text-[10px]">
								<select
									value={layer.settings?.animation || "chars"}
									onChange={(e) =>
										updateLayer(li, { settings: { ...layer.settings, animation: e.target.value } })
									}
									title="Text animation. Per-Char = letter-by-letter fade, Words = word-by-word entrance, Scale = grow from 0.5x, Clip = diagonal reveal, Gradient = gradient wipe, Glitch = RGB split jitter, Blur = defocus→sharp, Bounce = spring drop, Wave = sinusoidal bob, Typewriter = character reveal with cursor, Staccato = rhythmic punch, Split = top/bottom halves slide together, Drop = fall from above, Scramble = random chars resolving to final, None = static."
									className="text-[10px] bg-[#141417] border border-white/10 rounded px-0.5 py-0.5 text-purple-400/60 [&>option]:bg-[#141417] [&>option]:text-white"
								>
									{pluginRegistry.getAnimations().map((a) => (
										<option key={a.id} value={a.id}>{a.name}</option>
									))}
								</select>
								<span
									className="text-white/20"
									title="Font size in pixels — the actual rendered text size. This is what you want to tweak to make text bigger or smaller."
								>
									Font
								</span>
								<input
									type="number"
									value={layer.settings?.fontSize || 100}
									onChange={(e) =>
										updateLayer(li, {
											settings: { ...layer.settings, fontSize: Number(e.target.value) },
										})
									}
									step={4}
									title="Font size in pixels. 1080p frame is 1920×1080, so 120–200px is a typical headline size."
									className="w-10 px-0.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 focus:outline-none"
								/>
								<input
									type="color"
									value={toColorInput(layer.settings?.color, "#ffffff")}
									onChange={(e) =>
										updateLayer(li, { settings: { ...layer.settings, color: e.target.value } })
									}
									title="Text color. Defaults to white on dark backgrounds, near-black on light ones."
									className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent"
								/>
								<input
									type="text"
									value={layer.settings?.accentWord || ""}
									onChange={(e) =>
										updateLayer(li, {
											settings: { ...layer.settings, accentWord: e.target.value || undefined },
										})
									}
									onKeyDown={(e) => e.stopPropagation()}
									placeholder="Highlight"
									title="Optional word to render in the scene's accent color. Must match exactly (case-sensitive) a word in the text content above."
									className="w-16 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[#60a5fa]/50 focus:outline-none"
								/>
							</div>
						)}
					</div>
				);
			})}
			{!ro && (
				<button
					onClick={addLayer}
					title="Add a new layer to this scene"
					className="w-full py-1.5 rounded-lg border border-dashed border-white/10 hover:border-[#2563eb]/40 text-white/30 hover:text-white/50 text-[11px] transition-colors"
				>
					+ Add Layer
				</button>
			)}
		</div>
	);
}

/** Emoji picker button + label input for icon-item / app-icon layers */
function IconLayerInputs({
	layer,
	li,
	updateLayer,
}: {
	layer: SceneLayer;
	li: number;
	updateLayer: (li: number, updates: Partial<SceneLayer>) => void;
}) {
	const [open, setOpen] = useState(false);
	const raw = (layer.content || "✨").trim();
	const spIdx = raw.indexOf(" ");
	const icon = spIdx > 0 ? raw.slice(0, spIdx) : raw;
	const label = spIdx > 0 ? raw.slice(spIdx + 1) : "";

	return (
		<>
			<div className="relative">
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					title="Pick an icon"
					className="w-8 h-7 rounded bg-white/5 border border-white/10 text-[16px] text-center hover:bg-white/10 hover:border-white/20 transition-colors flex items-center justify-center"
				>
					{icon}
				</button>
				{open && (
					<div
						className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1f] border border-white/15 rounded-lg shadow-xl p-2 grid gap-0.5"
						style={{ gridTemplateColumns: "repeat(8, 1fr)", width: 240 }}
						onMouseLeave={() => setOpen(false)}
					>
						{ICON_PALETTE.map((e) => (
							<button
								key={e}
								type="button"
								onClick={() => {
									updateLayer(li, { content: `${e} ${label}` });
									setOpen(false);
								}}
								className={`w-7 h-7 rounded flex items-center justify-center text-[16px] hover:bg-white/15 transition-colors ${e === icon ? "bg-white/10 ring-1 ring-cyan-400/50" : ""}`}
							>
								{e}
							</button>
						))}
					</div>
				)}
			</div>
			<DebouncedInput
				value={label}
				onChange={(val) => updateLayer(li, { content: `${icon} ${val}` })}
				onKeyDown={(e) => e.stopPropagation()}
				title="Label text shown below the icon"
				className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/50 focus:outline-none"
				placeholder="Label"
			/>
		</>
	);
}
