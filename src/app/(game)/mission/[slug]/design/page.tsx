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
  const { slug } = await params;
  const query = await searchParams;
  const mission = getMission(slug);
  if (!mission) notFound();
  // Solo players (mock and live) get the story-driven screens; classrooms keep the shared experience.
  if (!query.classroom)
    return (
      <main id="main-content" tabIndex={-1}>
        <UpstreamDesign params={Promise.resolve({ slug })} />
      </main>
    );
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
