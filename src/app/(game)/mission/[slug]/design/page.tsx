import { notFound } from "next/navigation";
import { findMission } from "@/components/designer/missions";
import { SatelliteDesigner } from "@/components/designer/satellite-designer";

export default async function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  return <SatelliteDesigner key={mission.slug} mission={mission} />;
}
