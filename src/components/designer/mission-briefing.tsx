import Link from "next/link";
import { notFound } from "next/navigation";
import { findMission } from "@/components/designer/missions";
import { MissionSteps } from "@/components/story/MissionSteps";
import type { DataSource } from "@/types/game";
import { challengeLine, hazardEmoji } from "./builder-copy";
import { COVERAGE_TARGET } from "./builder-model";
import { HazardScene } from "./HazardScene";
import { storyFor } from "./story-fallback";
import styles from "./designer.module.css";

const provenanceLabel: Record<DataSource["provenance"], { text: string; icon: string }> = {
  "nasa-observed": { text: "NASA-observed data", icon: "🛰️" },
  "educational-model": { text: "Modeled scenario inspired by NASA data", icon: "🧪" },
};

function LimitChip({ icon, label, value, why }: { icon: string; label: string; value: string; why: string }) {
  return (
    <li>
      <details className="group rounded-2xl border-[3px] border-space-950 bg-space-800 shadow-[var(--shadow-pop)] open:bg-space-700">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-2.5 rounded-2xl px-3 py-2 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="text-2xl">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl leading-tight font-bold">{value}</span>
            <span className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
          </span>
          <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-bold text-muted-foreground group-open:rotate-45">+</span>
          <span className="sr-only">Why?</span>
        </summary>
        <p className="px-3 pb-3 text-sm text-muted-foreground">{why}</p>
      </details>
    </li>
  );
}

/** The disaster briefing: a short, dramatic scene with one big call to action. */
export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const mission = findMission((await params).slug);
  if (!mission) notFound();
  const story = storyFor(mission);
  const { budgetM, massKg } = mission.defaultConstraints;
  const hours = mission.targetResponseHours;
  const tint = `var(--hazard-${mission.category})`;
  const hh = String(hours).padStart(2, "0");

  return (
    <article className="mx-auto max-w-5xl">
      <MissionSteps slug={mission.slug} current="disaster" />

      <section aria-label="The disaster" className="relative mx-auto max-w-3xl overflow-hidden rounded-[var(--radius)] border-4 shadow-[var(--shadow-pop)]" style={{ borderColor: tint }}>
        <HazardScene category={mission.category} city={mission.city} />
        <p className="absolute top-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full border-[3px] border-space-950 px-3 py-1 font-display text-xs font-bold tracking-wider text-space-950 uppercase shadow-[0_3px_0_rgba(0,0,0,0.35)] sm:top-4 sm:left-4 sm:text-base"
          style={{ background: tint }}>
          <span aria-hidden="true" className={styles.pulse}>🚨</span>
          <span className="truncate">{story.alert}</span>
        </p>
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h1 className="!m-0 font-display text-4xl !leading-[1.05] font-bold !tracking-normal sm:text-6xl">
            <span aria-hidden="true">{hazardEmoji[mission.category]} </span>{challengeLine[mission.category]}
          </h1>
          <p className="mt-3 max-w-2xl text-lg font-semibold sm:text-xl">{story.goal}</p>
        </div>
        <div className="flex flex-col items-center rounded-[var(--radius)] border-4 border-pop-pink bg-space-950 px-6 py-4 text-center shadow-[var(--shadow-pop)]">
          <span className="text-xs font-black tracking-[0.25em] text-pop-pink uppercase">Response target</span>
          <span className="sr-only">{hours} hours to deliver data</span>
          <span aria-hidden="true" className="font-mono text-5xl leading-none font-bold tabular-nums sm:text-6xl">
            {hh}<span className={styles.blink}>:</span>00<span className={styles.blink}>:</span>00
          </span>
          <span aria-hidden="true" className="mt-1 text-sm text-muted-foreground">hours to get data home</span>
        </div>
      </div>

      <section aria-labelledby="limits-heading" className="mt-6">
        <h2 id="limits-heading" className="sr-only">Mission limits</h2>
        <ul className="grid grid-cols-2 items-start gap-3 lg:grid-cols-4">
          <LimitChip icon="💰" label="Budget" value={`$${budgetM}M`} why={story.constraintReasons.budget} />
          <LimitChip icon="🚀" label="Rocket lift" value={`${massKg} kg`} why={story.constraintReasons.mass} />
          <LimitChip icon="📅" label="Mission" value={`${mission.durationDays} days`} why={story.constraintReasons.duration} />
          <LimitChip icon="⏱" label="Response target" value={`${hours} h`} why={story.deadlineReason} />
        </ul>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">To win:</span>
          <span><span aria-hidden="true">🗺 </span>watch {COVERAGE_TARGET}%+ of the area</span>
          <span><span aria-hidden="true">🏅 </span>score 60+</span>
        </p>
      </section>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href={`/mission/${mission.slug}/design`}
          className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full border-4 border-space-950 bg-pop-yellow px-8 py-4 text-center font-display text-2xl font-bold tracking-wide text-space-950 shadow-[0_8px_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-1 sm:w-auto sm:text-3xl">
          BUILD YOUR SATELLITE <span aria-hidden="true">🛠️</span>
        </Link>
        <Link href="/map" className="text-sm font-bold text-muted-foreground underline-offset-4 hover:underline">All missions</Link>
      </div>

      <details className="mt-8 rounded-2xl border-2 border-border bg-space-800/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-bold">Where does this data come from?</summary>
        <ul className="mt-3 space-y-3">
          {mission.sources.map((source) => (
            <li key={source.url}>
              <span className="mb-1 inline-flex items-center gap-1 rounded-full border-2 border-border px-2 py-0.5 text-xs font-bold">
                <span aria-hidden="true">{provenanceLabel[source.provenance].icon}</span>{provenanceLabel[source.provenance].text}
              </span>
              <p className="!m-0"><a href={source.url} className="font-bold text-pop-cyan underline" target="_blank" rel="noreferrer">{source.name}</a></p>
              <p className="!m-0 text-muted-foreground">{source.usage}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Training scenario. Your satellite&apos;s results are simulated.</p>
      </details>
    </article>
  );
}
