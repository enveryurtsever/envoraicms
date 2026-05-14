"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { setColorPreferenceAction } from "@/app/actions/theme";
import type { ColorMode } from "@/lib/theme-mode";

export function ColorModeToggle({ current }: { current: ColorMode }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const next: ColorMode = current === "dark" ? "light" : "dark";

  return (
    <form
      action={(formData) => startTransition(() => setColorPreferenceAction(formData))}
      className="inline-flex"
    >
      <input type="hidden" name="preference" value={next} />
      <input type="hidden" name="path" value={pathname || "/"} />
      <button
        type="submit"
        aria-label={`Switch to ${next} mode`}
        aria-pressed={current === "dark"}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-current opacity-80 transition-opacity hover:opacity-100 disabled:opacity-50"
      >
        {current === "dark" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm11-9.95h-2V3h2v.05zM20.84 4.84l-1.79-1.79-1.8 1.79 1.8 1.79 1.79-1.79zM17.24 19.16l1.79 1.8 1.8-1.8-1.8-1.79-1.79 1.79zM20 11v2h3v-2h-3zm-8 8.95V22h2v-2.05h-2zM6.76 19.16l-1.79 1.8-1.8-1.8 1.8-1.79 1.79 1.79zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.742 13.045a8 8 0 0 1-8.787-8.787A8.001 8.001 0 1 0 20.742 13.045Z" />
          </svg>
        )}
      </button>
    </form>
  );
}
