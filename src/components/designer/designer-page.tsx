import { notFound } from "next/navigation";
import { findMission } from "@/components/designer/missions";
import { SatelliteDesigner } from "@/components/designer/satellite-designer";

/** `fix` comes from `?fix=orbit,comm` on debrief retry links. */
export default async function DesignPage({ params, fix }: { params: Promise<{ slug: string }>; fix?: string | string[] }) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  return <SatelliteDesigner key={mission.slug} mission={mission} fix={fix} />;
}
