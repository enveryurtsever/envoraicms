import { getSettings } from "@/lib/queries/settings";
import { listThemes } from "@/lib/queries/themes";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, themes] = await Promise.all([getSettings(), listThemes()]);
  return <SettingsClient settings={settings} themes={themes} />;
}
