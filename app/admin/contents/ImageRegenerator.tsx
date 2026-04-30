"use client";

import { useState } from "react";

type Props = {
  contentId: number | null;
  initialImage: string | null;
};

export function ImageRegenerator({ contentId, initialImage }: Props) {
  const [src, setSrc] = useState<string | null>(initialImage ?? null);
  const [bust, setBust] = useState<number>(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!contentId) {
    return (
      <div className="form-row">
        <label>Image</label>
        <small>
          After the content is saved &quot;Regenerate image&quot; butonu burada
          appears here.
        </small>
      </div>
    );
  }

  const trigger = async () => {
    const promptEl = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
      '[name="ImagePrompt"]',
    );
    const prompt = promptEl?.value?.trim() ?? "";

    setError(null);
    setOk(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/ai/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, prompt }),
      });
      const data = (await res.json().catch(() => null)) as
        | { imageUrl?: string; cacheBust?: number; error?: string; message?: string }
        | null;
      if (!res.ok || !data?.imageUrl) {
        throw new Error(data?.message ?? `Generation failed (${res.status}).`);
      }
      setSrc(data.imageUrl);
      setBust(data.cacheBust ?? Date.now());
      setOk("Image updated.");
      const imgField = document.querySelector<HTMLInputElement>('[name="ContentImage"]');
      if (imgField) imgField.value = data.imageUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setPending(false);
    }
  };

  const display = src ? (bust ? `${src}?v=${bust}` : src) : null;

  return (
    <div className="form-row">
      <label>Current image</label>
      <div>
        {display ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display}
            alt="Image preview"
            style={{
              maxWidth: 360,
              width: "100%",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              marginBottom: 8,
            }}
          />
        ) : (
          <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 8 }}>
            No image yet.
          </div>
        )}
        <button
          type="button"
          className="btn secondary small"
          onClick={trigger}
          disabled={pending}
        >
          {pending ? "Generating…" : "Regenerate image"}
        </button>
        <small style={{ marginLeft: 8 }}>
          The fal.ai (image_ai) key must be active. Prompt is taken from the &quot;Image AI prompt&quot; field.
        </small>
        {ok ? (
          <div className="alert success" style={{ marginTop: 8 }}>
            {ok}
          </div>
        ) : null}
        {error ? (
          <div className="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
