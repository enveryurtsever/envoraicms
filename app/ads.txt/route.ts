import { getSettings } from "@/lib/queries/settings";

export const dynamic = "force-dynamic";

// Generated from the Publisher ID in Google Kit, so each site gets its own.
// f08c47fec0942fa0 is Google's fixed certification authority ID.
export async function GET() {
  const { AdsensePublisherID: raw } = await getSettings();
  const publisher = raw?.trim().match(/pub-\d+/)?.[0];
  if (!publisher) return new Response("Not found", { status: 404 });

  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
