// ── Skill Loader ────────────────────────────────────────────────────────
//
// Loads production knowledge skill files and formats them for injection
// into AI system prompts. Skills teach the AI how to make better creative
// decisions when generating scene plans.

// Skill content is embedded at build time via raw imports.
// In Electron, we can also read from the filesystem at runtime.

/** All available skill names */
export type SkillName = "composition" | "visual-variety" | "cinematography" | "effects";

/** Skill metadata */
export interface Skill {
	name: SkillName;
	title: string;
	content: string;
}

/**
 * Format skills for injection into an AI system prompt.
 * Returns a single string with all skill content, separated by markers.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
	if (skills.length === 0) return "";

	const header =
		"## Production Knowledge\n\nThe following production skills guide your creative decisions:\n";
	const body = skills.map((s) => `### ${s.title}\n\n${s.content}`).join("\n\n---\n\n");

	return `${header}\n${body}`;
}

/**
 * Get skill names relevant to a given task.
 */
export function getRelevantSkills(task: "scene-plan" | "edit" | "review"): SkillName[] {
	switch (task) {
		case "scene-plan":
			return ["composition", "visual-variety", "cinematography", "effects"];
		case "edit":
			return ["visual-variety", "effects"];
		case "review":
			return ["composition", "visual-variety"];
		default:
			return [];
	}
}
