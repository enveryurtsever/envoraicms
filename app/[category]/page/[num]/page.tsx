import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCategoryBySlug } from "@/lib/queries/categories";
import { getSettings } from "@/lib/queries/settings";
import { categoryMetadata } from "@/lib/seo";
import { CategoryView } from "../../_view";

// Dynamic: the root layout reads request headers/cookies, so a static
// prerender here throws DYNAMIC_SERVER_USAGE. DB reads remain cached via
// unstable_cache in lib/queries.
export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params }: { params: Promise<{ category: string; num: string }> }
): Promise<Metadata> {
  const { category } = await params;
  const [settings, cat] = await Promise.all([getSettings(), getCategoryBySlug(category)]);
  if (!cat) return { title: "Not found" };
  return categoryMetadata(settings, cat);
}

export default async function CategoryPaginatedPage({
  params,
}: {
  params: Promise<{ category: string; num: string }>;
}) {
  const { category: slug, num } = await params;
  const page = Number(num);
  if (!Number.isInteger(page) || page < 2) {
    if (page === 1) redirect(`/${slug}`);
    notFound();
  }
  return <CategoryView slug={slug} page={page} />;
}
