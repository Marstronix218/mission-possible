import { isMockMode } from "@/lib/data-mode";
import UpstreamDesign from "@/components/designer/designer-page";
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
  if (!isMockMode)
    return (
      <main id="main-content" tabIndex={-1}>
        <UpstreamDesign params={params} />
      </main>
    );
  const { slug } = await params;
  const query = await searchParams;
  const mission = getMission(slug);
  if (!mission) notFound();
  return (
    <MissionExperience
      key={slug + ":design:" + query.attempt + ":" + query.classroom}
      mission={mission}
      stage="design"
      classroomId={query.classroom}
      attemptId={query.attempt}
    />
  );
}
