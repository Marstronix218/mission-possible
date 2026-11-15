import type { Mission, SatelliteDesign, SimResult } from "@/types/game";
import {
  outcomeHeadline,
  partLabel,
  slotNoun,
  suggestNextStep,
  type MissionDiagnosis,
  type StoryEvent,
} from "@/lib/story/events";
import { partExplainers, slotExplainers, type PartSlot } from "@/lib/story/parts";
import { StoryEventCard } from "./StoryEventCard";

/**
 * Debrief lead: the human outcome in one sentence, what went right/wrong
 * (with the responsible part), and a concrete next step.
 */
export function OutcomeStory({
  mission,
  design,
  result,
  events,
  diagnosis,
  onRedesign,
}: {
  mission: Mission;
  design: SatelliteDesign;
  result: SimResult;
  events: StoryEvent[];
  diagnosis: MissionDiagnosis;
  onRedesign: (slot?: PartSlot) => void;
}) {
  const headline = outcomeHeadline(mission, diagnosis);
  const next = suggestNextStep(mission, design, result, diagnosis);
  const right = events.filter((e) => e.tone === "good" && e.kind !== "outcome");
  const wrong = events.filter((e) => e.tone === "bad" && e.kind !== "outcome");
  const nextPartId = next.suggestedPartId;
  const nextPart = nextPartId && next.slot !== "groundStations" ? partExplainers[nextPartId] : undefined;
  return (
    <>
      <section className="panel" aria-labelledby="outcome-heading">
        <p className="eyebrow">
          {headline.tone === "good" ? "✓ Deadline met" : "✕ Deadline missed"} · {result.success ? "Mission successful" : "Mission goal not reached"}
        </p>
        <h2 id="outcome-heading" className="text-2xl leading-snug md:text-3xl">
          {headline.sentence}
        </h2>
        {diagnosis.lateCause && (
          <p>
            <strong>Main cause:</strong> your {partLabel(diagnosis.lateCause, design)}.{" "}
            {slotExplainers[diagnosis.lateCause].ifWeak}
          </p>
        )}
        <p className="text-sm text-[#a5bac9]">
          Simulated outcome. Delivery hour from the simulation engine; deadline {diagnosis.deadlineHours} h set by the
          mission.
        </p>
      </section>
      <div className="two-column">
        <section className="panel" aria-labelledby="right-heading">
          <h2 id="right-heading">What went right</h2>
          {right.length === 0 ? (
            <p>Nothing worked well enough this time — that is useful information for your next design.</p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {right.map((e) => (
                <li key={e.id}>
                  <StoryEventCard event={e} design={design} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel" aria-labelledby="wrong-heading">
          <h2 id="wrong-heading">What went wrong — and which part caused it</h2>
          {wrong.length === 0 ? (
            <p>No problems found. Can you do the same job for less money?</p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {wrong.map((e) => (
                <li key={e.id} className="grid gap-2">
                  <StoryEventCard event={e} design={design} />
                  {e.causeSlot && (
                    <button type="button" className="justify-self-start" onClick={() => onRedesign(e.causeSlot)}>
                      Change the {slotNoun[e.causeSlot]} →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="panel mt-5" aria-labelledby="next-heading">
        <p className="eyebrow">
          Weakest score: {next.metricLabel} {next.value} / 100
        </p>
        <h2 id="next-heading">Try this next</h2>
        <p className="text-lg">{next.text}</p>
        {nextPart && (
          <p className="text-sm text-[#a5bac9]">
            Trade-off: {nextPart.good} {nextPart.bad}
          </p>
        )}
        <div className="actions">
          <button className="primary" onClick={() => onRedesign(next.slot)}>
            Redesign: change the {slotNoun[next.slot]} ↗
          </button>
        </div>
      </section>
    </>
  );
}
