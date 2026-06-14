---
name: backdrop-filter kills WebGL canvas
description: backdrop-filter on a parent element causes WebGL canvas to render black — browser compositing bug
---

## Rule
Never place a Three.js / R3F `<Canvas>` inside any DOM element that has `backdrop-filter` (including via the `liquid-glass` CSS class). The canvas renders completely black.

**Why:** `backdrop-filter` forces the browser to create an isolated compositing layer for the element's subtree. On most browsers (Chrome, Safari) this breaks the WebGL context's ability to composite its output into the page — the canvas frame never makes it to screen.

**How to apply:** When a card/panel wraps a 3D canvas scene:
- Replace `liquid-glass` with an equivalent background-only style: `background: rgba(255,255,255,0.045)` + `border border-white/10 shadow-xl` (no `backdrop-filter`)
- The frosted blur effect is lost but the canvas becomes visible — always the right tradeoff
- Safe to keep `liquid-glass` on sibling elements (e.g. the label row beneath the canvas) as long as they don't contain the canvas
- Affected pages as of fix: `Payment.tsx` (was `liquid-glass rounded-3xl overflow-hidden`, now inline style)
- The `canvas-overlay-btn` class (buttons floating over canvas) is already safe — it has `backdrop-filter` but is a sibling/descendant overlay, not an ancestor wrapper
