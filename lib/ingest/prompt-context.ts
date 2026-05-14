import "server-only";

/** Injects the actual current date into AI user prompts. Without this, models
 *  default to their training-cutoff year when asked to write about "the latest"
 *  or "current" anything — which is why we were seeing "for 2024" in articles
 *  long after 2024 ended. Call this at the top of every editorial prompt that
 *  asks the model to write about news, trends, or current events. */
export function currentDateContext(): string {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return [
    `Current date: ${iso} (${month} ${year}).`,
    `When the brief or trends mention "the latest", "this year", "right now", "current", or any recency claim, anchor it to ${year}.`,
    `Do NOT write headlines or copy that reference an older year (e.g. ${year - 2}, ${year - 1}) just because your training data is older. Default to ${year} unless the source explicitly names a different year.`,
  ].join(" ");
}
