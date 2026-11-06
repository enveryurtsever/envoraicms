const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

// Google is retiring these generations and new API users can't reach them, so a
// model name saved on an older site must not keep that site on one.
const RETIRED_MODEL = /^(models\/)?gemini-(1|2)(\.|-)/i;

/** The model to call for an API key, given the config saved with that key. */
export function geminiModelFor(config: Record<string, unknown>): string {
  const saved = typeof config.model === "string" ? config.model.trim() : "";
  return saved && !RETIRED_MODEL.test(saved) ? saved : DEFAULT_GEMINI_MODEL;
}
