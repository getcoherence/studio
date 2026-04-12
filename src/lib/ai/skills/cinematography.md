# Skill: Cinematography & Shot Language

## When to Apply
When generating scene plans and populating the shotIntent field. The shot language
gives structure to visual intent beyond just "pick a scene type."

## Rules

### Shot Size
1. **extreme-wide / wide** → Establishing shots, scene-setting, context.
   Use for: gradient-mesh-hero, data-flow-network, avatar-constellation.
2. **medium** → Default for most content. Balanced, readable.
   Use for: before-after, metrics-dashboard, process-ladder.
3. **close / extreme-close** → Emphasis, emotion, detail.
   Use for: impact-word, ghost-hook, countdown, camera-text.

### Camera Movement
4. **static** → Confidence, authority. Good for CTAs and data scenes.
5. **zoom-in** → Drawing attention, revealing detail. Good for product showcases.
6. **zoom-out** → Context reveal, showing scale. Good for data-flow-network.
7. **pan** → Exploration, comparison. Good for before-after, contrast-pairs.
8. **drift** → Subtle motion, keeping alive. Good for text scenes that would
   otherwise feel static.

### Lighting Key
9. **high key** → Bright, optimistic, professional. Light backgrounds.
10. **low key** → Dramatic, cinematic, premium. Dark backgrounds with accents.
11. **dramatic** → High contrast, strong shadows. For impact moments.
12. **rim** → Subject outlined by backlight. For product/device showcases.

### Narrative Role
13. Every scene SHOULD have a narrativeRole. This drives the visual treatment:
    - **hook** → Maximum visual impact, bold typography, particles
    - **problem** → Tension, darker tones, chaotic layouts
    - **solution** → Relief, brighter tones, clean layouts
    - **evidence** → Data-driven, structured, credible
    - **transition** → Brief, connecting, less visual weight
    - **climax** → Peak moment, biggest visual impact
    - **cta** → Clear, actionable, brand-prominent

## Examples

### Good shot intent sequence:
```
Scene 1: { shotSize: "close", cameraMovement: "static", narrativeRole: "hook" }
Scene 2: { shotSize: "medium", lightingKey: "low", narrativeRole: "problem" }
Scene 3: { shotSize: "medium", cameraMovement: "pan", narrativeRole: "solution" }
Scene 4: { shotSize: "wide", lightingKey: "high", narrativeRole: "evidence" }
Scene 5: { shotSize: "close", cameraMovement: "zoom-in", narrativeRole: "cta" }
```

## Common Mistakes
- No shotIntent on any scene (AI has no visual direction)
- All scenes using the same shotSize
- Using "zoom-in" on every scene (exhausting)
- Not matching lightingKey to the narrative beat
