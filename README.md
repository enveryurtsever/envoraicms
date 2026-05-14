# Envoraicms

A modern, AI-assisted news / content CMS built on Next.js 15 and PostgreSQL. WordPress-style install: enter DB credentials, run the migrations, walk through the `/install` wizard — the rest happens in the admin panel.

## Highlights

- **AI ingest pipeline** — pulls trending queries (SerpAPI), turns them into article drafts, and expands drafts into 700–1000 word HTML bodies. Provider per role is configurable: Gemini, OpenAI, or Anthropic.
- **Editorial admin** — content CRUD, rich-text editor, draft queue, authors, categories, ads, links, prompts, cron jobs, audit log.
- **Three themes** — Editorial Grid (classic), Cover Mosaic (magazine), Broadsheet (minimal). Active theme switches in one click.
- **Brand colors** — primary / secondary colors are admin-editable and drive every Tailwind `brand` / `navy` utility plus the article body CSS.
- **Multi-language ready** — single Site Language setting drives `<html lang>`, JSON-LD `inLanguage`, OpenGraph `og:locale`, and the news sitemap.
- **SEO out of the box** — per-page metadata, OpenGraph + Twitter cards, `NewsArticle` / `BreadcrumbList` / `WebSite` / `Organization` JSON-LD, image dimensions, `citation` from upstream sources, speakable selectors.
- **One unified sitemap** at `/sitemap.xml` covering pages + categories + articles + Google News markup for last-48h items.
- **Google Search Console Indexing API** — automatic URL push on publish/update (service account + Owner permission).
- **Color modes** — light / dark / system; per-visitor preference cookie.

## Tech stack

- **Next.js 15** App Router, React 19, server components
- **PostgreSQL** 14+ via `postgres.js` (no ORM)
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
git clone <repo-url> envoraicms
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

## Configuration

Almost everything is in the database, edited from `/admin/settings`. The only env vars are:

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

## License

Proprietary — all rights reserved.
