import { renderScene } from "./sceneRenderer";
import { captureCanvas, renderTransition } from "./transitionRenderer";
import type { SceneProject } from "./types";

export interface SceneExportProgress {
	phase: "rendering" | "encoding" | "muxing";
	progress: number; // 0-1
	currentScene: number;
	totalScenes: number;
}

export async function exportSceneProject(
	project: SceneProject,
	options: {
		fps?: number;
		quality?: "low" | "medium" | "high";
		onProgress?: (progress: SceneExportProgress) => void;
	},
): Promise<Blob> {
	const fps = options.fps || 30;
	const width = project.resolution?.width || 1920;
	const height = project.resolution?.height || 1080;

	// Calculate total frames including transitions
	let totalDurationMs = 0;
	for (let i = 0; i < project.scenes.length; i++) {
		totalDurationMs += project.scenes[i].durationMs;
		// Add transition duration between scenes (transition belongs to the incoming scene)
		if (i > 0) {
			const trans = project.scenes[i].transition;
			if (trans.type !== "none" && trans.durationMs > 0) {
				totalDurationMs += trans.durationMs;
			}
		}
	}
	const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);

	// Create offscreen canvas
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;

	// Use MediaRecorder on a canvas capture stream
	const stream = canvas.captureStream(0); // 0 = manual frame capture
	const videoBps =
		options.quality === "high" ? 8_000_000 : options.quality === "low" ? 2_000_000 : 4_000_000;

	// Try VP9, fall back to VP8
	const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
		? "video/webm;codecs=vp9"
		: "video/webm;codecs=vp8";

	const recorder = new MediaRecorder(stream, {
		mimeType,
		videoBitsPerSecond: videoBps,
	});

	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};

	return new Promise<Blob>((resolve, reject) => {
		recorder.onstop = () => {
			resolve(new Blob(chunks, { type: "video/webm" }));
		};
		recorder.onerror = (e) => reject(e);
		recorder.start();

		// Get the video track to request frames manually
		const videoTrack = stream.getVideoTracks()[0];

		const frameDuration = 1000 / fps;

		// Build a timeline of segments: scene-content and transitions
		interface Segment {
			type: "scene" | "transition";
			durationMs: number;
			sceneIndex: number; // for scene segments, or the incoming scene index for transitions
		}
		const segments: Segment[] = [];
		for (let i = 0; i < project.scenes.length; i++) {
			// Transition into this scene (if applicable)
			if (i > 0) {
				const trans = project.scenes[i].transition;
				if (trans.type !== "none" && trans.durationMs > 0) {
					segments.push({ type: "transition", durationMs: trans.durationMs, sceneIndex: i });
				}
			}
			segments.push({ type: "scene", durationMs: project.scenes[i].durationMs, sceneIndex: i });
		}

		let frameIndex = 0;
		let segIndex = 0;
		let segTimeMs = 0;

		// Cache for outgoing scene's last frame
		let lastSceneCanvas: HTMLCanvasElement | null = null;

		function renderNextFrame() {
			if (frameIndex >= totalFrames || segIndex >= segments.length) {
				recorder.stop();
				return;
			}

			// Advance through segments
			while (segIndex < segments.length && segTimeMs >= segments[segIndex].durationMs) {
				const seg = segments[segIndex];
				// If a scene segment just ended, capture its last frame for potential transition
				if (seg.type === "scene") {
					renderScene(ctx, project.scenes[seg.sceneIndex], seg.durationMs, width, height);
					lastSceneCanvas = captureCanvas(ctx, width, height);
				}
				segTimeMs -= segments[segIndex].durationMs;
				segIndex++;
			}

			if (segIndex >= segments.length) {
				recorder.stop();
				return;
			}

			const seg = segments[segIndex];

			if (seg.type === "scene") {
				// Normal scene rendering
				renderScene(ctx, project.scenes[seg.sceneIndex], segTimeMs, width, height);
			} else {
				// Transition rendering
				const trans = project.scenes[seg.sceneIndex].transition;
				const progress = segTimeMs / seg.durationMs;

				// Outgoing: use cached last frame
				const fromCanvas = lastSceneCanvas ?? createBlackCanvas(width, height);

				// Incoming: render first frame of the next scene
				const toCanvas = document.createElement("canvas");
				toCanvas.width = width;
				toCanvas.height = height;
				const toCtx = toCanvas.getContext("2d")!;
				renderScene(toCtx, project.scenes[seg.sceneIndex], 0, width, height);

				renderTransition(ctx, fromCanvas, toCanvas, progress, trans.type, width, height);
			}

			// Request a frame from the capture stream
			if (videoTrack && "requestFrame" in videoTrack) {
				(videoTrack as MediaStreamVideoTrack & { requestFrame(): void }).requestFrame();
			}

			const currentSceneIndex =
				segments[segIndex].type === "scene"
					? segments[segIndex].sceneIndex
					: segments[segIndex].sceneIndex;

			options.onProgress?.({
				phase: "rendering",
				progress: frameIndex / totalFrames,
				currentScene: currentSceneIndex + 1,
				totalScenes: project.scenes.length,
			});

			segTimeMs += frameDuration;
			frameIndex++;

			// Use requestAnimationFrame to avoid blocking the UI
			requestAnimationFrame(renderNextFrame);
		}

		renderNextFrame();
	});
}

function createBlackCanvas(width: number, height: number): HTMLCanvasElement {
	const c = document.createElement("canvas");
	c.width = width;
	c.height = height;
	const ctx = c.getContext("2d")!;
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, width, height);
	return c;
}
