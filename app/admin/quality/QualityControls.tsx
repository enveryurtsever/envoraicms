"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin-ui/Toast";
import { redirectArticleAction, saveQualitySettings } from "./actions";

function errorMessage(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

export function QualitySettingsForm({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await saveQualitySettings(fd);
        toast.success("Settings saved");
      } catch (err) {
        toast.error("Couldn't save settings", errorMessage(err));
      }
    });
  }

  return (
    <form action={submit} className="card">
      {children}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

/** Runs the scan with a visible working state, then brings the results into
 *  view, since they render below the fold on most screens. */
export function ScanButton({ hasResults }: { hasResults: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scrollWhenDone = useRef(false);

  useEffect(() => {
    if (pending || !scrollWhenDone.current) return;
    scrollWhenDone.current = false;
    document
      .getElementById("archive-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pending]);

  function scan() {
    scrollWhenDone.current = true;
    startTransition(() => {
      if (hasResults) router.refresh();
      else router.push("/admin/quality?scan=1", { scroll: false });
    });
  }

  return (
    <button type="button" className="btn" onClick={scan} disabled={pending}>
      {pending ? "Scanning…" : hasResults ? "Scan again" : "Scan archive"}
    </button>
  );
}

export function RedirectForm({
  id,
  title,
  defaultTarget,
}: {
  id: number;
  title: string;
  defaultTarget: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await redirectArticleAction(fd);
        toast.success("Article redirected");
        router.refresh();
      } catch (err) {
        toast.error("Couldn't redirect the article", errorMessage(err));
      }
    });
  }

  return (
    <form action={submit} style={{ display: "flex", gap: "0.4rem", flex: 1 }}>
      <input type="hidden" name="id" value={id} />
      <input
        type="text"
        name="target"
        required
        aria-label={`Redirect target for ${title}`}
        defaultValue={defaultTarget ?? ""}
        placeholder="/category/article"
        style={{ flex: 1, minWidth: 0 }}
      />
      <button type="submit" className="btn secondary small" disabled={pending}>
        {pending ? "…" : "301"}
      </button>
    </form>
  );
}
