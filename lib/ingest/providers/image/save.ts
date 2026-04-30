import "server-only";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const PROJECT_ROOT = process.cwd();
const CONTENT_DIR = join(PROJECT_ROOT, "public", "Content");
const THUMB_DIR = join(CONTENT_DIR, "thumb");

const MAX_WIDTH = 1280;
const THUMB_WIDTH = 600;
const FULL_QUALITY = 82;
const THUMB_QUALITY = 78;
const ENCODE_EFFORT = 6;

export async function saveContentImage(buf: Buffer, slug: string): Promise<string> {
  await mkdir(CONTENT_DIR, { recursive: true });
  await mkdir(THUMB_DIR, { recursive: true });

  const fullPath = join(CONTENT_DIR, `${slug}.webp`);
  const thumbPath = join(THUMB_DIR, `${slug}.webp`);

  const base = sharp(buf, { failOn: "none" }).rotate();

  await base
    .clone()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: FULL_QUALITY, effort: ENCODE_EFFORT })
    .toFile(fullPath);

  await base
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: ENCODE_EFFORT })
    .toFile(thumbPath);

  return `/Content/${slug}.webp`;
}
