export interface AnimatedBackground {
	id: string;
	name: string;
	type: "animated-gradient" | "particles" | "mesh" | "video";
	category: string;
	/** Whether this background is available for use (false = coming soon placeholder) */
	available: boolean;
	/** Fallback solid color for thumbnails / unavailable presets */
	previewColor: string;
	/** Render a single frame to a 2D canvas context at the given time */
	render(ctx: CanvasRenderingContext2D, width: number, height: number, timeMs: number): void;
}
