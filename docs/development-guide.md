# Development Guide

← [Back to README](../README.md)

---

## Prerequisites

- **Node.js 24+** (the `.replit` config loads `nodejs-20`; install 24 via `nvm` locally if needed)
- **pnpm 10+** — `npm install -g pnpm`
- **PostgreSQL** — local install, Docker, or use the Replit-provisioned instance

---

## First-Time Setup

```bash
# 1. Install all workspace packages
pnpm install

# 2. Set required environment variables (see below)

# 3. Push the DB schema
pnpm --filter @workspace/db run push

# 4. Seed initial data (presets + admin users)
pnpm --filter @workspace/scripts run seed

# 5. Start both services (two terminals)
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/watch-configurator run dev
```

---

## Required Environment Variables

| Variable | Where to set | Purpose |
|----------|-------------|---------|
| `DATABASE_URL` | Secret | PostgreSQL connection string |
| `JWT_SECRET` | Secret | JWT signing key (any long random string) |
| `SESSION_SECRET` | Secret | Express session key |
| `TELEGRAM_BOT_TOKEN` | Secret | From @BotFather |
| `TELEGRAM_BOT_USERNAME` | Env var (shared) | Bot username without `@` |

On Replit all of these are pre-configured. Locally, create a `.env` file at the repo root:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/cheblychas
JWT_SECRET=your-very-long-random-secret
SESSION_SECRET=another-long-secret
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_BOT_USERNAME=YourBotUsername
```

> Never commit `.env` to git.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install / update all workspace packages |
| `pnpm run typecheck` | TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/db run push` | Apply schema changes to DB |
| `pnpm --filter @workspace/db run push-force` | Force-push (drops conflicting constraints) |
| `pnpm --filter @workspace/scripts run seed` | Seed presets + admin users |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks + Zod schemas |
| `pnpm --filter @workspace/api-server run dev` | Start API server (port 8080) |
| `pnpm --filter @workspace/watch-configurator run dev` | Start frontend (port 5000) |

---

## Adding a New API Endpoint

### Step 1 — Define in OpenAPI spec

Edit `lib/api-spec/openapi.yaml`. Add the path, method, request body schema, and response schema.

```yaml
paths:
  /api/widgets:
    get:
      operationId: listWidgets
      summary: List all widgets
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Widget'
```

### Step 2 — Run codegen

```bash
pnpm --filter @workspace/api-spec run codegen
```

This updates:
- `lib/api-client-react/src/generated/` — new `useListWidgets` hook
- `lib/api-zod/src/` — new Zod validator schemas

### Step 3 — Write the route handler

Create or edit a file in `artifacts/api-server/src/routes/`:

```ts
// artifacts/api-server/src/routes/widgets.ts
import { Router } from 'express';
import { db } from '@workspace/db';
import { widgetsTable } from '@workspace/db/schema';

export const widgetsRouter = Router();

widgetsRouter.get('/', async (req, res) => {
  const rows = await db.select().from(widgetsTable);
  res.json(rows);
});
```

### Step 4 — Register the router

```ts
// artifacts/api-server/src/index.ts
import { widgetsRouter } from './routes/widgets';
app.use('/api/widgets', widgetsRouter);
```

### Step 5 — Use in the frontend

```ts
import { useListWidgets } from '@workspace/api-client-react';

function MyPage() {
  const { data: widgets } = useListWidgets();
  // ...
}
```

---

## Adding a New Config Option

Example: adding a `caseDiameter` field (watch size in mm).

### 1. DB schema

```ts
// lib/db/src/schema/watch-configs.ts
caseDiameter: integer('case_diameter').default(40).notNull(),
```

```bash
pnpm --filter @workspace/db run push
```

### 2. OpenAPI spec

Add `caseDiameter` to the `WatchConfig` and `WatchConfigInput` schemas in `openapi.yaml`. Run codegen.

### 3. Config state

```ts
// src/hooks/use-watch-config.tsx
interface ExtendedConfigState {
  // ...existing fields
  caseDiameter: 36 | 38 | 40 | 42 | 44;
}

const DEFAULT_CONFIG: ExtendedConfigState = {
  // ...
  caseDiameter: 40,
};
```

### 4. UI control

Add a slider or radio group in the Configure page's Geometry tab.

### 5. 3D model

Read `caseDiameter` in `WatchModel.tsx` / `WatchCardModel` and scale the case geometry accordingly.

### 6. Price (optional)

Add to the `component_prices` JSON structure and update `calculatePrice`.

---

## Changing the Database Schema

1. Edit `lib/db/src/schema/*.ts`
2. Run `pnpm --filter @workspace/db run push` (dev only — uses `drizzle-kit push`)
3. If there are destructive changes (column drops, type changes), use `push-force` or write a manual migration

> `drizzle-kit push` is for development only. For production schema changes, generate a migration SQL file and apply it to the production DB manually.

---

## Regenerating API Code

Any time `lib/api-spec/openapi.yaml` changes, regenerate:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This is **not** run automatically on build — you must run it manually. If you forget, the TypeScript build will fail with type mismatches between the spec and the generated code.

---

## Adding a New Preset (via Seed Script)

Edit `scripts/src/seed.ts` and add an entry to the `presets` array:

```ts
{
  name: 'Urban Titanium',
  slug: 'urban-titanium',
  collectionName: 'Urban',
  description: 'Brushed titanium case with a minimalist black dial.',
  totalStars: 180,
  watchfaceGeometry: 'square',
  watchfaceColor: '#0d0d0d',
  braceletMaterial: 'metal_solid',
  braceletType: 'bracelet',
  braceletColor: '#8a8a8a',
  handsEnabled: true,
  handsCount: 2,
  handsColor: '#ffffff',
  sortOrder: 7,
  active: true,
}
```

Then run:

```bash
pnpm --filter @workspace/scripts run seed
```

The seed script clears existing presets before inserting, so all presets are replaced each run.

> To add a preset without re-seeding everything, use the Admin panel UI at `/admin` → Presets tab.

---

## Frontend Build

```bash
pnpm --filter @workspace/watch-configurator run build
```

Outputs to `artifacts/watch-configurator/dist/`. The Vite config sets `base` from the `BASE_PATH` environment variable (defaults to `/`).

---

## Backend Build

```bash
pnpm --filter @workspace/api-server run build
```

Uses `esbuild` via `build.mjs`. Outputs to `artifacts/api-server/dist/index.mjs` (ESM bundle) plus pino worker files.

The build externalises:
- `sharp` (native module, can't be bundled)
- Node built-ins

`pino-pretty` and `thread-stream` are bundled as worker scripts by `esbuild-plugin-pino`.

---

## TypeScript Project References

The repo uses TypeScript project references for the `lib/` packages. The root `tsconfig.json` references each lib:

```json
{
  "references": [
    { "path": "./lib/db" },
    { "path": "./lib/api-spec" },
    { "path": "./lib/api-client-react" },
    { "path": "./lib/api-zod" }
  ]
}
```

Running `pnpm run typecheck:libs` builds all four libs in dependency order. The artifacts then run their own `tsc --noEmit` checks via `pnpm run typecheck`.

---

## Debugging Tips

### API server won't start

Check `artifacts/api-server/dist/index.mjs` exists. If not, the build step failed — check `pnpm --filter @workspace/api-server run build` output.

### Frontend proxy errors (`ECONNREFUSED 127.0.0.1:8080`)

The API server isn't running yet. Start it first, or wait for it to finish building.

### TypeScript errors after changing `openapi.yaml`

Run codegen: `pnpm --filter @workspace/api-spec run codegen`. The generated files in `lib/api-client-react/src/generated/` and `lib/api-zod/src/` are out of date.

### Database errors (`relation does not exist`)

Run `pnpm --filter @workspace/db run push` to apply schema changes.

### 3D watch not rendering (black screen)

Likely a WebGL context issue. Check the browser console for errors. The SVG fallback should kick in automatically if WebGL is unavailable — if it doesn't, verify `isWebGLAvailable()` is being called before mounting the `<Canvas>`.

### Telegram webhook not receiving messages

Verify the webhook is registered:
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

The server auto-registers on startup using `REPLIT_DOMAINS`. If that env var is missing, the webhook URL will be wrong.
