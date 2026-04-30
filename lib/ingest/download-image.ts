import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const UPLOAD_ROOT = join(process.cwd(), "public", "Upload");

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/**
 * Downloads an external image (e.g. NewsNow top_image), runs it through sharp
 * to enforce a sane max width and convert to WebP, and writes it under
 * /Upload/<bucket>/<slug>-<ts>.webp. Returns the public path.
 *
 * Throws when the URL is missing/unreachable, the response is not an image,
 * the payload exceeds MAX_BYTES, or sharp can't decode it. Callers should
 * catch and fall back to passing the original URL through.
 */
export async function downloadAndStoreImage(args: {
  url: string;
  bucket: "content" | "category";
  slug: string;
  maxWidth?: number;
  quality?: number;
}): Promise<string> {
  const { url, bucket, slug } = args;
  if (!url || typeof url !== "string") throw new Error("missing url");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // Some hosts 403 default fetch; pretend to be a real client.
        "user-agent":
          "Mozilla/5.0 (compatible; EnvoraicmsBot/1.0; +https://envoraicms.com)",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const ct = (res.headers.get("content-type") ?? "").toLowerCase().split(";")[0].trim();
  if (ct && !ALLOWED_CONTENT_TYPES.has(ct)) {
    throw new Error(`unsupported content-type: ${ct}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("empty body");
  if (buf.byteLength > MAX_BYTES) throw new Error("file too large");

  const dir = join(UPLOAD_ROOT, bucket);
  await mkdir(dir, { recursive: true });

  const cleanSlug =
    (slug || bucket)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || bucket;
  const ts = Date.now();
  const filename = `${cleanSlug}-${ts}.webp`;

  const out = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: args.maxWidth ?? 1600, withoutEnlargement: true })
    .webp({ quality: args.quality ?? 82, effort: 6 })
    .toBuffer();

  await writeFile(join(dir, filename), out);
  return `/Upload/${bucket}/${filename}`;
}
