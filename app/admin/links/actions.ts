"use server";
import DOMPurify from "isomorphic-dompurify";
import { revalidateTag } from "next/cache";
import { requireRole, getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import {
  createLink,
  softDeleteLink,
  updateLink,
  type LinkInput,
} from "@/lib/queries/admin-links";
import { getSettings } from "@/lib/queries/settings";
import { getActiveTextAI } from "@/lib/ingest/providers/text";
import { logAudit } from "@/lib/audit";

function slugify(s: string): string {
  return s.toLowerCase().replace(/['’"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
function bool(fd: FormData, k: string): boolean {
  const v = fd.get(k);
  return v === "on" || v === "true";
}
function num(fd: FormData, k: string): number {
  const v = Number(fd.get(k));
  return Number.isFinite(v) ? v : 0;
}

function sanitize(html: string | null): string | null {
  if (!html) return null;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "b", "i", "u", "a",
      "ul", "ol", "li", "blockquote",
      "h2", "h3", "h4",
      "img", "figure", "figcaption",
      "code", "pre", "hr",
    ],
    ALLOWED_ATTR: ["href", "title", "alt", "src", "target", "rel"],
  });
}

function parseForm(fd: FormData): LinkInput {
  const title = str(fd, "LinkTitle") ?? "";
  const slugRaw = str(fd, "LinkSeo");
  return {
    title,
    url: str(fd, "Link"),
    icon: str(fd, "LinkIcon"),
    slug: slugRaw ? slugify(slugRaw) : null,
    content: sanitize(str(fd, "LinkContent")),
    order: num(fd, "LinkNumber"),
    topMenu: bool(fd, "TopMenu"),
    footer: bool(fd, "Footer"),
    isActive: bool(fd, "IsActive"),
  };
}

export async function createLinkAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const sess = await getSession();
  const data = parseForm(fd);
  if (!data.title) throw new Error("Title is required.");
  await createLink({ ...data, creatorId: sess?.uid ?? null });
  await logAudit("links", `"${data.title}" link added`);
  revalidateTag("links");
}

export async function updateLinkAction(fd: FormData): Promise<void> {
  await requireRole(["admin", "editor"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  const data = parseForm(fd);
  if (!data.title) throw new Error("Title is required.");
  await updateLink(id, data);
  await logAudit("links", `"${data.title}" link updated`);
  revalidateTag("links");
}

export async function deleteLinkAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid id.");
  await softDeleteLink(id);
  await logAudit("links", `#${id} link deleted`);
  revalidateTag("links");
}

type CorePage = { slug: string; title: string; promptKind: "privacy" | "terms" | "contact" };
const CORE_PAGES: CorePage[] = [
  { slug: "privacy", title: "Privacy Policy", promptKind: "privacy" },
  { slug: "terms",   title: "Terms of Service", promptKind: "terms" },
  { slug: "contact", title: "Contact",        promptKind: "contact" },
];

function corePagePrompt(args: {
  kind: CorePage["promptKind"];
  siteName: string;
  siteUrl: string;
  description: string;
  contactEmail: string | null;
}): { system: string; user: string } {
  const system =
    "You write static legal/contact pages for news websites. " +
    "Reply with a JSON object {\"html\": string}. The html field must be a " +
    "self-contained body (no <html>, <head>, or <body> tags). Use semantic " +
    "<h2>/<h3>/<p>/<ul>/<li> tags. American English. Approximately 500–800 words.";

  const ctx = `Site name: ${args.siteName}
Site URL: ${args.siteUrl}
Site description: ${args.description}
Contact email: ${args.contactEmail ?? "not provided"}`;

  const ask =
    args.kind === "privacy"
      ? "Write a generic Privacy Policy covering: data we collect (analytics cookies, contact-form submissions), how we use it, third-party processors (Google Analytics, AdSense), user rights (access, deletion), and contact instructions. Add a 'Last updated' line at the top with the current month and year."
      : args.kind === "terms"
        ? "Write a generic Terms of Service covering: acceptance, intellectual property, user-submitted content, prohibited uses, disclaimers, limitation of liability, governing law (United States), and changes to terms. Add a 'Last updated' line at the top with the current month and year."
        : "Write a friendly Contact page that invites readers to reach out. Mention the contact email if provided, otherwise instruct readers to use a future contact form. Keep it short (3 short paragraphs).";

  return { system, user: `${ctx}\n\nTask: ${ask}` };
}

async function linkSlugExists(slug: string): Promise<boolean> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "Links"
    WHERE "LinkSeo" = ${slug} AND "IsDeleted" = FALSE
  `;
  return rows[0].c > 0;
}

export async function generateCorePagesAction(): Promise<{
  created: string[];
  skipped: string[];
  errors: { slug: string; message: string }[];
}> {
  await requireRole(["admin", "editor"]);
  const sess = await getSession();
  const settings = await getSettings();
  const ai = await getActiveTextAI("content");

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { slug: string; message: string }[] = [];

  // Pull a contact email out of MailSender if present.
  const mailRow = await sql<{ MailSender: string | null }[]>`
    SELECT "MailSender" FROM "Settings"
    WHERE "IsDeleted" = FALSE ORDER BY "SettingsID" ASC LIMIT 1
  `;
  const contactEmail = mailRow[0]?.MailSender ?? null;

  let order = 100;
  for (const page of CORE_PAGES) {
    if (await linkSlugExists(page.slug)) {
      skipped.push(page.title);
      continue;
    }
    try {
      const { system, user } = corePagePrompt({
        kind: page.promptKind,
        siteName: settings.SiteName,
        siteUrl: settings.SiteUrl,
        description: settings.Description,
        contactEmail,
      });
      const out = await ai.generateJSON<{ html?: string }>({ system, user });
      const html = sanitize(typeof out?.html === "string" ? out.html : null);
      if (!html) {
        errors.push({ slug: page.slug, message: "AI returned no usable HTML" });
        continue;
      }
      await createLink({
        title: page.title,
        url: null,
        icon: null,
        slug: page.slug,
        content: html,
        order: order++,
        topMenu: false,
        footer: true,
        isActive: true,
        creatorId: sess?.uid ?? null,
      });
      created.push(page.title);
    } catch (err) {
      errors.push({
        slug: page.slug,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (created.length > 0) {
    await logAudit("links", `auto-generated core pages: ${created.join(", ")}`);
    revalidateTag("links");
  }
  return { created, skipped, errors };
}
