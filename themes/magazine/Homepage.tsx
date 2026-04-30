import Image from "next/image";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { AdSlot } from "@/components/AdSlot";
import { TagPill } from "@/components/TagPill";
import {
  getHomepageFeatured,
  getLatestExcluding,
  getPerCategoryLatest,
  getTopTags,
} from "@/lib/queries/contents";
import { contentThumb, formatDate, truncate } from "@/lib/utils";

export default async function MagazineHomepage() {
  const [featured, tags] = await Promise.all([
    getHomepageFeatured(10),
    getTopTags(12),
  ]);

  const cover = featured[0];
  const secondary = featured.slice(1, 5);
  const sidebar = featured.slice(5, 10);
  const topIds = featured.map((i) => i.ContentID);

  const latest = await getLatestExcluding(topIds, 10);
  const perCategory = await getPerCategoryLatest(
    3,
    [...topIds, ...latest.map((i) => i.ContentID)],
  );

  return (
    <>
      <AdSlot name="leaderboard-top" className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {cover ? (
            <Link href={`/${cover.CatSeo}/${cover.ContentSeo}`} className="group block">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-200">
                <Image
                  src={contentThumb(cover.ContentImage) || "/Upload/envoraicms_cover.jpg"}
                  alt={cover.ContentTitle}
                  fill
                  priority
                  sizes="(min-width: 1024px) 720px, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <span className="mb-2 inline-block rounded bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {cover.CatName}
                  </span>
                  <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
                    {cover.ContentTitle}
                  </h1>
                  {cover.ContentShort ? (
                    <p className="mt-2 hidden text-sm text-white/90 lg:block">
                      {truncate(cover.ContentShort, 180)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ) : null}

          {secondary.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {secondary.map((item) => (
                <ArticleCard
                  key={item.ContentID}
                  item={item}
                  variant="compact"
                  sizes="(min-width: 1024px) 340px, 45vw"
                />
              ))}
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 border-l border-neutral-200 pl-6">
          <h2 className="mb-3 border-b-2 border-brand pb-1.5 text-sm font-bold uppercase tracking-[0.18em] text-brand">
            Featured
          </h2>
          <ul className="divide-y divide-neutral-200">
            {sidebar.map((item, idx) => (
              <li key={item.ContentID} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/${item.CatSeo}/${item.ContentSeo}`}
                  className="group flex gap-3"
                >
                  <span className="text-2xl font-black text-brand/30 group-hover:text-brand/60">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-navy group-hover:text-brand">
                      {item.ContentTitle}
                    </h3>
                    {item.PublishDate ? (
                      <time className="mt-1 block text-[11px] text-neutral-500">
                        {formatDate(item.PublishDate)}
                      </time>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <AdSlot name="sidebar-mpu" className="mt-6" />
        </aside>
      </div>

      {tags.length > 0 ? (
        <section
          aria-label="Trending topics"
          className="mt-8 flex flex-wrap gap-2 border-y border-neutral-200 py-4"
        >
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </section>
      ) : null}

      <AdSlot name="billboard" className="my-8" />

      {latest.length > 0 ? (
        <section aria-label="Son haberler" className="mt-6">
          <h2 className="mb-4 border-b-2 border-brand pb-2 text-xl font-bold uppercase tracking-wider text-brand">
            Son Haberler
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {latest.slice(0, 8).map((item) => (
              <ArticleCard
                key={item.ContentID}
                item={item}
                variant="grid"
                sizes="(min-width: 1024px) 240px, 45vw"
              />
            ))}
          </div>
        </section>
      ) : null}

      {perCategory.length > 0 ? (
        <section
          aria-label="Categoryler"
          className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {perCategory.slice(0, 6).map((group) => {
            if (group.items.length === 0) return null;
            const [lead, ...rest] = group.items;
            return (
              <section key={group.CatID} className="min-w-0">
                <div className="mb-3 flex items-end justify-between border-b-2 border-brand pb-1.5">
                  <Link
                    href={`/${group.CatSeo}`}
                    className="text-sm font-bold uppercase tracking-[0.18em] text-brand hover:opacity-80"
                  >
                    {group.CatName}
                  </Link>
                </div>
                <ArticleCard
                  item={lead}
                  variant="grid"
                  sizes="(min-width: 1024px) 360px, 45vw"
                />
                {rest.length > 0 ? (
                  <ul className="mt-3 divide-y divide-neutral-200">
                    {rest.map((item) => (
                      <li key={item.ContentID} className="py-2">
                        <Link
                          href={`/${item.CatSeo}/${item.ContentSeo}`}
                          className="text-sm font-semibold leading-snug text-navy hover:text-brand"
                        >
                          {truncate(item.ContentTitle, 90)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </section>
      ) : null}

      <AdSlot name="leaderboard-bottom" className="mt-10" />
    </>
  );
}
