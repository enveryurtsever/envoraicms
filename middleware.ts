import { NextResponse, type NextRequest } from "next/server";

// İki iş: (1) tüm isteklere x-pathname header'ı ekle (root layout admin
// yolunda site chrome'unu atlayabilsin diye). (2) /admin/* için session
// cookie yoksa login'e yönlendir (DB doğrulaması admin layout'ta yapılır).

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
    // Next internals ve statik varlıklar hariç tüm yollar.
    // `google[a-z0-9]+\.html` istisnası: Search Console / Indexing API
    // sahiplik doğrulama dosyaları (public/ içinden serve edilir, dynamic
    // route ile çakışmasın).
    "/((?!_next/|favicon.ico|Upload/|Content/|api/|google[a-z0-9]+\\.html).*)",
    "/admin/:path*",
  ],
};
