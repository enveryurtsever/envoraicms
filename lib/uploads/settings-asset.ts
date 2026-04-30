import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const UPLOAD_DIR = join(process.cwd(), "public", "Upload");

type Preset = {
  maxWidth: number;
  maxHeight?: number;
  quality: number;
  effort: number;
  format: "webp" | "png";
};

// `favicon` is kept square; PNG output preserves transparency for /favicon.ico
// fallbacks even when the source is a transparent PNG. Other assets convert to
// WebP for a smaller payload.
const PRESETS: Record<string, Preset> = {
  logo:    { maxWidth: 600,  quality: 90, effort: 6, format: "webp" },
  cover:   { maxWidth: 1600, quality: 82, effort: 6, format: "webp" },
  favicon: { maxWidth: 256, maxHeight: 256, quality: 92, effort: 6, format: "png" },
};

export type AssetKind = keyof typeof PRESETS;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export async function saveSettingsAsset(
  file: File,
  kind: AssetKind
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds the 5 MB limit.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const preset = PRESETS[kind];
  const ts = Date.now();
  const ext = preset.format;
  const filename = `${kind}-${ts}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });

  let pipeline = sharp(buf, { failOn: "none" }).rotate();
  if (kind === "favicon") {
    pipeline = pipeline.resize({
      width: preset.maxWidth,
      height: preset.maxHeight ?? preset.maxWidth,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  } else {
    pipeline = pipeline.resize({
      width: preset.maxWidth,
      withoutEnlargement: true,
    });
  }
  const out =
    preset.format === "png"
      ? await pipeline.png({ quality: preset.quality, effort: preset.effort }).toBuffer()
      : await pipeline.webp({ quality: preset.quality, effort: preset.effort }).toBuffer();

  await writeFile(join(UPLOAD_DIR, filename), out);
  return `/Upload/${filename}`;
}

// Generic media uploader for category / content image fields. Unlike settings
// assets these are user-supplied editorial images: we keep the original aspect
// ratio, write to `public/Upload/<bucket>/`, and the caller stores the public
// path on the row. Buckets are created on first use.
const MEDIA_PRESETS: Record<string, { maxWidth: number; quality: number }> = {
  category: { maxWidth: 1600, quality: 82 },
  content:  { maxWidth: 1600, quality: 82 },
  author:   { maxWidth: 512,  quality: 88 },
};

export type MediaBucket = keyof typeof MEDIA_PRESETS;

export async function saveMediaAsset(
  file: File,
  bucket: MediaBucket,
  slugHint?: string,
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds the 5 MB limit.");
  }

  const dir = join(UPLOAD_DIR, bucket);
  await mkdir(dir, { recursive: true });

  const slug = (slugHint ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || bucket;

  const preset = MEDIA_PRESETS[bucket];
  const ts = Date.now();
  const filename = `${slug}-${ts}.webp`;

  const buf = Buffer.from(await file.arrayBuffer());
  const out = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: preset.maxWidth, withoutEnlargement: true })
    .webp({ quality: preset.quality, effort: 6 })
    .toBuffer();

  await writeFile(join(dir, filename), out);
  return `/Upload/${bucket}/${filename}`;
}
