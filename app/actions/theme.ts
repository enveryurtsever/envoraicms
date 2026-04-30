"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  COLOR_MODE_COOKIE,
  isColorPreference,
  type ColorPreference,
} from "@/lib/theme-mode";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setColorPreferenceAction(formData: FormData): Promise<void> {
  const raw = formData.get("preference");
  const next: ColorPreference = isColorPreference(raw) ? raw : "light";
  const c = await cookies();
  c.set(COLOR_MODE_COOKIE, next, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
  const redirectTo = String(formData.get("path") ?? "/") || "/";
  revalidatePath(redirectTo);
}
