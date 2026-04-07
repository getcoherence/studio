// ── Core Transitions Plugin ─────────────────────────────────────────────
//
// Registers the built-in transitions (fade, slide, wipe, zoom-morph)
// plus the custom transitions (striped-slam, zoom-punch, etc.)

import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { LucidPlugin } from "../types";

export const coreTransitionsPlugin: LucidPlugin = {
	id: "core-transitions",
	name: "Core Transitions",
	version: "1.0.0",
	register(registry) {
		// Standard Remotion transitions
		registry.registerTransition({
			id: "fade",
			name: "Fade",
			description: "Subtle crossfade",
			energy: "low",
			defaultDuration: 8,
			codeExpression: "fade()",
			create: () => fade(),
		});
		registry.registerTransition({
			id: "slide-left",
			name: "Slide Left",
			description: "New scene slides in from the right",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-right" })',
			create: () => slide({ direction: "from-right" }),
		});
		registry.registerTransition({
			id: "slide-right",
			name: "Slide Right",
			description: "New scene slides in from the left",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-left" })',
			create: () => slide({ direction: "from-left" }),
		});
		registry.registerTransition({
			id: "slide-up",
			name: "Slide Up",
			description: "New scene comes from the bottom",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-bottom" })',
			create: () => slide({ direction: "from-bottom" }),
		});
		registry.registerTransition({
			id: "slide-down",
			name: "Slide Down",
			description: "New scene drops from the top",
			energy: "medium",
			defaultDuration: 10,
			codeExpression: 'slide({ direction: "from-top" })',
			create: () => slide({ direction: "from-top" }),
		});
		registry.registerTransition({
			id: "wipe-left",
			name: "Wipe Left",
			description: "Bold wipe from right",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-right" })',
			create: () => wipe({ direction: "from-right" }),
		});
		registry.registerTransition({
			id: "wipe-right",
			name: "Wipe Right",
			description: "Bold wipe from left",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-left" })',
			create: () => wipe({ direction: "from-left" }),
		});
		registry.registerTransition({
			id: "wipe-up",
			name: "Wipe Up",
			description: "Bold wipe from bottom",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-bottom" })',
			create: () => wipe({ direction: "from-bottom" }),
		});
		registry.registerTransition({
			id: "wipe-down",
			name: "Wipe Down",
			description: "Bold wipe from top",
			energy: "high",
			defaultDuration: 12,
			codeExpression: 'wipe({ direction: "from-top" })',
			create: () => wipe({ direction: "from-top" }),
		});
	},
};
