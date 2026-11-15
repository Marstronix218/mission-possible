import Link from "next/link";

export type MissionStepId = "emergency" | "build" | "launch" | "observe" | "debrief";

const steps: { id: MissionStepId; label: string; path: string | null }[] = [
  { id: "emergency", label: "Emergency", path: "brief" },
  { id: "build", label: "Build", path: "design" },
  { id: "launch", label: "Launch", path: null },
  { id: "observe", label: "Observe", path: null },
  { id: "debrief", label: "Debrief", path: null },
];

/**
 * Five-step progress bar shared by every mission screen.
 * Completed steps that have their own page are links; the current step is
 * marked with aria-current and a text label (not color alone).
 */
export function MissionSteps({ slug, current, query = "" }: { slug: string; current: MissionStepId; query?: string }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <nav aria-label="Mission progress" className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {steps.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "next";
          const marker = state === "done" ? "✓" : String(index + 1);
          const content = (
            <span
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 " +
                (state === "current"
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : state === "done"
                    ? "border-primary/60 text-foreground"
                    : "border-border text-muted-foreground")
              }
            >
              <span aria-hidden="true" className="font-mono text-xs">{marker}</span>
              {step.label}
              {state === "done" && <span className="sr-only"> (completed)</span>}
            </span>
          );
          return (
            <li key={step.id} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              {state === "done" && step.path ? (
                <Link href={`/mission/${slug}/${step.path}${query}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                  {content}
                </Link>
              ) : (
                content
              )}
              {index < steps.length - 1 && <span aria-hidden="true" className="text-muted-foreground">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
