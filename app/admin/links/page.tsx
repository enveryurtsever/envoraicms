import { listAllLinks } from "@/lib/queries/admin-links";
import { LinksClient } from "./LinksClient";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const links = await listAllLinks();
  return <LinksClient links={links} />;
}
