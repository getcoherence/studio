// ── Loaded-project routing ──────────────────────────────────────────────
//
// Studio saves two unrelated payload shapes under the same `.studio` (and
// legacy `.lucid`) extensions, with no discriminator field:
//
//   - SceneProject (Create / Scene Editor): `{ id, name, scenes, resolution,
//     fps, ... }`, plus runtime extras the pro bundle stamps on before
//     saving (`_aiCode`, `_aiPlan`, `styleId: "ai-cinematic"`, ...).
//   - EditorProjectData (Record editor): `{ version, media | videoPath,
//     editor }` — see projectPersistence.ts.
//
// So the editor sniffs the shape to decide where a loaded file opens. This
// module is that sniff, pulled out of VideoEditor so it can be tested.

export type LoadedProjectRoute = "scene-editor" | "recording-editor" | "none";

/**
 * How strictly to recognise a SceneProject. The two call sites have always
 * used different checks; both are preserved exactly:
 *
 * - `"strict"` — File → Load Project (`VideoEditor.handleLoadProject`):
 *   `scenes` must be an array AND `resolution` must be truthy.
 * - `"loose"` — Project Browser (`onProjectOpened` in VideoEditor): any
 *   non-null object that has a `scenes` key (`"scenes" in project`).
 *
 * They only disagree on malformed payloads (e.g. `scenes` without
 * `resolution`): the browser opens those in the Scene Editor, while the
 * menu hands them to the recording loader, which rejects them.
 */
export type SceneProjectSniff = "strict" | "loose";

export function isSceneProjectPayload(project: unknown, sniff: SceneProjectSniff): boolean {
	if (sniff === "strict") {
		const candidate = project as { scenes?: unknown; resolution?: unknown } | null | undefined;
		return Boolean(candidate?.scenes && Array.isArray(candidate.scenes) && candidate.resolution);
	}
	return Boolean(project && typeof project === "object" && "scenes" in project);
}

/**
 * Decide which editor a loaded project payload opens in. `"recording-editor"`
 * means "hand it to applyLoadedProject", which still validates it and may
 * reject it; `"none"` means there is no payload at all (falsy).
 */
export function routeLoadedProject(project: unknown, sniff: SceneProjectSniff): LoadedProjectRoute {
	if (isSceneProjectPayload(project, sniff)) return "scene-editor";
	return project ? "recording-editor" : "none";
}
