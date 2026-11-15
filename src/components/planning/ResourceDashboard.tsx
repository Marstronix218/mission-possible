import { partsCatalog } from "@/lib/sim/catalog";
import { summarizeResources } from "@/lib/sim/resources";
import type {
  Constraints,
  Mission,
  ResourceSummary,
  SatelliteDesign,
} from "@/types/game";
import {
  consequenceHints,
  deliveryDelayHours,
  describeChange,
  explainViolations,
} from "./component-performance";

type Status = "ok" | "tight" | "over" | "missing";
const statusText: Record<
  Status,
  { icon: string; word: string; bar: string; badge: string }
> = {
  ok: { icon: "✓", word: "OK", bar: "bg-ok", badge: "bg-ok text-space-950" },
  tight: {
    icon: "!",
    word: "TIGHT",
    bar: "bg-warn",
    badge: "bg-warn text-space-950",
  },
  over: {
    icon: "✕",
    word: "OVER",
    bar: "bg-bad",
    badge: "bg-bad text-space-950",
  },
  missing: {
    icon: "…",
    word: "NOT SET",
    bar: "bg-muted-foreground",
    badge: "border-2 border-border text-muted-foreground",
  },
};

const ratio = (value: number, limit: number, tightAt: number): Status =>
  limit <= 0
    ? value > 0
      ? "over"
      : "missing"
    : value > limit
      ? "over"
      : value / limit >= tightAt
        ? "tight"
        : "ok";

interface Row {
  key: string;
  label: string;
  status: Status;
  /** Bar fill 0–1 = used share of the limiting quantity. */
  fill: number;
  main: string;
  detail: string;
  changed?: string;
}

function fmtDelta(delta: number, unit: string) {
  const sign = delta > 0 ? "+" : "−";
  return unit === "$M"
    ? `${sign}$${Math.abs(delta)}M`
    : `${sign}${Math.abs(delta)} ${unit}`;
}

/** Rows in real units: each answers "can the mission afford and support this?". */
export function dashboardRows(
  design: SatelliteDesign,
  r: ResourceSummary,
  constraints: Constraints,
  mission: Pick<Mission, "targetResponseHours" | "durationDays">,
  previous?: ResourceSummary | null,
): Row[] {
  const d = (key: keyof ResourceSummary, unit: string) => {
    if (!previous) return undefined;
    const delta =
      Math.round(((r[key] as number) - (previous[key] as number)) * 10) / 10;
    return delta ? fmtDelta(delta, unit) : undefined;
  };
  const stations =
    partsCatalog.groundStations[
      String(design.groundStations) as "1" | "3" | "5"
    ];
  const delay = deliveryDelayHours(r);
  const capacity = r.downlinkGBPerDay + r.storageGB;
  const dataStatus: Status =
    !design.comm || !design.storage
      ? "missing"
      : r.dataGBPerDay > capacity
        ? "over"
        : r.dataGBPerDay > r.downlinkGBPerDay ||
            (r.downlinkGBPerDay > 0 &&
              r.dataGBPerDay / r.downlinkGBPerDay >= 0.8) ||
            r.dataGBPerDay > r.storageGB
          ? "tight"
          : "ok";
  const storageDays =
    r.dataGBPerDay > 0
      ? Math.round((r.storageGB / r.dataGBPerDay) * 10) / 10
      : null;
  return [
    {
      key: "mass",
      label: "Mass",
      status: ratio(r.massKg, constraints.massKg, 0.9),
      fill: r.massKg / constraints.massKg,
      main: `${r.massKg} / ${constraints.massKg} kg`,
      detail: `${Math.round((constraints.massKg - r.massKg) * 10) / 10} kg launch allowance left`,
      changed: d("massKg", "kg"),
    },
    {
      key: "power",
      label: "Power",
      status: design.solar ? ratio(r.powerUseW, r.powerGenW, 0.85) : "missing",
      fill: r.powerGenW ? r.powerUseW / r.powerGenW : 0,
      main: `${r.powerUseW} W used / ${r.powerGenW} W generated`,
      detail: design.solar
        ? `${Math.round(r.powerGenW - r.powerUseW)} W spare`
        : "Choose a solar array",
      changed: d("powerUseW", "W") ?? d("powerGenW", "W gen."),
    },
    {
      key: "budget",
      label: "Budget",
      status: ratio(r.costM, constraints.budgetM, 0.9),
      fill: r.costM / constraints.budgetM,
      main: `$${r.costM}M / $${constraints.budgetM}M`,
      detail: `$${Math.round((constraints.budgetM - r.costM) * 10) / 10}M left`,
      changed: d("costM", "$M"),
    },
    {
      key: "data",
      label: "Data",
      status: r.dataGBPerDay === 0 ? "missing" : dataStatus,
      fill: capacity ? r.dataGBPerDay / capacity : 0,
      main: `${r.dataGBPerDay} GB/day generated`,
      detail: `Storage ${r.storageGB} GB${storageDays !== null ? ` (${storageDays} days of data)` : ""} · downlink ${r.downlinkGBPerDay} GB/day`,
      changed: d("dataGBPerDay", "GB/day") ?? d("storageGB", "GB"),
    },
    {
      key: "comms",
      label: "Communications",
      status: !design.comm
        ? "missing"
        : r.dataGBPerDay > r.downlinkGBPerDay
          ? "tight"
          : "ok",
      fill: r.downlinkGBPerDay ? r.dataGBPerDay / r.downlinkGBPerDay : 0,
      main: `${r.downlinkGBPerDay} GB/day downlink for ${r.dataGBPerDay} GB/day`,
      detail: `${design.groundStations} ground station${design.groundStations === 1 ? "" : "s"} · ${stations?.accessMinutesPerDay ?? 0} min contact/day`,
      changed: d("downlinkGBPerDay", "GB/day"),
    },
    {
      key: "time",
      label: "Time",
      status:
        !design.comm || r.dataGBPerDay === 0
          ? "missing"
          : ratio(delay, mission.targetResponseHours, 0.8),
      fill: delay / mission.targetResponseHours,
      main:
        r.dataGBPerDay && design.comm
          ? `~${delay} h data delay / ${mission.targetResponseHours} h target`
          : `${mission.targetResponseHours} h response target`,
      detail: `Estimated downlink delay after each observation · ${mission.durationDays}-day mission`,
    },
  ];
}

/**
 * Persistent "can my mission afford and support this?" dashboard: real units,
 * progress bars, status words, last-change deltas, benefits/costs, consequence
 * hints and constraint explanations with computed fixes.
 */
export function ResourceDashboard({
  mission,
  design,
  resources,
  constraints,
  previousDesign,
}: {
  mission: Pick<Mission, "category" | "targetResponseHours" | "durationDays">;
  design: SatelliteDesign;
  resources: ResourceSummary;
  constraints: Constraints;
  previousDesign?: SatelliteDesign | null;
}) {
  const previous = previousDesign
    ? describeChange(previousDesign, design, {
        category: mission.category,
        constraints,
      })
    : null;
  const before = previousDesign
    ? summarizeResources(previousDesign, constraints)
    : null;
  const rows = dashboardRows(design, resources, constraints, mission, before);
  const violations = explainViolations(design, constraints);
  const resourceProblems = violations.filter((v) => v.key !== "incomplete");
  const hints = consequenceHints(
    design,
    constraints,
    mission.targetResponseHours,
  );
  const feasibility = resourceProblems.length
    ? { icon: "✕", word: "Not feasible yet", cls: "bg-bad text-space-950" }
    : violations.length
      ? { icon: "…", word: "Incomplete design", cls: "border-2 border-border" }
      : resources.warnings.length || hints.length
        ? {
            icon: "!",
            word: "Feasible, with risks",
            cls: "bg-warn text-space-950",
          }
        : { icon: "✓", word: "Feasible", cls: "bg-ok text-space-950" };

  return (
    <section
      aria-labelledby="resource-dashboard-h"
      className="rounded-[var(--radius)] border-[3px] border-space-950 bg-space-800 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="resource-dashboard-h"
          className="!m-0 font-display text-base font-bold !tracking-normal"
        >
          Resources: can the mission support it?
        </h2>
        <span
          aria-live="polite"
          className={
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black tracking-wider " +
            feasibility.cls
          }
        >
          <span aria-hidden="true">{feasibility.icon}</span>
          {feasibility.word}
        </span>
      </div>
      <ul className="m-0 mt-2 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {rows.map((row) => {
          const s = statusText[row.status];
          return (
            <li key={row.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold">{row.label}</span>
                <span className="flex items-center gap-1.5">
                  {row.changed && (
                    <span className="rounded bg-pop-yellow/20 px-1.5 font-mono text-xs font-bold text-pop-yellow">
                      <span className="sr-only">changed by </span>
                      {row.changed}
                    </span>
                  )}
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-1.5 text-[10px] font-black tracking-wider " +
                      s.badge
                    }
                  >
                    <span aria-hidden="true">{s.icon}</span>
                    {s.word}
                  </span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${row.label} use`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  Math.min(1, Math.max(0, row.fill)) * 100,
                )}
                aria-valuetext={row.main}
                className="relative mt-1 h-2.5 overflow-hidden rounded-full border-2 border-space-950 bg-space-950"
              >
                <div
                  className={"h-full rounded-full transition-[width] " + s.bar}
                  style={{
                    width: `${Math.round(Math.min(1, Math.max(0, row.fill)) * 100)}%`,
                  }}
                />
              </div>
              <p className="!m-0 mt-0.5 font-mono text-xs font-bold">
                {row.main}
              </p>
              <p className="!m-0 text-xs text-muted-foreground">{row.detail}</p>
            </li>
          );
        })}
      </ul>

      {violations.length > 0 && (
        <div
          className="mt-3 space-y-2"
          role="group"
          aria-label="What blocks launch"
        >
          {violations.map((v) => (
            <div
              key={v.key}
              className="rounded-xl border-2 border-dashed border-pop-pink p-2.5"
            >
              <p className="!m-0 font-bold">
                <span aria-hidden="true">✕ </span>
                {v.resource}: {v.why}
              </p>
              <p className="!m-0 text-xs text-muted-foreground">{v.meaning}</p>
              {v.fixes.length > 0 && (
                <>
                  <p className="!m-0 mt-1 text-xs font-bold">
                    Changes that would fix it:
                  </p>
                  <ul className="!m-0 list-disc pl-4 text-xs">
                    {v.fixes.map((fix) => (
                      <li key={fix}>{fix}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {hints.length > 0 && (
        <ul
          className="!mb-0 mt-3 list-none space-y-1 p-0 text-xs"
          aria-label="Consequences of the current design"
        >
          {hints.map((hint) => (
            <li key={hint}>
              <span aria-hidden="true">⚠ </span>
              <span className="sr-only">Warning: </span>
              {hint}
            </li>
          ))}
        </ul>
      )}

      {previous &&
        (previous.benefits.length > 0 || previous.costs.length > 0) && (
          <div
            className="mt-3 grid gap-2 border-t-2 border-border pt-2 sm:grid-cols-2"
            aria-live="polite"
          >
            <p className="!m-0 font-bold sm:col-span-2">Your last change</p>
            <div>
              <p className="!m-0 text-xs font-black tracking-wider text-pop-lime">
                ＋ BENEFITS
              </p>
              <ul className="!m-0 list-none p-0 text-xs">
                {previous.benefits.length ? (
                  previous.benefits.map((b) => <li key={b}>{b}</li>)
                ) : (
                  <li>None</li>
                )}
              </ul>
            </div>
            <div>
              <p className="!m-0 text-xs font-black tracking-wider text-pop-pink">
                − COSTS
              </p>
              <ul className="!m-0 list-none p-0 text-xs">
                {previous.costs.length ? (
                  previous.costs.map((c) => <li key={c}>{c}</li>)
                ) : (
                  <li>None</li>
                )}
              </ul>
            </div>
          </div>
        )}
    </section>
  );
}
