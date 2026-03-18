import { describe, expect, it } from "vitest";
import { shouldFailDecodeEndedEarly } from "./streamingDecoder";

describe("shouldFailDecodeEndedEarly", () => {
	it("does not fail once every segment has been satisfied", () => {
		expect(
			shouldFailDecodeEndedEarly({
				cancelled: false,
				segmentsLength: 1,
				completedSegments: 1,
				lastDecodedFrameSec: 5.33,
				requiredEndSec: 6.498,
			}),
		).toBe(false);
	});

	it("fails when decode stops before the remaining segments can be covered", () => {
		expect(
			shouldFailDecodeEndedEarly({
				cancelled: false,
				segmentsLength: 2,
				completedSegments: 1,
				lastDecodedFrameSec: 5.33,
				requiredEndSec: 6.498,
			}),
		).toBe(true);
	});

	it("fails when no frame could be decoded for a non-empty timeline", () => {
		expect(
			shouldFailDecodeEndedEarly({
				cancelled: false,
				segmentsLength: 1,
				completedSegments: 0,
				lastDecodedFrameSec: null,
				requiredEndSec: 1,
			}),
		).toBe(true);
	});
});
