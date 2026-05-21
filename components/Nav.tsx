import Link from "next/link";
import type { Category } from "@/lib/types";

export function Nav({
  categories,
  activeSlug,
}: {
  categories: Category[];
  activeSlug?: string;
}) {
  return (
    <nav aria-label="Primary" className="hidden border-b border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none md:block">
      <div className="mx-auto w-full max-w-container overflow-x-auto px-4">
        <ul className="flex w-full items-center justify-between gap-x-4 text-[13px] font-bold uppercase tracking-wider">
          {categories.map((c) => {
            const active = activeSlug === c.CatSeo;
            return (
              <li key={c.CatID} className="shrink-0">
                <Link
                  href={`/${c.CatSeo}`}
                  className={`inline-block whitespace-nowrap border-b-[3px] px-4 py-3.5 transition-colors ${
                    active
                      ? "border-brand text-brand"
                      : "border-transparent text-navy hover:text-brand dark:text-neutral-100 dark:hover:text-brand"
                  }`}
                >
                  {c.CatName}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
