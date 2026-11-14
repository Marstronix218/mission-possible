import Link from "next/link";
import { missions } from "@/components/designer/missions";

export default function HomePage() {
  return (
    <section>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Design an Earth observation satellite</h1>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {missions.map((mission) => (
          <li key={mission.slug}>
            <Link className="block h-full rounded-xl border border-border bg-card p-5 hover:border-primary" href={`/mission/${mission.slug}/brief`}>
              <span className="text-sm capitalize text-muted-foreground">{mission.category}</span>
              <h2 className="mt-1 text-xl font-semibold">{mission.city}</h2>
              <p className="mt-2 text-muted-foreground">{mission.objective.en}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
