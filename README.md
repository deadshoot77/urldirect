# Advanced Redirector (Next.js + Supabase + Netlify)

Redirect tool production-ready:
- `/` and `/:slug` redirects
- fallback to `DEFAULT_REDIRECT_URL`
- query params merge (incoming overrides existing keys, repeated incoming keys preserved)
- per-rule 301/302
- admin dashboard (`/admin`) with password + signed httpOnly cookie
- analytics (total, by slug, daily 7/30d, hourly, referers, devices, countries)
- CSV export
- server-side pixel/postback tracking (Meta, TikTok, Google webhook, custom postback)

## Environment Variables

Copy `.env.example` to `.env.local` and fill:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DEFAULT_REDIRECT_URL=https://example.com
DEFAULT_REDIRECT_STATUS=302

ADMIN_PASSWORD=ChangeThisPasswordNow
AUTH_SECRET=replace-with-a-very-long-random-secret-32-chars-min
IP_HASH_SALT=replace-with-another-random-secret-16-chars-min
```

Security:
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** (never expose to client).
- admin auth does **not** use Supabase Auth.

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

Admin login:
- `http://localhost:3000/admin/login`

## Supabase Setup (SQL)

1. Create a Supabase project.
2. Open `SQL Editor`.
3. Copy/paste the full file `db/migrations.sql`.
4. Run it once.

This migration creates:
- tables: `redirect_rules`, `logs`, `pixel_logs`
- indexes
- RLS enabled on all tables
- restrictive policies (`anon`/`authenticated` denied, `service_role` allowed)
- RPC `resolve_redirect(...)` (resolve + log in one DB round-trip)
- analytics RPCs (`stats_*`)
- seed rules: `promo`, `docs`, `partner`

## Supabase Keys

In Supabase dashboard:
- `Project Settings` -> `API`
- copy:
  - `Project URL` -> `SUPABASE_URL`
  - `anon public` -> `SUPABASE_ANON_KEY` (optional here)
  - `service_role secret` -> `SUPABASE_SERVICE_ROLE_KEY`

## Deploy Netlify + Supabase

Already configured:
- `netlify.toml`
- `@netlify/plugin-nextjs`

Steps:
1. Push repo to Git provider.
2. Import project in Netlify.
3. Add env vars in Netlify UI:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (optional)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEFAULT_REDIRECT_URL`
   - `DEFAULT_REDIRECT_STATUS`
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET`
   - `IP_HASH_SALT`
4. Deploy.

No filesystem DB is required.

## cURL Tests

### 1) Login admin

```bash
curl -i -c cookies.txt -X POST "http://localhost:3000/api/admin/login" \
  -H "content-type: application/json" \
  -d "{\"password\":\"ChangeThisPasswordNow\"}"
```

### 2) Create/Update rule

```bash
curl -i -b cookies.txt -X POST "http://localhost:3000/api/admin/rules" \
  -H "content-type: application/json" \
  -d "{
    \"slug\": \"offer2026\",
    \"target_url\": \"https://example.com/landing?src=redirector\",
    \"status_code\": 302,
    \"is_active\": true,
    \"pixel_enabled\": false
  }"
```

### 3) List rules

```bash
curl -b cookies.txt "http://localhost:3000/api/admin/rules"
```

### 4) Delete rule

```bash
curl -i -b cookies.txt -X DELETE "http://localhost:3000/api/admin/rules?slug=offer2026"
```

### 5) Redirect test (query merge)

```bash
curl -I "http://localhost:3000/promo?utm_source=ig&ref=123"
```

### 6) Export CSV

```bash
curl -L -b cookies.txt "http://localhost:3000/api/admin/export" -o logs.csv
```
