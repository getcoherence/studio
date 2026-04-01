import { renderScene } from "./sceneRenderer";
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

	// Calculate total frames across all scenes
	const totalDurationMs = project.scenes.reduce((sum, s) => sum + s.durationMs, 0);
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

		let frameIndex = 0;
		let sceneIndex = 0;
		let sceneTimeMs = 0;
		const frameDuration = 1000 / fps;

		function renderNextFrame() {
			if (frameIndex >= totalFrames) {
				recorder.stop();
				return;
			}

			// Advance through scenes
			while (
				sceneIndex < project.scenes.length &&
				sceneTimeMs >= project.scenes[sceneIndex].durationMs
			) {
				sceneTimeMs -= project.scenes[sceneIndex].durationMs;
				sceneIndex++;
			}

			if (sceneIndex >= project.scenes.length) {
				recorder.stop();
				return;
			}

			const scene = project.scenes[sceneIndex];
			renderScene(ctx, scene, sceneTimeMs, width, height);

			// Request a frame from the capture stream
			if (videoTrack && "requestFrame" in videoTrack) {
				(videoTrack as MediaStreamVideoTrack & { requestFrame(): void }).requestFrame();
			}

			options.onProgress?.({
				phase: "rendering",
				progress: frameIndex / totalFrames,
				currentScene: sceneIndex + 1,
				totalScenes: project.scenes.length,
			});

			sceneTimeMs += frameDuration;
			frameIndex++;

			// Use requestAnimationFrame to avoid blocking the UI
			requestAnimationFrame(renderNextFrame);
		}

		renderNextFrame();
	});
}
