"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Thin animated bar at the very top of the admin shell.
 *
 * Why this exists: Next.js client navigations between server components run
 * inside a React transition. For the first ~150–250ms the browser shows the
 * old page with no visual feedback while the new RSC payload streams. Users
 * read that as "nothing happened on click." This bar starts the moment a
 * same-origin link is clicked and stops once the URL has changed AND a brief
 * settle window has passed, giving an instant reaction without flickering on
 * fast navigations. */
export function TopProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef<string>(`${pathname}?${search?.toString() ?? ""}`);

  // Start the bar on internal link clicks. Use capture so we don't depend on
  // each Link to opt in.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      // Ignore external, hash-only, mail/tel, and downloads.
      if (
        /^(?:[a-z]+:)?\/\//i.test(href) ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        a.hasAttribute("download") ||
        a.target === "_blank"
      ) {
        return;
      }
      setActive(true);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  // When the URL changes, schedule a stop. Short settle keeps the bar visible
  // through the React commit so it doesn't blink off mid-transition.
  useEffect(() => {
    const key = `${pathname}?${search?.toString() ?? ""}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setActive(false), 220);
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [pathname, search]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: active ? 1 : 0,
        transition: active ? "opacity 80ms" : "opacity 200ms",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: "30%",
          background: "linear-gradient(90deg, transparent, #2563eb 40%, #2563eb 60%, transparent)",
          animation: active ? "adm-progress 1s ease-in-out infinite" : "none",
        }}
      />
      <style>{`
        @keyframes adm-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(380%); }
        }
      `}</style>
    </div>
  );
}
