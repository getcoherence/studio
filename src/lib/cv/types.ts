// ── Computer Vision Analysis Types ───────────────────────────────────────

/** Bounding box in 0-1 normalized coordinates */
export interface NormalizedRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A detected UI region with classification metadata */
export interface UIRegion {
	bounds: NormalizedRect;
	/** Approximate area as fraction of total image (0-1) */
	area: number;
	/** Heuristic classification based on position and size */
	type: "card" | "hero" | "nav" | "sidebar" | "content" | "footer" | "unknown";
}

/** Dominant color extracted from the screenshot */
export interface DominantColor {
	hex: string;
	rgb: [number, number, number];
	/** Fraction of image this color occupies (0-1) */
	weight: number;
}

/** Complete analysis result for a single screenshot */
export interface ScreenshotAnalysis {
	/** Where the eye would look (spectral residual saliency), normalized 0-1 */
	saliencyPeak: { x: number; y: number };
	/** Bounding boxes of distinct content sections */
	uiRegions: UIRegion[];
	/** Where actual content is (excluding empty margins) */
	contentBounds: NormalizedRect;
	/** Top dominant colors sorted by weight */
	dominantColors: DominantColor[];
	/** 0-1 score: higher = more visual complexity */
	complexityScore: number;
	/** Whether the screenshot appears to be dark mode UI */
	isDarkTheme: boolean;
	/** Original image dimensions in px */
	imageDimensions: { width: number; height: number };
	/** Analysis duration in ms */
	analysisTimeMs: number;
}
