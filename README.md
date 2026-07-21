# Envoraicms

> A modern, AI-assisted open-source CMS for content and news publishing. Next.js 15 + PostgreSQL.

WordPress-style install: enter DB credentials, finish the `/install` wizard. The rest happens in the admin panel — no code edits, no config files to hunt down.

**Status:** Active development. Production-tested but APIs may shift before 1.0.
**Live example:** [techawave.com](https://techawave.com)  / [vitenhelse.com](https://vitenhelse.com)

---

## What it does

Once a cron job is configured, Envoraicms finds trending topics (via SerpAPI Google Trends or NewsNow), turns them into article ideas with a meta-AI, writes 700–1000 word HTML bodies with a content-AI (Gemini / OpenAI / Anthropic — pick per role), optionally generates cover images via fal.ai, publishes them with SEO JSON-LD, and pings Google Search Console — fully automated, no human in the loop.

Every step is observable in `/admin/drafts`, `/admin/cronjobs`, `/admin/indexing`, `/admin/logs` and overridable per cron job: trend window, ideation batch size, publish staggering, per-category quotas, prompt templates.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- A server you control (VPS, bare metal, hosting panel like Hestia / Vesta / cPanel — anything that supports `git clone` + PM2)
- 512 MB RAM minimum

---

## Install

### 1. Clone the repo

`main` always tracks the latest released tag, so a fresh clone gives you the current stable. Don't download a zip — the in-app updater needs a `.git/` directory to fetch new releases.

**Hosting panel with a pre-made document root** (cPanel / Hestia / Plesk):

```bash
cd /var/www/example.com/public_html   # whatever your panel gave you
git clone https://github.com/enveryurtsever/envoraicms.git .
```

The trailing `.` clones the repo **into** the current directory instead of a nested `envoraicms/` subfolder. The folder must be empty first; move any placeholder files out of the way.

**Bare VPS where you pick the path:**

```bash
sudo mkdir -p /var/www/envoraicms
sudo chown $USER:$USER /var/www/envoraicms
git clone https://github.com/enveryurtsever/envoraicms.git /var/www/envoraicms
cd /var/www/envoraicms
```

> Don't run `git clone <url>` with no destination — that creates a nested `envoraicms/` subfolder inside your current directory.

### 2. Configure environment

```bash
cp .env.example .env.local
nano .env.local
```

Set these values:

```env
DB_HOST=localhost
DB_NAME=envoraicms
DB_USER=envoraicms
DB_PASSWORD='your-strong-password'      # wrap in single quotes; safest for &, *, :, $, #
SITE_URL=https://example.com            # your domain — also drives the PM2 app name
PORT=3002                               # any free port; use different values per install
NODE_ENV=production
UPDATER_ENABLED=true
```

> `DB_PASSWORD` must be in single quotes if it contains shell-special characters. dotenv reads everything after the first `=`, so quotes prevent later issues.

### 3. Create the Postgres role + database

`CREATE DATABASE` alone isn't enough — `npm run migrate` will fail with "role does not exist" if you skip the user:

```bash
sudo -u postgres psql <<'EOF'
CREATE USER envoraicms WITH PASSWORD 'your-strong-password';
CREATE DATABASE envoraicms OWNER envoraicms;
GRANT ALL PRIVILEGES ON DATABASE envoraicms TO envoraicms;
EOF
```

`<<'EOF'` (single-quoted heredoc) prevents bash from interpreting `$`, `&`, `*` in the password before passing it to `psql`. These credentials must match what you wrote in `.env.local`.

Quick sanity check before continuing:

```bash
PGPASSWORD='your-strong-password' psql -h localhost -U envoraicms -d envoraicms -c '\conninfo'
```

`You are connected to database "envoraicms"…` means you're good.

### 4. Install dependencies, migrate, build

```bash
npm ci
npm run migrate
npm run build
```

`npm run migrate` applies [`deploy/schema.sql`](deploy/schema.sql) and is idempotent — safe to re-run any time. Run it **before** `npm run build`; the build prerenders routes that hit the DB.

### 5. Start with PM2

```bash
npm i -g pm2
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup    # follow the printed instructions to auto-start on reboot
```

The PM2 app name comes from `SITE_URL` (hostname, `www.` stripped), so multi-site hosts get distinct entries in `pm2 list` — e.g. `example.com`, `techawave.com`. Override with `PM2_APP_NAME` if you prefer a fixed name.

### 6. Reverse proxy

On a hosting panel, set the domain → backend port routing through the panel UI (Hestia: Web → Edit → Proxy Template = `nodeport`, Backend Port = whatever your `PORT` is).

Bare nginx vhost:

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    ssl_certificate     /etc/ssl/example.com.pem;
    ssl_certificate_key /etc/ssl/example.com.key;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /_next/static/ {
        alias /var/www/envoraicms/.next/static/;
        expires max;
    }
    location /Upload/ {
        alias /var/www/envoraicms/public/Upload/;
        expires max;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> Always forward `X-Real-IP` and `X-Forwarded-For`. The admin login's brute-force guard derives the client IP from these; without them every request looks like `127.0.0.1` and a single bad actor can lock out everyone.

### 7. Run the /install wizard

Open `https://example.com/install` (or `http://server:PORT/install`). The wizard:

1. Verifies the DB connection.
2. Generates a session signing secret.
3. Writes the initial `Settings` row (site name, URL, language, target country).
4. Seeds the default AI prompt templates.
5. Creates your admin user.
6. Adds a placeholder `General` category so the homepage isn't empty.

It drops you straight into `/admin` when done.

### 8. First steps in /admin

1. **Settings → General** — confirm Site language and Target country. These drive every AI prompt + every news / trend lookup.
2. **API Keys** — add at least one text-AI provider (Gemini is cheapest) and a trend or news source (SerpAPI for trends, NewsNow for ready-made news).
3. **Categories** — add the topics your site covers.
4. **Cron Jobs** — create your first cron. Article + Router mode is the easiest start: it auto-routes trending queries into your active categories.

Within 15 minutes of the first cron tick, drafts appear and start expanding into articles.

---

## Updates

After install, future releases apply in one click from `/admin/system/update`:

1. The updater takes a DB + env backup under `backups/`.
2. Pulls the latest release tag, runs `npm ci`, `npm run migrate`, `npm run build`, then `pm2 reload <your-app>`.
3. If any step fails it **auto-rolls back** to the previous version so the site keeps serving.

For headless / scripted environments, the same steps by hand (replace `<app>` with your name from `pm2 list`):

```bash
cd /var/www/envoraicms
git fetch --tags
git reset --hard <latest-tag>
npm ci --include=dev
npm run migrate
npm run build
pm2 reload <app>
```

> Migrate **before** build. The build prerenders DB-bound routes; a release that adds a new column will explode at build time if the schema isn't up-to-date.

---

## Troubleshooting

**`fatal: detected dubious ownership in repository`** — PM2 runs as root but `.git/` is owned by a regular user. One-time fix:

```bash
git config --global --add safe.directory /var/www/envoraicms
```

The in-app updater bypasses this with an inline flag from v1.3.2 on; the line above only matters for git commands you type manually.

**`password authentication failed for user "..."`** — Postgres rejected your credentials. Either the role doesn't exist (step 3 skipped) or the password in `.env.local` doesn't match what's stored. Test:

```bash
PGPASSWORD='your-password' psql -h localhost -U envoraicms -d envoraicms -c '\conninfo'
```

If that fails too, reset: `sudo -u postgres psql -c "ALTER USER envoraicms WITH PASSWORD 'new-pw';"` and put the same value in `.env.local`.

**Site shows another install's content** — your reverse proxy is routing the domain to the wrong backend port. Confirm with `ss -lntp | grep :YOUR_PORT`, then check the nginx `proxy_pass` for this domain points there. On panels, the setting is the Backend Port in the domain's proxy template.

**`column "X" does not exist` during build** — you ran `npm run build` before `npm run migrate`. Always migrate first.

**`sharp` won't install (Linux ARM / Alpine)** — `npm rebuild sharp`.

**Cron not running** — check server logs for `[scheduler] in-process tick every 60s`. If missing, either `SCHEDULER_DISABLED=1` is set or `instrumentation.ts` didn't build.

**Admin login locks out everyone after one bot scan** — the reverse proxy isn't forwarding the real client IP. Add `X-Real-IP` / `X-Forwarded-For` headers in the proxy config.

---

## External services

You can run a useful site with **just Postgres + one AI provider key** (Gemini's free tier is enough to test). Everything else is incremental. All credentials live in `/admin/api-keys` and `/admin/googlekit` — never in env.

**AI providers** (pick one per role)

| Provider | Used for |
|---|---|
| [Google Gemini](https://gemini.google.com/) | Meta + content AI (default; cheapest) |
| [OpenAI](https://platform.openai.com/) | Meta + content AI |
| [Anthropic Claude](https://www.anthropic.com/api) | Meta + content AI |
| [fal.ai](https://fal.ai/) | Cover image generation (optional) |

**Trend / news sources**

| Provider | Used for |
|---|---|
| [SerpAPI](https://serpapi.com/) | Google Trends — seed for article ideation |
| [NewsNow](https://rapidapi.com/rphrp1985/api/newsnow) | News article ingest (separate path) |
| [NewsAPI.ai](https://newsapi.ai/) | Drop-in alternative to NewsNow |

**Google services** (admin-managed)

| Service | Used for |
|---|---|
| [Search Console Indexing API](https://developers.google.com/search/apis/indexing-api) | Auto-submit new URLs on publish |
| [Analytics 4](https://analytics.google.com/) | Visitor analytics |
| [Tag Manager](https://tagmanager.google.com/) | Tag container |
| [Search Console](https://search.google.com/search-console) | Site verification |
| [AdSense](https://www.google.com/adsense/) | Ads (manual slots + Auto Ads) |

---

## Features

- Two parallel pipelines: AI-generated articles (SerpAPI → AI) and news rewrites (NewsNow → AI)
- Router mode distributes trends across active categories with per-category quotas
- Configurable publish staggering, batch sizes, trend windows, prompt templates
- Auto-refill: drained queue triggers ideation on its own
- Three themes (Editorial Grid / Cover Mosaic / Broadsheet); switch in one click
- Per-site brand colors editable from `/admin/themes`; light / dark / system color modes
- Authors with bios, avatars, per-author archives
- Site Language drives `<html lang>`, JSON-LD `inLanguage`, OpenGraph, news sitemap, AND the language all AI content is written in
- Per-page metadata + OpenGraph + Twitter cards + `NewsArticle` / `BreadcrumbList` / `WebSite` / `Organization` JSON-LD
- Unified `/sitemap.xml` with image and Google News markup for last-48h items
- RSS per category, `robots.txt`, `llms.txt`
- Audit log of admin actions
- AES-GCM encrypted sessions + brute-force guard (5 failed logins / 15 min IP lockout)
- In-process scheduler every 60s — no external cron required
- Auto-rollback in the in-app updater if a release fails to deploy

---

## Configuration (env vars)

Almost everything is in the database, edited from `/admin/settings`. The only env vars:

| Variable               | Required | Purpose                                       |
|------------------------|----------|-----------------------------------------------|
| `DB_HOST`              | yes      | Postgres host                                 |
| `DB_NAME`              | yes      | Postgres database name                        |
| `DB_USER`              | yes      | Postgres user                                 |
| `DB_PASSWORD`          | yes      | Postgres password                             |
| `DB_PORT`              | no       | Default `5432`                                |
| `DB_SSL`               | no       | `require` for managed Postgres                |
| `PORT`                 | no       | Next listening port. Default `3000`           |
| `SITE_URL`             | recommended | Drives the PM2 app name; also used pre-install |
| `PM2_APP_NAME`         | no       | Override PM2 name (defaults to SITE_URL hostname) |
| `SCHEDULER_DISABLED`   | no       | Set to `1` to disable in-process cron         |
| `UPDATER_ENABLED`      | no       | `true` enables `/admin/system/update`         |
| `UPDATER_GITHUB_REPO`  | no       | `owner/repo` if you forked                    |

API keys for AI providers live in `/admin/api-keys`, not env.

---

## Project layout

```
app/
├── [category]/[slug]/   article detail
├── [category]/          category index + RSS
├── admin/               admin panel
├── api/                 REST endpoints (view counter, health, install)
├── install/             /install wizard
└── sitemap.xml/         unified sitemap

lib/
├── queries/             DB read paths (cached)
├── ingest/              AI ingest pipeline
├── indexing/            Google Indexing API client
├── auth/                session / role guards
├── system/              in-app updater (update-job, backup, version)
└── site-language.ts     BCP47 ↔ og:locale ↔ news:language helper

themes/                  classic, magazine, minimal
deploy/
├── schema.sql           single source-of-truth DB schema (idempotent)
├── nginx.conf           reference reverse-proxy config
└── ecosystem.config.js  PM2 config (reads .env.local for app name + port)
scripts/                 migrate.ts, seed-admin.ts, ingest-runner.ts
```

## Database schema

A single file is the source of truth: [`deploy/schema.sql`](deploy/schema.sql). Every `CREATE` is `IF NOT EXISTS`, every seed is `ON CONFLICT DO NOTHING`. Running it twice does nothing harmful.

Two ways to apply it:

- **/install wizard** runs schema.sql as its first step.
- **CLI** — `npm run migrate`. The in-app updater calls this between fetch and build.

When the schema evolves it's edited in place; no migration archive to maintain.

## Useful scripts

```bash
npm run dev               # next dev with HMR
npm run build             # production build
npm run start             # production server
npm run typecheck         # tsc --noEmit
npm run migrate           # apply deploy/schema.sql
npm run seed:admin        # interactive admin user creation
npm run ingest:runner     # one-shot cron tick
```

---

## Contributing

1. **Open an issue first** for anything beyond a one-line fix.
2. **Fork → branch → PR** against `main`.
3. **One concern per PR**; title + body explain *why*, not just *what*.
4. **Before pushing:** `npm run typecheck && npm run lint && npm run build`.
5. **No new dependencies** without discussion — the stack is intentionally small.

Help wanted: docs, themes, translations, accessibility audits, performance work on the ingest pipeline.

## Security

Don't open public issues for security bugs. Email the maintainer or use GitHub's private vulnerability reporting. Coordinated disclosure preferred; credit given.

## License

[GPL-3.0-or-later](LICENSE). Free to use, study, modify, redistribute — with the same freedoms preserved for downstream users.

## Acknowledgements

[Next.js](https://nextjs.org/), [React](https://react.dev/), [PostgreSQL](https://www.postgresql.org/), [Tailwind](https://tailwindcss.com/), [postgres.js](https://github.com/porsager/postgres), [sharp](https://sharp.pixelplumbing.com/), [DOMPurify](https://github.com/cure53/DOMPurify), and the WordPress project for showing what self-hosted, open publishing can be.
