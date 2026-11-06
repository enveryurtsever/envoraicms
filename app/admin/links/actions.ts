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
import { languageEnglishName } from "@/lib/site-language";
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
  publisherName: string | null;
  language: string;
}): { system: string; user: string } {
  const system =
    "You write static legal/contact pages for news websites. " +
    `Write everything — the page title, all headings, and body — natively in ${args.language}. ` +
    "Reply with a JSON object {\"title\": string, \"html\": string}. " +
    `The title is this page's name in ${args.language} (e.g. the ${args.language} equivalent of "Privacy Policy"). ` +
    "The html field must be a self-contained body (no <html>, <head>, or <body> tags). Use semantic " +
    "<h2>/<h3>/<p>/<ul>/<li> tags. Approximately 500–800 words. " +
    "Do not state a date or a \"last updated\" line: the site shows the real one. " +
    "Never invent an address, phone number, company name, or contact detail; use only those provided.";

  const ctx = `Site name: ${args.siteName}
Site URL: ${args.siteUrl}
Site description: ${args.description}
Publisher (responsible business or person): ${args.publisherName ?? "not provided"}
Contact email: ${args.contactEmail ?? "not provided"}`;

  const ask =
    args.kind === "privacy"
      ? `Write a generic Privacy Policy covering: data we collect (analytics and advertising cookies, and anything readers choose to send by email; the site has no contact form, so do not mention one), how we use it, third-party processors (Google Analytics, Google AdSense), a clear statement that third parties including Google may place and read cookies in visitors' browsers, or use web beacons and IP addresses, to serve and measure ads based on prior visits to this and other sites, how to opt out through Google Ads Settings, user rights (access, deletion), and contact instructions.`
      : args.kind === "terms"
        ? `Write a generic Terms of Service covering: acceptance, intellectual property, user-submitted content, prohibited uses, disclaimers, limitation of liability, governing law, and changes to terms.`
        : "Write a friendly Contact page that invites readers to reach out. State the publisher and contact email exactly as provided. If either is not provided, leave it out and do not mention a contact form. Keep it short (3 short paragraphs).";

  return { system, user: `Today's date: ${new Date().toISOString().slice(0, 10)}\n${ctx}\n\nTask: ${ask}` };
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

  // Prefer the public contact address; older sites only have MailSender.
  const mailRow = await sql<{ MailSender: string | null }[]>`
    SELECT "MailSender" FROM "Settings"
    WHERE "IsDeleted" = FALSE ORDER BY "SettingsID" ASC LIMIT 1
  `;
  const contactEmail = settings.ContactEmail ?? mailRow[0]?.MailSender ?? null;

  const language = languageEnglishName(settings.SiteLanguage);

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
        publisherName: settings.PublisherName,
        language,
      });
      const out = await ai.generateJSON<{ html?: string; title?: string }>({ system, user });
      const html = sanitize(typeof out?.html === "string" ? out.html : null);
      if (!html) {
        errors.push({ slug: page.slug, message: "AI returned no usable HTML" });
        continue;
      }
      // Use the localized title the model returned; fall back to the English
      // default if it omitted one. Slug stays English for stable URLs.
      const title =
        typeof out?.title === "string" && out.title.trim().length > 0
          ? out.title.trim()
          : page.title;
      await createLink({
        title,
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
