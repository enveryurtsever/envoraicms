import { SafeImage as Image } from "@/components/SafeImage";
import Link from "next/link";
import type { ContentListItem } from "@/lib/types";
import { contentThumb, formatDate, truncate } from "@/lib/utils";
import type { getPerCategoryLatest } from "@/lib/queries/contents";
import { getDefaultCover } from "@/lib/queries/settings";

type CategoryGroup = Awaited<ReturnType<typeof getPerCategoryLatest>>[number];

export function CategoryHeader({
  name,
  slug,
  hideAll = false,
}: {
  name: string;
  slug: string;
  hideAll?: boolean;
}) {
  return (
    <div className="mb-3 flex items-end justify-between border-b-2 border-brand pb-1.5">
      {slug ? (
        <Link
          href={`/${slug}`}
          className="text-sm font-bold uppercase tracking-[0.18em] text-brand hover:opacity-80"
        >
          {name} <span aria-hidden>›</span>
        </Link>
      ) : (
        <span className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
          {name}
        </span>
      )}
      {slug && !hideAll ? (
        <Link
          href={`/${slug}`}
          aria-label={`See all ${name} articles`}
          className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-brand"
        >
          See all →
        </Link>
      ) : null}
    </div>
  );
}

export async function ThumbRowItem({
  item,
  size = "sm",
}: {
  item: ContentListItem;
  size?: "sm" | "md";
}) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  const dim = size === "md" ? "h-20 w-24 sm:h-20 sm:w-28" : "h-16 w-20 sm:h-16 sm:w-24";
  return (
    <Link href={href} className="group flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-navy group-hover:text-brand dark:text-neutral-100">
          {item.ContentTitle}
        </h3>
        {item.PublishDate ? (
          <time className="mt-1 block text-[11px] text-neutral-500">
            {formatDate(item.PublishDate)}
          </time>
        ) : null}
      </div>
      <div className={`relative shrink-0 overflow-hidden rounded bg-neutral-200 ${dim}`}>
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          sizes="120px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      </div>
    </Link>
  );
}

export async function FeatureOverlayCard({ item }: { item: ContentListItem }) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link href={href} className="group relative block min-h-[260px] overflow-hidden rounded-lg">
      <Image
        src={image}
        alt={item.ContentTitle}
        fill
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <span className="inline-block rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {item.CatName}
        </span>
        <h3 className="mt-2 text-base font-bold leading-snug text-white md:text-lg">
          {item.ContentTitle}
        </h3>
        {item.PublishDate ? (
          <time className="mt-1 block text-[11px] text-white/70">
            {formatDate(item.PublishDate)}
          </time>
        ) : null}
      </div>
    </Link>
  );
}

export async function TallFeatureCard({ item }: { item: ContentListItem }) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link
      href={href}
      className="group relative block min-h-[360px] overflow-hidden rounded-lg lg:min-h-full"
    >
      <Image
        src={image}
        alt={item.ContentTitle}
        fill
        sizes="(min-width: 1024px) 360px, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <span className="inline-block rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {item.CatName}
        </span>
        <h3 className="mt-2 text-lg font-bold leading-snug text-white md:text-xl">
          {item.ContentTitle}
        </h3>
        {item.ContentShort ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-white/85">
            {truncate(item.ContentShort, 140)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export async function HotNowCard({ item }: { item: ContentListItem }) {
  const image = contentThumb(item.ContentImage) || (await getDefaultCover());
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  return (
    <Link href={href} className="group block min-w-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-neutral-200">
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          sizes="(min-width: 1024px) 200px, 45vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      </div>
      <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-snug text-navy group-hover:text-brand dark:text-neutral-100">
        {item.ContentTitle}
      </h3>
      {item.PublishDate ? (
        <time className="mt-1 block text-[11px] text-neutral-500">
          {formatDate(item.PublishDate)}
        </time>
      ) : null}
    </Link>
  );
}

/** 4 small list items + 1 tall overlay feature card. */
export function CategoryDuoBlock({ group }: { group: CategoryGroup }) {
  const [feature, ...rest] = group.items;
  const list = rest.slice(0, 4);
  return (
    <section aria-labelledby={`duo-${group.CatSeo}`} className="min-w-0">
      <CategoryHeader name={group.CatName} slug={group.CatSeo} />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {list.map((item) => (
            <ThumbRowItem key={item.ContentID} item={item} />
          ))}
        </div>
        {feature ? <FeatureOverlayCard item={feature} /> : null}
      </div>
    </section>
  );
}

/** 4 small list items only — no lead card. */
export function CategoryListBlock({ group }: { group: CategoryGroup }) {
  const items = group.items.slice(0, 4);
  return (
    <section aria-labelledby={`list-${group.CatSeo}`} className="min-w-0">
      <CategoryHeader name={group.CatName} slug={group.CatSeo} />
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {items.map((item) => (
          <ThumbRowItem key={item.ContentID} item={item} />
        ))}
      </div>
    </section>
  );
}

/** Big overlay card on top, 4 small list items below. */
export function CategoryFeatureBlock({ group }: { group: CategoryGroup }) {
  const [lead, ...rest] = group.items;
  const list = rest.slice(0, 4);
  return (
    <section aria-labelledby={`stack-${group.CatSeo}`} className="min-w-0">
      <CategoryHeader name={group.CatName} slug={group.CatSeo} />
      {lead ? <FeatureOverlayCard item={lead} /> : null}
      {list.length > 0 ? (
        <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">
          {list.map((item) => (
            <ThumbRowItem key={item.ContentID} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
