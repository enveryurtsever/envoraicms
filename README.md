# Envoraicms

> A modern, AI-assisted open-source CMS for content and news publishing — built on Next.js 15 and PostgreSQL.

WordPress-style install: enter DB credentials, run the migrations, finish the `/install` wizard. The rest happens in the admin panel — no code edits, no config files to hunt down.

**Status:** Active development. Production-tested but APIs may shift before 1.0.

---

## Why Envoraicms

- **AI-native, not AI-bolted-on.** A configurable ingest pipeline turns trending queries into article drafts and expands them into publish-ready HTML. Pick Gemini, OpenAI, or Anthropic per role (meta vs. content).
- **WordPress-style ops.** One installer, an admin panel for everything, no `wp-config.php` analogue. The database is the source of truth.
- **SEO out of the box.** Per-page metadata, OpenGraph + Twitter cards, `NewsArticle` / `BreadcrumbList` / `WebSite` / `Organization` JSON-LD, ImageObject dimensions, `citation` from upstream sources, speakable selectors — all without plugins.
- **Built for the AI search era.** Speakable specs, citation fields, and structured-data signals tuned for both classical SEO and generative-engine surfaces.
- **One sitemap.** `/sitemap.xml` covers pages + categories + articles + Google News markup for the last 48 hours.
- **Modern stack.** Next.js 15 App Router, React 19, server components, TypeScript end-to-end, no ORM bloat.

## Features

### Editorial
- Article CRUD with rich-text editor and AI-assisted meta fields (title, summary, keywords, image prompt)
- Draft queue managed by configurable cron jobs
- Authors with bios, avatars, and per-author archive pages
- Categories with header / footer / dropdown / sidebar menu flags
- Ad slots (manual placements + Google AdSense Auto Ads)
- Custom links and static pages
- Prompt templates for the AI pipeline, editable in the admin

### Themes & branding
- Three first-party themes: Editorial Grid, Cover Mosaic, Broadsheet — switch in one click
- Primary / secondary brand colors editable from the admin; drive every Tailwind `brand` / `navy` utility plus article-body CSS
- Light / dark / system color modes with a per-visitor preference cookie

### SEO & syndication
- Single Site Language setting drives `<html lang>`, JSON-LD `inLanguage`, OpenGraph `og:locale`, and the news sitemap language tag
- Unified `/sitemap.xml` with `<image:image>` per article and `<news:news>` for last-48h items
- `robots.txt` route, `llms.txt` support, RSS per category
- Google Analytics, Tag Manager, Search Console verification, AdSense — all admin-managed
- Google Indexing API integration: automatic URL push on publish / update, with a logs view and quota counters

### Operations
- Health endpoint at `/api/health`
- In-process scheduler runs every 60s (`instrumentation.ts` → `lib/ingest/scheduler.ts`); disable with `SCHEDULER_DISABLED=1`
- Idempotent migrations tracked in `_migrations`; safe to re-run on every deploy
- Audit log of admin actions

## Tech stack

- **Next.js 15** App Router, React 19, server components
- **PostgreSQL** 14+ via [`postgres.js`](https://github.com/porsager/postgres) (no ORM)
- **Tailwind CSS** with CSS-variable-backed brand colors
- **TypeScript** end-to-end
- **sharp** for image processing, **isomorphic-dompurify** for article HTML

## Requirements

- Node.js 20+
- PostgreSQL 14+
- 512 MB RAM minimum (sharp + Next runtime)

## Quick start

```bash
# 1. Clone
git clone https://github.com/enveryurtsever/envoraicms.git
cd envoraicms

# 2. Env
cp .env.example .env.local
# edit .env.local — fill in DB_HOST / DB_NAME / DB_USER / DB_PASSWORD

# 3. Create the DB
createdb envoraicms

# 4. Install + migrate
npm ci
npm run migrate

# 5. Build + start
npm run build
npm run start

# 6. Open the installer
# → http://localhost:3002/install
```

The wizard creates the admin user, writes the initial Settings row, and drops you into `/admin`.

Full step-by-step (PM2, reverse proxy, troubleshooting) lives in [INSTALL.md](INSTALL.md).

## Configuration

Almost everything is in the database, edited from `/admin/settings`. The only env vars you need:

| Variable               | Required | Purpose                                       |
|------------------------|----------|-----------------------------------------------|
| `DB_HOST`              | yes      | Postgres host                                 |
| `DB_NAME`              | yes      | Postgres database name                        |
| `DB_USER`              | yes      | Postgres user                                 |
| `DB_PASSWORD`          | yes      | Postgres password                             |
| `DB_PORT`              | no       | Default `5432`                                |
| `DB_SSL`               | no       | `require` for managed Postgres                |
| `PORT`                 | no       | Next listening port. Default `3000`           |
| `SITE_URL`             | no       | Used only as a fallback before install        |
| `SCHEDULER_DISABLED`   | no       | Set to `1` to disable in-process cron         |

API keys for AI providers (Gemini / OpenAI / Anthropic / SerpAPI) live in the admin panel under **API Keys** — not in env.

## Project layout

```
app/
├── [category]/[slug]/   article detail
├── [category]/          category index + RSS
├── admin/               admin panel (settings, contents, authors, themes, ...)
├── api/                 minimal REST endpoints (view counter, health, install)
├── install/             /install wizard
├── sitemap.xml/         unified sitemap (pages + categories + articles + news)
├── robots.ts            robots.txt route
└── layout.tsx           root layout + brand-color injection + theme switch

components/              shared UI (Header, Footer, ArticleCard, AdSlot, ...)
lib/
├── queries/             DB read paths (cached with React cache + unstable_cache)
├── ingest/              AI ingest pipeline (drafts → expand → publish)
├── indexing/            Google Indexing API client
├── auth/                session / role guards
├── seo.ts               metadata + JSON-LD builders
├── site-language.ts     BCP47 ↔ og:locale ↔ news:language helper
├── brand-colors.ts      hex → CSS variable helper
└── types.ts             Settings / Content / Category / ... TS types

themes/
├── classic/             Editorial Grid homepage
├── magazine/            Cover Mosaic homepage
├── minimal/             Broadsheet homepage
└── shared/              shared blocks used by every theme

deploy/
├── schema.sql           full base schema (idempotent)
├── migrations/          ordered, idempotent migrations
├── nginx.conf           example reverse-proxy config
└── ecosystem.config.js  example PM2 config

scripts/
├── migrate.ts           applies schema.sql + migrations/*.sql in order
├── seed-admin.ts        creates an admin user from CLI
└── ingest-runner.ts     manually trigger a cron pass
```

## Admin panel

Every feature is reachable from the admin sidebar at `/admin`:

- **Dashboard** — site-wide stats, recent activity
- **Contents** — articles CRUD, AI-assisted meta fields, draft queue
- **Drafts** — pending AI-generated drafts waiting on expansion
- **Authors / Categories / Links / Ads / Prompts**
- **Cron jobs** — schedule news + article pipelines per category
- **API keys** — provider keys for Gemini / OpenAI / Anthropic / SerpAPI
- **Themes** — switch theme + edit primary/secondary brand colors
- **Settings** — site name, language, SEO, social links, AI provider routing, llms.txt
- **Google Kit** — Analytics, Tag Manager, Search Console verification, AdSense
- **Search Console / Indexing** — service account + automatic URL submission + manual submit + logs
- **Logs** — audit trail of admin actions

## Useful scripts

```bash
npm run dev               # next dev (with HMR)
npm run build             # production build
npm run start             # production server
npm run typecheck         # tsc --noEmit
npm run lint              # next lint
npm run migrate           # schema.sql + migrations/*.sql
npm run seed:admin        # interactive admin user creation
npm run seed:authors      # seed sample authors
npm run ingest:runner     # one-shot cron tick (article + news pipelines)
```

## Database migrations

Migrations live in `deploy/migrations/` and run in filename order. `npm run migrate` applies `deploy/schema.sql` first on a fresh DB, then each pending migration. All migrations are idempotent and tracked in the `_migrations` table — safe to re-run on every deploy.

## Roadmap

- Plugin / extension API for third-party modules
- Multi-site support
- More themes
- Full localization of admin strings (currently English-only in the admin UI)
- Optional Docker image
- CLI tool for content import / export

Suggestions welcome — open an issue.

## Contributing

Contributions are welcome and encouraged. The short version:

1. **Open an issue first** for anything beyond a one-line fix — it's easier to align on scope before code is written.
2. **Fork → branch → PR** against `main`.
3. **Keep commits focused.** One concern per PR; the title + body should explain *why*, not just *what*.
4. **Run before pushing:**
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
5. **No new dependencies** without discussion. The stack is intentionally small.

Areas that always need help: docs, themes, translations, accessibility audits, performance work on the ingest pipeline.

## Reporting issues

- **Bugs / feature requests:** [GitHub Issues](https://github.com/enveryurtsever/envoraicms/issues). Include version, Node version, Postgres version, and a minimal repro.
- **Security vulnerabilities:** please **don't** open a public issue. Email the maintainer or use GitHub's private vulnerability reporting. Coordinated disclosure preferred; credit given.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) for the full text.

In the spirit of WordPress: free to use, study, modify, and redistribute — with the same freedoms preserved for downstream users.

## Acknowledgements

Standing on the shoulders of:

- [Next.js](https://nextjs.org/) — the framework
- [React](https://react.dev/) — the UI runtime
- [PostgreSQL](https://www.postgresql.org/) — the database
- [Tailwind CSS](https://tailwindcss.com/) — the styling
- [`postgres.js`](https://github.com/porsager/postgres) — the SQL client
- [sharp](https://sharp.pixelplumbing.com/) — image processing
- [DOMPurify](https://github.com/cure53/DOMPurify) — HTML sanitization
- The WordPress project — for showing what self-hosted, open publishing software can be
