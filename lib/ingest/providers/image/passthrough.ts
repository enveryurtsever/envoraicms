import "server-only";
import type { ImageProvider } from "@/lib/ingest/types";
import { saveContentImage } from "./save";

export function makePassthroughProvider(): ImageProvider {
  return {
    name: "passthrough",
    async generate({ slug, fallbackThumbnail }) {
      if (!fallbackThumbnail) {
        throw new Error("passthrough provider: fallbackThumbnail missing");
      }
      const res = await fetch(fallbackThumbnail, {
        headers: { "User-Agent": "Mozilla/5.0 envoraicms-ingest" },
      });
      if (!res.ok) throw new Error(`Image fetch ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return saveContentImage(buf, slug);
    },
  };
}
