import { NextResponse, type NextRequest } from "next/server";
import { checkIpGuard, isBackgroundFetch, resolveClientIp } from "@/lib/security/ip-guard";

// Three jobs: (1) temporarily ban IPs that request pages too quickly;
// (2) attach an x-pathname header to every request so the root layout can
// skip rendering site chrome on /admin routes; (3) redirect /admin/* requests
// with no session cookie to /admin/login. Real DB-level session validation
// happens in the admin layout — the cookie check here is just a fast bounce
// so unauthenticated traffic never reaches the server components.

const COOKIE_NAME = "envoraicms_admin";

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
