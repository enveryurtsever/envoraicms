import { listApiKeys } from "@/lib/queries/apikeys";
import { ApiKeysClient } from "./ApiKeysClient";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const keys = await listApiKeys();
  return <ApiKeysClient keys={keys} />;
}
