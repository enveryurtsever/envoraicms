import "server-only";

export type SourceArticle = {
  title: string;
  url: string;
  excerpt: string | null;
  thumbnail: string | null;
  date: string;
  authors: string[] | null;
  keywords: string[] | null;
  publisher: { name: string; url: string } | null;
  fullContent?: string | null;
};

export type IngestCategory = {
  CatID: number;
  CatName: string;
  CatSeo: string;
};

export type Rewritten = {
  title: string;
  short: string;
  detail: string;
  keywords: string;
  desc: string;
  slug: string;
  importance: number;
  imagePrompt?: string;
  titleScore?: number;
  skip?: boolean;
  skipReason?: string;
};

export interface NewsProvider {
  name: string;
  fetchTrendings(cat: IngestCategory): Promise<SourceArticle[]>;
  fetchArticleContent(url: string): Promise<string | null>;
}

export interface TextAiProvider {
  name: string;
  rewrite(
    article: SourceArticle,
    cat: IngestCategory,
    fullContent: string | null,
  ): Promise<Rewritten>;
}

export interface ImageProvider {
  name: string;
  /**
   * Writes /Content/<slug>.webp based on the slug and returns the public path.
   * passthrough orijinal thumbnail'i indirir; falai fresh bir resim generateir.
   */
  generate(args: {
    prompt: string;
    slug: string;
    fallbackThumbnail?: string | null;
  }): Promise<string>;
}

export type PipelineOutcome = {
  inserted: number;
  skipped: number;
  errored: number;
  log: string[];
};

// --- New NewsNow-driven flow ----------------------------------------------

/** Raw article shape pulled from NewsNow (newsv2_top_news_cat).
 *  Most fields are optional because the API is best-effort; we capture
 *  whatever is present and store the original payload as JSONB for replay. */
export type NewsNowArticle = {
  title: string;
  url: string;
  excerpt?: string | null;
  top_image?: string | null;
  date?: string | null;
  authors?: string[] | null;
  publisher?: { name?: string | null; url?: string | null } | null;
  text?: string | null;
  // Anything else NewsNow returns (we'll keep it raw in DB).
  [key: string]: unknown;
};

export type NewsNowFetchParams = {
  category: string;       // BUSINESS | TECHNOLOGY | ENTERTAINMENT | …
  location?: string;      // ISO-2 country code, default "us"
  language?: string;      // ISO-2 language code, default "en"
  page?: number;          // default 1
  limit?: number;         // soft cap on returned articles per call
};

/** Output of the rewrite step that ALSO selects a site category.
 *  `categorySlug` must match one of the slugs in the prompt's category list;
 *  if none fit, Gemini may return null and the pipeline picks a fallback. */
export type RewrittenWithCategory = Rewritten & {
  categorySlug: string | null;
  categoryReason?: string | null;
};
