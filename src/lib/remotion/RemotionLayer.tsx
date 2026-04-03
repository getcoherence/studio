// ── Remotion Layer Component ─────────────────────────────────────────────
//
// Maps a SceneLayer from the data model to HTML/CSS rendered by Remotion.
// Full HTML text rendering, CSS transforms, proper font shaping.

import { Img } from "remotion";
import type {
	ImageContent,
	SceneLayer,
	ShapeContent,
	TextContent,
} from "@/lib/scene-renderer/types";
import { useLayerAnimation } from "./useLayerAnimation";

interface RemotionLayerProps {
	layer: SceneLayer;
	compositionWidth: number;
	compositionHeight: number;
	sceneDurationFrames: number;
}

export const RemotionLayer: React.FC<RemotionLayerProps> = ({ layer, sceneDurationFrames }) => {
	const layerDurationFrames = sceneDurationFrames;

	// Compute entrance and exit animation styles
	const entrance = useLayerAnimation(
		layer.entrance,
		"entrance",
		layerDurationFrames,
		layer.type === "text" ? (layer.content as TextContent).text.length : undefined,
	);
	const exit = useLayerAnimation(layer.exit, "exit", layerDurationFrames);

	// Merge entrance and exit styles
	const animStyle: React.CSSProperties = {
		...entrance.style,
		...(exit.style.opacity !== undefined
			? {
					opacity: Math.min(
						(entrance.style.opacity as number) ?? 1,
						(exit.style.opacity as number) ?? 1,
					),
				}
			: {}),
	};

	const visibleChars = entrance.visibleChars !== -1 ? entrance.visibleChars : exit.visibleChars;

	// Position and size from percentage-based data model
	const containerStyle: React.CSSProperties = {
		position: "absolute",
		left: `${layer.position.x}%`,
		top: `${layer.position.y}%`,
		width: `${layer.size.width}%`,
		height: `${layer.size.height}%`,
		...animStyle,
	};

	return (
		<div style={containerStyle}>
			{layer.type === "text" && (
				<TextLayer content={layer.content as TextContent} visibleChars={visibleChars} />
			)}
			{layer.type === "image" && <ImageLayer content={layer.content as ImageContent} />}
			{layer.type === "shape" && <ShapeLayer content={layer.content as ShapeContent} />}
		</div>
	);
};

// ── Text Layer ───────────────────────────────────────────────────────────

const TextLayer: React.FC<{ content: TextContent; visibleChars: number }> = ({
	content,
	visibleChars,
}) => {
	const text = visibleChars >= 0 ? content.text.slice(0, visibleChars) : content.text;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent:
					content.textAlign === "center"
						? "center"
						: content.textAlign === "right"
							? "flex-end"
							: "flex-start",
			}}
		>
			<div
				style={{
					fontSize: content.fontSize,
					fontFamily: content.fontFamily,
					fontWeight: content.fontWeight as React.CSSProperties["fontWeight"],
					color: content.color,
					textAlign: content.textAlign,
					lineHeight: content.lineHeight,
					backgroundColor: content.backgroundColor,
					width: "100%",
					wordWrap: "break-word",
					overflowWrap: "break-word",
				}}
			>
				{text}
				{visibleChars >= 0 && (
					<span
						style={{
							display: "inline-block",
							width: 2,
							height: "1em",
							backgroundColor: content.color,
							marginLeft: 2,
							opacity: 0.8,
							animation: "none",
						}}
					/>
				)}
			</div>
		</div>
	);
};

// ── Image Layer ──────────────────────────────────────────────────────────

const ImageLayer: React.FC<{ content: ImageContent }> = ({ content }) => {
	const crop = content.cropRegion;

	const imgStyle: React.CSSProperties = {
		width: "100%",
		height: "100%",
		objectFit: content.fit,
		borderRadius: content.borderRadius,
		boxShadow: content.shadow ? "0 8px 32px rgba(0,0,0,0.4)" : undefined,
	};

	if (crop) {
		// Use clip-path + transform to show only the cropped region
		return (
			<div
				style={{
					width: "100%",
					height: "100%",
					overflow: "hidden",
					borderRadius: content.borderRadius,
					boxShadow: content.shadow ? "0 8px 32px rgba(0,0,0,0.4)" : undefined,
				}}
			>
				<Img
					src={content.src}
					style={{
						position: "absolute",
						left: `${-crop.x * 100}%`,
						top: `${-crop.y * 100}%`,
						width: `${100 / crop.width}%`,
						height: `${100 / crop.height}%`,
						objectFit: "cover",
					}}
				/>
			</div>
		);
	}

	return <Img src={content.src} style={imgStyle} />;
};

// ── Shape Layer ──────────────────────────────────────────────────────────

const ShapeLayer: React.FC<{ content: ShapeContent }> = ({ content }) => {
	const borderRadius =
		content.shape === "circle" ? "50%" : content.shape === "rounded-rect" ? 12 : 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				backgroundColor: content.fill,
				borderRadius,
				border: content.stroke
					? `${content.strokeWidth ?? 1}px solid ${content.stroke}`
					: undefined,
			}}
		/>
	);
};
