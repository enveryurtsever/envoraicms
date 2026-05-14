"use client";

import { useEffect } from "react";

// Writes the browser's IANA timezone (eg. "Europe/Istanbul") to the
// `admin_tz` cookie so server-rendered dashboard stats compute "today" etc.
// in the admin's local calendar. Re-renders the route once on first set so
// the freshly-cookied value is read by the next RSC pass.

const COOKIE = "admin_tz";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function TimezoneCookie() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const existing = readCookie(COOKIE);
    if (existing === tz) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(tz)}; path=/admin; max-age=${ONE_YEAR}; samesite=lax`;
    // First load with no cookie → server saw "UTC". Force a soft refresh
    // so the next render reads the just-written value.
    if (!existing) {
      window.location.reload();
    }
  }, []);
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}
