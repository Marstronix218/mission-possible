import { notFound } from "next/navigation";
import { findMission } from "./missions";
import BeginnerWorkshop from "@/components/gameplay/BeginnerWorkshop";
import AdvancedWorkshop from "@/components/gameplay/AdvancedWorkshop";
export default async function DesignPage({
  params,
  fix,
  mode,
}: {
  params: Promise<{ slug: string }>;
  fix?: string | string[];
  mode?: string;
}) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  return mode !== "quick" ? (
    <AdvancedWorkshop mission={mission} fix={fix} />
  ) : (
    <BeginnerWorkshop mission={mission} quick />
  );
}
