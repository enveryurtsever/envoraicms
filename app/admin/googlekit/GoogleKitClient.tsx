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
    <>
      <HelpCallout title="How to get a GA4 Measurement ID">
        <ol>
          <li>
            Open{" "}
            <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">
              Google Analytics
            </a>{" "}
            and create (or pick) a property for this site.
          </li>
          <li>
            Inside the property, go to <em>Admin → Data streams</em> and click{" "}
            <em>Add stream → Web</em>. Paste your site URL.
          </li>
          <li>
            Copy the <strong>Measurement ID</strong> shown at the top of the
            stream details &mdash; it starts with <code>G-</code>.
          </li>
          <li>Paste it below and save. Tracking starts on the next page view.</li>
        </ol>
      </HelpCallout>
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
    </>
  );
}

function GtmTab({ settings }: { settings: Settings }) {
  return (
    <>
      <HelpCallout title="How to get a GTM Container ID">
        <ol>
          <li>
            Open{" "}
            <a href="https://tagmanager.google.com/" target="_blank" rel="noopener noreferrer">
              Google Tag Manager
            </a>{" "}
            and create an account if you don't have one.
          </li>
          <li>
            Click <em>Create container</em>, give it your site name, choose{" "}
            <strong>Web</strong> as the target platform.
          </li>
          <li>
            Copy the container ID shown at the top right (it starts with{" "}
            <code>GTM-</code>) and paste it below.
          </li>
          <li>
            Save here — both the <code>&lt;head&gt;</code> snippet and the{" "}
            <code>&lt;noscript&gt;</code> fallback are injected automatically. Use
            GTM's own interface to publish any tags after that.
          </li>
        </ol>
        <p>
          <strong>Tip:</strong> only use GA + GTM together if you know what you're
          doing. If GTM already fires GA, fill in GTM only and leave the Analytics
          tab empty to avoid double-tracking.
        </p>
      </HelpCallout>
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
    </>
  );
}

function SearchConsoleTab({ settings }: { settings: Settings }) {
  return (
    <>
      <HelpCallout title="How to verify with Search Console">
        <ol>
          <li>
            Open{" "}
            <a href="https://search.google.com/search-console/welcome" target="_blank" rel="noopener noreferrer">
              Google Search Console
            </a>{" "}
            and click <em>Add property → URL prefix</em>. Paste your full site URL.
          </li>
          <li>
            On the verification screen choose <strong>HTML tag</strong>. Google
            shows a snippet like{" "}
            <code>&lt;meta name=&quot;google-site-verification&quot; content=&quot;...&quot; /&gt;</code>.
          </li>
          <li>
            Copy <strong>only</strong> the <code>content</code> value (the long
            string in quotes — don't paste the whole tag) into the field below and
            save.
          </li>
          <li>
            Back in Search Console, click <strong>Verify</strong>. Once it shows{" "}
            <em>Ownership verified</em>, go to the <em>Sitemaps</em> section and
            submit <code>/sitemap.xml</code> (see{" "}
            <a href="/admin/indexing">Search Console / Indexing</a> for the exact
            URL).
          </li>
        </ol>
      </HelpCallout>
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
    </>
  );
}

function AdSenseTab({ settings }: { settings: Settings }) {
  return (
    <>
      <HelpCallout title="How to set up AdSense">
        <ol>
          <li>
            Apply for{" "}
            <a href="https://www.google.com/adsense/start/" target="_blank" rel="noopener noreferrer">
              Google AdSense
            </a>{" "}
            with this site. Approval usually takes a few days — the site needs real
            content, a privacy policy, and decent traffic.
          </li>
          <li>
            Once approved, open <em>AdSense → Account → Account information</em> and
            copy your <strong>Publisher ID</strong> (looks like{" "}
            <code>ca-pub-1234567890123456</code>) into the field below.
          </li>
          <li>
            Save. The AdSense script is now injected on every page; placeholders
            under <a href="/admin/ads">Ad slots</a> become live ads automatically.
          </li>
          <li>
            Optional: enable <strong>Auto Ads</strong> below if you want Google to
            choose placements on its own, instead of (or in addition to) your manual
            slots.
          </li>
        </ol>
      </HelpCallout>
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
    </>
  );
}

function HelpCallout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div
        style={{
          fontSize: "0.88rem",
          lineHeight: 1.65,
          color: "#374151",
        }}
      >
        {children}
      </div>
    </div>
  );
}
