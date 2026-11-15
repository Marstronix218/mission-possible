import Link from "next/link";

export type MissionStepId = "disaster" | "design" | "launch" | "observe" | "discover" | "improve";

/** Older ids still used by other screens. */
type LegacyStepId = "emergency" | "build" | "debrief";

const legacy: Record<LegacyStepId, MissionStepId> = { emergency: "disaster", build: "design", debrief: "discover" };

const steps: { id: MissionStepId; label: string; icon: string; path: string | null }[] = [
  { id: "disaster", label: "Disaster", icon: "🚨", path: "brief" },
  { id: "design", label: "Design", icon: "🛠️", path: "design" },
  { id: "launch", label: "Launch", icon: "🚀", path: null },
  { id: "observe", label: "Observe", icon: "🛰️", path: null },
  { id: "discover", label: "Discover", icon: "🔎", path: null },
  { id: "improve", label: "Improve", icon: "🔧", path: null },
];

/**
 * Six-step progress bar shared by every mission screen:
 * DISASTER → DESIGN → LAUNCH → OBSERVE → DISCOVER → IMPROVE.
 * Done steps with their own page are links; the current step carries
 * aria-current and a visible label (not color alone). On narrow screens only the
 * current step shows its label, so the bar never scrolls sideways.
 */
export function MissionSteps({ slug, current, query = "" }: {
  slug: string;
  current: MissionStepId | LegacyStepId;
  query?: string;
}) {
  const currentId = current in legacy ? legacy[current as LegacyStepId] : (current as MissionStepId);
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  return (
    <nav aria-label="Mission progress" className="mb-5 !block">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2">
        {steps.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "next";
          const content = (
            <span
              className={
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 px-2.5 py-1 font-display font-bold tracking-wide " +
                (state === "current"
                  ? "border-space-950 bg-pop-yellow text-space-950 shadow-[0_3px_0_rgba(0,0,0,0.35)]"
                  : state === "done"
                    ? "border-pop-cyan/70 text-foreground"
                    : "border-border text-muted-foreground")
              }
            >
              <span aria-hidden="true">{state === "done" ? "✓" : step.icon}</span>
              <span className={state === "current" ? "uppercase" : "sr-only uppercase sm:not-sr-only"}>{step.label}</span>
              {state === "done" && <span className="sr-only"> (completed)</span>}
            </span>
          );
          return (
            <li key={step.id} className="flex items-center gap-1.5 sm:gap-2" aria-current={state === "current" ? "step" : undefined}>
              {state === "done" && step.path ? (
                <Link href={`/mission/${slug}/${step.path}${query}`} className="rounded-full focus-visible:outline-[3px] focus-visible:outline-ring">
                  {content}
                </Link>
              ) : (
                content
              )}
              {index < steps.length - 1 && <span aria-hidden="true" className="text-muted-foreground">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
