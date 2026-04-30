import { Suspense } from "react";
import { listPrompts, findDefault } from "@/lib/queries/prompts";
import { CardSkeleton } from "@/components/admin-ui/Skeletons";
import { PromptsClient } from "./PromptsClient";

export const dynamic = "force-dynamic";

export default function PromptsPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className="admin-header">
            <div>
              <div className="adm-skel adm-skel-title" />
              <div className="adm-skel adm-skel-sub" />
            </div>
          </div>
          <CardSkeleton rows={6} />
          <CardSkeleton rows={6} />
        </>
      }
    >
      <PromptsData />
    </Suspense>
  );
}

async function PromptsData() {
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
