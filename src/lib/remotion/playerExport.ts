// ── Player Export ───────────────────────────────────────────────────────
//
// Exports an AI Cinematic composition by recording the Remotion Player's
// DOM output using html2canvas + MediaRecorder.
//
// This captures exactly what the user sees in the preview.

import html2canvas from "html2canvas";

export interface PlayerExportOptions {
	playerElement: HTMLElement;
	durationMs: number;
	fps?: number;
	seekToFrame: (frame: number) => void;
	onProgress?: (progress: number) => void;
}

/**
 * Export the Remotion Player by capturing each frame with html2canvas
 * and encoding to WebM via MediaRecorder.
 */
export async function exportPlayerToVideo(options: PlayerExportOptions): Promise<Blob> {
	const { playerElement, durationMs, fps = 30, seekToFrame, onProgress } = options;
	const totalFrames = Math.ceil((durationMs / 1000) * fps);
	const frameInterval = 1000 / fps;

	// Create capture canvas
	const captureCanvas = document.createElement("canvas");
	captureCanvas.width = 1920;
	captureCanvas.height = 1080;
	const ctx = captureCanvas.getContext("2d")!;

	// Set up MediaRecorder
	const stream = captureCanvas.captureStream(0); // 0 = manual frame push
	const recorder = new MediaRecorder(stream, {
		mimeType: "video/webm;codecs=vp9",
		videoBitsPerSecond: 8_000_000,
	});

	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};

	return new Promise<Blob>(async (resolve, reject) => {
		recorder.onstop = () => {
			resolve(new Blob(chunks, { type: "video/webm" }));
		};
		recorder.onerror = () => reject(new Error("MediaRecorder error"));
		recorder.start();

		for (let frame = 0; frame < totalFrames; frame++) {
			// Seek player to this frame
			seekToFrame(frame);

			// Wait for render
			await new Promise((r) => setTimeout(r, 50));

			// Capture the player DOM
			try {
				const captured = await html2canvas(playerElement, {
					width: playerElement.offsetWidth,
					height: playerElement.offsetHeight,
					backgroundColor: "#000000",
					scale: 1920 / playerElement.offsetWidth,
					logging: false,
					useCORS: true,
				});

				ctx.clearRect(0, 0, 1920, 1080);
				ctx.drawImage(captured, 0, 0, 1920, 1080);

				// Push frame to MediaRecorder
				const track = stream.getVideoTracks()[0] as any;
				if (track?.requestFrame) {
					track.requestFrame();
				}
			} catch {
				// Black frame on error
				ctx.fillStyle = "#000";
				ctx.fillRect(0, 0, 1920, 1080);
			}

			onProgress?.(frame / totalFrames);

			// Small delay to prevent UI freeze
			if (frame % 10 === 0) {
				await new Promise((r) => setTimeout(r, 10));
			}
		}

		// Final frame delay then stop
		await new Promise((r) => setTimeout(r, 100));
		recorder.stop();
	});
}
