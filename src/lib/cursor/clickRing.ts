/**
 * Click ring animation.
 *
 * An expanding, fading ring triggered when a click event is detected in
 * the cursor telemetry.
 */

export interface ClickRingState {
	x: number;
	y: number;
	radius: number;
	opacity: number;
	color: string;
}

/** Duration of the ring animation in seconds. */
const RING_DURATION_S = 0.4;

/** Start radius as a fraction of the base cursor size. */
const START_RADIUS_FACTOR = 1;
/** End radius as a fraction of the base cursor size. */
const END_RADIUS_FACTOR = 3;

const CLICK_COLORS: Record<string, string> = {
	left: "#34B27B", // green (matches the app's accent)
	right: "#3B82F6", // blue
	double: "#F59E0B", // amber
	middle: "#8B5CF6", // purple
};

export class ClickRingAnimation {
	private x = 0;
	private y = 0;
	private elapsed = 0;
	private _active = false;
	private color = CLICK_COLORS.left;
	private baseCursorSize = 24; // pixels

	/**
	 * Trigger a new ring animation at the given position.
	 * @param x    Normalised X (0-1)
	 * @param y    Normalised Y (0-1)
	 * @param type Click type
	 * @param cursorSize Optional base cursor size in pixels for radius calculation
	 */
	trigger(
		x: number,
		y: number,
		type: "left" | "right" | "double" | "middle" = "left",
		cursorSize = 24,
	): void {
		this.x = x;
		this.y = y;
		this.elapsed = 0;
		this._active = true;
		this.color = CLICK_COLORS[type] ?? CLICK_COLORS.left;
		this.baseCursorSize = cursorSize;
	}

	/**
	 * Advance the animation.
	 * @param dt Time step in seconds.
	 */
	update(dt: number): void {
		if (!this._active) return;
		this.elapsed += dt;
		if (this.elapsed >= RING_DURATION_S) {
			this._active = false;
		}
	}

	isActive(): boolean {
		return this._active;
	}

	getState(): ClickRingState {
		const progress = Math.min(1, this.elapsed / RING_DURATION_S);
		// Ease-out cubic for a smooth expansion
		const eased = 1 - (1 - progress) ** 3;
		const radius =
			this.baseCursorSize *
			(START_RADIUS_FACTOR + (END_RADIUS_FACTOR - START_RADIUS_FACTOR) * eased);
		const opacity = 1 - eased;

		return {
			x: this.x,
			y: this.y,
			radius,
			opacity,
			color: this.color,
		};
	}
}

/**
 * Manages a pool of click ring animations so multiple can overlap.
 */
export class ClickRingPool {
	private rings: ClickRingAnimation[] = [];
	private readonly maxRings: number;

	constructor(maxRings = 8) {
		this.maxRings = maxRings;
	}

	trigger(
		x: number,
		y: number,
		type: "left" | "right" | "double" | "middle" = "left",
		cursorSize = 24,
	): void {
		// Reuse an inactive ring or create a new one
		let ring = this.rings.find((r) => !r.isActive());
		if (!ring) {
			if (this.rings.length >= this.maxRings) {
				// Evict the oldest
				ring = this.rings.shift()!;
			} else {
				ring = new ClickRingAnimation();
				this.rings.push(ring);
			}
		}
		ring.trigger(x, y, type, cursorSize);
	}

	update(dt: number): void {
		for (const ring of this.rings) {
			ring.update(dt);
		}
	}

	getActiveStates(): ClickRingState[] {
		return this.rings.filter((r) => r.isActive()).map((r) => r.getState());
	}

	reset(): void {
		this.rings = [];
	}
}
