import { listAuthors } from "@/lib/queries/authors";
import { listAllCategories } from "@/lib/queries/admin-categories";
import { AuthorsClient } from "./AuthorsClient";

export const dynamic = "force-dynamic";

export default async function AuthorsPage() {
  const [authors, cats] = await Promise.all([listAuthors(), listAllCategories()]);
  return <AuthorsClient authors={authors} categories={cats} />;
}
