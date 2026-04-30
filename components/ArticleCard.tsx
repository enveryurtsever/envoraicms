import Image from "next/image";
import Link from "next/link";
import type { ContentListItem } from "@/lib/types";
import { contentThumb, formatDate, truncate } from "@/lib/utils";

type Variant = "hero" | "feature" | "grid" | "list" | "compact";

export function ArticleCard({
  item,
  variant = "grid",
  priority = false,
  sizes,
}: {
  item: ContentListItem;
  variant?: Variant;
  priority?: boolean;
  sizes?: string;
}) {
  const href = `/${item.CatSeo}/${item.ContentSeo}`;
  const image = contentThumb(item.ContentImage) || "/Upload/default-cover.jpg";

  if (variant === "hero") {
    return (
      <Link href={href} className="group relative block overflow-hidden rounded-lg">
        <div className="relative aspect-[16/10] w-full bg-neutral-200">
          <Image
            src={image}
            alt={item.ContentTitle}
            fill
            priority={priority}
            sizes={sizes ?? "(min-width: 1024px) 760px, 100vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
          <span className="inline-block rounded bg-brand/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
            {item.CatName}
          </span>
          <h2 className="mt-2 max-w-3xl text-xl font-bold leading-tight text-white md:text-2xl lg:text-3xl">
            {item.ContentTitle}
          </h2>
        </div>
      </Link>
    );
  }

  if (variant === "feature") {
    return (
      <Link href={href} className="group relative block overflow-hidden rounded-lg">
        <div className="relative aspect-[16/10] w-full bg-neutral-200">
          <Image
            src={image}
            alt={item.ContentTitle}
            fill
            sizes={sizes ?? "(min-width: 1024px) 380px, 100vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="inline-block rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {item.CatName}
          </span>
          <h3 className="mt-2 text-base font-bold leading-snug text-white md:text-lg">
            {item.ContentTitle}
          </h3>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={href} className="group relative block overflow-hidden rounded">
        <div className="relative aspect-[4/3] w-full bg-neutral-200">
          <Image
            src={image}
            alt={item.ContentTitle}
            fill
            sizes={sizes ?? "(min-width: 1024px) 200px, 45vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <span className="inline-block rounded bg-brand/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {item.CatName}
          </span>
          <h4 className="mt-1 line-clamp-3 text-xs font-bold leading-snug text-white">
            {item.ContentTitle}
          </h4>
        </div>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link href={href} className="group flex gap-4 border-b border-neutral-200 py-4 last:border-b-0">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded bg-neutral-200 md:h-24 md:w-36">
          <Image
            src={image}
            alt={item.ContentTitle}
            fill
            sizes="150px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand">
            {item.CatName} {item.PublishDate ? <span className="text-neutral-400">— {formatDate(item.PublishDate)}</span> : null}
          </div>
          <h3 className="mt-1 text-sm font-bold leading-snug text-neutral-900 group-hover:text-brand md:text-base">
            {item.ContentTitle}
          </h3>
          {item.ContentShort ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-600 md:text-sm">
              {truncate(item.ContentShort, 180)}
            </p>
          ) : null}
        </div>
      </Link>
    );
  }

  // grid (default)
  return (
    <Link href={href} className="group flex flex-col overflow-hidden">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded bg-neutral-200">
        <Image
          src={image}
          alt={item.ContentTitle}
          fill
          sizes={sizes ?? "(min-width: 1024px) 300px, 50vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="pt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-brand">
          {item.CatName}
          {item.PublishDate ? <span className="text-neutral-400"> — {formatDate(item.PublishDate)}</span> : null}
        </div>
        <h3 className="mt-1 text-sm font-bold leading-snug text-neutral-900 group-hover:text-brand md:text-base">
          {item.ContentTitle}
        </h3>
      </div>
    </Link>
  );
}
