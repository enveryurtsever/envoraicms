import { SafeImage as Image } from "@/components/SafeImage";
import Link from "next/link";
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
import { contentThumb, formatDate, truncate } from "@/lib/utils";
import {
  CategoryFeatureBlock,
  CategoryHeader,
  CategoryListBlock,
  HotNowCard,
  TallFeatureCard,
} from "@/themes/shared/blocks";

export default async function MinimalHomepage() {
  const [featured, tags, fallback] = await Promise.all([
    getHomepageFeatured(9),
    getTopTags(12),
    getDefaultCover(),
  ]);

  const strip = featured.slice(0, 4);    // top thin strip
  const heroLead = featured[4];          // big hero card
  const sideList = featured.slice(5, 9); // sidebar small list under the promo
  const featuredIds = featured.map((i) => i.ContentID);

  const hotNow = await getLatestExcluding(featuredIds, 5);
  const usedIds = [...featuredIds, ...hotNow.map((i) => i.ContentID)];

  const perCategory = await getPerCategoryLatest(5, usedIds);
  const groups = perCategory.filter((g) => g.items.length > 0);

  const tripleA = groups.slice(0, 3);    // POLITICS | center feature | MEDIA
  const tripleB = groups.slice(3, 5);    // WORLD | OPINIONS (+ tall feature on right)
  // tripleC[0]'s lead doubles as the tall feature on the row above. If we
  // pull from there, also strip it out of tripleC's first feature block so
  // the same article doesn't render in two adjacent rows.
  const tallFromGroups = groups[5]?.items[0] ?? null;
  const tallFeatureForB = tallFromGroups ?? hotNow[0] ?? null;
  const tripleC = groups.slice(5, 8).map((g, i) =>
    i === 0 && tallFromGroups
      ? { ...g, items: g.items.slice(1) }
      : g,
  );

  return (
    <>
      <AdSlot name="leaderboard-top" className="mb-6" />

      {strip.length > 0 ? (
        <section
          aria-label="Top strip"
          className="mb-5 grid gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-700"
        >
          {strip.map((item) => (
            <StripCard key={item.ContentID} item={item} />
          ))}
        </section>
      ) : null}

      <section
        aria-label="Lead story"
        className="grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]"
      >
        {heroLead ? <HeroLeadCard item={heroLead} /> : null}
        <aside className="flex min-w-0 flex-col gap-4">
          <AdSlot name="sidebar-mpu" />
          {sideList.length > 0 ? (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {sideList.map((item) => (
                <li key={item.ContentID} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/${item.CatSeo}/${item.ContentSeo}`}
                    className="group flex gap-3"
                  >
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-neutral-200">
                      <Image
                        src={contentThumb(item.ContentImage) || fallback}
                        alt={item.ContentTitle}
                        fill
                        sizes="80px"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-3 text-xs font-semibold leading-snug text-navy group-hover:text-brand dark:text-neutral-100">
                        {item.ContentTitle}
                      </h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </section>

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

      {tripleA.length === 3 ? (
        <section
          aria-label="Featured desks"
          className="mt-8 grid gap-8 lg:grid-cols-3"
        >
          <CategoryListBlock group={tripleA[0]} />
          {tripleA[1].items[0] ? <TallFeatureCard item={tripleA[1].items[0]} /> : null}
          <CategoryListBlock group={tripleA[2]} />
        </section>
      ) : tripleA.length > 0 ? (
        <section
          aria-label="Featured desks"
          className="mt-8 grid gap-8 lg:grid-cols-2"
        >
          {tripleA.map((g) => (
            <CategoryListBlock key={g.CatID} group={g} />
          ))}
        </section>
      ) : null}

      {hotNow.length > 0 ? (
        <section aria-label="Hot now" className="mt-10">
          <CategoryHeader name="Hot Now" slug="" hideAll />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {hotNow.map((item) => (
              <HotNowCard key={item.ContentID} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <AdSlot name="billboard" className="my-8" />

      {tripleB.length > 0 ? (
        <section
          aria-label="More from the desks"
          className="mt-2 grid gap-8 lg:grid-cols-3"
        >
          {tripleB.map((g) => (
            <CategoryListBlock key={g.CatID} group={g} />
          ))}
          {tallFeatureForB ? <TallFeatureCard item={tallFeatureForB} /> : null}
        </section>
      ) : null}

      {tripleC.length > 0 ? (
        <section
          aria-label="Across the desks"
          className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {tripleC.map((g) => (
            <CategoryFeatureBlock key={g.CatID} group={g} />
          ))}
        </section>
      ) : null}

      <AdSlot name="leaderboard-bottom" className="mt-10" />
    </>
  );
}

/* ---- minimal-only cards: top strip and the big lead-with-byline hero ---- */

async function StripCard({ item }: { item: ContentListItem }) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3">
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-neutral-200">
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          sizes="80px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-navy group-hover:text-brand dark:text-neutral-100">
          {item.ContentTitle}
        </h3>
      </div>
    </Link>
  );
}

async function HeroLeadCard({ item }: { item: ContentListItem }) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link
      href={href}
      className="group relative block min-h-[420px] overflow-hidden rounded-lg bg-neutral-900"
    >
      <Image
        src={image}
        alt={item.ContentTitle}
        fill
        priority
        sizes="(min-width: 1024px) 880px, 100vw"
        className="object-cover opacity-95 transition-transform duration-700 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
        <span className="inline-block rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {item.CatName}
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-white md:text-3xl lg:text-4xl">
          {item.ContentTitle}
        </h1>
        {item.ContentShort ? (
          <p className="mt-2 hidden max-w-2xl text-sm text-white/80 md:block">
            {truncate(item.ContentShort, 180)}
          </p>
        ) : null}
        {item.PublishDate ? (
          <time className="mt-3 block text-[11px] uppercase tracking-wider text-white/60">
            {formatDate(item.PublishDate)}
          </time>
        ) : null}
      </div>
    </Link>
  );
}
