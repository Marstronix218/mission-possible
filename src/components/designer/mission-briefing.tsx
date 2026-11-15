import { notFound } from "next/navigation";
import { findMission } from "./missions";
import { MissionLetter } from "@/components/gameplay/MissionLetter";
export default async function BriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  return <MissionLetter mission={mission} />;
}
