import { describe, expect, it } from "vitest";
import { computeCompositeLayout } from "./compositeLayout";

describe("computeCompositeLayout", () => {
	it("anchors the overlay in the lower-right corner", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
		});

		expect(layout).not.toBeNull();
		expect(layout!.webcamRect).not.toBeNull();
		expect(layout!.webcamRect!.x + layout!.webcamRect!.width).toBeLessThanOrEqual(1920);
		expect(layout!.webcamRect!.y + layout!.webcamRect!.height).toBeLessThanOrEqual(1080);
		expect(layout!.webcamRect!.x).toBeGreaterThan(1920 / 2);
		expect(layout!.webcamRect!.y).toBeGreaterThan(1080 / 2);
	});

	it("keeps the overlay within the configured stage fraction while preserving aspect ratio", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1280, height: 720 },
			screenSize: { width: 1280, height: 720 },
			webcamSize: { width: 1920, height: 1080 },
		});

		expect(layout).not.toBeNull();
		expect(layout!.webcamRect).not.toBeNull();
		expect(layout!.webcamRect!.width).toBeLessThanOrEqual(Math.round(1280 * 0.18) + 1);
		expect(layout!.webcamRect!.height).toBeLessThanOrEqual(Math.round(720 * 0.18) + 1);
		expect(
			Math.abs(layout!.webcamRect!.width * 1080 - layout!.webcamRect!.height * 1920),
		).toBeLessThanOrEqual(1920);
	});

	it("centers the combined screen and webcam stack in vertical stack mode", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			webcamSize: { width: 1280, height: 720 },
			layoutPreset: "vertical-stack",
		});

		expect(layout).not.toBeNull();
		expect(layout?.screenRect).toEqual({
			x: 576,
			y: 108,
			width: 768,
			height: 432,
		});
		expect(layout?.webcamRect).toEqual({
			x: 576,
			y: 540,
			width: 768,
			height: 432,
			borderRadius: 0,
		});
	});

	it("keeps the screen centered and omits the webcam when dimensions are unavailable", () => {
		const layout = computeCompositeLayout({
			canvasSize: { width: 1920, height: 1080 },
			maxContentSize: { width: 1536, height: 864 },
			screenSize: { width: 1920, height: 1080 },
			layoutPreset: "vertical-stack",
		});

		expect(layout).not.toBeNull();
		expect(layout?.screenRect).toEqual({
			x: 192,
			y: 108,
			width: 1536,
			height: 864,
		});
		expect(layout?.webcamRect).toBeNull();
	});
});
