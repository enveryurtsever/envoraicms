import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-brand">404</p>
      <h1 className="mt-3 text-3xl font-bold text-neutral-900 md:text-4xl">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-neutral-600">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c94810]"
      >
        Back to Home
      </Link>
    </div>
  );
}
