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

/** Sidebar nav with optimistic active-state on click. The clicked item flips
 *  to the "active" style synchronously so the user sees the menu reflect the
 *  navigation immediately — no spinner; TopProgress handles the "in flight"
 *  cue. The optimistic value is cleared once the real pathname matches. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  const [optimistic, setOptimistic] = useState<string | null>(null);

  useEffect(() => {
    if (!optimistic) return;
    if (pathname === optimistic || pathname.startsWith(optimistic + "/")) {
      setOptimistic(null);
    }
  }, [pathname, optimistic]);

  const isActive = (href: string) => {
    const ref = optimistic ?? pathname;
    if (href === "/admin") return ref === "/admin";
    return ref === href || ref.startsWith(href + "/");
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
              prefetch
              onClick={() => setOptimistic(item.href)}
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
