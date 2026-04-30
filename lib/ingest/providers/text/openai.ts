import "server-only";
import type { TextAIClient } from "./index";

// OpenAI Chat Completions adapter. Uses raw fetch so we don't introduce a new
// npm dependency. JSON mode via response_format={ type: "json_object" }.
//
// Default model can be overridden per-key via ApiKeys.Config.model.

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

type ChatResp = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export function makeOpenAITextClient(args: {
  apiKey: string;
  config: Record<string, unknown>;
}): TextAIClient {
  const defaultModel =
    (args.config.model as string | undefined) ?? DEFAULT_MODEL;

  return {
    name: "openai",
    async generateJSON<T = unknown>(req: {
      system: string;
      user: string;
      modelOverride?: string;
    }): Promise<T> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.apiKey}`,
          },
          body: JSON.stringify({
            model: req.modelOverride ?? defaultModel,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json().catch(() => null)) as ChatResp | null;
      if (!data || data.error) {
        throw new Error(`OpenAI error: ${data?.error?.message ?? "no body"}`);
      }
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new Error("OpenAI returned empty content");
      }
      try {
        return JSON.parse(content) as T;
      } catch {
        throw new Error(`OpenAI returned non-JSON: ${content.slice(0, 200)}`);
      }
    },
  };
}
