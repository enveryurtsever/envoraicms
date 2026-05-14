import Image from "next/image";
import Link from "next/link";
import type { Category, Settings } from "@/lib/types";
import type { ColorMode } from "@/lib/theme-mode";
import { SearchBar } from "./SearchBar";
import { ColorModeToggle } from "./ColorModeToggle";
import { SocialIcon } from "./SocialIcon";
import { MobileMenu } from "./MobileMenu";

function resolveLogo(raw?: string | null, siteUrl?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const own = siteUrl ? new URL(siteUrl).hostname.replace(/^www\./, "") : null;
    const host = u.hostname.replace(/^www\./, "");
    if (own && host === own) {
      return u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    }
    return raw;
  } catch {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
}

export function Header({
  settings,
  colorMode,
  showToggle,
  topCategories = [],
  allCategories = [],
  showHeaderMenu = true,
}: {
  settings: Settings;
  colorMode: ColorMode;
  showToggle: boolean;
  /** Categories to surface in the dark secondary nav (filtered by HeaderMenu).
   *  Empty array → the row hides the nav and just shows date + socials. */
  topCategories?: Category[];
  /** Full category list for the mobile drawer (independent of HeaderMenu flag). */
  allCategories?: Category[];
  /** Honors Settings.ShowHeaderMenu — when false the drawer hides the nav too. */
  showHeaderMenu?: boolean;
}) {
  const logo = resolveLogo(settings.SiteLogo, settings.SiteUrl);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const socials = (settings.SocialLinks ?? []).filter((s) => s.isActive !== false && s.url);

  return (
    <header className="bg-white dark:bg-neutral-950">
      {/* Desktop dark strip — date / secondary nav / socials / theme toggle. */}
      <div className="hidden border-b border-neutral-200 bg-navy text-white dark:border-neutral-800 md:block">
        <div className="mx-auto flex w-full max-w-container items-center justify-between gap-4 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider">
          <span className="text-white/70">{today}</span>
          {topCategories.length > 0 ? (
            <nav aria-label="Secondary" className="flex items-center gap-4 text-white/80">
              {topCategories.slice(0, 5).map((c) => (
                <Link key={c.CatID} href={`/${c.CatSeo}`} className="hover:text-white">
                  {c.CatName}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="flex items-center gap-3 text-white/70">
            {socials.map((s) => (
              <a
                key={s.platform + s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={s.platform}
                className="transition-colors hover:text-white"
              >
                <SocialIcon icon={s.icon ?? s.platform} />
              </a>
            ))}
            {showToggle ? <ColorModeToggle current={colorMode} /> : null}
          </div>
        </div>
      </div>

      {/* Mobile header — hamburger / centered logo / theme toggle. */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 md:hidden">
        <div className="mx-auto flex w-full max-w-container items-center gap-2 px-3 py-2.5">
          <MobileMenu
            categories={allCategories}
            socials={socials}
            colorMode={colorMode}
            showToggle={showToggle}
            showHeaderMenu={showHeaderMenu}
            siteName={settings.SiteName}
          />
          <Link
            href="/"
            aria-label={settings.SiteName}
            className="flex min-w-0 flex-1 justify-center"
          >
            {logo ? (
              <Image
                src={logo}
                alt={settings.SiteName}
                width={240}
                height={48}
                priority
                className="h-9 w-auto"
              />
            ) : (
              <span className="truncate text-lg font-extrabold tracking-tight text-navy dark:text-neutral-100">
                {settings.SiteName || "ENVORAI CMS"}
              </span>
            )}
          </Link>
          <div className="flex h-10 w-10 items-center justify-center text-navy dark:text-neutral-100">
            {showToggle ? <ColorModeToggle current={colorMode} /> : null}
          </div>
        </div>
        <div className="px-3 pb-3">
          <SearchBar compact />
        </div>
      </div>

      {/* Desktop logo + search row. */}
      <div className="mx-auto hidden w-full max-w-container items-center gap-8 px-4 py-6 md:flex md:py-8">
        <Link href="/" aria-label={settings.SiteName} className="shrink-0">
          {logo ? (
            <Image
              src={logo}
              alt={settings.SiteName}
              width={320}
              height={64}
              priority
              className="h-14 w-auto"
            />
          ) : (
            <span className="text-3xl font-extrabold tracking-tight text-navy dark:text-neutral-100">
              ENVORAI CMS
            </span>
          )}
        </Link>
        <div className="flex-1">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}
