import { listAllCategories } from "@/lib/queries/admin-categories";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const cats = await listAllCategories();
  return <CategoriesClient categories={cats} />;
}
