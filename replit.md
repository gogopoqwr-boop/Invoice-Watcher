# НА_УТРАХ_4 — Watch Configurator

A full-stack 3D watch configurator. Users design a custom watch (geometry, materials, bracelet, colors, serial number), pay via Telegram Stars deep link, and track their order.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/watch-configurator run dev` — run the frontend (port from $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind v4, Three.js / React Three Fiber (@react-three/fiber, @react-three/drei, @react-spring/three)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: JWT stored in `localStorage` under key `"jwt"` — the custom-fetch reads it automatically

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/` — generated TanStack Query hooks (don't edit manually)
- `lib/db/src/schema.ts` — Drizzle ORM schema (source of truth for DB shape)
- `artifacts/api-server/src/routes/` — Express route handlers (presets, configurations, prices, orders, analytics, auth)
- `artifacts/watch-configurator/src/` — React frontend
  - `pages/` — Home, Presets, Configure, Payment, Orders, Login, Admin
  - `components/WatchModel.tsx` — Three.js 3D watch (R3F)
  - `components/WatchSVG.tsx` — 2D SVG fallback when WebGL unavailable
  - `hooks/use-watch-config.tsx` — global configurator state (persisted to localStorage)
  - `hooks/use-auth.tsx` — JWT auth state (token stored under `"jwt"` in localStorage)
- `artifacts/watch-configurator/src/index.css` — Liquid Glass design tokens and styles

## Architecture decisions

- Contract-first API: OpenAPI spec drives codegen for both React hooks and Zod validators — never write fetch calls by hand
- WebGL detection upfront: `isWebGLAvailable()` check before mounting Canvas; SVG fallback shown instead in headless/sandbox environments
- React deduplication: `pnpm-workspace.yaml` overrides + Vite `resolve.dedupe` ensure a single React instance despite R3F/react-spring peer deps
- Auth token in `localStorage["jwt"]`: the generated `customFetch` reads it automatically — no need to pass headers manually
- Session ID in `localStorage["session_id"]`: anonymous session tracking for orders without user accounts

## Product

- **Home** — landing page with ЧАСЫ / МЕРЧ selection
- **Presets** — 6 curated watch presets (Midnight Steel, Arctic Frost, etc.) loaded from DB
- **Configure** — 3D (or SVG fallback) watch preview + full configuration panel (geometry, material, colors, bracelet, hands, serial number)
- **Payment** — Telegram Stars QR code + deep link for selected order
- **Orders** — session-based order history with status tracking
- **Login** — admin/courier login via JWT
- **Admin** — orders management (status progression, tracking codes) + analytics (admin only)

## Seeded data

- Presets: Midnight Steel, Arctic Frost, Crimson Core, Carbon Ghost, Gold Rush, Ocean Drive
- Admin users: `admin` / `admin123` (role: admin), `courier1` / `courier123` (role: courier)
- 150 analytics events pre-seeded

## User preferences

_None recorded yet._

## Gotchas

- Always restart the API server workflow after route changes (it builds then starts)
- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec changes
- WebGL won't work in Replit's screenshot/preview sandbox (no GPU) — this is expected; the SVG fallback handles it

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
