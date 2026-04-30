import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCategoryBySlug } from "@/lib/queries/categories";
import { getSettings } from "@/lib/queries/settings";
import { categoryMetadata } from "@/lib/seo";
import { CategoryView } from "../../_view";

export const revalidate = 60;
export const dynamicParams = true;

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
