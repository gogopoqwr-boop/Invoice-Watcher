---
name: Seed data and DB population
description: Presets and admin users are seeded via scripts/src/seed.ts — must run on fresh DB or after wipe.
---

## Rule
The DB is NOT auto-seeded on first run. If presets or admin users are missing, run:
```
pnpm --filter @workspace/scripts run seed
```

## Why
The DB starts empty. The seed script inserts 6 presets (Midnight Steel, Arctic Frost, Crimson Core, Carbon Ghost, Gold Rush, Ocean Drive) and 2 admin users (admin/FutureAfterWatch3s, courier1/courier123). Without the seed the collections page shows empty.

## How to apply
- After a DB wipe or fresh provision, run the seed command above.
- The post-merge script (`scripts/post-merge.sh`) now includes `pnpm --filter @workspace/scripts run seed` so task agent merges auto-seed.
- The seed uses `onConflictDoNothing()` so it is safe to run multiple times.
