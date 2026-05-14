// Flat line icons (24x24, 1.5px stroke). Single colour via currentColor so they
// adapt to sidebar theme, dashboard tile gradient, etc. Inline SVG to avoid
// any extra runtime dependency.

type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
};

const base = (props: IconProps) => ({
  width: props.size ?? 18,
  height: props.size ?? 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: props.strokeWidth ?? 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: props.className,
  style: props.style,
});

export function IconDashboard(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

export function IconNewspaper(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 4h13a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2V4Z" />
      <path d="M19 8h2v9a2 2 0 0 1-2 2" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </svg>
  );
}

export function IconFolder(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function IconLink(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5" />
    </svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconKey(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M11 13l9-9M16 4h4v4" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconSatellite(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 19a14 14 0 0 1 0-14M9 19a10 10 0 0 1 0-10M13 19a6 6 0 0 1 0-6" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

export function IconMegaphone(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2Z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
    </svg>
  );
}

export function IconWand(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 7l3 3" />
      <path d="M5 21 21 5l-2-2L3 19l2 2Z" />
      <path d="M9 5h.01M19 13h.01M5 13h.01M13 5h.01" />
    </svg>
  );
}

export function IconPalette(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 8 8 5 5 0 0 1-5 5h-2a2 2 0 0 0-1 3.7c.4.4.6 1 .5 1.6A2 2 0 0 1 12 22Z" />
      <circle cx="7" cy="13" r="1" />
      <circle cx="9" cy="8" r="1" />
      <circle cx="14" cy="6" r="1" />
      <circle cx="17" cy="10" r="1" />
    </svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}

export function IconScroll(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M19 19V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11" />
      <path d="M19 19v-2a2 2 0 1 1 2 2h-2Z" />
      <path d="M8 7h7M8 11h7M8 15h4" />
    </svg>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3Z" />
      <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" />
    </svg>
  );
}

export function IconTrendingUp(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

export function IconBolt(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function IconImage(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5-9 9" />
    </svg>
  );
}

export function IconInbox(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconExternalLink(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

export function IconCode(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9 8-5 4 5 4" />
      <path d="m15 8 5 4-5 4" />
    </svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export type AdminIconKey =
  | "dashboard"
  | "newspaper"
  | "inbox"
  | "folder"
  | "link"
  | "clock"
  | "key"
  | "settings"
  | "search"
  | "satellite"
  | "megaphone"
  | "wand"
  | "palette"
  | "users"
  | "scroll"
  | "download";

export function AdminIcon({
  name,
  size = 18,
  strokeWidth,
}: {
  name: AdminIconKey;
  size?: number;
  strokeWidth?: number;
}) {
  const props = { size, strokeWidth };
  switch (name) {
    case "dashboard": return <IconDashboard {...props} />;
    case "newspaper": return <IconNewspaper {...props} />;
    case "inbox":     return <IconInbox {...props} />;
    case "folder":    return <IconFolder {...props} />;
    case "link":      return <IconLink {...props} />;
    case "clock":     return <IconClock {...props} />;
    case "key":       return <IconKey {...props} />;
    case "settings":  return <IconSettings {...props} />;
    case "search":    return <IconSearch {...props} />;
    case "satellite": return <IconSatellite {...props} />;
    case "megaphone": return <IconMegaphone {...props} />;
    case "wand":      return <IconWand {...props} />;
    case "palette":   return <IconPalette {...props} />;
    case "users":     return <IconUsers {...props} />;
    case "scroll":    return <IconScroll {...props} />;
    case "download":  return <IconDownload {...props} />;
  }
}
