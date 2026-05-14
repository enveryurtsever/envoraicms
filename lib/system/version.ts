import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ReleaseInfo = {
  tag: string;       // raw tag name from GitHub (eg "v1.1.0")
  version: string;   // tag with leading "v" stripped (eg "1.1.0")
  name: string;      // release name
  notes: string;     // release body (markdown)
  publishedAt: string | null;
  url: string;       // html_url
};

export type VersionStatus = {
  current: string;
  latest: ReleaseInfo | null;
  hasUpdate: boolean;
  fetchedAt: number;
  /** Set when the GitHub call failed; the client renders a soft warning. */
  warning?: string;
};

const REPO = process.env.UPDATER_GITHUB_REPO?.trim() || "enveryurtsever/envoraicms";
// Once-a-day check by default — keeps us well under GitHub's unauthenticated
// rate limit (60/hr per IP) even with many admin tabs open. The /update
// page's "Check now" button can force a refresh.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Failed lookups cache much shorter so a transient GitHub outage doesn't
// suppress retries for a full day.
const FAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

let cached: VersionStatus | null = null;

export async function getCurrentVersion(): Promise<string> {
  // Read at runtime so an in-place update reflects without restarting the
  // RSC module; falls back to "0.0.0" if package.json can't be read.
  try {
    const raw = await readFile(join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Strict semver-ish comparator. Returns >0 if a>b, <0 if a<b, 0 equal.
 *  Treats "1.2.3" parts as numbers; pre-release suffixes after "-" lose. */
export function compareSemver(a: string, b: string): number {
  const parse = (s: string) => {
    const [core] = s.split("-");
    return core.split(".").map((p) => Number.parseInt(p, 10) || 0);
  };
  const A = parse(a);
  const B = parse(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const d = (A[i] ?? 0) - (B[i] ?? 0);
    if (d !== 0) return d;
  }
  // Equal cores: a release without a "-suffix" outranks one with.
  const preA = a.includes("-");
  const preB = b.includes("-");
  if (preA && !preB) return -1;
  if (!preA && preB) return 1;
  return 0;
}

function stripV(tag: string): string {
  return tag.startsWith("v") || tag.startsWith("V") ? tag.slice(1) : tag;
}

async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: ctrl.signal,
      // We do our own caching; don't let Next.js memoize this on the data cache.
      cache: "no-store",
    });
    if (res.status === 404) return null; // no releases yet
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const j = (await res.json()) as {
      tag_name?: string;
      name?: string;
      body?: string;
      published_at?: string;
      html_url?: string;
      draft?: boolean;
      prerelease?: boolean;
    };
    if (!j.tag_name || j.draft || j.prerelease) return null;
    return {
      tag: j.tag_name,
      version: stripV(j.tag_name),
      name: j.name ?? j.tag_name,
      notes: j.body ?? "",
      publishedAt: j.published_at ?? null,
      url: j.html_url ?? `https://github.com/${REPO}/releases/tag/${j.tag_name}`,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function getVersionStatus(opts?: { force?: boolean }): Promise<VersionStatus> {
  const now = Date.now();
  if (!opts?.force && cached) {
    const age = now - cached.fetchedAt;
    const ttl = cached.warning ? FAIL_CACHE_TTL_MS : CACHE_TTL_MS;
    if (age < ttl) return cached;
  }

  const current = await getCurrentVersion();
  let latest: ReleaseInfo | null = null;
  let warning: string | undefined;
  try {
    latest = await fetchLatestRelease();
  } catch (err) {
    warning = err instanceof Error ? err.message : "release lookup failed";
  }

  const status: VersionStatus = {
    current,
    latest,
    hasUpdate: latest ? compareSemver(latest.version, current) > 0 : false,
    fetchedAt: now,
    warning,
  };
  cached = status;
  return status;
}

export function clearVersionCache(): void {
  cached = null;
}

export function getRepoSlug(): string {
  return REPO;
}
