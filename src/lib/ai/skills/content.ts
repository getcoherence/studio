// ── Skill Content (build-time embedded) ─────────────────────────────────
//
// Imports skill markdown files as raw strings using Vite's ?raw suffix.
// This embeds the content at build time so no filesystem access is needed
// at runtime (works in both Electron and browser contexts).
//
// The pro bundle accesses these via window.__STUDIO_SHARED__.SKILL_CONTENT
// and injects them into the AI system prompt for scene plan generation.

import cinematographyMd from "./cinematography.md?raw";
import compositionMd from "./composition.md?raw";
import effectsMd from "./effects.md?raw";
import gsapPatternsMd from "./gsap-patterns.md?raw";
import visualVarietyMd from "./visual-variety.md?raw";

export interface SkillEntry {
	name: string;
	title: string;
	content: string;
}

/**
 * All production knowledge skills, embedded as strings.
 */
export const SKILL_CONTENT: Record<string, SkillEntry> = {
	composition: {
		name: "composition",
		title: "Video Composition",
		content: compositionMd,
	},
	"visual-variety": {
		name: "visual-variety",
		title: "Visual Variety",
		content: visualVarietyMd,
	},
	cinematography: {
		name: "cinematography",
		title: "Cinematography & Shot Language",
		content: cinematographyMd,
	},
	effects: {
		name: "effects",
		title: "Effects & Particle Selection",
		content: effectsMd,
	},
	"gsap-patterns": {
		name: "gsap-patterns",
		title: "GSAP Animation Patterns (Remotion-adapted)",
		content: gsapPatternsMd,
	},
};

/**
 * Format all skills (or a subset) into a single string for injection
 * into an AI system prompt.
 *
 * @param skillNames - Which skills to include. If omitted, includes all.
 */
export function formatSkillsForPrompt(skillNames?: string[]): string {
	const skills = skillNames
		? skillNames.map((n) => SKILL_CONTENT[n]).filter(Boolean)
		: Object.values(SKILL_CONTENT);

	if (skills.length === 0) return "";

	const header =
		"## Production Knowledge\n\n" +
		"Follow these production rules when generating scene plans. " +
		"They encode best practices for visual quality and variety.\n";

	const body = skills.map((s) => s.content).join("\n\n---\n\n");

	return `${header}\n${body}`;
}
