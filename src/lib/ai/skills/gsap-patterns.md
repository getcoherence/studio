# GSAP Patterns for Remotion Scenes

Curated GSAP recipes adapted for Remotion's `frame`-driven render model.
Use these when a scene needs choreographed motion, text reveals, SVG draws,
or physics-based effects. All plugins are pre-registered globally — no
imports needed.

## The Remotion Pattern (CRITICAL)

GSAP timelines normally play themselves. In Remotion they MUST be driven
by the current frame:

```tsx
const ref = useRef(null);
const tlRef = useRef(null);
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

useEffect(() => {
  if (!ref.current) return;
  const tl = gsap.timeline({ paused: true });
  tl.from(ref.current.querySelector('.title'), {
    y: 50, opacity: 0, duration: 0.6, ease: 'power3.out'
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);

useEffect(() => {
  if (tlRef.current) tlRef.current.seek(frame / fps);
}, [frame, fps]);
```

NEVER use `autoplay: true` or `gsap.to()` outside an effect — those run
on the host clock, not the Remotion timeline, and will desync.

---

## TEXT REVEALS

### Pattern 1: Word-by-word entrance (SplitText)
Use for hero headlines, introductions, headlines that need rhythm.

```tsx
const ref = useRef(null);
const tlRef = useRef(null);
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

useEffect(() => {
  const split = new SplitText(ref.current, { type: 'words,chars' });
  const tl = gsap.timeline({ paused: true });
  tl.from(split.words, {
    y: 80, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'back.out(1.7)'
  });
  tlRef.current = tl;
  return () => { split.revert(); tl.kill(); };
}, []);

useEffect(() => { tlRef.current?.seek(frame / fps); }, [frame, fps]);

return <h1 ref={ref} style={{ fontSize: 140, fontWeight: 900 }}>Your headline here</h1>;
```

### Pattern 2: Char-by-char with rotation (SplitText)
Use for impact words, CTAs, single-word reveals.

```tsx
useEffect(() => {
  const split = new SplitText(ref.current, { type: 'chars' });
  const tl = gsap.timeline({ paused: true });
  tl.from(split.chars, {
    y: 120, rotationX: -90, opacity: 0, duration: 0.5,
    stagger: 0.04, ease: 'power4.out', transformOrigin: '50% 50% -50px'
  });
  tlRef.current = tl;
  return () => { split.revert(); tl.kill(); };
}, []);
```

### Pattern 3: Scramble decode (ScrambleTextPlugin)
Use for tech aesthetic, hacker reveals, data appearing on screen.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl.to(ref.current, {
    duration: 1.2,
    scrambleText: {
      text: 'DECODED',
      chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      revealDelay: 0.5,
      speed: 0.4,
    },
    ease: 'none',
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);

return <div ref={ref} style={{ fontFamily: 'monospace', fontSize: 120 }}>XXXXXXX</div>;
```

### Pattern 4: Typewriter (TextPlugin)
Use for scripted/conversational scenes, code reveals.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl.to(ref.current, {
    duration: 2,
    text: { value: 'The future is here.', delimiter: '' },
    ease: 'none',
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);

return <span ref={ref} />; // starts empty, fills with text
```

### Pattern 5: Counter rolling up (TextPlugin)
Use for stats, numbers, percentages.

```tsx
const counterRef = useRef(null);
const tlRef = useRef(null);
useEffect(() => {
  const obj = { val: 0 };
  const tl = gsap.timeline({ paused: true });
  tl.to(obj, {
    val: 1248,
    duration: 1.5,
    ease: 'power2.out',
    onUpdate: () => {
      if (counterRef.current) counterRef.current.textContent = Math.round(obj.val).toLocaleString();
    },
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);

return <span ref={counterRef} style={{ fontVariantNumeric: 'tabular-nums' }}>0</span>;
```

---

## SVG ANIMATIONS

### Pattern 6: Stroke draw-on (DrawSVGPlugin)
Use for diagrams, signature reveals, underlines, highlight strokes.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl.from('#mySvgPath', {
    drawSVG: '0%', duration: 1.2, ease: 'power2.inOut'
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);

return (
  <svg viewBox="0 0 800 200" width="800">
    <path id="mySvgPath" d="M50,100 Q400,20 750,100" stroke="#3ea6ff" strokeWidth="6" fill="none" />
  </svg>
);
```

### Pattern 7: Shape morph (MorphSVGPlugin)
Use for logo morphs, icon transitions, shape-shifting reveals.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  // Hide target initially, morph the source into it
  gsap.set('#targetShape', { display: 'none' });
  tl.to('#sourceShape', {
    morphSVG: '#targetShape',
    duration: 0.8,
    ease: 'power2.inOut',
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);
```

### Pattern 8: Element along curved path (MotionPathPlugin)
Use for arrows tracing routes, particles flying along arcs, planet orbits.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl.to('.movingDot', {
    motionPath: {
      path: '#travelPath',
      align: '#travelPath',
      autoRotate: true,
      alignOrigin: [0.5, 0.5],
    },
    duration: 2,
    ease: 'power1.inOut',
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);
```

---

## CHOREOGRAPHED SEQUENCES

### Pattern 9: Staggered card grid entrance
Use for feature lists, metric dashboards, anything multi-element.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl.from('.card', {
    y: 60, opacity: 0, scale: 0.85,
    duration: 0.6,
    stagger: { each: 0.08, from: 'start' },
    ease: 'back.out(1.7)',
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);
```

### Pattern 10: Hero composition (multi-element timeline)
Use for opening shots — title, subtitle, accent, decoration land in sequence.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl
    .from('.bg-glow', { opacity: 0, scale: 0.5, duration: 0.6, ease: 'power3.out' })
    .from('.title', { y: 80, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.3')
    .from('.subtitle', { y: 30, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.4')
    .from('.cta', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)' }, '-=0.2')
    .from('.decoration', { opacity: 0, duration: 0.4 }, '-=0.3');
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);
```

The `'-=0.3'` syntax means "start 0.3s before the previous tween ends" —
this overlap is what makes GSAP timelines feel connected, not stiff.

### Pattern 11: Physics burst (Physics2DPlugin)
Use for confetti, sparks, debris bursts.

```tsx
useEffect(() => {
  const tl = gsap.timeline({ paused: true });
  tl.to('.particle', {
    physics2D: {
      velocity: 'random(400, 800)',
      angle: 'random(-150, -30)',
      gravity: 1200,
      friction: 0.05,
    },
    rotation: 'random(-180, 180)',
    duration: 2.5,
    ease: 'none',
  });
  tlRef.current = tl;
  return () => { tl.kill(); };
}, []);
```

### Pattern 12: Layout flip (Flip)
Use when DOM elements need to smoothly transition between positions
(e.g., card grid → single hero card).

```tsx
const [layout, setLayout] = useState('grid');

useEffect(() => {
  if (frame > 60 && layout === 'grid') {
    const state = Flip.getState('.card');
    setLayout('hero'); // re-renders with new layout
    requestAnimationFrame(() => {
      Flip.from(state, { duration: 0.7, ease: 'power2.inOut', stagger: 0.05 });
    });
  }
}, [frame]);
```

---

## EASING CHEAT SHEET

GSAP eases organized by feel — pick based on what the motion should feel like:

| Want | Use |
|---|---|
| Snappy in | `power3.in`, `power4.in` |
| Smooth out | `power2.out`, `power3.out` |
| Bouncy land | `back.out(1.7)`, `back.out(2.5)` for stronger overshoot |
| Spring/elastic | `elastic.out(1, 0.3)` |
| Steady speed | `none` (linear — for scrambles, counters) |
| Slow start, fast finish | `power3.in` |
| Fast start, slow finish | `expo.out`, `circ.out` |
| Symmetrical | `power2.inOut`, `sine.inOut` |

For custom: `CustomEase.create('myEase', '0.2,0.8,0.4,1.0')` then `ease: 'myEase'`.

---

## WHEN TO REACH FOR GSAP vs. interpolate/spring

- **interpolate/spring**: simple single-property animation, one element
- **GSAP**: 3+ elements, sequenced reveals, SplitText, draw-on SVG, anything choreographed
- **anime.js**: legacy — only when a scene already uses it; prefer GSAP for new scenes

Rule of thumb: if you're chaining 3+ `interpolate()` calls with overlapping
ranges to coordinate elements, switch to a `gsap.timeline()` — it'll be
shorter, more readable, and easier to tune.
