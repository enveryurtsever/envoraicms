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
    <nav aria-label="Primary" className="border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto w-full max-w-container overflow-x-auto px-4">
        <ul className="flex min-w-max items-center text-[13px] font-bold uppercase tracking-wider">
          <li>
            <Link
              href="/"
              className={`inline-flex items-center gap-1.5 border-b-[3px] px-4 py-3.5 transition-colors ${
                !activeSlug
                  ? "border-brand text-brand"
                  : "border-transparent text-navy hover:text-brand"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              Today&apos;s News
            </Link>
          </li>
          {categories.map((c) => {
            const active = activeSlug === c.CatSeo;
            return (
              <li key={c.CatID}>
                <Link
                  href={`/${c.CatSeo}`}
                  className={`inline-block border-b-[3px] px-4 py-3.5 transition-colors ${
                    active
                      ? "border-brand text-brand"
                      : "border-transparent text-navy hover:text-brand"
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
