"use server";

import { redirect } from "next/navigation";

const MIN_SEARCH_LENGTH = 4;

export async function searchAction(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim().slice(0, 100);
  if (q.length < MIN_SEARCH_LENGTH) {
    redirect("/");
  }
  redirect(`/search/${encodeURIComponent(q)}`);
}
