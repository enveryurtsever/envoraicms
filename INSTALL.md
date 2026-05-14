# Envoraicms — Install

WordPress-style setup: you only enter DB credentials up front; everything
else (admin user, site name, default settings) is done through the
`/install` wizard. Themes, categories and ad zones are managed from the
admin panel.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- 512 MB RAM minimum (sharp + Next runtime)

## Steps

### 1. Extract files

Unpack the archive into the target directory on the server:

```bash
tar -xzf envoraicms-<date>.tar.gz
cd envoraicms
```

### 2. Configure DB

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Inside `.env.local`:

```
DB_HOST=localhost
DB_NAME=envoraicms
DB_USER=postgres
DB_PASSWORD=...
# DB_PORT=5432            # optional
# DB_SSL=require          # for remote DB

PORT=3002                 # Next.js listening port (pick anything free)
```

Create the database in Postgres:

```sql
CREATE DATABASE envoraicms;
```

### 3. Install dependencies

```bash
npm ci
```

You don't need to create tables manually — the `/install` wizard runs
`deploy/schema.sql` automatically on first boot. If you prefer a headless
setup (CI / Docker), run `npm run migrate` to apply the schema before
build; it executes the same SQL the wizard would.

### 4. Build + start

```bash
npm run build
npm run start
```

Next reads **`PORT` from `.env.local`** (falls back to 3000 if unset). You
only set the port in one place; no script or command changes are needed.

PM2 example for production:

```bash
pm2 start npm --name envoraicms -- start
pm2 save
```

### 5. Run the /install wizard

Open `http://<server>:<PORT>/install` in a browser (whatever `PORT` you set
in `.env.local`). The wizard will:

1. Apply `deploy/schema.sql` — creates every table, index, and seeds the
   three first-party themes and built-in ad zones.
2. Generate a session signing secret (stored in `Settings.SessionSecret`).
3. Insert the initial `Settings` row from the form.
4. Seed the default AI prompt templates.
5. Create your admin user.
6. Add a placeholder `General` category so the homepage isn't empty.

After it finishes you land in `/admin`.

### 6. (Optional) Cron

Cron jobs are triggered every 60s from inside the Next.js process
(`instrumentation.ts` → `lib/ingest/scheduler.ts`). To disable, add this
line to `.env.local`:

```
SCHEDULER_DISABLED=1
```

To trigger manually:

```bash
npm run ingest:runner
```

### 7. (Optional) Reverse proxy

Replace `<PORT>` with whatever you set in `.env.local`.

nginx example:

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    location / {
        proxy_pass http://127.0.0.1:<PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /Upload/ {
        alias /var/www/envoraicms/public/Upload/;
        expires 30d;
    }
}
```

Caddy (auto-HTTPS included):

```
example.com {
    reverse_proxy 127.0.0.1:<PORT>
}
```

## Troubleshooting

- **DB connection error**: check `.env.local` values, that PostgreSQL is
  running, and whether `DB_SSL=require` is needed (remote DB).
- **`sharp` won't install (Linux ARM/Alpine)**: run `npm rebuild sharp`.
- **Cron not running**: is the line `[scheduler] in-process tick every 60s`
  present in server logs? If not, either `SCHEDULER_DISABLED` is set, or
  `instrumentation.ts` wasn't built.

## Layout

```
app/                Next 15 App Router
components/         Shared React components
lib/                Server-side logic (DB, ingest pipeline, queries)
themes/             Homepage templates (classic / magazine / minimal)
deploy/schema.sql   Single source-of-truth DB schema (idempotent)
public/Upload/      Uploaded media (everything except default-cover.jpg
                    is DB-bound user content)
scripts/            tsx-run tools (migrate, seed, runner)
```
