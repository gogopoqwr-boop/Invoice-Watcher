---
name: Typeface.js Y-axis orientation
description: How to correctly convert a TTF to typeface.js JSON for THREE.js Text3D without Y-axis flip
---

## Rule
When converting a TTF to THREE.js `typeface.js` JSON, use `glyph.path.commands` (font coordinate space, Y increases upward). Do NOT use `glyph.getPath(x, y, size).commands` — that method transforms to canvas/drawing space where Y is flipped downward, producing mirrored/upside-down letters.

**Why:** THREE.js `FontLoader` expects glyph path coordinates in font space (Y up, same convention as the `o` field in helvetiker.typeface.json where cap-height values are large positives). `opentype.js getPath()` returns drawing-space paths where above-baseline coords are negative, causing letters to render garbled/inverted in Text3D.

**How to apply:** In the font conversion script:
```js
// CORRECT — font coordinate space (Y up)
const commands = glyph.path.commands;
// WRONG — drawing space (Y down, letters inverted in THREE.js)
const commands = glyph.getPath(0, 0, font.unitsPerEm).commands;
```

Bounding box from `glyph.getBoundingBox()` is already in font coordinates (y1=bottom, y2=top) — no flip needed there.

Conversion script lives at `/tmp/convert_font2.js` and outputs to `artifacts/watch-configurator/public/fonts/DejaVuSans-Bold.typeface.json`.
