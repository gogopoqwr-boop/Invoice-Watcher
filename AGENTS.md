# Base44 Dev Environment Notes

## Stack
- pnpm monorepo (pnpm 9, lockfile v9) — `pnpm install --no-frozen-lockfile` (NOT frozen; overrides in `pnpm-workspace.yaml` mismatch the committed lockfile)
- Express 5 API server (`artifacts/api-server`) — esbuild bundle + start, **no file watch**; restart the `api` compose service after backend edits
- React 19 + Vite frontend (`artifacts/watch-configurator`) — HMR live reload on save; port 3000
- PostgreSQL 15 (`db` service), Drizzle ORM
- Telegram bot integration (payment flow via Telegram Stars)

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
- `setup` one-shot service: installs deps, pushes Drizzle schema (`pnpm --filter @workspace/db run push`), seeds presets/admin users. Runs before api/web start.
- Frontend on host port **3000**; Vite proxies `/api/*` to the `api` service via `API_PROXY_TARGET` env var (see `vite.config.ts` — defaults to `http://localhost:8080` for non-Docker local dev).
- API server also auto-seeds presets and admin users on startup (idempotent).

## Backend code changes
The API has no watch mode. After editing `artifacts/api-server/**`:
```bash
docker compose -f docker-compose.base44.yml restart api
```

## Frontend code changes
Vite HMR picks them up automatically — no restart needed.

## Environment / secrets
- `.env.base44-defaults` (repo) — dev placeholders, FIRST in env_file list
- `/run/base44/app.env` (platform) — real secrets, LAST, always wins
- `DATABASE_URL` points at the compose `db` service (local infra credential)
- `TELEGRAM_BOT_TOKEN` — user-provided, needed for Telegram Stars payment; app boots fine without it
- Seeded admin login: `admin` / `FutureAfterWatch3s` (admin panel at `/login`)

## Verify it works
```bash
curl http://localhost:3000/                        # 200 from Vite
curl http://localhost:3000/api/presets             # JSON presets through the proxy
```
