import "server-only";
import type { ImageProvider } from "@/lib/ingest/types";
import { requireApiKey } from "@/lib/ingest/config";
import { saveContentImage } from "./save";

type FalQueueResponse = {
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url?: string;
};

type FalImagesResponse = {
  images: Array<{ url: string; width?: number; height?: number; content_type?: string }>;
};

const DEFAULTS = {
  model: "fal-ai/flux/schnell",
  imageSize: "landscape_16_9",
  numInferenceSteps: 4,
  pollIntervalMs: 1500,
  pollTimeoutMs: 60_000,
};

export async function makeFalaiProvider(): Promise<ImageProvider> {
  const key = await requireApiKey("falai", "image_ai");
  const token = key.plaintext;
  const model = (key.config.model as string | undefined) ?? DEFAULTS.model;
  const imageSize = (key.config.imageSize as string | undefined) ?? DEFAULTS.imageSize;
  const numInferenceSteps =
    Number(key.config.numInferenceSteps) || DEFAULTS.numInferenceSteps;

  const baseHeaders = {
    Authorization: `Key ${token}`,
    "Content-Type": "application/json",
  };

  async function submit(prompt: string): Promise<string> {
    const submitUrl = `https://queue.fal.run/${model}`;
    const res = await fetch(submitUrl, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_inference_steps: numInferenceSteps,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`fal.ai submit ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as FalQueueResponse;
    return json.status_url;
  }

  async function poll(statusUrl: string): Promise<string> {
    const deadline = Date.now() + DEFAULTS.pollTimeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(statusUrl, { headers: baseHeaders });
      if (!res.ok) {
        await sleep(DEFAULTS.pollIntervalMs);
        continue;
      }
      const json = (await res.json()) as {
        status: string;
        response_url?: string;
      };
      if (json.status === "COMPLETED" && json.response_url) {
        return json.response_url;
      }
      if (json.status === "FAILED" || json.status === "ERROR") {
        throw new Error(`fal.ai job failed: ${JSON.stringify(json).slice(0, 200)}`);
      }
      await sleep(DEFAULTS.pollIntervalMs);
    }
    throw new Error("fal.ai poll timeout");
  }

  async function fetchResult(responseUrl: string): Promise<string> {
    const res = await fetch(responseUrl, { headers: baseHeaders });
    if (!res.ok) {
      throw new Error(`fal.ai result ${res.status}`);
    }
    const json = (await res.json()) as FalImagesResponse;
    if (!json.images?.[0]?.url) {
      throw new Error("fal.ai result has no image URL");
    }
    return json.images[0].url;
  }

  async function fetchPassthrough(thumbnailUrl: string, slug: string): Promise<string> {
    const res = await fetch(thumbnailUrl, {
      headers: { "User-Agent": "Mozilla/5.0 envoraicms-ingest" },
    });
    if (!res.ok) throw new Error(`Image fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return saveContentImage(buf, slug);
  }

  return {
    name: "falai",
    async generate({ prompt, slug, fallbackThumbnail }) {
      if (!prompt || prompt.trim().length < 8) {
        if (fallbackThumbnail) return fetchPassthrough(fallbackThumbnail, slug);
        throw new Error("fal.ai: prompt empty and no fallback thumbnail");
      }
      const statusUrl = await submit(prompt);
      const responseUrl = await poll(statusUrl);
      const imageUrl = await fetchResult(responseUrl);

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`fal.ai image fetch ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());

      return saveContentImage(buf, slug);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
