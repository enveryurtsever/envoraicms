import { redirect } from "next/navigation";
import { getUserByEmail } from "@/lib/queries/users";
import { verifyPassword } from "@/lib/auth/password";
import { setSession, getSession } from "@/lib/auth/session";
import { updateLastLogin } from "@/lib/queries/users";
import { logAudit } from "@/lib/audit";
import { getClientIp, isIpLocked, recordLoginAttempt } from "@/lib/auth/login-guard";

export const dynamic = "force-dynamic";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !password) {
    redirect("/admin/login?error=missing");
  }

  const ip = await getClientIp();
  const lock = await isIpLocked(ip);
  if (lock.locked) {
    const mins = Math.max(1, Math.ceil(lock.retryAfterSec / 60));
    redirect(`/admin/login?error=locked&mins=${mins}`);
  }

  const user = await getUserByEmail(email);
  if (!user || !user.IsActive) {
    await recordLoginAttempt(ip, email || null, false);
    redirect("/admin/login?error=invalid");
  }
  const ok = await verifyPassword(password, user.PasswordHash);
  if (!ok) {
    await recordLoginAttempt(ip, email, false);
    redirect("/admin/login?error=invalid");
  }

  await recordLoginAttempt(ip, email, true);
  await setSession({
    uid: user.UserID,
    role: user.Role,
    email: user.Email,
    displayName: user.DisplayName,
  });
  await updateLastLogin(user.UserID);
  await logAudit("auth", "signed in");

  // Strip `next` values that point back to /admin/logout (or its prefix) so
  // a logout-mid-flight doesn't trap the next sign-in in a redirect loop.
  const safeNext =
    next.startsWith("/admin") && !next.startsWith("/admin/logout")
      ? next
      : "/admin";
  redirect(safeNext);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; mins?: string }>;
}) {
  const sp = await searchParams;
  const existing = await getSession();
  if (existing) redirect("/admin");

  const errorMsg =
    sp.error === "invalid"
      ? "Invalid email or password."
      : sp.error === "inactive"
        ? "This account is inactive or deleted."
        : sp.error === "missing"
          ? "Email and password are required."
          : sp.error === "locked"
            ? `Too many failed attempts. Try again in ~${Math.max(1, Number(sp.mins ?? "15"))} min.`
            : null;

  return (
    <div className="login-page">
      <form action={loginAction} className="login-box">
        <h1>Admin Sign In</h1>
        {errorMsg ? <div className="alert error">{errorMsg}</div> : null}
        <input type="hidden" name="next" value={sp.next ?? "/admin"} />
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoFocus autoComplete="username" />
        </div>
        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button type="submit" className="btn">Sign in</button>
      </form>
    </div>
  );
}
