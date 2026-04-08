// ── Core Scene Types Plugin ─────────────────────────────────────────────
//
// Registers the built-in scene types into the plugin registry.
// This replaces the hardcoded SCENE_TEMPLATE_CATALOG and SCENE_TYPE_OPTIONS.

import type { LucidPlugin } from "../types";

export const coreSceneTypesPlugin: LucidPlugin = {
	id: "core-scene-types",
	name: "Core Scene Types",
	version: "1.0.0",
	register(registry) {
		// ── Text scenes ──
		registry.registerSceneType({ id: "hero-text", name: "Hero Text", description: "Large centered headline with animation", category: "text", icon: "T", layout: "━━ text ━━", tags: ["headline", "basic", "subtitle"], defaultHeadline: "Your headline", readsHeadline: true, readsSubtitle: true, render: () => "" });
		registry.registerSceneType({ id: "impact-word", name: "Impact Word", description: "Single massive word, 240-320px", category: "text", icon: "!", layout: "█ WORD █", tags: ["single", "big", "punch", "dramatic"], defaultHeadline: "Finally.", readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "ghost-hook", name: "Ghost Hook", description: "Sentence fragmentation with ghost future words", category: "text", icon: "👻", layout: "░░ word ░░ word ░░", tags: ["opener", "hook", "sentence", "reveal"], readsHeadline: false, render: () => "" });
		registry.registerSceneType({ id: "camera-text", name: "Camera Text", description: "Cinematic camera zoom through appearing words", category: "text", icon: "🎥", layout: "🎬 zoom → text", tags: ["brand", "reveal", "cinematic", "logo"], readsHeadline: false, render: () => "" });
		registry.registerSceneType({ id: "stacked-hierarchy", name: "Stacked Hierarchy", description: "Text lines with dramatic size hierarchy", category: "text", icon: "📊", layout: "small\nMEDIUM\n████", tags: ["multi-line", "size", "emphasis"], readsHeadline: false, render: () => "" });
		registry.registerSceneType({ id: "outline-hero", name: "Outline Hero", description: "Hollow stroke-only typography", category: "text", icon: "O", layout: "┌─ TEXT ─┐", tags: ["editorial", "stroke", "minimal"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "echo-hero", name: "Echo Hero", description: "Text with motion-blur zoom trail", category: "text", icon: "🔊", layout: "text text TEXT", tags: ["stat", "number", "blur", "impact"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "typewriter-prompt", name: "Typewriter", description: "Animated typing input with glow", category: "text", icon: "⌨️", layout: "[▌ typing... ]", tags: ["ai", "prompt", "input", "search"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "word-slot-machine", name: "Slot Machine", description: "Vertical word list with selection checkmark", category: "text", icon: "🎰", layout: "word\n✓ WORD\nword", tags: ["select", "options", "audience"], readsHeadline: false, variants: ["wheel", "typewriter-swap", "flip-cards", "glitch-swap"], render: () => "" });
		registry.registerSceneType({ id: "radial-vortex", name: "Radial Vortex", description: "Concentric rings of spiraling text", category: "text", icon: "🌀", layout: "◎ text ◎", tags: ["manifesto", "dramatic", "spiral"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "contrast-pairs", name: "Contrast Pairs", description: "Statement/counter pairs with staggered reveals — perfect for 3-4 line slides", category: "text", icon: "⚖️", layout: "Statement\n  counter\nStatement\n  counter", tags: ["compare", "pairs", "multi-line", "problem"], readsHeadline: false, render: () => "" });
		registry.registerSceneType({ id: "scrolling-list", name: "Scrolling List", description: "Lines scrolling up sequentially, all visible at end", category: "text", icon: "📜", layout: "• line\n• line\n• line", tags: ["steps", "process", "features", "list"], readsHeadline: true, render: () => "" });

		// ── Cinematic scenes ──
		registry.registerSceneType({ id: "cinematic-title", name: "Cinematic Title", description: "Gradient text with particle effects", category: "cinematic", icon: "✨", layout: "✦ gradient text ✦", tags: ["dramatic", "particles", "statement"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "device-showcase", name: "Device Showcase", description: "Screenshot in laptop/phone mockup", category: "cinematic", icon: "💻", layout: "┌──────┐\n│ screen │\n└──────┘", tags: ["product", "screenshot", "laptop", "phone"], readsHeadline: true, variants: ["laptop", "phone"], render: () => "" });
		registry.registerSceneType({ id: "product-glow", name: "Product Glow", description: "Tilted screenshot with perspective glow frame", category: "cinematic", icon: "📱", layout: "╱ screen ╲ glow", tags: ["product", "screenshot", "3d", "perspective"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "gradient-mesh-hero", name: "Gradient Mesh", description: "Soft pastel mesh background with centered text", category: "cinematic", icon: "🎨", layout: "▓▒░ text ░▒▓", tags: ["premium", "soft", "pastel", "ethereal"], readsHeadline: true, render: () => "" });

		// ── Data & stats ──
		registry.registerSceneType({ id: "metrics-dashboard", name: "Metrics", description: "Animated metric counters with labels", category: "data", icon: "📈", layout: "10x | 99% | 500+", tags: ["numbers", "stats", "counters", "proof"], readsHeadline: true, variants: ["counter-row", "bar-chart", "pie-radial", "ticker-tape"], render: () => "" });
		registry.registerSceneType({ id: "glass-stats", name: "Glass Stats", description: "Glassmorphism cards with animated counters", category: "data", icon: "🧊", layout: "[▓10x▓] [▓99%▓]", tags: ["numbers", "glass", "premium", "frosted"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "countdown", name: "Countdown", description: "Animated number counting up with confetti burst", category: "data", icon: "🔢", layout: "0 → 1000 🎉", tags: ["number", "milestone", "achievement", "count"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "data-flow-network", name: "Data Flow", description: "Nodes connected by animated lines", category: "data", icon: "🔗", layout: "○─○─○─○─○", tags: ["pipeline", "workflow", "nodes", "connected"], readsHeadline: true, variants: ["circles", "timeline-arrows", "hex-grid", "isometric-blocks", "orbital-rings"], render: () => "" });
		registry.registerSceneType({ id: "dashboard-deconstructed", name: "Dashboard", description: "Floating metric cards with chart line", category: "data", icon: "📊", layout: "[card] [card]\n  ╱chart╲", tags: ["metrics", "floating", "chart", "dashboard"], readsHeadline: true, render: () => "" });

		// ── Social & chaos ──
		registry.registerSceneType({ id: "before-after", name: "Before/After", description: "Split-screen problem vs solution", category: "social", icon: "⚡", layout: "dark | light\n✗ old | ✓ new", tags: ["compare", "transform", "problem", "solution"], readsHeadline: true, variants: ["split-card", "swipe-reveal", "stacked-morph", "toggle-switch"], render: () => "" });
		registry.registerSceneType({ id: "notification-chaos", name: "Notifications", description: "Platform notification cards scattered", category: "social", icon: "🔔", layout: "[notif] [notif]\n  [notif]", tags: ["overwhelm", "chaos", "problem", "noise"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "browser-tabs-chaos", name: "Browser Tabs", description: "Too many tabs — overwhelm then solution", category: "social", icon: "🌐", layout: "[tab|tab|tab|tab]", tags: ["overwhelm", "tabs", "chaos", "problem"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "chat-narrative", name: "Chat Narrative", description: "Progressive chat UI with urgent messages", category: "social", icon: "💬", layout: "→ msg\n  ← msg\n→ msg 🚨", tags: ["chat", "conversation", "slack", "problem"], readsHeadline: false, render: () => "" });
		registry.registerSceneType({ id: "app-icon-cloud", name: "App Icons", description: "Floating 3D app icons in space", category: "social", icon: "📱", layout: "📱 📧 📊\n  💬 📝", tags: ["ecosystem", "tools", "integrations", "scattered"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "icon-showcase", name: "Icon Showcase", description: "Feature icons in a grid layout", category: "social", icon: "⚡", layout: "⚡ 🔒 ✨\n🎯 🚀 💡", tags: ["features", "grid", "icons", "benefits"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "avatar-constellation", name: "Avatar Cloud", description: "Social proof avatars orbiting a claim", category: "social", icon: "👥", layout: "👤 👤\n  claim\n👤 👤", tags: ["social proof", "trust", "users", "testimonial"], readsHeadline: true, render: () => "" });

		// ── CTA & branding ──
		registry.registerSceneType({ id: "cta", name: "Call to Action", description: "Headline + button + optional logo", category: "cta", icon: "🚀", layout: "logo\nHeadline\n[Button]", tags: ["ending", "button", "signup", "close"], defaultHeadline: "Get Started", readsHeadline: true, variants: ["centered", "split-logo", "gradient-bar", "minimal"], render: () => "" });
		registry.registerSceneType({ id: "logo-reveal", name: "Logo Reveal", description: "Brand moment with gradient text + glow", category: "cta", icon: "✨", layout: "✦ Brand ✦", tags: ["brand", "logo", "reveal", "glow"], readsHeadline: true, render: () => "" });

		// ── Legacy ──
		registry.registerSceneType({ id: "full-bleed", name: "Full Bleed", description: "Full-screen content — renders all layers", category: "legacy", icon: "□", layout: "█ full frame █", tags: ["flexible", "custom", "any layers"], readsHeadline: true, readsSubtitle: true, render: () => "" });
		registry.registerSceneType({ id: "split-layout", name: "Split Layout", description: "Two-column layout", category: "legacy", icon: "⬜", layout: "left | right", tags: ["two column", "split"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "cards", name: "Cards", description: "Feature cards", category: "legacy", icon: "🃏", layout: "[card] [card] [card]", tags: ["features", "cards", "grid"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "screenshot", name: "Screenshot", description: "Browser frame with screenshot", category: "legacy", icon: "🖼️", layout: "┌─ browser ─┐", tags: ["screenshot", "browser", "product"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "glitch-intro", name: "Glitch Intro", description: "Glitch effect opener", category: "legacy", icon: "⚡", layout: "▓░▒ glitch ▒░▓", tags: ["opener", "glitch", "effect"], readsHeadline: true, render: () => "" });
		registry.registerSceneType({ id: "stacked-text", name: "Stacked Text", description: "Stacked text lines — renders all layers", category: "legacy", icon: "≡", layout: "line\nline\nline", tags: ["flexible", "custom", "any layers"], readsHeadline: true, render: () => "" });
	},
};
