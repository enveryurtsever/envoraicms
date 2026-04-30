import "server-only";
import type { TextAIClient } from "./index";

// Anthropic Claude adapter via raw fetch (no SDK dependency). The Messages
// API doesn't have a strict JSON mode like OpenAI, so we instruct the model
// to return ONLY a JSON object and then extract the first {...} block.
//
// Default model can be overridden per-key via ApiKeys.Config.model.

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5";

type MessagesResp = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { type?: string; message?: string };
};

function extractJsonBlock(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function makeAnthropicTextClient(args: {
  apiKey: string;
  config: Record<string, unknown>;
}): TextAIClient {
  const defaultModel =
    (args.config.model as string | undefined) ?? DEFAULT_MODEL;
  const maxTokensCfg = Number(args.config.max_tokens);
  const defaultMaxTokens = Number.isFinite(maxTokensCfg) && maxTokensCfg > 0
    ? maxTokensCfg
    : 4096;

  return {
    name: "anthropic",
    async generateJSON<T = unknown>(req: {
      system: string;
      user: string;
      modelOverride?: string;
    }): Promise<T> {
      const systemWithJsonNudge = `${req.system}

Respond with ONLY a single JSON object. No markdown fences, no commentary, no
prose before or after.`;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": args.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: req.modelOverride ?? defaultModel,
            max_tokens: defaultMaxTokens,
            system: systemWithJsonNudge,
            messages: [{ role: "user", content: req.user }],
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json().catch(() => null)) as MessagesResp | null;
      if (!data || data.error) {
        throw new Error(
          `Anthropic error: ${data?.error?.message ?? "no body"}`,
        );
      }
      const text = (data.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text!)
        .join("\n")
        .trim();
      if (!text) throw new Error("Anthropic returned empty content");

      const block = extractJsonBlock(text) ?? text;
      try {
        return JSON.parse(block) as T;
      } catch {
        throw new Error(
          `Anthropic returned non-JSON: ${block.slice(0, 200)}`,
        );
      }
    },
  };
}
