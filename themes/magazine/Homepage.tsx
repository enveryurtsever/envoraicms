import { SafeImage as Image } from "@/components/SafeImage";
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
import { getDefaultCover } from "@/lib/queries/settings";
import type { ContentListItem } from "@/lib/types";
import { contentThumb, formatRelativeShort, truncate } from "@/lib/utils";

export default async function MagazineHomepage() {
  const [featured, tags] = await Promise.all([
    getHomepageFeatured(7),
    getTopTags(12),
  ]);

  // 3-column hero: small column (3) | big center (1) | small column (3).
  const center = featured[0];
  const left = featured.slice(1, 4);
  const right = featured.slice(4, 7);
  const usedIds = featured.map((i) => i.ContentID);

  const latest = await getLatestExcluding(usedIds, 8);
  const perCategory = await getPerCategoryLatest(
    3,
    [...usedIds, ...latest.map((i) => i.ContentID)],
  );

  return (
    <>
      <AdSlot name="leaderboard-top" className="mb-6" />

      {center ? (
        <section
          aria-label="Featured stories"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(170px,1fr)]"
        >
          {left[0] ? (
            <SmallOverlayCard
              item={left[0]}
              className="lg:col-start-1 lg:row-start-1"
            />
          ) : null}
          {left[1] ? (
            <SmallOverlayCard
              item={left[1]}
              className="lg:col-start-1 lg:row-start-2"
            />
          ) : null}
          {left[2] ? (
            <SmallOverlayCard
              item={left[2]}
              className="lg:col-start-1 lg:row-start-3"
            />
          ) : null}

          <BigOverlayCard
            item={center}
            className="sm:col-span-2 lg:col-start-2 lg:col-span-2 lg:row-span-3"
          />

          {right[0] ? (
            <SmallOverlayCard
              item={right[0]}
              className="lg:col-start-4 lg:row-start-1"
            />
          ) : null}
          {right[1] ? (
            <SmallOverlayCard
              item={right[1]}
              className="lg:col-start-4 lg:row-start-2"
            />
          ) : null}
          {right[2] ? (
            <SmallOverlayCard
              item={right[2]}
              className="lg:col-start-4 lg:row-start-3"
            />
          ) : null}
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section
          aria-label="Trending topics"
          className="mt-8 flex flex-wrap gap-2 border-y border-neutral-200 py-4 dark:border-neutral-700"
        >
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </section>
      ) : null}

      <AdSlot name="billboard" className="my-8" />

      {latest.length > 0 ? (
        <section aria-label="Latest news" className="mt-6">
          <h2 className="mb-4 border-b-2 border-brand pb-2 text-xl font-bold uppercase tracking-wider text-brand">
            Latest News
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
          aria-label="Categories"
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
                  <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">
                    {rest.map((item) => (
                      <li key={item.ContentID} className="py-2">
                        <Link
                          href={`/${item.CatSeo}/${item.ContentSeo}`}
                          className="text-sm font-semibold leading-snug text-navy hover:text-brand dark:text-neutral-100"
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

/* ---------------- shared cards (image fill + dark overlay) ---------------- */

function TimeBadge({ date }: { date: string | Date }) {
  return (
    <span className="absolute left-3 top-3 z-10 rounded-sm bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
      {formatRelativeShort(date)}
    </span>
  );
}

async function SmallOverlayCard({
  item,
  className,
}: {
  item: ContentListItem;
  className?: string;
}) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-lg bg-neutral-900 ${className ?? ""}`}
    >
      <div className="relative h-full min-h-[180px] w-full">
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
          className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      </div>
      {item.PublishDate ? <TimeBadge date={item.PublishDate} /> : null}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="line-clamp-2 text-sm font-extrabold uppercase leading-tight tracking-tight text-white md:text-base">
          {item.ContentTitle}
        </h3>
      </div>
    </Link>
  );
}

async function BigOverlayCard({
  item,
  className,
}: {
  item: ContentListItem;
  className?: string;
}) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-lg bg-neutral-900 ${className ?? ""}`}
    >
      <div className="relative h-full min-h-[400px] w-full">
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          priority
          sizes="(min-width: 1024px) 640px, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      </div>
      {item.PublishDate ? <TimeBadge date={item.PublishDate} /> : null}
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
        <h2 className="line-clamp-3 text-xl font-extrabold uppercase leading-tight tracking-tight text-white md:text-3xl lg:text-4xl">
          {item.ContentTitle}
        </h2>
        <div className="mt-4 flex items-center gap-3 text-xs text-white/75">
          <span className="rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {item.CatName}
          </span>
          {item.ContentShort ? (
            <span className="hidden text-white/70 md:inline">
              {truncate(item.ContentShort, 90)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
