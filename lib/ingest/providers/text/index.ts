import "server-only";
import { getSettings } from "@/lib/queries/settings";
import { getActiveApiKey } from "@/lib/queries/apikeys";
import { makeGeminiTextClient } from "./gemini";
import { makeOpenAITextClient } from "./openai";
import { makeAnthropicTextClient } from "./anthropic";

export type TextProviderName = "gemini" | "openai" | "anthropic";

const SUPPORTED: readonly TextProviderName[] = ["gemini", "openai", "anthropic"];
export const TEXT_PROVIDERS: readonly TextProviderName[] = SUPPORTED;

export function isTextProviderName(v: unknown): v is TextProviderName {
  return typeof v === "string" && (SUPPORTED as readonly string[]).includes(v);
}

export interface TextAIClient {
  readonly name: TextProviderName;
  /** Sends a system + user prompt and returns parsed JSON.
   *  Throws on API errors / non-JSON responses. */
  generateJSON<T = unknown>(args: {
    system: string;
    user: string;
    /** Optional override; provider falls back to ApiKeys.Config.model. */
    modelOverride?: string;
  }): Promise<T>;
}

export type TextRole = "meta" | "content";

/** Dispatches to the active text AI for the requested role.
 *  - role='meta'    → Settings.MetaProvider    (default 'gemini')
 *  - role='content' → Settings.ContentProvider (default 'gemini')
 *  Each provider's API key is loaded from ApiKeys (provider, purpose='text_ai').
 */
export async function getActiveTextAI(role: TextRole): Promise<TextAIClient> {
  const settings = await getSettings();
  const requested =
    role === "meta" ? settings.MetaProvider : settings.ContentProvider;
  const provider: TextProviderName = isTextProviderName(requested)
    ? requested
    : "gemini";

  const key = await getActiveApiKey(provider, "text_ai");
  if (!key) {
    throw new Error(
      `No active ${provider} API key for text_ai. Add one in /admin/apikeys.`,
    );
  }

  switch (provider) {
    case "gemini":
      return makeGeminiTextClient({ apiKey: key.plaintext, config: key.config });
    case "openai":
      return makeOpenAITextClient({ apiKey: key.plaintext, config: key.config });
    case "anthropic":
      return makeAnthropicTextClient({ apiKey: key.plaintext, config: key.config });
  }
}
