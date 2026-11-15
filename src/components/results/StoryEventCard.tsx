import type { SatelliteDesign } from "@/types/game";
import type { StoryEvent } from "@/lib/story/events";
import { partLabel } from "@/lib/story/events";
import { slotExplainers } from "@/lib/story/parts";

const toneLabel = { good: "✓ Good news", bad: "✕ Problem", neutral: "• Update" } as const;
const toneClass = {
  good: "border-l-[#9ae6d3]",
  bad: "border-l-[#ffa38c]",
  neutral: "border-l-[#617a9a]",
} as const;

export function formatHour(hour: number) {
  return `Hour ${Math.round(hour * 10) / 10}`;
}

/** One narrated mission event. Tone is given in words and an icon, not color alone. */
export function StoryEventCard({
  event,
  design,
  showHour = true,
}: {
  event: StoryEvent;
  design: SatelliteDesign;
  showHour?: boolean;
}) {
  return (
    <article className={`rounded-md border border-[#2a3d4b] border-l-4 bg-[#0f1e29] p-3 ${toneClass[event.tone]}`}>
      <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-[#a5bac9]">
        <span className="font-bold">{toneLabel[event.tone]}</span>
        {showHour && event.timing !== "mission" && (
          <span>
            {formatHour(event.hour)}
            {event.timing === "derived" && event.hour > 0 ? " · estimated" : ""}
          </span>
        )}
        {event.timing === "mission" && <span>Whole mission</span>}
      </p>
      <h3 className="mt-1 mb-1 text-base font-semibold leading-snug">{event.title}</h3>
      <p className="m-0 text-sm text-[#d6e2ea]">{event.detail}</p>
      {event.causeSlot && event.tone === "bad" && (
        <p className="mt-2 mb-0 text-sm">
          <span className="font-semibold">Caused by your choice:</span> {partLabel(event.causeSlot, design)}{" "}
          <span className="text-[#a5bac9]">({slotExplainers[event.causeSlot].title})</span>
        </p>
      )}
    </article>
  );
}
