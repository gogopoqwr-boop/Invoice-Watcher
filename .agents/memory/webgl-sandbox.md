---
name: WebGL in Replit Sandbox
description: WebGL is unavailable in Replit's preview/screenshot environment (no GPU)
---

The Replit preview pane and screenshot tool run in a headless sandbox without a GPU. Three.js Canvas will throw "Error creating WebGL context" and trigger the Vite runtime error overlay.

**Fix:** Call `isWebGLAvailable()` (try getContext('webgl') on a temp canvas) before mounting `<Canvas>`. If false, render an SVG/2D fallback directly — don't even mount the Canvas. A React error boundary alone is not sufficient because the Vite overlay fires independently of React error handling.

**How to apply:** Always gate `<Canvas>` behind a WebGL availability check in any R3F component in this project.
