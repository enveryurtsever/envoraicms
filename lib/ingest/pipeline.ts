import "server-only";
import type {
  ImageProvider,
  IngestCategory,
  NewsProvider,
  PipelineOutcome,
  TextAiProvider,
} from "./types";
import {
  alreadyIngested,
  ensureUniqueSlug,
  insertIngestedContent,
} from "./db";

export type PipelineInput = {
  cat: IngestCategory;
  articlesPerRun: number;
  news: NewsProvider;
  text: TextAiProvider;
  image: ImageProvider;
  imageFallback?: ImageProvider;
};

export async function runPipeline(input: PipelineInput): Promise<PipelineOutcome> {
  const { cat, articlesPerRun, news, text, image, imageFallback } = input;
  const log: string[] = [];
  let inserted = 0;
  let skipped = 0;
  let errored = 0;

  log.push(`[start] category=${cat.CatName} (CatID=${cat.CatID}) target=${articlesPerRun}`);

  let articles;
  try {
    articles = await news.fetchTrendings(cat);
  } catch (err) {
    errored += 1;
    log.push(`[fatal] news.fetchTrendings: ${errMsg(err)}`);
    return { inserted, skipped, errored, log };
  }
  log.push(`[news] ${news.name} returned ${articles.length} candidates`);

  for (const article of articles) {
    if (inserted >= articlesPerRun) break;
    try {
      if (await alreadyIngested(article.url)) {
        skipped += 1;
        log.push(`[skip] duplicate url=${article.url}`);
        continue;
      }
      const fullContent = await safeCall(() => news.fetchArticleContent(article.url));
      const rewritten = await text.rewrite(article, cat, fullContent);
      if (rewritten.skip) {
        skipped += 1;
        log.push(`[skip] ai-filter reason="${rewritten.skipReason ?? "unspecified"}" url=${article.url}`);
        continue;
      }
      rewritten.slug = await ensureUniqueSlug(rewritten.slug);

      let imagePath: string;
      try {
        imagePath = await image.generate({
          prompt: rewritten.imagePrompt ?? rewritten.title,
          slug: rewritten.slug,
          fallbackThumbnail: article.thumbnail,
        });
        log.push(`[image] ${image.name} slug=${rewritten.slug}`);
      } catch (imgErr) {
        log.push(`[image-fail] ${image.name}: ${errMsg(imgErr)}`);
        if (imageFallback) {
          imagePath = await imageFallback.generate({
            prompt: rewritten.imagePrompt ?? rewritten.title,
            slug: rewritten.slug,
            fallbackThumbnail: article.thumbnail,
          });
          log.push(`[image-fallback] ${imageFallback.name} slug=${rewritten.slug}`);
        } else {
          throw imgErr;
        }
      }

      const id = await insertIngestedContent({
        cat,
        article,
        rewritten,
        imagePath,
        staggerMinutes: inserted * 15,
      });
      inserted += 1;
      log.push(
        `[ok] ContentID=${id} importance=${rewritten.importance}${
          rewritten.titleScore != null ? ` titleScore=${rewritten.titleScore}` : ""
        } slug=${rewritten.slug}`,
      );
    } catch (err) {
      errored += 1;
      log.push(`[error] url=${article.url}: ${errMsg(err)}`);
    }
  }

  log.push(`[done] inserted=${inserted}/${articlesPerRun} skipped=${skipped} errored=${errored}`);
  return { inserted, skipped, errored, log };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
