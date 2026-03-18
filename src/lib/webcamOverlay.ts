export interface WebcamOverlayLayout {
	x: number;
	y: number;
	width: number;
	height: number;
	margin: number;
	borderRadius: number;
}

const MAX_STAGE_FRACTION = 0.18;
const MARGIN_FRACTION = 0.02;
const MIN_SIZE = 96;
const MAX_BORDER_RADIUS = 24;

export function computeWebcamOverlayLayout(params: {
	stageWidth: number;
	stageHeight: number;
	videoWidth: number;
	videoHeight: number;
}): WebcamOverlayLayout | null {
	const { stageWidth, stageHeight, videoWidth, videoHeight } = params;

	if (stageWidth <= 0 || stageHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
		return null;
	}

	const margin = Math.max(12, Math.round(Math.min(stageWidth, stageHeight) * MARGIN_FRACTION));
	const maxWidth = Math.max(MIN_SIZE, stageWidth * MAX_STAGE_FRACTION);
	const maxHeight = Math.max(MIN_SIZE, stageHeight * MAX_STAGE_FRACTION);
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
			MAX_BORDER_RADIUS,
			Math.max(12, Math.round(Math.min(width, height) * 0.12)),
		),
	};
}
