# Чеблячас — Watch Configurator

A full-stack 3D watch configurator. Users design a custom watch, pay via Telegram Stars, and track their order.

---

## Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** database (Replit provides one automatically via the Database tab)

---

## Environment Variables

Set these in Replit's **Secrets** tab (or your `.env` locally):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by Replit DB) |
| `JWT_SECRET` | Yes | Any long random string, used to sign admin JWT tokens |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | Yes | Your bot's username without `@` (e.g. `cheblyachas_bot`) |
| `VITE_TELEGRAM_BOT_USERNAME` | Yes | Same as above — exposed to the frontend |

---

## Local / Dev Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up the database schema

```bash
pnpm --filter @workspace/db run push
```

This applies the Drizzle ORM schema to your PostgreSQL database. The API server automatically seeds presets and admin users on first start.

### 3. Start the dev servers

Run both servers in separate terminals (or use the Replit workflow buttons):

```bash
# Terminal 1 — API server (port 8080)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 5000)
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev
```

The frontend proxies `/api/*` requests to `localhost:8080` automatically.

Open `http://localhost:5000` in your browser.

### Default admin credentials (auto-seeded)

| Username | Password | Role |
|---|---|---|
| `admin` | `FutureAfterWatch3s` | Admin |
| `courier1` | `courier123` | Courier |

---

## Other Useful Commands

```bash
# Full typecheck across all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Regenerate API client hooks + Zod validators from OpenAPI spec
# Run this after any change to lib/api-spec/openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes after editing lib/db/src/schema.ts
pnpm --filter @workspace/db run push
```

---

## Project Structure

```
/
├── lib/
│   ├── api-spec/openapi.yaml       # API contract — source of truth
│   ├── api-client-react/           # Generated TanStack Query hooks (don't edit)
│   ├── api-zod/                    # Generated Zod validators (don't edit)
│   └── db/src/schema/             # Drizzle ORM schema
│
└── artifacts/
    ├── api-server/src/
    │   ├── routes/                 # Express route handlers
    │   └── lib/                    # Shared server utilities
    └── watch-configurator/src/
        ├── pages/                  # React pages
        ├── components/             # WatchModel (3D), WatchSVG (fallback)
        └── hooks/                  # use-watch-config, use-auth
```

---

## Deploying to Production

This project is configured for **Replit Autoscale** deployment (stateless, scales with traffic).

### Step 1 — Verify the app works

Make sure both workflows (`API Server` and `Watch Configurator`) are running without errors in the Replit console.

### Step 2 — Check your secrets

Ensure all required secrets are set in the **Secrets** tab — especially `JWT_SECRET` and `TELEGRAM_BOT_TOKEN`.

### Step 3 — Publish

Click the **Deploy** button (top-right in Replit) → **Publish**. Replit will:

1. Run the build command (`pnpm run build`)
2. Start the production server
3. Issue a TLS certificate
4. Assign a `.replit.app` domain

The production run command (configured in `.replit`) starts the API server on port 8080 and serves the built frontend.

### Step 4 — Register the Telegram webhook

After your first deploy, the API server auto-registers the Telegram bot webhook using the `REPLIT_DOMAINS` environment variable. You can verify it worked by calling:

```
GET https://your-app.replit.app/api/bot/webhook-info
```

### Choosing a region (optional)

Before your **first** publish, open the **Advanced** section of the Deploy panel to select a geographic region (EU, US, etc.). This choice is **permanent** — it cannot be changed after the first deployment. Region selection requires a Core plan or above.

### Re-deploying

Push your changes and click **Redeploy** in the Deploy panel. Schema changes to the database should be applied manually before redeploying:

```bash
pnpm --filter @workspace/db run push
```

---

## Architecture Notes

- **Contract-first API** — edit `lib/api-spec/openapi.yaml`, then run codegen. Never write fetch calls by hand.
- **WebGL fallback** — `WatchModel.tsx` checks for WebGL support at mount time; `WatchSVG.tsx` is shown as a fallback (Replit preview sandbox has no GPU — this is expected).
- **Auth** — admin JWT stored in `localStorage["jwt"]`; the generated `customFetch` sends it automatically.
- **Payments** — Telegram Stars via bot invoice API (`XTR` currency). Payment expiration worker auto-cancels unpaid orders after 10 minutes.
