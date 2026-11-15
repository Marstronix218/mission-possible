import Link from "next/link";
import { notFound } from "next/navigation";
import { findMission, missions } from "@/components/designer/missions";
import { MissionSteps } from "@/components/story/MissionSteps";
import { Button } from "@/components/ui/button";
import type { DataSource, Mission } from "@/types/game";
import { HazardScene } from "./HazardScene";
import { storyFor } from "./story-fallback";

const beatIcons: Record<string, string[]> = {
  wildfire: ["🌬️", "🌫️", "🛰️"],
  flood: ["🌧️", "☁️", "🛰️"],
  heat: ["🌡️", "🚰", "🛰️"],
  snow: ["❄️", "🚧", "🛰️"],
  drought: ["☀️", "🌾", "🛰️"],
  storm: ["🌀", "⚡", "🛰️"],
  glacier: ["🧊", "🌊", "🛰️"],
  volcano: ["🌋", "🌫️", "🛰️"],
};

const provenanceLabel: Record<DataSource["provenance"], string> = {
  "educational-model": "Modeled scenario inspired by NASA data",
  "nasa-observed": "Based on NASA observations",
};

function LimitTile({ icon, label, value, reason, compare }: {
  icon: string; label: string; value: string; reason: string; compare: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <dt className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden="true" className="text-xl">{icon}</span>{label}
      </dt>
      <dd className="space-y-2">
        <span className="block text-3xl font-bold">{value}</span>
        <span className="block text-sm"><span className="font-semibold">Why: </span>{reason}</span>
        <span className="block text-xs text-muted-foreground">{compare}</span>
      </dd>
    </div>
  );
}

/** "Across all 18 missions: $150M to $400M." so players see the limits are mission-specific. */
function missionRange(format: (value: number) => string, pick: (mission: Mission) => number) {
  const values = missions.map(pick);
  if (values.length < 2) return "";
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high
    ? `Same for all ${values.length} missions.`
    : `Across all ${values.length} missions: ${format(low)} to ${format(high)}.`;
}

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  const story = storyFor(mission);
  const { budgetM, massKg } = mission.defaultConstraints;
  const hours = mission.targetResponseHours;
  const icons = beatIcons[mission.category] ?? ["⚠️", "⚠️", "🛰️"];

  return (
    <article className="max-w-5xl space-y-8">
      <MissionSteps slug={mission.slug} current="emergency" />

      <header className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-lg border-2 border-destructive bg-destructive/15 px-4 py-2 text-sm font-bold uppercase tracking-wider text-destructive">
          <span aria-hidden="true">🚨</span>{story.alert}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{story.headline}</h1>
      </header>

      <section aria-label="Situation" className="grid items-center gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <HazardScene category={mission.category} city={mission.city} />
        <ol className="space-y-3">
          {story.situation.map((beat, index) => (
            <li key={beat} className="flex gap-3 rounded-lg border border-border bg-card/60 p-3">
              <span aria-hidden="true" className="text-2xl leading-none">{icons[index] ?? "•"}</span>
              <span>{beat}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="goal-heading" className="grid gap-4 rounded-2xl border-2 border-primary bg-card p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          <h2 id="goal-heading" className="text-sm font-bold uppercase tracking-wider text-primary">Your goal</h2>
          <p className="text-2xl font-bold leading-snug">{story.goal}</p>
          <p className="text-sm text-muted-foreground">{story.dependents} are counting on your data.</p>
          <div>
            <h3 className="text-sm font-semibold">You succeed if:</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              <li className="rounded-lg border border-border p-3 text-sm"><span aria-hidden="true">⏱ </span>First data reaches the ground within <b>{hours} hours</b></li>
              <li className="rounded-lg border border-border p-3 text-sm"><span aria-hidden="true">🗺 </span>You watch at least <b>50%</b> of the area</li>
              <li className="rounded-lg border border-border p-3 text-sm"><span aria-hidden="true">🏅 </span>Your mission score is <b>60 or more</b></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-destructive bg-background px-6 py-5 text-center">
          <span className="sr-only">Deadline: {hours} hours to deliver</span>
          <span className="text-xs font-bold uppercase tracking-widest text-destructive" aria-hidden="true">Deadline</span>
          <span className="font-mono text-5xl font-bold tabular-nums" aria-hidden="true">{String(hours).padStart(2, "0")}:00:00</span>
          <span className="mt-1 text-sm text-muted-foreground" aria-hidden="true">hours to deliver</span>
        </div>
      </section>

      <section aria-labelledby="limits-heading" className="space-y-3">
        <div>
          <h2 id="limits-heading" className="text-2xl font-bold">Your mission limits</h2>
          <p className="text-sm text-muted-foreground">Every emergency is different, so every mission has its own limits.</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LimitTile icon="💰" label="Budget" value={`$${budgetM}M`} reason={story.constraintReasons.budget}
            compare={missionRange((value) => `$${value}M`, (other) => other.defaultConstraints.budgetM)} />
          <LimitTile icon="🚀" label="Max mass" value={`${massKg} kg`} reason={story.constraintReasons.mass}
            compare={missionRange((value) => `${value} kg`, (other) => other.defaultConstraints.massKg)} />
          <LimitTile icon="📅" label="Mission length" value={`${mission.durationDays} days`} reason={story.constraintReasons.duration}
            compare={missionRange((value) => `${value} days`, (other) => other.durationDays)} />
          <LimitTile icon="⏱" label="Deadline" value={`${hours} hours`} reason={story.deadlineReason}
            compare={missionRange((value) => `${value} h`, (other) => other.targetResponseHours)} />
        </dl>
      </section>

      <section aria-labelledby="obstacle-heading" className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 id="obstacle-heading" className="font-bold"><span aria-hidden="true">🌫️ </span>What makes it hard</h2>
          <p className="mt-2">{story.obstacle}</p>
        </div>
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer font-bold"><span aria-hidden="true">💡 </span>Need a hint?</summary>
          <p className="mt-2">{story.hint}</p>
        </details>
      </section>

      <section aria-labelledby="sources-heading" className="space-y-3">
        <h2 id="sources-heading" className="text-lg font-semibold">Where this scenario comes from</h2>
        {mission.sources.map((source) => (
          <div key={source.url} className="rounded-lg border border-border p-3">
            <span className="mb-1 inline-block rounded border border-border px-2 py-0.5 text-xs font-semibold">
              {provenanceLabel[source.provenance]}
            </span>
            <p><a href={source.url} className="text-primary underline" target="_blank" rel="noreferrer">{source.name}</a></p>
            <p className="text-sm text-muted-foreground">{source.usage}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Button asChild className="px-6 text-lg"><Link href={`/mission/${mission.slug}/design`}>Build your satellite →</Link></Button>
        <Link href="/" className="text-sm text-primary underline">All missions</Link>
      </div>
    </article>
  );
}
