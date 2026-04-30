"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminIcon, type AdminIconKey } from "./Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: AdminIconKey;
  group?: string;
};

// Active state matched on the client so it always reflects the current URL,
// regardless of any RSC layout caching upstream.
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Clear the pending highlight as soon as the URL settles on the target.
  useEffect(() => {
    if (!pendingHref) return;
    if (pathname === pendingHref || pathname.startsWith(pendingHref + "/")) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="admin-nav">
      {items.map((item) => {
        const active = isActive(item.href);
        const pending = pendingHref === item.href && !active;
        const className = [active ? "active" : "", pending ? "pending" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={item.href}>
            {item.group ? <div className="nav-group">{item.group}</div> : null}
            <Link
              href={item.href}
              className={className}
              prefetch
              onClick={() => {
                if (!active) setPendingHref(item.href);
              }}
            >
              <span className="adm-nav-icon" aria-hidden>
                {pending ? <Spinner /> : <AdminIcon name={item.icon} />}
              </span>
              <span>{item.label}</span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: "adm-nav-spin 0.7s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes adm-nav-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
