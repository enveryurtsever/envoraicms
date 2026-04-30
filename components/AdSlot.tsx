// Ad slot inventory. Renders nothing unless BOTH conditions hold:
//   1. Settings.AdsEnabled is true (master switch in /admin/settings)
//   2. An active AdZone with a non-empty HtmlSnippet exists for the slot
// This means a freshly installed site — or any site without configured
// snippets — has zero ad placeholders / "your ad here" boxes.

import { getSettings } from "@/lib/queries/settings";
import { getActiveAdForSlot } from "@/lib/queries/adzones";

export type AdSlotName =
  | "leaderboard-top"
  | "leaderboard-bottom"
  | "billboard"
  | "sidebar-mpu"
  | "sidebar-half"
  | "in-article";

const SLOT_LABELS: Record<AdSlotName, string> = {
  "leaderboard-top": "Leaderboard top",
  "leaderboard-bottom": "Leaderboard bottom",
  "billboard": "Billboard",
  "sidebar-mpu": "Sidebar",
  "sidebar-half": "Sidebar tall",
  "in-article": "In-article",
};

export async function AdSlot({
  name,
  className = "",
}: {
  name: AdSlotName;
  className?: string;
}) {
  const [settings, zone] = await Promise.all([
    getSettings(),
    getActiveAdForSlot(name),
  ]);
  if (!settings.AdsEnabled) return null;

  const snippet = zone?.HtmlSnippet?.trim();
  if (!snippet) return null;

  // Admin-trusted HTML (AdSense / GAM etc.). Sanitization is intentionally
  // skipped so that <script> tags work. Only role=admin can edit this field.
  return (
    <div
      role="complementary"
      aria-label={`${SLOT_LABELS[name]} ad`}
      data-ad-slot={name}
      className={className || undefined}
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  );
}
