# Configurator State & Watch Options

← [Back to README](../README.md)

---

## Overview

All watch customization state lives in a single React context: `WatchConfigProvider` (`src/hooks/use-watch-config.tsx`). Every component that reads or writes the watch configuration uses the `useWatchConfig()` hook.

State is automatically persisted to `localStorage["watch_config_draft"]` and rehydrated on page load, so the user's work-in-progress survives a browser refresh.

---

## State Shape (`ExtendedConfigState`)

```ts
interface ExtendedConfigState {
  // Case
  watchfaceGeometry:          "rounded" | "circle" | "square" | "cushion" | "tonneau";
  watchfaceColor:             string;   // hex, e.g. "#1a1a2e"
  watchfaceMaterial:          "steel" | "titanium" | "gold" | "pvd_black" | "bronze";

  // Dial
  watchfaceBackgroundType:    "solid" | "gradient" | "pattern";
  watchfaceText:              string;   // up to ~20 chars
  watchfaceTextMode:          "center" | "circular";
  watchfaceEyeType:           string | null;   // themed eye pattern (e.g. "spider", "squid")

  // Hands
  handsEnabled:               boolean;
  handsCount:                 2 | 3;    // 2 = hour+minute, 3 = +seconds
  handsColor:                 string;   // hex

  // Bracelet / Strap
  braceletType:               "strap" | "bracelet" | "nato";
  braceletMaterial:           "leather" | "rubber" | "metal_solid" | "metal_segmented" | "resin";
  braceletColor:              string;   // hex

  // Custom texture URLs (admin-uploaded)
  customWatchfaceUrl:         string | null;
  skinStripeUrl:              string | null;
  skinFullUrl:                string | null;

  // Packaging
  boxType:                    "none" | "standard" | "premium" | "gift";
  boxColor:                   string;   // hex

  // Identity
  serialNumber:               string;
  collectionName:             string | null;

  // UI state (not persisted to DB)
  activePart:                 WatchPart | null;   // which part is currently highlighted
  currentStep:                number;              // 0–7, drives CameraRig position
}
```

---

## Using the Hook

```ts
import { useWatchConfig } from '@/hooks/use-watch-config';

function MyComponent() {
  const { config, updateConfig, activePart, setActivePart } = useWatchConfig();

  // Read
  console.log(config.watchfaceGeometry); // "rounded"

  // Write (partial updates — merges into existing state)
  updateConfig({ watchfaceColor: '#ff0000' });

  // Highlight a part in the 3D view
  setActivePart('bracelet');
}
```

`updateConfig` accepts a `Partial<ExtendedConfigState>` — only supply the fields you're changing.

---

## Loading a Preset

When the user navigates to `/configure?preset=<slug>`, the Configure page calls `loadPreset(preset)`:

```ts
// Copies all visual fields from the preset into config state
updateConfig({
  watchfaceGeometry:   preset.watchfaceGeometry,
  watchfaceColor:      preset.watchfaceColor,
  braceletMaterial:    preset.braceletMaterial,
  // … all other fields
  collectionName:      preset.collectionName,
});
```

The preset's `totalStars` is stored separately as the starting price (the user can deviate from it by customising).

---

## Geometry Options

| Value | Label (RU) | Description |
|-------|-----------|-------------|
| `rounded` | Скруглённый | Rounded rectangle — classic sport case |
| `circle` | Круглый | True circle — dress watch |
| `square` | Квадратный | Sharp-cornered square |
| `cushion` | Подушка | Cushion / barrel — vintage style |
| `tonneau` | Тонно | Barrel / tonneau — curved sides |

The geometry is rendered in 3D by `WatchModel` using `THREE.Shape` paths constructed per type. In SVG fallback mode `WatchSVG` uses equivalent SVG path commands.

---

## Bracelet Type vs. Material

These are independent axes:

**Type** controls the *physical form*:

| Value | Description |
|-------|-------------|
| `strap` | Single-piece tapered strap (most common) |
| `bracelet` | Segmented link bracelet |
| `nato` | Flat single-piece strap with a bar bridge |

**Material** controls *surface appearance and price*:

| Value | Label (RU) | Stars surcharge |
|-------|-----------|----------------|
| `leather` | Кожа | +0 |
| `rubber` | Резина | +2 |
| `resin` | Смола | +5 |
| `metal_solid` | Сталь сплошная | +8 |
| `metal_segmented` | Сталь сегментами | +10 |

---

## Eye Patterns

Certain collection presets unlock a themed "eye" motif drawn on the watch face. The `watchfaceEyeType` field controls which pattern is drawn by `drawEyesOnTexture`:

| Value | Pattern |
|-------|---------|
| `null` | No eyes |
| `spider` | Spider / compound eye clusters |
| `squid` | Squid horizontal elliptical eyes |
| `reptile` | Slit-pupil reptile eyes |
| `gremlin` | Cartoonish wide eyes |
| `cyber` | Geometric HUD-style eye overlays |
| `void` | Empty black sclera |

Eye patterns are drawn in the `buildFaceTexture` / `buildMiniTexture` functions using the HTML5 Canvas 2D API.

---

## Price Calculation

Price is calculated entirely client-side using the `component_prices` JSON fetched from `GET /api/admin/prices`.

```ts
function calculatePrice(config: ExtendedConfigState, prices: ComponentPrices): number {
  let total = prices.base;

  total += prices.geometry[config.watchfaceGeometry] ?? 0;
  total += prices.materials[config.braceletMaterial] ?? 0;

  if (config.serialNumber) total += prices.extras.serial_number ?? 0;
  if (config.boxType !== 'none') total += prices.extras.box ?? 0;

  return total;
}
```

The result is displayed live in the Configure panel. The same value is sent as `totalStars` when creating the order — the server does not recalculate.

> **Note**: The server trusts the client-supplied `totalStars`. For a production hardening step, consider having the server recalculate and reject mismatched values.

---

## Custom Texture Uploads

Admins can upload custom image textures via the Admin panel and assign them to presets. Three texture slots exist:

| Field | Applied to | Tiling |
|-------|-----------|--------|
| `customWatchfaceUrl` | Watch dial face | Covers face, overrides procedural canvas texture |
| `skinStripeUrl` | Strap stripe / centre strip | RepeatWrapping 1×3 |
| `skinFullUrl` | Entire bracelet body | UV-mapped same as face |

Textures are uploaded to `POST /api/admin/upload-texture` (8 MB limit, `image/*` only), stored at `artifacts/api-server/uploads/`, and served as static files at `/api/uploads/*`.

---

## Persistence Strategy

| Data | Storage | Cleared when |
|------|---------|-------------|
| Draft config | `localStorage["watch_config_draft"]` | User explicitly resets, or new preset loaded |
| Session ID | `localStorage["session_id"]` | User clears browser data |
| Auth token | `localStorage["jwt"]` | User logs out |
| Theme | `localStorage["theme"]` | User toggles |

The draft is serialised as JSON. On hydration, unknown keys are ignored so old drafts don't crash newer versions of the schema.

---

## Resetting the Configurator

```ts
const { resetConfig } = useWatchConfig();
resetConfig(); // Restores all fields to the default values defined in DEFAULT_CONFIG
```

`DEFAULT_CONFIG` is defined at the top of `use-watch-config.tsx` and represents a plain steel-bracelet, rounded-case watch with no text or serial number.
