import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const UPLOAD_ROOT = join(process.cwd(), "public", "Upload");
const BUCKET = "author";
const MAX_BYTES = 5 * 1024 * 1024;

type RandomUserResp = {
  results?: Array<{
    picture?: { large?: string; medium?: string; thumbnail?: string };
  }>;
};

/** Asks randomuser.me for a real-looking portrait URL. Returns null on
 *  network failure — caller should fall back to leaving AvatarURL null. */
async function pickRandomUserPicture(): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(
      "https://randomuser.me/api/?inc=picture&noinfo&nat=us",
      {
        signal: ctrl.signal,
        headers: { accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as RandomUserResp;
    const pic = json.results?.[0]?.picture;
    return pic?.large ?? pic?.medium ?? pic?.thumbnail ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadBuffer(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; EnvoraicmsBot/1.0; +https://envoraicms.com)",
        accept: "image/*",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls a random portrait from randomuser.me, normalises to a 256x256 webp,
 *  and writes it under /public/Upload/author/<slug>-<ts>.webp. Returns the
 *  public path or null on failure (network / decode). */
export async function fetchAndStoreAuthorAvatar(slug: string): Promise<string | null> {
  const url = await pickRandomUserPicture();
  if (!url) return null;
  const buf = await downloadBuffer(url);
  if (!buf) return null;

  const dir = join(UPLOAD_ROOT, BUCKET);
  await mkdir(dir, { recursive: true });

  const cleanSlug =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "author";
  const filename = `${cleanSlug}-${Date.now()}.webp`;

  try {
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: 256, height: 256, fit: "cover" })
      .webp({ quality: 88, effort: 6 })
      .toBuffer();
    await writeFile(join(dir, filename), out);
    return `/Upload/${BUCKET}/${filename}`;
  } catch {
    return null;
  }
}
