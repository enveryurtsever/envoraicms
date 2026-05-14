import { searchAction } from "@/lib/actions/search";

export const MIN_SEARCH_LENGTH = 4;

export function SearchBar({ compact = false }: { compact?: boolean }) {
  return (
    <form role="search" className="w-full" action={searchAction}>
      <div
        className={`flex w-full items-center overflow-hidden rounded-full border border-neutral-200 bg-white transition-colors focus-within:border-brand dark:border-neutral-700 dark:bg-neutral-900 ${
          compact ? "h-10" : "h-12"
        }`}
      >
        <span className="flex h-full items-center pl-5 text-neutral-400 dark:text-neutral-500" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="search"
          name="q"
          required
          minLength={MIN_SEARCH_LENGTH}
          maxLength={100}
          placeholder="Search"
          aria-label="Search"
          className="h-full flex-1 bg-transparent px-4 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-full items-center justify-center bg-brand px-6 text-white transition-colors hover:bg-[#a31620]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>
    </form>
  );
}
