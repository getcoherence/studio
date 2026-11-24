// Contract: how Studio reads the project files users already have on disk.
//
// docs/V3-REPLATFORM-PLAN.md §8 migrates these, so the shapes and the
// routing decision (Scene Editor vs recording editor) are pinned here with
// fixtures under tests/fixtures/projects/. Add real user files there as they
// are collected (§8 step 5) — each one becomes a regression case.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	fromFileUrl,
	normalizeProjectEditor,
	resolveProjectMedia,
	toFileUrl,
	validateProjectData,
} from "@/components/video-editor/projectPersistence";
import {
	isSceneProjectPayload,
	routeLoadedProject,
	type SceneProjectSniff,
} from "@/components/video-editor/projectRouting";
import { compileCode } from "@/lib/remotion/compileCode";
import { REPO_ROOT } from "./contractFixture";

const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures/projects");

/** What main's load-project-file / load-project-by-path hand the renderer: JSON.parse(file). */
function loadFixture(name: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8"));
}

const SNIFFS: SceneProjectSniff[] = ["strict", "loose"];

describe("project routing fixtures", () => {
	it.each(SNIFFS)("minimal SceneProject opens in the Scene Editor (%s sniff)", (sniff) => {
		expect(routeLoadedProject(loadFixture("scene-project-minimal.studio"), sniff)).toBe(
			"scene-editor",
		);
	});

	it.each(SNIFFS)("AI cinematic SceneProject opens in the Scene Editor (%s sniff)", (sniff) => {
		const project = loadFixture("scene-project-ai-cinematic.studio");
		expect(project.styleId).toBe("ai-cinematic");
		expect(typeof project._aiCode).toBe("string");
		expect(project._aiPlan).toBeTypeOf("object");
		expect(routeLoadedProject(project, sniff)).toBe("scene-editor");
	});

	it("the AI cinematic fixture's saved _aiCode still compiles against MODULE_SCOPE", () => {
		const project = loadFixture("scene-project-ai-cinematic.studio");
		expect(typeof compileCode(project._aiCode as string)).toBe("function");
	});

	it.each(SNIFFS)("v2 recording project goes to the recording editor (%s sniff)", (sniff) => {
		const project = loadFixture("recording-project-v2.studio");
		expect(routeLoadedProject(project, sniff)).toBe("recording-editor");
		expect(validateProjectData(project)).toBe(true);
		expect(resolveProjectMedia(project)).toEqual({
			screenVideoPath: "C:/Users/fixture/Videos/Coherence Studio/recording-1730000000000.webm",
			webcamVideoPath:
				"C:/Users/fixture/Videos/Coherence Studio/recording-1730000000000-webcam.webm",
		});
	});

	it.each(
		SNIFFS,
	)("legacy .lucid (v1, videoPath) goes to the recording editor (%s sniff)", (sniff) => {
		const project = loadFixture("legacy-project.lucid");
		expect(routeLoadedProject(project, sniff)).toBe("recording-editor");
		expect(validateProjectData(project)).toBe(true);
		expect(resolveProjectMedia(project)).toEqual({
			screenVideoPath: "C:\\Users\\fixture\\Videos\\Lucid\\recording-1720000000000.webm",
		});
		// Legacy boolean motionBlurEnabled maps onto motionBlurAmount.
		const editor = normalizeProjectEditor(project.editor as never);
		expect(editor.motionBlurAmount).toBe(0.35);
	});

	it("scene projects are NOT valid recording projects (so the order of checks matters)", () => {
		expect(validateProjectData(loadFixture("scene-project-minimal.studio"))).toBe(false);
		expect(validateProjectData(loadFixture("scene-project-ai-cinematic.studio"))).toBe(false);
	});

	it.each(SNIFFS)("no payload routes to 'none' (%s sniff)", (sniff) => {
		expect(routeLoadedProject(undefined, sniff)).toBe("none");
		expect(routeLoadedProject(null, sniff)).toBe("none");
	});

	it("documents where the two call sites' sniffs disagree (malformed payloads only)", () => {
		// File → Load Project uses "strict"; the Project Browser uses "loose".
		const scenesWithoutResolution = { scenes: [] };
		expect(isSceneProjectPayload(scenesWithoutResolution, "strict")).toBe(false);
		expect(isSceneProjectPayload(scenesWithoutResolution, "loose")).toBe(true);

		const scenesNotArray = { scenes: {}, resolution: { width: 1920, height: 1080 } };
		expect(isSceneProjectPayload(scenesNotArray, "strict")).toBe(false);
		expect(isSceneProjectPayload(scenesNotArray, "loose")).toBe(true);

		expect(isSceneProjectPayload("not an object", "strict")).toBe(false);
		expect(isSceneProjectPayload("not an object", "loose")).toBe(false);
		expect(routeLoadedProject("not an object", "loose")).toBe("recording-editor");
	});
});

describe("media URL round-trip (projectPersistence.ts)", () => {
	it("decodes file:// and legacy lucid://file/ URLs", () => {
		expect(fromFileUrl("file:///C:/Users/a%20b/x.webm")).toBe("C:/Users/a b/x.webm");
		expect(fromFileUrl("lucid://file/C:/Users/a%20b/x.webm")).toBe("C:/Users/a b/x.webm");
		expect(fromFileUrl("C:/Users/plain/path.webm")).toBe("C:/Users/plain/path.webm");
	});

	it("toFileUrl writes studio://file/ URLs", () => {
		// The drive colon comes out percent-encoded: encodePathSegments' keepWindowsDrive
		// expects the drive at segment index 1 (after a leading "/"), but drive paths have
		// it at index 0. Harmless — main's studio:// handler decodeURIComponent()s it.
		expect(toFileUrl("C:\\Users\\a b\\x.webm")).toBe("studio://file/C%3A/Users/a%20b/x.webm");
		expect(toFileUrl("/home/u/x.webm")).toBe("studio://file/home/u/x.webm");
	});

	// KNOWN BUG (plan Appendix A). The Lucid → Studio rename changed toFileUrl
	// to write `studio://file/…` but left isFileUrl() matching only file:// and
	// lucid://, so fromFileUrl returns studio:// URLs unchanged. If one reaches
	// applyLoadedProject, toFileUrl() then double-wraps it into
	// `studio://file/studio%3A//file/C%3A/…` and the video fails to load.
	//
	// Is it user-visible in 0.3.x? Traced every caller in VideoEditor.tsx:
	//  - recording-session paths come from main, which already decodes
	//    studio://file/ (electron/ipc/handlers.ts normalizeVideoSourcePath);
	//  - every setVideoPath(toFileUrl(p)) is paired with setVideoSourcePath(p),
	//    so currentProjectMedia — what saveProject writes — always holds raw
	//    paths and fromFileUrl(videoPath) is never the value that gets used;
	//  - so a studio:// URL only arrives via a project file whose media paths
	//    were written by something other than Studio (hand-edited, external
	//    tool). Main's getApprovedProjectSession accepts such a file (it
	//    normalises studio://), then the renderer breaks it.
	// Verdict: latent, not hit by files Studio itself writes. The v3 migration
	// (§8 step 2.1) must still normalise studio:// and lucid:// URLs.
	//
	// A fix must keep the leading "/" on POSIX paths (the existing lucid://
	// branch strips "lucid://file/" and so turns /home/u/x into home/u/x).
	// When fromFileUrl is fixed, this starts failing: flip it to a plain it().
	it.fails("fromFileUrl round-trips studio://file/ URLs written by toFileUrl", () => {
		for (const p of ["C:/Users/a b/x.webm", "/home/u/x.webm"]) {
			expect(fromFileUrl(toFileUrl(p))).toBe(p);
		}
	});
});
