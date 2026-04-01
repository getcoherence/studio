export interface RenderRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface StyledRenderRect extends RenderRect {
	borderRadius: number;
}

export interface Size {
	width: number;
	height: number;
}

export type WebcamLayoutPreset = "picture-in-picture" | "vertical-stack";

export interface WebcamLayoutShadow {
	color: string;
	blur: number;
	offsetX: number;
	offsetY: number;
}

interface BorderRadiusRule {
	max: number;
	min: number;
	fraction: number;
}

interface OverlayTransform {
	type: "overlay";
	maxStageFraction: number;
	marginFraction: number;
	minMargin: number;
	minSize: number;
}

interface StackTransform {
	type: "stack";
	gap: number;
}

export interface WebcamLayoutPresetDefinition {
	label: string;
	transform: OverlayTransform | StackTransform;
	borderRadius: BorderRadiusRule;
	shadow: WebcamLayoutShadow | null;
}

export interface WebcamCompositeLayout {
	screenRect: RenderRect;
	webcamRect: StyledRenderRect | null;
	/** When true, the video should be scaled to cover screenRect (cropping overflow). */
	screenCover?: boolean;
}

const MAX_STAGE_FRACTION = 0.18;
const MARGIN_FRACTION = 0.02;
const MAX_BORDER_RADIUS = 24;
const WEBCAM_LAYOUT_PRESET_MAP: Record<WebcamLayoutPreset, WebcamLayoutPresetDefinition> = {
	"picture-in-picture": {
		label: "Picture in Picture",
		transform: {
			type: "overlay",
			maxStageFraction: MAX_STAGE_FRACTION,
			marginFraction: MARGIN_FRACTION,
			minMargin: 0,
			minSize: 0,
		},
		borderRadius: {
			max: MAX_BORDER_RADIUS,
			min: 12,
			fraction: 0.12,
		},
		shadow: {
			color: "rgba(0,0,0,0.35)",
			blur: 24,
			offsetX: 0,
			offsetY: 10,
		},
	},
	"vertical-stack": {
		label: "Vertical Stack",
		transform: {
			type: "stack",
			gap: 0,
		},
		borderRadius: {
			max: 0,
			min: 0,
			fraction: 0,
		},
		shadow: null,
	},
};

export const WEBCAM_LAYOUT_PRESETS = Object.entries(WEBCAM_LAYOUT_PRESET_MAP).map(
	([value, preset]) => ({
		value: value as WebcamLayoutPreset,
		label: preset.label,
	}),
);

export function getWebcamLayoutPresetDefinition(
	preset: WebcamLayoutPreset = "picture-in-picture",
): WebcamLayoutPresetDefinition {
	return WEBCAM_LAYOUT_PRESET_MAP[preset];
}

export function getWebcamLayoutCssBoxShadow(
	preset: WebcamLayoutPreset = "picture-in-picture",
): string {
	const shadow = getWebcamLayoutPresetDefinition(preset).shadow;
	return shadow
		? `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`
		: "none";
}

export function computeCompositeLayout(params: {
	canvasSize: Size;
	maxContentSize?: Size;
	screenSize: Size;
	webcamSize?: Size | null;
	layoutPreset?: WebcamLayoutPreset;
	webcamPosition?: { cx: number; cy: number } | null;
}): WebcamCompositeLayout | null {
	const {
		canvasSize,
		maxContentSize = canvasSize,
		screenSize,
		webcamSize,
		layoutPreset = "picture-in-picture",
		webcamPosition,
	} = params;
	const { width: canvasWidth, height: canvasHeight } = canvasSize;
	const { width: screenWidth, height: screenHeight } = screenSize;
	const webcamWidth = webcamSize?.width;
	const webcamHeight = webcamSize?.height;
	const preset = getWebcamLayoutPresetDefinition(layoutPreset);

	if (canvasWidth <= 0 || canvasHeight <= 0 || screenWidth <= 0 || screenHeight <= 0) {
		return null;
	}

	if (preset.transform.type === "stack") {
		const { gap } = preset.transform;

		if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
			// No webcam — center screen within maxContentSize
			const screenRect = centerRect({
				canvasSize,
				size: screenSize,
				maxSize: maxContentSize,
			});
			return { screenRect, webcamRect: null };
		}

		// Both screen and webcam stacked vertically, constrained by maxContentSize
		const screenAspect = screenWidth / screenHeight;
		const webcamAspect = webcamWidth / webcamHeight;
		const { width: maxW, height: maxH } = maxContentSize;

		// Find the widest width W such that both rects fit within maxContentSize
		// W/screenAspect + W/webcamAspect + gap <= maxH  and  W <= maxW
		const maxByHeight = (maxH - gap) / (1 / screenAspect + 1 / webcamAspect);
		const resolvedWidth = Math.round(Math.min(maxW, maxByHeight));
		const resolvedScreenHeight = Math.round(resolvedWidth / screenAspect);
		const resolvedWebcamHeight = Math.round(resolvedWidth / webcamAspect);
		const totalHeight = resolvedScreenHeight + gap + resolvedWebcamHeight;

		// Center the combined block in the canvas
		const offsetX = Math.max(0, Math.floor((canvasWidth - resolvedWidth) / 2));
		const offsetY = Math.max(0, Math.floor((canvasHeight - totalHeight) / 2));

		return {
			screenRect: {
				x: offsetX,
				y: offsetY,
				width: resolvedWidth,
				height: resolvedScreenHeight,
			},
			webcamRect: {
				x: offsetX,
				y: offsetY + resolvedScreenHeight + gap,
				width: resolvedWidth,
				height: resolvedWebcamHeight,
				borderRadius: 0,
			},
		};
	}

	const transform = preset.transform;
	const screenRect = centerRect({
		canvasSize,
		size: screenSize,
		maxSize: maxContentSize,
	});

	if (!webcamWidth || !webcamHeight || webcamWidth <= 0 || webcamHeight <= 0) {
		return { screenRect, webcamRect: null };
	}

	const margin = Math.max(
		transform.minMargin,
		Math.round(Math.min(canvasWidth, canvasHeight) * transform.marginFraction),
	);
	const maxWidth = Math.max(transform.minSize, canvasWidth * transform.maxStageFraction);
	const maxHeight = Math.max(transform.minSize, canvasHeight * transform.maxStageFraction);
	const scale = Math.min(maxWidth / webcamWidth, maxHeight / webcamHeight);
	const width = Math.round(webcamWidth * scale);
	const height = Math.round(webcamHeight * scale);

	let webcamX: number;
	let webcamY: number;

	if (webcamPosition) {
		// Custom position: cx/cy represent the center of the webcam as a fraction of the canvas
		webcamX = Math.round(webcamPosition.cx * canvasWidth - width / 2);
		webcamY = Math.round(webcamPosition.cy * canvasHeight - height / 2);
		// Clamp to stay within canvas bounds
		webcamX = Math.max(0, Math.min(canvasWidth - width, webcamX));
		webcamY = Math.max(0, Math.min(canvasHeight - height, webcamY));
	} else {
		// Default: bottom-right with margin
		webcamX = Math.max(0, Math.round(canvasWidth - margin - width));
		webcamY = Math.max(0, Math.round(canvasHeight - margin - height));
	}

	return {
		screenRect,
		webcamRect: {
			x: webcamX,
			y: webcamY,
			width,
			height,
			borderRadius: Math.min(
				preset.borderRadius.max,
				Math.max(
					preset.borderRadius.min,
					Math.round(Math.min(width, height) * preset.borderRadius.fraction),
				),
			),
		},
	};
}

function centerRect(params: { canvasSize: Size; size: Size; maxSize: Size }): RenderRect {
	const { canvasSize, size, maxSize } = params;
	const { width: canvasWidth, height: canvasHeight } = canvasSize;
	const { width, height } = size;
	const { width: maxWidth, height: maxHeight } = maxSize;
	const scale = Math.min(maxWidth / width, maxHeight / height, 1);
	const resolvedWidth = Math.round(width * scale);
	const resolvedHeight = Math.round(height * scale);

	return {
		x: Math.max(0, Math.floor((canvasWidth - resolvedWidth) / 2)),
		y: Math.max(0, Math.floor((canvasHeight - resolvedHeight) / 2)),
		width: resolvedWidth,
		height: resolvedHeight,
	};
}
