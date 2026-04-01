/**
 * Cursor sway effect.
 *
 * Computes a rotation angle from cursor movement velocity so that the
 * cursor tilts in the direction of travel.  Faster movement produces
 * more rotation, with smooth interpolation of the angle over time.
 */

/** Maximum rotation in radians (~18 degrees). */
const MAX_ROTATION_RAD = Math.PI / 10;

/**
 * Compute an instantaneous sway rotation based on cursor velocity.
 *
 * @param dx        Horizontal velocity (normalised units per frame)
 * @param dy        Vertical velocity (normalised units per frame)
 * @param intensity Effect intensity 0-1 (0 = off, 1 = full)
 * @returns         Rotation in radians (negative = tilt left, positive = tilt right)
 */
export function computeCursorSway(dx: number, dy: number, intensity: number): number {
	if (intensity <= 0) return 0;

	// Velocity magnitude in normalised space
	const speed = Math.sqrt(dx * dx + dy * dy);

	// Direction-based tilt: horizontal movement produces the most visible sway
	// atan2 gives the movement angle, but we only use horizontal component
	// for a natural-feeling lean into the direction of travel.
	const horizontalFactor = dx;

	// Scale by speed (capped) and intensity
	const cappedSpeed = Math.min(speed * 80, 1); // normalise roughly to 0-1
	const rotation = horizontalFactor * cappedSpeed * MAX_ROTATION_RAD * intensity * 60;

	return clampRotation(rotation);
}

function clampRotation(r: number): number {
	return Math.max(-MAX_ROTATION_RAD, Math.min(MAX_ROTATION_RAD, r));
}

/**
 * Helper class that smoothly interpolates the sway angle over time so
 * it doesn't jitter frame-to-frame.
 */
export class CursorSwayInterpolator {
	private currentAngle = 0;
	/** Exponential smoothing factor (higher = snappier). */
	private readonly smoothFactor: number;

	constructor(smoothFactor = 12) {
		this.smoothFactor = smoothFactor;
	}

	/**
	 * Update with a new target angle and time delta.
	 * @returns The smoothed angle in radians.
	 */
	update(targetAngle: number, dt: number): number {
		const t = 1 - Math.exp(-this.smoothFactor * dt);
		this.currentAngle += (targetAngle - this.currentAngle) * t;
		return this.currentAngle;
	}

	reset(): void {
		this.currentAngle = 0;
	}

	get angle(): number {
		return this.currentAngle;
	}
}
