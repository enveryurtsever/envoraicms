import { NextResponse, type NextRequest } from "next/server";
import { checkIpGuard, isBackgroundFetch, resolveClientIp } from "@/lib/security/ip-guard";
import { matchUrlRule } from "@/lib/security/url-rules";
import { stripWww } from "@/lib/site-url";

// Five jobs: (1) temporarily ban IPs that request pages too quickly; (2) send
// www hosts to the same host without www; (3) answer retired
// article URLs with 301 or 410; (4) attach an x-pathname header to every request
// so the root layout can skip rendering site chrome on /admin routes; (5) redirect /admin/* requests
// with no session cookie to /admin/login. Real DB-level session validation
// happens in the admin layout — the cookie check here is just a fast bounce
// so unauthenticated traffic never reaches the server components.

const COOKIE_NAME = "envoraicms_admin";

const SITE_ORIGIN = process.env.SITE_URL ? stripWww(process.env.SITE_URL) : null;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const hasCookie = req.cookies.has(COOKIE_NAME);

  // Signed-in admins skip the guard so a ban on a shared IP can't lock them
  // out of the panel. A forged cookie only reaches the DB session check.
  if (!(isAdmin && hasCookie)) {
    const ip = resolveClientIp(req.headers);
    if (ip) {
      const guard = checkIpGuard(ip, {
        isSearch: pathname === "/search" || pathname.startsWith("/search/"),
        isBackgroundFetch: isBackgroundFetch(req.headers),
      });
      if (guard.blocked) {
        return new NextResponse("Too many requests. Please try again later.", {
          status: 429,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "Retry-After": String(guard.retryAfterSec),
          },
        });
      }
    }
  }

  const host = req.headers.get("host");
  if (host?.toLowerCase().startsWith("www.")) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return new NextResponse(null, {
      status: 301,
      headers: { Location: `${proto}://${host.slice(4)}${pathname}${req.nextUrl.search}` },
    });
  }

  const rule = matchUrlRule(pathname);
  if (rule?.status === 301 && rule.target) {
    // Next rejects a relative Location from middleware.
    const location = new URL(rule.target, SITE_ORIGIN ?? req.nextUrl.origin);
    return new NextResponse(null, { status: 301, headers: { Location: location.toString() } });
  }
  if (rule?.status === 410) {
    return new NextResponse("This page has been permanently removed.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isAdmin && !isLogin) {
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // The IP guard uses node:dns to verify search engine crawlers.
  runtime: "nodejs",
  matcher: [
    // Every path except Next internals and static assets. The
    // `google[a-z0-9]+\.html` carve-out keeps Search Console / Indexing API
    // ownership-verification files (served from public/) from colliding
    // with the dynamic root route.
    "/((?!_next/|favicon.ico|Upload/|Content/|api/|google[a-z0-9]+\\.html).*)",
    "/admin/:path*",
  ],
};
