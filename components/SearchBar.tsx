"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const MIN_SEARCH_LENGTH = 4;

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = q.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH;

  return (
    <form
      role="search"
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        if (trimmed.length < MIN_SEARCH_LENGTH) {
          setError(`Please enter at least ${MIN_SEARCH_LENGTH} characters.`);
          return;
        }
        setError(null);
        router.push(`/search/${encodeURIComponent(trimmed)}`);
      }}
    >
      <div
        className={`flex w-full items-center overflow-hidden rounded-full border bg-white transition-colors focus-within:border-brand ${
          error ? "border-brand" : "border-neutral-200"
        } ${compact ? "h-10" : "h-12"}`}
      >
        <span className="flex h-full items-center pl-5 text-neutral-400" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (error) setError(null);
          }}
          placeholder={`Search news — min. ${MIN_SEARCH_LENGTH} characters…`}
          aria-label="Search"
          minLength={MIN_SEARCH_LENGTH}
          className="h-full flex-1 bg-transparent px-4 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          aria-label="Search"
          disabled={tooShort}
          className="flex h-full items-center justify-center bg-brand px-6 text-white transition-colors hover:bg-[#a31620] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 pl-5 text-xs text-brand">
          {error}
        </p>
      ) : null}
    </form>
  );
}
