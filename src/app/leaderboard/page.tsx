import { LeaderboardView } from "@/components/player/LeaderboardView";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    mission?: string;
    difficulty?: string;
    classroom?: string;
    budget?: string;
    mass?: string;
  }>;
}) {
  const q = await searchParams;
  return (
    <LeaderboardView
      initialTab={q.tab}
      initialMission={q.mission}
      initialDifficulty={q.difficulty}
      initialConditions={
        Number(q.budget) > 0 &&
        Number(q.mass) > 0 &&
        Number.isFinite(Number(q.budget)) &&
        Number.isFinite(Number(q.mass))
          ? { budgetM: Number(q.budget), massKg: Number(q.mass) }
          : undefined
      }
      classroomId={
        typeof q.classroom === "string" && /^[0-9a-f-]{36}$/i.test(q.classroom)
          ? q.classroom
          : undefined
      }
    />
  );
}
