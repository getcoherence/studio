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

	// Send multiple frames for a holistic review
	// Pick opening, middle, and closing frames for story + visual review
	const frameIndices = [0, Math.floor(screenshots.length / 2), screenshots.length - 1];
	const selectedFrames = frameIndices
		.map((i) => screenshots[Math.min(i, screenshots.length - 1)])
		.filter(Boolean);
	const bestFrame = selectedFrames[0]; // Use first frame for single-image API

	try {
		const result = await window.electronAPI.aiAnalyzeImage(
			[
				"You are a creative director reviewing frames from a cinematic product video.",
				"Score it 1-10 and provide feedback on BOTH design quality AND storytelling.",
				"",
				"## DESIGN QUALITY (does it look like a premium agency made it?)",
				"1. Typography: Bold, large, cinematic? Or small and generic?",
				"2. Composition: Clean focal point? Breathing room? Or cluttered?",
				"3. Color: Strong contrast? Premium feel? Or flat and boring?",
				"4. Motion design feel: Does this frame look like it's from a real brand video?",
				"   Or does it look like a PowerPoint slide?",
				"",
				"## STORYTELLING (would this make someone want to try the product?)",
				"5. Does the text feel emotional and compelling? Or generic and corporate?",
				"6. Is there a clear message? Or just buzzwords?",
				"7. Would a viewer stop scrolling for this? Or keep going?",
				"",
				"## TECHNICAL",
				"8. Text readability, contrast, clipping",
				"9. Layout and spacing",
				"",
				"Be honest and specific. A score of 7+ means 'looks like a real agency made this.'",
				"A score below 5 means 'looks AI-generated or like a slideshow.'",
				"",
				"Respond in this exact JSON format:",
				'{ "score": 7, "issues": ["headline feels generic — says what the product does instead of why it matters"], "suggestions": ["rewrite headline to address viewer emotion, not product features"] }',
				"",
				"JSON only, no markdown.",
			].join("\n"),
			bestFrame,
			"You are a creative director reviewing video frames for design quality and storytelling impact. Respond ONLY in JSON format.",
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
