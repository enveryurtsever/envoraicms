"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { DateRange } from "@/lib/queries/stats";

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week",  label: "This week" },
  { value: "month", label: "This month" },
  { value: "year",  label: "This year" },
];

export function RangeSelector({ active }: { active: DateRange }) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setRange(next: DateRange) {
    const params = new URLSearchParams(search.toString());
    if (next === "today") params.delete("range");
    else params.set("range", next);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin?${qs}` : "/admin");
    });
  }

  return (
    <div
      className="adm-range"
      role="tablist"
      aria-label="Date range"
      data-pending={pending ? "1" : undefined}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active === opt.value}
          className={`adm-range__btn ${active === opt.value ? "active" : ""}`}
          onClick={() => setRange(opt.value)}
          disabled={pending}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
