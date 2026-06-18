# Architecture & Stack

← [Back to README](../README.md)

---

## Overview

The project is a **pnpm monorepo** with two runnable applications (`artifacts/`) and four internal shared libraries (`lib/`). The API and frontend are completely decoupled — they communicate exclusively through the OpenAPI-defined contract.

```
┌─────────────────────────────────────────────────┐
│                  Browser / User                 │
└─────────────────────┬───────────────────────────┘
                      │ HTTP
          ┌───────────▼───────────┐
          │  watch-configurator   │  React 19 + Vite
          │  (static SPA)         │  Three.js / R3F
          └───────────┬───────────┘
                      │ /api/* (proxied in dev, same domain in prod)
          ┌───────────▼───────────┐
          │     api-server        │  Express 5, Node.js 24
          │                       │  esbuild CJS bundle
          └──────┬────────┬───────┘
                 │        │
     ┌───────────▼─┐   ┌──▼───────────────┐
     │ PostgreSQL  │   │  Telegram Bot API │
     │ (Drizzle)   │   │  (Stars payments) │
     └─────────────┘   └──────────────────┘
```

---

## Monorepo Layout

```
.
├── pnpm-workspace.yaml        # declares packages: artifacts/*, lib/*, scripts
├── package.json               # root scripts: typecheck, build
├── artifacts/
│   ├── api-server/
│   ├── watch-configurator/
│   └── mockup-sandbox/        # dev-only component preview server
└── lib/
    ├── db/
    ├── api-spec/
    ├── api-client-react/
    └── api-zod/
```

All packages are TypeScript. The root `package.json` has `typecheck` and `build` scripts that invoke `tsc` and `pnpm -r build` across the workspace.

---

## Tech Stack

### Frontend — `@workspace/watch-configurator`

| Layer | Library | Version |
|-------|---------|---------|
| Framework | React | 19 |
| Build tool | Vite | 6 |
| Styling | Tailwind CSS | v4 |
| 3D engine | Three.js | r170 |
| R3F bindings | @react-three/fiber | 9 |
| R3F helpers | @react-three/drei | 9 |
| Spring physics | @react-spring/three | 9 |
| Data fetching | @tanstack/react-query | 5 |
| Routing | wouter | 3 |
| Animations | framer-motion | 12 |
| QR codes | qrcode.react | 4 |
| Icons | lucide-react | latest |

### Backend — `@workspace/api-server`

| Layer | Library | Notes |
|-------|---------|-------|
| HTTP framework | Express | 5 (async error propagation built in) |
| Runtime | Node.js | 24 |
| Builder | esbuild | Bundles to single CJS file for fast cold starts |
| ORM | Drizzle ORM | Type-safe queries; `drizzle-zod` for schema → Zod |
| Database driver | pg (node-postgres) | Pool managed by Drizzle |
| Auth | jsonwebtoken | HS256 JWT stored in browser `localStorage["jwt"]` |
| Password hashing | bcryptjs | Cost factor 10 |
| Telegram | node-telegram-bot-api | Webhook mode in production, polling disabled |
| Logging | pino | JSON structured logs |
| Image generation | sharp | Watch preview PNG/GIF for bot messages |

### Shared Libraries

| Package | Purpose |
|---------|---------|
| `@workspace/db` | Drizzle client + all schema definitions |
| `@workspace/api-spec` | `openapi.yaml` + Orval codegen config |
| `@workspace/api-client-react` | Generated TanStack Query hooks (never edit manually) |
| `@workspace/api-zod` | Generated Zod validators used in API server for request validation |

---

## Contract-First API Codegen

The OpenAPI spec (`lib/api-spec/openapi.yaml`) is the single source of truth for all API contracts. Two artifacts are generated from it:

```
lib/api-spec/openapi.yaml
        │
        ├─→ pnpm --filter @workspace/api-spec run codegen
        │
        ├─→ lib/api-client-react/src/generated/
        │       hooks.ts        ← TanStack Query useQuery/useMutation hooks
        │       schemas.ts      ← Zod schemas for request/response types
        │
        └─→ lib/api-zod/src/
                index.ts        ← Zod validators used by Express route handlers
```

**Rule**: Never write raw `fetch()` calls in the frontend. Use the generated hooks. Never write manual request-body validators in Express. Import from `@workspace/api-zod`.

After changing `openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
# then rebuild the libs if needed:
pnpm --filter @workspace/api-client-react run build
pnpm --filter @workspace/api-zod run build
```

---

## Database Schema

Defined in `lib/db/src/schema/`. Each file exports a Drizzle table object.

### `orders`

```
id               serial PK
session_id       text        — anonymous session identifier
telegram_id      text        — set after payment links to Telegram user
config_id        integer FK  → watch_configs.id
total_stars      integer     — price in Telegram Stars (XTR)
status           enum        — payment_pending | paid | processing |
                               shipping | arrived | cancelled | cancel_requested
payment_token    text        — 32-char hex, used in Telegram deep link
telegram_payment_charge_id  text   — set by Telegram on successful_payment
courier_id       integer FK  → admin_users.id (optional)
tracking_code    text        — courier tracking number (optional)
created_at       timestamp
updated_at       timestamp
```

### `watch_configs`

```
id               serial PK
session_id       text
watchface_geometry   text   — rounded | circle | square | cushion | tonneau
watchface_color      text   — hex color
bracelet_color       text   — hex color
bracelet_material    text   — leather | rubber | metal_solid | metal_segmented | resin
bracelet_type        text   — strap | bracelet | nato
hands_color          text   — hex color
hands_enabled        boolean
hands_count          integer
watchface_text       text
watchface_text_mode  text   — center | circular
watchface_background_type   text
serial_number        text
box_type             text
collection_name      text
created_at           timestamp
```

### `watch_presets`

```
id               serial PK
name             text
collection_name  text
slug             text UNIQUE
description      text
total_stars      integer
(all watch_config fields duplicated as columns)
sort_order       integer
active           boolean
created_at / updated_at
```

### `admin_users`

```
id               serial PK
username         text UNIQUE
password_hash    text        — bcrypt
role             enum        — admin | courier
created_at
```

### `analytics_events`

```
id               serial PK
event_type       text        — page_visit | checkout_start
session_id       text
metadata         jsonb
created_at       timestamp
```

### `settings`

```
key              text PK     — e.g. "component_prices"
value            jsonb       — arbitrary JSON blob
updated_at       timestamp
```

---

## Authentication

JWT tokens are signed with `JWT_SECRET` (HS256). The payload contains `{ id, username, role }`. Tokens have no expiry in the current implementation — rotate `JWT_SECRET` to invalidate all sessions.

**Storage**: `localStorage["jwt"]`  
**Transport**: The generated `customFetch` in `@workspace/api-client-react` reads `localStorage["jwt"]` and injects `Authorization: Bearer <token>` on every request automatically.

**Server middleware**:

```
POST /auth/login
  → bcrypt.compare(password, hash)
  → jwt.sign({ id, username, role })
  → { token, role }

requireAdmin middleware
  → reads Authorization header
  → jwt.verify(token, JWT_SECRET)
  → checks decoded.role === "admin"

requireCourier middleware
  → same, but accepts "admin" or "courier"
```

---

## Background Worker

On server start, `startPaymentExpirationWorker()` runs every 60 seconds. It queries for orders with `status = payment_pending` and `created_at` older than 10 minutes and sets them to `cancelled`. This prevents orphaned pending orders from clogging the system if the user abandons the payment flow.

---

## Dev Proxy

In development, Vite proxies all requests matching `/api/*` to `http://localhost:8080`. This is configured in `artifacts/watch-configurator/vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8080',
  },
  allowedHosts: true,   // required for Replit iframe preview
}
```

In production, both services share a domain (Replit routes `/api/*` to port 8080 and `/` to the static files).
