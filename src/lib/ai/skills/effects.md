# Skill: Effects & Particle Selection

## When to Apply
When choosing backgroundEffect, lottieOverlay, and PixiJS effects for scenes.
Effects add visual richness and motion without changing the content.

## Rules

### Background Effects
1. **Match effect to scene mood:**
   - Professional/data: flowing-lines, pulse-grid, wave-grid
   - Cinematic/premium: aurora, bokeh, liquid-glass, spotlight
   - Playful/celebration: confetti, fireflies, sakura
   - Tech/futuristic: perspective-grid, mesh-shift, particle-field
   - Ambient/subtle: drifting-orbs, grain, snow

2. **Effect intensity matters.** Set backgroundEffectIntensity:
   - 0.3-0.5 for text-heavy scenes (effects should not compete with text)
   - 0.5-0.7 for visual scenes (effects enhance the atmosphere)
   - 0.7-1.0 for pure atmosphere scenes (effects ARE the content)

3. **Use backgroundEffectColors to match brand.** Default colors are often blue.
   Always pass the brand accent color and a complement.

### New Particle Types
4. **Mist** → Cinematic, moody, mysterious. Low count (6-10), low intensity.
   Best for: cinematic-title, ghost-hook, camera-text.
5. **LightRays** → Epic, spiritual, revelation. Low count (3-6).
   Best for: hero-text with light background, logo-reveal, countdown climax.
6. **Bubbles** → Playful, tech, underwater. Medium count (20-40).
   Best for: app-icon-cloud, tech product scenes, playful brands.
7. **Embers** → Energy, transformation, fire. Medium count (25-40).
   Best for: countdown, impact-word, before-after transitions.
8. **Stars** → Space, night, premium. High count (60-100).
   Best for: dark cinematic backgrounds, gradient-mesh-hero, pricing scenes.

### Lottie Overlays
9. **Use sparingly.** One Lottie overlay per scene maximum. Two competing
   animations create visual chaos.
10. **Match Lottie to scene purpose:**
    - lower-third-bar → speaker names, labels
    - accent-line → dividing sections, emphasis
    - corner-brackets → cinematic framing
    - glow-pulse → highlighting key metrics or CTAs

### PixiJS Effects (Post-Processing)
11. **film-grain** → Adds texture and cinematic feel. Use intensity 0.1-0.3.
12. **vhs-retro** → Retro/nostalgic aesthetic. Use for "before" states or
    throwback content. Intensity 0.3-0.5.
13. **cinematic-grain** → Professional grade: light grain + floating dust
    particles. The most universally useful preset.
14. **crt-monitor** → Retro tech aesthetic. Great for code scenes or
    terminal-themed content.

## Common Mistakes
- backgroundEffectIntensity too high on text scenes (text becomes unreadable)
- Using the same backgroundEffect on every scene
- Combining Lottie overlay + heavy backgroundEffect + PixiJS filter
  (visual overload)
- Not passing brand colors to backgroundEffectColors
