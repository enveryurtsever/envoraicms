import { getSettings } from "@/lib/queries/settings";
import { GoogleKitClient } from "./GoogleKitClient";

export const dynamic = "force-dynamic";

export default async function GoogleKitPage() {
  const settings = await getSettings();
  return <GoogleKitClient settings={settings} />;
}
