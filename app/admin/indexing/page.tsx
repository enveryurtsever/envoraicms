import { getSettings } from "@/lib/queries/settings";
import { listRecentIndexingLog, countIndexingLog24h } from "@/lib/queries/indexing";
import { IndexingClient } from "./IndexingClient";

export const dynamic = "force-dynamic";

export default async function IndexingPage() {
  const [settings, logs, counts] = await Promise.all([
    getSettings(),
    listRecentIndexingLog(50),
    countIndexingLog24h(),
  ]);

  let saEmail: string | null = null;
  if (settings.IndexingServiceAccountJSON) {
    try {
      const parsed = JSON.parse(settings.IndexingServiceAccountJSON) as { client_email?: string };
      saEmail = parsed.client_email ?? null;
    } catch {
      saEmail = null;
    }
  }

  const logRows = logs.map((l) => ({
    ...l,
    SubmittedAt:
      l.SubmittedAt instanceof Date ? l.SubmittedAt.toISOString() : (l.SubmittedAt as unknown as string),
  }));

  return (
    <IndexingClient
      settings={settings}
      saEmail={saEmail}
      logs={logRows}
      counts={counts}
    />
  );
}
