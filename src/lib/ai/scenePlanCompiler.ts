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
import { pluginRegistry } from "../plugins";

// ── Main compiler ───────────────────────────────────────────────────────

// Minimum durations per scene type — scenes shorter than this don't give the viewer
// enough time to read the content (ghost-hook and stacked-hierarchy especially).
const MIN_DURATION_BY_TYPE: Record<string, number> = {
	"ghost-hook": 85,
	"stacked-hierarchy": 95,
	"scrolling-list": 120,
	"camera-text": 100,
	"before-after": 120,
	"metrics-dashboard": 110,
	"dashboard-deconstructed": 110,
	"data-flow-network": 110,
	"icon-showcase": 95,
	"chat-narrative": 110,
	"notification-chaos": 90,
	"browser-tabs-chaos": 90,
	"typewriter-prompt": 90,
	"word-slot-machine": 110,
	"radial-vortex": 85,
	"glass-stats": 110,
	"device-showcase": 100,
	"cinematic-title": 85,
	"countdown": 120,
	cards: 110,
};

/** Get the effective duration for a scene. When the user has explicitly set
 * a duration, respect it exactly (even very short). Only apply the minimum
 * clamp for AI-generated defaults. */
export function clampDuration(scene: ScenePlanItem): number {
	const raw = scene.durationFrames || 60;
	// If user explicitly set a value, respect it (allow as low as 10 frames)
	if (scene.durationFrames) return Math.max(10, raw);
	const min = MIN_DURATION_BY_TYPE[scene.type] || 80;
	return Math.max(min, raw);
}

/** Duration in frames of the transition *out of* scene i into scene i+1.
 * Returns 0 if scene i is the last one or explicitly has transition "cut". */
export function getEffectiveTransitionDuration(scenes: ScenePlanItem[], i: number): number {
	if (i >= scenes.length - 1) return 0;
	const fromScene = scenes[i];
	const toScene = scenes[i + 1];
	const type = fromScene.transitionOut || pickSmartTransition(fromScene, toScene, i);
	if (type === "cut") return 1; // cut is simulated as a 1-frame fade
	return fromScene.transitionDurationFrames || getTransitionDuration(type);
}

/** Compute the real video duration: sum of sequence durations MINUS transition
 * overlaps. Remotion's TransitionSeries overlaps transitions with the adjacent
 * sequences, so the effective total is shorter than the naive sum. */
export function computeRealTotalFrames(scenes: ScenePlanItem[]): number {
	let total = scenes.reduce((sum, s) => sum + clampDuration(s), 0);
	for (let i = 0; i < scenes.length - 1; i++) {
		total -= getEffectiveTransitionDuration(scenes, i);
	}
	return Math.max(1, total);
}

/** Cumulative offset (real playback frame position) where each scene's first
 * visible frame begins, accounting for transition overlaps with previous scenes. */
export function computeSceneOffsets(scenes: ScenePlanItem[]): number[] {
	const offsets: number[] = [];
	let offset = 0;
	for (let i = 0; i < scenes.length; i++) {
		offsets.push(offset);
		offset += clampDuration(scenes[i]);
		if (i < scenes.length - 1) {
			offset -= getEffectiveTransitionDuration(scenes, i);
		}
	}
	return offsets;
}

export function compileScenePlan(plan: ScenePlan): string {
	const scenes = plan.scenes;
	const accent = plan.accentColor || "#2563eb";
	const logoUrl = plan.logoUrl || null;
	const websiteUrl = plan.websiteUrl || null;
	const totalDuration = computeRealTotalFrames(scenes);

	// If only one scene, skip TransitionSeries entirely
	if (scenes.length === 1) {
		const scene = scenes[0];
		const bg = resolveBackground(scene.background);
		const inner = renderSceneByType(scene, accent, bg, logoUrl, websiteUrl);
		return `const ACCENT = "${accent}";
const totalDuration = ${totalDuration};

const VideoComposition = ({ screenshots }) => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={${clampDuration(scene)}}>
        ${inner}
      </Sequence>
    </AbsoluteFill>
  );
};`;
	}

	// Multi-scene: wrap in TransitionSeries with smart transitions between scenes
	const elements: string[] = [];
	scenes.forEach((scene, i) => {
		const dur = clampDuration(scene);
		const bg = resolveBackground(scene.background);
		const inner = renderSceneByType(scene, accent, bg, logoUrl, websiteUrl);
		elements.push(
			`    <TransitionSeries.Sequence durationInFrames={${dur}}>\n        ${inner}\n      </TransitionSeries.Sequence>`,
		);
		// Add transition after every scene except the last
		if (i < scenes.length - 1) {
			elements.push(buildTransition(scene, scenes[i + 1], i, accent));
		}
	});

	return `const ACCENT = "${accent}";
const totalDuration = ${totalDuration};

const VideoComposition = ({ screenshots }) => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
${elements.join("\n")}
      </TransitionSeries>
    </AbsoluteFill>
  );
};`;
}

// ── Transition builder ────────────────────────────────────────────────

function buildTransition(
	fromScene: ScenePlanItem,
	toScene: ScenePlanItem,
	sceneIndex: number,
	accent?: string,
): string {
	// Use explicit transitionOut if specified, otherwise pick a smart default
	// that varies based on scene index and type so we get visual variety.
	const type = fromScene.transitionOut || pickSmartTransition(fromScene, toScene, sceneIndex);
	const duration = fromScene.transitionDurationFrames || getTransitionDuration(type);

	if (type === "cut") {
		// Remotion doesn't have a "cut" primitive — simulate with 1-frame fade
		return `    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 1 })} />`;
	}

	const transColor = fromScene.transitionColor || accent;
	const presentation = getTransitionPresentation(type, transColor);
	const SPRING_TRANSITIONS = new Set(["zoom-morph", "zoom-punch"]);
	const timing = SPRING_TRANSITIONS.has(type)
		? `springTiming({ config: { damping: 20, stiffness: 90, mass: 1 }, durationInFrames: ${duration} })`
		: `linearTiming({ durationInFrames: ${duration} })`;

	return `    <TransitionSeries.Transition presentation={${presentation}} timing={${timing}} />`;
}

function pickSmartTransition(
	fromScene: ScenePlanItem,
	toScene: ScenePlanItem,
	index: number,
): ScenePlanItem["transitionOut"] & string {
	// Ghost hook → next ghost hook: always fade (same visual, different word revealed)
	if (fromScene.type === "ghost-hook" && toScene.type === "ghost-hook") return "fade";

	// Type-specific defaults
	const typeDefaults: Partial<Record<string, ScenePlanItem["transitionOut"] & string>> = {
		"impact-word": "zoom-morph",
		"echo-hero": "zoom-morph",
		"outline-hero": "zoom-morph",
		"radial-vortex": "fade",
		"logo-reveal": "fade",
		"gradient-mesh-hero": "fade",
		"metrics-dashboard": "slide-up",
		"typewriter-prompt": "fade",
		"before-after": "slide-left",
		"chat-narrative": "slide-up",
		"notification-chaos": "wipe-left",
		"browser-tabs-chaos": "wipe-right",
		"icon-showcase": "slide-right",
		"product-glow": "slide-left",
		"app-icon-cloud": "slide-up",
		"data-flow-network": "wipe-right",
		"avatar-constellation": "fade",
		"word-slot-machine": "slide-up",
		"stacked-hierarchy": "slide-up",
	};

	if (fromScene.type && typeDefaults[fromScene.type]) return typeDefaults[fromScene.type]!;

	// Rotating fallback for variety when no type hint
	const rotation: Array<ScenePlanItem["transitionOut"] & string> = [
		"fade",
		"slide-left",
		"slide-up",
		"wipe-left",
		"slide-right",
		"wipe-up",
	];
	return rotation[index % rotation.length];
}

function getTransitionPresentation(type: string, accent?: string): string {
	switch (type) {
		case "fade":
			return "fade()";
		case "slide-left":
			return 'slide({ direction: "from-right" })';
		case "slide-right":
			return 'slide({ direction: "from-left" })';
		case "slide-up":
			return 'slide({ direction: "from-bottom" })';
		case "slide-down":
			return 'slide({ direction: "from-top" })';
		case "wipe-left":
			return 'wipe({ direction: "from-right" })';
		case "wipe-right":
			return 'wipe({ direction: "from-left" })';
		case "wipe-up":
			return 'wipe({ direction: "from-bottom" })';
		case "wipe-down":
			return 'wipe({ direction: "from-top" })';
		case "zoom-morph":
			return "zoomMorph()";
		case "striped-slam":
			return accent ? `stripedSlam(8, ["#0a0a0a", "${accent}"])` : "stripedSlam()";
		case "zoom-punch":
			return "zoomPunch()";
		case "diagonal-reveal":
			return accent ? `diagonalReveal("${accent}")` : "diagonalReveal()";
		case "color-burst":
			return accent ? `colorBurst("${accent}")` : "colorBurst()";
		case "vertical-shutter":
			return accent ? `verticalShutter(7, ["#0a0a0a", "${accent}"])` : "verticalShutter()";
		case "glitch-slam":
			return "glitchSlam()";
		default:
			return "fade()";
	}
}

function getTransitionDuration(type: string): number {
	switch (type) {
		case "zoom-morph":
			return 25; // zoom morphs need more time to feel cinematic
		case "wipe-left":
		case "wipe-right":
		case "wipe-up":
		case "wipe-down":
			return 22;
		case "slide-left":
		case "slide-right":
		case "slide-up":
		case "slide-down":
			return 20;
		case "striped-slam":
			return 50; // needs time for slam + retract
		case "vertical-shutter":
			return 40;
		case "diagonal-reveal":
		case "color-burst":
			return 45;
		case "zoom-punch":
			return 40;
		case "glitch-slam":
			return 35;
		case "fade":
			return 15;
		default:
			return 15;
	}
}

// ── Scene Type Dispatch ────────────────────────────────────────────────

/** Smart default background effect based on scene type (when not explicitly set) */
function defaultBackgroundEffect(sceneType: string): string {
	switch (sceneType) {
		case "logo-reveal":
		case "camera-text":
			return "spotlight";
		case "typewriter-prompt":
			return "liquid-glass";
		case "metrics-dashboard":
			return "bokeh";
		case "ghost-hook":
			return "mesh-shift";
		case "word-slot-machine":
			return "gradient-wipe";
		case "gradient-mesh-hero":
			return "none"; // already has its own GradientMesh — don't double up
		case "impact-word":
		case "stacked-hierarchy":
		case "contrast-pairs":
			return "grain";
		case "echo-hero":
			return "spotlight";
		case "icon-showcase":
			return "wave-grid";
		case "data-flow-network":
		case "dashboard-deconstructed":
			return "pulse-grid";
		case "product-glow":
			return "bokeh";
		case "app-icon-cloud":
			return "liquid-glass";
		case "chat-narrative":
		case "notification-chaos":
			return "flowing-lines";
		case "browser-tabs-chaos":
			return "gradient-wipe";
		case "radial-vortex":
		case "outline-hero":
			return "particle-field";
		case "avatar-constellation":
			return "drifting-orbs";
		case "scrolling-list":
			return "spotlight";
		case "before-after":
			return "none";
		case "cta":
			return "aurora";
		default:
			return "flowing-lines";
	}
}

function renderSceneByType(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
	logoUrl?: string | null,
	websiteUrl?: string | null,
): string {
	// ── AI Video Clip scenes ──
	// If this scene has a generated video clip, render it as a full-bleed <Video>
	// with optional text overlay on top.
	if (scene.videoClipPath) {
		// blob: URLs are already seekable by Remotion; lucid:// for fallback
		const fileUrl = scene.videoClipPath.startsWith("blob:") || scene.videoClipPath.startsWith("http")
			? scene.videoClipPath
			: scene.videoClipPath.startsWith("lucid://")
				? scene.videoClipPath
				: `lucid://file/${scene.videoClipPath.replace(/\\/g, "/")}`;
		const videoSrc = JSON.stringify(fileUrl);
		const overlayText = scene.videoOverlayText !== false && scene.headline;
		const textColor = resolveTextColor(scene);
		const fontSize = scene.fontSize || 80;
		const animation = scene.animation || "blur-in";
		return `<AbsoluteFill>
        <BackgroundVideo src={${videoSrc}} />
        ${overlayText ? `<AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
          <AnimatedText text={${JSON.stringify(scene.headline)}} fontSize={${fontSize}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="${animation}" />
          ${scene.subtitle ? `<div style={{ marginTop: 16 }}><AnimatedText text={${JSON.stringify(scene.subtitle)}} fontSize={36} color="${textColor}90" fontFamily="'Inter', sans-serif" animation="words" delay={8} /></div>` : ""}
        </AbsoluteFill>` : ""}
        <Vignette intensity={0.25} />
      </AbsoluteFill>`;
	}

	let raw = renderSceneByTypeInner(scene, accent, bg, logoUrl, websiteUrl);
	// Inject background effect props into the first <Scene bg="..."> tag
	const effect = scene.backgroundEffect || defaultBackgroundEffect(scene.type);
	if (effect !== "none") {
		const pal = accentPalette(accent);
		const colors = JSON.stringify(scene.backgroundEffectColors || [pal.a, pal.w, pal.k, pal.c]);
		raw = raw.replace(
			/<Scene\s+bg="([^"]*)"/,
			`<Scene bg="$1" bgEffect="${effect}" bgEffectColors={${colors}} bgEffectIntensity={${scene.backgroundEffectIntensity ?? 0.7}}`,
		);
	}
	// Apply headline-layer overrides: position (wrap in absolutely-positioned
	// div that overrides Scene's flex centering) and timing (wrap in Sequence).
	// Order matters — position wrap goes INSIDE the time wrap so the positioned
	// content appears/disappears at the right time.
	const sceneDur = clampDuration(scene);
	const headlineLayer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	if (headlineLayer) {
		if (headlineLayer.position && headlineLayer.position !== "center") {
			raw = wrapSceneContentInPositioner(raw, headlineLayer.position);
		}
		const hasCustomStart = (headlineLayer.startFrame || 0) > 0;
		const hasCustomEnd =
			headlineLayer.endFrame !== undefined &&
			headlineLayer.endFrame !== -1 &&
			headlineLayer.endFrame < sceneDur;
		if (hasCustomStart || hasCustomEnd) {
			const startFrame = Math.max(0, headlineLayer.startFrame || 0);
			const endFrame =
				headlineLayer.endFrame === -1 || headlineLayer.endFrame === undefined
					? sceneDur
					: Math.min(headlineLayer.endFrame, sceneDur);
			const duration = Math.max(1, endFrame - startFrame);
			raw = wrapSceneContentInSequence(raw, startFrame, duration);
		}
	}
	// Inject text effects (glow, shadow, outline, bold, italic, etc.) from layer settings
	// into the first <AnimatedText in the output. This covers ALL scene types.
	if (headlineLayer?.settings) {
		const s = headlineLayer.settings;
		const styles: string[] = [];
		if (s.glow) styles.push(`textShadow: '${s.glow}'`);
		else if (s.shadow) styles.push(`textShadow: '${s.shadow}'`);
		if (s.outline) styles.push(`WebkitTextStroke: '${s.outline} rgba(0,0,0,0.6)'`);
		if (s.fontWeight) styles.push(`fontWeight: '${s.fontWeight}'`);
		if (s.fontStyle) styles.push(`fontStyle: '${s.fontStyle}'`);
		if (s.textDecoration) styles.push(`textDecoration: '${s.textDecoration}'`);
		if (styles.length > 0) {
			// Wrap the first AnimatedText in a styled div
			raw = raw.replace(
				/<AnimatedText /,
				`<div style={{ ${styles.join(", ")} }}><AnimatedText `,
			);
			// Close the wrapper after the AnimatedText's closing />
			raw = raw.replace(
				/(<div style=\{\{[^}]+\}\}><AnimatedText [^/]*\/>)/,
				"$1</div>",
			);
		}
	}
	// Inject any user-added "extra" layers as overlays inside the <Scene>.
	// Skip for legacy types — they already render ALL layers via compileLayer().
	// Skip for renderers without <Scene> (e.g. CameraText) — user layers for those
	// types should be added as primary layers via the scene-type-aware + Add button.
	if (!LEGACY_SCENE_TYPES.has(scene.type)) {
		const extras = renderExtraLayers(scene, accent);
		if (extras && raw.includes("</Scene>")) {
			raw = raw.replace(/<\/Scene>/, `${extras}\n      </Scene>`);
		}
	}
	return raw;
}

/** Wrap the children of the outermost <Scene> tag in a <Sequence>. Leaves the
 * <Scene> wrapper (and its bg/bgEffect props) untouched so the background stays
 * visible for the full scene duration. */
function wrapSceneContentInSequence(raw: string, from: number, duration: number): string {
	const openMatch = raw.match(/<Scene\b[^>]*>/);
	if (!openMatch) return raw;
	const openEnd = (openMatch.index || 0) + openMatch[0].length;
	const closeIndex = raw.lastIndexOf("</Scene>");
	if (closeIndex <= openEnd) return raw;
	const before = raw.slice(0, openEnd);
	const content = raw.slice(openEnd, closeIndex);
	const after = raw.slice(closeIndex);
	return `${before}\n        <Sequence from={${from}} durationInFrames={${duration}}>${content}</Sequence>\n      ${after}`;
}

/** Wrap the children of the outermost <Scene> tag in an absolutely positioned
 * div that overrides Scene's default flex centering. This is how
 * layer.position from the layer editor becomes a real placement in the
 * rendered video. */
function wrapSceneContentInPositioner(raw: string, position: SceneLayer["position"]): string {
	const openMatch = raw.match(/<Scene\b[^>]*>/);
	if (!openMatch) return raw;
	const openEnd = (openMatch.index || 0) + openMatch[0].length;
	const closeIndex = raw.lastIndexOf("</Scene>");
	if (closeIndex <= openEnd) return raw;

	let style = "";
	switch (position) {
		case "top":
			style =
				"position: 'absolute', top: '10%', left: 0, right: 0, display: 'flex', justifyContent: 'center'";
			break;
		case "bottom":
			style =
				"position: 'absolute', bottom: '10%', left: 0, right: 0, display: 'flex', justifyContent: 'center'";
			break;
		case "left":
			style = "position: 'absolute', top: '50%', left: '8%', transform: 'translateY(-50%)'";
			break;
		case "right":
			style = "position: 'absolute', top: '50%', right: '8%', transform: 'translateY(-50%)'";
			break;
		case "top-left":
			style = "position: 'absolute', top: '10%', left: '8%'";
			break;
		case "top-right":
			style = "position: 'absolute', top: '10%', right: '8%'";
			break;
		case "bottom-left":
			style = "position: 'absolute', bottom: '10%', left: '8%'";
			break;
		case "bottom-right":
			style = "position: 'absolute', bottom: '10%', right: '8%'";
			break;
		default:
			return raw; // center — no wrap needed, flex centering handles it
	}

	const before = raw.slice(0, openEnd);
	const content = raw.slice(openEnd, closeIndex);
	const after = raw.slice(closeIndex);
	return `${before}\n        <div style={{ ${style}, zIndex: 20 }}>${content}</div>\n      ${after}`;
}

// ── Extra-layer rendering ──────────────────────────────────────────────
//
function positionStyleFor(position: SceneLayer["position"]): string {
	switch (position) {
		case "top":
			return "top: '8%', left: '50%', transform: 'translateX(-50%)'";
		case "bottom":
			return "bottom: '8%', left: '50%', transform: 'translateX(-50%)'";
		case "left":
			return "top: '50%', left: '8%', transform: 'translateY(-50%)'";
		case "right":
			return "top: '50%', right: '8%', transform: 'translateY(-50%)'";
		case "top-left":
			return "top: '8%', left: '8%'";
		case "top-right":
			return "top: '8%', right: '8%'";
		case "bottom-left":
			return "bottom: '8%', left: '8%'";
		case "bottom-right":
			return "bottom: '8%', right: '8%'";
		default:
			return "top: '50%', left: '50%', transform: 'translate(-50%, -50%)'";
	}
}

// Renders ONLY user-added overlay layers (l- prefix). All primary/scene-type
// layers are now handled by their respective layer-unified renderers.
function renderExtraLayers(scene: ScenePlanItem, accent: string): string {
	const layers = scene.layers || [];
	const extras = layers.filter((l) => {
		if (l._incompatible) return false;
		// Only render user-added layers — everything else is handled by renderers
		return l.id.startsWith("l-") || l.id.startsWith("layer-");
	});
	if (extras.length === 0) return "";

	const sceneDur = clampDuration(scene);
	const isLight = isLightBg(scene.background);
	const parts: string[] = [];

	for (const layer of extras) {
		const startFrame = Math.max(0, layer.startFrame || 0);
		const endFrame =
			layer.endFrame === -1 || layer.endFrame === undefined
				? sceneDur
				: Math.min(layer.endFrame, sceneDur);
		const duration = Math.max(1, endFrame - startFrame);
		const posStyle = positionStyleFor(layer.position);

		if (layer.type === "text" && layer.content) {
			const fontSize = layer.settings?.fontSize || 80;
			const color = layer.settings?.color || (isLight ? "#050505" : "#ffffff");
			const animation = layer.settings?.animation || "words";
			const accentWord = layer.settings?.accentWord
				? ` accentWord=${JSON.stringify(layer.settings.accentWord)} accentColor="${accent}"`
				: "";
			const text = JSON.stringify(layer.content);
			// Text effects: glow, shadow, outline
			const textEffectStyles: string[] = [];
			if (layer.settings?.glow) textEffectStyles.push(`textShadow: '${layer.settings.glow}'`);
			if (layer.settings?.shadow) textEffectStyles.push(`textShadow: '${layer.settings.shadow}'`);
			if (layer.settings?.outline) textEffectStyles.push(`WebkitTextStroke: '${layer.settings.outline} rgba(0,0,0,0.6)'`);
			if (layer.settings?.fontWeight) textEffectStyles.push(`fontWeight: '${layer.settings.fontWeight}'`);
			if (layer.settings?.fontStyle) textEffectStyles.push(`fontStyle: '${layer.settings.fontStyle}'`);
			if (layer.settings?.textDecoration) textEffectStyles.push(`textDecoration: '${layer.settings.textDecoration}'`);
			const effectStyle = textEffectStyles.length > 0 ? `, ${textEffectStyles.join(", ")}` : "";
			parts.push(
				`        <Sequence from={${startFrame}} durationInFrames={${duration}}>\n` +
					`          <div style={{ position: 'absolute', ${posStyle}, zIndex: 30${effectStyle} }}>\n` +
					`            <AnimatedText text={${text}} fontSize={${fontSize}} color="${color}" animation="${animation}"${accentWord} />\n` +
					`          </div>\n` +
					`        </Sequence>`,
			);
		} else if (layer.type === "shape" && layer.content === "light-streak") {
			parts.push(
				`        <Sequence from={${startFrame}} durationInFrames={${duration}}>\n` +
					`          <LightStreak />\n` +
					`        </Sequence>`,
			);
		} else if (layer.type === "shape" && layer.content === "vignette") {
			const opacity = layer.settings?.opacity ?? 0.4;
			parts.push(
				`        <Sequence from={${startFrame}} durationInFrames={${duration}}>\n` +
					`          <Vignette intensity={${opacity}} />\n` +
					`        </Sequence>`,
			);
		} else if (layer.type === "lottie" && layer.content) {
			// Lottie file or URL — rendered via the LottieOverlay helper component.
			const src = JSON.stringify(layer.content);
			const loop = layer.settings?.loop !== false;
			parts.push(
				`        <Sequence from={${startFrame}} durationInFrames={${duration}}>\n` +
					`          <div style={{ position: 'absolute', ${posStyle}, zIndex: 25, width: '60%', pointerEvents: 'none' }}>\n` +
					`            <LottieOverlay src={${src}} loop={${loop}} />\n` +
					`          </div>\n` +
					`        </Sequence>`,
			);
		} else if (layer.type === "image" && layer.content) {
			// Image URL or a `screenshots[i]` expression — wrap accordingly.
			const isScreenshotRef = /^screenshots\[\d+\]$/.test(layer.content);
			const srcExpr = isScreenshotRef ? `{${layer.content}}` : `"${layer.content}"`;
			const sizePct = Math.max(10, Math.min(100, layer.size || 50));
			parts.push(
				`        <Sequence from={${startFrame}} durationInFrames={${duration}}>\n` +
					`          <div style={{ position: 'absolute', ${posStyle}, zIndex: 25, width: '${sizePct}%' }}>\n` +
					`            <Img src=${srcExpr} style={{ width: '100%', height: 'auto', borderRadius: 12 }} />\n` +
					`          </div>\n` +
					`        </Sequence>`,
			);
		}
		// Other types (card, icon-grid, etc.) are not yet supported as overlays.
	}

	return parts.length > 0 ? `\n${parts.join("\n")}` : "";
}

function renderSceneByTypeInner(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
	logoUrl?: string | null,
	websiteUrl?: string | null,
): string {
	switch (scene.type) {
		case "impact-word":
			return renderImpactWord(scene, accent, bg);
		case "ghost-hook":
			return renderGhostHook(scene, accent, bg);
		case "notification-chaos":
			return renderNotificationChaos(scene, accent, bg);
		case "chat-narrative":
			return renderChatNarrative(scene, accent, bg);
		case "before-after":
			return renderBeforeAfter(scene, accent, bg);
		case "metrics-dashboard":
			return renderMetricsDashboard(scene, accent, bg);
		case "icon-showcase":
			return renderIconShowcase(scene, accent, bg);
		case "logo-reveal":
			return renderLogoReveal(scene, accent, bg, logoUrl);
		case "typewriter-prompt":
			return renderTypewriterPrompt(scene, accent, bg);
		case "product-glow":
			return renderProductGlow(scene, accent, bg);
		case "stacked-hierarchy":
			return renderStackedHierarchy(scene, accent, bg);
		case "contrast-pairs":
			return renderContrastPairs(scene, accent, bg);
		case "radial-vortex":
			return renderRadialVortex(scene, accent, bg);
		case "outline-hero":
			return renderOutlineHero(scene, accent, bg);
		case "echo-hero":
			return renderEchoHero(scene, accent, bg);
		case "word-slot-machine":
			return renderWordSlotMachine(scene, accent, bg);
		case "avatar-constellation":
			return renderAvatarConstellation(scene, accent, bg);
		case "gradient-mesh-hero":
			return renderGradientMeshHero(scene, accent, bg);
		case "dashboard-deconstructed":
			return renderDashboardDeconstructed(scene, accent, bg);
		case "browser-tabs-chaos":
			return renderBrowserTabsChaos(scene, accent, bg);
		case "app-icon-cloud":
			return renderAppIconCloud(scene, accent, bg);
		case "data-flow-network":
			return renderDataFlowNetwork(scene, accent, bg);
		case "camera-text":
			return renderCameraText(scene, accent, bg);
		case "scrolling-list":
			return renderScrollingList(scene, accent, bg);
		case "device-showcase":
			return renderDeviceShowcase(scene, accent, bg);
		case "glass-stats":
			return renderGlassStats(scene, accent, bg);
		case "cinematic-title":
			return renderCinematicTitle(scene, accent, bg);
		case "countdown":
			return renderCountdown(scene, accent, bg);
		case "cta":
			return renderCTA(scene, accent, bg, logoUrl, websiteUrl);
		default: {
			// Check plugin registry for a custom renderer (pro/third-party scene types)
			const plugin = pluginRegistry.getSceneType(scene.type);
			if (plugin?.render) {
				const rendered = plugin.render(scene, accent, bg);
				if (rendered) return rendered;
			}
			return renderLegacyLayerBased(scene, accent, bg);
		}
	}
}

// ── Phase 3: Cinematic scene renderers ──────────────────────────────────

// [LAYER-UNIFIED]
function renderDeviceShowcase(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
): string {
	const screenshotIndex = scene.screenshotIndex ?? 0;
	const device = scene.variant === "phone" ? "phone" : "laptop";
	const hl = resolveHeadline(scene);
	const headline = hl ? JSON.stringify(hl) : null;
	const textColor = resolveTextColor(scene);
	const pal = accentPalette(accent);
	const ssLayer = scene.layers?.find((l) => l.id.startsWith("screenshot-"));
	const ssContent = ssLayer?.content || `screenshots[${screenshotIndex}]`;
	const isRef = /^screenshots\[\d+\]$/.test(ssContent);
	const srcExpr = isRef ? `{${ssContent}}` : `{${JSON.stringify(ssContent)}}`;
	return `<Scene bg="${bg}">
        <FloatingOrbs colors={["${accent}", "${pal.w}"]} count={3} opacity={0.15} blurAmount={140} />
        ${headline ? `<div style={{ marginBottom: 48 }}><AnimatedText text={${headline}} fontSize={${resolveHeadlineFontSize(scene, 80)}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="${resolveHeadlineAnimation(scene, "blur-in")}" /></div>` : ""}
        <DeviceMockup device="${device}" tilt={-4}>
          <Img src=${srcExpr} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </DeviceMockup>
        <Vignette intensity={0.3} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderGlassStats(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
): string {
	const metrics = metricsData(scene);
	const hl = resolveHeadline(scene);
	const headline = hl ? JSON.stringify(hl) : null;
	const textColor = resolveTextColor(scene);
	const pal = accentPalette(accent);
	return `<Scene bg="${bg}">
        <FloatingOrbs colors={["${accent}", "${pal.w}", "${pal.k}"]} count={4} opacity={0.2} blurAmount={120} />
        ${headline ? `<div style={{ marginBottom: 40 }}><AnimatedText text={${headline}} fontSize={${resolveHeadlineFontSize(scene, 72)}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="words" /></div>` : ""}
        <div style={{ display: 'flex', gap: ${scene.layerGap ?? 24}, justifyContent: 'center', flexWrap: 'wrap' }}>
          {${JSON.stringify(metrics)}.map((m, i) => (
            <GlassCard key={i} width={320} padding={32} borderRadius={20}>
              <div style={{ textAlign: 'center' }}>
                <MetricCounter value={m.value} prefix={m.prefix || ""} suffix={m.suffix || ""} fontSize={64} color="${textColor}" delay={i * 8} />
                <div style={{ fontSize: 20, color: '${textColor}80', fontFamily: "'Inter', sans-serif", marginTop: 8 }}>{m.label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderCinematicTitle(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
): string {
	const headline = JSON.stringify(resolveHeadline(scene, "Cinematic."));
	const textColor = resolveTextColor(scene);
	const pal = accentPalette(accent);
	const effect = scene.backgroundEffect || "sakura";
	const sub = resolveSubtitle(scene);
	return `<Scene bg="${bg}" bgEffect="${effect}" bgEffectColors={["${accent}","${pal.w}","${pal.k}"]} bgEffectIntensity={${scene.backgroundEffectIntensity ?? 0.8}}>
        <AnimatedText text={${headline}} fontSize={${resolveHeadlineFontSize(scene, 200)}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="${resolveHeadlineAnimation(scene, "gradient")}" gradientColors={["${accent}","${pal.w}","${pal.k}"]} />
        ${sub ? `<div style={{ marginTop: 20 }}><AnimatedText text={${JSON.stringify(sub)}} fontSize={36} color="${textColor}80" fontFamily="'Inter', sans-serif" animation="words" delay={12} /></div>` : ""}
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderCountdown(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
): string {
	const targetValue = scene.countdownTarget ?? 1000;
	const label = JSON.stringify(resolveHeadline(scene, "milestone reached"));
	const pal = accentPalette(accent);
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const sceneDur = ${clampDuration(scene)};
          const countDur = Math.floor(sceneDur * 0.6);
          const progress = Math.min(1, frame / countDur);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(eased * ${targetValue});
          const done = frame >= countDur;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ${scene.layerGap ?? 16} }}>
              <div style={{
                fontSize: 180, fontWeight: 900, fontFamily: "'Inter', sans-serif",
                color: done ? '${accent}' : '#ffffff',
                letterSpacing: '-0.04em',
                transform: done ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.3s, color 0.3s',
              }}>
                {current.toLocaleString()}
              </div>
              <div style={{ fontSize: 36, color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}>
                {${label}}
              </div>
              {done && <Confetti mode="burst" colors={["${accent}","${pal.w}","${pal.k}","#f59e0b","#10b981"]} intensity={1.2} />}
            </div>
          );
        })}
      </Scene>`;
}

function renderCTA(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
	logoUrl?: string | null,
	websiteUrl?: string | null,
): string {
	const variant = scene.variant || "centered";
	switch (variant) {
		case "split-logo":
			return renderCtaSplitLogo(scene, accent, bg, logoUrl, websiteUrl);
		case "gradient-bar":
			return renderCtaGradientBar(scene, accent, bg, logoUrl, websiteUrl);
		case "minimal":
			return renderCtaMinimal(scene, accent, bg, websiteUrl);
		default:
			return renderCtaCentered(scene, accent, bg, logoUrl, websiteUrl);
	}
}

/** Shared CTA helpers */
// [LAYER-UNIFIED]
function ctaShared(scene: ScenePlanItem, accent: string, logoUrl?: string | null, websiteUrl?: string | null) {
	const headline = JSON.stringify(resolveHeadline(scene, "Get Started"));
	const sub = resolveSubtitle(scene);
	const subtitle = sub ? JSON.stringify(sub) : null;
	const fontSize = resolveHeadlineFontSize(scene, 120);
	const textColor = resolveTextColor(scene);
	const dimColor = isLightBg(scene.background) ? "rgba(26,26,26,0.4)" : "rgba(255,255,255,0.4)";
	const pal = accentPalette(accent);
	// Logo: read from cta-logo layer. Only fall back if scene has NO layers (old project).
	const logoLayer = scene.layers?.find((l) => l.id === "cta-logo" && !l._incompatible);
	const logoSrc = logoLayer?.content || (!scene.layers?.length ? logoUrl : null);
	const logoHeight = logoLayer?.settings?.fontSize || 60;
	const logoImg = logoSrc
		? `<div style={{ marginBottom: 28 }}><Img src="${logoSrc}" style={{ height: ${logoHeight}, objectFit: 'contain' }} /></div>`
		: "";
	// URL: read from cta-url layer. Only fall back to websiteUrl if scene has NO layers
	// (i.e. old project before layer unification). If layers exist, absence of cta-url means user deleted it.
	const urlLayer = scene.layers?.find((l) => l.id === "cta-url" && !l._incompatible);
	const displayUrl = urlLayer?.content || (!scene.layers?.length ? websiteUrl : null);
	const urlColor = urlLayer?.settings?.color || dimColor;
	const urlFontSize = urlLayer?.settings?.fontSize || 24;
	// Button: read from cta-pill layer
	const ctaPillLayer = scene.layers?.find((l) => l.id === "cta-pill" && !l._incompatible);
	const ctaButtonText = ctaPillLayer?.content || "Get Started";
	const hasCtaPill = !scene.layers || scene.layers.some((l) => l.id === "cta-pill" && !l._incompatible);
	const btnBg = ctaPillLayer?.settings?.accentColor || accent;
	const autoColor = isDarkHex(btnBg) ? "#ffffff" : "#1a1a1a";
	// Use auto-contrast unless the user explicitly set a non-default color.
	// This catches legacy projects where white was hardcoded before contrast detection existed.
	const explicitColor = ctaPillLayer?.settings?.color;
	const btnColor = explicitColor && explicitColor !== "#ffffff" && explicitColor !== "#fff" && explicitColor !== "#1a1a1a"
		? explicitColor
		: autoColor;
	const btnFontSize = ctaPillLayer?.settings?.fontSize || 26;
	const btnAnimation = ctaPillLayer?.settings?.animation || "none";
	const btnBorderColor = ctaPillLayer?.settings?.borderColor;
	const btnPill = `<ButtonPill text={${JSON.stringify(ctaButtonText)}} fontSize={${btnFontSize}} bgColor="${btnBg}" textColor="${btnColor}" animation="${btnAnimation}" delay={15}${btnBorderColor ? ` borderColor="${btnBorderColor}"` : ""} />`;
	return { headline, subtitle, fontSize, textColor, dimColor, pal, displayUrl, urlColor, urlFontSize, logoImg, ctaButtonText, hasCtaPill, btnBg, btnColor, btnFontSize, btnPill };
}

/** CTA: centered — classic centered layout with logo + headline + button */
function renderCtaCentered(scene: ScenePlanItem, accent: string, bg: string, logoUrl?: string | null, websiteUrl?: string | null): string {
	const { headline, subtitle, fontSize, textColor, dimColor, displayUrl, urlColor, urlFontSize, logoImg, hasCtaPill, btnPill } = ctaShared(scene, accent, logoUrl, websiteUrl);
	return `<Scene bg="${bg}" padding={0}>
        ${logoImg}
        <AnimatedText text={${headline}} fontSize={${fontSize}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="blur-in" />
        ${subtitle ? `<div style={{ marginTop: 16 }}><AnimatedText text={${subtitle}} fontSize={36} color="${dimColor}" fontFamily="'Inter', sans-serif" animation="words" delay={8} /></div>` : ""}
        ${displayUrl ? `<div style={{ marginTop: 12, fontSize: ${urlFontSize}, fontWeight: 500, color: '${urlColor}', fontFamily: "'Inter', sans-serif", letterSpacing: '0.02em' }}>${displayUrl}</div>` : ""}
        ${hasCtaPill ? `<div style={{ marginTop: 32 }}>${btnPill}</div>` : ""}
        <Vignette intensity={0.3} />
      </Scene>`;
}

/** CTA: split-logo — logo on the left, headline + button stacked on the right */
function renderCtaSplitLogo(scene: ScenePlanItem, accent: string, bg: string, logoUrl?: string | null, websiteUrl?: string | null): string {
	const { headline, subtitle, fontSize, textColor, dimColor, displayUrl, urlColor, logoImg, hasCtaPill, btnPill } = ctaShared(scene, accent, logoUrl, websiteUrl);
	return `<Scene bg="${bg}" padding={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 80, maxWidth: 1400 }}>
          <div style={{ flexShrink: 0 }}>
            ${logoImg || `<GradientText text={${headline}} fontSize={80} colors={["${accent}","${accentPalette(accent).l}","${accentPalette(accent).w}"]} speed={3} />`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AnimatedText text={${headline}} fontSize={${Math.min(fontSize, 90)}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="blur-in" />
            ${subtitle ? `<div><AnimatedText text={${subtitle}} fontSize={32} color="${dimColor}" fontFamily="'Inter', sans-serif" animation="words" delay={8} /></div>` : ""}
            ${displayUrl ? `<div style={{ fontSize: 22, fontWeight: 500, color: '${urlColor}', fontFamily: "'Inter', sans-serif" }}>${displayUrl}</div>` : ""}
            ${hasCtaPill ? `<div style={{ marginTop: 16, alignSelf: 'flex-start' }}>${btnPill}</div>` : ""}
          </div>
        </div>
        <Vignette intensity={0.3} />
      </Scene>`;
}

/** CTA: gradient-bar — full-width gradient banner at bottom with text + button */
function renderCtaGradientBar(scene: ScenePlanItem, accent: string, bg: string, logoUrl?: string | null, websiteUrl?: string | null): string {
	const { headline, subtitle, fontSize, dimColor, pal, displayUrl, urlColor, logoImg, hasCtaPill, btnPill } = ctaShared(scene, accent, logoUrl, websiteUrl);
	return `<Scene bg="${bg}" padding={0}>
        ${logoImg}
        <GradientText text={${headline}} fontSize={${Math.min(fontSize, 140)}} colors={["${accent}","${pal.l}","${pal.w}","${pal.k}","${accent}"]} speed={3} />
        ${subtitle ? `<div style={{ marginTop: 16 }}><AnimatedText text={${subtitle}} fontSize={36} color="${dimColor}" fontFamily="'Inter', sans-serif" animation="words" delay={8} /></div>` : ""}
        ${displayUrl ? `<div style={{ marginTop: 8, fontSize: 24, fontWeight: 500, color: '${urlColor}', fontFamily: "'Inter', sans-serif" }}>${displayUrl}</div>` : ""}
        ${hasCtaPill ? `<div style={{ marginTop: 36 }}>${btnPill}</div>` : ""}
        <Vignette intensity={0.25} />
      </Scene>`;
}

/** CTA: minimal — just the product name, URL, no button, clean finish */
function renderCtaMinimal(scene: ScenePlanItem, accent: string, bg: string, websiteUrl?: string | null): string {
	const { headline, subtitle, fontSize, textColor, displayUrl, urlColor } = ctaShared(scene, accent, undefined, websiteUrl);
	return `<Scene bg="${bg}" padding={0}>
        <AnimatedText text={${headline}} fontSize={${Math.min(fontSize, 160)}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="blur-in" />
        ${subtitle ? `<div style={{ marginTop: 20 }}><AnimatedText text={${subtitle}} fontSize={40} color="${urlColor}" fontFamily="'Inter', sans-serif" animation="words" delay={8} /></div>` : ""}
        ${displayUrl ? `<div style={{ marginTop: 28, fontSize: 28, fontWeight: 600, color: '${accent}', fontFamily: "'Inter', sans-serif", letterSpacing: '0.02em' }}>${displayUrl}</div>` : ""}
        <Vignette intensity={0.2} />
      </Scene>`;
}

// ── Legacy layer-based rendering (for hero-text, cards, split-layout, etc.) ──

function renderLegacyLayerBased(scene: ScenePlanItem, accent: string, bg: string): string {
	const dur = scene.durationFrames || 90;
	const rawLayers = scene.layers !== undefined ? scene.layers : expandSceneToLayers(scene, accent);
	const allLayers = rawLayers.filter((l) => !l._incompatible);
	const centerLayers = allLayers.filter((l) => l.position === "center" && l.type !== "shape");
	const otherLayers = allLayers.filter((l) => l.position !== "center" || l.type === "shape");
	const nonCardCenter = centerLayers.filter((l) => l.type !== "card");
	const cardCenter = centerLayers.filter((l) => l.type === "card");
	const nonCardCode = nonCardCenter
		.map((l) => compileCenterLayer(l, accent))
		.join("\n            ");
	const cardCode =
		cardCenter.length > 0
			? `<div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', maxWidth: 1400 }}>\n              ${cardCenter.map((l) => compileCenterLayer(l, accent)).join("\n              ")}\n            </div>`
			: "";
	const centerCode = [nonCardCode, cardCode].filter(Boolean).join("\n            ");
	const otherCode = otherLayers.map((l) => compileLayer(l, dur, accent)).join("\n        ");

	return `<Scene bg="${bg}">
        ${centerLayers.length > 0 ? `<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: ${scene.layerGap ?? 16}, width: '100%', flex: 1 }}>\n            ${centerCode}\n          </div>` : ""}
        ${otherCode}
      </Scene>`;
}

// ── Rich scene type renderers ──────────────────────────────────────────

// [LAYER-UNIFIED] Reads content from layers, falls back to data fields
function renderImpactWord(scene: ScenePlanItem, accent: string, bg: string): string {
	const fontSize = resolveHeadlineFontSize(scene, 280);
	const animation = resolveHeadlineAnimation(scene, "scale");
	const fontFamily = resolveFontFamily(scene.font);
	const color = resolveTextColor(scene);
	const headline = JSON.stringify(resolveHeadline(scene, "Finally."));
	const aw = resolveAccentWord(scene);
	const accentWord = aw ? `accentWord=${JSON.stringify(aw)} accentColor="${accent}"` : "";
	return `<Scene bg="${bg}">
        <AnimatedText text={${headline}} fontSize={${fontSize}} color="${color}" fontFamily="${fontFamily}" animation="${animation}" maxWidth={2200} ${accentWord} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderGhostHook(scene: ScenePlanItem, _accent: string, bg: string): string {
	// Clamp to max 3 fragments — more than that overflows the screen at readable sizes
	const rawWords = resolveStringArray(scene, "ghost-word-", "ghostWords", resolveHeadline(scene, "Hello world").split(" "));
	const fragments = rawWords.slice(0, 3);
	const words = JSON.stringify(fragments);
	const activeIndex = Math.min(scene.ghostActiveIndex ?? 0, 2);
	// Auto-scale based on the LONGEST single fragment — that's what overflows.
	// At ~18px per char at 100px font, 1920px frame fits ~20 chars comfortably.
	const longestLen = Math.max(...fragments.map((f) => f.length));
	const autoSize =
		longestLen > 35
			? 70
			: longestLen > 28
				? 80
				: longestLen > 20
					? 95
					: longestLen > 14
						? 115
						: 140;
	// Respect user's fontSize if they set it, but cap at autoSize to prevent overflow
	const fontSize = scene.fontSize ? Math.min(scene.fontSize, autoSize) : autoSize;
	const color = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        <GhostSentence words={${words}} activeIndex={${activeIndex}} fontSize={${fontSize}} color="${color}" maxWidth={1700} gap={${scene.layerGap != null ? scene.layerGap / fontSize : 0.3}} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderNotificationChaos(scene: ScenePlanItem, _accent: string, bg: string): string {
	const defaultNotifs = [
		{ platform: "instagram", title: "Sarah", subtitle: "liked your post", time: "2m" },
		{ platform: "linkedin", title: "3 new messages", subtitle: "Connect with...", time: "5m" },
		{ platform: "twitter", title: "Alex", subtitle: "replied to you", time: "now" },
		{ platform: "email", title: "Re: Weekly report", subtitle: "Can we discuss...", time: "10m" },
		{ platform: "slack", title: "#general", subtitle: "@here urgent", time: "1m" },
		{ platform: "youtube", title: "New comment", subtitle: "This is amazing", time: "15m" },
	];
	const notifLayers = (scene.layers || []).filter((l) => l.id.startsWith("notif-") && !l._incompatible)
		.sort((a, b) => Number.parseInt(a.id.slice(6)) - Number.parseInt(b.id.slice(6)));
	const notifs = JSON.stringify(
		notifLayers.length > 0
			? notifLayers.map((l, i) => {
				const existing = scene.notifications?.[i] || defaultNotifs[i] || {};
				return { ...existing, title: l.content || existing.title || "" };
			})
			: scene.notifications || defaultNotifs,
	);
	const headline = JSON.stringify(resolveHeadline(scene, "Notifications everywhere."));
	const fontSize = resolveHeadlineFontSize(scene, 110);
	return `<Scene bg="${bg}">
        <NotificationCloud notifications={${notifs}}>
          <AnimatedText text={${headline}} fontSize={${fontSize}} color="#ffffff" fontFamily="'Inter', sans-serif" animation="words" />
        </NotificationCloud>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderChatNarrative(scene: ScenePlanItem, _accent: string, bg: string): string {
	const defaultMsgs = [
		{ user: "Sarah", text: "Anyone got the report?", time: "9:42 AM" },
		{ user: "Mike", text: "Working on it...", time: "9:43 AM" },
		{ user: "Sarah", text: "Need it in 5 min 🚨", time: "9:45 AM" },
	];
	const chatLayers = (scene.layers || []).filter((l) => l.id.startsWith("chat-msg-") && !l._incompatible)
		.sort((a, b) => Number.parseInt(a.id.slice(9)) - Number.parseInt(b.id.slice(9)));
	const messages = JSON.stringify(
		chatLayers.length > 0
			? chatLayers.map((l, i) => {
				const existing = scene.chatMessages?.[i] || defaultMsgs[i] || {};
				return { ...existing, text: l.content || existing.text || "" };
			})
			: scene.chatMessages || defaultMsgs,
	);
	const channel = JSON.stringify(resolveScalarLayer(scene, "chat-channel", "chatChannel", (l) => l.content || "general", "general"));
	return `<Scene bg="${bg}" padding={40}>
        <div style={{ width: '95%', height: '95%' }}>
          <ChatMessageFlow channel={${channel}} messages={${messages}} messageDelay={25} />
        </div>
      </Scene>`;
}

function renderBeforeAfter(scene: ScenePlanItem, accent: string, bg: string): string {
	const variant = scene.variant || "split-card";
	switch (variant) {
		case "swipe-reveal":
			return renderBeforeAfterSwipeReveal(scene, accent, bg);
		case "stacked-morph":
			return renderBeforeAfterStackedMorph(scene, accent, bg);
		case "toggle-switch":
			return renderBeforeAfterToggleSwitch(scene, accent, bg);
		default:
			return renderBeforeAfterSplitCard(scene, accent, bg);
	}
}

// [LAYER-UNIFIED]
/** Shared helpers for before-after variants */
function beforeAfterData(scene: ScenePlanItem, accent: string) {
	const beforeArr = resolveStringArray(scene, "before-", "beforeLines", ["Flat.", "Cluttered.", "Forgettable."]);
	const afterArr = resolveStringArray(scene, "after-", "afterLines", ["Clean.", "Branded.", "Ready to ship."]);
	const longest = Math.max(...beforeArr.map((l) => l.length), ...afterArr.map((l) => l.length));
	const lineSize = longest > 25 ? 36 : longest > 18 ? 42 : longest > 12 ? 52 : 64;
	const beforeBg = scene.beforeBgColor || "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)";
	const afterBg = scene.afterBgColor || "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)";
	const afterAccent = scene.afterAccentColor || accent;
	// Auto-contrast text colors based on panel backgrounds
	const beforeTextColor = isDarkHex(beforeBg) ? "rgba(255,255,255,0.85)" : "rgba(26,26,26,0.85)";
	const beforeHeaderColor = isDarkHex(beforeBg) ? "#fff" : "#1a1a1a";
	const afterTextColor = isDarkHex(afterBg) ? "#ffffff" : "#0f172a";
	return {
		beforeArr,
		afterArr,
		lineSize,
		beforeLines: JSON.stringify(beforeArr),
		afterLines: JSON.stringify(afterArr),
		beforeBg,
		afterBg,
		afterAccent,
		beforeTextColor,
		beforeHeaderColor,
		afterTextColor,
	};
}

/** before-after: split-card — original side-by-side card */
function renderBeforeAfterSplitCard(scene: ScenePlanItem, accent: string, bg: string): string {
	const { beforeLines, afterLines, lineSize, beforeBg, afterBg, afterAccent, beforeTextColor, beforeHeaderColor, afterTextColor } = beforeAfterData(scene, accent);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const headlineColor = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 40 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="words" /></div>` : ""}
        <div style={{ width: 1650, borderRadius: 32, overflow: 'hidden', position: 'relative', boxShadow: '0 40px 100px rgba(0,0,0,0.4)', display: 'flex' }}>
          <div style={{ width: '50%', background: '${beforeBg}', padding: '56px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 700, opacity: 0.55, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", color: '${beforeHeaderColor}' }}>Before</div>
            {${beforeLines}.map((l, i) => (
              <div key={i} style={{
                fontSize: ${lineSize}, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: '${beforeTextColor}',
                textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.6)', textDecorationThickness: '3px',
              }}>{l}</div>
            ))}
          </div>
          <div style={{ width: '50%', background: '${afterBg}', padding: '56px 48px', color: '${afterTextColor}', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '${afterAccent}', fontFamily: "'Inter', sans-serif" }}>After</div>
            {${afterLines}.map((l, i) => (
              <div key={i} style={{
                fontSize: ${lineSize}, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em',
                fontFamily: "'Inter', 'Helvetica Neue', sans-serif", display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{
                  width: ${lineSize * 0.5}, height: ${lineSize * 0.5}, borderRadius: '50%',
                  background: '${afterAccent}', color: '${isDarkHex(afterAccent) ? "#fff" : "#1a1a1a"}', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: ${lineSize * 0.35}, fontWeight: 900, flexShrink: 0,
                }}>✓</span>
                {l}
              </div>
            ))}
          </div>
        </div>
      </Scene>`;
}

/** before-after: swipe-reveal — animated wipe revealing "after" over "before" */
function renderBeforeAfterSwipeReveal(scene: ScenePlanItem, accent: string, bg: string): string {
	const { beforeArr, afterArr, lineSize, beforeBg, afterBg, afterAccent, beforeTextColor, beforeHeaderColor, afterTextColor } = beforeAfterData(scene, accent);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const headlineColor = resolveTextColor(scene);
	const beforeLines = JSON.stringify(beforeArr);
	const afterLines = JSON.stringify(afterArr);
	// Wipe at 50% of scene duration so "before" gets plenty of reading time
	const wipeDelay = Math.floor(clampDuration(scene) * 0.5);
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 40 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="words" /></div>` : ""}
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const wipe = spring({ frame: Math.max(0, frame - ${wipeDelay}), fps, config: { damping: 20, stiffness: 30 } });
          // Both sides always 50% width — the divider slides and content cross-fades
          return (
            <div style={{ display: 'flex', width: 1600, height: 520, borderRadius: 28, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
              <div style={{ width: '50%', background: '${beforeBg}', padding: '52px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, overflow: 'hidden', opacity: 1 - wipe * 0.3 }}>
                <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.55, letterSpacing: '0.15em', textTransform: 'uppercase', color: '${beforeHeaderColor}', fontFamily: "'Inter', sans-serif" }}>Before</div>
                {${beforeLines}.map((l, i) => (
                  <div key={i} style={{ fontSize: ${lineSize}, fontWeight: 800, color: '${beforeTextColor}', fontFamily: "'Inter', sans-serif", textDecoration: wipe > 0.5 ? 'line-through' : 'none', textDecorationColor: 'rgba(239,68,68,0.6)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{l}</div>
                ))}
              </div>
              <div style={{ width: 4, background: '${afterAccent}', boxShadow: '0 0 20px ${afterAccent}80', flexShrink: 0, zIndex: 2 }} />
              <div style={{ width: '50%', background: '${afterBg}', padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, overflow: 'hidden' }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '${afterAccent}', fontFamily: "'Inter', sans-serif", opacity: wipe }}>After</div>
                {${afterLines}.map((l, i) => {
                  const stagger = spring({ frame: Math.max(0, frame - ${wipeDelay} - i * 6), fps, config: { damping: 14, stiffness: 120 } });
                  return (
                    <div key={i} style={{ fontSize: ${lineSize}, fontWeight: 800, color: '${afterTextColor}', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 12, letterSpacing: '-0.03em', lineHeight: 1.1, opacity: stagger, transform: 'translateY(' + ((1 - stagger) * 20) + 'px)' }}>
                      <span style={{ color: '${afterAccent}', fontSize: ${lineSize * 0.5}, flexShrink: 0 }}>✓</span>
                      {l}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Scene>`;
}

/** before-after: stacked-morph — "before" list fades/shrinks, "after" list grows in its place */
function renderBeforeAfterStackedMorph(scene: ScenePlanItem, accent: string, bg: string): string {
	const { beforeArr, afterArr } = beforeAfterData(scene, accent);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const headlineColor = resolveTextColor(scene);
	const light = isLightBg(scene.background);
	const textColor = light ? "#1a1a1a" : "#ffffff";
	const dimColor = light ? "rgba(26,26,26,0.4)" : "rgba(255,255,255,0.4)";
	const maxLen = Math.max(beforeArr.length, afterArr.length);
	// Build paired items array
	const pairs = JSON.stringify(
		Array.from({ length: maxLen }, (_, i) => ({
			before: beforeArr[i] || "",
			after: afterArr[i] || "",
		})),
	);
	const fontSize = scene.fontSize || 72;
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 50 }}><AnimatedText text={${headline}} fontSize={${fontSize}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="words" /></div>` : ""}
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const pairs = ${pairs};
          const midFrame = ${Math.floor(clampDuration(scene) * 0.4)};
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {pairs.map((pair, i) => {
                const fadeOut = interpolate(frame, [midFrame - 5, midFrame + 5], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                const fadeIn = spring({ frame: Math.max(0, frame - midFrame - i * 3), fps, config: { damping: 14, stiffness: 100 } });
                return (
                  <div key={i} style={{ position: 'relative', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 600 }}>
                    <div style={{
                      position: 'absolute',
                      fontSize: 56, fontWeight: 800, color: '${dimColor}', fontFamily: "'Inter', sans-serif",
                      textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.5)',
                      opacity: fadeOut, transform: 'scale(' + (0.8 + fadeOut * 0.2) + ')',
                    }}>{pair.before}</div>
                    <div style={{
                      position: 'absolute',
                      fontSize: 56, fontWeight: 800, color: '${textColor}', fontFamily: "'Inter', sans-serif",
                      opacity: fadeIn, transform: 'translateY(' + ((1 - fadeIn) * 20) + 'px)',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <span style={{ color: '${accent}', fontSize: 32, flexShrink: 0 }}>✓</span>
                      {pair.after}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Scene>`;
}

/** before-after: toggle-switch — UI toggle that flips between states */
function renderBeforeAfterToggleSwitch(scene: ScenePlanItem, accent: string, bg: string): string {
	const { beforeArr, afterArr, lineSize, beforeBg, afterBg, afterAccent, beforeTextColor, afterTextColor } = beforeAfterData(scene, accent);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const headlineColor = resolveTextColor(scene);
	const light = isLightBg(scene.background);
	const textColor = light ? "#1a1a1a" : "#ffffff";
	const beforeLines = JSON.stringify(beforeArr);
	const afterLines = JSON.stringify(afterArr);
	// Toggle at 40% of scene duration so both states get adequate screen time
	const toggleFrame = Math.floor(clampDuration(scene) * 0.4);
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 40 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="words" /></div>` : ""}
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const toggle = spring({ frame: Math.max(0, frame - ${toggleFrame}), fps, config: { damping: 18, stiffness: 80 } });
          const isOn = toggle > 0.5;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: isOn ? '${light ? "rgba(26,26,26,0.35)" : "rgba(255,255,255,0.35)"}' : '${textColor}', fontFamily: "'Inter', sans-serif" }}>Before</span>
                <div style={{
                  width: 80, height: 42, borderRadius: 21, position: 'relative', cursor: 'pointer',
                  background: isOn ? '${accent}' : '${light ? "#d1d5db" : "#4b5563"}',
                  transition: 'background 0.3s',
                }}>
                  <div style={{
                    position: 'absolute', top: 4, width: 34, height: 34, borderRadius: '50%', background: '#fff',
                    left: (4 + toggle * 38) + 'px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: 22, fontWeight: 600, color: isOn ? '${textColor}' : '${light ? "rgba(26,26,26,0.35)" : "rgba(255,255,255,0.35)"}', fontFamily: "'Inter', sans-serif" }}>After</span>
              </div>
              <div style={{ position: 'relative', width: 1100, height: 360, borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.25)' }}>
                <div style={{
                  position: 'absolute', inset: 0, padding: '44px 52px',
                  background: '${beforeBg}',
                  display: 'flex', flexDirection: 'column', gap: 16,
                  opacity: 1 - toggle, transition: 'opacity 0.1s',
                }}>
                  {${beforeLines}.map((l, i) => (
                    <div key={i} style={{ fontSize: ${lineSize}, fontWeight: 800, color: '${beforeTextColor}', fontFamily: "'Inter', sans-serif", textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.5)' }}>{l}</div>
                  ))}
                </div>
                <div style={{
                  position: 'absolute', inset: 0, padding: '44px 52px',
                  background: '${afterBg}',
                  display: 'flex', flexDirection: 'column', gap: 16,
                  opacity: toggle,
                }}>
                  {${afterLines}.map((l, i) => (
                    <div key={i} style={{ fontSize: ${lineSize}, fontWeight: 800, color: '${afterTextColor}', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '${afterAccent}', fontSize: ${lineSize * 0.5} }}>✓</span>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </Scene>`;
}

function renderMetricsDashboard(scene: ScenePlanItem, accent: string, bg: string): string {
	const variant = scene.variant || "counter-row";
	switch (variant) {
		case "bar-chart":
			return renderMetricsBarChart(scene, accent, bg);
		case "pie-radial":
			return renderMetricsPieRadial(scene, accent, bg);
		case "ticker-tape":
			return renderMetricsTickerTape(scene, accent, bg);
		default:
			return renderMetricsCounterRow(scene, accent, bg);
	}
}

// [LAYER-UNIFIED]
function metricsData(scene: ScenePlanItem) {
	return resolvePairedArray(
		scene, "metric-value-", "metric-label-", "metrics",
		(valLayer, lblLayer, i) => {
			const existing = scene.metrics?.[i] || { value: 0, label: "", suffix: "" };
			return {
				...existing,
				...(valLayer?.content ? { value: Number(valLayer.content) || valLayer.content } : {}),
				...(lblLayer?.content ? { label: lblLayer.content } : {}),
				...(valLayer?.settings?.fontSize ? {} : {}), // fontSize handled by renderer
			};
		},
		[{ value: 10, label: "Times faster", suffix: "x" }, { value: 99, label: "Uptime", suffix: "%" }, { value: 0, label: "Setup required", suffix: "" }],
	);
}

/** metrics-dashboard: counter-row — original horizontal counters with dividers */
function renderMetricsCounterRow(scene: ScenePlanItem, _accent: string, bg: string): string {
	const metrics = metricsData(scene);
	const metricsJsx = metrics
		.map(
			(m, i) =>
				`<div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>${i > 0 ? `<div style={{ width: 2, height: 180, background: 'rgba(255,255,255,0.2)' }} />` : ""}<MetricCounter value={${m.value}} label="${m.label}" suffix="${m.suffix || ""}" prefix="${m.prefix || ""}" fontSize={160} /></div>`,
		)
		.join("");
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 60 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 90}} color="#ffffff" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>${metricsJsx}</div>
      </Scene>`;
}

/** metrics-dashboard: bar-chart — animated vertical bars with labels */
function renderMetricsBarChart(scene: ScenePlanItem, accent: string, bg: string): string {
	const metrics = metricsData(scene);
	const metricsJson = JSON.stringify(metrics);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const labelColor = light ? "#1a1a1a" : "rgba(255,255,255,0.7)";
	const maxVal = Math.max(...metrics.map((m) => Number(m.value) || 0), 1);
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 50 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 90}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const metrics = ${metricsJson};
          const maxVal = ${maxVal};
          const barH = 340;
          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 50, height: barH + 80 }}>
              {metrics.map((m, i) => {
                const grow = spring({ frame: Math.max(0, frame - i * 6), fps, config: { damping: 16, stiffness: 80 } });
                const h = Math.max(20, (m.value / maxVal) * barH * grow);
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '${headlineColor}', fontFamily: "'Inter', sans-serif" }}>{m.prefix || ''}{Math.round(m.value * grow)}{m.suffix || ''}</div>
                    <div style={{
                      width: 100, height: h, borderRadius: '12px 12px 4px 4px',
                      background: 'linear-gradient(180deg, ${accent} 0%, ${accent}80 100%)',
                      boxShadow: '0 4px 20px ${accent}30',
                    }} />
                    <div style={{ fontSize: 18, fontWeight: 600, color: '${labelColor}', fontFamily: "'Inter', sans-serif", textAlign: 'center', maxWidth: 140 }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Scene>`;
}

/** metrics-dashboard: pie-radial — radial progress rings */
function renderMetricsPieRadial(scene: ScenePlanItem, accent: string, bg: string): string {
	const metrics = metricsData(scene);
	const metricsJson = JSON.stringify(metrics);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const labelColor = light ? "#1a1a1a" : "rgba(255,255,255,0.7)";
	const trackColor = light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
	// Color palette for multiple rings
	const pal = accentPalette(accent);
	const ringColors = [accent, pal.w, pal.k, pal.c, pal.t];
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 50 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 90}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const metrics = ${metricsJson};
          const ringColors = ${JSON.stringify(ringColors)};
          const ringSize = 200;
          const strokeW = 14;
          const r = (ringSize - strokeW) / 2;
          const circ = 2 * Math.PI * r;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
              {metrics.map((m, i) => {
                const anim = spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 18, stiffness: 70 } });
                const pct = Math.min(m.value, 100) / 100;
                const dash = circ * pct * anim;
                const color = ringColors[i % ringColors.length];
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
                      <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="${trackColor}" strokeWidth={strokeW} />
                        <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
                          strokeDasharray={dash + ' ' + circ} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800, color: '${headlineColor}', fontFamily: "'Inter', sans-serif" }}>
                        {m.prefix || ''}{Math.round(m.value * anim)}{m.suffix || ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '${labelColor}', fontFamily: "'Inter', sans-serif" }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Scene>`;
}

/** metrics-dashboard: ticker-tape — scrolling stock-ticker style */
function renderMetricsTickerTape(scene: ScenePlanItem, _accent: string, bg: string): string {
	const metrics = metricsData(scene);
	const metricsJson = JSON.stringify(metrics);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const cardBg = light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";
	const borderColor = light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 50 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 90}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const metrics = ${metricsJson};
          return (
            <div style={{ display: 'flex', gap: 28 }}>
              {metrics.map((m, i) => {
                const enter = spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 14, stiffness: 100 } });
                const slideX = (1 - enter) * 80;
                const isPositive = m.value > 0;
                return (
                  <div key={i} style={{
                    opacity: enter,
                    transform: 'translateX(' + slideX + 'px)',
                    padding: '32px 44px',
                    borderRadius: 20,
                    background: '${cardBg}',
                    border: '1px solid ${borderColor}',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    minWidth: 240,
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '${light ? "rgba(26,26,26,0.5)" : "rgba(255,255,255,0.5)"}', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 56, fontWeight: 800, color: '${headlineColor}', fontFamily: "'Inter', sans-serif" }}>{m.prefix || ''}{Math.round(m.value * enter)}{m.suffix || ''}</span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: isPositive ? '#10b981' : '#ef4444', fontFamily: "'Inter', sans-serif" }}>{isPositive ? '▲' : '▼'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderIconShowcase(scene: ScenePlanItem, _accent: string, bg: string): string {
	const iconData = resolveStructuredArray(
		scene, "icon-item-", "iconItems",
		(l) => {
			try { return JSON.parse(l.content); } catch { return { icon: "✦", label: l.content || "" }; }
		},
		[{ icon: "⚡", label: "Fast" }, { icon: "🔒", label: "Secure" }, { icon: "✨", label: "Smart" }, { icon: "🎯", label: "Precise" }, { icon: "🚀", label: "Scalable" }, { icon: "💡", label: "Simple" }],
	);
	const items = JSON.stringify(iconData);
	const hl = resolveHeadline(scene);
	const headline = hl ? JSON.stringify(hl) : null;
	const itemCount = iconData.length;
	const columns = itemCount <= 2 ? itemCount : itemCount <= 4 ? 2 : itemCount % 3 === 0 ? 3 : itemCount % 2 === 0 ? 2 : 3;
	const textColor = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        ${headline ? `<div style={{ marginBottom: 50 }}><AnimatedText text={${headline}} fontSize={${resolveHeadlineFontSize(scene, 80)}} color="${textColor}" fontFamily="Georgia, serif" animation="clip" /></div>` : ""}
        <IconGrid items={${items}} columns={${columns}} iconSize={72} gap={48} delay={8} color="${textColor}" />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderLogoReveal(
	scene: ScenePlanItem,
	accent: string,
	bg: string,
	logoUrl?: string | null,
): string {
	const title = JSON.stringify(resolveHeadline(scene, "Product Name"));
	const sub = resolveSubtitle(scene);
	const subtitle = sub ? JSON.stringify(sub) : null;
	const fontSize = resolveHeadlineFontSize(scene, 160);
	const pal = accentPalette(accent);
	const light = isLightBg(bg);
	const subtitleColor = light ? "rgba(26,26,26,0.6)" : "rgba(255,255,255,0.6)";
	const logoImg = logoUrl
		? `<div style={{ marginBottom: 30 }}><Img src="${logoUrl}" style={{ height: 64, objectFit: 'contain' }} /></div>`
		: "";
	return `<Scene bg="${bg}">
        <FloatingOrbs colors={["${accent}", "${pal.w}", "${pal.k}"]} count={3} opacity={0.3} blurAmount={120} />
        ${logoImg}
        <GradientText text={${title}} fontSize={${fontSize}} colors={["${accent}","${pal.l}","${pal.w}","${pal.k}","${accent}"]} speed={3} />
        ${subtitle ? `<div style={{ marginTop: 28 }}><AnimatedText text={${subtitle}} fontSize={48} color="${subtitleColor}" fontFamily="'Inter', sans-serif" animation="blur-in" delay={12} /></div>` : ""}
        <LightStreak startFrame={15} durationFrames={25} color="rgba(96,165,250,0.7)" />
        <Vignette intensity={0.4} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderTypewriterPrompt(scene: ScenePlanItem, accent: string, bg: string): string {
	const twLayer = scene.layers?.find((l) => l.id === "typewriter-text");
	const placeholder = JSON.stringify(
		twLayer?.content || scene.typewriterText || resolveHeadline(scene, "Create something amazing..."),
	);
	const hl = resolveHeadline(scene);
	const sub = resolveSubtitle(scene);
	const headline =
		hl && !scene.typewriterText && !twLayer
			? null
			: sub
				? JSON.stringify(sub)
				: null;
	const pal = accentPalette(accent);
	return `<Scene bg="${bg}">
        <FloatingOrbs colors={["${accent}", "${pal.w}", "${pal.k}"]} count={3} opacity={0.22} blurAmount={130} />
        ${headline ? `<div style={{ marginBottom: 50 }}><AnimatedText text={${headline}} fontSize={64} color="rgba(255,255,255,0.7)" fontFamily="'Inter', sans-serif" animation="staccato" /></div>` : ""}
        <TypewriterInput placeholder={${placeholder}} width={1020} glowColors={["${accent}","${pal.w}","${pal.k}"]} />
        <Vignette intensity={0.4} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderProductGlow(scene: ScenePlanItem, accent: string, bg: string): string {
	const screenshotIndex = scene.screenshotIndex ?? 0;
	const perspectiveX = scene.perspectiveX ?? 12;
	const perspectiveY = scene.perspectiveY ?? -4;
	const hl = resolveHeadline(scene);
	const headline = hl ? JSON.stringify(hl) : null;
	const textColor = resolveTextColor(scene);
	const animation = resolveHeadlineAnimation(scene, "clip");
	const light = isLightBg(scene.background);
	const pal = accentPalette(accent);
	const glowColors = light
		? `["${accent}60","${pal.w}40","${pal.k}30"]`
		: `["${accent}","${pal.w}","${pal.k}"]`;
	const glowIntensity = light ? 0.6 : 1.1;
	// Read screenshot source from the layer if it exists (user may have changed it
	// to a URL or different screenshot index). Fall back to scene.screenshotIndex.
	const ssLayer = scene.layers?.find((l) => l.id.startsWith("screenshot-"));
	const ssContent = ssLayer?.content || `screenshots[${screenshotIndex}]`;
	const isScreenshotRef = /^screenshots\[\d+\]$/.test(ssContent);
	const srcExpr = isScreenshotRef ? `{${ssContent}}` : `{${JSON.stringify(ssContent)}}`;
	return `<Scene bg="${bg}">
        <FloatingOrbs colors={["${accent}", "${pal.w}"]} count={2} opacity={${light ? 0.08 : 0.18}} blurAmount={160} />
        ${headline ? `<div style={{ marginBottom: 40 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="${animation}" /></div>` : ""}
        <div style={{ transform: 'rotate(-2.5deg)' }}>
          <GlowFrame colors={${glowColors}} intensity={${glowIntensity}} perspectiveX={${perspectiveX}} perspectiveY={${perspectiveY}}>
            <Img src=${srcExpr} style={{ width: 1100, borderRadius: 16, display: 'block' }} />
          </GlowFrame>
        </div>
        ${light ? "" : "<Vignette intensity={0.35} />"}
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderStackedHierarchy(scene: ScenePlanItem, _accent: string, bg: string): string {
	const stackedData = resolveStructuredArray(
		scene, "stacked-line-", "stackedLines",
		(l) => ({ text: l.content || "", size: l.settings?.fontSize || 120 }),
		[{ text: "WHY SETTLE", size: 90 }, { text: "FOR", size: 110 }, { text: "LESS", size: 280 }],
	);
	const lines = JSON.stringify(stackedData);
	const color = isLightBg(scene.background) ? "#050505" : "#ffffff";
	return `<Scene bg="${bg}">
        <StackedText lines={${lines}} color="${color}" animation="drop" gap={${scene.layerGap ?? 12}} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderContrastPairs(scene: ScenePlanItem, _accent: string, bg: string): string {
	const pairs = resolvePairedArray(
		scene, "contrast-stmt-", "contrast-ctr-", "contrastPairs",
		(stmt, ctr) => ({ statement: stmt?.content || "", counter: ctr?.content || "" }),
		[{ statement: "You might be stable…", counter: "but not growing." }, { statement: "You might be earning…", counter: "but still at risk." }],
	);
	const light = isLightBg(scene.background);
	const mainColor = light ? "#050505" : "#ffffff";
	const dimColor = light ? "rgba(5,5,5,0.5)" : "rgba(255,255,255,0.5)";
	const mainSize = resolveHeadlineFontSize(scene, 100);
	const counterSize = Math.round(mainSize * 0.7);
	const pairsJson = JSON.stringify(pairs);
	return `{React.createElement(() => {
      const frame = useCurrentFrame();
      const { fps } = useVideoConfig();
      const pairs = ${pairsJson};
      return (
        <Scene bg="${bg}">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ${scene.layerGap ?? 8}, maxWidth: 1600 }}>
            {pairs.map((pair, i) => {
              const pairDelay = i * 40;
              const stmtEnter = spring({ frame: Math.max(0, frame - pairDelay), fps, config: { damping: 16, stiffness: 100 } });
              const ctrEnter = spring({ frame: Math.max(0, frame - pairDelay - 15), fps, config: { damping: 14, stiffness: 120 } });
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 16 }}>
                  <div style={{
                    fontSize: ${mainSize}, fontWeight: 800, color: '${mainColor}',
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    letterSpacing: '-0.03em', lineHeight: 1.1, textAlign: 'center',
                    opacity: stmtEnter, transform: 'translateY(' + ((1 - stmtEnter) * 30) + 'px)',
                  }}>{pair.statement}</div>
                  <div style={{
                    fontSize: ${counterSize}, fontWeight: 500, color: '${dimColor}',
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: '-0.01em', lineHeight: 1.2, textAlign: 'center',
                    opacity: ctrEnter, transform: 'translateY(' + ((1 - ctrEnter) * 20) + 'px)',
                  }}>{pair.counter}</div>
                </div>
              );
            })}
          </div>
        </Scene>
      );
    })}`;
}

// ── Round 2 renderers ──────────────────────────────────────────────────

// [LAYER-UNIFIED]
function renderRadialVortex(scene: ScenePlanItem, _accent: string, bg: string): string {
	const text = JSON.stringify(resolveHeadline(scene, "GOOD ENOUGH"));
	const color = resolveTextColor(scene);
	const baseFontSize = resolveHeadlineFontSize(scene, 80);
	return `<Scene bg="${bg}">
        <RadialTextVortex text={${text}} rings={5} baseFontSize={${baseFontSize}} color="${color}" rotationSpeed={0.3} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderOutlineHero(scene: ScenePlanItem, _accent: string, bg: string): string {
	const text = JSON.stringify(resolveHeadline(scene, "AVERAGE"));
	const color = resolveTextColor(scene);
	const fontSize = Math.max(220, resolveHeadlineFontSize(scene, 260));
	return `<Scene bg="${bg}">
        <OutlineText text={${text}} fontSize={${fontSize}} strokeWidth={3} color="${color}" maxWidth={2200} />
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderEchoHero(scene: ScenePlanItem, accent: string, bg: string): string {
	const text = JSON.stringify(resolveHeadline(scene, "33% time"));
	const fontSize = resolveHeadlineFontSize(scene, 220);
	return `<Scene bg="${bg}">
        <EchoText text={${text}} fontSize={${fontSize}} colors={["${accent}","${accentPalette(accent).w}","${accentPalette(accent).c}"]} echoCount={3} maxOffset={70} />
      </Scene>`;
}

function renderWordSlotMachine(scene: ScenePlanItem, accent: string, bg: string): string {
	const variant = scene.variant || "wheel";
	switch (variant) {
		case "typewriter-swap":
			return renderSlotTypewriterSwap(scene, accent, bg);
		case "flip-cards":
			return renderSlotFlipCards(scene, accent, bg);
		case "glitch-swap":
			return renderSlotGlitchSwap(scene, accent, bg);
		default:
			return renderSlotWheel(scene, accent, bg);
	}
}

// [LAYER-UNIFIED]
function slotData(scene: ScenePlanItem) {
	return {
		prefix: resolveScalarLayer(scene, "slot-prefix", "slotMachinePrefix", (l) => l.content || "Your", "Your"),
		words: resolveStringArray(scene, "slot-word-", "slotMachineWords", ["Product", "App", "Agency", "Story"]),
		selected: scene.slotMachineSelectedIndex ?? 1,
	};
}

/** word-slot-machine: wheel — original vertical slot wheel */
function renderSlotWheel(scene: ScenePlanItem, accent: string, bg: string): string {
	const { prefix, words, selected } = slotData(scene);
	const fontSize = scene.fontSize || 140;
	const color = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        <WordSlotMachine prefix={${JSON.stringify(prefix)}} words={${JSON.stringify(words)}} selectedIndex={${selected}} fontSize={${fontSize}} color="${color}" accentColor="${accent}" checkmark={true} />
      </Scene>`;
}

/** word-slot-machine: typewriter-swap — each word types out, gets struck through, next types */
function renderSlotTypewriterSwap(scene: ScenePlanItem, accent: string, bg: string): string {
	const { prefix, words, selected } = slotData(scene);
	const wordsJson = JSON.stringify(words);
	const longestWord = Math.max(...words.map((w: string) => w.length));
	const totalChars = (prefix?.length || 0) + longestWord;
	const fontSize = scene.fontSize || (totalChars > 25 ? 80 : totalChars > 15 ? 100 : 120);
	const light = isLightBg(scene.background);
	const color = light ? "#1a1a1a" : "#ffffff";
	const dur = clampDuration(scene);
	const framesPerWord = Math.max(30, Math.floor((dur * 0.7) / Math.max(1, words.length)));
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const words = ${wordsJson};
          const selected = ${selected};
          const fpw = ${framesPerWord};
          const currentIdx = Math.min(Math.floor(frame / fpw), words.length - 1);
          const isSettled = currentIdx >= selected;
          const wordFrame = frame - currentIdx * fpw;
          const displayWord = isSettled ? words[selected] : words[currentIdx];
          const typeProgress = Math.min(1, wordFrame / (fpw * 0.5));
          const charsToShow = isSettled ? displayWord.length : Math.ceil(displayWord.length * typeProgress);
          const strikeThrough = !isSettled && wordFrame > fpw * 0.75;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ${scene.layerGap ?? 16}, fontFamily: "'Inter', sans-serif" }}>
              <span style={{ fontSize: ${Math.round(fontSize * 0.5)}, fontWeight: 300, color: '${color}', opacity: 0.5 }}>${prefix}</span>
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <span style={{
                  fontSize: ${fontSize}, fontWeight: 800,
                  color: isSettled ? '${accent}' : '${color}',
                  textDecoration: strikeThrough ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(239,68,68,0.6)',
                  letterSpacing: '-0.03em',
                }}>{displayWord.slice(0, charsToShow)}</span>
                <span style={{
                  display: 'inline-block', width: 3, height: ${Math.round(fontSize * 0.7)},
                  background: isSettled ? '${accent}' : '${color}',
                  marginLeft: 4, verticalAlign: 'middle',
                  opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                }} />
                {isSettled && <span style={{ fontSize: ${Math.round(fontSize * 0.35)}, color: '${accent}', marginLeft: 16, fontWeight: 900 }}>✓</span>}
              </div>
            </div>
          );
        })}
      </Scene>`;
}

/** word-slot-machine: flip-cards — cards flip in one at a time, selected one stays */
function renderSlotFlipCards(scene: ScenePlanItem, accent: string, bg: string): string {
	const { prefix, words, selected } = slotData(scene);
	const wordsJson = JSON.stringify(words);
	const longestWord = Math.max(...words.map((w: string) => w.length));
	const fontSize = scene.fontSize || (longestWord > 20 ? 80 : longestWord > 12 ? 100 : 120);
	const light = isLightBg(scene.background);
	const color = light ? "#1a1a1a" : "#ffffff";
	const dur = clampDuration(scene);
	const framesPerWord = Math.max(25, Math.floor((dur * 0.7) / Math.max(1, words.length)));
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const words = ${wordsJson};
          const selected = ${selected};
          const fpw = ${framesPerWord};
          const currentIdx = Math.min(Math.floor(frame / fpw), words.length - 1);
          const isSettled = currentIdx >= selected;
          const displayWord = isSettled ? words[selected] : words[currentIdx];
          const flipProgress = spring({ frame: frame % fpw, fps, config: { damping: 14, stiffness: 90 } });
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ${scene.layerGap ?? 24}, fontFamily: "'Inter', sans-serif", perspective: 800 }}>
              <span style={{ fontSize: ${Math.round(fontSize * 0.5)}, fontWeight: 300, color: '${color}', opacity: 0.5 }}>${prefix}</span>
              <div style={{
                transform: isSettled ? 'none' : 'rotateX(' + ((1 - flipProgress) * 45) + 'deg)',
                padding: '36px 60px',
                borderRadius: 20,
                background: isSettled ? '${accent}15' : '${light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)"}',
                border: isSettled ? '2px solid ${accent}' : '1px solid ${light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"}',
                boxShadow: isSettled ? '0 12px 40px ${accent}20' : '0 8px 24px rgba(0,0,0,0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {isSettled && <span style={{ fontSize: ${Math.round(fontSize * 0.4)}, fontWeight: 900, color: '${accent}' }}>✓</span>}
                  <span style={{
                    fontSize: ${fontSize}, fontWeight: 800,
                    color: isSettled ? '${accent}' : '${color}',
                    letterSpacing: '-0.03em',
                  }}>{displayWord}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {words.map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === currentIdx ? '${accent}' : '${light ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)"}',
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </Scene>`;
}

/** word-slot-machine: glitch-swap — glitch effect between word transitions */
function renderSlotGlitchSwap(scene: ScenePlanItem, accent: string, bg: string): string {
	const { prefix, words, selected } = slotData(scene);
	const wordsJson = JSON.stringify(words);
	// Auto-scale font based on longest word + prefix
	const longestWord = Math.max(...words.map((w: string) => w.length));
	const totalChars = (prefix?.length || 0) + longestWord;
	const fontSize = scene.fontSize || (totalChars > 30 ? 72 : totalChars > 20 ? 90 : totalChars > 12 ? 108 : 140);
	const light = isLightBg(scene.background);
	const color = light ? "#1a1a1a" : "#ffffff";
	const dur = clampDuration(scene);
	// Give each word enough time to be read (min 25 frames = ~0.8s each)
	const framesPerWord = Math.max(25, Math.floor((dur * 0.65) / Math.max(1, selected + 1)));
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const words = ${wordsJson};
          const selected = ${selected};
          const framesPerWord = ${framesPerWord};
          const currentIdx = Math.min(Math.floor(frame / framesPerWord), words.length - 1);
          const isSettled = currentIdx >= selected;
          const displayWord = isSettled ? words[selected] : words[currentIdx];
          const transitionPhase = (frame % framesPerWord) / framesPerWord;
          const isTransitioning = !isSettled && transitionPhase > 0.7;
          const glitchX = isTransitioning ? Math.sin(frame * 8) * 8 : 0;
          const glitchY = isTransitioning ? Math.cos(frame * 11) * 4 : 0;
          const skew = isTransitioning ? Math.sin(frame * 13) * 5 : 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ${scene.layerGap ?? 16}, fontFamily: "'Inter', sans-serif", maxWidth: 1600 }}>
              <span style={{ fontSize: ${Math.round(fontSize * 0.6)}, fontWeight: 300, color: '${color}', opacity: 0.6 }}>${prefix}</span>
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <span style={{
                  fontSize: ${fontSize}, fontWeight: 800,
                  color: isSettled ? '${accent}' : '${color}',
                  transform: 'translate(' + glitchX + 'px, ' + glitchY + 'px) skewX(' + skew + 'deg)',
                  display: 'inline-block',
                  textShadow: isTransitioning ? (-glitchX) + 'px 0 #ef4444, ' + glitchX + 'px 0 #3b82f6' : 'none',
                  letterSpacing: '-0.03em',
                }}>{displayWord}</span>
                {isSettled && (
                  <span style={{ fontSize: ${Math.round(fontSize * 0.35)}, color: '${accent}', marginLeft: 16, fontWeight: 900, display: 'inline-block',
                    opacity: spring({ frame: Math.max(0, frame - selected * framesPerWord - 3), fps, config: { damping: 10, stiffness: 150 } }),
                  }}>✓</span>
                )}
              </div>
            </div>
          );
        })}
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderAvatarConstellation(scene: ScenePlanItem, accent: string, bg: string): string {
	const count = scene.avatarCount || 8;
	const headline = JSON.stringify(resolveHeadline(scene, "Trusted by thousands"));
	const fontSize = resolveHeadlineFontSize(scene, 110);
	const textColor = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        <AvatarConstellation avatarCount={${count}} colors={["${accent}", "${accentPalette(accent).w}", "${accentPalette(accent).c}", "${accentPalette(accent).t}", "${accentPalette(accent).k}"]}>
          <AnimatedText text={${headline}} fontSize={${fontSize}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="words" />
        </AvatarConstellation>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderGradientMeshHero(scene: ScenePlanItem, _accent: string, _bg: string): string {
	const meshColorArr = scene.meshColors || ["#ffd6e7", "#e0d4ff", "#d4fff1", "#ffefd6"];
	const isDark = isDarkHex(meshColorArr[0]);
	const textColor = resolveTextColor(scene);
	const dots = !isDark;
	const colors = JSON.stringify(meshColorArr);
	const headline = JSON.stringify(resolveHeadline(scene, "Premium, by default."));
	const subtitleText = resolveSubtitle(scene);
	const subtitleLayer = scene.layers?.find((l) => l.id.startsWith("subtitle-"));
	const subtitleColor = subtitleLayer?.settings?.color || (textColor === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(26,26,26,0.6)");
	const subtitle = subtitleText ? JSON.stringify(subtitleText) : null;
	const fontSize = resolveHeadlineFontSize(scene, 130);
	const effect = scene.backgroundEffect && scene.backgroundEffect !== "none" ? scene.backgroundEffect : null;
	const pal = accentPalette(_accent);
	const intensity = scene.backgroundEffectIntensity ?? 0.7;
	return `<AbsoluteFill>
        <AbsoluteFill style={{ opacity: ${intensity} }}><GradientMesh colors={${colors}} dots={${dots}} /></AbsoluteFill>
        ${effect ? `<AbsoluteFill style={{ pointerEvents: 'none' }}><AnimatedBackground variant="${effect}" colors={["${_accent}","${pal.w}","${pal.k}"]} intensity={${intensity}} /></AbsoluteFill>` : ""}
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          <AnimatedText text={${headline}} fontSize={${fontSize}} color="${textColor}" fontFamily="Georgia, serif" animation="blur-in" />
          ${subtitle ? `<div style={{ marginTop: 24 }}><AnimatedText text={${subtitle}} fontSize={36} color="${subtitleColor}" fontFamily="'Inter', sans-serif" animation="words" delay={12} /></div>` : ""}
        </AbsoluteFill>
      </AbsoluteFill>`;
}

// [LAYER-UNIFIED]
function renderDashboardDeconstructed(scene: ScenePlanItem, _accent: string, bg: string): string {
	const metrics = JSON.stringify(
		scene.dashboardMetrics || [
			{ label: "Users", value: "16,891", delta: "+25%" },
			{ label: "Storage", value: "123 TB", delta: "+12%" },
			{ label: "Revenue", value: "$2.4M", delta: "+31%" },
			{ label: "Uptime", value: "99.9%", delta: "Stable" },
		],
	);
	const hl = resolveHeadline(scene);
	const headline = hl ? JSON.stringify(hl) : null;
	const headlineColor = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', gap: ${scene.layerGap ?? 24} }}>
          ${headline ? `<div style={{ flexShrink: 0, paddingTop: 40, textAlign: 'center' }}><AnimatedText text={${headline}} fontSize={${resolveHeadlineFontSize(scene, 72)}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="clip" maxWidth={1500} /></div>` : ""}
          <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: 0 }}>
            <DashboardGrid metrics={${metrics}} showChart={true} />
          </div>
        </div>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderBrowserTabsChaos(scene: ScenePlanItem, _accent: string, bg: string): string {
	const tabs = JSON.stringify(
		resolveStringArray(scene, "browser-tab-", "browserTabs", [
			"linkedin.com", "twitter.com", "notion.so", "slack.com", "gmail.com", "figma.com",
			"github.com", "jira.atlassian...", "calendar.google...", "stackoverflow.com", "docs.google.com", "asana.com",
		]),
	);
	const headline = JSON.stringify(resolveHeadline(scene, "Endless tabs."));
	const fontSize = resolveHeadlineFontSize(scene, 140);
	return `<Scene bg="${bg}">
        <div style={{ position: 'absolute', top: 40, left: 40, right: 40, background: '#e8e8e8', borderRadius: 12, padding: '12px 16px', border: '1px solid #d0d0d0', display: 'flex', gap: 4, overflow: 'hidden', flexWrap: 'nowrap' }}>
          {${tabs}.map((tab, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              background: i === 0 ? '#ffffff' : 'rgba(255,255,255,0.5)',
              borderRadius: '8px 8px 0 0', fontSize: 14, color: '#333',
              fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
              border: '1px solid #d0d0d0', borderBottom: 'none',
              minWidth: 120, maxWidth: 180, flexShrink: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, background: '#888', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab}</span>
              <span style={{ marginLeft: 'auto', opacity: 0.5 }}>✕</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 100 }}>
          <AnimatedText text={${headline}} fontSize={${fontSize}} color="#1a1a1a" fontFamily="'Inter', sans-serif" animation="staccato" />
        </div>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderAppIconCloud(scene: ScenePlanItem, accent: string, bg: string): string {
	const icons = resolveStructuredArray(
		scene, "app-icon-", "appIcons",
		(l) => { try { return JSON.parse(l.content); } catch { return { icon: l.content || "✦", color: accent, label: "" }; } },
		[{ icon: "💬", color: "#4a154b", label: "Chat" },
		{ icon: "📧", color: "#ea4335", label: "Mail" },
		{ icon: "📊", color: "#0077b5", label: "Analytics" },
		{ icon: "📝", color: "#000000", label: "Docs" },
		{ icon: "🎯", color: "#ff6900", label: "Goals" },
		{ icon: "📅", color: "#4285f4", label: "Calendar" }],
	);
	// Generate positions dynamically based on icon count — spread evenly across
	// the frame with alternating vertical offsets so they don't overlap
	const n = Math.min(icons.length, 9);
	// Choose columns that avoid orphans: prefer even rows
	const cols = n <= 2 ? n : n <= 4 ? 2 : n % 3 === 0 ? 3 : n % 2 === 0 ? 2 : 3;
	const iconsJson = JSON.stringify(icons.slice(0, n));
	const headline = JSON.stringify(resolveHeadline(scene, "Every tool. One flow."));
	const fontSize = resolveHeadlineFontSize(scene, 120);
	const textColor = resolveTextColor(scene);
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const icons = ${iconsJson};
          const cols = ${cols};
          return (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 24, padding: '60px 80px', pointerEvents: 'none' }}>
              {icons.map((icon, i) => {
                const enter = spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 12, stiffness: 120 } });
                const float = Math.sin((frame / fps) * 1.5 + i * 2.1) * 8;
                const rot = Math.sin((frame / fps) * 0.8 + i * 1.3) * 6;
                return (
                  <div key={i} style={{
                    opacity: enter,
                    transform: 'translateY(' + ((1 - enter) * 40 + float) + 'px) rotate(' + rot + 'deg) scale(' + (0.5 + enter * 0.5) + ')',
                  }}>
                    <FloatingAppIcon icon={icon.icon} color={icon.color || '${accent}'} size={140} delay={0} rotation={0} />
                  </div>
                );
              })}
            </div>
          );
        })}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <AnimatedText text={${headline}} fontSize={${fontSize}} color="${textColor}" fontFamily="'Inter', sans-serif" animation="split" accentWord="One" accentColor="${accent}" />
        </div>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderScrollingList(scene: ScenePlanItem, accent: string, bg: string): string {
	// Read from layers first, fall back to data fields
	const scrollLayers = (scene.layers || [])
		.filter((l) => l.id.startsWith("scroll-line-") && !l._incompatible)
		.sort((a, b) => {
			const ai = Number.parseInt(a.id.slice("scroll-line-".length));
			const bi = Number.parseInt(b.id.slice("scroll-line-".length));
			return ai - bi;
		});
	const rawLines = scrollLayers.length > 0
		? scrollLayers.map((l) => ({ text: l.content || "", color: l.settings?.color, fontSize: l.settings?.fontSize, spacingAfter: l.settings?.spacingAfter, accentWord: l.settings?.accentWord, accentColor: l.settings?.accentColor }))
		: (scene.scrollingListLines || [
			{ text: "Record." },
			{ text: "Edit." },
			{ text: "Caption." },
			{ text: "Polish." },
			{ text: "Ship." },
		]);
	const textColor = resolveTextColor(scene);
	// Use scene.fontSize (synced from first scroll-line layer) as default, not headline fontSize
	const defaultSize = scene.fontSize || 130;
	const withColors = rawLines.map((l, i) => ({
		text: l.text,
		color: (l as any).color || (i === rawLines.length - 1 ? accent : textColor),
		size: (l as any).fontSize || defaultSize,
		spacingAfter: (l as any).spacingAfter || undefined,
		accentWord: (l as any).accentWord || undefined,
		accentColor: (l as any).accentColor || accent,
	}));
	const lines = JSON.stringify(
		withColors.map((l) => ({
			text: l.text, size: l.size, color: l.color,
			...(l.spacingAfter ? { spacingAfter: l.spacingAfter } : {}),
			...(l.accentWord ? { accentWord: l.accentWord, accentColor: l.accentColor } : {}),
		})),
	);
	const hl = resolveHeadline(scene);
	const headline =
		hl && hl !== rawLines[0].text ? JSON.stringify(hl) : null;
	const headlineColor = resolveTextColor(scene);
	// Compute stagger from scene duration so lines are paced across the full
	// scene. Reserve ~30% of the scene for the final "all-visible" hold.
	const sceneDur = clampDuration(scene);
	const revealPortion = Math.floor(sceneDur * 0.7);
	const stagger = Math.max(6, Math.floor(revealPortion / Math.max(1, rawLines.length)));
	const headlineLayer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	const headlineSpacing = headlineLayer?.settings?.spacingAfter ?? 36;
	return `<Scene bg="${bg}">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ${scene.layerGap ?? 12} }}>
          ${headline ? `<div style={{ marginBottom: ${headlineSpacing - (scene.layerGap ?? 12)} }}><AnimatedText text={${headline}} fontSize={${resolveHeadlineFontSize(scene, 60)}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="words" /></div>` : ""}
          <StackedText lines={${lines}} color="${textColor}" animation="scroll-up" stagger={${stagger}} gap={${scene.layerGap ?? 12}} />
        </div>
      </Scene>`;
}

// [LAYER-UNIFIED]
function renderCameraText(scene: ScenePlanItem, accent: string, bg: string): string {
	const sanitizeCamera = (
		keys: Array<{ frame: number; scale?: number; translateX?: number; translateY?: number }>,
	) =>
		keys.map((k) => ({
			...k,
			scale: k.scale !== undefined ? Math.max(0.25, Math.min(2.5, k.scale)) : undefined,
		}));
	const defaultWords = [
		{ text: "Meet", appearsAt: 0 },
		{ text: "●", appearsAt: 30, isLogo: true, logoContent: "●", logoColor: accent },
		{ text: resolveHeadline(scene, "Product"), appearsAt: 15, color: accent },
	];
	const cameraWordLayers = (scene.layers || [])
		.filter((l) => l.id.startsWith("camera-word-") && !l._incompatible)
		.sort((a, b) => Number.parseInt(a.id.slice(12)) - Number.parseInt(b.id.slice(12)));
	const wordData = cameraWordLayers.length > 0
		? cameraWordLayers.map((l, i) => {
			const existing = scene.cameraTextWords?.[i] || defaultWords[i] || {};
			return { ...existing, text: l.content || existing.text || "", appearsAt: l.startFrame || existing.appearsAt || 0, ...(l.settings?.color ? { color: l.settings.color } : {}) };
		})
		: scene.cameraTextWords || defaultWords;
	const words = JSON.stringify(wordData);
	const camera = JSON.stringify(
		sanitizeCamera(
			scene.cameraTextCamera || [
				// Gentler default: starts at 2x (camera close), settles to 1.2, holds, zooms out to 0.4
				{ frame: 0, scale: 2, translateY: 80 },
				{ frame: 12, scale: 1.4, translateY: 20 },
				{ frame: 22, scale: 1.2, translateY: 0 },
				{ frame: 42, scale: 1.2, translateY: 0 }, // HOLD — text readable here
				{ frame: 58, scale: 0.4, translateY: -40 },
			],
		),
	);
	// Auto-scale fontSize based on the longest word/phrase to prevent overflow.
	// The AI sometimes puts full phrases as single "words" (e.g. "What if your data had a").
	const rawWords = scene.cameraTextWords || [];
	const longestWord = Math.max(...rawWords.map((w) => w.text.length), 1);
	const autoSize = longestWord > 25 ? 70 : longestWord > 18 ? 85 : longestWord > 12 ? 105 : 140;
	const fontSize = scene.fontSize ? Math.min(scene.fontSize, autoSize) : autoSize;
	return `<CameraText words={${words}} camera={${camera}} fontSize={${fontSize}} bg="${bg}" />`;
}

function renderDataFlowNetwork(scene: ScenePlanItem, accent: string, bg: string): string {
	const variant = scene.variant || "circles";
	switch (variant) {
		case "timeline-arrows":
			return renderDataFlowTimelineArrows(scene, accent, bg);
		case "hex-grid":
			return renderDataFlowHexGrid(scene, accent, bg);
		case "isometric-blocks":
			return renderDataFlowIsometricBlocks(scene, accent, bg);
		case "orbital-rings":
			return renderDataFlowOrbitalRings(scene, accent, bg);
		default:
			return renderDataFlowCircles(scene, accent, bg);
	}
}

/** data-flow-network: circles — original connected floating circles */
function renderDataFlowCircles(scene: ScenePlanItem, accent: string, bg: string): string {
	const nodes = resolveStringArray(scene, "network-node-", "networkNodes", ["Input", "Process", "Analyze", "Decide", "Output"]);
	const nodesJson = JSON.stringify(nodes);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const nodeTextColor = light ? "#1a1a1a" : "#ffffff";
	const nodeStyle = light
		? `background: '${accent}18',
                    border: '2.5px solid ${accent}',
                    boxShadow: '0 4px 20px ${accent}25',`
		: `background: 'radial-gradient(circle, ${accent} 0%, ${accent}40 70%, transparent 100%)',
                    border: '3px solid ${accent}',
                    boxShadow: '0 0 ' + glowPulse + 'px ' + (glowPulse * 0.7) + 'px ${accent}60',`;
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const nodes = ${nodesJson};
          const n = nodes.length;
          const getY = (i) => {
            const baseY = 280 + Math.sin(i * 1.3) * 40;
            const drift = Math.sin((frame / fps) * 2.5 + i * 1.7) * 25;
            return baseY + drift;
          };
          const getX = (i) => 100 + (i * 1200) / (n - 1);
          const getScale = (i) => {
            const enter = spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 12, stiffness: 120 } });
            return 0.3 + enter * 0.7;
          };
          return (
            <div style={{ position: 'relative', width: 1400, height: 550 }}>
              <svg width="1400" height="550" style={{ position: 'absolute', inset: 0 }}>
                {nodes.map((_, i) => {
                  if (i >= n - 1) return null;
                  const x1 = getX(i); const x2 = getX(i + 1);
                  const y1 = getY(i); const y2 = getY(i + 1);
                  const dashOffset = -frame * 1.5;
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="${accent}" strokeWidth="2.5" strokeDasharray="8,6" strokeDashoffset={dashOffset} opacity="${light ? "0.35" : "0.5"}" />;
                })}
              </svg>
              {nodes.map((node, i) => {
                const x = getX(i);
                const y = getY(i);
                const s = getScale(i);
                ${light ? "" : "const glowPulse = 30 + Math.sin((frame / fps) * 3 + i * 2.1) * 15;"}
                return (
                  <div key={i} style={{
                    position: 'absolute', left: x, top: y,
                    transform: 'translate(-50%, -50%) scale(' + s + ')',
                    width: 160, height: 160, borderRadius: '50%',
                    ${nodeStyle}
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 700, color: '${nodeTextColor}',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'box-shadow 0.1s',
                  }}>{node}</div>
                );
              })}
            </div>
          );
        })}
        ${headline ? `<div style={{ marginTop: 30 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
      </Scene>`;
}

/** data-flow-network: timeline-arrows — horizontal timeline with arrow connectors */
function renderDataFlowTimelineArrows(scene: ScenePlanItem, accent: string, bg: string): string {
	const nodes = resolveStringArray(scene, "network-node-", "networkNodes", ["Input", "Process", "Analyze", "Decide", "Output"]);
	const nodesJson = JSON.stringify(nodes);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const textColor = light ? "#1a1a1a" : "#ffffff";
	const pillBg = light ? `${accent}15` : `${accent}25`;
	const pillBorder = `${accent}`;
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const nodes = ${nodesJson};
          const n = nodes.length;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
              {nodes.map((node, i) => {
                const enter = spring({ frame: Math.max(0, frame - i * 6), fps, config: { damping: 14, stiffness: 100 } });
                const arrowEnter = spring({ frame: Math.max(0, frame - (i + 0.5) * 6), fps, config: { damping: 14, stiffness: 100 } });
                return (
                  <React.Fragment key={i}>
                    <div style={{
                      opacity: enter,
                      transform: 'translateY(' + ((1 - enter) * 30) + 'px)',
                      padding: '20px 36px',
                      borderRadius: 16,
                      background: '${pillBg}',
                      border: '2px solid ${pillBorder}',
                      fontSize: 22, fontWeight: 700,
                      color: '${textColor}',
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 24px ${accent}20',
                    }}>{node}</div>
                    {i < n - 1 && (
                      <svg width="60" height="24" style={{ opacity: arrowEnter, flexShrink: 0 }}>
                        <defs>
                          <marker id={'ah' + i} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                            <path d="M0,0 L8,4 L0,8 Z" fill="${accent}" />
                          </marker>
                        </defs>
                        <line x1="4" y1="12" x2="48" y2="12" stroke="${accent}" strokeWidth="2.5" strokeDasharray="6,4" strokeDashoffset={-frame * 1.2} markerEnd={'url(#ah' + i + ')'} />
                      </svg>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
        ${headline ? `<div style={{ marginTop: 50 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
      </Scene>`;
}

/** data-flow-network: hex-grid — hexagonal nodes with glowing edges */
function renderDataFlowHexGrid(scene: ScenePlanItem, accent: string, bg: string): string {
	const nodes = resolveStringArray(scene, "network-node-", "networkNodes", ["Input", "Process", "Analyze", "Decide", "Output"]);
	const nodesJson = JSON.stringify(nodes);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const textColor = light ? "#1a1a1a" : "#ffffff";
	// Hexagonal staggered grid: odd nodes shift down
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const nodes = ${nodesJson};
          const n = nodes.length;
          const hexSize = 130;
          const gapX = hexSize * 1.85;
          const totalW = (n - 1) * gapX;
          const startX = (1400 - totalW) / 2;
          return (
            <div style={{ position: 'relative', width: 1400, height: 500 }}>
              <svg width="1400" height="500" style={{ position: 'absolute', inset: 0 }}>
                {nodes.map((_, i) => {
                  if (i >= n - 1) return null;
                  const x1 = startX + i * gapX;
                  const y1 = 250 + (i % 2 === 0 ? -40 : 40);
                  const x2 = startX + (i + 1) * gapX;
                  const y2 = 250 + ((i + 1) % 2 === 0 ? -40 : 40);
                  const lineEnter = spring({ frame: Math.max(0, frame - i * 5 - 8), fps, config: { damping: 14, stiffness: 100 } });
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="${accent}" strokeWidth="2" opacity={lineEnter * ${light ? 0.3 : 0.5}} strokeDasharray="6,4" strokeDashoffset={-frame * 1.2} />;
                })}
              </svg>
              {nodes.map((node, i) => {
                const x = startX + i * gapX;
                const y = 250 + (i % 2 === 0 ? -40 : 40);
                const enter = spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 12, stiffness: 110 } });
                return (
                  <div key={i} style={{
                    position: 'absolute', left: x, top: y,
                    transform: 'translate(-50%, -50%) scale(' + (0.3 + enter * 0.7) + ')',
                    width: hexSize, height: hexSize,
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    background: '${light ? `${accent}20` : `${accent}35`}',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '${textColor}',
                    fontFamily: "'Inter', sans-serif",
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                      border: '2px solid ${accent}',
                      boxSizing: 'border-box',
                    }} />
                    <span style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 8 }}>{node}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
        ${headline ? `<div style={{ marginTop: 30 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
      </Scene>`;
}

/** data-flow-network: isometric-blocks — 3D blocks connected by pipes */
function renderDataFlowIsometricBlocks(scene: ScenePlanItem, accent: string, bg: string): string {
	const nodes = resolveStringArray(scene, "network-node-", "networkNodes", ["Input", "Process", "Analyze", "Decide", "Output"]);
	const nodesJson = JSON.stringify(nodes);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const textColor = light ? "#1a1a1a" : "#ffffff";
	const blockFace = light ? `${accent}18` : `${accent}30`;
	const blockSide = light ? `${accent}10` : `${accent}20`;
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const nodes = ${nodesJson};
          const n = nodes.length;
          const blockW = 200;
          const blockH = 110;
          const gapX = 250;
          const totalW = (n - 1) * gapX;
          const startX = (1400 - totalW) / 2;
          const baseY = 260;
          return (
            <div style={{ position: 'relative', width: 1400, height: 520 }}>
              {nodes.map((node, i) => {
                const x = startX + i * gapX;
                const y = baseY + (i % 2 === 0 ? 0 : 50);
                const enter = spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 14, stiffness: 100 } });
                const lift = (1 - enter) * 60;
                return (
                  <React.Fragment key={i}>
                    <div style={{
                      position: 'absolute', left: x - blockW / 2, top: y - blockH / 2,
                      transform: 'translateY(' + (-lift) + 'px) perspective(800px) rotateX(12deg) rotateY(-8deg)',
                      opacity: enter,
                      width: blockW, height: blockH,
                      background: '${blockFace}',
                      border: '2px solid ${accent}60',
                      borderRadius: 14,
                      boxShadow: '8px 8px 0 ${blockSide}, 0 16px 40px ${accent}15',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, fontWeight: 700, color: '${textColor}',
                      fontFamily: "'Inter', sans-serif",
                    }}>{node}</div>
                    {i < n - 1 && (() => {
                      const nx = startX + (i + 1) * gapX;
                      const ny = baseY + ((i + 1) % 2 === 0 ? 0 : 50);
                      const pipeEnter = spring({ frame: Math.max(0, frame - i * 5 - 6), fps, config: { damping: 14, stiffness: 100 } });
                      return (
                        <svg style={{ position: 'absolute', left: 0, top: 0, width: 1400, height: 520, pointerEvents: 'none' }}>
                          <line x1={x + blockW / 2 - 10} y1={y} x2={nx - blockW / 2 + 10} y2={ny}
                            stroke="${accent}" strokeWidth="2.5" strokeDasharray="8,5"
                            strokeDashoffset={-frame * 1.3} opacity={pipeEnter * ${light ? 0.3 : 0.5}} />
                        </svg>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
        ${headline ? `<div style={{ marginTop: 30 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
      </Scene>`;
}

/** data-flow-network: orbital-rings — nodes orbiting a center point */
function renderDataFlowOrbitalRings(scene: ScenePlanItem, accent: string, bg: string): string {
	const nodes = resolveStringArray(scene, "network-node-", "networkNodes", ["Input", "Process", "Analyze", "Decide", "Output"]);
	const nodesJson = JSON.stringify(nodes);
	const headline = scene.headline ? JSON.stringify(scene.headline) : null;
	const light = isLightBg(scene.background);
	const headlineColor = light ? "#1a1a1a" : "#ffffff";
	const textColor = light ? "#1a1a1a" : "#ffffff";
	return `<Scene bg="${bg}">
        {React.createElement(() => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const nodes = ${nodesJson};
          const n = nodes.length;
          const cx = 700;
          const cy = 300;
          const radius = 220;
          return (
            <div style={{ position: 'relative', width: 1400, height: 600 }}>
              <svg width="1400" height="600" style={{ position: 'absolute', inset: 0 }}>
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="${accent}" strokeWidth="1.5" opacity="${light ? "0.15" : "0.25"}" strokeDasharray="4,6" />
                <circle cx={cx} cy={cy} r={radius * 0.6} fill="none" stroke="${accent}" strokeWidth="1" opacity="${light ? "0.1" : "0.15"}" strokeDasharray="3,5" />
              </svg>
              {nodes.map((node, i) => {
                const enter = spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 12, stiffness: 110 } });
                const angle = (i / n) * Math.PI * 2 + (frame / fps) * 0.4;
                const r = i === 0 ? 0 : radius * (0.5 + (i % 2) * 0.5);
                const x = cx + Math.cos(angle) * r * enter;
                const y = cy + Math.sin(angle) * r * enter;
                const size = i === 0 ? 160 : 120;
                const isCenter = i === 0;
                return (
                  <div key={i} style={{
                    position: 'absolute', left: x, top: y,
                    transform: 'translate(-50%, -50%)',
                    width: size, height: size, borderRadius: '50%',
                    background: isCenter ? '${accent}' : '${light ? `${accent}15` : `${accent}30`}',
                    border: '2px solid ${accent}',
                    boxShadow: isCenter ? '0 0 40px ${accent}50' : '0 4px 20px ${accent}15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isCenter ? 22 : 18, fontWeight: 700,
                    color: isCenter ? '#ffffff' : '${textColor}',
                    fontFamily: "'Inter', sans-serif",
                    opacity: enter,
                  }}>{node}</div>
                );
              })}
            </div>
          );
        })}
        ${headline ? `<div style={{ marginTop: 20 }}><AnimatedText text={${headline}} fontSize={${scene.fontSize || 80}} color="${headlineColor}" fontFamily="'Inter', sans-serif" animation="blur-in" /></div>` : ""}
      </Scene>`;
}

// ── Expand scene to layers ──────────────────────────────────────────────

/**
 * Scene types whose rich renderer does NOT read scene.headline. For these,
 * emitting a headline layer creates a ghost row in the panel that doesn't
 * match anything on screen. We skip it for these types.
 */
const SCENE_TYPES_WITHOUT_HEADLINE = new Set<string>([
	"ghost-hook", // reads ghostWords
	"camera-text", // reads cameraTextWords
	"stacked-hierarchy", // reads stackedLines
	"contrast-pairs", // reads contrastPairs
	"word-slot-machine", // reads slotMachineWords
]);

/**
 * Scene types that ignore scene.effects / scene.subtitle. Rich renderers
 * build their own structure; legacy scene types (hero-text, full-bleed,
 * split-layout, cards, cta) are the ones that honor effects.
 */
const LEGACY_SCENE_TYPES = new Set<string>([
	"hero-text",
	"full-bleed",
	"split-layout",
	"cards",
	"screenshot",
	"cta",
	"glitch-intro",
	"stacked-text",
]);

/**
 * Convert a scene's properties (headline, subtitle, cards, effects, etc.)
 * into explicit layers. This makes EVERYTHING editable and repositionable.
 *
 * The expansion is scene-type-aware: headline / subtitle / effects layers
 * are only emitted when the rich renderer for that scene type actually reads
 * them. Without this, ghost-hook and camera-text scenes show stale headline
 * rows in the panel that don't match what's on screen.
 */
export function expandSceneToLayers(scene: ScenePlanItem, accent: string): SceneLayer[] {
	const layers: SceneLayer[] = [];
	const fontFamily = resolveFontFamily(scene.font);
	const color = isLightBg(scene.background) ? "#050505" : "#ffffff";
	const skipHeadline = SCENE_TYPES_WITHOUT_HEADLINE.has(scene.type);
	const isLegacy = LEGACY_SCENE_TYPES.has(scene.type);

	// ── Headline layer ──
	if (scene.headline && !skipHeadline) {
		const headlineSize = Math.max(100, scene.fontSize || 120);
		layers.push({
			id: "headline-0",
			type: "text",
			content: scene.headline,
			position: "center",
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
	// Skipped for scene types that don't render subtitles (same list as headline).
	if (scene.subtitle && !skipHeadline) {
		layers.push({
			id: "subtitle-0",
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

	// ── Camera-text words (for camera-text scene type) ──
	// Each word in scene.cameraTextWords becomes an editable text layer. The
	// layer stores the word's visible `text` as content and carries its color
	// in settings.color so the panel shows the baked accent (e.g. "Lucid"
	// rendered in brand blue). Other word fields (appearsAt, isLogo, logoContent,
	// logoColor) are preserved by the sync logic in updateScenePlan.
	if (scene.type === "camera-text" && scene.cameraTextWords && scene.cameraTextWords.length > 0) {
		scene.cameraTextWords.forEach((word, i) => {
			layers.push({
				id: `camera-word-${i}`,
				type: "text",
				content: word.text,
				position: "center",
				size: 30,
				startFrame: word.appearsAt || 0,
				endFrame: -1,
				settings: {
					fontSize: 80,
					color: word.color || color,
					animation: "words",
				},
			});
		});
	}

	// ── Ghost sentence words (for ghost-hook scene type) ──
	if (scene.type === "ghost-hook" && scene.ghostWords && scene.ghostWords.length > 0) {
		scene.ghostWords.forEach((word, i) => {
			layers.push({
				id: `ghost-word-${i}`,
				type: "text",
				content: word,
				position: "center",
				size: 40,
				startFrame: i * 10,
				endFrame: -1,
				settings: { fontSize: 100, color, animation: "words" },
			});
		});
	}

	// ── Stacked hierarchy lines (for stacked-hierarchy scene type) ──
	if (scene.type === "stacked-hierarchy" && scene.stackedLines && scene.stackedLines.length > 0) {
		scene.stackedLines.forEach((line, i) => {
			layers.push({
				id: `stacked-line-${i}`,
				type: "text",
				content: line.text,
				position: "center",
				size: 60,
				startFrame: i * 4,
				endFrame: -1,
				settings: { fontSize: line.size || 120, color, animation: "drop" },
			});
		});
	}

	// ── Contrast pairs (for contrast-pairs scene type) ──
	if (scene.type === "contrast-pairs" && scene.contrastPairs && scene.contrastPairs.length > 0) {
		scene.contrastPairs.forEach((pair, i) => {
			layers.push({
				id: `contrast-stmt-${i}`,
				type: "text",
				content: pair.statement,
				position: "center",
				size: 60,
				startFrame: i * 40,
				endFrame: -1,
				settings: { fontSize: scene.fontSize || 100, color, animation: "words", fontFamily: "Georgia, 'Times New Roman', serif" },
			});
			layers.push({
				id: `contrast-ctr-${i}`,
				type: "text",
				content: pair.counter,
				position: "center",
				size: 60,
				startFrame: i * 40 + 15,
				endFrame: -1,
				settings: {
					fontSize: Math.round((scene.fontSize || 100) * 0.7),
					color: isLightBg(scene.background) ? "rgba(5,5,5,0.5)" : "rgba(255,255,255,0.5)",
					animation: "words",
				},
			});
		});
	}

	// ── Data-flow network nodes (for data-flow-network scene type) ──
	if (scene.type === "data-flow-network" && scene.networkNodes && scene.networkNodes.length > 0) {
		scene.networkNodes.forEach((node, i) => {
			layers.push({
				id: `network-node-${i}`,
				type: "text",
				content: node,
				position: "center",
				size: 20,
				startFrame: i * 4,
				endFrame: -1,
				settings: { fontSize: 24, color: accent, animation: "words" },
			});
		});
	}

	// ── Metrics (for metrics-dashboard scene type) ──
	// Each metric is split into TWO layers: one for the numeric value (with
	// prefix/suffix baked into the displayed content) and one for the label
	// underneath. This exposes both editable sides of a MetricCounter.
	if (scene.type === "metrics-dashboard" && scene.metrics && scene.metrics.length > 0) {
		scene.metrics.forEach((metric, i) => {
			const prefix = metric.prefix || "";
			const suffix = metric.suffix || "";
			layers.push({
				id: `metric-value-${i}`,
				type: "text",
				content: `${prefix}${metric.value}${suffix}`,
				position: "center",
				size: 30,
				startFrame: i * 4,
				endFrame: -1,
				settings: { fontSize: 160, color: accent, animation: "words" },
			});
			layers.push({
				id: `metric-label-${i}`,
				type: "text",
				content: metric.label,
				position: "center",
				size: 25,
				startFrame: i * 4 + 2,
				endFrame: -1,
				settings: { fontSize: 32, color, animation: "words" },
			});
		});
	}

	// ── Icon items (for icon-showcase scene type) ──
	// Content format: "emoji label" (e.g. "⚡ Fast") — same pattern as app-icon-cloud
	if (scene.type === "icon-showcase" && scene.iconItems && scene.iconItems.length > 0) {
		scene.iconItems.forEach((item, i) => {
			layers.push({
				id: `icon-item-${i}`,
				type: "icon-grid",
				content: `${item.icon} ${item.label}`,
				position: "center",
				size: 20,
				startFrame: i * 3,
				endFrame: -1,
				settings: { fontSize: 28, color, animation: "words" },
			});
		});
	}

	// ── Slot-machine prefix + words (for word-slot-machine scene type) ──
	if (scene.type === "word-slot-machine" && scene.slotMachinePrefix !== undefined) {
		layers.push({
			id: "slot-prefix",
			type: "text",
			content: scene.slotMachinePrefix || "Your",
			position: "center",
			size: 30,
			startFrame: 0,
			endFrame: -1,
			settings: { fontSize: 80, color, animation: "words" },
		});
	}
	if (
		scene.type === "word-slot-machine" &&
		scene.slotMachineWords &&
		scene.slotMachineWords.length > 0
	) {
		scene.slotMachineWords.forEach((word, i) => {
			layers.push({
				id: `slot-word-${i}`,
				type: "text",
				content: word,
				position: "center",
				size: 30,
				startFrame: i * 6,
				endFrame: -1,
				settings: {
					fontSize: 80,
					color: i === (scene.slotMachineSelectedIndex ?? 0) ? accent : color,
					animation: "words",
				},
			});
		});
	}

	// ── Scrolling list lines (for scrolling-list scene type) ──
	if (
		scene.type === "scrolling-list" &&
		scene.scrollingListLines &&
		scene.scrollingListLines.length > 0
	) {
		scene.scrollingListLines.forEach((line, i) => {
			layers.push({
				id: `scroll-line-${i}`,
				type: "text",
				content: line.text,
				position: "center",
				size: 30,
				startFrame: i * 8,
				endFrame: -1,
				settings: { fontSize: 100, color: line.color || color, animation: "words" },
			});
		});
	}

	// ── Typewriter text (for typewriter-prompt scene type) ──
	if (scene.type === "typewriter-prompt" && scene.typewriterText) {
		layers.push({
			id: "typewriter-text",
			type: "text",
			content: scene.typewriterText,
			position: "center",
			size: 60,
			startFrame: 0,
			endFrame: -1,
			settings: { fontSize: 24, color, animation: "typewriter" },
		});
	}

	// ── Chat channel + messages (for chat-narrative scene type) ──
	if (scene.type === "chat-narrative" && scene.chatChannel) {
		layers.push({
			id: "chat-channel",
			type: "text",
			content: scene.chatChannel,
			position: "top",
			size: 30,
			startFrame: 0,
			endFrame: -1,
			settings: { fontSize: 20, color, animation: "none" },
		});
	}
	if (scene.type === "chat-narrative" && scene.chatMessages && scene.chatMessages.length > 0) {
		scene.chatMessages.forEach((msg, i) => {
			layers.push({
				id: `chat-msg-${i}`,
				type: "text",
				content: msg.text,
				position: "center",
				size: 30,
				startFrame: i * 6,
				endFrame: -1,
				settings: { fontSize: 28, color, animation: "words" },
			});
		});
	}

	// ── Notifications (for notification-chaos scene type) ──
	if (
		scene.type === "notification-chaos" &&
		scene.notifications &&
		scene.notifications.length > 0
	) {
		scene.notifications.forEach((notif, i) => {
			layers.push({
				id: `notif-${i}`,
				type: "text",
				content: notif.title,
				position: "center",
				size: 20,
				startFrame: i * 3,
				endFrame: -1,
				settings: { fontSize: 24, color, animation: "words" },
			});
		});
	}

	// ── Browser tabs (for browser-tabs-chaos scene type) ──
	if (scene.type === "browser-tabs-chaos" && scene.browserTabs && scene.browserTabs.length > 0) {
		scene.browserTabs.forEach((tab, i) => {
			layers.push({
				id: `browser-tab-${i}`,
				type: "text",
				content: tab,
				position: "center",
				size: 20,
				startFrame: i * 2,
				endFrame: -1,
				settings: { fontSize: 16, color, animation: "words" },
			});
		});
	}

	// ── App icons (for app-icon-cloud scene type) ──
	if (scene.type === "app-icon-cloud" && scene.appIcons && scene.appIcons.length > 0) {
		scene.appIcons.forEach((icon, i) => {
			layers.push({
				id: `app-icon-${i}`,
				type: "icon-grid",
				content: `${icon.icon} ${icon.label || ""}`.trim(),
				position: "center",
				size: 20,
				startFrame: i * 4,
				endFrame: -1,
				settings: { fontSize: 28, color: icon.color || accent, animation: "words" },
			});
		});
	}

	// ── Before/After lines (for before-after scene type) ──
	if (scene.type === "before-after" && scene.beforeLines && scene.beforeLines.length > 0) {
		scene.beforeLines.forEach((line, i) => {
			layers.push({
				id: `before-${i}`,
				type: "text",
				content: line,
				position: "left",
				size: 30,
				startFrame: i * 4,
				endFrame: -1,
				settings: { fontSize: 58, color: "rgba(255,255,255,0.85)", animation: "words" },
			});
		});
	}
	if (scene.type === "before-after" && scene.afterLines && scene.afterLines.length > 0) {
		scene.afterLines.forEach((line, i) => {
			layers.push({
				id: `after-${i}`,
				type: "text",
				content: line,
				position: "right",
				size: 30,
				startFrame: i * 4,
				endFrame: -1,
				settings: { fontSize: 58, color: "#0f172a", animation: "words" },
			});
		});
	}

	// ── Screenshot layer ──
	if (scene.type === "screenshot" || scene.type === "product-glow" || scene.type === "device-showcase") {
		const ssIdx = scene.screenshotIndex ?? 0;
		layers.push({
			id: `screenshot-${ssIdx}`,
			type: "image",
			content: `screenshots[${ssIdx}]`,
			position: "center",
			size: 70,
			startFrame: 5,
			endFrame: -1,
		});
	}

	// ── CTA layers: logo, button, URL ──
	if (scene.type === "cta") {
		// Logo layer (uses image type)
		const logoSrc = (scene as any)._logoUrl || "";
		if (logoSrc) {
			layers.push({
				id: "cta-logo",
				type: "image",
				content: logoSrc,
				position: "center",
				size: 20,
				startFrame: 0,
				endFrame: -1,
				settings: { fontSize: 60 }, // used as height
			});
		}
		// Button layer
		layers.push({
			id: "cta-pill",
			type: "button",
			content: "Get Started",
			position: "center",
			size: 30,
			startFrame: 15,
			endFrame: -1,
			settings: {
				fontSize: 26,
			},
		});
		// URL layer
		const urlText = (scene as any)._websiteUrl || "";
		if (urlText) {
			layers.push({
				id: "cta-url",
				type: "text",
				content: urlText,
				position: "center",
				size: 30,
				startFrame: 10,
				endFrame: -1,
				settings: {
					fontSize: 24,
					color: isLightBg(scene.background) ? "rgba(26,26,26,0.4)" : "rgba(255,255,255,0.4)",
					animation: "none",
				},
			});
		}
	}

	// ── Effect layers ──
	// Only the legacy renderers read scene.effects. Rich scene renderers build
	// their own visual structure and ignore this field, so emitting fx layers
	// for them just creates ghost rows in the panel.
	if (isLegacy && scene.effects?.includes("vignette")) {
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
	if (isLegacy && scene.effects?.includes("light-streak")) {
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

	// NOTE: We intentionally do NOT append scene.layers here. This function
	// generates layers purely from scene DATA fields. The caller is responsible
	// for merging any user-added layers (ids starting with "layer-" or "l-").
	// The old code (`layers.push(...scene.layers)`) caused endless duplication
	// bugs because every call would re-append existing layers onto fresh ones.

	return layers;
}

// ── Compile a single layer ──────────────────────────────────────────────

function compileCenterLayer(layer: SceneLayer, accent: string): string {
	const s = layer.settings || {};
	const delay = layer.startFrame || 0;
	const wrapSpacing = (content: string) =>
		s.spacingAfter ? `<div style={{ marginBottom: ${s.spacingAfter} }}>${content}</div>` : content;

	if (layer.type === "text") {
		const fontSize = Math.max(32, s.fontSize || 60);
		const fontFamily = s.fontFamily || "'Inter', 'Helvetica Neue', sans-serif";
		const color = s.color || "#ffffff";
		const animation = s.animation || "words";
		if (animation === "gradient")
			return wrapSpacing(`<GradientText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} delay={${delay}} />`);
		if (animation === "glitch")
			return wrapSpacing(`<GlitchText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} color="${color}" delay={${delay}} />`);
		if (animation === "none")
			return wrapSpacing(`<div style={{ fontSize: ${fontSize}, fontFamily: "${fontFamily}", color: "${color}", textAlign: "center", maxWidth: 1400 }}>{${JSON.stringify(layer.content)}}</div>`);
		return wrapSpacing(`<AnimatedText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} color="${color}" fontFamily="${fontFamily}" animation="${animation}" delay={${delay}} ${s.accentWord ? `accentWord="${s.accentWord}" accentColor="${s.accentColor || accent}"` : ""} />`);
	}
	if (layer.type === "button") {
		const btnFontSize = Math.max(16, s.fontSize || 26);
		const bgColor = s.accentColor || accent;
		const autoBtn = isDarkHex(bgColor) ? "#ffffff" : "#1a1a1a";
		const btnTextColor = s.color && s.color !== "#ffffff" && s.color !== "#fff" && s.color !== "#1a1a1a" ? s.color : autoBtn;
		const btnAnim = s.animation || "none";
		const btnBorder = s.borderColor ? ` borderColor="${s.borderColor}"` : "";
		return wrapSpacing(`<ButtonPill text={${JSON.stringify(layer.content || "Get Started")}} fontSize={${btnFontSize}} bgColor="${bgColor}" textColor="${btnTextColor}" animation="${btnAnim}" delay={${delay}}${btnBorder} />`);
	}
	if (layer.type === "card") {
		try {
			const card = JSON.parse(layer.content);
			return `<Card width={380} delay={${delay}}><div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>${card.title}</div><div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}>${card.description}</div></Card>`;
		} catch {
			return `<Card width={380}><div style={{ color: '#fff' }}>${layer.content}</div></Card>`;
		}
	}
	if (layer.type === "image") {
		return `<div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: 1200 }}><Img src={${layer.content.startsWith("screenshots") ? layer.content : JSON.stringify(layer.content)}} style={{ width: '100%', height: 'auto' }} /></div>`;
	}
	if (layer.type === "word-carousel") {
		try {
			const cfg = JSON.parse(layer.content);
			return `<WordCarousel words={${JSON.stringify(cfg.words || [])}} prefix=${JSON.stringify(cfg.prefix || "")} suffix=${JSON.stringify(cfg.suffix || "")} fontSize={${s.fontSize || 100}} color="${s.color || "#ffffff"}" accentColor="${s.accentColor || accent}" />`;
		} catch {
			return `<div>${layer.content}</div>`;
		}
	}
	if (layer.type === "progress-bar") {
		try {
			const cfg = JSON.parse(layer.content);
			return `<ProgressBar label=${JSON.stringify(cfg.label || "")} value={${cfg.value || 50}} color="${s.color || accent}" delay={${delay}} width={${layer.size ? layer.size * 10 : 600}} />`;
		} catch {
			return `<div>${layer.content}</div>`;
		}
	}
	if (layer.type === "metric-counter") {
		try {
			const cfg = JSON.parse(layer.content);
			return `<MetricCounter value={${cfg.value || 0}} label=${JSON.stringify(cfg.label || "")} prefix=${JSON.stringify(cfg.prefix || "")} suffix=${JSON.stringify(cfg.suffix || "")} fontSize={${s.fontSize || 96}} color="${s.color || "#ffffff"}" delay={${delay}} />`;
		} catch {
			return `<div>${layer.content}</div>`;
		}
	}
	if (layer.type === "icon-grid") {
		try {
			const items = JSON.parse(layer.content);
			return `<IconGrid items={${JSON.stringify(items)}} columns={${Math.min(items.length, 3)}} delay={${delay}} color="${s.color || "#ffffff"}" />`;
		} catch {
			return `<div>${layer.content}</div>`;
		}
	}
	if (layer.type === "divider") {
		return `<Divider color="${s.color || "rgba(255,255,255,0.2)"}" width={${layer.size ? layer.size * 10 : 200}} delay={${delay}} />`;
	}
	return `<div>${layer.content}</div>`;
}

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
				const pillBg = color === "#ffffff" ? "rgba(255,255,255,0.1)" : "rgba(26,26,26,0.1)";
				content = `<Pill text={${JSON.stringify(layer.content)}} delay={0} color="${color}" bg="${pillBg}" />`;
			} else if (animation === "none") {
				content = `<div style={{ fontSize: ${fontSize}, fontFamily: "${fontFamily}", color: "${color}", textAlign: "center", maxWidth: 1000 }}>{${JSON.stringify(layer.content)}}</div>`;
			} else {
				content = `<AnimatedText text={${JSON.stringify(layer.content)}} fontSize={${fontSize}} color="${color}" fontFamily="${fontFamily}" animation="${animation}" ${s.accentWord ? `accentWord="${s.accentWord}" accentColor="${s.accentColor || accent}"` : ""} />`;
			}
			break;
		}

		case "button": {
			const btnFs = Math.max(16, s.fontSize || 26);
			const btnBg = s.accentColor || accent;
			const autoBtnClr = isDarkHex(btnBg) ? "#ffffff" : "#1a1a1a";
			const btnClr = s.color && s.color !== "#ffffff" && s.color !== "#fff" && s.color !== "#1a1a1a" ? s.color : autoBtnClr;
			const btnAnim = s.animation || "none";
			const btnBdr = s.borderColor ? ` borderColor="${s.borderColor}"` : "";
			content = `<ButtonPill text={${JSON.stringify(layer.content || "Get Started")}} fontSize={${btnFs}} bgColor="${btnBg}" textColor="${btnClr}" animation="${btnAnim}"${btnBdr} />`;
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

		case "word-carousel": {
			try {
				const cfg = JSON.parse(layer.content);
				content = `<WordCarousel words={${JSON.stringify(cfg.words || [])}} prefix=${JSON.stringify(cfg.prefix || "")} suffix=${JSON.stringify(cfg.suffix || "")} fontSize={${s.fontSize || 100}} color="${s.color || "#ffffff"}" accentColor="${s.accentColor || accent}" />`;
			} catch {
				content = `<div>${layer.content}</div>`;
			}
			break;
		}

		case "progress-bar": {
			try {
				const cfg = JSON.parse(layer.content);
				content = `<ProgressBar label=${JSON.stringify(cfg.label || "")} value={${cfg.value || 50}} color="${s.color || accent}" delay={0} width={${layer.size ? layer.size * 10 : 600}} />`;
			} catch {
				content = `<div>${layer.content}</div>`;
			}
			break;
		}

		case "metric-counter": {
			try {
				const cfg = JSON.parse(layer.content);
				content = `<MetricCounter value={${cfg.value || 0}} label=${JSON.stringify(cfg.label || "")} prefix=${JSON.stringify(cfg.prefix || "")} suffix=${JSON.stringify(cfg.suffix || "")} fontSize={${s.fontSize || 96}} color="${s.color || "#ffffff"}" delay={0} />`;
			} catch {
				content = `<div>${layer.content}</div>`;
			}
			break;
		}

		case "icon-grid": {
			try {
				const items = JSON.parse(layer.content);
				content = `<IconGrid items={${JSON.stringify(items)}} columns={${Math.min(items.length, 3)}} delay={0} color="${s.color || "#ffffff"}" />`;
			} catch {
				content = `<div>${layer.content}</div>`;
			}
			break;
		}

		case "divider":
			content = `<Divider color="${s.color || "rgba(255,255,255,0.2)"}" width={${layer.size ? layer.size * 10 : 200}} delay={0} />`;
			break;

		default:
			content = `<div>${layer.content}</div>`;
	}

	// Cards render inline (stacked), not absolutely positioned
	if (layer.type === "card") {
		return `<Sequence from={${layer.startFrame}} durationInFrames={${dur}}>${content}</Sequence>`;
	}

	// Effects (vignette, light-streak) are already returned above

	// Center layers flow in Scene's flex column (natural vertical stacking)
	if (layer.position === "center") {
		return `<Sequence from={${layer.startFrame}} durationInFrames={${dur}}>
          ${content}
        </Sequence>`;
	}

	// Non-center layers get absolute positioning
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

// ── Accent-derived color palette ──────────────────────────────────────
// Instead of hardcoding purples/pinks everywhere, derive complementary
// colors from the brand accent so every video's palette is unique.

function parseHex(hex: string): [number, number, number] {
	let h = hex.replace("#", "");
	if (h.length === 3)
		h = h
			.split("")
			.map((c) => c + c)
			.join("");
	return [
		Number.parseInt(h.slice(0, 2), 16),
		Number.parseInt(h.slice(2, 4), 16),
		Number.parseInt(h.slice(4, 6), 16),
	];
}
function toHex(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((c) =>
			Math.max(0, Math.min(255, Math.round(c)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0,
		g = 0,
		b = 0;
	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	else if (max === g) h = ((b - r) / d + 2) * 60;
	else h = ((r - g) / d + 4) * 60;
	return [h, s, l];
}

/** Generate a palette of colors derived from the accent.
 * Returns [accent, complement, analogous1, analogous2, triadic]. */
function accentPalette(accent: string): {
	/** The accent itself */
	a: string;
	/** Complementary — opposite on color wheel */
	c: string;
	/** Analogous warm — 30° clockwise */
	w: string;
	/** Analogous cool — 30° counter-clockwise */
	k: string;
	/** Triadic — 120° away */
	t: string;
	/** Lighter tint of accent */
	l: string;
} {
	const [r, g, b] = parseHex(accent);
	const [h, s, li] = rgbToHsl(r, g, b);
	const mk = (hue: number, sat?: number, light?: number) =>
		toHex(...hslToRgb(((hue % 360) + 360) % 360, sat ?? s, light ?? li));
	return {
		a: accent,
		c: mk(h + 180),
		w: mk(h + 35, s * 0.9),
		k: mk(h - 35, s * 0.9),
		t: mk(h + 120),
		l: mk(h, s * 0.7, Math.min(0.75, li + 0.2)),
	};
}

export function isLightBg(bg: string): boolean {
	return [
		"white",
		"cream",
		"warm-gray",
		"cool-gray",
		"soft-blue",
		"soft-green",
		"soft-rose",
		"#fafafa",
		"#f5f0e8",
		"#e8e4e0",
		"#e2e6ea",
		"#e8f0f8",
		"#e8f5e8",
		"#f8e8ee",
		"#ffffff",
		"#f5f5f5",
	].includes(bg);
}

/** Returns true if a hex color (or the first hex in a gradient string) is dark.
 * Based on relative luminance threshold 0.5. */
function isDarkHex(color: string): boolean {
	const m = color.match(/#([0-9a-fA-F]{3,8})/);
	if (!m) return false;
	let hex = m[1];
	if (hex.length === 3)
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	if (hex.length < 6) return false;
	const r = Number.parseInt(hex.slice(0, 2), 16);
	const g = Number.parseInt(hex.slice(2, 4), 16);
	const b = Number.parseInt(hex.slice(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance < 0.5;
}

/** Resolve text color: prefer the headline layer's explicit color, fall back to auto-contrast. */
function resolveTextColor(scene: ScenePlanItem): string {
	const headlineLayer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	if (headlineLayer?.settings?.color) return headlineLayer.settings.color;
	return isLightBg(scene.background) ? "#1a1a1a" : "#ffffff";
}

// ── Layer-first resolve helpers ────────────────────────────────────────
// These read content from layers first, falling back to data fields.
// This is the unification bridge: renderers call these instead of
// reading scene.headline / scene.fontSize directly.

/** Resolve headline text from layers, fall back to scene.headline */
function resolveHeadline(scene: ScenePlanItem, fallback = ""): string {
	const layer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	return layer?.content || scene.headline || fallback;
}

/** Resolve subtitle text from layers, fall back to scene.subtitle */
function resolveSubtitle(scene: ScenePlanItem): string | undefined {
	const layer = scene.layers?.find((l) => l.id.startsWith("subtitle-"));
	return layer?.content || scene.subtitle;
}

/** Resolve fontSize from headline layer settings, fall back to scene.fontSize */
function resolveHeadlineFontSize(scene: ScenePlanItem, defaultSize: number): number {
	const layer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	return layer?.settings?.fontSize || scene.fontSize || defaultSize;
}

/** Resolve animation from headline layer settings, fall back to scene.animation */
function resolveHeadlineAnimation(scene: ScenePlanItem, defaultAnim: string): string {
	const layer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	return layer?.settings?.animation || scene.animation || defaultAnim;
}

/** Resolve accent word from headline layer settings, fall back to scene.accentWord */
function resolveAccentWord(scene: ScenePlanItem): string | undefined {
	const layer = scene.layers?.find((l) => l.id.startsWith("headline-"));
	return layer?.settings?.accentWord || scene.accentWord;
}

/** Resolve a string array from layers (ghost-word-N, before-N, etc.), fall back to data field */
function resolveStringArray(
	scene: ScenePlanItem,
	prefix: string,
	field: keyof ScenePlanItem,
	fallback: string[],
): string[] {
	if (scene.layers?.length) {
		const matched = scene.layers
			.filter((l) => l.id.startsWith(prefix) && !l._incompatible)
			.sort((a, b) => Number.parseInt(a.id.slice(prefix.length)) - Number.parseInt(b.id.slice(prefix.length)));
		if (matched.length > 0) return matched.map((l) => l.content || "");
	}
	return ((scene as any)[field] as string[] | undefined) || fallback;
}

/** Resolve a structured array from layers with a transform function */
function resolveStructuredArray<T>(
	scene: ScenePlanItem,
	prefix: string,
	field: keyof ScenePlanItem,
	fromLayer: (layer: SceneLayer, index: number) => T,
	fallback: T[],
): T[] {
	if (scene.layers?.length) {
		const matched = scene.layers
			.filter((l) => l.id.startsWith(prefix) && !l._incompatible)
			.sort((a, b) => Number.parseInt(a.id.slice(prefix.length)) - Number.parseInt(b.id.slice(prefix.length)));
		if (matched.length > 0) return matched.map((l, i) => fromLayer(l, i));
	}
	return ((scene as any)[field] as T[] | undefined) || fallback;
}

/** Resolve paired arrays (metric-value-N + metric-label-N, contrast-stmt-N + contrast-ctr-N) */
function resolvePairedArray<T>(
	scene: ScenePlanItem,
	prefixA: string,
	prefixB: string,
	field: keyof ScenePlanItem,
	fromPair: (a: SceneLayer | undefined, b: SceneLayer | undefined, i: number) => T,
	fallback: T[],
): T[] {
	if (scene.layers?.length) {
		let maxIdx = -1;
		for (const l of scene.layers) {
			if (l._incompatible) continue;
			for (const pfx of [prefixA, prefixB]) {
				if (l.id.startsWith(pfx)) {
					const idx = Number.parseInt(l.id.slice(pfx.length));
					if (!Number.isNaN(idx) && idx > maxIdx) maxIdx = idx;
				}
			}
		}
		if (maxIdx >= 0) {
			const result: T[] = [];
			for (let i = 0; i <= maxIdx; i++) {
				const a = scene.layers.find((l) => l.id === `${prefixA}${i}`);
				const b = scene.layers.find((l) => l.id === `${prefixB}${i}`);
				if (a || b) result.push(fromPair(a, b, i));
			}
			if (result.length > 0) return result;
		}
	}
	return ((scene as any)[field] as T[] | undefined) || fallback;
}

/** Resolve a scalar value from an exact layer ID */
function resolveScalarLayer<T>(
	scene: ScenePlanItem,
	layerId: string,
	field: keyof ScenePlanItem,
	fromLayer: (layer: SceneLayer) => T,
	fallback: T,
): T {
	const layer = scene.layers?.find((l) => l.id === layerId && !l._incompatible);
	if (layer) return fromLayer(layer);
	const val = (scene as any)[field];
	return val !== undefined && val !== null ? val as T : fallback;
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
	const w = `${size}%`;
	const offset = `${(100 - size) / 2}%`;
	// No explicit height — content determines height. Only set width + position.
	switch (position) {
		case "center":
			return `left: '${offset}', top: '50%', transform: 'translateY(-50%)', width: '${w}'`;
		case "top-left":
			return `left: '5%', top: '5%', width: '${w}'`;
		case "top-right":
			return `right: '5%', top: '5%', width: '${w}'`;
		case "bottom-left":
			return `left: '5%', bottom: '5%', width: '${w}'`;
		case "bottom-right":
			return `right: '5%', bottom: '5%', width: '${w}'`;
		case "top":
			return `left: '${offset}', top: '5%', width: '${w}'`;
		case "bottom":
			return `left: '${offset}', bottom: '5%', width: '${w}'`;
		case "left":
			return `left: '5%', top: '50%', transform: 'translateY(-50%)', width: '${w}'`;
		case "right":
			return `right: '5%', top: '50%', transform: 'translateY(-50%)', width: '${w}'`;
		default:
			return `left: '${offset}', top: '50%', transform: 'translateY(-50%)', width: '${w}'`;
	}
}
