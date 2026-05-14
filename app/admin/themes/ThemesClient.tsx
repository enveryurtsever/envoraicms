"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/types";
import { useToast } from "@/components/admin-ui/Toast";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "@/lib/brand-colors";
import { setActiveThemeAction, setBrandColorsAction } from "./actions";

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
    bg: "#ffffff",
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
  primaryColor,
  secondaryColor,
}: {
  themes: Theme[];
  activeSlug: string;
  primaryColor: string | null;
  secondaryColor: string | null;
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

      <BrandColorsCard
        primary={primaryColor}
        secondary={secondaryColor}
      />

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
          <div className="card">No themes registered. Did the schema run?</div>
        ) : null}
      </div>
    </>
  );
}

function BrandColorsCard({
  primary,
  secondary,
}: {
  primary: string | null;
  secondary: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState((primary ?? DEFAULT_PRIMARY).toLowerCase());
  const [s, setS] = useState((secondary ?? DEFAULT_SECONDARY).toLowerCase());

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await setBrandColorsAction(fd);
        toast.success("Brand colors saved", "Reloading to apply the new palette.");
        router.refresh();
      } catch (err) {
        toast.error(
          "Save failed",
          err instanceof Error ? err.message : "Unexpected error",
        );
      }
    });
  }

  function resetDefaults() {
    setP(DEFAULT_PRIMARY.toLowerCase());
    setS(DEFAULT_SECONDARY.toLowerCase());
  }

  return (
    <form action={handleSubmit} autoComplete="off" style={{ marginBottom: "1rem" }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Brand colors</h3>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0 }}>
          Primary drives accents — category pills, links, buttons, the brand bar.
          Secondary drives the dark navy used in headings and footer. Leave a field
          blank to fall back to the built-in default.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          <ColorField
            label="Primary"
            name="PrimaryColor"
            value={p}
            fallback={DEFAULT_PRIMARY}
            onChange={setP}
          />
          <ColorField
            label="Secondary"
            name="SecondaryColor"
            value={s}
            fallback={DEFAULT_SECONDARY}
            onChange={setS}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.85rem",
          }}
        >
          <button
            type="button"
            className="btn secondary small"
            onClick={resetDefaults}
            disabled={pending}
          >
            Reset to defaults
          </button>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving…" : "Save colors"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ColorField({
  label,
  name,
  value,
  fallback,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  // Native color inputs only accept "#rrggbb"; if value isn't a full hex, the
  // browser silently snaps it to #000000 — keep a fallback so the swatch stays
  // visible while the text input is being edited.
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  return (
    <div>
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          marginBottom: "0.35rem",
          color: "#374151",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 44,
            height: 36,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: "transparent",
            padding: 2,
            cursor: "pointer",
          }}
          aria-label={`${label} color picker`}
        />
        <input
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          style={{ flex: 1, fontFamily: "ui-monospace, monospace" }}
          maxLength={7}
        />
      </div>
    </div>
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
        fontSize: 7,
        lineHeight: 1.2,
      }}
    >
      <MockHeader palette={palette} />
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <AdStrip palette={palette} label="LEADERBOARD" />
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
          padding: "5px 10px",
          background: palette.text,
          color: palette.surface,
          fontSize: 6,
          textAlign: "center",
          letterSpacing: 0.4,
        }}
      >
        © FOOTER
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
        padding: "7px 10px",
        background: palette.surface,
        borderBottom: `1px solid ${palette.muted}33`,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 11, color: palette.text, letterSpacing: 0.5 }}>SITE</div>
      <div style={{ display: "flex", gap: 5, color: palette.muted, fontSize: 6, fontWeight: 600 }}>
        <span>NEWS</span>
        <span>WORLD</span>
        <span>TECH</span>
        <span>MORE</span>
      </div>
    </div>
  );
}

/* ---------- Classic — HeroCarousel + side rail, tags, hot now, lists+tall ---------- */
function ClassicBody({ palette }: { palette: ThemeVars }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 5 }}>
        <CarouselCard palette={palette} />
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 5 }}>
          <FeatureCard palette={palette} />
          <FeatureCard palette={palette} />
        </div>
      </div>
      <PillRow palette={palette} count={6} />
      <SectionHeader palette={palette} label="HOT NOW" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <MiniCard key={i} palette={palette} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginTop: 2 }}>
        <ListBlock palette={palette} />
        <ListBlock palette={palette} />
        <TallFeatureCard palette={palette} />
      </div>
    </>
  );
}

/* ---------- Magazine — 4-col overlay mosaic, latest grid ---------- */
function MagazineBody({ palette }: { palette: ThemeVars }) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          gridTemplateRows: "30px 30px 30px",
          gap: 4,
        }}
      >
        <OverlayCard palette={palette} small style={{ gridColumn: 1, gridRow: 1 }} />
        <OverlayCard palette={palette} small style={{ gridColumn: 1, gridRow: 2 }} />
        <OverlayCard palette={palette} small style={{ gridColumn: 1, gridRow: 3 }} />
        <OverlayCard
          palette={palette}
          big
          style={{ gridColumn: 2, gridRow: "1 / span 3" }}
        />
        <OverlayCard palette={palette} small style={{ gridColumn: 3, gridRow: 1 }} />
        <OverlayCard palette={palette} small style={{ gridColumn: 3, gridRow: 2 }} />
        <OverlayCard palette={palette} small style={{ gridColumn: 3, gridRow: 3 }} />
      </div>
      <PillRow palette={palette} count={5} />
      <AdStrip palette={palette} label="BILLBOARD" tall />
      <SectionHeader palette={palette} label="LATEST NEWS" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <MiniCard key={i} palette={palette} />
        ))}
      </div>
    </>
  );
}

/* ---------- Minimal — thumb strip, hero+sidebar, 3-col with tall feature ---------- */
function MinimalBody({ palette }: { palette: ThemeVars }) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 4,
          paddingBottom: 5,
          borderBottom: `1px solid ${palette.muted}33`,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <ThumbStripCard key={i} palette={palette} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr", gap: 5 }}>
        <HeroLeadCard palette={palette} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <AdStrip palette={palette} label="MPU" tall />
          {[0, 1, 2, 3].map((i) => (
            <SidebarRow key={i} palette={palette} />
          ))}
        </div>
      </div>
      <PillRow palette={palette} count={5} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
        <ListBlock palette={palette} />
        <TallFeatureCard palette={palette} />
        <ListBlock palette={palette} />
      </div>
    </>
  );
}

/* ---------- pieces ---------- */

function AdStrip({
  palette,
  label,
  tall,
}: {
  palette: ThemeVars;
  label: string;
  tall?: boolean;
}) {
  return (
    <div
      style={{
        height: tall ? 28 : 14,
        background: `repeating-linear-gradient(45deg, ${palette.muted}22 0, ${palette.muted}22 4px, transparent 4px, transparent 8px)`,
        border: `1px dashed ${palette.muted}55`,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: palette.muted,
        fontSize: 6,
        letterSpacing: 0.6,
        fontWeight: 700,
      }}
    >
      {label} AD
    </div>
  );
}

function PillRow({ palette, count }: { palette: ThemeVars; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        padding: "4px 0",
        borderTop: `1px solid ${palette.muted}33`,
        borderBottom: `1px solid ${palette.muted}33`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            background: palette.surface,
            border: `1px solid ${palette.muted}55`,
            color: palette.text,
            fontSize: 6,
            padding: "1px 5px",
            borderRadius: 8,
            opacity: 0.85,
          }}
        >
          tag {i + 1}
        </span>
      ))}
    </div>
  );
}

function SectionHeader({ palette, label }: { palette: ThemeVars; label: string }) {
  return (
    <div
      style={{
        color: palette.accent,
        borderBottom: `2px solid ${palette.accent}`,
        paddingBottom: 2,
        fontSize: 7,
        fontWeight: 800,
        letterSpacing: 0.7,
      }}
    >
      {label}
    </div>
  );
}

/** Big lead card with a dotted-pagination strip — the carousel preview. */
function CarouselCard({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        position: "relative",
        background: palette.muted + "33",
        borderRadius: 4,
        minHeight: 70,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${palette.text}cc, transparent 65%)`,
        }}
      />
      <div style={{ position: "absolute", left: 6, bottom: 6, right: 6, color: palette.surface }}>
        <span
          style={{
            display: "inline-block",
            background: palette.accent,
            padding: "1px 4px",
            fontSize: 6,
            fontWeight: 700,
            borderRadius: 2,
            marginBottom: 2,
          }}
        >
          LEAD
        </span>
        <Line w="90%" palette={palette} bold inverted />
        <Line w="65%" palette={palette} bold inverted />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 3,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 3,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 2,
              borderRadius: 1,
              background: i === 0 ? palette.surface : `${palette.surface}66`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Image-with-title card used in side rails (Classic) and Latest grid (Magazine). */
function FeatureCard({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        background: palette.surface,
        border: `1px solid ${palette.muted}33`,
        borderRadius: 3,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div
        style={{
          background: palette.muted + "44",
          height: 18,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <Line w="95%" palette={palette} bold />
      <Line w="65%" palette={palette} muted />
    </div>
  );
}

function MiniCard({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        background: palette.surface,
        borderRadius: 3,
        border: `1px solid ${palette.muted}22`,
        padding: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          background: palette.muted + "44",
          height: 16,
          borderRadius: 2,
        }}
      />
      <Line w="100%" palette={palette} bold />
      <Line w="60%" palette={palette} muted />
    </div>
  );
}

/** Photo card with a brand-color label and 2-3 list items below — the
 *  CategoryListBlock equivalent for the preview. */
function ListBlock({ palette }: { palette: ThemeVars }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div
        style={{
          color: palette.accent,
          borderBottom: `2px solid ${palette.accent}`,
          fontSize: 6,
          fontWeight: 800,
          paddingBottom: 1,
          letterSpacing: 0.6,
        }}
      >
        DESK
      </div>
      <div
        style={{
          background: palette.muted + "44",
          height: 24,
          borderRadius: 2,
        }}
      />
      <Line w="95%" palette={palette} bold />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            paddingTop: 2,
            borderTop: `1px solid ${palette.muted}22`,
          }}
        >
          <Line w="90%" palette={palette} />
          <Line w="55%" palette={palette} muted />
        </div>
      ))}
    </div>
  );
}

/** Tall photo + headline + summary — TallFeatureCard preview. */
function TallFeatureCard({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        background: palette.surface,
        border: `1px solid ${palette.muted}33`,
        borderRadius: 3,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: palette.muted + "44",
          height: 50,
        }}
      />
      <div style={{ padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            display: "inline-block",
            background: palette.accent,
            color: palette.surface,
            fontSize: 5,
            fontWeight: 700,
            padding: "1px 3px",
            borderRadius: 2,
            alignSelf: "flex-start",
            letterSpacing: 0.4,
          }}
        >
          FEATURE
        </span>
        <Line w="100%" palette={palette} bold />
        <Line w="80%" palette={palette} bold />
        <Line w="60%" palette={palette} muted />
      </div>
    </div>
  );
}

/** Magazine 4-col mosaic card. `big` spans the center; `small` stacks in side cols. */
function OverlayCard({
  palette,
  big,
  small,
  style,
}: {
  palette: ThemeVars;
  big?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
}) {
  void small;
  return (
    <div
      style={{
        position: "relative",
        background: palette.muted + "55",
        borderRadius: 3,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${palette.text}d0, transparent 60%)`,
        }}
      />
      {big ? (
        <div style={{ position: "absolute", left: 5, bottom: 5, right: 5, color: palette.surface }}>
          <span
            style={{
              display: "inline-block",
              background: palette.accent,
              padding: "1px 4px",
              fontSize: 6,
              fontWeight: 700,
              borderRadius: 2,
              marginBottom: 2,
            }}
          >
            COVER
          </span>
          <Line w="90%" palette={palette} bold inverted />
          <Line w="60%" palette={palette} bold inverted />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 4, bottom: 3, right: 4, color: palette.surface }}>
          <Line w="92%" palette={palette} bold inverted />
        </div>
      )}
    </div>
  );
}

/** Minimal: image + title in a row, 4-up strip. */
function ThumbStripCard({ palette }: { palette: ThemeVars }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <div
        style={{
          width: 22,
          height: 14,
          background: palette.muted + "44",
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Line w="100%" palette={palette} bold />
        <Line w="65%" palette={palette} muted />
      </div>
    </div>
  );
}

function SidebarRow({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        alignItems: "center",
        paddingBottom: 3,
        borderBottom: `1px solid ${palette.muted}22`,
      }}
    >
      <div
        style={{
          width: 16,
          height: 11,
          background: palette.muted + "44",
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Line w="100%" palette={palette} bold />
      </div>
    </div>
  );
}

/** Minimal big hero: large overlay image with category pill + headline + summary. */
function HeroLeadCard({ palette }: { palette: ThemeVars }) {
  return (
    <div
      style={{
        position: "relative",
        background: palette.muted + "55",
        borderRadius: 4,
        minHeight: 110,
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
      <div style={{ position: "absolute", left: 6, bottom: 6, right: 6, color: palette.surface }}>
        <span
          style={{
            display: "inline-block",
            background: palette.accent,
            padding: "1px 4px",
            fontSize: 6,
            fontWeight: 700,
            borderRadius: 2,
            marginBottom: 3,
          }}
        >
          CATEGORY
        </span>
        <Line w="92%" palette={palette} bold inverted />
        <Line w="78%" palette={palette} bold inverted />
        <Line w="55%" palette={palette} inverted />
      </div>
    </div>
  );
}

function Line({
  w,
  bold,
  muted,
  inverted,
  palette,
}: {
  w: string;
  bold?: boolean;
  muted?: boolean;
  inverted?: boolean;
  palette: ThemeVars;
}) {
  const color = inverted
    ? palette.surface
    : muted
      ? palette.muted
      : palette.text;
  return (
    <div
      style={{
        width: w,
        height: bold ? 4 : 2.5,
        borderRadius: 1.5,
        background: color,
        opacity: muted ? 0.55 : bold ? 0.9 : 0.7,
        marginTop: 1.5,
      }}
    />
  );
}
