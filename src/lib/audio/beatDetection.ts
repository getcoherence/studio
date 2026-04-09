// ── Beat Detection ──────────────────────────────────────────────────────
//
// Detects BPM and beat timestamps from an audio file using Web Audio API.
// Uses energy-based onset detection with autocorrelation for BPM estimation.

/**
 * Detect BPM and beat timestamps from an audio file path.
 * Returns the estimated BPM and an array of beat times in seconds.
 */
export async function detectBeats(audioPath: string): Promise<{ bpm: number; beats: number[] }> {
	// Load audio file as ArrayBuffer
	const response = await window.electronAPI.readBinaryFile(audioPath);
	if (!response.success || !response.data) {
		throw new Error("Failed to read audio file");
	}

	const audioCtx = new AudioContext();
	const audioBuffer = await audioCtx.decodeAudioData(response.data);
	audioCtx.close();

	// Get mono channel data
	const channelData = audioBuffer.getChannelData(0);
	const sampleRate = audioBuffer.sampleRate;

	// 1. Compute energy envelope (RMS in windows)
	const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
	const hopSize = Math.floor(windowSize / 2);
	const energies: number[] = [];

	for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
		let sum = 0;
		for (let j = 0; j < windowSize; j++) {
			sum += channelData[i + j] * channelData[i + j];
		}
		energies.push(Math.sqrt(sum / windowSize));
	}

	// 2. Detect onsets (energy peaks above local average)
	const onsets: number[] = [];
	const avgWindow = 20; // ~200ms context
	const threshold = 1.4; // onset must be 1.4x local average
	const minGapSamples = 8; // minimum gap between onsets (~80ms)

	for (let i = avgWindow; i < energies.length - avgWindow; i++) {
		let localAvg = 0;
		for (let j = i - avgWindow; j < i + avgWindow; j++) {
			localAvg += energies[j];
		}
		localAvg /= avgWindow * 2;

		if (
			energies[i] > localAvg * threshold &&
			energies[i] > energies[i - 1] &&
			energies[i] >= energies[i + 1]
		) {
			// Check minimum gap from last onset
			if (onsets.length === 0 || i - onsets[onsets.length - 1] >= minGapSamples) {
				onsets.push(i);
			}
		}
	}

	// 3. Estimate BPM via autocorrelation of onset signal
	const onsetSignal = new Float32Array(energies.length);
	for (const onset of onsets) {
		if (onset < onsetSignal.length) onsetSignal[onset] = 1;
	}

	// Search BPM range 60-200
	const minLag = Math.floor(energies.length / ((200 / 60) * audioBuffer.duration));
	const maxLag = Math.floor(energies.length / ((60 / 60) * audioBuffer.duration));
	const framesPerSec = energies.length / audioBuffer.duration;

	let bestLag = minLag;
	let bestCorr = -Infinity;

	for (let lag = Math.max(1, minLag); lag <= Math.min(maxLag, onsetSignal.length / 2); lag++) {
		let corr = 0;
		for (let i = 0; i < onsetSignal.length - lag; i++) {
			corr += onsetSignal[i] * onsetSignal[i + lag];
		}
		if (corr > bestCorr) {
			bestCorr = corr;
			bestLag = lag;
		}
	}

	const bpm = Math.round((framesPerSec / bestLag) * 60);
	// Clamp to reasonable range
	const clampedBpm = Math.max(60, Math.min(200, bpm));

	// 4. Generate beat grid from BPM
	const beatInterval = 60 / clampedBpm; // seconds per beat
	const beats: number[] = [];

	// Find the first strong onset as the downbeat
	const firstOnsetTime = onsets.length > 0 ? (onsets[0] * hopSize) / sampleRate : 0;

	// Align beat grid to nearest beat from the first onset
	const gridStart = firstOnsetTime % beatInterval;
	for (let t = gridStart; t < audioBuffer.duration; t += beatInterval) {
		beats.push(Math.round(t * 1000) / 1000); // round to ms
	}

	return { bpm: clampedBpm, beats };
}

/**
 * Snap scene durations to a beat grid.
 * Each scene boundary is moved to the nearest beat, maintaining scene order.
 * Returns new durationFrames for each scene.
 */
export function snapScenesToBeats(sceneDurations: number[], beats: number[], fps = 30): number[] {
	if (beats.length === 0 || sceneDurations.length === 0) return sceneDurations;

	const beatFrames = beats.map((t) => Math.round(t * fps));
	const totalFrames = sceneDurations.reduce((sum, d) => sum + d, 0);

	// Calculate current scene boundaries (cumulative)
	const boundaries: number[] = [];
	let cumulative = 0;
	for (const dur of sceneDurations) {
		cumulative += dur;
		boundaries.push(cumulative);
	}

	// Snap each boundary to the nearest beat
	const snappedBoundaries = boundaries.map((boundary) => {
		let nearest = beatFrames[0];
		let minDist = Math.abs(boundary - nearest);
		for (const beat of beatFrames) {
			const dist = Math.abs(boundary - beat);
			if (dist < minDist) {
				minDist = dist;
				nearest = beat;
			}
		}
		return nearest;
	});

	// Ensure last boundary doesn't exceed total (keep video length similar)
	snappedBoundaries[snappedBoundaries.length - 1] = Math.min(
		snappedBoundaries[snappedBoundaries.length - 1],
		totalFrames + Math.round(fps), // allow up to 1 second longer
	);

	// Convert boundaries back to durations, ensuring minimum 15 frames per scene
	const newDurations: number[] = [];
	let prev = 0;
	for (let i = 0; i < snappedBoundaries.length; i++) {
		const dur = Math.max(15, snappedBoundaries[i] - prev);
		newDurations.push(dur);
		prev += dur;
	}

	return newDurations;
}
