import dynamic from "next/dynamic";
import { ArticleCard } from "@/components/ArticleCard";

// Embla + carousel state are split into their own chunk so they don't bloat
// the homepage's initial JS. SSR is kept (default) — the LCP image still
// renders in the server HTML.
const HeroCarousel = dynamic(
  () => import("@/components/HeroCarousel").then((m) => ({ default: m.HeroCarousel })),
  {
    loading: () => (
      <div className="aspect-[16/10] w-full animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
    ),
  },
);
import { AdSlot } from "@/components/AdSlot";
import { TagPill } from "@/components/TagPill";
import {
  getHomepageFeatured,
  getLatestExcluding,
  getPerCategoryLatest,
  getTopTags,
} from "@/lib/queries/contents";
import { getDefaultCover } from "@/lib/queries/settings";
import {
  CategoryDuoBlock,
  CategoryFeatureBlock,
  CategoryHeader,
  CategoryListBlock,
  HotNowCard,
  TallFeatureCard,
} from "@/themes/shared/blocks";

export default async function ClassicHomepage() {
  const [featured, tags, fallback] = await Promise.all([
    getHomepageFeatured(8),
    getTopTags(14),
    getDefaultCover(),
  ]);

  const heroItems = featured.slice(0, 5);
  const sideItems = featured.slice(5, 7);
  const topIds = [...heroItems, ...sideItems].map((i) => i.ContentID);

  const hotNow = await getLatestExcluding(topIds, 5);
  const usedIds = [...topIds, ...hotNow.map((i) => i.ContentID)];

  const perCategory = await getPerCategoryLatest(5, usedIds);
  const groups = perCategory.filter((g) => g.items.length > 0);

  const duoTop = groups.slice(0, 2);
  const dualLists = groups.slice(2, 4);
  const tripleStack = groups.slice(4, 7);
  // The tall feature card pulls the lead of the second list block.
  // Drop that item from the list block so the same article doesn't render
  // twice across two adjacent columns.
  const tallFeature = dualLists.length === 2 ? dualLists[1].items[0] : null;
  const dualListsForRender =
    tallFeature && dualLists[1]
      ? [dualLists[0], { ...dualLists[1], items: dualLists[1].items.slice(1) }]
      : dualLists;

  return (
    <>
      <AdSlot name="leaderboard-top" className="mb-6" />

      <section aria-label="Top stories" className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <HeroCarousel items={heroItems} fallbackSrc={fallback} />
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

      {tags.length > 0 ? (
        <section
          aria-label="Trending topics"
          className="mt-6 flex flex-wrap gap-2 border-y border-neutral-200 py-4 dark:border-neutral-700"
        >
          {tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </section>
      ) : null}

      {duoTop.length > 0 ? (
        <section
          aria-label="Featured categories"
          className="mt-8 grid gap-8 lg:grid-cols-2"
        >
          {duoTop.map((g) => (
            <CategoryDuoBlock key={g.CatID} group={g} />
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

      {dualLists.length > 0 ? (
        <section
          aria-label="More from the desks"
          className="mt-2 grid gap-8 lg:grid-cols-3"
        >
          {dualListsForRender.map((g) => (
            <CategoryListBlock key={g.CatID} group={g} />
          ))}
          {tallFeature ? <TallFeatureCard item={tallFeature} /> : null}
        </section>
      ) : null}

      {tripleStack.length > 0 ? (
        <section
          aria-label="Across the desks"
          className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {tripleStack.map((g) => (
            <CategoryFeatureBlock key={g.CatID} group={g} />
          ))}
        </section>
      ) : null}

      <AdSlot name="leaderboard-bottom" className="mt-10" />
    </>
  );
}
