import Link from "next/link";
import { notFound } from "next/navigation";
import { findMission } from "@/components/designer/missions";
import { Button } from "@/components/ui/button";
import { partsCatalog } from "@/lib/sim/catalog";

const tips: Record<string, string> = {
  wildfire: "Thermal infrared sensors can detect hot spots. A faster revisit helps track fires as they spread.",
  flood: "Radar can observe flooded areas through cloud cover. Allow enough downlink capacity to deliver maps quickly.",
  heat: "Thermal infrared sensors help identify hot surfaces. Consider when and how often the satellite revisits the city.",
};

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  const { budgetM, massKg } = mission.defaultConstraints;
  const maxPower = Math.max(...partsCatalog.solar.map((part) => part.generationW));
  return (
    <article className="max-w-3xl space-y-8">
      <Link href="/" className="text-primary underline">All missions</Link>
      <header>
        <p className="capitalize text-muted-foreground">{mission.category}</p>
        <h1 className="mt-2 text-4xl font-bold">{mission.city} mission briefing</h1>
        <p className="mt-4 text-lg">{mission.objective.en}</p>
      </header>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Mission requirements</h2>
        <p className="mt-2">Aim to deliver the first observation within {mission.targetResponseHours} hours. The mission runs for {mission.durationDays} days.</p>
        <p className="mt-2">Success requires a mission score of at least 60 and coverage of at least 50%.</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div><dt>Budget</dt><dd className="font-bold">${budgetM}M</dd></div>
          <div><dt>Mass limit</dt><dd className="font-bold">{massKg} kg</dd></div>
          <div><dt>Maximum available solar power</dt><dd className="font-bold">{maxPower} W</dd></div>
        </dl>
      </section>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Observation tip</summary>
        <p className="mt-3">{tips[mission.category]}</p>
      </details>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data sources</h2>
        {mission.sources.map((source) => (
          <div key={source.url}>
            <a href={source.url} className="text-primary underline">{source.name}</a>
            <p className="text-muted-foreground">{source.usage}</p>
          </div>
        ))}
      </section>
      <Button asChild><Link href={`/mission/${mission.slug}/design`}>Design satellite</Link></Button>
    </article>
  );
}
