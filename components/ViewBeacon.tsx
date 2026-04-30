"use client";

import { useEffect } from "react";

const DEDUPE_TTL_MS = 30 * 60 * 1000;

export function ViewBeacon({ contentId }: { contentId: number }) {
  useEffect(() => {
    if (!contentId) return;
    const key = `envview:${contentId}`;
    try {
      const last = Number(sessionStorage.getItem(key));
      if (Number.isFinite(last) && Date.now() - last < DEDUPE_TTL_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* private mode ya da storage disabled — yine de say */
    }

    const body = JSON.stringify({ id: contentId });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/view", blob)) return;
      } catch {
        /* fallback */
      }
    }
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [contentId]);

  return null;
}
