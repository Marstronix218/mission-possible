import { GlobalRanking } from "@/components/results/ClassroomUI";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string; classroom?: string }>;
}) {
  const q = await searchParams;
  return <GlobalRanking initialMission={q.mission} classroomId={q.classroom} />;
}
