import "server-only";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/queries/settings";
import { isTextProviderName } from "@/lib/ingest/providers/text";

export type PreflightResult = {
  ok: boolean;
  settingsOk: boolean;
  apiKeysOk: boolean;
  /** Human-readable bullets of what's missing. Empty when ok. */
  missing: string[];
};

/** Validates that the install is configured well enough to run automation:
 *   - Settings row populated with site identity + AI provider choices.
 *   - At least one active text_ai key for each chosen provider. */
export async function getPreflight(): Promise<PreflightResult> {
  const missing: string[] = [];
  const settings = await getSettings();

  if (!settings.SiteName || settings.SiteName === "ENVORAICMS") {
    missing.push("Set the site name in Settings → General.");
  }
  if (!settings.SiteUrl || /^https?:\/\/localhost/.test(settings.SiteUrl)) {
    missing.push("Set the public site URL in Settings → General.");
  }
  if (!settings.Description) {
    missing.push("Add a site description in Settings → General.");
  }

  const metaProvider = isTextProviderName(settings.MetaProvider) ? settings.MetaProvider : null;
  const contentProvider = isTextProviderName(settings.ContentProvider)
    ? settings.ContentProvider
    : null;
  if (!metaProvider) missing.push("Choose a Meta AI provider in Settings → AI Providers.");
  if (!contentProvider) missing.push("Choose a Content AI provider in Settings → AI Providers.");
  const settingsOk = missing.length === 0;

  // We only check provider-key pairs that actually got selected.
  const providers = new Set<string>();
  if (metaProvider) providers.add(metaProvider);
  if (contentProvider) providers.add(contentProvider);

  let apiKeysOk = true;
  for (const p of providers) {
    const rows = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c
      FROM "ApiKeys"
      WHERE "Provider" = ${p}
        AND "Purpose"  = 'text_ai'
        AND "IsActive" = TRUE
        AND "IsDeleted" = FALSE
    `;
    if ((rows[0]?.c ?? 0) === 0) {
      apiKeysOk = false;
      missing.push(`Add an active ${p} API key (purpose: text_ai) in API Keys.`);
    }
  }

  return {
    ok: settingsOk && apiKeysOk,
    settingsOk,
    apiKeysOk,
    missing,
  };
}

/** Throws when preflight is not OK. Used by automation pipelines to short-
 *  circuit before they call paid AI APIs. */
export async function assertPreflightOk(): Promise<void> {
  const r = await getPreflight();
  if (!r.ok) {
    throw new Error(
      `Automation paused — configuration incomplete: ${r.missing.join(" ")}`,
    );
  }
}
