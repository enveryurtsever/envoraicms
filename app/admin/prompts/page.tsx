import { listPrompts, findDefault } from "@/lib/queries/prompts";
import { PromptsClient } from "./PromptsClient";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const prompts = await listPrompts();
  const enriched = prompts.map((p) => ({
    PromptKey: p.PromptKey,
    Label: p.Label,
    Description: p.Description,
    Template: p.Template,
    UpdatedAt: p.UpdatedAt instanceof Date ? p.UpdatedAt.toISOString() : (p.UpdatedAt as unknown as string | null),
    hasDefault: !!findDefault(p.PromptKey),
  }));
  return <PromptsClient prompts={enriched} />;
}
