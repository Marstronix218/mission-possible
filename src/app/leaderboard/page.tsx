import { LeaderboardView } from "@/components/player/LeaderboardView";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string; classroom?: string }>;
}) {
  const q = await searchParams;
  return (
    <LeaderboardView initialMission={q.mission} classroomId={q.classroom} />
  );
}
