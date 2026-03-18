import { describe, expect, it } from "vitest";
import { calculateOutputDimensions } from "./gifExporter";
import { GIF_SIZE_PRESETS } from "./types";

describe("calculateOutputDimensions", () => {
	it("uses the selected aspect ratio for scaled GIF exports", () => {
		expect(calculateOutputDimensions(1080, 1920, "medium", GIF_SIZE_PRESETS, 16 / 9)).toEqual({
			width: 1280,
			height: 720,
		});
	});

	it("fits original-size GIF exports within the source bounds at the selected aspect ratio", () => {
		expect(calculateOutputDimensions(1080, 1920, "original", GIF_SIZE_PRESETS, 16 / 9)).toEqual({
			width: 1080,
			height: 606,
		});
	});
});
