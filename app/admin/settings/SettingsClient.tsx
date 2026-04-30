"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Settings, Theme } from "@/lib/types";
import { Tabs } from "@/components/admin-ui/Tabs";
import { useToast } from "@/components/admin-ui/Toast";
import { AIInputRow } from "@/components/admin-ui/AIWand";
import { saveSettings } from "./actions";
import { SocialLinksField } from "./SocialLinksField";

export function SettingsClient({
  settings,
  themes,
}: {
  settings: Settings;
  themes: Theme[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await saveSettings(fd);
        toast.success("Settings saved");
        router.refresh();
      } catch (err) {
        toast.error(
          "Save failed",
          err instanceof Error ? err.message : "Unexpected error",
        );
      }
    });
  }

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Settings</h2>
          <div className="subtitle">
            Site-wide configuration. The Save button updates every tab at once.
          </div>
        </div>
      </div>

      <form action={handleSubmit} autoComplete="off">
        <Tabs
          storageKey="adm:settings:tab"
          tabs={[
            {
              id: "general",
              label: "General",
              hint: "Site name, URL, branding",
              content: <GeneralTab settings={settings} />,
            },
            {
              id: "seo",
              label: "SEO / Meta",
              hint: "Search & social cards",
              content: <SeoTab settings={settings} />,
            },
            {
              id: "theme",
              label: "Theme",
              hint: "Look & feel",
              content: <ThemeTab settings={settings} themes={themes} />,
            },
            {
              id: "social",
              label: "Social media",
              hint: "Footer / share links",
              content: <SocialTab settings={settings} />,
            },
            {
              id: "providers",
              label: "AI Providers",
              hint: "Meta / Content / Trends",
              content: <ProvidersTab settings={settings} />,
            },
            {
              id: "llms",
              label: "llms.txt",
              hint: "AI crawler summary",
              content: <LlmsTab settings={settings} />,
            },
          ]}
        />

        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}

function GeneralTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>General</h3>
      <Row label="Site name" name="SiteName" value={settings.SiteName} placeholder="Envoraicms" />
      <Row label="Site URL" name="SiteUrl" value={settings.SiteUrl} placeholder="https://example.com" hint="Public root URL of the site." />
      <AIInputRow
        label="Site title"
        name="Title"
        defaultValue={settings.Title}
        fieldKey="title"
        contextMap={{ title: "SiteName", short: "Description" }}
        hint="The default <title> tag and OG title."
      />
      <AIInputRow
        label="Description"
        name="Description"
        defaultValue={settings.Description}
        textarea
        fieldKey="desc"
        contextMap={{ title: "SiteName", short: "Description", keywords: "Keywords" }}
        hint="Used as the meta description on the homepage."
      />
      <AIInputRow
        label="Keywords"
        name="Keywords"
        defaultValue={settings.Keywords}
        fieldKey="keywords"
        contextMap={{ title: "SiteName", short: "Description" }}
        hint="Comma-separated. Optional."
      />

      <ImageUploadRow
        label="Site logo"
        name="SiteLogo"
        fileName="SiteLogoFile"
        value={settings.SiteLogo}
        hint="Uploaded files are stored as WebP under /Upload/. Leave the path field as-is to keep the current logo."
      />
      <ImageUploadRow
        label="Favicon"
        name="Favicon"
        fileName="FaviconFile"
        value={settings.Favicon}
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
        hint="Square icon (≥256×256 recommended). Saved as PNG under /Upload/. PNG/SVG/ICO accepted."
      />
      <ImageUploadRow
        label="Default cover image"
        name="CoverImage"
        fileName="CoverImageFile"
        value={settings.CoverImage}
        hint="Used for articles without an image and as the OG fallback."
      />
      <Row label="Content CDN URL" name="ContentUrl" value={settings.ContentUrl} hint="Optional CDN base for /Content/ assets." />
      <Row
        label="Ads enabled"
        name="AdsEnabled"
        type="switch"
        checked={settings.AdsEnabled}
        hint="Master switch. When off, every ad slot is hidden."
      />
    </div>
  );
}

function SeoTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>SEO / Meta</h3>
      <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0 }}>
        Google Analytics, Tag Manager, Search Console, and AdSense are managed in{" "}
        <Link href="/admin/googlekit">Google Kit</Link>.
      </p>
      <Row label="Bing verification" name="BingVerification" value={settings.BingVerification} hint="Paste only the meta `content` value." />
      <Row label="Twitter handle" name="TwitterHandle" value={settings.TwitterHandle} placeholder="@envoraicms" />
      <Row label="Default OG image" name="DefaultOgImage" value={settings.DefaultOgImage} hint="Falls back to the cover image when empty." />
      <Row label="Meta author" name="MetaAuthor" value={settings.MetaAuthor} />
      <Row label="Meta robots" name="MetaRobots" value={settings.MetaRobots ?? "index,follow"} hint="e.g. `index,follow` or `noindex,nofollow`." />
      <Row
        label="Extra <head> scripts"
        name="HeaderScripts"
        value={settings.HeaderScripts}
        textarea
        hint="Injected into <head> on every page. Low-level — use with care."
      />
    </div>
  );
}

function ThemeTab({ settings, themes }: { settings: Settings; themes: Theme[] }) {
  return (
    <div className="card">
      <h3>Theme &amp; appearance</h3>
      <div className="form-row">
        <label htmlFor="FK_ThemeID">Active theme</label>
        <select id="FK_ThemeID" name="FK_ThemeID" defaultValue={settings.FK_ThemeID ?? ""}>
          <option value="">(select)</option>
          {themes.map((t) => (
            <option key={t.ThemeID} value={t.ThemeID}>
              {t.ThemeName} ({t.ThemeSlug})
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="DefaultColorMode">Default color mode</label>
        <select
          id="DefaultColorMode"
          name="DefaultColorMode"
          defaultValue={settings.DefaultColorMode ?? "light"}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">Follow system</option>
        </select>
      </div>
      <Row
        label="Visitor toggle"
        name="AllowColorToggle"
        type="switch"
        checked={settings.AllowColorToggle}
        hint="Allow visitors to switch between light and dark."
      />
      <Row
        label="Top menu"
        name="ShowHeaderMenu"
        type="switch"
        checked={settings.ShowHeaderMenu}
        hint="Master switch for the category nav bar under the header. Off → bar hidden site-wide."
      />
      <Row
        label="Footer menu"
        name="ShowFooterMenu"
        type="switch"
        checked={settings.ShowFooterMenu}
        hint="Master switch for the categories + pages section in the footer. Off → only the brand strip remains."
      />
    </div>
  );
}

function ProvidersTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>AI provider routing</h3>
      <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0 }}>
        Pick which AI handles each role in the article pipeline. The active
        API key for the chosen provider is loaded from{" "}
        <a href="/admin/apikeys" style={{ color: "#2563eb" }}>API keys</a>.
        Add a key with <code>provider</code> matching the option you select
        and <code>purpose</code> = <code>text_ai</code>{" "}
        (or <code>trends_source</code> for the trends provider).
      </p>

      <div className="form-row">
        <label htmlFor="MetaProvider">Meta AI (titles, summaries, keywords)</label>
        <div>
          <select
            id="MetaProvider"
            name="MetaProvider"
            defaultValue={settings.MetaProvider ?? "gemini"}
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic Claude</option>
          </select>
          <small>
            Used during article ideation: turns SerpAPI trends into
            <code> {"{title, summary, keywords, imagePrompt}"}</code> drafts.
          </small>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="ContentProvider">Content AI (full article body)</label>
        <div>
          <select
            id="ContentProvider"
            name="ContentProvider"
            defaultValue={settings.ContentProvider ?? "gemini"}
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic Claude</option>
          </select>
          <small>
            Used during article expand: writes the 700-1000 word HTML body for
            each pending draft on every cron tick.
          </small>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="TrendsProvider">Trends provider</label>
        <div>
          <select
            id="TrendsProvider"
            name="TrendsProvider"
            defaultValue={settings.TrendsProvider ?? "serpapi"}
          >
            <option value="serpapi">SerpAPI</option>
          </select>
          <small>Source of trending queries for article ideation.</small>
        </div>
      </div>
    </div>
  );
}

function SocialTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>Social media</h3>
      <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0, marginBottom: "1rem" }}>
        Pick a platform, paste the public URL, and toggle visibility. Use the
        arrows to reorder; new entries appear at the bottom of the footer.
      </p>
      <SocialLinksField initial={settings.SocialLinks ?? []} />
    </div>
  );
}

function LlmsTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>llms.txt — AI crawler summary</h3>
      <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0 }}>
        The <code>/llms.txt</code> endpoint exposes a site summary to AI crawlers
        (Anthropic / OpenAI / Perplexity, etc.). When disabled it returns 404.
      </p>
      <Row
        label="llms.txt enabled"
        name="LlmsTxtEnabled"
        type="switch"
        checked={settings.LlmsTxtEnabled}
      />
      <AIInputRow
        label="Intro text"
        name="LlmsTxtIntro"
        defaultValue={settings.LlmsTxtIntro}
        textarea
        rows={6}
        fieldKey="short"
        contextMap={{ title: "SiteName", short: "Description", keywords: "Keywords" }}
        hint="Free-form text shown at the top of llms.txt."
      />
    </div>
  );
}

function ImageUploadRow({
  label,
  name,
  fileName,
  value,
  hint,
  accept = "image/png,image/jpeg,image/webp,image/avif,image/gif",
}: {
  label: string;
  name: string;
  fileName: string;
  value?: string | null;
  hint?: string;
  accept?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {value ? (
          <div style={{ marginBottom: "0.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              style={{
                maxHeight: 80,
                maxWidth: 240,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: 4,
              }}
            />
          </div>
        ) : null}
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={value ?? ""}
          placeholder="/Upload/..."
        />
        <div style={{ marginTop: "0.4rem" }}>
          <input
            id={fileName}
            name={fileName}
            type="file"
            accept={accept}
          />
        </div>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

function Row({
  label,
  name,
  value,
  type = "text",
  checked,
  textarea,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  value?: string | null;
  type?: "text" | "checkbox" | "switch" | "url" | "email" | "number";
  checked?: boolean;
  textarea?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {type === "checkbox" || type === "switch" ? (
          <input
            id={name}
            name={name}
            type="checkbox"
            defaultChecked={checked ?? false}
            className={type === "switch" ? "switch" : undefined}
          />
        ) : textarea ? (
          <textarea id={name} name={name} defaultValue={value ?? ""} placeholder={placeholder} />
        ) : (
          <input id={name} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} />
        )}
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
