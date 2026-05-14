"use client";

import { useMemo, useState } from "react";

type Props = {
  url: string;
  title: string;
  via?: string | null;
  className?: string;
};

// Module-level icon JSX so each share target keeps the same React element
// reference across renders. SocialShare renders twice on every article page
// (above the body and below) — recreating six SVG trees per render is wasted
// reconciler work.
const ICONS = {
  x: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99h-2.5V12h2.5V9.84c0-2.47 1.47-3.84 3.72-3.84 1.08 0 2.21.19 2.21.19v2.43h-1.25c-1.23 0-1.62.77-1.62 1.56V12h2.75l-.44 2.89h-2.31v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.36-1.84c3.6 0 4.26 2.37 4.26 5.45v6.28ZM5.34 7.43a2.06 2.06 0 1 1 2.06-2.06 2.06 2.06 0 0 1-2.06 2.06Zm1.78 13.02H3.56V9h3.56v11.45ZM22.23 0H1.77A1.75 1.75 0 0 0 0 1.72v20.56A1.75 1.75 0 0 0 1.77 24h20.46A1.75 1.75 0 0 0 24 22.28V1.72A1.75 1.75 0 0 0 22.23 0Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M.06 24l1.68-6.13A11.86 11.86 0 1 1 12 23.87a11.83 11.83 0 0 1-5.66-1.44L.06 24Zm6.6-3.8.36.22a9.86 9.86 0 1 0-3.34-3.35l.24.38-1 3.63 3.74-.88Zm11.39-5.56c-.15-.25-.55-.4-1.15-.7-.6-.3-3.55-1.75-4.1-1.95-.55-.2-.95-.3-1.35.3-.4.6-1.55 1.95-1.9 2.35-.35.4-.7.45-1.3.15a8.2 8.2 0 0 1-2.41-1.49 9 9 0 0 1-1.67-2.08c-.17-.3-.02-.47.13-.62.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.65-1.57-.9-2.15-.24-.56-.48-.48-.66-.49h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.5.7.3 1.26.48 1.69.62.71.22 1.36.19 1.87.12.57-.08 1.76-.72 2-1.42.24-.7.24-1.3.17-1.42Z" />
    </svg>
  ),
  reddit: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M22 12.06c0-1.21-.99-2.2-2.2-2.2-.6 0-1.13.23-1.53.62-1.5-1.07-3.55-1.76-5.83-1.84l1.18-3.7 3.18.74a1.7 1.7 0 1 0 .08-.96l-3.55-.83a.4.4 0 0 0-.47.27l-1.32 4.13c-2.34.05-4.45.74-5.99 1.83a2.2 2.2 0 1 0-2.5 3.61c-.04.27-.06.55-.06.83 0 3.56 4.03 6.45 9 6.45s9-2.89 9-6.45c0-.28-.02-.56-.06-.83A2.2 2.2 0 0 0 22 12.06Zm-13.6 1.4a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0Zm7.74 3.94c-1.05 1.05-3.07 1.13-3.66 1.13-.59 0-2.61-.08-3.66-1.13a.4.4 0 1 1 .56-.56c.66.66 2.07.9 3.1.9s2.44-.24 3.1-.9a.4.4 0 0 1 .56.56Zm-.34-2.54a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
} as const;

function buildShareTargets(url: string, title: string, via: string | null) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const viaParam = via ? `&via=${encodeURIComponent(via.replace(/^@/, ""))}` : "";
  return [
    { name: "X", label: "Share on X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}${viaParam}`, icon: ICONS.x },
    { name: "Facebook", label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: ICONS.facebook },
    { name: "LinkedIn", label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: ICONS.linkedin },
    { name: "WhatsApp", label: "Share on WhatsApp", href: `https://api.whatsapp.com/send?text=${t}%20${u}`, icon: ICONS.whatsapp },
    { name: "Reddit", label: "Share on Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}`, icon: ICONS.reddit },
    { name: "Email", label: "Share via email", href: `mailto:?subject=${t}&body=${t}%0A%0A${u}`, icon: ICONS.email },
  ];
}

export function SocialShare({ url, title, via, className }: Props) {
  const [copied, setCopied] = useState(false);
  const targets = useMemo(
    () => buildShareTargets(url, title, via ?? null),
    [url, title, via],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}
      role="group"
      aria-label="Share this article"
    >
      <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
        Share
      </span>
      {targets.map((t) => (
        <a
          key={t.name}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.label}
          title={t.label}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:border-brand hover:bg-brand hover:text-white"
        >
          {t.icon}
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Link copied" : "Copy link"}
        className="flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-medium text-neutral-600 transition hover:border-brand hover:text-brand"
      >
        {copied ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
            <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
          </svg>
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
