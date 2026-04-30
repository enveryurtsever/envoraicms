"use client";

import { useEffect, useState } from "react";

// Renders a date string in the user's local timezone. The server sends an
// ISO/UTC string and the client formats with Intl using the browser's tz.
// `mode="datetime"` shows date + time, "date" date-only, "relative" "5m ago".

export function LocalDate({
  value,
  mode = "datetime",
  fallback = "—",
}: {
  value: string | Date | null | undefined;
  mode?: "datetime" | "date" | "relative";
  fallback?: string;
}) {
  const [text, setText] = useState<string>(() => initial(value, mode, fallback));

  useEffect(() => {
    setText(initial(value, mode, fallback));
    if (mode !== "relative" || !value) return;
    const t = setInterval(() => setText(initial(value, mode, fallback)), 60_000);
    return () => clearInterval(t);
  }, [value, mode, fallback]);

  return <span suppressHydrationWarning>{text}</span>;
}

function initial(
  value: string | Date | null | undefined,
  mode: "datetime" | "date" | "relative",
  fallback: string,
): string {
  if (!value) return fallback;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return fallback;
  if (mode === "date") {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  if (mode === "relative") {
    return formatRelative(d);
  }
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
