import type { AnimatedBackground } from "./types";

// ---------------------------------------------------------------------------
// Video loop placeholders — marked unavailable until real assets are bundled.
// Their render() just fills with the preview color.
// ---------------------------------------------------------------------------

const abstractFlow: AnimatedBackground = {
	id: "video-abstract-flow",
	name: "Abstract Flow (Coming Soon)",
	type: "video",
	category: "Video Loops",
	available: false,
	previewColor: "#2d1b69",
	render(ctx, w, h, _timeMs) {
		ctx.fillStyle = this.previewColor;
		ctx.fillRect(0, 0, w, h);
	},
};

const gradientWave: AnimatedBackground = {
	id: "video-gradient-wave",
	name: "Gradient Wave (Coming Soon)",
	type: "video",
	category: "Video Loops",
	available: false,
	previewColor: "#1a365d",
	render(ctx, w, h, _timeMs) {
		ctx.fillStyle = this.previewColor;
		ctx.fillRect(0, 0, w, h);
	},
};

const lightLeak: AnimatedBackground = {
	id: "video-light-leak",
	name: "Light Leak (Coming Soon)",
	type: "video",
	category: "Video Loops",
	available: false,
	previewColor: "#422006",
	render(ctx, w, h, _timeMs) {
		ctx.fillStyle = this.previewColor;
		ctx.fillRect(0, 0, w, h);
	},
};

export const VIDEO_BACKGROUNDS: AnimatedBackground[] = [abstractFlow, gradientWave, lightLeak];
