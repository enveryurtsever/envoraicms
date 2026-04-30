import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import {
  getHomepageFeatured,
  getLatestExcluding,
} from "@/lib/queries/contents";
import { formatDate, truncate } from "@/lib/utils";

export default async function MinimalHomepage() {
  const featured = await getHomepageFeatured(6);
  const topIds = featured.map((i) => i.ContentID);
  const latest = await getLatestExcluding(topIds, 20);

  const all = [...featured, ...latest];

  return (
    <>
      <AdSlot name="leaderboard-top" className="mb-6" />

      <ul className="divide-y divide-neutral-200">
        {all.map((item, idx) => (
          <li key={item.ContentID} className="py-5">
            <Link
              href={`/${item.CatSeo}/${item.ContentSeo}`}
              className="group block"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
                  {item.CatName}
                </span>
                {item.PublishDate ? (
                  <time className="text-[11px] text-neutral-500">
                    {formatDate(item.PublishDate)}
                  </time>
                ) : null}
              </div>
              <h2 className="mt-1 text-xl font-bold leading-snug text-navy group-hover:text-brand md:text-2xl">
                {item.ContentTitle}
              </h2>
              {item.ContentShort ? (
                <p className="mt-1.5 text-sm text-neutral-600">
                  {truncate(item.ContentShort, 180)}
                </p>
              ) : null}
            </Link>
            {(idx + 1) % 6 === 0 ? (
              <AdSlot name="in-article" className="mt-5" />
            ) : null}
          </li>
        ))}
      </ul>

      <AdSlot name="leaderboard-bottom" className="mt-10" />
    </>
  );
}
