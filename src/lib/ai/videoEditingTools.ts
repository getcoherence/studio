/**
 * Video editing tool definitions for AI chat.
 * Each tool describes an action the AI can invoke via structured JSON.
 */

export interface VideoEditToolParameter {
	type: string;
	description: string;
}

export interface VideoEditTool {
	name: string;
	description: string;
	parameters: Record<string, VideoEditToolParameter>;
}

export const VIDEO_EDITING_TOOLS: VideoEditTool[] = [
	{
		name: "addTrimRegion",
		description: "Remove a section of the video. Specify start and end times in seconds.",
		parameters: {
			startSec: { type: "number", description: "Start time in seconds" },
			endSec: { type: "number", description: "End time in seconds" },
		},
	},
	{
		name: "addZoomRegion",
		description:
			"Add a zoom effect at a specific time range. Depth 1-6 (1=slight, 6=extreme). Focus cx/cy are 0-1 normalized coordinates (defaults to center).",
		parameters: {
			startSec: { type: "number", description: "Start time in seconds" },
			endSec: { type: "number", description: "End time in seconds" },
			depth: { type: "number", description: "Zoom depth 1-6 (default 3)" },
		},
	},
	{
		name: "addSpeedRegion",
		description:
			"Change playback speed for a section. Valid speed values: 0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2.",
		parameters: {
			startSec: { type: "number", description: "Start time in seconds" },
			endSec: { type: "number", description: "End time in seconds" },
			speed: { type: "number", description: "Speed multiplier" },
		},
	},
	{
		name: "setBackground",
		description:
			'Set the video background wallpaper. Use a number 1-18 for built-in wallpapers, a gradient name (e.g. "gradient-sunset"), or "none" for no background.',
		parameters: {
			wallpaper: {
				type: "string",
				description: 'Wallpaper number (1-18), gradient name, or "none"',
			},
		},
	},
	{
		name: "setBorderRadius",
		description: "Set video corner rounding in pixels (0-48).",
		parameters: {
			radius: { type: "number", description: "Border radius in pixels" },
		},
	},
	{
		name: "setPadding",
		description: "Set padding around the video (0-100 in percentage units).",
		parameters: {
			padding: { type: "number", description: "Padding value" },
		},
	},
	{
		name: "generateCaptions",
		description:
			"Auto-generate captions for the video using Whisper speech recognition. No parameters needed.",
		parameters: {},
	},
	{
		name: "smartTrim",
		description:
			"Automatically detect and trim dead spots, idle cursor sections, and loading screens from the video.",
		parameters: {},
	},
	{
		name: "magicPolish",
		description:
			"Apply one-click auto-enhancement: auto-zoom on key moments, trim dead spots, speed ramps for idle sections, set wallpaper/border/padding.",
		parameters: {},
	},
	{
		name: "setCursorStyle",
		description: 'Change cursor appearance. Options: "default", "dot", "crosshair", "ring".',
		parameters: {
			style: { type: "string", description: "Cursor style name" },
		},
	},
	{
		name: "setCursorEffects",
		description: "Configure cursor visual effects like smoothing, sway, and click rings.",
		parameters: {
			smoothing: {
				type: "number",
				description: "Smoothing amount 0-1 (optional)",
			},
			sway: { type: "number", description: "Sway amount 0-1 (optional)" },
			showClickRings: {
				type: "boolean",
				description: "Show click ring animations (optional)",
			},
		},
	},
	{
		name: "seekTo",
		description: "Jump the playback position to a specific time.",
		parameters: {
			timeSec: { type: "number", description: "Time in seconds to seek to" },
		},
	},
	{
		name: "addTextAnnotation",
		description:
			"Add a text overlay/annotation on the video at a specific time range. Position x/y are percentages (0-100).",
		parameters: {
			startSec: { type: "number", description: "Start time in seconds" },
			endSec: { type: "number", description: "End time in seconds" },
			text: { type: "string", description: "Text content to display" },
			x: { type: "number", description: "Horizontal position 0-100% (default 50)" },
			y: { type: "number", description: "Vertical position 0-100% (default 20)" },
			fontSize: { type: "number", description: "Font size in pixels (default 32)" },
			color: { type: "string", description: "Text color hex (default #ffffff)" },
		},
	},
	{
		name: "addArrowAnnotation",
		description:
			"Add an arrow annotation pointing in a direction. Position x/y are percentages (0-100).",
		parameters: {
			startSec: { type: "number", description: "Start time in seconds" },
			endSec: { type: "number", description: "End time in seconds" },
			direction: {
				type: "string",
				description:
					"Arrow direction: up, down, left, right, up-right, up-left, down-right, down-left",
			},
			x: { type: "number", description: "Horizontal position 0-100% (default 50)" },
			y: { type: "number", description: "Vertical position 0-100% (default 50)" },
			color: { type: "string", description: "Arrow color hex (default #ef4444)" },
		},
	},
	{
		name: "clearAnnotations",
		description: "Remove all annotations from the video.",
		parameters: {},
	},
];
