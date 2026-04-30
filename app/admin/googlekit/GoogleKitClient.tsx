"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/types";
import { Tabs } from "@/components/admin-ui/Tabs";
import { useToast } from "@/components/admin-ui/Toast";
import { saveGoogleKit } from "./actions";

export function GoogleKitClient({ settings }: { settings: Settings }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await saveGoogleKit(fd);
        toast.success("Google Kit saved");
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
          <h2>Google Kit</h2>
          <div className="subtitle">
            One place for Google services: Analytics, Tag Manager, Search Console, AdSense.
          </div>
        </div>
      </div>

      <form action={handleSubmit} autoComplete="off">
        <Tabs
          storageKey="adm:googlekit:tab"
          tabs={[
            {
              id: "analytics",
              label: "Analytics",
              hint: "GA4 measurement",
              content: <AnalyticsTab settings={settings} />,
            },
            {
              id: "gtm",
              label: "Tag Manager",
              hint: "GTM container",
              content: <GtmTab settings={settings} />,
            },
            {
              id: "search-console",
              label: "Search Console",
              hint: "Domain verification",
              content: <SearchConsoleTab settings={settings} />,
            },
            {
              id: "adsense",
              label: "AdSense",
              hint: "Publisher ID, auto ads",
              content: <AdSenseTab settings={settings} />,
            },
          ]}
        />

        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}

function AnalyticsTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>Google Analytics (GA4)</h3>
      <div className="form-row">
        <label htmlFor="GoogleAnalyticsID">Measurement ID</label>
        <div>
          <input
            id="GoogleAnalyticsID"
            name="GoogleAnalyticsID"
            type="text"
            defaultValue={settings.GoogleAnalyticsID ?? ""}
            placeholder="G-XXXXXXXXXX"
          />
          <small>
            When empty, no GA script is emitted. The site layout reads this value
            and injects the standard <code>gtag</code> snippet.
          </small>
        </div>
      </div>
    </div>
  );
}

function GtmTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>Google Tag Manager</h3>
      <div className="form-row">
        <label htmlFor="GoogleTagManagerID">Container ID</label>
        <div>
          <input
            id="GoogleTagManagerID"
            name="GoogleTagManagerID"
            type="text"
            defaultValue={settings.GoogleTagManagerID ?? ""}
            placeholder="GTM-XXXXXX"
          />
          <small>
            GTM container ID. Both the <code>&lt;head&gt;</code> snippet and
            the <code>noscript</code> iframe are emitted automatically.
          </small>
        </div>
      </div>
    </div>
  );
}

function SearchConsoleTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>Search Console verification</h3>
      <div className="form-row">
        <label htmlFor="SearchConsoleMeta">Verification meta content</label>
        <div>
          <input
            id="SearchConsoleMeta"
            name="SearchConsoleMeta"
            type="text"
            defaultValue={settings.SearchConsoleMeta ?? ""}
            placeholder="google-site-verification content"
          />
          <small>
            Paste only the <code>content</code> value. The meta tag is added
            to <code>&lt;head&gt;</code> automatically.
          </small>
        </div>
      </div>
    </div>
  );
}

function AdSenseTab({ settings }: { settings: Settings }) {
  return (
    <div className="card">
      <h3>Google AdSense</h3>
      <div className="form-row">
        <label htmlFor="AdsensePublisherID">Publisher ID</label>
        <div>
          <input
            id="AdsensePublisherID"
            name="AdsensePublisherID"
            type="text"
            defaultValue={settings.AdsensePublisherID ?? ""}
            placeholder="ca-pub-XXXXXXXXXXXXXXXX"
          />
          <small>
            AdSense Publisher ID (e.g. <code>ca-pub-1234567890123456</code>).
            When provided, <code>adsbygoogle.js</code> is added automatically.
          </small>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="AdsenseAutoAds">Auto Ads</label>
        <div>
          <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              id="AdsenseAutoAds"
              name="AdsenseAutoAds"
              type="checkbox"
              defaultChecked={settings.AdsenseAutoAds}
              className="switch"
            />
            Enable Google Auto Ads (automatic placements)
          </label>
          <small>
            When on, AdSense places ads across the page automatically.
            When off, only your manually-managed{" "}
            <a href="/admin/ads">ad slots</a> are served.
          </small>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="AdsenseExtraHead">Extra AdSense head code</label>
        <div>
          <textarea
            id="AdsenseExtraHead"
            name="AdsenseExtraHead"
            defaultValue={settings.AdsenseExtraHead ?? ""}
            placeholder='<meta name="google-adsense-account" content="ca-pub-..."> or any custom script'
            style={{ minHeight: 120 }}
          />
          <small>
            A custom snippet for rare cases. Injected into{" "}
            <code>&lt;head&gt;</code> verbatim; only admins can edit.
          </small>
        </div>
      </div>
    </div>
  );
}
