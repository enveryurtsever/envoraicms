import Link from "next/link";

export function TagPill({ tag }: { tag: string }) {
  return (
    <Link
      href={`/search/${encodeURIComponent(tag)}`}
      className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition-colors hover:border-brand hover:text-brand"
    >
      #{tag}
    </Link>
  );
}
