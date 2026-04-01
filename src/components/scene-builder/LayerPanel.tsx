import { AlignCenter, AlignLeft, AlignRight, ImagePlus, Layers, Type } from "lucide-react";
import { useCallback, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import type {
	AnimationType,
	ImageContent,
	SceneLayer,
	ShapeContent,
	TextContent,
} from "@/lib/scene-renderer";
import { ALL_ANIMATION_TYPES, ANIMATION_TYPE_LABELS } from "@/lib/scene-renderer";
import { cn } from "@/lib/utils";

interface LayerPanelProps {
	layer: SceneLayer | null;
	sceneDurationMs: number;
	allLayers: SceneLayer[];
	onUpdateLayer: (layerId: string, updates: Partial<SceneLayer>) => void;
	onSelectLayer: (layerId: string | null) => void;
}

// ── Small section component ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="space-y-2">
			<div className="text-[10px] uppercase tracking-wider text-white/40 font-medium">{title}</div>
			{children}
		</div>
	);
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-xs text-white/60 flex-shrink-0">{label}</span>
			<div className="flex-1 max-w-[160px]">{children}</div>
		</div>
	);
}

function SmallInput({
	value,
	onChange,
	type = "text",
	...rest
}: {
	value: string | number;
	onChange: (val: string) => void;
	type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type">) {
	return (
		<input
			type={type}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="w-full h-7 px-2 text-xs rounded bg-white/5 border border-white/10 text-white/90 outline-none focus:border-[#2563eb]/50"
			{...rest}
		/>
	);
}

function SmallSelect({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: (val: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="w-full h-7 px-2 text-xs rounded bg-white/5 border border-white/10 text-white/90 outline-none focus:border-[#2563eb]/50 appearance-none cursor-pointer"
		>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	);
}

// ── Text content editor ───────────────────────────────────────────────────

function TextEditor({
	content,
	onChange,
}: {
	content: TextContent;
	onChange: (c: TextContent) => void;
}) {
	return (
		<Section title="Text">
			<textarea
				value={content.text}
				onChange={(e) => onChange({ ...content, text: e.target.value })}
				className="w-full h-20 px-2 py-1.5 text-xs rounded bg-white/5 border border-white/10 text-white/90 outline-none focus:border-[#2563eb]/50 resize-none"
				placeholder="Enter text..."
			/>
			<FieldRow label="Font Size">
				<div className="flex items-center gap-2">
					<Slider
						value={[content.fontSize]}
						onValueChange={([v]) => onChange({ ...content, fontSize: v })}
						min={12}
						max={120}
						step={1}
						className="flex-1"
					/>
					<span className="text-[10px] text-white/50 w-8 text-right">{content.fontSize}</span>
				</div>
			</FieldRow>
			<FieldRow label="Font">
				<SmallSelect
					value={content.fontFamily}
					onChange={(v) => onChange({ ...content, fontFamily: v })}
					options={[
						{ value: "Inter, system-ui, sans-serif", label: "Inter" },
						{ value: "Georgia, serif", label: "Georgia" },
						{ value: "monospace", label: "Mono" },
						{ value: "'Segoe UI', sans-serif", label: "Segoe UI" },
						{ value: "Arial, sans-serif", label: "Arial" },
					]}
				/>
			</FieldRow>
			<FieldRow label="Weight">
				<SmallSelect
					value={content.fontWeight}
					onChange={(v) => onChange({ ...content, fontWeight: v })}
					options={[
						{ value: "300", label: "Light" },
						{ value: "400", label: "Regular" },
						{ value: "500", label: "Medium" },
						{ value: "600", label: "Semibold" },
						{ value: "700", label: "Bold" },
						{ value: "900", label: "Black" },
					]}
				/>
			</FieldRow>
			<FieldRow label="Color">
				<input
					type="color"
					value={content.color.slice(0, 7)}
					onChange={(e) => onChange({ ...content, color: e.target.value })}
					className="w-8 h-7 rounded border border-white/10 cursor-pointer bg-transparent"
				/>
			</FieldRow>
			<FieldRow label="Align">
				<div className="flex gap-1">
					{(["left", "center", "right"] as const).map((align) => (
						<button
							key={align}
							onClick={() => onChange({ ...content, textAlign: align })}
							className={cn(
								"p-1.5 rounded transition-colors",
								content.textAlign === align
									? "bg-[#2563eb]/30 text-[#2563eb]"
									: "text-white/40 hover:text-white/70",
							)}
						>
							{align === "left" && <AlignLeft size={12} />}
							{align === "center" && <AlignCenter size={12} />}
							{align === "right" && <AlignRight size={12} />}
						</button>
					))}
				</div>
			</FieldRow>
			<FieldRow label="Line Height">
				<Slider
					value={[content.lineHeight * 10]}
					onValueChange={([v]) => onChange({ ...content, lineHeight: v / 10 })}
					min={8}
					max={30}
					step={1}
				/>
			</FieldRow>
		</Section>
	);
}

// ── Image content editor ──────────────────────────────────────────────────

function ImageEditor({
	content,
	onChange,
}: {
	content: ImageContent;
	onChange: (c: ImageContent) => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				onChange({ ...content, src: reader.result as string });
			};
			reader.readAsDataURL(file);
		},
		[content, onChange],
	);

	return (
		<Section title="Image">
			<div className="space-y-2">
				{content.src ? (
					<div className="relative rounded overflow-hidden border border-white/10">
						<img
							src={content.src}
							alt="Layer image"
							className="w-full h-24 object-contain bg-black/20"
						/>
						<button
							onClick={() => fileInputRef.current?.click()}
							className="absolute bottom-1 right-1 px-2 py-0.5 text-[10px] rounded bg-black/60 text-white/70 hover:text-white"
						>
							Replace
						</button>
					</div>
				) : (
					<button
						onClick={() => fileInputRef.current?.click()}
						className="w-full flex items-center justify-center gap-2 px-3 py-4 rounded border border-dashed border-white/10 hover:border-[#2563eb]/50 text-white/40 hover:text-white/60 transition-colors"
					>
						<ImagePlus size={16} />
						<span className="text-xs">Upload Image</span>
					</button>
				)}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleFileSelect}
					className="hidden"
				/>
			</div>
			<FieldRow label="Fit">
				<SmallSelect
					value={content.fit}
					onChange={(v) => onChange({ ...content, fit: v as ImageContent["fit"] })}
					options={[
						{ value: "contain", label: "Contain" },
						{ value: "cover", label: "Cover" },
						{ value: "fill", label: "Fill" },
					]}
				/>
			</FieldRow>
			<FieldRow label="Radius">
				<Slider
					value={[content.borderRadius]}
					onValueChange={([v]) => onChange({ ...content, borderRadius: v })}
					min={0}
					max={50}
					step={1}
				/>
			</FieldRow>
		</Section>
	);
}

// ── Shape content editor ──────────────────────────────────────────────────

function ShapeEditor({
	content,
	onChange,
}: {
	content: ShapeContent;
	onChange: (c: ShapeContent) => void;
}) {
	return (
		<Section title="Shape">
			<FieldRow label="Shape">
				<SmallSelect
					value={content.shape}
					onChange={(v) => onChange({ ...content, shape: v as ShapeContent["shape"] })}
					options={[
						{ value: "rectangle", label: "Rectangle" },
						{ value: "rounded-rect", label: "Rounded Rect" },
						{ value: "circle", label: "Circle" },
					]}
				/>
			</FieldRow>
			<FieldRow label="Fill">
				<input
					type="color"
					value={content.fill}
					onChange={(e) => onChange({ ...content, fill: e.target.value })}
					className="w-8 h-7 rounded border border-white/10 cursor-pointer bg-transparent"
				/>
			</FieldRow>
			<FieldRow label="Stroke">
				<input
					type="color"
					value={content.stroke || "#ffffff"}
					onChange={(e) => onChange({ ...content, stroke: e.target.value })}
					className="w-8 h-7 rounded border border-white/10 cursor-pointer bg-transparent"
				/>
			</FieldRow>
			<FieldRow label="Stroke W">
				<Slider
					value={[content.strokeWidth || 0]}
					onValueChange={([v]) => onChange({ ...content, strokeWidth: v })}
					min={0}
					max={10}
					step={1}
				/>
			</FieldRow>
		</Section>
	);
}

// ── Animation editor ──────────────────────────────────────────────────────

function AnimationEditor({
	label,
	animation,
	onChange,
}: {
	label: string;
	animation: SceneLayer["entrance"];
	onChange: (a: SceneLayer["entrance"]) => void;
}) {
	const animOptions = ALL_ANIMATION_TYPES.map((t) => ({
		value: t,
		label: ANIMATION_TYPE_LABELS[t],
	}));

	const easingOptions = [
		{ value: "linear", label: "Linear" },
		{ value: "ease-in", label: "Ease In" },
		{ value: "ease-out", label: "Ease Out" },
		{ value: "ease-in-out", label: "Ease In Out" },
		{ value: "spring", label: "Spring" },
	];

	return (
		<Section title={label}>
			<FieldRow label="Type">
				<SmallSelect
					value={animation.type}
					onChange={(v) => onChange({ ...animation, type: v as AnimationType })}
					options={animOptions}
				/>
			</FieldRow>
			{animation.type !== "none" && (
				<>
					<FieldRow label="Duration">
						<div className="flex items-center gap-2">
							<Slider
								value={[animation.durationMs]}
								onValueChange={([v]) => onChange({ ...animation, durationMs: v })}
								min={100}
								max={3000}
								step={50}
								className="flex-1"
							/>
							<span className="text-[10px] text-white/50 w-10 text-right">
								{(animation.durationMs / 1000).toFixed(1)}s
							</span>
						</div>
					</FieldRow>
					<FieldRow label="Easing">
						<SmallSelect
							value={animation.easing}
							onChange={(v) =>
								onChange({ ...animation, easing: v as SceneLayer["entrance"]["easing"] })
							}
							options={easingOptions}
						/>
					</FieldRow>
					<FieldRow label="Delay">
						<div className="flex items-center gap-2">
							<Slider
								value={[animation.delay]}
								onValueChange={([v]) => onChange({ ...animation, delay: v })}
								min={0}
								max={3000}
								step={50}
								className="flex-1"
							/>
							<span className="text-[10px] text-white/50 w-10 text-right">
								{(animation.delay / 1000).toFixed(1)}s
							</span>
						</div>
					</FieldRow>
				</>
			)}
		</Section>
	);
}

// ── Position/size editor ──────────────────────────────────────────────────

function PositionEditor({
	layer,
	sceneDurationMs,
	onChange,
}: {
	layer: SceneLayer;
	sceneDurationMs: number;
	onChange: (updates: Partial<SceneLayer>) => void;
}) {
	return (
		<>
			<Section title="Position">
				<FieldRow label="X">
					<Slider
						value={[layer.position.x]}
						onValueChange={([v]) => onChange({ position: { ...layer.position, x: v } })}
						min={0}
						max={100}
						step={1}
					/>
				</FieldRow>
				<FieldRow label="Y">
					<Slider
						value={[layer.position.y]}
						onValueChange={([v]) => onChange({ position: { ...layer.position, y: v } })}
						min={0}
						max={100}
						step={1}
					/>
				</FieldRow>
				<FieldRow label="Width">
					<Slider
						value={[layer.size.width]}
						onValueChange={([v]) => onChange({ size: { ...layer.size, width: v } })}
						min={5}
						max={100}
						step={1}
					/>
				</FieldRow>
				<FieldRow label="Height">
					<Slider
						value={[layer.size.height]}
						onValueChange={([v]) => onChange({ size: { ...layer.size, height: v } })}
						min={5}
						max={100}
						step={1}
					/>
				</FieldRow>
			</Section>

			<Section title="Timing">
				<FieldRow label="Start">
					<div className="flex items-center gap-2">
						<Slider
							value={[layer.startMs]}
							onValueChange={([v]) => onChange({ startMs: Math.min(v, layer.endMs - 100) })}
							min={0}
							max={sceneDurationMs}
							step={100}
							className="flex-1"
						/>
						<span className="text-[10px] text-white/50 w-8 text-right">
							{(layer.startMs / 1000).toFixed(1)}s
						</span>
					</div>
				</FieldRow>
				<FieldRow label="End">
					<div className="flex items-center gap-2">
						<Slider
							value={[layer.endMs]}
							onValueChange={([v]) => onChange({ endMs: Math.max(v, layer.startMs + 100) })}
							min={0}
							max={sceneDurationMs}
							step={100}
							className="flex-1"
						/>
						<span className="text-[10px] text-white/50 w-8 text-right">
							{(layer.endMs / 1000).toFixed(1)}s
						</span>
					</div>
				</FieldRow>
				<FieldRow label="Z-Index">
					<SmallInput
						type="number"
						value={layer.zIndex}
						onChange={(v) => onChange({ zIndex: parseInt(v) || 0 })}
					/>
				</FieldRow>
			</Section>
		</>
	);
}

// ── Layer list ────────────────────────────────────────────────────────────

function LayerList({
	layers,
	selectedLayerId,
	onSelectLayer,
}: {
	layers: SceneLayer[];
	selectedLayerId: string | null;
	onSelectLayer: (id: string | null) => void;
}) {
	const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

	return (
		<Section title="Layers">
			<div className="space-y-1">
				{sortedLayers.map((layer) => {
					const label =
						layer.type === "text"
							? (layer.content as TextContent).text.slice(0, 30) || "Text"
							: layer.type === "image"
								? "Image"
								: "Shape";
					return (
						<button
							key={layer.id}
							onClick={() => onSelectLayer(layer.id)}
							className={cn(
								"w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left",
								selectedLayerId === layer.id
									? "bg-[#2563eb]/20 text-[#2563eb]"
									: "text-white/60 hover:bg-white/5 hover:text-white/80",
							)}
						>
							{layer.type === "text" && <Type size={12} />}
							{layer.type === "image" && <ImagePlus size={12} />}
							{layer.type === "shape" && <Layers size={12} />}
							<span className="truncate">{label}</span>
							<span className="ml-auto text-[9px] text-white/30">z{layer.zIndex}</span>
						</button>
					);
				})}
				{layers.length === 0 && (
					<p className="text-[10px] text-white/30 text-center py-2">
						No layers. Add text or images above.
					</p>
				)}
			</div>
		</Section>
	);
}

// ── Main LayerPanel ───────────────────────────────────────────────────────

export function LayerPanel({
	layer,
	sceneDurationMs,
	allLayers,
	onUpdateLayer,
	onSelectLayer,
}: LayerPanelProps) {
	const updateContent = useCallback(
		(content: TextContent | ImageContent | ShapeContent) => {
			if (!layer) return;
			onUpdateLayer(layer.id, { content });
		},
		[layer, onUpdateLayer],
	);

	return (
		<div className="w-64 flex-shrink-0 border-l border-white/5 bg-[#09090b]/80 backdrop-blur-sm overflow-y-auto px-3 py-3 space-y-4">
			{/* Layer list always visible */}
			<LayerList
				layers={allLayers}
				selectedLayerId={layer?.id ?? null}
				onSelectLayer={onSelectLayer}
			/>

			{/* Properties for selected layer */}
			{layer && (
				<>
					<div className="h-px bg-white/5" />

					{/* Content editors */}
					{layer.type === "text" && (
						<TextEditor content={layer.content as TextContent} onChange={updateContent} />
					)}
					{layer.type === "image" && (
						<ImageEditor content={layer.content as ImageContent} onChange={updateContent} />
					)}
					{layer.type === "shape" && (
						<ShapeEditor content={layer.content as ShapeContent} onChange={updateContent} />
					)}

					<div className="h-px bg-white/5" />

					{/* Animation editors */}
					<AnimationEditor
						label="Entrance"
						animation={layer.entrance}
						onChange={(a) => onUpdateLayer(layer.id, { entrance: a })}
					/>
					<AnimationEditor
						label="Exit"
						animation={layer.exit}
						onChange={(a) => onUpdateLayer(layer.id, { exit: a })}
					/>

					<div className="h-px bg-white/5" />

					{/* Position / Timing */}
					<PositionEditor
						layer={layer}
						sceneDurationMs={sceneDurationMs}
						onChange={(updates) => onUpdateLayer(layer.id, updates)}
					/>
				</>
			)}
		</div>
	);
}
