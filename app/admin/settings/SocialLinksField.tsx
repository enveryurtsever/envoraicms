"use client";

import { useState } from "react";
import type { SocialLink } from "@/lib/types";

const PLATFORMS: { value: string; label: string; placeholder: string }[] = [
  { value: "facebook",  label: "Facebook",  placeholder: "https://facebook.com/yourpage" },
  { value: "x",         label: "X (Twitter)", placeholder: "https://x.com/yourhandle" },
  { value: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
  { value: "tiktok",    label: "TikTok",    placeholder: "https://tiktok.com/@yourhandle" },
  { value: "linkedin",  label: "LinkedIn",  placeholder: "https://linkedin.com/company/your-co" },
  { value: "youtube",   label: "YouTube",   placeholder: "https://youtube.com/@yourchannel" },
  { value: "threads",   label: "Threads",   placeholder: "https://threads.net/@yourhandle" },
  { value: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/yourhandle" },
  { value: "reddit",    label: "Reddit",    placeholder: "https://reddit.com/r/yoursub" },
  { value: "github",    label: "GitHub",    placeholder: "https://github.com/yourorg" },
  { value: "discord",   label: "Discord",   placeholder: "https://discord.gg/your-invite" },
  { value: "telegram",  label: "Telegram",  placeholder: "https://t.me/yourchannel" },
  { value: "whatsapp",  label: "WhatsApp",  placeholder: "https://wa.me/15555550100" },
  { value: "mastodon",  label: "Mastodon",  placeholder: "https://mastodon.social/@you" },
  { value: "bluesky",   label: "Bluesky",   placeholder: "https://bsky.app/profile/you" },
  { value: "rss",       label: "RSS feed",  placeholder: "https://example.com/rss.xml" },
];

type Row = {
  id: number; // local key only; not posted
  platform: string;
  url: string;
  isActive: boolean;
};

let nextId = 1;

export function SocialLinksField({ initial }: { initial: SocialLink[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initial && initial.length > 0
      ? initial.map((s) => ({
          id: nextId++,
          platform: s.platform || "",
          url: s.url || "",
          isActive: s.isActive !== false,
        }))
      : [{ id: nextId++, platform: "facebook", url: "", isActive: true }]),
  );

  function update(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function add() {
    const used = new Set(rows.map((r) => r.platform));
    const next = PLATFORMS.find((p) => !used.has(p.value))?.value ?? "facebook";
    setRows((prev) => [...prev, { id: nextId++, platform: next, url: "", isActive: true }]);
  }
  function remove(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function move(id: number, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  return (
    <div className="adm-social">
      {rows.map((r, i) => {
        const meta = PLATFORMS.find((p) => p.value === r.platform);
        return (
          <div key={r.id} className="adm-social__row">
            <div className="adm-social__handle" aria-hidden>
              <PlatformIcon platform={r.platform} />
            </div>
            <select
              name={`socialLinks[${i}][platform]`}
              value={r.platform}
              onChange={(e) => update(r.id, { platform: e.target.value })}
              className="adm-social__platform"
              aria-label="Platform"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              {!PLATFORMS.find((p) => p.value === r.platform) ? (
                <option value={r.platform}>{r.platform}</option>
              ) : null}
            </select>
            <input
              type="url"
              name={`socialLinks[${i}][url]`}
              value={r.url}
              onChange={(e) => update(r.id, { url: e.target.value })}
              placeholder={meta?.placeholder ?? "https://..."}
              className="adm-social__url"
            />
            <label
              className="adm-social__active"
              title={r.isActive ? "Visible on the site" : "Hidden from the site"}
            >
              <input
                type="checkbox"
                name={`socialLinks[${i}][isActive]`}
                checked={r.isActive}
                onChange={(e) => update(r.id, { isActive: e.target.checked })}
                className="switch"
              />
            </label>
            <div className="adm-social__buttons">
              <button
                type="button"
                className="btn-icon"
                aria-label="Move up"
                title="Move up"
                onClick={() => move(r.id, -1)}
                disabled={i === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label="Move down"
                title="Move down"
                onClick={() => move(r.id, 1)}
                disabled={i === rows.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label="Remove"
                title="Remove"
                onClick={() => remove(r.id)}
                style={{ color: "#dc2626" }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn secondary small" onClick={add}>
        + Add link
      </button>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  // Tiny inline glyph based on first letter — keeps the component dep-free.
  // The actual social icons render on the public site via SocialIcon.tsx.
  const initial = (platform || "?").slice(0, 1).toUpperCase();
  const colors: Record<string, string> = {
    facebook: "#1877f2",
    x: "#000000",
    instagram: "#e1306c",
    tiktok: "#000000",
    linkedin: "#0a66c2",
    youtube: "#ff0000",
    threads: "#000000",
    pinterest: "#e60023",
    reddit: "#ff4500",
    github: "#181717",
    discord: "#5865f2",
    telegram: "#26a5e4",
    whatsapp: "#25d366",
    mastodon: "#6364ff",
    bluesky: "#0085ff",
    rss: "#f26522",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        background: colors[platform] ?? "#475569",
        color: "#fff",
        fontWeight: 600,
        fontSize: "0.85rem",
      }}
    >
      {initial}
    </span>
  );
}
