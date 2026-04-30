import Link from "next/link";
import Image from "next/image";
import type { Category, LinkRow, Settings } from "@/lib/types";
import { SocialIcon } from "@/components/SocialIcon";

type FooterProps = {
  settings: Settings;
  categories: Category[];
  pages: LinkRow[];
  socials: LinkRow[];
};

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

export function Footer({ settings, categories, pages, socials }: FooterProps) {
  const logo = resolveLogo(settings.SiteLogo, settings.SiteUrl);
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-navy text-neutral-300">
      <div className="mx-auto w-full max-w-container px-4 py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" aria-label={settings.SiteName}>
              {logo ? (
                <Image
                  src={logo}
                  alt={settings.SiteName}
                  width={240}
                  height={48}
                  className="h-10 w-auto brightness-0 invert"
                />
              ) : (
                <span className="text-xl font-extrabold tracking-tight text-white">
                  ENVORAI CMS
                </span>
              )}
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
              {settings.Description}
            </p>
            {socials.length > 0 ? (
              <div className="mt-5 flex items-center gap-2">
                {socials.map((s) => (
                  <a
                    key={s.LinkID}
                    href={s.Link!}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={s.LinkTitle}
                    className="rounded border border-neutral-700 p-2 hover:border-brand hover:text-brand"
                  >
                    <SocialIcon icon={s.LinkIcon ?? s.LinkTitle} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Categories</h3>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {categories.map((c) => (
                <li key={c.CatID}>
                  <Link href={`/${c.CatSeo}`} className="hover:text-brand">
                    {c.CatName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {pages.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Site</h3>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {pages.map((p) => {
                  const url = p.Link?.trim();
                  if (url) {
                    const external = /^https?:\/\//i.test(url);
                    return (
                      <li key={p.LinkID}>
                        <a
                          href={url}
                          className="hover:text-brand"
                          {...(external
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          {p.LinkTitle}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={p.LinkID}>
                      <Link href={`/s/${p.LinkSeo}`} className="hover:text-brand">
                        {p.LinkTitle}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">About</h3>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              {settings.SiteName} — breaking news, analysis, and the stories shaping the day.
            </p>
            <p className="mt-6 text-xs text-neutral-500">
              © {new Date().getFullYear()} {settings.SiteName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
