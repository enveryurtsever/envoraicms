import Image from "next/image";
import Link from "next/link";
import type { Category, Settings } from "@/lib/types";
import type { ColorMode } from "@/lib/theme-mode";
import { SearchBar } from "./SearchBar";
import { ColorModeToggle } from "./ColorModeToggle";
import { SocialIcon } from "./SocialIcon";

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
}: {
  settings: Settings;
  colorMode: ColorMode;
  showToggle: boolean;
  /** Categories to surface in the dark secondary nav (filtered by HeaderMenu).
   *  Empty array → the row hides the nav and just shows date + socials. */
  topCategories?: Category[];
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
    <header className="bg-white">
      <div className="border-b border-neutral-200 bg-navy text-white">
        <div className="mx-auto flex w-full max-w-container items-center justify-between gap-4 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider">
          <span className="text-white/70">{today}</span>
          {topCategories.length > 0 ? (
            <nav aria-label="Secondary" className="hidden items-center gap-4 text-white/80 md:flex">
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

      <div className="mx-auto flex w-full max-w-container flex-col items-center gap-4 px-4 py-6 md:flex-row md:gap-8 md:py-8">
        <Link href="/" aria-label={settings.SiteName} className="shrink-0">
          {logo ? (
            <Image
              src={logo}
              alt={settings.SiteName}
              width={320}
              height={64}
              priority
              className="h-11 w-auto md:h-14"
            />
          ) : (
            <span className="text-2xl font-extrabold tracking-tight text-navy md:text-3xl">
              ENVORAI CMS
            </span>
          )}
        </Link>
        <div className="w-full md:flex-1">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}
