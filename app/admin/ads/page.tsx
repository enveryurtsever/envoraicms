import { listAdZones } from "@/lib/queries/adzones";
import { AdsClient } from "./AdsClient";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const zones = await listAdZones();
  return <AdsClient zones={zones} />;
}
