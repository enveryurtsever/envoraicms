# Envoraicms — Install

WordPress-style setup: you only enter DB credentials up front; everything
else (admin user, site name, default settings) is done through the
`/install` wizard. Themes, categories, ad zones, API keys are all managed
from the admin panel.

> **Install via `git clone`, not by uploading files.** The in-app updater at
> `/admin/system/update` runs `git fetch` + `git reset --hard <tag>` to pull
> new releases. A site installed via SFTP/zip has no `.git/` directory, so
> the updater can't operate and you'd need to repeat the upload by hand on
> every release.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- 512 MB RAM minimum (sharp + Next runtime)
- `git`, on the server itself

## Steps

### 1. Clone the repo

`main` always points at the latest released tag — every release is cut from
the tip of `main`, so a fresh `git clone` puts you on the latest version
with no `git checkout vX.Y.Z` step needed. The in-app updater at
`/admin/system/update` then advances you to future releases.

Two common shapes for the clone, depending on how your hosting panel
exposes the document root:

**Hosting panel with a pre-made document root** (cPanel, Plesk, generic
\"public_html\" layouts). Clone the repo's contents directly into that
folder — the trailing `.` tells git \"into the current directory, not a
nested subfolder\":

```bash
cd /var/www/techawave.com/public_html   # whatever your panel gave you
git clone https://github.com/enveryurtsever/envoraicms.git .
```

The directory must be empty (or contain only `.` / `..`) for this to work.
If your panel pre-populated it with placeholder files (`index.html`,
`cgi-bin/`, …), move them out of the way first.

**Bare VPS, you pick the path.** Pass the destination as the second
argument; git creates it for you (no nested subfolder):

```bash
sudo mkdir -p /var/www/envoraicms
sudo chown $USER:$USER /var/www/envoraicms
git clone https://github.com/enveryurtsever/envoraicms.git /var/www/envoraicms
cd /var/www/envoraicms
```

> Don't run `git clone <url>` with no destination — it creates a nested
> `envoraicms/` subfolder inside your current directory. The two forms
> above avoid that.

### 2. Configure DB

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Inside `.env.local`:

```
DB_HOST=localhost
DB_NAME=envoraicms
DB_USER=envoraicms
DB_PASSWORD='your-strong-password'   # wrap in single quotes; safest for `&`, `*`, `:`, `$`
# DB_PORT=5432            # optional
# DB_SSL=require          # for remote DB

# Public origin. Also drives the PM2 app name (hostname is extracted,
# leading "www." stripped) so multi-site hosts get distinct entries in
# `pm2 list` automatically. Set this BEFORE `pm2 start`.
SITE_URL=https://example.com

PORT=3002                 # Next.js listening port (pick anything free)

# Enable the /admin/system/update flow (off by default)
UPDATER_ENABLED=true
# UPDATER_GITHUB_REPO=enveryurtsever/envoraicms   # only if you forked

# Optional: pin the PM2 app name explicitly. If unset, it's derived from
# SITE_URL (or falls back to "envoraicms").
# PM2_APP_NAME=example.com
```

Create the database AND the role in Postgres (`CREATE DATABASE` alone
isn't enough — `npm run migrate` will fail with "role does not exist" or
"password authentication failed" if you skip the user):

```bash
sudo -u postgres psql <<'EOF'
CREATE USER envoraicms WITH PASSWORD 'your-strong-password';
CREATE DATABASE envoraicms OWNER envoraicms;
GRANT ALL PRIVILEGES ON DATABASE envoraicms TO envoraicms;
EOF
```

The `<<'EOF'` heredoc (with single-quoted EOF) prevents bash from
interpreting `$`, `&`, `*` etc. inside the password before passing it to
`psql`. Match `DB_USER` / `DB_PASSWORD` in `.env.local` to what you set
here.

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

PM2 example for production (`deploy/ecosystem.config.js` is in the repo):

```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup     # follow the printed instructions to enable on boot
```

PM2 picks the app name from `SITE_URL` in `.env.local` (or `PM2_APP_NAME`
if set), so `pm2 list` shows each install under its domain — e.g.
`techawave.com` and `example.com` running side-by-side on the same box.
The in-app updater reads the same name when calling `pm2 reload`, so you
never need to edit `deploy/ecosystem.config.js` by hand.

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

nginx example (a fuller config that includes static-asset offload, FTS
`/search` rate-limiting, and a cache bypass for logged-in admins lives at
`deploy/nginx.conf`):

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    location / {
        proxy_pass http://127.0.0.1:<PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /Upload/ {
        alias /var/www/envoraicms/public/Upload/;
        expires 30d;
    }
}
```

> Always forward `X-Real-IP` and `X-Forwarded-For`. The admin login's
> brute-force guard derives the client IP from these; without them every
> request looks like it comes from `127.0.0.1` and a single bad actor can
> trip the 5-fail lockout for everyone.

Caddy (auto-HTTPS included):

```
example.com {
    reverse_proxy 127.0.0.1:<PORT>
}
```

## Updates

Once installed, future releases can be applied without SSH'ing in:

1. `/admin/system/update` → **Check now** → **Update to vX.Y.Z**.
2. The updater takes a DB + env backup under `backups/`, runs `git fetch
   --tags`, `git reset --hard <tag>`, `npm ci --include=dev`, `npm run
   migrate`, `npm run build`, then a graceful `pm2 reload <app>`. If any
   step fails, the updater **auto-rolls back** to the pre-update commit
   and pm2-reloads the old version, so the site keeps serving.
3. If the release notes mention an nginx change (rare), run
   `sudo nginx -t && sudo systemctl reload nginx` on the box. Everything
   else is in-process.

If the updater is disabled or fails for some reason, the same steps work
by hand. `<app>` is whatever your install resolved to from `SITE_URL` /
`PM2_APP_NAME` — check `pm2 list` if unsure:

```bash
cd /var/www/envoraicms       # or your install path
git fetch --tags
git reset --hard vX.Y.Z      # or `git pull` to track latest main
npm ci --include=dev
npm run migrate
npm run build
pm2 reload <app>
```

> Run `npm run migrate` BEFORE `npm run build`. The build prerenders
> static routes that hit the DB (e.g. `/robots.txt` → `getSettings()`); if
> a release adds a new column, building first will explode with "column
> does not exist". The in-app updater already does this order; do the
> same in manual recoveries.

### Behind a reverse proxy and running as root?

The updater process runs as whoever started PM2 — usually root. If you
cloned the repo as a regular user, root won't be able to operate on the
`.git/` directory and you'll see "fatal: detected dubious ownership". One
of these two lines fixes it permanently:

```bash
# Either: let root operate on this specific path
sudo git config --global --add safe.directory /var/www/envoraicms

# Or: just hand the .git/ to root (simplest if PM2 runs as root)
sudo chown -R root:root /var/www/envoraicms/.git
```

## Troubleshooting

- **DB connection error**: check `.env.local` values, that PostgreSQL is
  running, and whether `DB_SSL=require` is needed (remote DB).
- **`sharp` won't install (Linux ARM/Alpine)**: run `npm rebuild sharp`.
- **Cron not running**: is the line `[scheduler] in-process tick every 60s`
  present in server logs? If not, either `SCHEDULER_DISABLED` is set, or
  `instrumentation.ts` wasn't built.
- **Updater fails at `npm ci`**: pre-v1.1.2 the updater inherited
  `NODE_ENV=production` from PM2 and skipped devDependencies. Upgrade past
  v1.1.2 once by hand (`git reset --hard vLATEST && npm ci --include=dev
  && npm run migrate && npm run build && pm2 reload <app>`) and future
  updates work.
- **Admin login locks out everyone after one bot scans the path**: your
  reverse proxy isn't forwarding the real client IP. Add the
  `X-Real-IP` / `X-Forwarded-For` headers from the example config above.

## Layout

```
app/                Next 15 App Router
components/         Shared React components
lib/                Server-side logic (DB, ingest pipeline, queries)
themes/             Homepage templates (classic / magazine / minimal)
deploy/schema.sql   Single source-of-truth DB schema (idempotent)
deploy/nginx.conf   Reference reverse-proxy config
deploy/ecosystem.config.js   PM2 config (cluster, NODE_ENV=production)
public/Upload/      Uploaded media (everything except default-cover.jpg
                    is DB-bound user content)
scripts/            tsx-run tools (migrate, seed, runner)
```
