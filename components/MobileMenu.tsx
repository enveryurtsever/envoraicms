"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category, SocialLink } from "@/lib/types";
import type { ColorMode } from "@/lib/theme-mode";
import { ColorModeToggle } from "./ColorModeToggle";
import { SocialIcon } from "./SocialIcon";
import { SearchBar } from "./SearchBar";

type Props = {
  categories: Category[];
  socials: SocialLink[];
  colorMode: ColorMode;
  showToggle: boolean;
  showHeaderMenu: boolean;
  siteName: string;
};

export function MobileMenu({
  categories,
  socials,
  colorMode,
  showToggle,
  showHeaderMenu,
  siteName,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change so the drawer doesn't linger after a category click.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock the page behind the drawer + bind ESC to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-navy transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800 md:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <aside
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={`${siteName} menu`}
        className={`fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-neutral-950 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 bg-navy px-4 py-3 text-white dark:border-neutral-800">
          <span className="text-sm font-bold uppercase tracking-[0.2em]">Menu</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4">
            <SearchBar compact />
          </div>

          {showHeaderMenu && categories.length > 0 ? (
            <nav aria-label="Primary mobile">
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Sections
              </h2>
              <ul className="flex flex-col">
                {categories.map((c) => {
                  const active = pathname === `/${c.CatSeo}`;
                  return (
                    <li key={c.CatID}>
                      <Link
                        href={`/${c.CatSeo}`}
                        className={`flex items-center justify-between border-b border-neutral-100 py-3 text-sm font-bold uppercase tracking-wider transition-colors dark:border-neutral-800 ${
                          active
                            ? "text-brand"
                            : "text-navy hover:text-brand dark:text-neutral-100 dark:hover:text-brand"
                        }`}
                      >
                        <span>{c.CatName}</span>
                        <span aria-hidden className="text-neutral-400">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}

          {socials.length > 0 ? (
            <div className="mt-6">
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Follow
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {socials.map((s) => (
                  <a
                    key={s.platform + s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={s.platform}
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:border-brand hover:text-brand dark:border-neutral-700 dark:text-neutral-300"
                  >
                    <SocialIcon icon={s.icon ?? s.platform} />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {showToggle ? (
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Appearance
            </span>
            <div className="text-navy dark:text-neutral-100">
              <ColorModeToggle current={colorMode} />
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
