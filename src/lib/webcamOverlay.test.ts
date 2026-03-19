import { describe, expect, it } from "vitest";
import { computeWebcamOverlayLayout } from "./webcamOverlay";

describe("computeWebcamOverlayLayout", () => {
	it("anchors the overlay in the lower-right corner", () => {
		const layout = computeWebcamOverlayLayout({
			stageWidth: 1920,
			stageHeight: 1080,
			videoWidth: 1280,
			videoHeight: 720,
		});

		expect(layout).not.toBeNull();
		expect(layout!.x + layout!.width).toBeLessThanOrEqual(1920);
		expect(layout!.y + layout!.height).toBeLessThanOrEqual(1080);
		expect(layout!.x).toBeGreaterThan(1920 / 2);
		expect(layout!.y).toBeGreaterThan(1080 / 2);
	});

	it("keeps the overlay within the configured stage fraction while preserving aspect ratio", () => {
		const layout = computeWebcamOverlayLayout({
			stageWidth: 1280,
			stageHeight: 720,
			videoWidth: 1920,
			videoHeight: 1080,
		});

		expect(layout).not.toBeNull();
		expect(layout!.width).toBeLessThanOrEqual(Math.round(1280 * 0.18) + 1);
		expect(layout!.height).toBeLessThanOrEqual(Math.round(720 * 0.18) + 1);
		expect(Math.abs(layout!.width * 1080 - layout!.height * 1920)).toBeLessThanOrEqual(1920);
	});

	it("places the webcam directly below the screencast in vertical stack mode", () => {
		const layout = computeWebcamOverlayLayout({
			stageWidth: 1920,
			stageHeight: 1080,
			videoWidth: 1280,
			videoHeight: 720,
			screenVideoWidth: 1920,
			screenVideoHeight: 1080,
			layoutPreset: "vertical-stack",
		});

		expect(layout).not.toBeNull();
		expect(layout?.y).toBe(648);
		expect(layout?.height).toBe(432);
		expect(layout?.width).toBe(768);
		expect(layout?.borderRadius).toBe(0);
	});

	it("returns null for vertical stack until screen dimensions are available", () => {
		const layout = computeWebcamOverlayLayout({
			stageWidth: 1920,
			stageHeight: 1080,
			videoWidth: 1280,
			videoHeight: 720,
			layoutPreset: "vertical-stack",
		});

		expect(layout).toBeNull();
	});
});
