import { NextResponse, type NextRequest } from "next/server";

// Two jobs: (1) attach an x-pathname header to every request so the root
// layout can skip rendering site chrome on /admin routes; (2) redirect
// /admin/* requests with no session cookie to /admin/login. Real DB-level
// session validation happens in the admin layout — the cookie check here
// is just a fast bounce so unauthenticated traffic never reaches the
// server components.

const COOKIE_NAME = "envoraicms_admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  if (isAdmin && !isLogin) {
    const hasCookie = req.cookies.has(COOKIE_NAME);
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
  matcher: [
    // Every path except Next internals and static assets. The
    // `google[a-z0-9]+\.html` carve-out keeps Search Console / Indexing API
    // ownership-verification files (served from public/) from colliding
    // with the dynamic root route.
    "/((?!_next/|favicon.ico|Upload/|Content/|api/|google[a-z0-9]+\\.html).*)",
    "/admin/:path*",
  ],
};
