import "server-only";
import type { IngestCategory, NewsProvider, SourceArticle } from "@/lib/ingest/types";
import { requireApiKey } from "@/lib/ingest/config";

const HOST = "news-api14.p.rapidapi.com";

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export async function makeNewsApi14Provider(): Promise<NewsProvider> {
  const key = await requireApiKey("newsapi", "news_source");
  const apiKey = key.plaintext;
  const language = (key.config.language as string | undefined) ?? "en";
  const country = (key.config.country as string | undefined) ?? "us";

  const headers = {
    "x-rapidapi-host": HOST,
    "x-rapidapi-key": apiKey,
  };

  return {
    name: "newsapi",
    async fetchTrendings(cat: IngestCategory): Promise<SourceArticle[]> {
      const topic = titleCase(cat.CatSeo);
      const today = new Date().toISOString().slice(0, 10);
      const url = new URL(`https://${HOST}/v2/trendings`);
      url.searchParams.set("date", today);
      url.searchParams.set("topic", topic);
      url.searchParams.set("language", language);
      url.searchParams.set("country", country);
      url.searchParams.set("page", "1");

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`trendings ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        success?: boolean;
        data?: Array<SourceArticle & { paywall?: boolean }>;
      };
      return (json.data ?? []).filter(
        (a) => a.title && a.url && a.thumbnail && !a.paywall,
      );
    },
    async fetchArticleContent(articleUrl: string): Promise<string | null> {
      const url = new URL(`https://${HOST}/v2/article`);
      url.searchParams.set("url", articleUrl);
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { content?: string } };
      return json.data?.content ?? null;
    },
  };
}
