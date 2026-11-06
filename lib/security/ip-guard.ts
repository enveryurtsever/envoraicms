import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";

// Temporary per-IP bans for clients sending requests faster than a person can.
// Limits are per second, so a slow crawl or a busy reader is never banned.
//
// State lives in this process's memory. Under PM2 cluster mode each worker
// counts on its own, so a client spread evenly over N workers can make up to
// N x limit requests per second before every worker bans it.

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const ENABLED = process.env.IP_GUARD_ENABLED !== "false";
const PAGES_PER_SECOND = positiveIntEnv("IP_GUARD_PAGES_PER_SECOND", 5);
const SEARCHES_PER_SECOND = positiveIntEnv("IP_GUARD_SEARCHES_PER_SECOND", 3);
const BAN_MS = positiveIntEnv("IP_GUARD_BAN_MINUTES", 30) * 60_000;

const WINDOW_MS = 1000;
const CRAWLER_CACHE_MS = 24 * 60 * 60_000;
const MAX_TRACKED = 100_000;
// Next prefetches every link in the viewport, so one reader scrolling a
// homepage can send dozens of same-origin fetches. They count, but only a
// little. A bot can forge the headers that identify them, which is why this
// is a discount and not an exemption.
const BACKGROUND_FETCH_WEIGHT = 0.05;

// https://www.cloudflare.com/ips/ — a request arriving from one of these is
// the only case where the CF-Connecting-IP header can be trusted.
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];

// Loopback, private, link-local and carrier-grade NAT addresses identify a
// proxy, not a visitor. Banning one would lock out everyone behind it.
const NON_PUBLIC_RANGES = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
];

// A crawler proves its identity through reverse + forward DNS, which a
// spoofed User-Agent cannot fake.
const CRAWLER_DOMAINS = [
  "googlebot.com", "google.com", "search.msn.com", "applebot.apple.com",
  "yandex.ru", "yandex.net", "yandex.com", "baidu.com", "baidu.jp",
];

function stripMapped(ip: string): string {
  return ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4
    ? ip.slice(7)
    : ip;
}

function toBytes(rawIp: string): number[] | null {
  const ip = stripMapped(rawIp);
  const family = isIP(ip);
  if (family === 4) return ip.split(".").map(Number);
  if (family !== 6) return null;

  const [head, tail] = ip.split("%")[0]!.split("::");
  const parseGroups = (part: string | undefined) =>
    part
      ? part.split(":").flatMap((group) => {
          if (group.includes(".")) return group.split(".").map(Number);
          const value = parseInt(group, 16);
          return [value >> 8, value & 0xff];
        })
      : [];
  const start = parseGroups(head);
  const end = parseGroups(tail);
  return [...start, ...Array(16 - start.length - end.length).fill(0), ...end];
}

function inRanges(ip: string, ranges: string[]): boolean {
  const bytes = toBytes(ip);
  if (!bytes) return false;
  return ranges.some((range) => {
    const [network, prefix] = range.split("/");
    const networkBytes = toBytes(network!);
    if (!networkBytes || networkBytes.length !== bytes.length) return false;
    let bits = Number(prefix);
    for (let i = 0; bits > 0; i += 1, bits -= 8) {
      const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
      if ((bytes[i]! & mask) !== (networkBytes[i]! & mask)) return false;
    }
    return true;
  });
}

// One IPv6 host usually controls a whole /64, so that is the unit we ban.
function ipKey(ip: string): string {
  const bytes = toBytes(ip)!;
  return bytes.length === 4 ? bytes.join(".") : `${bytes.slice(0, 8).join(":")}/64`;
}

const ALLOWLIST = new Set(
  (process.env.IP_GUARD_ALLOWLIST ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => isIP(stripMapped(ip)))
    .map(ipKey),
);

// Returns the visitor's address, or null when it can't be identified safely.
// With null we skip the guard: failing open beats banning a whole proxy.
export function resolveClientIp(headers: Headers): string | null {
  // Our reverse proxy sets X-Real-IP and appends the peer to X-Forwarded-For.
  // Earlier X-Forwarded-For entries are client-controlled and can be forged.
  const peer =
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  if (!peer || !isIP(stripMapped(peer))) return null;

  const ip = inRanges(peer, CLOUDFLARE_RANGES)
    ? headers.get("cf-connecting-ip")?.trim()
    : peer;
  if (!ip || !isIP(stripMapped(ip)) || inRanges(ip, NON_PUBLIC_RANGES)) return null;
  return stripMapped(ip);
}

// Next strips its own Next-Router-Prefetch header and _rsc query param before
// middleware runs, so prefetches are recognized by the browser's fetch metadata.
export function isBackgroundFetch(headers: Headers): boolean {
  return (
    headers.get("sec-fetch-site") === "same-origin" &&
    headers.get("sec-fetch-dest") === "empty"
  );
}

type Counter = { windowEndsAt: number; pages: number; searches: number };

const counters = new Map<string, Counter>();
const bans = new Map<string, number>();
const verifiedCrawlers = new Map<string, number>();
const crawlerChecksInFlight = new Set<string>();

function evictExpired(map: Map<string, number>, now: number) {
  for (const [key, expiresAt] of map) {
    if (expiresAt <= now) map.delete(key);
  }
}

// A flood from many addresses must not be able to exhaust memory.
function enforceMemoryBound(now: number) {
  if (counters.size >= MAX_TRACKED) {
    for (const [key, counter] of counters) {
      if (counter.windowEndsAt <= now) counters.delete(key);
    }
    if (counters.size >= MAX_TRACKED) counters.clear();
  }
  if (bans.size >= MAX_TRACKED) {
    evictExpired(bans, now);
    for (const key of bans.keys()) {
      if (bans.size < MAX_TRACKED) break;
      bans.delete(key);
    }
  }
  if (verifiedCrawlers.size >= MAX_TRACKED) evictExpired(verifiedCrawlers, now);
}

const dnsResolver = new Resolver({ timeout: 2000, tries: 1 });

// true/false when DNS gave an answer; null when the lookup itself failed.
async function isVerifiedCrawler(ip: string): Promise<boolean | null> {
  try {
    const hostnames = await dnsResolver.reverse(ip);
    const expected = toBytes(ip)!.join(".");
    for (const hostname of hostnames) {
      const host = hostname.toLowerCase();
      if (!CRAWLER_DOMAINS.some((domain) => host.endsWith(`.${domain}`))) continue;
      const addresses =
        isIP(ip) === 4 ? await dnsResolver.resolve4(host) : await dnsResolver.resolve6(host);
      if (addresses.some((address) => toBytes(address)?.join(".") === expected)) return true;
    }
    return false;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "ENOTFOUND" || code === "ENODATA" ? false : null;
  }
}

function banUnlessCrawler(ip: string, key: string, reason: string) {
  if (crawlerChecksInFlight.has(key)) return;
  crawlerChecksInFlight.add(key);
  void isVerifiedCrawler(ip)
    .then((verified) => {
      const now = Date.now();
      if (verified === true) {
        verifiedCrawlers.set(key, now + CRAWLER_CACHE_MS);
      } else if (verified === false) {
        bans.set(key, now + BAN_MS);
        counters.delete(key);
        console.warn(`[ip-guard] banned ${ip} for ${BAN_MS / 60_000} min: ${reason}`);
      }
      // null: DNS is unavailable. Don't risk banning a real crawler; the next
      // request over the limit checks again.
    })
    .finally(() => crawlerChecksInFlight.delete(key));
}

export function checkIpGuard(
  ip: string,
  request: { isSearch: boolean; isBackgroundFetch: boolean },
): { blocked: false } | { blocked: true; retryAfterSec: number } {
  if (!ENABLED) return { blocked: false };

  const key = ipKey(ip);
  if (ALLOWLIST.has(key)) return { blocked: false };

  const now = Date.now();
  const banExpiresAt = bans.get(key);
  if (banExpiresAt !== undefined) {
    if (banExpiresAt > now) {
      return { blocked: true, retryAfterSec: Math.ceil((banExpiresAt - now) / 1000) };
    }
    bans.delete(key);
  }

  const crawlerExpiresAt = verifiedCrawlers.get(key);
  if (crawlerExpiresAt !== undefined && crawlerExpiresAt > now) return { blocked: false };

  enforceMemoryBound(now);

  let counter = counters.get(key);
  if (!counter || counter.windowEndsAt <= now) {
    counter = { windowEndsAt: now + WINDOW_MS, pages: 0, searches: 0 };
    counters.set(key, counter);
  }

  const weight = request.isBackgroundFetch ? BACKGROUND_FETCH_WEIGHT : 1;
  counter.pages += weight;
  if (request.isSearch) counter.searches += weight;

  if (counter.searches > SEARCHES_PER_SECOND) {
    banUnlessCrawler(ip, key, `over ${SEARCHES_PER_SECOND} searches/sec`);
  } else if (counter.pages > PAGES_PER_SECOND) {
    banUnlessCrawler(ip, key, `over ${PAGES_PER_SECOND} pages/sec`);
  }
  return { blocked: false };
}
