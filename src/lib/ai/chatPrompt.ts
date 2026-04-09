/**
 * Build the system prompt for the AI video-editing chat assistant.
 */

import { VIDEO_EDITING_TOOLS } from "./videoEditingTools";

export interface ChatPromptContext {
	durationSec: number;
	hasAudio: boolean;
	hasCaptions: boolean;
	captionText?: string;
	activeSegmentCount: number;
	idleSegmentCount: number;
	clickClusterCount: number;
	currentSettings: {
		wallpaper: string;
		borderRadius: number;
		padding: number;
		cursorStyle: string;
		trimCount: number;
		zoomCount: number;
		speedCount: number;
	};
}

export function buildSystemPrompt(context: ChatPromptContext): string {
	const toolDescriptions = VIDEO_EDITING_TOOLS.map((tool) => {
		const params = Object.entries(tool.parameters);
		const paramStr =
			params.length > 0
				? params.map(([name, p]) => `    ${name} (${p.type}): ${p.description}`).join("\n")
				: "    (no parameters)";
		return `- **${tool.name}**: ${tool.description}\n  Parameters:\n${paramStr}`;
	}).join("\n\n");

	const minutes = Math.floor(context.durationSec / 60);
	const seconds = Math.round(context.durationSec % 60);
	const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

	const parts: string[] = [
		`You are an AI video editing assistant for Coherence Studio, a screen recording editor. You help users edit their recordings through natural language conversation.`,
		``,
		`## Recording Context`,
		`- Duration: ${durationStr} (${context.durationSec.toFixed(1)} seconds)`,
		`- Has audio: ${context.hasAudio ? "yes" : "no"}`,
		`- Captions: ${context.hasCaptions ? "generated" : "not yet generated"}`,
		`- Active segments: ${context.activeSegmentCount}`,
		`- Idle segments: ${context.idleSegmentCount}`,
		`- Click clusters: ${context.clickClusterCount}`,
		``,
		`## Current Editor State`,
		`- Wallpaper: ${context.currentSettings.wallpaper || "none"}`,
		`- Border radius: ${context.currentSettings.borderRadius}px`,
		`- Padding: ${context.currentSettings.padding}`,
		`- Cursor style: ${context.currentSettings.cursorStyle}`,
		`- Trim regions applied: ${context.currentSettings.trimCount}`,
		`- Zoom regions applied: ${context.currentSettings.zoomCount}`,
		`- Speed regions applied: ${context.currentSettings.speedCount}`,
	];

	if (context.hasCaptions && context.captionText) {
		parts.push(``);
		parts.push(`## Caption Transcript (first 2000 chars)`);
		parts.push(context.captionText.slice(0, 2000));
	}

	parts.push(``);
	parts.push(`## Available Tools`);
	parts.push(``);
	parts.push(toolDescriptions);
	parts.push(``);
	parts.push(`## Response Format`);
	parts.push(``);
	parts.push(`When performing an editing action, respond with a JSON tool call block like this:`);
	parts.push("```json");
	parts.push(`{ "tool": "toolName", "args": { "param1": value1 } }`);
	parts.push("```");
	parts.push(``);
	parts.push(`You can call multiple tools in a single response by including multiple JSON blocks.`);
	parts.push(``);
	parts.push(
		`When answering questions or providing explanations, respond with plain text (no JSON blocks).`,
	);
	parts.push(``);
	parts.push(`## Guidelines`);
	parts.push(`- Be concise and helpful.`);
	parts.push(
		`- When the user asks to trim, zoom, or speed up "the boring parts" or similar, use smartTrim or magicPolish.`,
	);
	parts.push(`- When adding zoom regions, default to depth 3 unless the user specifies otherwise.`);
	parts.push(
		`- Times are in seconds. The video is ${durationStr} long, so don't suggest times beyond ${context.durationSec.toFixed(1)}s.`,
	);
	parts.push(`- If the user asks something vague, ask a clarifying question rather than guessing.`);
	parts.push(`- After applying tools, briefly confirm what was done.`);

	return parts.join("\n");
}
