// ── Scene Plan Compiler ─────────────────────────────────────────────────
//
// Converts a ScenePlan (editable JSON) to Remotion React code.
// Uses the pre-built cinematic helper components for safe rendering.
// This is DETERMINISTIC — same plan always produces same code.

import { BACKGROUND_PRESETS, type ScenePlan, type ScenePlanItem } from "./scenePlan";

/**
 * Compile a ScenePlan to Remotion React code string.
 * The output uses Scene, AnimatedText, Card, Pill, GradientText, etc.
 */
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
		const fontFamily =
			scene.font === "serif"
				? "Georgia, 'Times New Roman', serif"
				: "'Inter', 'Helvetica Neue', sans-serif";
		const color = isLightBg(scene.background) ? "#050505" : "#ffffff";

		const inner = generateSceneContent(scene, accent, fontFamily, color, i);

		return `    <Sequence from={${from}} durationInFrames={${dur}}>
      <Scene bg="${bg}">
        ${inner}
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

function resolveBackground(bg: string): string {
	return BACKGROUND_PRESETS[bg] || bg;
}

function isLightBg(bg: string): boolean {
	return ["white", "cream", "#fafafa", "#f5f0e8", "#ffffff"].includes(bg);
}

function generateSceneContent(
	scene: ScenePlanItem,
	accent: string,
	fontFamily: string,
	color: string,
	_index: number,
): string {
	const effects = generateEffects(scene);

	switch (scene.type) {
		case "hero-text":
			return `${generateTextComponent(scene, accent, fontFamily, color)}
        ${scene.subtitle ? `<div style={{ fontSize: 32, color: '${color}99', fontFamily: "${fontFamily}", marginTop: 16, textAlign: 'center', maxWidth: 1000 }}>{${JSON.stringify(scene.subtitle)}}</div>` : ""}
        ${effects}`;

		case "glitch-intro":
			return `<GlitchText text={${JSON.stringify(scene.headline)}} fontSize={${scene.fontSize || 120}} color="${color}" intensity={0.8} durationFrames={12} delay={3} />
        ${effects}`;

		case "split-layout":
			return `<div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
          <div style={{ flex: 1, maxWidth: 700 }}>
            ${generateTextComponent(scene, accent, fontFamily, color)}
          </div>
          <div style={{ flex: 1, maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}>
            ${generateRightContent(scene, accent)}
          </div>
        </div>
        ${effects}`;

		case "cards":
			return `${generateTextComponent(scene, accent, fontFamily, color)}
        <div style={{ display: 'flex', gap: 20, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1400 }}>
          ${(scene.cards || [])
						.map(
							(card, ci) =>
								`<Card width={380} delay={${ci * 8}}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>${card.title}</div>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}>${card.description}</div>
            </Card>`,
						)
						.join("\n          ")}
        </div>
        ${effects}`;

		case "screenshot":
			return `${generateTextComponent(scene, accent, fontFamily, color)}
        <div style={{ marginTop: 30, borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: 1200 }}>
          <Img src={screenshots[${scene.screenshotIndex || 0}]} style={{ width: '100%', height: 'auto' }} />
        </div>
        ${effects}`;

		case "cta":
			return `${generateTextComponent(scene, accent, fontFamily, color)}
        <div style={{ marginTop: 30 }}>
          <Pill text="Get Started" delay={15} color="#fff" bg="rgba(255,255,255,0.1)" />
        </div>
        ${effects}`;

		default:
			return generateTextComponent(scene, accent, fontFamily, color) + effects;
	}
}

function generateTextComponent(
	scene: ScenePlanItem,
	accent: string,
	fontFamily: string,
	color: string,
): string {
	if (scene.animation === "gradient") {
		return `<GradientText text={${JSON.stringify(scene.headline)}} fontSize={${scene.fontSize || 120}} />`;
	}

	if (scene.animation === "glitch") {
		return `<GlitchText text={${JSON.stringify(scene.headline)}} fontSize={${scene.fontSize || 100}} color="${color}" />`;
	}

	return `<AnimatedText
          text={${JSON.stringify(scene.headline)}}
          fontSize={${scene.fontSize || 100}}
          color="${color}"
          fontFamily="${fontFamily}"
          animation="${scene.animation || "chars"}"
          ${scene.accentWord ? `accentWord="${scene.accentWord}"` : ""}
          ${scene.accentWord ? `accentColor="${accent}"` : ""}
        />`;
}

function generateRightContent(scene: ScenePlanItem, _accent: string): string {
	if (scene.cards && scene.cards.length > 0) {
		return scene.cards
			.map(
				(card, ci) =>
					`<Card width={500} delay={${ci * 8}}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>${card.title}</div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}>${card.description}</div>
            </Card>`,
			)
			.join("\n            ");
	}
	return "";
}

function generateEffects(scene: ScenePlanItem): string {
	const parts: string[] = [];
	for (const effect of scene.effects || []) {
		switch (effect) {
			case "vignette":
				parts.push("<Vignette intensity={0.4} />");
				break;
			case "light-streak":
				parts.push(
					'<LightStreak startFrame={15} durationFrames={20} color="rgba(255,220,150,0.6)" />',
				);
				break;
			case "clip-reveal":
				// ClipReveal wraps the whole scene — handled at scene level
				break;
		}
	}
	return parts.join("\n        ");
}
