# НА_УТРАХ_4 — Watch Configurator

A full-stack 3D watch configurator. Users design a custom watch, pay via Telegram Stars, and track their order through fulfillment.

→ **[Architecture & Stack](docs/architecture.md)**  
→ **[3D Models & Rendering](docs/3d-models.md)**  
→ **[Payment System](docs/payment.md)**  
→ **[Orders & Tracking](docs/orders.md)**  
→ **[Admin Panel & Analytics](docs/admin-panel.md)**

---

## Requirements

| Tool | Minimum version |
|------|----------------|
| Node.js | 24.x |
| pnpm | 9.x |
| PostgreSQL | 15+ |

Install pnpm globally if you don't have it:

```bash
npm install -g pnpm@latest
```

---

## Environment Variables

Create a `.env` file in the repo root (or set these as Secrets in your deployment platform). All variables are required for production.

```env
# PostgreSQL connection string — Replit provides this automatically
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Secret for signing admin/courier JWTs — use a long random string
JWT_SECRET=replace-with-64-random-chars

# Telegram bot token from @BotFather
TELEGRAM_BOT_TOKEN=123456789:AABBCCDDEEFFaabbccddeeff

# Telegram bot username without @ — used to build deep links
TELEGRAM_BOT_USERNAME=your_bot_username

# Same username exposed to the Vite frontend build
VITE_TELEGRAM_BOT_USERNAME=your_bot_username

# Public URL of the frontend — used in bot messages and QR codes
WEBSITE_URL=https://your-app.replit.app

# Port for the API server (default 8080)
PORT=8080

# Set to "production" for deployed instances
NODE_ENV=production
```

> On Replit: `DATABASE_URL` is provisioned automatically. `JWT_SECRET` and `TELEGRAM_BOT_TOKEN` are set via the Secrets tab. `REPLIT_DOMAINS` is injected at runtime so the server can auto-detect its public URL for the Telegram webhook.

---

## First-time Setup

Run all of these in order from the repo root.

### 1. Install all workspace dependencies

```bash
pnpm install
```

Installs dependencies for every package in the monorepo in a single pass.

### 2. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

Runs `drizzle-kit push` against `DATABASE_URL` and creates all tables. Safe to run multiple times — additive only in development.

### 3. Seed initial data

```bash
pnpm --filter @workspace/scripts run seed
```

Inserts:
- **6 watch presets** — Midnight Steel, Arctic Frost, Crimson Core, Carbon Ghost, Gold Rush, Ocean Drive
- **Admin user** — `admin` / `FutureAfterWatch3s` (role: admin)
- **Courier user** — `courier1` / `courier123` (role: courier)
- **150 sample analytics events**

> **Change the default passwords immediately on any public deployment.**

### 4. Regenerate the API client (only needed after spec changes)

The generated hooks and Zod validators are checked in, so this step is only required after editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Running in Development

Start both services. Each needs its own terminal (or Replit workflow):

```bash
# API server — port 8080
PORT=8080 pnpm --filter @workspace/api-server run dev

# Frontend — port 5000
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev
```

The frontend Vite config proxies `/api/*` to `localhost:8080`, so there are no CORS issues in dev.

The API server rebuilds on every file change via `esbuild`. The frontend uses Vite HMR.

---

## Building for Production

```bash
pnpm run build
```

This runs TypeScript typecheck across all packages, then builds:

| Package | Output |
|---------|--------|
| `@workspace/api-server` | `artifacts/api-server/dist/index.cjs` (esbuild CJS bundle) |
| `@workspace/watch-configurator` | `artifacts/watch-configurator/dist/` (static SPA) |

### Start the production API server

```bash
NODE_ENV=production PORT=8080 pnpm --filter @workspace/api-server run start
```

### Serve the frontend

The built frontend is a static SPA. Serve the `artifacts/watch-configurator/dist/` directory from any static host. On Replit, the deploy pipeline handles this automatically.

---

## Common Commands

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/db run push` | Apply DB schema changes to PostgreSQL |
| `pnpm --filter @workspace/scripts run seed` | Seed presets, admin users, analytics |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks + Zod schemas from OpenAPI spec |
| `pnpm --filter @workspace/api-server run dev` | Start API server in dev mode (port 8080) |
| `pnpm --filter @workspace/watch-configurator run dev` | Start frontend in dev mode |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |

---

## Project Structure

```
.
├── artifacts/
│   ├── api-server/                    # Express 5 API server
│   │   └── src/
│   │       ├── index.ts               # Entry: registers Telegram webhook, starts expiration worker
│   │       └── routes/
│   │           ├── auth.ts            # POST /auth/login, GET /auth/me
│   │           ├── presets.ts         # GET/POST/PATCH/DELETE /presets
│   │           ├── configurations.ts  # POST /configurations
│   │           ├── orders.ts          # GET/POST /orders, PATCH /orders/:id/status
│   │           ├── analytics.ts       # GET /analytics/summary, /analytics/time-series
│   │           ├── admin.ts           # Admin-only routes (users, prices, presets)
│   │           └── bot.ts             # POST /bot/webhook — Telegram bot handler
│   │
│   ├── watch-configurator/            # React 19 + Vite frontend
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Home.tsx           # Landing — ЧАСЫ / МЕРЧ choice
│   │       │   ├── CollectionPage.tsx # 3D preset cards per collection
│   │       │   ├── Configure.tsx      # Full 3D configurator + step panel
│   │       │   ├── Payment.tsx        # Telegram Stars QR + deep link
│   │       │   ├── Orders.tsx         # Session order history
│   │       │   ├── OrderDetail.tsx    # Single order with status timeline
│   │       │   ├── Login.tsx          # Admin/courier login
│   │       │   └── Admin.tsx          # Admin panel (orders + analytics)
│   │       ├── components/
│   │       │   ├── WatchModel.tsx     # High-fidelity R3F 3D model (configurator)
│   │       │   ├── WatchMiniCanvas.tsx# Card-sized 3D preview with WebGL pooling
│   │       │   ├── WatchSVG.tsx       # 2D SVG fallback when WebGL unavailable
│   │       │   └── WatchBoxScene.tsx  # Animated gift-box scene
│   │       └── hooks/
│   │           ├── use-watch-config.tsx # Global configurator state (localStorage)
│   │           └── use-auth.tsx         # JWT auth state
│   │
│   └── mockup-sandbox/                # Isolated component preview server (dev only)
│
├── lib/
│   ├── db/src/schema/                 # Drizzle ORM schema (source of truth for DB shape)
│   │   ├── orders.ts
│   │   ├── watchConfigs.ts
│   │   ├── watchPresets.ts
│   │   ├── adminUsers.ts
│   │   ├── analyticsEvents.ts
│   │   └── settings.ts
│   ├── api-spec/openapi.yaml          # OpenAPI 3.1 spec — source of truth for all contracts
│   ├── api-client-react/src/generated/# Generated TanStack Query hooks (do not edit)
│   └── api-zod/                       # Generated Zod validators (do not edit)
│
└── scripts/                           # Seed script
```

---

## Deploying on Replit

1. Import the repo into a Replit project
2. Open the **Database** tab → create a PostgreSQL database → `DATABASE_URL` is injected automatically
3. Open the **Secrets** tab → add `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `VITE_TELEGRAM_BOT_USERNAME`
4. Run setup commands in the Shell tab:
   ```bash
   pnpm install
   pnpm --filter @workspace/db run push
   pnpm --filter @workspace/scripts run seed
   ```
5. Ensure two workflows are configured and running:
   - **API Server**: `PORT=8080 pnpm --filter @workspace/api-server run dev`
   - **Watch Configurator**: `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev`
6. Click **Deploy → Publish** — Replit builds, hosts, and issues a TLS certificate automatically
7. The Telegram webhook is registered automatically on first server start using `REPLIT_DOMAINS`

### Schema changes after deployment

```bash
pnpm --filter @workspace/db run push
# Then redeploy or restart the server
```

---

## Further Reading

| Topic | Doc |
|-------|-----|
| Monorepo architecture, codegen pipeline, DB schema | [docs/architecture.md](docs/architecture.md) |
| 3D watch geometry, WebGL management, animations | [docs/3d-models.md](docs/3d-models.md) |
| Telegram Stars payment flow, bot webhook | [docs/payment.md](docs/payment.md) |
| Order lifecycle, status machine, tracking | [docs/orders.md](docs/orders.md) |
| Admin panel, RBAC, couriers, analytics | [docs/admin-panel.md](docs/admin-panel.md) |
| All pages, routing, provider hierarchy | [docs/frontend-pages.md](docs/frontend-pages.md) |
| Configurator state, watch options, price calc | [docs/configurator-state.md](docs/configurator-state.md) |
| Full API route reference | [docs/api-routes.md](docs/api-routes.md) |
| Adding routes, extending the spec, local dev tips | [docs/development-guide.md](docs/development-guide.md) |
| Telegram bot setup, webhook, notifications, refunds | [docs/telegram-bot.md](docs/telegram-bot.md) |
