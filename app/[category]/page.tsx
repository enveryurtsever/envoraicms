import type { Metadata } from "next";
import { getCategoryBySlug, getAllCategorySlugs } from "@/lib/queries/categories";
import { getSettings } from "@/lib/queries/settings";
import { categoryMetadata } from "@/lib/seo";
import { CategoryView } from "./_view";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((category) => ({ category }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> }
): Promise<Metadata> {
  const { category } = await params;
  const [settings, cat] = await Promise.all([getSettings(), getCategoryBySlug(category)]);
  if (!cat) return { title: "Not found" };
  return categoryMetadata(settings, cat);
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  return <CategoryView slug={slug} page={1} />;
}
