import { redirect } from "next/navigation";
import { isInstalled } from "@/lib/install/guard";
import { hasDbConfig } from "@/lib/db-config";
import { InstallWizard } from "./InstallWizard";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  if (await isInstalled()) {
    // Installation already complete — keep the wizard out.
    redirect("/");
  }

  return <InstallWizard dbConfigPresent={hasDbConfig()} />;
}
