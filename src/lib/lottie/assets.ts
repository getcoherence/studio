// ── Lottie Asset Catalog ─────────────────────────────────────────────────
//
// Minimal inline Lottie JSONs for motion graphics overlays.
// These are simple vector animations that enhance scene compositions.

export interface LottieAsset {
	id: string;
	name: string;
	category: "lower-third" | "accent" | "decoration" | "reveal";
	data: object;
	aspectRatio: number;
	suggestedDurationMs: number;
}

// ── Inline Lottie animations ─────────────────────────────────────────────
// Each is a minimal After Effects-style animation (shapes + keyframes)

const lowerThirdBar: LottieAsset = {
	id: "lower-third-bar",
	name: "Lower Third Bar",
	category: "lower-third",
	aspectRatio: 8,
	suggestedDurationMs: 1500,
	data: {
		v: "5.7.1",
		fr: 30,
		ip: 0,
		op: 45,
		w: 800,
		h: 100,
		assets: [],
		layers: [
			{
				ty: 4,
				nm: "bar",
				sr: 1,
				ks: {
					o: {
						a: 1,
						k: [
							{ t: 0, s: [0] },
							{ t: 8, s: [100] },
							{ t: 37, s: [100] },
							{ t: 45, s: [0] },
						],
					},
					p: { a: 0, k: [400, 50, 0] },
					s: {
						a: 1,
						k: [
							{ t: 0, s: [0, 100, 100] },
							{ t: 12, s: [100, 100, 100] },
						],
					},
				},
				ao: 0,
				shapes: [
					{
						ty: "rc",
						d: 1,
						s: { a: 0, k: [780, 4] },
						p: { a: 0, k: [0, 0] },
						r: { a: 0, k: 2 },
					},
					{
						ty: "fl",
						c: { a: 0, k: [0.15, 0.39, 0.92, 1] },
						o: { a: 0, k: 80 },
					},
				],
				ip: 0,
				op: 45,
			},
		],
	},
};

const accentLine: LottieAsset = {
	id: "accent-line",
	name: "Accent Line",
	category: "accent",
	aspectRatio: 20,
	suggestedDurationMs: 1000,
	data: {
		v: "5.7.1",
		fr: 30,
		ip: 0,
		op: 30,
		w: 600,
		h: 30,
		assets: [],
		layers: [
			{
				ty: 4,
				nm: "line",
				sr: 1,
				ks: {
					o: { a: 0, k: 100 },
					p: { a: 0, k: [300, 15, 0] },
					s: {
						a: 1,
						k: [
							{ t: 0, s: [0, 100, 100] },
							{ t: 15, s: [100, 100, 100] },
						],
					},
				},
				ao: 0,
				shapes: [
					{
						ty: "rc",
						d: 1,
						s: { a: 0, k: [580, 2] },
						p: { a: 0, k: [0, 0] },
						r: { a: 0, k: 1 },
					},
					{
						ty: "fl",
						c: { a: 0, k: [0.15, 0.39, 0.92, 1] },
						o: { a: 0, k: 60 },
					},
				],
				ip: 0,
				op: 30,
			},
		],
	},
};

const cornerBracketTL: LottieAsset = {
	id: "corner-bracket-tl",
	name: "Corner Bracket Top-Left",
	category: "decoration",
	aspectRatio: 1,
	suggestedDurationMs: 800,
	data: {
		v: "5.7.1",
		fr: 30,
		ip: 0,
		op: 24,
		w: 80,
		h: 80,
		assets: [],
		layers: [
			{
				ty: 4,
				nm: "bracket",
				sr: 1,
				ks: {
					o: {
						a: 1,
						k: [
							{ t: 0, s: [0] },
							{ t: 8, s: [70] },
						],
					},
					p: { a: 0, k: [40, 40, 0] },
					s: {
						a: 1,
						k: [
							{ t: 0, s: [0, 0, 100] },
							{ t: 10, s: [100, 100, 100] },
						],
					},
				},
				ao: 0,
				shapes: [
					{
						ty: "sh",
						d: 1,
						ks: {
							a: 0,
							k: {
								c: false,
								v: [
									[-30, 30],
									[-30, -30],
									[30, -30],
								],
								i: [
									[0, 0],
									[0, 0],
									[0, 0],
								],
								o: [
									[0, 0],
									[0, 0],
									[0, 0],
								],
							},
						},
					},
					{
						ty: "st",
						c: { a: 0, k: [0.15, 0.39, 0.92, 1] },
						o: { a: 0, k: 80 },
						w: { a: 0, k: 2 },
					},
				],
				ip: 0,
				op: 24,
			},
		],
	},
};

const cornerBracketBR: LottieAsset = {
	id: "corner-bracket-br",
	name: "Corner Bracket Bottom-Right",
	category: "decoration",
	aspectRatio: 1,
	suggestedDurationMs: 800,
	data: {
		v: "5.7.1",
		fr: 30,
		ip: 0,
		op: 24,
		w: 80,
		h: 80,
		assets: [],
		layers: [
			{
				ty: 4,
				nm: "bracket",
				sr: 1,
				ks: {
					o: {
						a: 1,
						k: [
							{ t: 0, s: [0] },
							{ t: 8, s: [70] },
						],
					},
					p: { a: 0, k: [40, 40, 0] },
					s: {
						a: 1,
						k: [
							{ t: 0, s: [0, 0, 100] },
							{ t: 10, s: [100, 100, 100] },
						],
					},
				},
				ao: 0,
				shapes: [
					{
						ty: "sh",
						d: 1,
						ks: {
							a: 0,
							k: {
								c: false,
								v: [
									[30, -30],
									[30, 30],
									[-30, 30],
								],
								i: [
									[0, 0],
									[0, 0],
									[0, 0],
								],
								o: [
									[0, 0],
									[0, 0],
									[0, 0],
								],
							},
						},
					},
					{
						ty: "st",
						c: { a: 0, k: [0.15, 0.39, 0.92, 1] },
						o: { a: 0, k: 80 },
						w: { a: 0, k: 2 },
					},
				],
				ip: 0,
				op: 24,
			},
		],
	},
};

const glowPulse: LottieAsset = {
	id: "glow-pulse",
	name: "Glow Pulse",
	category: "reveal",
	aspectRatio: 1,
	suggestedDurationMs: 2000,
	data: {
		v: "5.7.1",
		fr: 30,
		ip: 0,
		op: 60,
		w: 200,
		h: 200,
		assets: [],
		layers: [
			{
				ty: 4,
				nm: "glow",
				sr: 1,
				ks: {
					o: {
						a: 1,
						k: [
							{ t: 0, s: [0] },
							{ t: 15, s: [40] },
							{ t: 45, s: [40] },
							{ t: 60, s: [0] },
						],
					},
					p: { a: 0, k: [100, 100, 0] },
					s: {
						a: 1,
						k: [
							{ t: 0, s: [60, 60, 100] },
							{ t: 30, s: [120, 120, 100] },
							{ t: 60, s: [60, 60, 100] },
						],
					},
				},
				ao: 0,
				shapes: [
					{
						ty: "el",
						d: 1,
						s: { a: 0, k: [160, 160] },
						p: { a: 0, k: [0, 0] },
					},
					{
						ty: "fl",
						c: { a: 0, k: [0.15, 0.39, 0.92, 1] },
						o: { a: 0, k: 30 },
					},
				],
				ip: 0,
				op: 60,
			},
		],
	},
};

// ── Registry ─────────────────────────────────────────────────────────────

export const LOTTIE_ASSETS: Record<string, LottieAsset> = {
	"lower-third-bar": lowerThirdBar,
	"accent-line": accentLine,
	"corner-bracket-tl": cornerBracketTL,
	"corner-bracket-br": cornerBracketBR,
	"glow-pulse": glowPulse,
};

export function getLottieAsset(id: string): LottieAsset | undefined {
	return LOTTIE_ASSETS[id];
}

export function getLottieAssetsByCategory(category: LottieAsset["category"]): LottieAsset[] {
	return Object.values(LOTTIE_ASSETS).filter((a) => a.category === category);
}
