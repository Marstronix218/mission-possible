"use client";
import type { Mission, SatelliteDesign, SimResult } from "@/types/game";
import type { StoryEvent } from "@/lib/story/events";
import { getMissionStory } from "@/lib/story/missions";
import { HazardGrid } from "./HazardGrid";
import { StoryEventCard } from "./StoryEventCard";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Hours of mission time shown by the playback: long enough to reach the deadline and the delivery. */
export function playbackSpanHours(mission: Mission, result: SimResult) {
  const deadline = mission.targetResponseHours;
  const delivered = result.firstDeliveryHours;
  const wanted = Math.max(deadline * 2, delivered === null ? 0 : delivered + deadline * 0.5);
  return Math.min(mission.durationDays * 24, Math.ceil(wanted));
}

/**
 * Mission clock playback: deadline bar, hazard map with ground track, and
 * event cards appearing as mission time passes.
 */
export function MissionTimeline({
  mission,
  design,
  result,
  events,
  progress,
}: {
  mission: Mission;
  design: SatelliteDesign;
  result: SimResult;
  events: StoryEvent[];
  /** Playback position 0..1. */
  progress: number;
}) {
  const story = getMissionStory(mission.slug);
  const span = playbackSpanHours(mission, result);
  const hour = progress * span;
  const deadline = mission.targetResponseHours;
  const delivered = result.firstDeliveryHours;
  const finished = progress >= 1;
  const deliveredYet = delivered !== null && hour >= delivered;
  const verdict: { word: string; icon: string; text: string; tone: "good" | "bad" | "wait" } =
    deliveredYet && delivered <= deadline
      ? { word: "MET", icon: "✓", tone: "good", text: `Data delivered at hour ${delivered}, ${r1(deadline - delivered)} h early.` }
      : deliveredYet
        ? { word: "MISSED", icon: "✕", tone: "bad", text: `Data arrived at hour ${delivered}, ${r1(delivered - deadline)} h late.` }
        : hour >= deadline
          ? { word: "MISSED", icon: "✕", tone: "bad", text: `Deadline passed with no data on the ground.` }
          : { word: "WAITING", icon: "⏳", tone: "wait", text: `${r1(deadline - hour)} h left until the deadline.` };
  const verdictClass =
    verdict.tone === "good"
      ? "border-[#9ae6d3] text-[#9ae6d3]"
      : verdict.tone === "bad"
        ? "border-[#ffa38c] text-[#ffc2b4]"
        : "border-[#fff2a5] text-[#fff2a5]";
  const pct = (h: number) => `${Math.min(100, (h / span) * 100)}%`;
  const visible = events.filter(
    (e) =>
      (e.timing !== "mission" && e.hour <= hour && (!e.launchStage || e.tone === "bad")) ||
      (finished && e.timing === "mission" && e.kind !== "outcome"),
  );
  const track = result.timeline.filter((p) => p.t <= hour);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="m-0 font-mono text-2xl" aria-label={`Mission clock: hour ${Math.floor(hour)} of ${span} shown`}>
            Hour {hour < 10 ? r1(hour).toFixed(1) : Math.floor(hour)}
            <span className="text-base text-[#a5bac9]"> / deadline {deadline} h</span>
          </p>
          <p
            className={`m-0 rounded border px-2 py-1 font-mono text-sm font-bold ${verdictClass}`}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">{verdict.icon} </span>
            Deadline {verdict.word}
          </p>
        </div>
        <p className="mt-1 mb-2 text-sm text-[#d6e2ea]">{verdict.text}</p>
        {/* Deadline bar */}
        <div className="relative mt-2 mb-8 h-4 rounded bg-[#1c2c39]" aria-hidden="true">
          <div
            className={`absolute inset-y-0 left-0 rounded ${hour > deadline && !(deliveredYet && delivered! <= deadline) ? "bg-[#ffa38c]/70" : "bg-[#8cddff]/70"}`}
            style={{ width: pct(hour) }}
          />
          <div className="absolute -top-1 -bottom-1 w-0.5 bg-[#fff2a5]" style={{ left: pct(deadline) }} />
          <span
            className="absolute top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-[#fff2a5]"
            style={{ left: pct(deadline) }}
          >
            ▲ deadline {deadline} h
          </span>
          {deliveredYet && (
            <span
              className="absolute -top-1 -translate-x-1/2 font-mono text-xs"
              style={{ left: pct(delivered!) }}
              title="Data delivered"
            >
              ⬇
            </span>
          )}
        </div>
        <HazardGrid
          mission={mission}
          cells={result.cells}
          reveal={progress}
          track={track}
          label={`Simulated ${story?.hazardNoun ?? "hazard"} map of ${mission.city}`}
        />
        <p className="text-xs text-[#a5bac9]">
          Simulated by your satellite. The map fills in to show the engine&apos;s final result; the fill order
          is illustrative, not per-pass timing. The clock covers the first {span} h of the {mission.durationDays}
          -day mission{span < mission.durationDays * 24 ? "; whole-mission results appear at the end" : ""}.
        </p>
      </div>
      <div className="min-w-0">
        <h3 className="mt-0">Mission log</h3>
        {visible.length === 0 && (
          <p className="text-sm text-[#a5bac9]">Events appear here as mission time passes.</p>
        )}
        <ol className="m-0 grid list-none gap-3 p-0" aria-live="polite" aria-relevant="additions">
          {visible.map((e) => (
            <li key={e.id}>
              <StoryEventCard event={e} design={design} />
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[#a5bac9]">
          Hours marked &quot;estimated&quot; are worked out from your design (for example, delivery time minus the
          radio delay of data per day ÷ downlink per day × 24 h). Delivery and deadline hours come from the
          simulation engine.
        </p>
      </div>
    </div>
  );
}
