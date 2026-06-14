# Чеблячас — How to Run

## Prerequisites

- **Node.js 24+**
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** database (local or hosted)

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd <repo>
pnpm install
```

---

## 2. Environment Variables

Create a `.env` file in the repo root (or set these in your environment):

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/cheblychas

# JWT signing secret — any long random string
JWT_SECRET=your-very-long-random-secret

# Express session secret
SESSION_SECRET=another-long-random-secret

# Telegram bot credentials (for Stars payment links)
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_BOT_USERNAME=YourBotUsername
```

---

## 3. Push the Database Schema

Run this once (and after any schema changes):

```bash
pnpm --filter @workspace/db run push
```

---

## 4. Seed the Database

Populates presets, admin users, and analytics events:

```bash
pnpm --filter @workspace/scripts run seed
```

**Seeded accounts:**

| Username  | Password            | Role    |
|-----------|---------------------|---------|
| `admin`   | `FutureAfterWatch3s`| admin   |
| `courier1`| `courier123`        | courier |

---

## 5. Start the API Server

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

The API will be available at `http://localhost:8080`.

---

## 6. Start the Frontend

```bash
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev
```

Open `http://localhost:5000` in your browser.

---

## Both at once (two terminals)

```bash
# Terminal 1
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev
```

---

## Other Useful Commands

| Command | What it does |
|---|---|
| `pnpm run build` | Typecheck + build all packages |
| `pnpm run typecheck` | TypeScript check across the monorepo |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks from OpenAPI spec (run after editing `lib/api-spec/openapi.yaml`) |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |

---

## Project Structure

```
lib/
  api-spec/         OpenAPI spec (source of truth for all API contracts)
  api-client-react/ Generated TanStack Query hooks (do not edit manually)
  db/               Drizzle ORM schema + migrations

artifacts/
  api-server/       Express 5 API (routes: presets, orders, prices, auth, analytics)
  watch-configurator/ React + Vite frontend
    src/
      pages/        Home, Presets, Collections, Configure, Payment, Orders, Login, Admin
      components/   WatchModel (3D), WatchSVG (2D fallback), WatchMiniCanvas, etc.
      hooks/        use-watch-config (global state), use-auth (JWT)

scripts/            Seed script
```

---

## Notes

- The 3D watch preview uses WebGL (Three.js / React Three Fiber). It will automatically fall back to an SVG illustration in environments without GPU/WebGL support.
- Auth tokens are stored in `localStorage["jwt"]`. The generated API client reads them automatically — no manual header setup needed.
- After editing the OpenAPI spec, always re-run codegen or the TypeScript build will fail.
