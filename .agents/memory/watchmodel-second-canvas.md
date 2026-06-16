---
name: WatchModel in second Canvas
description: WatchModel cannot be embedded in a second R3F Canvas — use MiniWatch instead
---

**Rule:** Never use `WatchModel` inside `WatchBoxScene` (or any Canvas other than the Configure page Canvas).

**Why:** `WatchModel` uses `animated.group` from `@react-spring/three`. When this component is mounted inside a second R3F `<Canvas>`, R3F's reconciler (`applyProps`) throws "Attempted to assign to readonly property" and "undefined is not an object (evaluating 'delete child.object.__r3f')" in a tight loop — crashing the box scene completely.

**Root cause:** `@react-spring/three`'s `animated` objects extend Three.js classes and bind to the fiber instance at module load time. When placed inside a different Canvas (different fiber root), the binding mismatches.

**How to apply:** For the WatchBoxScene, always use `MiniWatch` from `WatchMiniCanvas.tsx` — it is pure Three.js geometry with no react-spring, safe in any Canvas context. `MiniWatch` accepts `watchfaceGeometry`, `watchfaceColor`, `braceletColor`, `braceletMaterial`, `handsColor`, `handsEnabled`, `watchfaceText`, `watchfaceTextMode`, and `paused` props and correctly reflects the user's config.
