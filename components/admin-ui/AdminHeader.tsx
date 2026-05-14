"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type AdminHeaderUser = {
  displayName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
};

type VersionPing = {
  hasUpdate: boolean;
  latest: { tag: string } | null;
};

export function AdminHeader({
  user,
  pageTitle,
}: {
  user: AdminHeaderUser;
  pageTitle?: string;
}) {
  const [now, setNow] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [versionPing, setVersionPing] = useState<VersionPing | null>(null);

  // Admin-only version check on mount. The server caches the GitHub call for
  // 24 hours, so this effectively runs at most once per day across all admin
  // tabs/sessions. No interval — the cached result is returned cheaply on
  // every page load until the TTL expires.
  useEffect(() => {
    if (user.role !== "admin") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/system/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as VersionPing;
        if (!cancelled) setVersionPing(data);
      } catch {
        /* offline / GitHub blip — silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  useEffect(() => {
    const fmt = () => {
      try {
        const d = new Date();
        const date = d.toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const time = d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
        setNow(`${date} · ${time}`);
      } catch {
        setNow("");
      }
    };
    fmt();
    const t = setInterval(fmt, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".adm-userpop")) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = (user.displayName || user.email)
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="adm-topbar">
      <div className="adm-topbar__left">
        {pageTitle ? <span className="adm-topbar__page">{pageTitle}</span> : null}
      </div>
      <div className="adm-topbar__right">
        {versionPing?.hasUpdate && versionPing.latest ? (
          <Link
            href="/admin/system/update"
            className="adm-update-pill"
            title="A new release is available"
          >
            <span className="adm-update-pill__dot" aria-hidden />
            <span>
              Update available · <strong>{versionPing.latest.tag}</strong>
            </span>
          </Link>
        ) : null}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="adm-topbar__visit"
          title="Open the public site in a new tab"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 4h6v6" />
            <path d="M10 14L20 4" />
            <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
          </svg>
          <span>View site</span>
        </a>
        <span className="adm-topbar__clock" suppressHydrationWarning>
          {now || "—"}
        </span>
        <div className="adm-userpop">
          <button
            type="button"
            className="adm-userpop__btn"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="adm-avatar" aria-hidden>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" />
              ) : (
                <span>{initials || "?"}</span>
              )}
            </span>
            <span className="adm-userpop__meta">
              <span className="adm-userpop__name">
                {user.displayName ?? user.email}
              </span>
              <span className="adm-userpop__role">{user.role}</span>
            </span>
            <span className="adm-userpop__caret" aria-hidden>▾</span>
          </button>
          {open ? (
            <div className="adm-userpop__menu" role="menu">
              <div className="adm-userpop__head">
                <div className="adm-userpop__name">
                  {user.displayName ?? user.email}
                </div>
                <div className="adm-userpop__email">{user.email}</div>
              </div>
              <Link href="/admin/settings" role="menuitem" onClick={() => setOpen(false)}>
                Settings
              </Link>
              <Link
                href={`/admin/users/${"me"}`}
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
                style={{ pointerEvents: "none", opacity: 0.5 }}
              >
                Profile (soon)
              </Link>
              <div className="adm-userpop__divider" />
              <Link href="/admin/logout" role="menuitem" className="adm-userpop__signout">
                Sign out
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
