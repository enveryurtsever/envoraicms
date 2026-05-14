import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/queries/users";
import { ToastProvider } from "@/components/admin-ui/Toast";
import { AdminHeader } from "@/components/admin-ui/AdminHeader";
import { SidebarNav, type NavItem } from "@/components/admin-ui/SidebarNav";
import "./admin.css";

// Note: no `force-dynamic` here — getSession() reads cookies which already
// makes every admin segment dynamic. Dropping the explicit flag lets Next
// dedup in-flight requests for the same path (eg. rapid double-clicks).

export const metadata = {
  title: {
    template: "%s · ENVORAICMS",
    default: "Admin · ENVORAICMS",
  },
  robots: { index: false, follow: false },
};

const NAV_ITEMS: (NavItem & { adminOnly?: boolean })[] = [
  { href: "/admin",            label: "Dashboard",      icon: "dashboard" },
  { href: "/admin/contents",   label: "Articles",       icon: "newspaper", group: "Content" },
  { href: "/admin/drafts",     label: "Drafts",         icon: "inbox" },
  { href: "/admin/categories", label: "Categories",     icon: "folder" },
  { href: "/admin/authors",    label: "Authors",        icon: "users" },
  { href: "/admin/links",      label: "Pages",          icon: "link" },
  { href: "/admin/cronjobs",   label: "Automation",     icon: "clock" },
  { href: "/admin/apikeys",    label: "API Keys",       icon: "key", adminOnly: true, group: "System" },
  { href: "/admin/settings",   label: "Settings",       icon: "settings" },
  { href: "/admin/googlekit",  label: "Google Kit",     icon: "search", adminOnly: true },
  { href: "/admin/indexing",   label: "Search Console", icon: "satellite", adminOnly: true },
  { href: "/admin/ads",        label: "Ads",            icon: "megaphone", adminOnly: true },
  { href: "/admin/prompts",    label: "AI Prompts",     icon: "wand", adminOnly: true },
  { href: "/admin/themes",     label: "Themes",         icon: "palette" },
  { href: "/admin/users",      label: "Users",          icon: "users", adminOnly: true },
  { href: "/admin/logs",       label: "Audit Logs",     icon: "scroll", adminOnly: true },
  { href: "/admin/system/update", label: "Updates",     icon: "download", adminOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  const session = await getSession();
  if (!session) redirect("/admin/login");
  const user = await getUserById(session.uid);
  if (!user || !user.IsActive) redirect("/admin/login?error=inactive");

  const visibleItems: NavItem[] = NAV_ITEMS.filter(
    (i) => !i.adminOnly || user.Role === "admin",
  ).map(({ adminOnly: _adminOnly, ...rest }) => rest);

  return (
    <ToastProvider>
      <div className="admin-shell" style={{ display: "flex" }}>
        <aside className="admin-sidebar">
          <div className="admin-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/admin-logo.png" alt="Envorai" />
            <div className="admin-brand__tagline">Next-gen AI-powered CMS</div>
          </div>
          <SidebarNav items={visibleItems} />
        </aside>
        <main className="admin-main">
          <AdminHeader
            user={{
              displayName: user.DisplayName,
              email: user.Email,
              role: user.Role,
              avatarUrl: user.AvatarURL ?? null,
            }}
          />
          <div className="admin-content">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
