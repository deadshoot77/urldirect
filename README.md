# Redirect + Tracking Dashboard (Next.js + Supabase + Netlify)

Advanced redirector with Rebrandly-like admin:
- short links at `/:slug`
- server-side tracking in `click_events`
- routing rules (device/country/language)
- deep links + retargeting scripts
- admin links list: `/admin/links`
- admin link detail + analytics report: `/admin/links/:id`
- monthly tracking limit banner + plan locks (`free` / `pro`)

## Features

- Redirect resolution
  - `/:slug` tries `short_links` first
  - fallback to legacy `redirect_rules` if slug not found
  - 301/302 per link
- Tracking
  - stores timestamp, slug, UA, referrer, hashed IP, geo headers, browser/device/platform, language, source, query params, UTM
  - unique click detection on `(link_id, ip_hash)` over 24h
- Limits/plan
  - `admin_settings.plan` controls locked analytics cards
  - `admin_settings.click_limit_monthly` + `limit_behavior` (`drop` or `minimal`)
  - admin red banner when limit reached

## Environment Variables

Use `.env.local`:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DEFAULT_REDIRECT_URL=https://example.com
DEFAULT_REDIRECT_STATUS=302

ADMIN_PASSWORD=ChangeThisPasswordNow
AUTH_SECRET=replace-with-a-very-long-random-secret-32-chars-min
IP_HASH_SALT=replace-with-another-random-secret-16-chars-min

CLICK_LIMIT_MONTHLY=10000
TRACKING_ENABLED_DEFAULT=true
TRACKING_LIMIT_BEHAVIOR=drop
ADMIN_PLAN_DEFAULT=free
```

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows CMD:

```bat
copy .env.example .env.local
npm run dev
```

## Supabase Setup (Required)

1. Open Supabase SQL Editor.
2. Run the full file `db/migrations.sql`.
3. Confirm tables exist:
   - legacy: `redirect_rules`, `logs`, `pixel_logs`
   - new: `short_links`, `click_events`, `admin_settings`

If `/api/admin/links` returns `Could not find table public.short_links`, the migration has not been applied yet.

## New Tables

- `short_links`
  - slug, destination_url, redirect_type, favorite/tags
  - `routing_rules` jsonb
  - `deep_links` jsonb
  - `retargeting_scripts` jsonb
- `click_events`
  - detailed click analytics fields
- `admin_settings`
  - singleton row (`id=1`) with `plan`, tracking limit, behavior

## Admin Routes

- `/admin/login`
- `/admin/links`
- `/admin/links/:id`

API:
- `GET/POST /api/admin/links`
- `GET/PATCH /api/admin/links/:id`
- `GET/PATCH /api/admin/settings`

## Manual Validation Flow

1. Login on `/admin/login`.
2. Open `/admin/links`.
3. Create a link via **New link**.
4. Click the short URL (`/:slug`) from another tab.
5. Open `/admin/links/:id`.
6. Check:
   - **Overall performance** increments
   - top sources/devices/countries update
   - Hours/Days/Months toggle works
7. Set `plan=free` in UI and verify locked cards display “Upgrade to reveal”.

## Build Check

```bash
npm run build
```

Build currently passes with the new admin pages and APIs.
