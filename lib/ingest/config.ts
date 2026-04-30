import "server-only";
import { getActiveApiKey } from "@/lib/queries/apikeys";
import type { ApiKeyPurpose } from "@/lib/types";

export type LoadedKey = {
  plaintext: string;
  config: Record<string, unknown>;
};

export async function loadApiKey(
  provider: string,
  purpose: ApiKeyPurpose,
): Promise<LoadedKey | null> {
  return getActiveApiKey(provider, purpose);
}

export async function requireApiKey(
  provider: string,
  purpose: ApiKeyPurpose,
): Promise<LoadedKey> {
  const key = await loadApiKey(provider, purpose);
  if (!key) {
    throw new Error(
      `No active ApiKey for provider=${provider} purpose=${purpose}. Add one in /admin/apikeys.`,
    );
  }
  return key;
}
