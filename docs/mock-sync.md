# Mock NBA sync pipeline

This project can run the **full sync pipeline** using realistic local mock data:

`mock provider -> nba-sync -> Supabase -> /api routes -> frontend`

## 1) Configure environment

Create `.env.local` (or export env vars) with at least:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
USE_MOCK_DATA=true
```

`NBA_API_KEY` is optional in mock mode.

## 2) Run sync in mock mode

Trigger the existing sync endpoint (same flow used in production):

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "x-cron-key: $CRON_SECRET"
```

Or run from Admin Sync button (it uses `/api/sync`).

## 3) Expected behavior

With `USE_MOCK_DATA=true`, sync will:

- generate realistic games for the sync date window
- sync multi-team rosters into `players`
- sync player game logs with **30+ historical games per player**
- compute/update `player_metrics`
- invalidate API caches so `/api/games`, `/api/players`, `/api/metrics` reflect fresh mock data

## 4) Switching back to real API

Set:

```bash
USE_MOCK_DATA=false
NBA_API_KEY=your-api-sports-key
```

Then run sync again normally.
