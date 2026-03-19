export interface WebcamOverlayLayout {
	x: number;
	y: number;
	width: number;
	height: number;
	margin: number;
	borderRadius: number;
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

const MAX_STAGE_FRACTION = 0.18;
const MARGIN_FRACTION = 0.02;
const MIN_SIZE = 96;
const MAX_BORDER_RADIUS = 24;
const WEBCAM_LAYOUT_PRESET_MAP: Record<WebcamLayoutPreset, WebcamLayoutPresetDefinition> = {
	"picture-in-picture": {
		label: "Picture in Picture",
		transform: {
			type: "overlay",
			maxStageFraction: MAX_STAGE_FRACTION,
			marginFraction: MARGIN_FRACTION,
			minMargin: 12,
			minSize: MIN_SIZE,
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

export function computeWebcamOverlayLayout(params: {
	stageWidth: number;
	stageHeight: number;
	videoWidth: number;
	videoHeight: number;
	layoutPreset?: WebcamLayoutPreset;
	screenVideoWidth?: number;
	screenVideoHeight?: number;
}): WebcamOverlayLayout | null {
	const {
		stageWidth,
		stageHeight,
		videoWidth,
		videoHeight,
		layoutPreset = "picture-in-picture",
		screenVideoWidth,
		screenVideoHeight,
	} = params;
	const preset = getWebcamLayoutPresetDefinition(layoutPreset);

	if (stageWidth <= 0 || stageHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
		return null;
	}

	if (preset.transform.type === "stack") {
		if (
			!screenVideoWidth ||
			!screenVideoHeight ||
			screenVideoWidth <= 0 ||
			screenVideoHeight <= 0
		) {
			return null;
		}

		const gap = preset.transform.gap;
		const scale = Math.min(
			stageWidth / Math.max(screenVideoWidth, videoWidth),
			stageHeight / (screenVideoHeight + gap + videoHeight),
		);
		const clampedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
		const screenHeight = Math.round(screenVideoHeight * clampedScale);
		const webcamHeight = Math.round(videoHeight * clampedScale);
		const webcamWidth = Math.round(videoWidth * clampedScale);
		const scaledGap = Math.round(gap * clampedScale);
		const contentHeight = screenHeight + scaledGap + webcamHeight;
		const topOffset = Math.max(0, Math.floor((stageHeight - contentHeight) / 2));

		return {
			x: Math.max(0, Math.floor((stageWidth - webcamWidth) / 2)),
			y: Math.max(0, topOffset + screenHeight + scaledGap),
			width: webcamWidth,
			height: webcamHeight,
			margin: 0,
			borderRadius: Math.min(
				preset.borderRadius.max,
				Math.max(
					preset.borderRadius.min,
					Math.round(Math.min(webcamWidth, webcamHeight) * preset.borderRadius.fraction),
				),
			),
		};
	}

	const transform = preset.transform;
	const margin = Math.max(
		transform.minMargin,
		Math.round(Math.min(stageWidth, stageHeight) * transform.marginFraction),
	);
	const maxWidth = Math.max(transform.minSize, stageWidth * transform.maxStageFraction);
	const maxHeight = Math.max(transform.minSize, stageHeight * transform.maxStageFraction);
	const scale = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
	const width = Math.round(videoWidth * scale);
	const height = Math.round(videoHeight * scale);

	return {
		x: Math.max(0, Math.round(stageWidth - margin - width)),
		y: Math.max(0, Math.round(stageHeight - margin - height)),
		width,
		height,
		margin,
		borderRadius: Math.min(
			preset.borderRadius.max,
			Math.max(
				preset.borderRadius.min,
				Math.round(Math.min(width, height) * preset.borderRadius.fraction),
			),
		),
	};
}
