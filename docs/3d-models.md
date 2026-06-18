# 3D Models & Rendering

← [Back to README](../README.md)

---

## Overview

The project has three rendering modes for the watch:

| Component | Used in | Detail level | Animation |
|-----------|---------|-------------|-----------|
| `WatchModel.tsx` | Configure page | Full — all geometry, bones, spring physics | Camera rig, hand clock, strap bones |
| `WatchMiniCanvas.tsx` → `WatchCardModel` | Collections cards | High — lug/crystal/hands geometry | Pendulum, breathing tilt, spring-physics hands |
| `WatchSVG.tsx` | Fallback when WebGL unavailable | 2D SVG | None |

---

## WebGL Detection & Context Budget

Browsers cap WebGL contexts at ~16–32. The project enforces a stricter internal limit of **8 simultaneous contexts** to stay well within the limit even on low-end hardware.

```ts
// WatchMiniCanvas.tsx
let _activeContexts = 0;
const MAX_CONTEXTS = 8;

function checkWebGL(): boolean {
  // tries webgl2, falls back to webgl
  const canvas = document.createElement('canvas');
  return !!(
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl')
  );
}
const WEB_GL_OK = checkWebGL(); // evaluated once at module load
```

`WEB_GL_OK` is checked before mounting any Canvas. If false, `WatchSVG` is rendered instead.

### IntersectionObserver slot management

Each `WatchMiniCanvas` instance watches its container with `IntersectionObserver`. When a card scrolls into the viewport it **acquires** a context slot (if `_activeContexts < MAX_CONTEXTS`) and mounts a R3F `<Canvas>`. When it scrolls out it **releases** the slot and unmounts. This means the 8 context slots are shared dynamically across all visible cards.

```
Card enters viewport → _activeContexts++ → setMounted(true) → Canvas mounted
Card leaves viewport → _activeContexts-- → setMounted(false) → Canvas unmounted
```

The `forceMount` prop bypasses IntersectionObserver for cards inside overflow containers where IO detection is unreliable.

---

## Crossfade: Placeholder → 3D

When a Canvas mounts there is a brief moment (~80ms) before the first WebGL frame renders. To prevent a flash-of-blank, the system uses a three-layer approach:

1. **`WatchColorCard`** (HTML/CSS) — always rendered as background, shows the watch face color and strap color swatch
2. **`canvasReady` state** — set via `setTimeout(fn, 80)` after `mounted` becomes true, giving the GPU time to render the first frame
3. **CSS `opacity` transition** — both layers have `transition: opacity 500ms ease-in-out`; the color card fades to 0 as the Canvas fades to 1

```tsx
// Color card fades out
<div style={{ opacity: canvasReady ? 0 : 1, transition: 'opacity 500ms ease-in-out' }}>
  <WatchColorCard ... />
</div>

// Canvas fades in
<div style={{ opacity: canvasReady ? 1 : 0, transition: 'opacity 500ms ease-in-out' }}>
  <Canvas>...</Canvas>
</div>
```

---

## `WatchCardModel` — Card-level 3D

`WatchCardModel` is a self-contained R3F scene component exported from `WatchMiniCanvas.tsx`. It uses **only plain `THREE.Group`** — no `@react-spring/three` `animated.*` — so it is safe to mount in any Canvas.

> **Important**: `WatchModel` (in the configurator) uses `@react-spring/three`'s `animated.group`. This causes crashes if mounted in any Canvas other than the main Configure canvas. Always use `WatchCardModel` for cards and previews.

### Geometry

All geometry is built with `useMemo` on first render. Rebuilds only when props change.

```
WatchCardModel group
├── Case (box)                 RoundedBoxGeometry, watchfaceColor
├── Chamfer strip top          BoxGeometry, darker case color
├── Chamfer strip bottom       BoxGeometry
├── 4× Lug pairs               custom ExtrudeGeometry (curved lug shape)
│   └── Lug tip spheres        SphereGeometry
├── 4× Spring bars             CylinderGeometry
├── Bezel ring                 TorusGeometry
├── Crystal (glass)            CylinderGeometry, MeshPhysicalMaterial
│   transmission: 0.97         — near-perfect glass transparency
│   ior: 1.52                  — sapphire refractive index
│   thickness: 0.4
│   clearcoat: 1.0
├── Watch face disc            CircleGeometry, buildMiniTexture() canvas texture
├── Hour hand                  group → shaft + tip + counterweight
├── Minute hand                group → shaft + tip + counterweight
├── Second hand (if enabled)   group → thin shaft + counterweight
└── Bracelet                   varies by braceletType and braceletMaterial
    ├── strap     → tapered box geometry segments
    ├── nato      → flat strap + bar bridge
    └── bracelet  → segmented links (metal) or rounded segments (resin/rubber)
```

### Textures

Watch face texture is generated with the HTML5 2D Canvas API (`buildMiniTexture`):

- Base fill with `watchfaceColor`
- Hour markers (12× applied to a `toDataURL`-generated `THREE.Texture`)
- Text rendered in the center or along the circumference (if `watchfaceText` is set)
- "Eyes" drawn on the face for themed collections (`drawEyesOnTexture`) — spider, squid, reptile, gremlin, cyber, and others

The texture is a 256×256 canvas mapped to the face disc.

### Animation

Three concurrent animation loops run in `useFrame`:

**1. Intro materialise scale**

```ts
// Runs until introScaleRef.current reaches 1.0
introScaleRef.current = THREE.MathUtils.lerp(introScaleRef.current, 1.0, delta * 6);
groupRef.current.scale.setScalar(introScaleRef.current);
// Completes in ~0.5 s at 60 fps
```

**2. Pendulum rotation + breathing tilt**

```ts
const t = state.clock.elapsedTime;

// Dual-harmonic Y rotation — two incommensurable frequencies, never repeats
const newRotY = Math.sin(t * 0.38) * 0.52 + Math.sin(t * 0.11) * 0.14;
groupRef.current.rotation.y = newRotY;

// Subtle X tilt oscillation around a -0.32 rad resting angle
groupRef.current.rotation.x = -0.32 + Math.sin(t * 0.22) * 0.055;
```

The two Y frequencies (0.38 and 0.11 rad/s) are irrational multiples of each other so the motion never exactly repeats, giving a natural organic feel.

**3. Spring-physics hand wobble**

The watch hands use a spring-damper system driven by the angular velocity of the watch body:

```
dRotY = newRotY - prevRotY   // body angular velocity this frame
impulse = dRotY * 8          // scaled to hand inertia

for each hand:
  velocity += (target - actual) * k_spring - velocity * k_damping + impulse
  actual   += velocity * delta
  hand.rotation.z = actual
```

`k_spring = 12`, `k_damping = 5`. This makes the hands lag behind the body's swing and oscillate realistically — like a loosely pinned hand on a real mechanical watch.

Hand target angles are seeded from the real wall clock on mount:

```ts
useEffect(() => {
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();

  hourTarget.current  = -(h / 12 + m / 720) * Math.PI * 2;
  minTarget.current   = -(m / 60 + s / 3600) * Math.PI * 2;
  secTarget.current   = -(s / 60) * Math.PI * 2;
}, []);
```

---

## `WatchModel.tsx` — Full Configurator 3D

Used exclusively on the Configure page inside its dedicated R3F `<Canvas>`.

### Key differences from WatchCardModel

| Feature | WatchCardModel | WatchModel |
|---------|---------------|------------|
| Spring library | None (plain THREE.Group) | @react-spring/three animated.group |
| Strap | Simplified geometry | 6-joint bone chain with spring physics |
| Camera | Fixed | CameraRig: lerps position per configuration step |
| Text | 2D canvas texture | Three.js Text3D with typeface.js font + TextErrorBoundary |
| Crystal | MeshPhysicalMaterial | MeshPhysicalMaterial + environment map |
| Texture | buildMiniTexture (256px) | buildFaceTexture (512px) + buildBumpTexture (embossed) |

### CameraRig

A custom `CameraRig` component reads the current configuration step (geometry → material → color → bracelet → hands → text → serial) and lerps the camera position and lookAt target to focus on the relevant part of the watch. Each step has a predefined `[x, y, z]` position and `[lx, ly, lz]` lookAt target.

### Strap Bone Chain

The bracelet/strap drapes below the case using a 6-segment bone chain. Each joint has a `useSpring` from `@react-spring/three` that controls `rotation.x`. The spring configs are tuned to give different stiffness per segment (stiffer near the case, looser at the clasp).

### Text3D

Watchface text uses `typeface.js` JSON font format via Three.js's `FontLoader`. There is a `TextErrorBoundary` component wrapping every `<Text3D>` to catch font-load failures and silently render nothing — preventing a font error from crashing the whole WebGL context.

**Gotcha**: `opentype.js`'s `getPath()` flips the Y axis (uses drawing coordinates, not Three.js coordinates). The correct approach is to read `glyph.path.commands` directly and negate Y values when constructing `THREE.Shape` paths.

---

## `WatchSVG.tsx` — 2D Fallback

Rendered when:
- `WEB_GL_OK` is false (no WebGL support — common in Replit's screenshot sandbox)
- All 8 context slots are taken

It is a pure SVG component built from the same config props. It shows:
- Watch case in the correct geometry (rounded rect, circle, square, cushion, tonneau)
- Strap/bracelet shape
- Hour, minute, second hands at the correct clock angle
- Watchface color and bracelet color

No animation. Used as a static preview only.

---

## `WatchBoxScene.tsx` — Gift Box

Used on the order confirmation / receipt screen. Shows a 3D gift box that opens to reveal the configured watch inside. Uses `@react-spring/three` springs for the lid lift animation and a `WatchModel`-equivalent render of the configured watch inside the box.

**Gotcha**: The `WatchInBox` component inside `WatchBoxScene` must use the same approach as `WatchCardModel` (plain THREE.Group) to avoid the `animated.group` crash. Do not use `WatchModel` directly inside a second Canvas.

---

## Backdrop-filter & WebGL

**Never** wrap a `<Canvas>` element inside a container with `backdrop-filter` CSS. The backdrop-filter creates a separate compositing layer that blocks WebGL rendering in Safari and causes visual corruption in Chrome. Use `background-color` with alpha instead of `backdrop-filter: blur(...)` for any overlay that sits near a 3D canvas.
