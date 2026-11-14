import { notFound } from "next/navigation";
import { getMission } from "@/components/results/missions";
import MissionExperience from "@/components/results/MissionExperience";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classroom?: string; attempt?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const mission = getMission(slug);
  if (!mission) notFound();
  return (
    <MissionExperience
      key={slug + ":brief:" + query.attempt + ":" + query.classroom}
      mission={mission}
      stage="brief"
      classroomId={query.classroom}
      attemptId={query.attempt}
    />
  );
}
