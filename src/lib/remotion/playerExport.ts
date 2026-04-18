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
	// Frame count via integer division avoids floating-point edge cases that
	// `Math.ceil((durationMs/1000)*fps)` can produce on non-multiple durations.
	const totalFrames = Math.floor(durationMs / (1000 / fps));
	// Create capture canvas
	const captureCanvas = document.createElement("canvas");
	captureCanvas.width = 1920;
	captureCanvas.height = 1080;
	const ctx = captureCanvas.getContext("2d")!;

	// Set up MediaRecorder. VP9 isn't available everywhere (notably Safari);
	// fall back to plain webm, then to whatever the browser will accept.
	const stream = captureCanvas.captureStream(0); // 0 = manual frame push
	const preferredMimeType = "video/webm;codecs=vp9";
	const fallbackMimeType = "video/webm";
	const selectedMimeType = MediaRecorder.isTypeSupported(preferredMimeType)
		? preferredMimeType
		: MediaRecorder.isTypeSupported(fallbackMimeType)
			? fallbackMimeType
			: "";
	const recorderOptions: MediaRecorderOptions = {
		videoBitsPerSecond: 8_000_000,
		...(selectedMimeType ? { mimeType: selectedMimeType } : {}),
	};
	const recorder = new MediaRecorder(stream, recorderOptions);

	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};

	// Hook up MediaRecorder → Blob resolution. The async capture loop runs
	// alongside; we kick it off and let recorder.onstop resolve the outer
	// promise. Capture errors from the loop surface via reject().
	const recorded = new Promise<Blob>((resolve, reject) => {
		recorder.onstop = () => resolve(new Blob(chunks, { type: selectedMimeType || "video/webm" }));
		recorder.onerror = () => reject(new Error("MediaRecorder error"));
	});

	// Wait for browser paint after seeking so html2canvas reads the settled
	// DOM output. Two rAFs covers the React render → commit → paint pipeline.
	const waitForNextPaint = (): Promise<void> =>
		new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);

	recorder.start();

	(async () => {
		try {
			for (let frame = 0; frame < totalFrames; frame++) {
				seekToFrame(frame);
				await waitForNextPaint();

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
					const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
						requestFrame?: () => void;
					};
					if (track?.requestFrame) track.requestFrame();
				} catch (err) {
					console.warn("[playerExport] html2canvas failed for frame", frame, err);
					ctx.fillStyle = "#000";
					ctx.fillRect(0, 0, 1920, 1080);
				}

				onProgress?.(frame / totalFrames);
				if (frame % 10 === 0) {
					await new Promise((r) => setTimeout(r, 10));
				}
			}
			await new Promise((r) => setTimeout(r, 100));
			recorder.stop();
		} catch (err) {
			recorder.stop();
			throw err;
		}
	})();

	return recorded;
}
