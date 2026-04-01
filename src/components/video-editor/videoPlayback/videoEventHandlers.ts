import type React from "react";
import type { SpeedRegion, TrimRegion } from "../types";

interface VideoEventHandlersParams {
	video: HTMLVideoElement;
	isSeekingRef: React.MutableRefObject<boolean>;
	isPlayingRef: React.MutableRefObject<boolean>;
	allowPlaybackRef: React.MutableRefObject<boolean>;
	currentTimeRef: React.MutableRefObject<number>;
	timeUpdateAnimationRef: React.MutableRefObject<number | null>;
	onPlayStateChange: (playing: boolean) => void;
	onTimeUpdate: (time: number) => void;
	trimRegionsRef: React.MutableRefObject<TrimRegion[]>;
	speedRegionsRef: React.MutableRefObject<SpeedRegion[]>;
}

export function createVideoEventHandlers(params: VideoEventHandlersParams) {
	const {
		video,
		isSeekingRef,
		isPlayingRef,
		allowPlaybackRef,
		currentTimeRef,
		timeUpdateAnimationRef,
		onPlayStateChange,
		onTimeUpdate,
		trimRegionsRef,
		speedRegionsRef,
	} = params;

	// Track whether we're in the middle of a trim skip to prevent re-entrancy
	let skipInProgress = false;

	const emitTime = (timeValue: number) => {
		currentTimeRef.current = timeValue * 1000;
		onTimeUpdate(timeValue);
	};

	const findActiveTrimRegion = (currentTimeMs: number): TrimRegion | null => {
		return (
			trimRegionsRef.current.find(
				(region) => currentTimeMs >= region.startMs && currentTimeMs < region.endMs,
			) || null
		);
	};

	const findActiveSpeedRegion = (currentTimeMs: number): SpeedRegion | null => {
		return (
			speedRegionsRef.current.find(
				(region) => currentTimeMs >= region.startMs && currentTimeMs < region.endMs,
			) || null
		);
	};

	// Skip past a trim region. Uses a one-shot seeked listener to avoid
	// the animation-frame race condition that caused restart loops.
	function skipTrimRegion(trimRegion: TrimRegion) {
		if (skipInProgress) return;
		const skipToTime = trimRegion.endMs / 1000;

		if (skipToTime >= video.duration) {
			video.pause();
			emitTime(video.duration);
			return;
		}

		skipInProgress = true;

		// Listen for the seek to complete before resuming the animation loop
		const onSkipComplete = () => {
			video.removeEventListener("seeked", onSkipComplete);
			skipInProgress = false;
			emitTime(video.currentTime);

			// Check if we landed in another trim region (back-to-back trims)
			const nextTrim = findActiveTrimRegion(video.currentTime * 1000);
			if (nextTrim && !video.paused) {
				skipTrimRegion(nextTrim);
			} else if (!video.paused && !video.ended) {
				// Resume the animation frame loop
				timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
			}
		};

		video.addEventListener("seeked", onSkipComplete, { once: true });
		video.currentTime = skipToTime;
	}

	function updateTime() {
		if (!video || video.paused || video.ended) return;

		const currentTimeMs = video.currentTime * 1000;
		const activeTrimRegion = findActiveTrimRegion(currentTimeMs);

		if (activeTrimRegion && !skipInProgress) {
			// Cancel the animation loop — skipTrimRegion will restart it after the seek
			if (timeUpdateAnimationRef.current) {
				cancelAnimationFrame(timeUpdateAnimationRef.current);
				timeUpdateAnimationRef.current = null;
			}
			skipTrimRegion(activeTrimRegion);
			return;
		}

		// Apply playback speed from active speed region
		const activeSpeedRegion = findActiveSpeedRegion(currentTimeMs);
		video.playbackRate = activeSpeedRegion ? activeSpeedRegion.speed : 1;
		emitTime(video.currentTime);

		if (!video.paused && !video.ended) {
			timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
		}
	}

	const handlePlay = () => {
		if (isSeekingRef.current) {
			video.pause();
			return;
		}

		if (!allowPlaybackRef.current) {
			video.pause();
			return;
		}

		isPlayingRef.current = true;
		onPlayStateChange(true);
		if (timeUpdateAnimationRef.current) {
			cancelAnimationFrame(timeUpdateAnimationRef.current);
		}
		timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
	};

	const handlePause = () => {
		isPlayingRef.current = false;
		onPlayStateChange(false);
		if (timeUpdateAnimationRef.current) {
			cancelAnimationFrame(timeUpdateAnimationRef.current);
			timeUpdateAnimationRef.current = null;
		}
		emitTime(video.currentTime);
	};

	const handleSeeked = () => {
		isSeekingRef.current = false;

		// If a skip is in progress, let the skipTrimRegion handler deal with it
		if (skipInProgress) return;

		const currentTimeMs = video.currentTime * 1000;
		const activeTrimRegion = findActiveTrimRegion(currentTimeMs);

		if (activeTrimRegion && isPlayingRef.current && !video.paused) {
			skipTrimRegion(activeTrimRegion);
		} else {
			if (!isPlayingRef.current && !video.paused) {
				video.pause();
			}
			emitTime(video.currentTime);
		}
	};

	const handleSeeking = () => {
		isSeekingRef.current = true;
		emitTime(video.currentTime);
	};

	return {
		handlePlay,
		handlePause,
		handleSeeked,
		handleSeeking,
	};
}
