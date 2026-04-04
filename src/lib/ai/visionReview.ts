// ── Vision Review ───────────────────────────────────────────────────────
//
// Captures frames from the Remotion Player, sends them to a vision AI
// model for critique, and returns actionable feedback.
//
// This is the "AI reviews its own work" system — catches visual issues
// that code-level review can't: text clipping, bad contrast, layout
// problems, missing content, ugly compositions.

import html2canvas from "html2canvas";

export interface VisionReviewResult {
	score: number; // 1-10
	issues: string[];
	suggestions: string[];
	error?: string;
}

/**
 * Capture frames from a player element and send to vision AI for review.
 * @param playerElement The DOM element containing the Remotion Player
 * @param seekToFrame Function to seek the player to a specific frame
 * @param totalFrames Total frames in the composition
 * @param onStatus Progress callback
 */
export async function reviewCompositionVisually(
	playerElement: HTMLElement,
	seekToFrame: (frame: number) => void,
	totalFrames: number,
	onStatus?: (msg: string) => void,
): Promise<VisionReviewResult> {
	const framePositions = [
		0, // Opening
		Math.floor(totalFrames * 0.25), // Quarter
		Math.floor(totalFrames * 0.5), // Middle
		Math.floor(totalFrames * 0.75), // Three-quarters
		totalFrames - 2, // Closing (not last frame which might be blank)
	];

	const screenshots: string[] = [];

	onStatus?.("Capturing key frames for review...");

	for (let i = 0; i < framePositions.length; i++) {
		const frame = framePositions[i];
		seekToFrame(frame);

		// Wait for render to settle
		await new Promise((r) => setTimeout(r, 300));

		try {
			const canvas = await html2canvas(playerElement, {
				width: playerElement.offsetWidth,
				height: playerElement.offsetHeight,
				backgroundColor: "#000000",
				scale: 0.5, // Half resolution for faster upload
				logging: false,
				useCORS: true,
			});
			const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
			// Strip the data:image/jpeg;base64, prefix
			const base64 = dataUrl.split(",")[1];
			if (base64) screenshots.push(base64);
		} catch (err) {
			console.warn(`Failed to capture frame ${frame}:`, err);
		}
	}

	if (screenshots.length === 0) {
		return {
			score: 5,
			issues: ["Could not capture frames for review"],
			suggestions: [],
			error: "Frame capture failed",
		};
	}

	onStatus?.(`Analyzing ${screenshots.length} frames with vision AI...`);

	// Send the middle frame (most representative) to vision AI
	const bestFrame = screenshots[Math.floor(screenshots.length / 2)];

	try {
		const result = await window.electronAPI.aiAnalyzeImage(
			[
				"You are reviewing a frame from a cinematic product video. Score it 1-10 and list issues.",
				"",
				"Check for:",
				"1. Text readability: Is text large enough? Good contrast? Not clipped?",
				"2. Layout: Are elements well-positioned? No overlapping? Proper spacing?",
				"3. Visual quality: Clean backgrounds? Professional look? Not cluttered?",
				"4. Typography: Consistent fonts? Good weight? Readable at video scale?",
				"5. Color: Good contrast? Brand colors used well? Not garish?",
				"",
				"Respond in this exact JSON format:",
				'{ "score": 8, "issues": ["text too small in bottom area"], "suggestions": ["increase font size to 32px+"] }',
				"",
				"JSON only, no markdown.",
			].join("\n"),
			bestFrame,
			"You review video frames for quality. Respond ONLY in JSON format.",
		);

		if (!result?.success || !result.text) {
			return {
				score: 5,
				issues: ["Vision review failed — no response"],
				suggestions: [],
				error: result?.error,
			};
		}

		// Parse JSON response
		try {
			let jsonStr = result.text.trim();
			const fenceMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)```/);
			if (fenceMatch) jsonStr = fenceMatch[1].trim();

			const review = JSON.parse(jsonStr);
			return {
				score: review.score || 5,
				issues: Array.isArray(review.issues) ? review.issues : [],
				suggestions: Array.isArray(review.suggestions) ? review.suggestions : [],
			};
		} catch {
			return {
				score: 5,
				issues: ["Could not parse vision review response"],
				suggestions: [result.text.slice(0, 200)],
			};
		}
	} catch (err) {
		return {
			score: 5,
			issues: ["Vision review failed"],
			suggestions: [],
			error: String(err),
		};
	}
}
