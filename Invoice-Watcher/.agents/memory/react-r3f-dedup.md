---
name: React R3F Deduplication
description: How to prevent duplicate React instances with @react-three/fiber and @react-spring/three in pnpm workspaces
---

Two layers of deduplication are required:

1. `pnpm-workspace.yaml` overrides section: `react: "19.1.0"` and `react-dom: "19.1.0"` — forces every package in the monorepo to resolve to the same version.
2. `vite.config.ts` `resolve.dedupe: ["react", "react-dom"]` — ensures Vite's bundler uses a single copy.

**Why:** @react-three/fiber, @react-spring/three, and @react-three/drei all declare React as a peer dependency. Without overrides, pnpm may hoist different copies, causing "Invalid hook call / resolveDispatcher().useRef" at runtime.

**How to apply:** Any time R3F or react-spring is added to a project in this monorepo, verify both layers are in place before testing.
