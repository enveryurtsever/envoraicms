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

// Pages must describe what the site actually does, so these facts are stated
// in the prompts rather than left for the model to assume.
const SITE_FACTS =
  "Facts about this site: it has no user accounts, comments, user-submitted content, newsletter, or contact form. Do not mention any of them.";

const GOOGLE_DATA_URL = "https://policies.google.com/technologies/partner-sites";
const GOOGLE_AD_SETTINGS_URL = "https://myadcenter.google.com/";

type CorePage = {
  slug: string;
  title: string;
  promptKind: "privacy" | "terms" | "contact" | "about" | "method";
  /** A generated page missing this text is not saved. */
  mustInclude?: string;
};
const CORE_PAGES: CorePage[] = [
  { slug: "about", title: "About", promptKind: "about" },
  { slug: "editorial-policy", title: "How We Publish", promptKind: "method" },
  { slug: "privacy", title: "Privacy Policy", promptKind: "privacy", mustInclude: GOOGLE_DATA_URL },
  { slug: "terms", title: "Terms of Service", promptKind: "terms" },
  { slug: "contact", title: "Contact", promptKind: "contact" },
];

function corePagePrompt(args: {
  kind: CorePage["promptKind"];
  siteName: string;
  siteUrl: string;
  description: string;
  contactEmail: string | null;
  publisherName: string | null;
  language: string;
  verificationEnabled: boolean;
  euConsentEnabled: boolean;
}): { system: string; user: string } {
  const system =
    "You write static pages for news websites. " +
    `Write everything — the page title, all headings, and body — natively in ${args.language}. ` +
    "Reply with a JSON object {\"title\": string, \"html\": string}. " +
    `The title is this page's name in ${args.language} (e.g. the ${args.language} equivalent of "Privacy Policy"). ` +
    "The html field must be a self-contained body (no <html>, <head>, or <body> tags). Use semantic " +
    "<h2>/<h3>/<p>/<ul>/<li>/<a> tags. " +
    "Do not state a date or a \"last updated\" line: the site shows the real one. " +
    "Never invent an address, phone number, company name, legal jurisdiction, team member, founding date, or contact detail; use only those provided. " +
    SITE_FACTS;

  const ctx = `Site name: ${args.siteName}
Site URL: ${args.siteUrl}
Site description: ${args.description}
Publisher (responsible business or person): ${args.publisherName ?? "not provided"}
Contact email: ${args.contactEmail ?? "not provided"}`;

  const checks = args.verificationEnabled
    ? "Before publishing, automated checks compare each article with its source. They remove quotes that aren't in the source, look for numbers, claims, and people's roles the source doesn't support, try one automatic correction, and drop articles that still fail or repeat a recent story."
    : "Articles are published automatically without a separate verification step.";

  const consent = args.euConsentEnabled
    ? " Explain that visitors in the European Economic Area, the UK, and Switzerland are shown a consent message from a Google-certified consent management platform before personalized ads, and can change their choice through that message."
    : " Do not claim that a cookie consent message or consent management platform is shown.";

  const asks: Record<CorePage["promptKind"], string> = {
    privacy: `Write a Privacy Policy of about 500 to 800 words covering: data collected (analytics and advertising cookies, and anything readers choose to send by email), how it is used, third-party processors (Google Analytics, Google AdSense), a clear statement that third parties including Google may place and read cookies in visitors' browsers, or use web beacons and IP addresses, to serve and measure ads based on prior visits to this and other sites, reader rights of access, correction, and deletion, and contact instructions. Include a link to <a href="${GOOGLE_DATA_URL}">How Google uses information from sites or apps that use its services</a> and a link to <a href="${GOOGLE_AD_SETTINGS_URL}">Google's ad settings</a> for opting out, with the link text in the output language and these exact URLs.${consent}`,
    terms: "Write Terms of Service of about 400 to 600 words covering: acceptance, intellectual property, permitted use of the site, prohibited uses, disclaimers that content is for information only and may contain errors, limitation of liability, and changes to the terms. Include a governing law section only if the publisher details establish one; otherwise leave it out.",
    contact: "Write a friendly Contact page that invites readers to reach out. State the publisher and contact email exactly as provided, with the email as a mailto link. If either is not provided, leave it out. Keep it short (3 short paragraphs).",
    about: "Write an About page of about 150 to 250 words: what the site covers, based only on the site description, who is responsible for it if the publisher is provided, and how to get in touch. State plainly that articles are produced by an automated system using AI, and link to /s/editorial-policy for how it works. Do not describe a newsroom, staff, mission history, or awards.",
    method: `Write a page of about 300 to 450 words explaining honestly how articles are produced. Use only these facts. Articles are generated automatically by AI from recently published news reports by other outlets, and the original source is credited on the article when available. ${checks} Images may be AI-generated or come from the source. No human editor reviews each article before it is published, and automated checks can miss mistakes, so articles may contain errors. Readers can report errors through the contact details, and link to /s/contact. Do not mention human editors, reporters, or fact-checkers working on articles, and do not claim accuracy guarantees.`,
  };

  return { system, user: `Today's date: ${new Date().toISOString().slice(0, 10)}\n${ctx}\n\nTask: ${asks[args.kind]}` };
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
        verificationEnabled: settings.ReviewGateEnabled,
        euConsentEnabled: settings.EuConsentEnabled,
      });
      const out = await ai.generateJSON<{ html?: string; title?: string }>({ system, user });
      const html = sanitize(typeof out?.html === "string" ? out.html : null);
      if (!html) {
        errors.push({ slug: page.slug, message: "AI returned no usable HTML" });
        continue;
      }
      if (page.mustInclude && !html.includes(page.mustInclude)) {
        errors.push({ slug: page.slug, message: `AI left out the required link ${page.mustInclude}` });
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
