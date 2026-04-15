// ── anime.js v4 + Remotion Integration ──────────────────────────────────
//
// Bridges anime.js v4 timelines to Remotion's frame-based rendering model.
// Key pattern: create animations with autoplay:false, then seek() per frame.
//
// anime.js v4 API:
//   createTimeline()  (was anime.timeline())
//   animate()         (was anime())
//   stagger()         (was anime.stagger())

import {
	animate,
	createTimeline,
	type JSAnimation,
	type TargetsParam,
	type Timeline,
} from "animejs";
import { stagger } from "animejs/utils";
import { useEffect, useId, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Hook that creates an anime.js v4 timeline synced to Remotion frames.
 *
 * The timeline is created once with autoplay:false, then seeked to the
 * correct millisecond position on every frame. This produces deterministic,
 * frame-accurate output compatible with Remotion's concurrent rendering.
 *
 * @param factory - Function that builds the timeline. Receives a `targets`
 *   helper that scopes CSS selectors to the container element.
 * @param deps - Dependencies array for re-creating the timeline
 * @returns Ref to attach to the container element
 *
 * @example
 * ```tsx
 * const containerRef = useAnimeTimeline((targets) =>
 *   createTimeline({ autoplay: false })
 *     .add(targets('.title'), { translateY: [-50, 0], opacity: [0, 1], duration: 600 })
 *     .add(targets('.subtitle'), { opacity: [0, 1], duration: 400 }, '-=200')
 * );
 *
 * return (
 *   <div ref={containerRef}>
 *     <h1 className="title">Hello</h1>
 *     <p className="subtitle">World</p>
 *   </div>
 * );
 * ```
 */
export function useAnimeTimeline(
	factory: (targets: (selector: string) => string) => Timeline,
	deps: any[] = [],
): React.RefObject<HTMLDivElement> {
	const containerRef = useRef<HTMLDivElement>(null!);
	const timelineRef = useRef<Timeline | null>(null);
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const id = useId().split(":").join("_");

	// Create the timeline once (or when deps change)
	useEffect(() => {
		if (!containerRef.current) return;

		// Assign a unique data attribute for scoped targeting
		containerRef.current.setAttribute("data-anime-scope", id);

		// Helper that scopes selectors to this container
		const targets = (selector: string) => `[data-anime-scope="${id}"] ${selector}`;

		timelineRef.current = factory(targets);

		return () => {
			if (timelineRef.current) {
				timelineRef.current.pause();
				timelineRef.current = null;
			}
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: deps is caller-provided; this hook exposes anime.js's timeline API which takes deps as a user param, same shape as useEffect itself
	}, deps);

	// Seek to current frame position
	useEffect(() => {
		if (!timelineRef.current) return;
		const ms = (frame / fps) * 1000;
		timelineRef.current.seek(ms % (timelineRef.current.duration || 1));
	}, [frame, fps]);

	return containerRef;
}

/**
 * Hook for a single anime.js animation (not a timeline).
 * Simpler API for one-off animations.
 *
 * @example
 * ```tsx
 * const ref = useAnimeAnimation({
 *   translateX: 270,
 *   easing: 'easeInOutQuad',
 *   duration: 900,
 * });
 *
 * return <div ref={ref} style={{ width: 100, height: 100, background: 'blue' }} />;
 * ```
 */
export function useAnimeAnimation(
	params: Record<string, any>,
	deps: any[] = [],
): React.RefObject<HTMLDivElement> {
	const ref = useRef<HTMLDivElement>(null!);
	const animRef = useRef<JSAnimation | null>(null);
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	useEffect(() => {
		if (!ref.current) return;
		animRef.current = animate(ref.current, {
			autoplay: false,
			...params,
		});
		return () => {
			animRef.current = null;
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: deps is caller-provided; same pattern as useAnimeTimeline above
	}, deps);

	useEffect(() => {
		if (!animRef.current) return;
		const ms = (frame / fps) * 1000;
		const dur = animRef.current.duration || 1;
		animRef.current.seek(params.loop ? ms % dur : Math.min(ms, dur));
	}, [frame, fps, params.loop]);

	return ref;
}

// ── Pre-built Animation Presets ────────────────────────────────────────

export type AnimePresetFactory = (targets: (selector: string) => string) => Timeline;

/**
 * Pre-built anime.js animation presets for common video patterns.
 * Each returns a factory function compatible with useAnimeTimeline.
 *
 * anime.js v4 API: createTimeline().add(targets, params, offset)
 */
export const ANIME_PRESETS = {
	/** Staggered text reveal — elements appear one by one with spring-like motion */
	staggerReveal: (opts?: {
		staggerMs?: number;
		easing?: string;
		translateY?: number;
	}): AnimePresetFactory => {
		const { staggerMs = 80, easing = "outElastic(1, .6)", translateY = 40 } = opts ?? {};
		return (targets) =>
			createTimeline({ autoplay: false }).add(targets("[data-stagger-item]") as TargetsParam, {
				translateY: [translateY, 0],
				opacity: [0, 1],
				ease: easing,
				duration: 800,
				delay: stagger(staggerMs),
			});
	},

	/** Counter animation — number counts up from 0 to final value */
	counterUp: (opts?: { duration?: number }): AnimePresetFactory => {
		const { duration = 1200 } = opts ?? {};
		return (targets) =>
			createTimeline({ autoplay: false })
				// Function-valued props confuse TS overload resolution but work at runtime
				.add(
					targets("[data-counter]") as TargetsParam,
					{
						innerHTML: [0, 100],
						ease: "inOutExpo",
						duration,
					} as any,
				);
	},

	/** Cards fanning in from a stacked position */
	cardFan: (opts?: { spread?: number }): AnimePresetFactory => {
		const { spread = 20 } = opts ?? {};
		return (targets) =>
			createTimeline({ autoplay: false })
				// Per-element function values confuse TS overload resolution but work at runtime
				.add(
					targets("[data-card]") as TargetsParam,
					{
						translateX: [0, spread],
						rotate: [0, 5],
						opacity: [0, 1],
						ease: "outBack",
						duration: 600,
						delay: stagger(100),
					} as any,
				);
	},

	/** Elastic bounce entrance */
	elasticEntrance: (opts?: { startScale?: number }): AnimePresetFactory => {
		const { startScale = 0 } = opts ?? {};
		return (targets) =>
			createTimeline({ autoplay: false }).add(targets("[data-elastic]") as TargetsParam, {
				scale: [startScale, 1],
				opacity: [0, 1],
				ease: "outElastic(1, .5)",
				duration: 1000,
				delay: stagger(120),
			});
	},

	/** Staggered list items sliding in from a direction */
	listStagger: (opts?: { direction?: "up" | "down" | "left" | "right" }): AnimePresetFactory => {
		const { direction = "up" } = opts ?? {};
		const prop = direction === "up" || direction === "down" ? "translateY" : "translateX";
		const dist = direction === "down" || direction === "right" ? -30 : 30;
		return (targets) =>
			createTimeline({ autoplay: false }).add(targets("[data-list-item]") as TargetsParam, {
				[prop]: [dist, 0],
				opacity: [0, 1],
				ease: "outQuart",
				duration: 500,
				delay: stagger(60),
			});
	},

	/** Pulsing glow effect — element pulses in size and glow */
	pulseGlow: (opts?: { maxScale?: number }): AnimePresetFactory => {
		const { maxScale = 1.05 } = opts ?? {};
		return (targets) =>
			createTimeline({ autoplay: false, loop: true }).add(targets("[data-pulse]") as TargetsParam, {
				scale: [1, maxScale, 1],
				ease: "inOutSine",
				duration: 1500,
			});
	},
};
