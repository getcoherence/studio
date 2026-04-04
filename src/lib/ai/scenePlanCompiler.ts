// ── Scene Plan Compiler ─────────────────────────────────────────────────
//
// Converts a ScenePlan (editable JSON) to Remotion React code.
// ALL content is layer-based — headlines, subtitles, cards, effects
// are all converted to positioned, timed layers.
// This is DETERMINISTIC — same plan always produces same code.

import {
	BACKGROUND_PRESETS,
	type SceneLayer,
	type ScenePlan,
	type ScenePlanItem,
} from "./scenePlan";

// ── Main compiler ───────────────────────────────────────────────────────

export function compileScenePlan(plan: ScenePlan): string {
	const scenes = plan.scenes;
	const accent = plan.accentColor || "#2563eb";
	const framesPerScene = scenes[0]?.durationFrames || 90;
	const totalDuration = scenes.reduce((sum, s) => sum + (s.durationFrames || framesPerScene), 0);

	const sceneCode = scenes.map((scene, i) => {
		const from = scenes
			.slice(0, i)
			.reduce((sum, s) => sum + (s.durationFrames || framesPerScene), 0);
		const dur = scene.durationFrames || framesPerScene;
		const bg = resolveBackground(scene.background);

		// Use existing layers if already expanded, otherwise expand from scene properties
		const allLayers =
			scene.layers && scene.layers.length > 0 ? scene.layers : expandSceneToLayers(scene, accent);
		const layerCode = allLayers.map((layer) => compileLayer(layer, dur, accent)).join("\n        ");

		return `    <Sequence from={${from}} durationInFrames={${dur}}>
      <Scene bg="${bg}">
        ${layerCode}
      </Scene>
    </Sequence>`;
	});

	return `const ACCENT = "${accent}";
const totalDuration = ${totalDuration};

const VideoComposition = ({ screenshots }) => {
  return (
    <AbsoluteFill>
${sceneCode.join("\n")}
    </AbsoluteFill>
  );
};`;
}

// ── Expand scene to layers ──────────────────────────────────────────────

/**
 * Convert a scene's properties (headline, subtitle, cards, effects, etc.)
 * into explicit layers. This makes EVERYTHING editable and repositionable.
 */
export function expandSceneToLayers(scene: ScenePlanItem, accent: string): SceneLayer[] {
	const layers: SceneLayer[] = [];
	const fontFamily = resolveFontFamily(scene.font);
	const color = isLightBg(scene.background) ? "#050505" : "#ffffff";
	const dur = scene.durationFrames || 90;

	// ── Headline layer ──
	if (scene.headline) {
		const headlineSize = Math.max(100, scene.fontSize || 120);
		layers.push({
			id: `headline-${scene.headline.slice(0, 10)}`,
			type: "text",
			content: scene.headline,
			position: scene.type === "split-layout" ? "left" : "center",
			size: scene.type === "full-bleed" ? 95 : 80,
			startFrame: 0,
			endFrame: -1,
			settings: {
				fontSize: scene.type === "full-bleed" ? Math.max(160, headlineSize) : headlineSize,
				color,
				animation:
					scene.animation === "gradient"
						? "gradient"
						: scene.animation === "glitch"
							? "glitch"
							: scene.animation || "chars",
				fontFamily,
				accentWord: scene.accentWord,
				accentColor: accent,
			},
		});
	}

	// ── Subtitle layer ──
	if (scene.subtitle) {
		layers.push({
			id: `subtitle-${scene.subtitle.slice(0, 10)}`,
			type: "text",
			content: scene.subtitle,
			position: "center",
			size: 60,
			startFrame: 10,
			endFrame: -1,
			settings: {
				fontSize: 32,
				color: `${color}99`,
				animation: "none",
				fontFamily,
			},
		});
	}

	// ── Cards layers ──
	if (scene.cards && scene.cards.length > 0) {
		scene.cards.forEach((card, ci) => {
			layers.push({
				id: `card-${ci}-${card.title.slice(0, 8)}`,
				type: "card" as any,
				content: JSON.stringify(card),
				position: "center",
				size: 30,
				startFrame: ci * 8,
				endFrame: -1,
				settings: {
					fontSize: 28,
					color: "#ffffff",
				},
			});
		});
	}

	// ── Screenshot layer ──
	if (scene.type === "screenshot" && scene.screenshotIndex !== undefined) {
		layers.push({
			id: `screenshot-${scene.screenshotIndex}`,
			type: "image",
			content: `screenshots[${scene.screenshotIndex}]`,
			position: "center",
			size: 70,
			startFrame: 5,
			endFrame: -1,
		});
	}

	// ── CTA pill layer ──
	if (scene.type === "cta") {
		layers.push({
			id: "cta-pill",
			type: "text",
			content: "Get Started",
			position: "center",
			size: 30,
			startFrame: 15,
			endFrame: -1,
			settings: {
				fontSize: 18,
				animation: "pill",
			},
		});
	}

	// ── Effect layers ──
	if (scene.effects?.includes("vignette")) {
		layers.push({
			id: "fx-vignette",
			type: "shape",
			content: "vignette",
			position: "center",
			size: 100,
			startFrame: 0,
			endFrame: -1,
			settings: { opacity: 0.4 },
		});
	}
	if (scene.effects?.includes("light-streak")) {
		layers.push({
			id: "fx-lightstreak",
			type: "shape",
			content: "light-streak",
			position: "center",
			size: 100,
			startFrame: 15,
			endFrame: 40,
		});
	}

	// ── Lottie layers ──
	if (scene.lottieOverlay) {
		layers.push({
			id: "lottie-overlay",
			type: "lottie",
			content: scene.lottieOverlay,
			position: "center",
			size: 50,
			startFrame: 0,
			endFrame: -1,
			settings: { opacity: 0.8, loop: true },
		});
	}
	if (scene.lottieBackground) {
		layers.push({
			id: "lottie-bg",
			type: "lottie",
			content: scene.lottieBackground,
			position: "center",
			size: 100,
			startFrame: 0,
			endFrame: -1,
			settings: { opacity: 0.2, loop: true },
		});
	}

	// ── Explicit user-added layers ──
	if (scene.layers) {
		layers.push(...scene.layers);
	}

	return layers;
}

// ── Compile a single layer ──────────────────────────────────────────────

function compileLayer(layer: SceneLayer, sceneDuration: number, accent: string): string {
	const endFrame = layer.endFrame === -1 ? sceneDuration : layer.endFrame;
	const dur = Math.max(1, endFrame - layer.startFrame);
	const s = layer.settings || {};

	let content = "";

	switch (layer.type) {
		case "text": {
			const fontSize = Math.max(32, s.fontSize || 60);
			const fontFamily = s.fontFamily || "'Inter', 'Helvetica Neue', sans-serif";
			const color = s.color || "#ffffff";
			const animation = s.animation || "words";

			if (animation === "gradient") {
				content = `<GradientText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} />`;
			} else if (animation === "glitch") {
				content = `<GlitchText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} color="${color}" />`;
			} else if (animation === "pill") {
				content = `<Pill text={${JSON.stringify(layer.content)}} delay={0} color="#fff" bg="rgba(255,255,255,0.1)" />`;
			} else if (animation === "none") {
				content = `<div style={{ fontSize: ${fontSize}, fontFamily: "${fontFamily}", color: "${color}", textAlign: "center", maxWidth: 1000 }}>{${JSON.stringify(layer.content)}}</div>`;
			} else {
				content = `<AnimatedText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} color="${color}" fontFamily="${fontFamily}" animation="${animation}" ${s.accentWord ? `accentWord="${s.accentWord}" accentColor="${s.accentColor || accent}"` : ""} />`;
			}
			break;
		}

		case "card" as any: {
			try {
				const card = JSON.parse(layer.content);
				content = `<Card width={380} delay={${layer.startFrame}}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>${card.title}</div>
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}>${card.description}</div>
          </Card>`;
			} catch {
				content = `<Card width={380}><div style={{ color: '#fff' }}>${layer.content}</div></Card>`;
			}
			break;
		}

		case "lottie":
			content = `<LottieOverlay src="${layer.content}" position="${layer.position}" size={${layer.size}} opacity={${s.opacity || 0.8}} loop={${s.loop ?? true}} />`;
			// LottieOverlay handles its own positioning
			return `<Sequence from={${layer.startFrame}} durationInFrames={${dur}}>${content}</Sequence>`;

		case "image":
			content = `<div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: 1200 }}><Img src={${layer.content.startsWith("screenshots") ? layer.content : JSON.stringify(layer.content)}} style={{ width: '100%', height: 'auto' }} /></div>`;
			break;

		case "shape":
			if (layer.content === "vignette") {
				return `<Vignette intensity={${s.opacity || 0.4}} />`;
			}
			if (layer.content === "light-streak") {
				return `<LightStreak startFrame={${layer.startFrame}} durationFrames={${dur}} color="rgba(255,220,150,0.6)" />`;
			}
			content = `<div style={{ width: '100%', height: '100%', borderRadius: 12, backgroundColor: '${s.color || "rgba(255,255,255,0.1)"}', opacity: ${s.opacity || 0.5} }} />`;
			break;

		default:
			content = `<div>${layer.content}</div>`;
	}

	// Cards render inline (stacked), not absolutely positioned
	if ((layer.type as string) === "card") {
		return `<Sequence from={${layer.startFrame}} durationInFrames={${dur}}>${content}</Sequence>`;
	}

	// Effects (vignette, light-streak) are already returned above
	// Regular layers get absolute positioning
	const pos = getLayerPosition(layer.position, layer.size);
	return `<Sequence from={${layer.startFrame}} durationInFrames={${dur}}>
          <div style={{ position: 'absolute', ${pos}, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ${content}
          </div>
        </Sequence>`;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function resolveBackground(bg: string): string {
	return BACKGROUND_PRESETS[bg] || bg;
}

function isLightBg(bg: string): boolean {
	return ["white", "cream", "#fafafa", "#f5f0e8", "#ffffff"].includes(bg);
}

function resolveFontFamily(font?: string): string {
	switch (font) {
		case "serif":
			return "Georgia, 'Times New Roman', serif";
		case "mono":
			return "'SF Mono', 'Fira Code', 'Courier New', monospace";
		case "condensed":
			return "'Arial Narrow', 'Impact', sans-serif";
		case "wide":
			return "'Trebuchet MS', 'Arial Black', sans-serif";
		default:
			return "'Inter', 'Helvetica Neue', sans-serif";
	}
}

function getLayerPosition(position: string, size: number): string {
	const s = `${size}%`;
	const offset = `${(100 - size) / 2}%`;
	switch (position) {
		case "center":
			return `left: '${offset}', top: '${offset}', width: '${s}', height: '${s}'`;
		case "top-left":
			return `left: '5%', top: '5%', width: '${s}', height: '${s}'`;
		case "top-right":
			return `right: '5%', top: '5%', width: '${s}', height: '${s}'`;
		case "bottom-left":
			return `left: '5%', bottom: '5%', width: '${s}', height: '${s}'`;
		case "bottom-right":
			return `right: '5%', bottom: '5%', width: '${s}', height: '${s}'`;
		case "top":
			return `left: '${offset}', top: '5%', width: '${s}', height: '${s}'`;
		case "bottom":
			return `left: '${offset}', bottom: '5%', width: '${s}', height: '${s}'`;
		case "left":
			return `left: '5%', top: '${offset}', width: '${s}', height: '${s}'`;
		case "right":
			return `right: '5%', top: '${offset}', width: '${s}', height: '${s}'`;
		default:
			return `left: '${offset}', top: '${offset}', width: '${s}', height: '${s}'`;
	}
}
