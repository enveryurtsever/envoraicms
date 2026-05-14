"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-brand">Oops</p>
      <h1 className="mt-3 text-3xl font-bold text-neutral-900 md:text-4xl dark:text-neutral-100">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
        We hit an unexpected error. Please try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c94810]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:border-brand hover:text-brand dark:border-neutral-700 dark:text-neutral-300"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
