import Image from "next/image";
import Link from "next/link";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ArticleCard } from "@/components/ArticleCard";
import { AdSlot } from "@/components/AdSlot";
import { TagPill } from "@/components/TagPill";
import {
  getHomepageFeatured,
  getLatestExcluding,
  getPerCategoryLatest,
  getPopular,
  getTopTags,
} from "@/lib/queries/contents";
import type { ContentListItem } from "@/lib/types";
import { contentThumb, formatDate, truncate } from "@/lib/utils";

export default async function ClassicHomepage() {
  const [featured, tags, popular] = await Promise.all([
    getHomepageFeatured(8),
    getTopTags(14),
    getPopular(6, 7),
  ]);

  const heroItems = featured.slice(0, 5);
  const sideItems = featured.slice(5, 7);
  const topIds = [...heroItems, ...sideItems].map((i) => i.ContentID);

  const strip = await getLatestExcluding(topIds, 4);
  const afterStripIds = [...topIds, ...strip.map((i) => i.ContentID)];

  const latest = await getLatestExcluding(afterStripIds, 7);
  const latestFeatured = latest[0];
  const latestList = latest.slice(1, 7);

  const allUsedIds = [...afterStripIds, ...latest.map((i) => i.ContentID)];
  const perCategory = await getPerCategoryLatest(4, allUsedIds);

  const firstSix = perCategory.slice(0, 6).map((g) => ({ ...g, items: g.items.slice(0, 3) }));
  const lastTwo = perCategory.slice(6);

  return (
    <>
      <AdSlot name="leaderboard-top" className="mb-6" />

      <section aria-label="Top stories" className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <HeroCarousel items={heroItems} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {sideItems.map((item) => (
            <ArticleCard
              key={item.ContentID}
              item={item}
              variant="feature"
              sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            />
          ))}
        </div>
      </section>

      {strip.length > 0 ? (
        <section aria-label="More stories" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {strip.map((item) => (
            <ArticleCard
              key={item.ContentID}
              item={item}
              variant="compact"
              sizes="(min-width: 1024px) 300px, 50vw"
            />
          ))}
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section aria-label="Trending topics" className="mt-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-5">
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </section>
      ) : null}

      <AdSlot name="billboard" className="my-8" />

      {popular.length > 0 ? (
        <section aria-label="Most read" className="mt-2">
          <h2 className="mb-4 border-b-2 border-brand pb-2 text-xl font-bold uppercase tracking-wider text-brand">
            Most Read
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((item, idx) => {
              const href = `/${item.CatSeo}/${item.ContentSeo}`;
              return (
                <li key={item.ContentID} className="flex gap-3">
                  <span
                    aria-hidden
                    className="shrink-0 text-3xl font-black leading-none text-brand/80"
                  >
                    {idx + 1}
                  </span>
                  <Link href={href} className="group min-w-0 flex-1">
                    <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-navy group-hover:text-brand">
                      {item.ContentTitle}
                    </h3>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-500">
                      {item.CatName}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {latestFeatured ? (
        <section aria-label="Latest news" className="mt-2">
          <h2 className="mb-4 border-b-2 border-brand pb-2 text-xl font-bold uppercase tracking-wider text-brand">
            Latest News
          </h2>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div>
              <ArticleCard
                item={latestFeatured}
                variant="feature"
                sizes="(min-width: 1024px) 420px, 100vw"
              />
              {latestFeatured.ContentShort ? (
                <p className="mt-3 line-clamp-4 text-sm text-neutral-600">
                  {latestFeatured.ContentShort}
                </p>
              ) : null}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {latestList.map((item) => (
                <ArticleCard
                  key={item.ContentID}
                  item={item}
                  variant="grid"
                  sizes="(min-width: 1024px) 240px, (min-width: 640px) 45vw, 100vw"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {firstSix.length > 0 ? (
        <section
          aria-label="Categories"
          className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {firstSix.map((group) => (
            <CategoryBlock key={group.CatID} group={group} />
          ))}
        </section>
      ) : null}

      {lastTwo.length > 0 ? (
        <section
          aria-label="More categories"
          className="mt-12 grid gap-8 lg:grid-cols-2"
        >
          {lastTwo.map((group) => (
            <CategoryBlockWide key={group.CatID} group={group} />
          ))}
        </section>
      ) : null}

      <AdSlot name="leaderboard-bottom" className="mt-10" />
    </>
  );
}

function CategoryHeader({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="mb-3 flex items-end justify-between border-b-2 border-brand pb-1.5">
      <Link
        href={`/${slug}`}
        className="text-sm font-bold uppercase tracking-[0.18em] text-brand hover:opacity-80"
      >
        {name}
      </Link>
      <Link
        href={`/${slug}`}
        aria-label={`See all ${name} articles`}
        className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-brand"
      >
        See all →
      </Link>
    </div>
  );
}

function ThumbListItem({ item }: { item: ContentListItem }) {
  const image = contentThumb(item.ContentImage) || "/Upload/envoraicms_cover.jpg";
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link href={href} className="group flex gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded bg-neutral-200 sm:h-20 sm:w-28">
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          sizes="120px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      </div>
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
  );
}

function CategoryBlock({
  group,
}: {
  group: Awaited<ReturnType<typeof getPerCategoryLatest>>[number];
}) {
  if (group.items.length === 0) return null;
  const [lead, ...rest] = group.items;

  return (
    <section aria-labelledby={`cat-${group.CatSeo}`} className="min-w-0">
      <CategoryHeader name={group.CatName} slug={group.CatSeo} />
      <ArticleCard
        item={lead}
        variant="grid"
        sizes="(min-width: 1024px) 360px, (min-width: 768px) 45vw, 100vw"
      />
      {rest.length > 0 ? (
        <div className="mt-3 divide-y divide-neutral-200">
          {rest.map((item) => (
            <ThumbListItem key={item.ContentID} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CategoryBlockWide({
  group,
}: {
  group: Awaited<ReturnType<typeof getPerCategoryLatest>>[number];
}) {
  if (group.items.length === 0) return null;
  const [lead, ...rest] = group.items;
  const image = contentThumb(lead.ContentImage) || "/Upload/envoraicms_cover.jpg";
  const href = `/${lead.CatSeo}/${lead.ContentSeo}`;

  return (
    <section aria-labelledby={`cat-wide-${group.CatSeo}`} className="min-w-0">
      <CategoryHeader name={group.CatName} slug={group.CatSeo} />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Link href={href} className="group block">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded bg-neutral-200">
            <Image
              src={image}
              alt={lead.ContentTitle}
              fill
              sizes="(min-width: 1024px) 320px, 45vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
          <h3 className="mt-3 line-clamp-3 text-base font-bold leading-snug text-navy group-hover:text-brand">
            {lead.ContentTitle}
          </h3>
          {lead.ContentShort ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-neutral-600">
              {truncate(lead.ContentShort, 140)}
            </p>
          ) : null}
        </Link>
        {rest.length > 0 ? (
          <div className="divide-y divide-neutral-200">
            {rest.map((item) => (
              <ThumbListItem key={item.ContentID} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
