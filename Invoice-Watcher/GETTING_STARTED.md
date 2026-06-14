# Чеблячас — Getting Started

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- A PostgreSQL database (Replit provides one automatically)

## Required Environment Variables

Set these in Replit Secrets (or your `.env`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for admin/courier JWT sessions |
| `TELEGRAM_BOT_TOKEN` | Token from [@BotFather](https://t.me/BotFather) for order notifications |
| `TELEGRAM_BOT_USERNAME` | Your bot's username (without `@`) |

> `TELEGRAM_BOT_USERNAME` and `VITE_TELEGRAM_BOT_USERNAME` are already set in `.replit` to `cheblyachas_bot` — update them if you use a different bot.

---

## Starting the App

### On Replit

Click the **Run** button. It starts both services in parallel automatically.

### Manually (two terminals)

**Terminal 1 — API server (port 8080):**
```bash
pnpm install
pnpm --filter @workspace/db run push
PORT=8080 pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend (port 5000):**
```bash
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev
```

Then open `http://localhost:5000` in your browser.

---

## Other Useful Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/db run push` | Push DB schema changes to PostgreSQL |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks + Zod schemas from `openapi.yaml` |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |

---

## Default Admin Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `FutureAfterWatch3s` | Admin |
| `courier1` | `courier123` | Courier |

Access the admin panel at `/login`.

---

## Architecture at a Glance

```
watch-configurator/   ← React 19 + Vite frontend  (port 5000)
api-server/           ← Express 5 backend          (port 8080)
lib/
  api-spec/           ← OpenAPI source of truth
  api-client-react/   ← Generated TanStack Query hooks (don't edit)
  api-zod/            ← Generated Zod validators   (don't edit)
  db/                 ← Drizzle ORM schema + migrations
```

Frontend proxies all `/api/*` requests to the backend automatically via Vite's dev proxy.
