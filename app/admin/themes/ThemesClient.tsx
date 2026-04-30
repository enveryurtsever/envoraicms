"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/types";
import { useToast } from "@/components/admin-ui/Toast";
import { setActiveThemeAction } from "./actions";

type ThemeVars = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
};

const PALETTES: Record<string, ThemeVars> = {
  classic: {
    bg: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
  },
  magazine: {
    bg: "#fdf6e3",
    surface: "#ffffff",
    text: "#1f2937",
    muted: "#6b7280",
    accent: "#b91c1c",
  },
  minimal: {
    bg: "#ffffff",
    surface: "#fafafa",
    text: "#171717",
    muted: "#737373",
    accent: "#0f766e",
  },
};

const FALLBACK: ThemeVars = PALETTES.classic;

export function ThemesClient({
  themes,
  activeSlug,
}: {
  themes: Theme[];
  activeSlug: string;
}) {
  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Themes</h2>
          <div className="subtitle">
            Pick a homepage layout. The active theme highlights with a blue ring.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1rem",
        }}
      >
        {themes.map((t) => (
          <ThemeCard
            key={t.ThemeID}
            theme={t}
            active={t.ThemeSlug === activeSlug}
            palette={PALETTES[t.ThemeSlug] ?? FALLBACK}
          />
        ))}
        {themes.length === 0 ? (
          <div className="card">No themes registered. Did the migrations run?</div>
        ) : null}
      </div>
    </>
  );
}

function ThemeCard({
  theme,
  active,
  palette,
}: {
  theme: Theme;
  active: boolean;
  palette: ThemeVars;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function activate() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("slug", theme.ThemeSlug);
        await setActiveThemeAction(fd);
        toast.success("Theme activated", `Now showing "${theme.ThemeName}".`);
        router.refresh();
      } catch (err) {
        toast.error(
          "Activation failed",
          err instanceof Error ? err.message : "Unexpected error",
        );
      }
    });
  }

  return (
    <div
      className="card"
      style={{
        border: active ? "2px solid #2563eb" : "1px solid #e5e7eb",
        padding: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{theme.ThemeName}</h3>
        {active ? <span className="badge ok">active</span> : null}
      </div>
      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
        <code>{theme.ThemeSlug}</code>
        {theme.SupportsDark ? (
          <span className="badge off" style={{ marginLeft: 6 }}>dark</span>
        ) : null}
      </div>

      <ThemeMockup palette={palette} slug={theme.ThemeSlug} />

      {theme.ThemeDesc ? (
        <p style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#374151" }}>
          {theme.ThemeDesc}
        </p>
      ) : null}

      <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.5rem" }}>
        {active ? (
          <button type="button" className="btn secondary small" disabled>
            Active
          </button>
        ) : (
          <button
            type="button"
            className="btn small"
            onClick={activate}
            disabled={pending}
          >
            {pending ? "Activating…" : "Activate"}
          </button>
        )}
      </div>
    </div>
  );
}

function ThemeMockup({ palette, slug }: { palette: ThemeVars; slug: string }) {
  return (
    <div
      style={{
        marginTop: "0.85rem",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        background: palette.bg,
        color: palette.text,
        overflow: "hidden",
        fontSize: 8,
        lineHeight: 1.2,
      }}
    >
      <MockHeader palette={palette} />
      <div style={{ padding: 10 }}>
        {slug === "magazine" ? (
          <MagazineBody palette={palette} />
        ) : slug === "minimal" ? (
          <MinimalBody palette={palette} />
        ) : (
          <ClassicBody palette={palette} />
        )}
      </div>
      <div
        style={{
          padding: "6px 10px",
          background: palette.text,
          color: palette.surface,
          fontSize: 7,
          textAlign: "center",
        }}
      >
        © Footer
      </div>
    </div>
  );
}

function MockHeader({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        background: palette.surface,
        borderBottom: `1px solid ${palette.muted}33`,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 11, color: palette.text }}>SITE</div>
      <div style={{ display: "flex", gap: 6, color: palette.muted }}>
        <span>News</span>
        <span>World</span>
        <span>Tech</span>
      </div>
    </div>
  );
}

/** Classic: 2-column hero (big lead + 2-up rail), then 4-up grid below. */
function ClassicBody({ palette }: { palette: ThemeVars }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 6 }}>
        <Card palette={palette} tall>
          <Pill palette={palette} />
          <Line w="95%" palette={palette} bold />
          <Line w="80%" palette={palette} bold />
          <Line w="60%" palette={palette} muted />
        </Card>
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 6 }}>
          <Card palette={palette} small />
          <Card palette={palette} small />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} palette={palette} mini />
        ))}
      </div>
    </div>
  );
}

/** Magazine: dominant cover with overlay + numbered ranking sidebar. */
function MagazineBody({ palette }: { palette: ThemeVars }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1fr", gap: 8 }}>
      <div
        style={{
          position: "relative",
          background: palette.muted + "44",
          borderRadius: 4,
          minHeight: 90,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, ${palette.text}cc, transparent 60%)`,
          }}
        />
        <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, color: palette.surface }}>
          <div
            style={{
              display: "inline-block",
              background: palette.accent,
              padding: "1px 5px",
              borderRadius: 2,
              fontSize: 7,
              fontWeight: 700,
              marginBottom: 3,
              color: palette.surface,
            }}
          >
            COVER
          </div>
          <div style={{ height: 5, background: palette.surface, opacity: 0.95, width: "85%", borderRadius: 1 }} />
          <div style={{ height: 4, background: palette.surface, opacity: 0.75, width: "60%", borderRadius: 1, marginTop: 2 }} />
        </div>
      </div>
      <div
        style={{
          borderLeft: `1px solid ${palette.muted}33`,
          paddingLeft: 6,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <div
          style={{
            color: palette.accent,
            borderBottom: `2px solid ${palette.accent}`,
            paddingBottom: 2,
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: 0.6,
          }}
        >
          TRENDING
        </div>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
            <span
              style={{
                color: palette.accent,
                opacity: 0.5,
                fontWeight: 900,
                fontSize: 11,
                lineHeight: 1,
              }}
            >
              {n}
            </span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Line w="100%" palette={palette} bold />
              <Line w="70%" palette={palette} muted />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Minimal: single-column list, no thumbnails, hairline separators. */
function MinimalBody({ palette }: { palette: ThemeVars }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: "8px 0",
            borderBottom: i < 3 ? `1px solid ${palette.muted}33` : "none",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 6,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: palette.accent,
                textTransform: "uppercase",
              }}
            >
              CATEGORY
            </span>
            <span style={{ fontSize: 6, color: palette.muted }}>· 5 min ago</span>
          </div>
          <Line w="92%" palette={palette} bold />
          <Line w="70%" palette={palette} muted />
        </div>
      ))}
    </div>
  );
}

function Card({
  palette,
  tall,
  small,
  mini,
  children,
}: {
  palette: ThemeVars;
  tall?: boolean;
  small?: boolean;
  mini?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: palette.surface,
        border: `1px solid ${palette.muted}22`,
        borderRadius: 4,
        padding: 5,
        minHeight: tall ? 92 : small ? 42 : mini ? 50 : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div
        style={{
          background: palette.muted + "33",
          height: mini ? 22 : small ? 18 : 38,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {children ?? (
        <>
          <Line w="100%" palette={palette} bold />
          <Line w="70%" palette={palette} muted />
        </>
      )}
    </div>
  );
}

function Pill({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        background: palette.accent,
        color: palette.surface,
        fontSize: 6,
        fontWeight: 700,
        letterSpacing: 0.6,
        padding: "1px 4px",
        borderRadius: 2,
        alignSelf: "flex-start",
        marginBottom: 2,
      }}
    >
      LEAD
    </div>
  );
}

function Line({
  w,
  bold,
  muted,
  palette,
}: {
  w: string;
  bold?: boolean;
  muted?: boolean;
  palette: ThemeVars;
}) {
  return (
    <div
      style={{
        width: w,
        height: bold ? 5 : 3,
        borderRadius: 1.5,
        background: muted ? palette.muted : palette.text,
        opacity: muted ? 0.5 : bold ? 0.85 : 0.7,
      }}
    />
  );
}
