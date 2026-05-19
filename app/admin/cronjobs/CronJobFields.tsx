"use client";

import { useState } from "react";
import type { Category, CronJob } from "@/lib/types";

const PRESETS: { label: string; cron: string; hint: string }[] = [
  { label: "Every 15 minutes", cron: "*/15 * * * *", hint: "Aggressive — best for breaking-news categories." },
  { label: "Every 30 minutes", cron: "*/30 * * * *", hint: "Balanced. Two ingest passes per hour." },
  { label: "Hourly (top of the hour)", cron: "0 * * * *", hint: "Default. Once an hour." },
  { label: "Every 2 hours", cron: "0 */2 * * *", hint: "Slow. For quiet niches." },
  { label: "Daily at 09:00", cron: "0 9 * * *", hint: "Once a day, server time." },
  { label: "Twice on weekdays (09:00 & 17:00)", cron: "0 9,17 * * 1-5", hint: "Morning and end-of-day on Mon–Fri." },
];

const NEWS_PROVIDERS = [
  {
    value: "newsnow",
    label: "NewsNow (RapidAPI)",
    hint: "Pulls top news per category from NewsNow. Gemini picks the site category later.",
  },
  {
    value: "newsapi",
    label: "newsapi (legacy)",
    hint: "Older NewsAPI integration. Uses a fixed site category — no AI category selection.",
  },
];

const TEXT_PROVIDERS = [
  { value: "gemini", label: "Google Gemini", hint: "Uses your active Gemini API key to humanize the article." },
  { value: "openai", label: "OpenAI", hint: "Uses your active OpenAI API key to humanize the article." },
  { value: "anthropic", label: "Anthropic Claude", hint: "Uses your active Anthropic API key to humanize the article." },
];

const IMAGE_PROVIDERS = [
  {
    value: "",
    label: "Passthrough (download original)",
    hint: "No AI image cost. Stores the source article's top image under /Upload/content/.",
  },
  {
    value: "falai",
    label: "fal.ai (flux/schnell)",
    hint: "Generates a fresh photojournalistic image. Costs API credit per article.",
  },
];

const NEWSNOW_CATEGORIES = [
  "BUSINESS",
  "ENTERTAINMENT",
  "GENERAL",
  "HEALTH",
  "NATION",
  "SCIENCE",
  "SPORTS",
  "TECHNOLOGY",
  "WORLD",
];

const TRENDS_WINDOWS: { value: string; label: string; hint: string }[] = [
  { value: "now 1-d", label: "Past 24 hours", hint: "Riding today's news cycle. Best for breaking-news categories." },
  { value: "now 7-d", label: "Past 7 days", hint: "Default. Fresh enough to feel timely, deep enough to dedupe." },
  { value: "today 1-m", label: "Past 30 days", hint: "Slower-moving niches. Less risk of repeating yesterday's piece." },
  { value: "today 3-m", label: "Past 90 days", hint: "Quarterly seasonality. Use when 30 days is too thin." },
  { value: "today 12-m", label: "Past 12 months", hint: "Evergreen seed. SerpAPI's own default." },
];

export function CronJobFields({
  initial,
  categories,
}: {
  initial?: CronJob;
  categories: Category[];
}) {
  const v = initial;
  const initialCron = v?.FrequencyCron ?? "0 * * * *";
  const matched = PRESETS.find((p) => p.cron === initialCron);

  const [kind, setKind] = useState<"news" | "article">(v?.Kind ?? "news");
  const [mode, setMode] = useState<"preset" | "custom">(matched ? "preset" : "custom");
  const [cron, setCron] = useState<string>(initialCron);
  const [imgProvider, setImgProvider] = useState<string>(v?.ImageAiProvider ?? "");
  const [newsProvider, setNewsProvider] = useState<string>(v?.NewsProvider ?? "newsnow");
  const activeImg = IMAGE_PROVIDERS.find((p) => p.value === imgProvider) ?? IMAGE_PROVIDERS[0];
  const activeNews = NEWS_PROVIDERS.find((p) => p.value === newsProvider) ?? NEWS_PROVIDERS[0];

  const cfg = v?.Config ?? {};

  const initialArticleMode: "single" | "router" =
    cfg.routerMode === true ? "router" : "single";
  const [articleMode, setArticleMode] = useState<"single" | "router">(
    initialArticleMode,
  );

  return (
    <>
      {v ? <input type="hidden" name="id" defaultValue={v.CronID} /> : null}
      <input type="hidden" name="Kind" value={kind} />

      <Section
        title="Job kind"
        description="News pipeline pulls articles from a news API and rewrites them. Article pipeline ideates evergreen topics from SerpAPI trends and writes them with the chosen AI."
      >
        <div className="form-row">
          <label>Type</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <ToggleChip active={kind === "news"} onClick={() => setKind("news")}>
              📰 News pipeline
            </ToggleChip>
            <ToggleChip active={kind === "article"} onClick={() => setKind("article")}>
              ✍️ Article pipeline
            </ToggleChip>
          </div>
        </div>
      </Section>

      <Section
        title="What is this job for?"
        description="Give it a name you'll recognize at a glance."
      >
        <div className="form-row">
          <label htmlFor="JobName">Name *</label>
          <div>
            <input
              id="JobName"
              type="text"
              name="JobName"
              required
              defaultValue={v?.JobName ?? ""}
              placeholder="e.g. Top Tech — every 15 min"
            />
            <small>Shown in the dashboard and logs. Just for humans.</small>
          </div>
        </div>
      </Section>

      <Section
        title="When should it run?"
        description="Pick a schedule. If none of these fit, switch to custom and write the cron expression yourself."
      >
        <div className="form-row">
          <label>Schedule mode</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <ToggleChip
              active={mode === "preset"}
              onClick={() => {
                setMode("preset");
                if (!matched) setCron(PRESETS[2].cron);
              }}
            >
              Preset
            </ToggleChip>
            <ToggleChip active={mode === "custom"} onClick={() => setMode("custom")}>
              Custom cron
            </ToggleChip>
          </div>
        </div>

        {mode === "preset" ? (
          <div className="form-row">
            <label htmlFor="cron-preset">Frequency</label>
            <div>
              <select
                id="cron-preset"
                value={PRESETS.find((p) => p.cron === cron)?.cron ?? PRESETS[2].cron}
                onChange={(e) => setCron(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <option key={p.cron} value={p.cron}>{p.label}</option>
                ))}
              </select>
              <small>{PRESETS.find((p) => p.cron === cron)?.hint ?? "—"}</small>
            </div>
          </div>
        ) : (
          <div className="form-row">
            <label htmlFor="FrequencyCronCustom">Cron expression</label>
            <div>
              <input
                id="FrequencyCronCustom"
                type="text"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="minute hour day month dayOfWeek"
                style={{ fontFamily: "ui-monospace, SF Mono, monospace" }}
              />
              <small>
                5 fields, POSIX cron. Example: <code>*/15 * * * *</code> means every 15 minutes.
              </small>
            </div>
          </div>
        )}

        <input type="hidden" name="FrequencyCron" value={cron} />
      </Section>

      {kind === "news" ? (
      <Section
        title="Where does the news come from?"
        description="Pick a news provider and tell it what to fetch. The site category is decided later by Gemini."
      >
        <div className="form-row">
          <label htmlFor="NewsProvider">News source</label>
          <div>
            <select
              id="NewsProvider"
              name="NewsProvider"
              value={newsProvider}
              onChange={(e) => setNewsProvider(e.target.value)}
            >
              {NEWS_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <small>{activeNews.hint}</small>
          </div>
        </div>

        {newsProvider === "newsnow" ? (
          <>
            <div className="form-row">
              <label htmlFor="NewsCategory">News category *</label>
              <div>
                <select
                  id="NewsCategory"
                  name="NewsCategory"
                  defaultValue={cfg.newsCategory ?? "TECHNOLOGY"}
                >
                  {NEWSNOW_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <small>The NewsNow upstream category. Different from your site categories.</small>
              </div>
            </div>
            <div className="form-row">
              <label>Location &amp; language</label>
              <div>
                <small>
                  Inherited from <strong>Settings → Target country</strong> and
                  <strong> Site language</strong>. Change them there to retarget
                  every news/article cron at once.
                </small>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="Page">Page</label>
              <div>
                <input
                  id="Page"
                  type="number"
                  name="Page"
                  min={1}
                  max={20}
                  defaultValue={cfg.page ?? 1}
                />
                <small>Pagination cursor. Most setups stay at 1.</small>
              </div>
            </div>
          </>
        ) : (
          <div className="form-row">
            <label htmlFor="FK_CatID">Fixed category *</label>
            <div>
              <select id="FK_CatID" name="FK_CatID" defaultValue={v?.FK_CatID ?? ""}>
                <option value="">— Choose a category —</option>
                {categories.map((c) => (
                  <option key={c.CatID} value={c.CatID}>
                    #{c.CatID} {c.CatName}
                  </option>
                ))}
              </select>
              <small>
                The legacy newsapi flow files every article under this single category.
              </small>
            </div>
          </div>
        )}
      </Section>
      ) : null}

      {kind === "article" ? (
      <Section
        title="What topic should the articles cover?"
        description="SerpAPI fetches trending queries; the active Meta AI rewrites each into a clean editorial title and (in router mode) routes it to the right category."
      >
        <input type="hidden" name="ArticleMode" value={articleMode} />

        <div className="form-row">
          <label>Routing mode</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <ToggleChip
              active={articleMode === "router"}
              onClick={() => setArticleMode("router")}
            >
              🧭 Router (auto, all categories)
            </ToggleChip>
            <ToggleChip
              active={articleMode === "single"}
              onClick={() => setArticleMode("single")}
            >
              📌 Single category (manual seed)
            </ToggleChip>
          </div>
        </div>

        {articleMode === "single" ? (
          <>
            <div className="form-row">
              <label htmlFor="SeedQuery">Seed topic *</label>
              <div>
                <input
                  id="SeedQuery"
                  type="text"
                  name="SeedQuery"
                  defaultValue={(cfg.seedQuery as string | undefined) ?? ""}
                  placeholder="e.g. AI productivity tools"
                />
                <small>The seed Google Trends will use to find related trending queries.</small>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="TargetCatID">Target site category *</label>
              <select
                id="TargetCatID"
                name="TargetCatID"
                defaultValue={(cfg.targetCatId as number | undefined) ?? v?.FK_CatID ?? ""}
              >
                <option value="">— Choose a category —</option>
                {categories.map((c) => (
                  <option key={c.CatID} value={c.CatID}>
                    #{c.CatID} {c.CatName}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <label htmlFor="MaxCategoriesPerTick">Categories per refill</label>
              <div>
                <input
                  id="MaxCategoriesPerTick"
                  type="number"
                  name="MaxCategoriesPerTick"
                  min={1}
                  max={30}
                  defaultValue={(cfg.maxCategoriesPerTick as number | undefined) ?? 8}
                />
                <small>
                  How many active categories to seed SerpAPI with on each refill.
                  Each one consumes a SerpAPI call — keep this within your quota.
                </small>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="PerCategoryTrendLimit">Trends per category</label>
              <div>
                <input
                  id="PerCategoryTrendLimit"
                  type="number"
                  name="PerCategoryTrendLimit"
                  min={3}
                  max={25}
                  defaultValue={(cfg.perCategoryTrendLimit as number | undefined) ?? 8}
                />
                <small>
                  Trends fetched per category; the meta AI then picks the strongest
                  ones across the pool and routes each idea to its best-fit category.
                </small>
              </div>
            </div>
            <div className="form-row" style={{ alignItems: "flex-start" }}>
              <label>How it works</label>
              <small style={{ color: "#475569", lineHeight: 1.45 }}>
                Each category's keywords (or name) seed a SerpAPI trend lookup.
                All trends are pooled and sent — tagged with their origin category —
                to the meta AI, which rewrites each into an editorial title and
                picks the best <code>categoryId</code> for it. Drafts land in the
                category the AI chose, not necessarily where the trend came from.
              </small>
            </div>
          </>
        )}

        <div className="form-row">
          <label htmlFor="IdeationBatchCount">Articles per ideation batch</label>
          <div>
            <input
              id="IdeationBatchCount"
              type="number"
              name="IdeationBatchCount"
              min={5}
              max={50}
              defaultValue={(cfg.ideationBatchCount as number | undefined) ?? 20}
            />
            <small>
              When pending drafts run out, this many fresh ideas are generated in
              one go. 20 is a good default; SerpAPI quota allowing.
            </small>
          </div>
        </div>

        <div className="form-row">
          <label>Trends geo &amp; language</label>
          <div>
            <small>
              Inherited from <strong>Settings → Target country</strong> and
              <strong> Site language</strong>. SerpAPI&apos;s <code>geo</code> and
              <code> hl</code> params follow those.
            </small>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="TrendsWindow">Trends window</label>
          <div>
            <select
              id="TrendsWindow"
              name="TrendsWindow"
              defaultValue={(cfg.trendsWindow as string | undefined) ?? "now 7-d"}
            >
              {TRENDS_WINDOWS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
            <small>
              {TRENDS_WINDOWS.find(
                (w) => w.value === ((cfg.trendsWindow as string | undefined) ?? "now 7-d"),
              )?.hint ?? ""}
            </small>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="Guidance">Tone / angle (optional)</label>
          <textarea
            id="Guidance"
            name="Guidance"
            defaultValue={(cfg.guidance as string | undefined) ?? ""}
            placeholder="e.g. focus on small-business audiences; avoid crypto angles."
            rows={3}
          />
        </div>

        <div className="form-row">
          <label>Auto-refill</label>
          <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              name="AutoRefill"
              defaultChecked={(cfg.autoRefill as boolean | undefined) ?? true}
              className="switch"
            />
            When pending drafts hit zero, automatically refill on the next tick
          </label>
        </div>

        <div className="form-row">
          <label htmlFor="PublishStaggerMinutes">Publish gap (minutes)</label>
          <div>
            <input
              id="PublishStaggerMinutes"
              type="number"
              name="PublishStaggerMinutes"
              min={0}
              max={120}
              step={1}
              defaultValue={(cfg.publishStaggerMinutes as number | undefined) ?? 15}
            />
            <small>
              Minutes between PublishDate timestamps of articles inserted in
              the same tick. 15 = each new piece looks 15 minutes older than
              the previous, so a batch trickles in instead of clustering. Set
              0 to publish all at the same instant.
            </small>
          </div>
        </div>
      </Section>
      ) : null}

      <Section
        title={kind === "article" ? "Output" : "How should it be rewritten?"}
        description={
          kind === "article"
            ? "Settings → AI Providers picks WHICH AI generates meta vs full content. Here you choose only how many articles per tick and whether to generate AI images."
            : "Gemini rewrites every fetched article. The image generator is optional."
        }
      >
        {kind === "news" ? (
          <div className="form-row">
            <label htmlFor="TextAiProvider">Text rewriter</label>
            <div>
              <select id="TextAiProvider" name="TextAiProvider" defaultValue={v?.TextAiProvider ?? "gemini"}>
                {TEXT_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <small>Humanizes the article and produces title, summary, body, keywords.</small>
            </div>
          </div>
        ) : null}

        <div className="form-row">
          <label htmlFor="ArticlesPerRun">Articles per tick</label>
          <div>
            <input
              id="ArticlesPerRun"
              type="number"
              name="ArticlesPerRun"
              min={1}
              max={20}
              defaultValue={v?.ArticlesPerRun ?? (kind === "article" ? 2 : 3)}
            />
            <small>
              How many drafts {kind === "article" ? "are expanded" : "are inserted"} on each
              cron firing. Smaller = more natural publishing cadence.
            </small>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="ImageAiProvider">Image generator</label>
          <div>
            <select
              id="ImageAiProvider"
              name="ImageAiProvider"
              value={imgProvider}
              onChange={(e) => setImgProvider(e.target.value)}
            >
              {IMAGE_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {kind === "article" && p.value === ""
                    ? "No AI image (cover fallback)"
                    : p.label}
                </option>
              ))}
            </select>
            <small>
              {kind === "article" && imgProvider === ""
                ? "Articles will fall back to Settings.CoverImage."
                : activeImg.hint}
            </small>
          </div>
        </div>
      </Section>

      <Section
        title="Ready?"
        description="Active jobs run on the 10-minute system tick. You can pause a job here without deleting it."
      >
        <div className="form-row">
          <label>Active</label>
          <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              name="IsActive"
              defaultChecked={v?.IsActive ?? true}
              className="switch"
            />
            Run this job on its schedule
          </label>
        </div>
      </Section>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h4
        style={{
          margin: "0 0 0.25rem",
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        {title}
      </h4>
      <p style={{ margin: "0 0 0.85rem", fontSize: "0.82rem", color: "#64748b" }}>
        {description}
      </p>
      {children}
    </section>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.4rem 0.9rem",
        border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
        background: active ? "#eff6ff" : "#fff",
        color: active ? "#1d4ed8" : "#475569",
        borderRadius: "999px",
        fontSize: "0.82rem",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
    >
      {children}
    </button>
  );
}
