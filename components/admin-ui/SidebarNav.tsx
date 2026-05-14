"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { AdminIcon, type AdminIconKey } from "./Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: AdminIconKey;
  group?: string;
};

/** Sidebar nav. The active class lands on a link only AFTER navigation
 *  completes (the URL pathname matches). While a click is in flight,
 *  TopProgress (and Next.js's built-in pending UI) signal the loading state.
 *  Optimistic on-click highlighting is intentionally not done here: the user
 *  asked the active state to reflect the actually-open page, not the click.
 *
 *  Prefetch strategy: hover-triggered. Eager prefetch on render fires
 *  ~15 RSC requests per admin entry, most of which never get clicked.
 *  Hovering pre-warms only the link the user is about to click. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const prefetched = useRef(new Set<string>());

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const warm = (href: string) => {
    if (prefetched.current.has(href)) return;
    prefetched.current.add(href);
    router.prefetch(href);
  };

  return (
    <nav className="admin-nav">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <span key={item.href}>
            {item.group ? <div className="nav-group">{item.group}</div> : null}
            <Link
              href={item.href}
              className={active ? "active" : ""}
              prefetch={false}
              onMouseEnter={() => warm(item.href)}
              onFocus={() => warm(item.href)}
              onTouchStart={() => warm(item.href)}
            >
              <span className="adm-nav-icon" aria-hidden>
                <AdminIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
